// 系统账号与权限：决定哪些登录账号可以进入这个项目（不是现场工人，工人在“施工团队”里）
const projectMembers = {
    currentProjectId: null,
    currentProjectName: '',
    members: [],
    allUsers: [],

    ROLE_TEXT: {
        manager: '管理者 ผู้จัดการ',
        purchaser: '采购者 ผู้จัดซื้อ',
        executor: '执行者 ผู้ปฏิบัติงาน'
    },

    toast(msg, type) { if (typeof app !== 'undefined' && app.showToast) app.showToast(msg, type || 'success'); else alert(msg); },
    req(method, path, body) {
        return apiRequest('/api' + path, { method, body: body ? JSON.stringify(body) : undefined });
    },

    // 显示账号管理窗口
    async showMembersModal(projectId, projectName) {
        this.currentProjectId = projectId;
        this.currentProjectName = projectName || '';
        try {
            app.showLoading();
            await Promise.all([this.loadProjectMembers(), this.loadAllUsers()]);
            this.renderModal();
        } catch (error) {
            console.error('加载项目账号失败:', error);
            this.toast('加载失败 โหลดไม่สำเร็จ', 'error');
        } finally {
            app.hideLoading();
        }
    },

    async loadProjectMembers() {
        try {
            const r = await this.req('GET', `/projects/${this.currentProjectId}/members`);
            this.members = r.success ? r.data : [];
        } catch (error) {
            console.error('加载项目账号失败:', error);
            this.members = [];
        }
    },

    async loadAllUsers() {
        try {
            const r = await this.req('GET', '/users');
            this.allUsers = r.success ? r.data : [];
        } catch (error) {
            console.error('加载用户列表失败:', error);
            this.allUsers = [];
        }
    },

    renderModal() {
        const available = this.getAvailableUsers();
        const modal = `
            <div class="modal" id="project-members-modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3>👥 系统账号与权限 บัญชีผู้ใช้ - ${this.escapeHtml(this.currentProjectName)}</h3>
                        <button class="close-btn" onclick="projectMembers.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="info-message">这里管理的是“能登录系统的账号”，不是现场工人。现场工人请在「施工团队与工种」里录入。</p>
                        <div class="members-section">
                            <div class="section-header"><h4>已加入这个项目的账号 (${this.members.length})</h4></div>
                            <div class="members-list">${this.renderMembersList()}</div>
                        </div>
                        <div class="members-section">
                            <div class="section-header"><h4>可以加入的账号</h4></div>
                            ${available.length ? `<div class="available-users-list">${this.renderAvailableUsers(available)}</div>`
                                : '<p class="info-message">所有账号都已加入 ผู้ใช้ทั้งหมดอยู่ในโครงการแล้ว</p>'}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="projectMembers.closeModal()">关闭 ปิด</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modal-container').innerHTML = modal;
        document.getElementById('project-members-modal').style.display = 'flex';
    },

    renderMembersList() {
        if (this.members.length === 0) return '<p class="empty-message">还没有账号 ยังไม่มีบัญชี</p>';
        return this.members.map(member => {
            const date = member.assigned_at ? new Date(member.assigned_at).toLocaleDateString('zh-CN') : '-';
            return `
                <div class="member-item">
                    <div class="member-info">
                        <div class="member-avatar">${this.getRoleBadge(member.role)}</div>
                        <div class="member-details">
                            <div class="member-name">${this.escapeHtml(member.full_name || member.username)}</div>
                            <div class="member-meta">
                                <span class="role-badge">${this.ROLE_TEXT[member.role] || this.escapeHtml(member.role)}</span>
                                <span class="assigned-date">加入时间: ${date}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-small btn-danger" onclick="projectMembers.removeMember(${member.user_id})">🗑️ 移除 ลบ</button>
                </div>`;
        }).join('');
    },

    renderAvailableUsers(users) {
        return users.map(user => `
            <div class="available-user-item">
                <div class="member-info">
                    <div class="member-avatar">${this.getRoleBadge(user.role)}</div>
                    <div class="member-details">
                        <div class="member-name">${this.escapeHtml(user.full_name || user.username)}</div>
                        <div class="member-meta"><span class="role-badge">${this.ROLE_TEXT[user.role] || this.escapeHtml(user.role)}</span></div>
                    </div>
                </div>
                <button class="btn btn-small btn-primary" onclick="projectMembers.addMember(${user.id})">➕ 添加 เพิ่ม</button>
            </div>`).join('');
    },

    getAvailableUsers() {
        const ids = this.members.map(m => m.user_id);
        return this.allUsers.filter(user => !ids.includes(user.id));
    },

    getRoleBadge(role) {
        return { manager: '👔', purchaser: '🛒', executor: '👷' }[role] || '👤';
    },

    async addMember(userId) {
        try {
            app.showLoading();
            const r = await this.req('POST', `/projects/${this.currentProjectId}/members`, { user_id: userId });
            if (r.success) {
                this.toast('已添加 เพิ่มแล้ว');
                await this.loadProjectMembers();
                this.renderModal();
            } else {
                this.toast(r.message || '添加失败', 'error');
            }
        } catch (error) {
            console.error('添加账号失败:', error);
            this.toast(error.message || '添加失败', 'error');
        } finally {
            app.hideLoading();
        }
    },

    async removeMember(userId) {
        if (!confirm('确认把这个账号移出项目？ ยืนยันลบบัญชีออกจากโครงการ?')) return;
        try {
            app.showLoading();
            const r = await this.req('DELETE', `/projects/${this.currentProjectId}/members/${userId}`);
            if (r.success) {
                this.toast('已移除 ลบแล้ว');
                await this.loadProjectMembers();
                this.renderModal();
            } else {
                this.toast(r.message || '移除失败', 'error');
            }
        } catch (error) {
            console.error('移除账号失败:', error);
            this.toast(error.message || '移除失败', 'error');
        } finally {
            app.hideLoading();
        }
    },

    closeModal() {
        document.getElementById('modal-container').innerHTML = '';
        this.currentProjectId = null;
        this.currentProjectName = '';
        this.members = [];
        this.allUsers = [];
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : text;
        return div.innerHTML;
    }
};
