// 主应用逻辑
const app = {
    currentView: 'projects',
    currentProject: null,

    // 初始化
    init() {
        // 检查登录状态
        if (authToken) {
            this.showMainPage();
            this.loadUserInfo();
            this.loadProjects();
        } else {
            this.showLoginPage();
        }

        // 绑定登录表单
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 应用翻译
        updateTranslations();
    },

    // 显示登录页
    showLoginPage() {
        document.getElementById('login-page').classList.add('active');
        document.getElementById('main-page').classList.remove('active');
    },

    // 显示主页面
    showMainPage() {
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('main-page').classList.add('active');
    },

    // 处理登录
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');

        try {
            this.showLoading();
            const result = await api.login(username, password);
            if (result.success) {
                this.showMainPage();
                this.loadUserInfo();
                this.loadProjects();
            }
        } catch (error) {
            errorEl.textContent = t('login.error');
        } finally {
            this.hideLoading();
        }
    },

    // 加载用户信息
    loadUserInfo() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        document.getElementById('user-name').textContent = user.username || '';
    },

    // 退出登录
    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.reload();
    },

    // 切换语言
    setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('language', lang);
        updateTranslations(lang);
        // 重新加载当前视图数据
        this.refreshCurrentView();
    },

    // 显示视图
    showView(viewName) {
        // 隐藏所有视图
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        // 显示目标视图
        document.getElementById(`${viewName}-view`).classList.add('active');
        this.currentView = viewName;

        // 加载视图数据
        switch(viewName) {
            case 'projects':
                this.loadProjects();
                break;
            case 'processes':
                this.loadProjectSelectors();
                break;
            case 'materials':
                this.loadProjectSelectors();
                break;
            case 'photos':
                this.loadProjectSelectors();
                break;
        }
    },

    // 刷新当前视图
    refreshCurrentView() {
        this.showView(this.currentView);
    },

    // 加载项目列表
    async loadProjects() {
        try {
            this.showLoading();
            const result = await api.getProjects();
            if (result.success) {
                this.renderProjects(result.data);
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            this.hideLoading();
        }
    },

    // 渲染项目列表
    renderProjects(projects) {
        const container = document.getElementById('projects-list');
        if (projects.length === 0) {
            container.innerHTML = `<p class="empty-state">${t('projects.empty', currentLang)}</p>`;
            return;
        }

        container.innerHTML = projects.map(project => `
            <div class="project-card" onclick="app.viewProjectDetail(${project.id})">
                <h4>${getI18nField(project, 'name')}</h4>
                <div class="project-info">
                    <span><strong>${t('projects.location')}:</strong> ${getI18nField(project, 'location') || '-'}</span>
                    <span><strong>${t('projects.progress')}:</strong> ${project.progress || 0}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${project.progress || 0}%"></div>
                </div>
                <div class="project-meta">
                    <span>${project.start_date || '-'}</span>
                    <span class="status-${project.status}">${project.status}</span>
                </div>
            </div>
        `).join('');
    },

    // 显示项目表单
    showProjectForm() {
        const modal = this.createModal(t('projects.add'), `
            <form id="project-form">
                <div class="form-group">
                    <label>${t('projects.name')} (${t('common.chinese')})</label>
                    <input type="text" id="project-name-zh" required>
                </div>
                <div class="form-group">
                    <label>${t('projects.name')} (${t('common.thai')})</label>
                    <input type="text" id="project-name-th" required>
                </div>
                <div class="form-group">
                    <label>${t('projects.location')} (${t('common.chinese')})</label>
                    <input type="text" id="project-location-zh">
                </div>
                <div class="form-group">
                    <label>${t('projects.location')} (${t('common.thai')})</label>
                    <input type="text" id="project-location-th">
                </div>
                <div class="form-group">
                    <label>${t('projects.client')}</label>
                    <input type="text" id="project-client">
                </div>
                <div class="form-group">
                    <label>${t('projects.startDate')}</label>
                    <input type="date" id="project-start-date" required>
                </div>
                <div class="form-group">
                    <label>${t('projects.endDate')}</label>
                    <input type="date" id="project-end-date">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="app.closeModal()">${t('common.cancel')}</button>
                    <button type="submit" class="btn-primary">${t('common.save')}</button>
                </div>
            </form>
        `);

        document.getElementById('project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateProject();
        });
    },

    // 处理创建项目
    async handleCreateProject() {
        const data = {
            name: {
                zh: document.getElementById('project-name-zh').value,
                th: document.getElementById('project-name-th').value
            },
            location: {
                zh: document.getElementById('project-location-zh').value,
                th: document.getElementById('project-location-th').value
            },
            client_name: document.getElementById('project-client').value,
            start_date: document.getElementById('project-start-date').value,
            planned_end_date: document.getElementById('project-end-date').value
        };

        try {
            this.showLoading();
            const result = await api.createProject(data);
            if (result.success) {
                this.closeModal();
                this.loadProjects();
                this.showToast(t('common.success'));
            }
        } catch (error) {
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 加载项目选择器
    async loadProjectSelectors() {
        try {
            const result = await api.getProjects();
            if (result.success) {
                const selectors = ['project-selector', 'material-project-selector', 'photo-project-selector'];
                selectors.forEach(id => {
                    const select = document.getElementById(id);
                    if (select) {
                        select.innerHTML = `<option value="">${t('projects.selectProject')}</option>` +
                            result.data.map(p => `<option value="${p.id}">${getI18nField(p, 'name')}</option>`).join('');
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load project selectors:', error);
        }
    },

    // 加载工序
    async loadProcesses(projectId) {
        if (!projectId) return;
        
        try {
            this.showLoading();
            const result = await api.getProcesses(projectId);
            if (result.success) {
                this.renderProcesses(result.data);
            }
        } catch (error) {
            console.error('Failed to load processes:', error);
        } finally {
            this.hideLoading();
        }
    },

    // 渲染工序列表
    renderProcesses(processes) {
        const container = document.getElementById('processes-list');
        if (!processes || processes.length === 0) {
            container.innerHTML = `<p class="empty-state">暂无工序数据</p>`;
            return;
        }

        container.innerHTML = processes.map(process => {
            const statusClass = process.status || 'not_started';
            const statusText = t(`processes.status.${statusClass}`);
            
            return `
                <div class="process-item status-${statusClass}">
                    <div class="process-header">
                        <span class="process-code">${process.process_code}</span>
                        <h4>${getI18nField(process, 'process_name')}</h4>
                        <span class="process-status">${statusText}</span>
                    </div>
                    <div class="process-details">
                        ${process.assigned_workers ? `<div><strong>${t('processes.workers')}:</strong> ${JSON.stringify(process.assigned_workers)}</div>` : ''}
                        ${process.actual_start_date ? `<div><strong>开始:</strong> ${process.actual_start_date}</div>` : ''}
                        ${process.actual_end_date ? `<div><strong>完成:</strong> ${process.actual_end_date}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    // 创建模态框
    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="app.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        document.getElementById('modal-container').appendChild(modal);
        return modal;
    },

    // 关闭模态框
    closeModal() {
        document.getElementById('modal-container').innerHTML = '';
    },

    // 显示加载状态
    showLoading() {
        document.getElementById('loading').classList.add('active');
    },

    // 隐藏加载状态
    hideLoading() {
        document.getElementById('loading').classList.remove('active');
    },

    // 显示提示消息
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
