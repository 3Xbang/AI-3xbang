// 用户管理模块
const userManager = {
    users: [],
    projects: [],
    
    // 初始化
    async init() {
        await this.loadUsers();
        await this.loadProjects();
        this.renderUsers();
        this.updateStats();
    },
    
    // 加载所有用户
    async loadUsers() {
        try {
            const response = await api.get('/users');
            if (response.success) {
                this.users = response.data;
            }
        } catch (error) {
            console.error('加载用户失败:', error);
            app.showError(i18n.t('users.loadError'));
        }
    },
    
    // 加载所有项目
    async loadProjects() {
        try {
            const response = await api.get('/projects');
            if (response.success) {
                this.projects = response.data;
            }
        } catch (error) {
            console.error('加载项目失败:', error);
        }
    },
    
    // 渲染用户列表
    renderUsers() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        
        if (this.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">' + i18n.t('users.noUsers') + '</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.users.map(user => {
            const roleText = i18n.t(`roles.${user.role}`);
            const roleBadge = this.getRoleBadge(user.role);
            const createdAt = new Date(user.created_at).toLocaleDateString('zh-CN');
            
            return `
                <tr data-user-id="${user.id}">
                    <td>${this.escapeHtml(user.username)}</td>
                    <td>${this.escapeHtml(user.full_name || '-')}</td>
                    <td>${roleBadge} ${roleText}</td>
                    <td>
                        <button class="btn btn-small" onclick="userManager.showProjectAssignModal(${user.id})">
                            📋 ${i18n.t('users.assignProjects')}
                        </button>
                    </td>
                    <td>${createdAt}</td>
                    <td>
                        <button class="btn btn-small" onclick="userManager.showEditUserModal(${user.id})">
                            ✏️ ${i18n.t('common.edit')}
                        </button>
                        <button class="btn btn-small btn-danger" onclick="userManager.confirmDeleteUser(${user.id})">
                            🗑️ ${i18n.t('common.delete')}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    // 更新统计信息
    updateStats() {
        const stats = {
            total: this.users.length,
            manager: this.users.filter(u => u.role === 'manager').length,
            purchaser: this.users.filter(u => u.role === 'purchaser').length,
            executor: this.users.filter(u => u.role === 'executor').length
        };
        
        document.getElementById('stat-total-users').textContent = stats.total;
        document.getElementById('stat-managers').textContent = stats.manager;
        document.getElementById('stat-purchasers').textContent = stats.purchaser;
        document.getElementById('stat-executors').textContent = stats.executor;
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
    
    // 显示添加用户模态框
    showAddUserModal() {
        const modal = `
            <div class="modal" id="add-user-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${i18n.t('users.addUser')}</h3>
                        <button class="close-btn" onclick="userManager.closeModal()">&times;</button>
                    </div>
                    <form id="add-user-form" onsubmit="userManager.handleAddUser(event)">
                        <div class="form-group">
                            <label>${i18n.t('users.username')} *</label>
                            <input type="text" name="username" required minlength="3" maxlength="50">
                        </div>
                        <div class="form-group">
                            <label>${i18n.t('users.password')} *</label>
                            <input type="password" name="password" required minlength="6">
                            <small>${i18n.t('users.passwordHint')}</small>
                        </div>
                        <div class="form-group">
                            <label>${i18n.t('users.fullName')} *</label>
                            <input type="text" name="full_name" required maxlength="100">
                        </div>
                        <div class="form-group">
                            <label>${i18n.t('users.role')} *</label>
                            <select name="role" required>
                                <option value="">${i18n.t('users.selectRole')}</option>
                                <option value="manager">👔 ${i18n.t('roles.manager')}</option>
                                <option value="purchaser">🛒 ${i18n.t('roles.purchaser')}</option>
                                <option value="executor">👷 ${i18n.t('roles.executor')}</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="userManager.closeModal()">
                                ${i18n.t('common.cancel')}
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${i18n.t('common.submit')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.getElementById('modal-container').innerHTML = modal;
        document.getElementById('add-user-modal').style.display = 'flex';
    },
    
    // 处理添加用户
    async handleAddUser(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        
        const userData = {
            username: formData.get('username'),
            password: formData.get('password'),
            full_name: formData.get('full_name'),
            role: formData.get('role')
        };
        
        try {
            app.showLoading();
            const response = await api.post('/users', userData);
            
            if (response.success) {
                app.showSuccess(i18n.t('users.addSuccess'));
                this.closeModal();
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
            } else {
                app.showError(response.message || i18n.t('users.addError'));
            }
        } catch (error) {
            console.error('添加用户失败:', error);
            app.showError(i18n.t('users.addError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 显示编辑用户模态框
    showEditUserModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        
        const modal = `
            <div class="modal" id="edit-user-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${i18n.t('users.editUser')}</h3>
                        <button class="close-btn" onclick="userManager.closeModal()">&times;</button>
                    </div>
                    <form id="edit-user-form" onsubmit="userManager.handleEditUser(event, ${userId})">
                        <div class="form-group">
                            <label>${i18n.t('users.username')}</label>
                            <input type="text" value="${this.escapeHtml(user.username)}" disabled>
                            <small>${i18n.t('users.usernameCannotChange')}</small>
                        </div>
                        <div class="form-group">
                            <label>${i18n.t('users.newPassword')}</label>
                            <input type="password" name="password" minlength="6">
                            <small>${i18n.t('users.passwordOptional')}</small>
                        </div>
                        <div class="form-group">
                            <label>${i18n.t('users.fullName')} *</label>
                            <input type="text" name="full_name" value="${this.escapeHtml(user.full_name || '')}" required maxlength="100">
                        </div>
                        <div class="form-group">
                            <label>${i18n.t('users.role')} *</label>
                            <select name="role" required>
                                <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>👔 ${i18n.t('roles.manager')}</option>
                                <option value="purchaser" ${user.role === 'purchaser' ? 'selected' : ''}>🛒 ${i18n.t('roles.purchaser')}</option>
                                <option value="executor" ${user.role === 'executor' ? 'selected' : ''}>👷 ${i18n.t('roles.executor')}</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="userManager.closeModal()">
                                ${i18n.t('common.cancel')}
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${i18n.t('common.save')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.getElementById('modal-container').innerHTML = modal;
        document.getElementById('edit-user-modal').style.display = 'flex';
    },
    
    // 处理编辑用户
    async handleEditUser(event, userId) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        
        const userData = {
            full_name: formData.get('full_name'),
            role: formData.get('role')
        };
        
        // 只在填写了新密码时才包含密码
        const password = formData.get('password');
        if (password && password.trim()) {
            userData.password = password;
        }
        
        try {
            app.showLoading();
            const response = await api.put(`/users/${userId}`, userData);
            
            if (response.success) {
                app.showSuccess(i18n.t('users.updateSuccess'));
                this.closeModal();
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
            } else {
                app.showError(response.message || i18n.t('users.updateError'));
            }
        } catch (error) {
            console.error('更新用户失败:', error);
            app.showError(i18n.t('users.updateError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 确认删除用户
    confirmDeleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        
        if (confirm(i18n.t('users.confirmDelete').replace('{name}', user.username))) {
            this.deleteUser(userId);
        }
    },
    
    // 删除用户
    async deleteUser(userId) {
        try {
            app.showLoading();
            const response = await api.delete(`/users/${userId}`);
            
            if (response.success) {
                app.showSuccess(i18n.t('users.deleteSuccess'));
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
            } else {
                app.showError(response.message || i18n.t('users.deleteError'));
            }
        } catch (error) {
            console.error('删除用户失败:', error);
            app.showError(i18n.t('users.deleteError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 显示项目分配模态框
    async showProjectAssignModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        
        try {
            app.showLoading();
            
            // 获取用户已分配的项目
            const response = await api.get(`/users/${userId}/projects`);
            const assignedProjectIds = response.success ? response.data.map(p => p.id) : [];
            
            const projectCheckboxes = this.projects.map(project => {
                const checked = assignedProjectIds.includes(project.id);
                return `
                    <div class="checkbox-item">
                        <label>
                            <input type="checkbox" name="projects" value="${project.id}" ${checked ? 'checked' : ''}>
                            ${this.escapeHtml(project.name)}
                        </label>
                    </div>
                `;
            }).join('');
            
            const modal = `
                <div class="modal" id="assign-projects-modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>${i18n.t('users.assignProjectsTo').replace('{name}', user.full_name || user.username)}</h3>
                            <button class="close-btn" onclick="userManager.closeModal()">&times;</button>
                        </div>
                        <form id="assign-projects-form" onsubmit="userManager.handleAssignProjects(event, ${userId})">
                            <div class="form-group">
                                <label>${i18n.t('users.selectProjects')}</label>
                                <div class="checkbox-group">
                                    ${projectCheckboxes || '<p>' + i18n.t('projects.noProjects') + '</p>'}
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="userManager.closeModal()">
                                    ${i18n.t('common.cancel')}
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    ${i18n.t('common.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.getElementById('modal-container').innerHTML = modal;
            document.getElementById('assign-projects-modal').style.display = 'flex';
        } catch (error) {
            console.error('加载项目分配失败:', error);
            app.showError(i18n.t('users.loadProjectsError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 处理项目分配
    async handleAssignProjects(event, userId) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const selectedProjects = formData.getAll('projects').map(id => parseInt(id));
        
        try {
            app.showLoading();
            const response = await api.post(`/users/${userId}/assign-projects`, {
                project_ids: selectedProjects
            });
            
            if (response.success) {
                app.showSuccess(i18n.t('users.assignProjectsSuccess'));
                this.closeModal();
            } else {
                app.showError(response.message || i18n.t('users.assignProjectsError'));
            }
        } catch (error) {
            console.error('分配项目失败:', error);
            app.showError(i18n.t('users.assignProjectsError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 关闭模态框
    closeModal() {
        document.getElementById('modal-container').innerHTML = '';
    },
    
    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 当用户视图被激活时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 监听视图切换
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'users-view' && mutation.target.classList.contains('active')) {
                userManager.init();
            }
        });
    });
    
    const usersView = document.getElementById('users-view');
    if (usersView) {
        observer.observe(usersView, { attributes: true, attributeFilter: ['class'] });
    }
});
