// 项目成员管理模块
const projectMembers = {
    currentProjectId: null,
    currentProjectName: '',
    members: [],
    allUsers: [],
    
    // 显示项目成员管理模态框
    async showMembersModal(projectId, projectName) {
        this.currentProjectId = projectId;
        this.currentProjectName = projectName;
        
        try {
            app.showLoading();
            
            // 加载项目成员和所有用户
            await Promise.all([
                this.loadProjectMembers(),
                this.loadAllUsers()
            ]);
            
            this.renderModal();
        } catch (error) {
            console.error('加载项目成员失败:', error);
            app.showError(i18n.t('projects.loadMembersError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 加载项目成员
    async loadProjectMembers() {
        try {
            const response = await api.get(`/projects/${this.currentProjectId}/members`);
            if (response.success) {
                this.members = response.data;
            }
        } catch (error) {
            console.error('加载项目成员失败:', error);
            this.members = [];
        }
    },
    
    // 加载所有用户
    async loadAllUsers() {
        try {
            const response = await api.get('/users');
            if (response.success) {
                this.allUsers = response.data;
            }
        } catch (error) {
            console.error('加载用户列表失败:', error);
            this.allUsers = [];
        }
    },
    
    // 渲染模态框
    renderModal() {
        const membersList = this.renderMembersList();
        const availableUsers = this.getAvailableUsers();
        
        const modal = `
            <div class="modal" id="project-members-modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3>👥 ${i18n.t('projects.membersManagement')} - ${this.escapeHtml(this.currentProjectName)}</h3>
                        <button class="close-btn" onclick="projectMembers.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="members-section">
                            <div class="section-header">
                                <h4>${i18n.t('projects.currentMembers')} (${this.members.length})</h4>
                            </div>
                            <div class="members-list">
                                ${membersList}
                            </div>
                        </div>
                        
                        ${availableUsers.length > 0 ? `
                            <div class="members-section">
                                <div class="section-header">
                                    <h4>${i18n.t('projects.addMembers')}</h4>
                                </div>
                                <div class="available-users-list">
                                    ${this.renderAvailableUsers(availableUsers)}
                                </div>
                            </div>
                        ` : `
                            <div class="members-section">
                                <p class="info-message">${i18n.t('projects.allUsersAssigned')}</p>
                            </div>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="projectMembers.closeModal()">
                            ${i18n.t('common.close')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('modal-container').innerHTML = modal;
        document.getElementById('project-members-modal').style.display = 'flex';
    },
    
    // 渲染成员列表
    renderMembersList() {
        if (this.members.length === 0) {
            return `<p class="empty-message">${i18n.t('projects.noMembers')}</p>`;
        }
        
        return this.members.map(member => {
            const roleText = i18n.t(`roles.${member.role}`);
            const roleBadge = this.getRoleBadge(member.role);
            const assignedDate = new Date(member.assigned_at).toLocaleDateString('zh-CN');
            
            return `
                <div class="member-item">
                    <div class="member-info">
                        <div class="member-avatar">${roleBadge}</div>
                        <div class="member-details">
                            <div class="member-name">${this.escapeHtml(member.full_name || member.username)}</div>
                            <div class="member-meta">
                                <span class="role-badge">${roleText}</span>
                                <span class="assigned-date">${i18n.t('projects.assignedAt')}: ${assignedDate}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-small btn-danger" onclick="projectMembers.removeMember(${member.user_id})">
                        🗑️ ${i18n.t('common.remove')}
                    </button>
                </div>
            `;
        }).join('');
    },
    
    // 渲染可添加的用户列表
    renderAvailableUsers(users) {
        return users.map(user => {
            const roleText = i18n.t(`roles.${user.role}`);
            const roleBadge = this.getRoleBadge(user.role);
            
            return `
                <div class="available-user-item">
                    <div class="member-info">
                        <div class="member-avatar">${roleBadge}</div>
                        <div class="member-details">
                            <div class="member-name">${this.escapeHtml(user.full_name || user.username)}</div>
                            <div class="member-meta">
                                <span class="role-badge">${roleText}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-small btn-primary" onclick="projectMembers.addMember(${user.id})">
                        ➕ ${i18n.t('common.add')}
                    </button>
                </div>
            `;
        }).join('');
    },
    
    // 获取可添加的用户（未分配的用户）
    getAvailableUsers() {
        const memberUserIds = this.members.map(m => m.user_id);
        return this.allUsers.filter(user => !memberUserIds.includes(user.id));
    },
    
    // 获取角色徽章
    getRoleBadge(role) {
        const badges = {
            manager: '👔',
            purchaser: '🛒',
            executor: '👷'
        };
        return badges[role] || '👤';
    },
    
    // 添加成员
    async addMember(userId) {
        try {
            app.showLoading();
            
            const user = this.allUsers.find(u => u.id === userId);
            if (!user) return;
            
            const response = await api.post(`/projects/${this.currentProjectId}/members`, {
                user_id: userId,
                role: user.role  // 使用用户的角色
            });
            
            if (response.success) {
                app.showSuccess(i18n.t('projects.addMemberSuccess'));
                // 重新加载成员列表
                await this.loadProjectMembers();
                this.renderModal();
            } else {
                app.showError(response.message || i18n.t('projects.addMemberError'));
            }
        } catch (error) {
            console.error('添加成员失败:', error);
            app.showError(i18n.t('projects.addMemberError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 移除成员
    async removeMember(userId) {
        if (!confirm(i18n.t('projects.confirmRemoveMember'))) {
            return;
        }
        
        try {
            app.showLoading();
            
            const response = await api.delete(`/projects/${this.currentProjectId}/members/${userId}`);
            
            if (response.success) {
                app.showSuccess(i18n.t('projects.removeMemberSuccess'));
                // 重新加载成员列表
                await this.loadProjectMembers();
                this.renderModal();
            } else {
                app.showError(response.message || i18n.t('projects.removeMemberError'));
            }
        } catch (error) {
            console.error('移除成员失败:', error);
            app.showError(i18n.t('projects.removeMemberError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 关闭模态框
    closeModal() {
        document.getElementById('modal-container').innerHTML = '';
        this.currentProjectId = null;
        this.currentProjectName = '';
        this.members = [];
        this.allUsers = [];
    },
    
    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
