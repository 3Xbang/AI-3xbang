// 项目仪表盘模块 - 登录后的首页
const ProjectDashboard = {
    projects: [],
    currentProjectId: null,

    // 初始化仪表盘
    async init() {
        await this.loadProjects();
        this.render();
        this.setupEventListeners();
    },

    // 加载项目列表
    async loadProjects() {
        try {
            app.showLoading();
            const result = await api.getProjects();
            if (result.success) {
                this.projects = result.data;
            } else {
                app.showToast(t('projects.loadError'), 'error');
            }
        } catch (error) {
            console.error('Load projects error:', error);
            app.showToast(t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 渲染项目仪表盘
    render() {
        const container = document.getElementById('project-dashboard-container');
        if (!container) return;

        if (this.projects.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>${t('dashboard.title')}</h2>
                ${PermissionManager.canManageProjects() ? `
                    <button class="btn btn-primary" onclick="ProjectDashboard.showCreateProjectModal()">
                        <span class="btn-icon">+</span>
                        <span>${t('projects.add')}</span>
                    </button>
                ` : ''}
            </div>
            <div class="projects-grid">
                ${this.projects.map(project => this.renderProjectCard(project)).join('')}
            </div>
        `;
    },

    // 渲染项目卡片
    renderProjectCard(project) {
        const progress = Math.round(project.progress || 0);
        const progressColor = this.getProgressColor(progress);
        const statusClass = project.status || 'active';

        return `
            <div class="project-card" onclick="ProjectDashboard.enterProject(${project.id})">
                <div class="project-card-header">
                    <h3>${getI18nField(project, 'name')}</h3>
                    <span class="project-status status-${statusClass}">${t('projects.status.' + statusClass)}</span>
                </div>
                <div class="project-card-body">
                    <div class="project-info-row">
                        <span class="info-label">${t('projects.location')}:</span>
                        <span class="info-value">${getI18nField(project, 'location') || '-'}</span>
                    </div>
                    <div class="project-info-row">
                        <span class="info-label">${t('projects.client')}:</span>
                        <span class="info-value">${project.client_name || '-'}</span>
                    </div>
                    <div class="project-info-row">
                        <span class="info-label">${t('projects.startDate')}:</span>
                        <span class="info-value">${project.start_date || '-'}</span>
                    </div>
                </div>
                <div class="project-card-footer">
                    <div class="progress-section">
                        <div class="progress-label">
                            <span>${t('projects.progress')}</span>
                            <span class="progress-value">${progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%; background-color: ${progressColor}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 渲染空状态
    renderEmptyState() {
        return `
            <div class="empty-state-large">
                <div class="empty-icon">🏗️</div>
                <h3>${t('dashboard.noProjects')}</h3>
                <p>${t('dashboard.noProjectsDesc')}</p>
                ${PermissionManager.canManageProjects() ? `
                    <button class="btn btn-primary btn-large" onclick="ProjectDashboard.showCreateProjectModal()">
                        <span class="btn-icon">+</span>
                        <span>${t('projects.createFirst')}</span>
                    </button>
                ` : ''}
            </div>
        `;
    },

    // 获取进度颜色
    getProgressColor(progress) {
        if (progress >= 80) return '#10b981'; // 绿色
        if (progress >= 50) return '#3b82f6'; // 蓝色
        if (progress >= 20) return '#f59e0b'; // 橙色
        return '#ef4444'; // 红色
    },

    // 进入项目详情
    enterProject(projectId) {
        // 保存当前项目ID
        app.currentProjectId = projectId;
        localStorage.setItem('currentProjectId', projectId);

        // 查找项目信息
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
            app.currentProject = project;
        }

        // 显示项目详情页
        app.showProjectDetail(projectId);
    },

    // 显示创建项目模态框
    showCreateProjectModal() {
        const modal = app.createModal(t('projects.add'), `
            <form id="create-project-form" class="form-vertical">
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.name')} (${t('common.thai')})</label>
                        <input type="text" id="project-name-th" required placeholder="เช่น: วิลล่ามิร่า">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.name')} (${t('common.chinese')})</label>
                        <input type="text" id="project-name-zh" placeholder="例如：Mira别墅">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.location')} (${t('common.thai')})</label>
                        <input type="text" id="project-location-th" placeholder="เช่น: เชียงใหม่">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.location')} (${t('common.chinese')})</label>
                        <input type="text" id="project-location-zh" placeholder="例如：清迈">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.client')}</label>
                        <input type="text" id="project-client" placeholder="${t('projects.clientPlaceholder')}">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.startDate')}</label>
                        <input type="date" id="project-start-date" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>${t('projects.endDate')}</label>
                    <input type="date" id="project-end-date">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                        ${t('common.cancel')}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        ${t('common.save')}
                    </button>
                </div>
            </form>
        `);

        document.getElementById('create-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateProject();
        });
    },

    // 处理创建项目
    async handleCreateProject() {
        const data = {
            name: {
                th: document.getElementById('project-name-th').value,
                zh: document.getElementById('project-name-zh').value || document.getElementById('project-name-th').value
            },
            location: {
                th: document.getElementById('project-location-th').value,
                zh: document.getElementById('project-location-zh').value || document.getElementById('project-location-th').value
            },
            client_name: document.getElementById('project-client').value,
            start_date: document.getElementById('project-start-date').value,
            planned_end_date: document.getElementById('project-end-date').value
        };

        try {
            app.showLoading();
            const result = await api.createProject(data);
            if (result.success) {
                app.closeModal();
                app.showToast(t('projects.createSuccess'));
                await this.loadProjects();
                this.render();
            } else {
                app.showToast(result.message || t('projects.createError'), 'error');
            }
        } catch (error) {
            console.error('Create project error:', error);
            app.showToast(t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 设置事件监听
    setupEventListeners() {
        // 可以添加筛选、排序等功能
    }
};

// 暴露到全局
window.ProjectDashboard = ProjectDashboard;
