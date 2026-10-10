// 项目详情页面 - 进入项目后的主界面
const ProjectDetail = {
    projectId: null,
    project: null,
    currentView: 'overview', // overview, tasks, processes, materials, photos, settings

    // 初始化项目详情
    async init(projectId) {
        this.projectId = projectId;
        await this.loadProjectInfo();
        this.render();
        this.showSubView('overview');
    },

    // 加载项目信息
    async loadProjectInfo() {
        try {
            // 从app.currentProject获取或重新加载
            if (app.currentProject && app.currentProject.id === this.projectId) {
                this.project = app.currentProject;
            } else {
                const result = await api.getProjects();
                if (result.success) {
                    this.project = result.data.find(p => p.id === this.projectId);
                }
            }
        } catch (error) {
            console.error('Load project info error:', error);
        }
    },

    // 渲染项目详情页面
    render() {
        const container = document.getElementById('project-detail-container');
        if (!container) return;

        container.innerHTML = `
            <!-- 项目头部 -->
            <div class="project-detail-header">
                <div class="header-left">
                    <button class="btn-back" onclick="ProjectDetail.backToDashboard()">
                        <span>←</span> ${t('common.back')}
                    </button>
                    <div class="project-title">
                        <h2>${getI18nField(this.project, 'name')}</h2>
                        <p class="project-location">${getI18nField(this.project, 'location')}</p>
                    </div>
                </div>
                <div class="header-right">
                    <div class="project-progress-mini">
                        <span>${t('projects.progress')}: </span>
                        <strong>${Math.round(this.project.progress || 0)}%</strong>
                    </div>
                </div>
            </div>

            <!-- 项目导航 -->
            <div class="project-nav">
                <button class="nav-item ${this.currentView === 'overview' ? 'active' : ''}" 
                        onclick="ProjectDetail.showSubView('overview')">
                    <span class="nav-icon">📊</span>
                    <span class="nav-label">${t('projectDetail.overview')}</span>
                </button>
                <button class="nav-item ${this.currentView === 'tasks' ? 'active' : ''}" 
                        onclick="ProjectDetail.showSubView('tasks')">
                    <span class="nav-icon">📋</span>
                    <span class="nav-label">${t('nav.dailyTasks')}</span>
                </button>
                <button class="nav-item ${this.currentView === 'processes' ? 'active' : ''}" 
                        onclick="ProjectDetail.showSubView('processes')">
                    <span class="nav-icon">🔧</span>
                    <span class="nav-label">${t('nav.processes')}</span>
                </button>
                <button class="nav-item ${this.currentView === 'materials' ? 'active' : ''}" 
                        onclick="ProjectDetail.showSubView('materials')">
                    <span class="nav-icon">🧱</span>
                    <span class="nav-label">${t('nav.materials')}</span>
                </button>
                <button class="nav-item ${this.currentView === 'photos' ? 'active' : ''}" 
                        onclick="ProjectDetail.showSubView('photos')">
                    <span class="nav-icon">📷</span>
                    <span class="nav-label">${t('nav.photos')}</span>
                </button>
                ${PermissionManager.canManageProjects() ? `
                    <button class="nav-item ${this.currentView === 'settings' ? 'active' : ''}" 
                            onclick="ProjectDetail.showSubView('settings')">
                        <span class="nav-icon">⚙️</span>
                        <span class="nav-label">${t('projectDetail.settings')}</span>
                    </button>
                ` : ''}
            </div>

            <!-- 子视图容器 -->
            <div id="project-subview-container" class="project-subview-container">
                <!-- 动态内容 -->
            </div>
        `;
    },

    // 显示子视图
    async showSubView(viewName) {
        this.currentView = viewName;

        // 更新导航高亮
        document.querySelectorAll('.project-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.project-nav .nav-item:nth-child(${this.getViewIndex(viewName)})`).classList.add('active');

        // 加载对应视图
        const container = document.getElementById('project-subview-container');
        
        switch(viewName) {
            case 'overview':
                container.innerHTML = this.renderOverview();
                this.loadOverviewData();
                break;
            case 'tasks':
                container.innerHTML = '<div id="daily-tasks-container"></div>';
                await this.loadDailyTasks();
                break;
            case 'processes':
                container.innerHTML = '<div id="processes-list" class="process-timeline"></div>';
                await this.loadProcesses();
                break;
            case 'materials':
                container.innerHTML = '<div id="materials-list"></div>';
                MaterialManager.init(this.projectId);
                break;
            case 'photos':
                container.innerHTML = '<div id="photos-grid" class="photo-grid"></div>';
                await this.loadPhotos();
                break;
            case 'settings':
                container.innerHTML = this.renderSettings();
                break;
        }
    },

    // 获取视图索引
    getViewIndex(viewName) {
        const views = ['overview', 'tasks', 'processes', 'materials', 'photos', 'settings'];
        return views.indexOf(viewName) + 1;
    },

    // 渲染概览视图
    renderOverview() {
        return `
            <div class="project-overview">
                <div class="overview-cards">
                    <div class="overview-card">
                        <div class="card-icon">📊</div>
                        <div class="card-content">
                            <h3>${t('overview.totalProcesses')}</h3>
                            <p class="card-value" id="overview-processes">-</p>
                        </div>
                    </div>
                    <div class="overview-card">
                        <div class="card-icon">✅</div>
                        <div class="card-content">
                            <h3>${t('overview.completedProcesses')}</h3>
                            <p class="card-value" id="overview-completed">-</p>
                        </div>
                    </div>
                    <div class="overview-card">
                        <div class="card-icon">🚧</div>
                        <div class="card-content">
                            <h3>${t('overview.inProgress')}</h3>
                            <p class="card-value" id="overview-inprogress">-</p>
                        </div>
                    </div>
                    <div class="overview-card">
                        <div class="card-icon">👷</div>
                        <div class="card-content">
                            <h3>${t('overview.teamMembers')}</h3>
                            <p class="card-value" id="overview-members">-</p>
                        </div>
                    </div>
                </div>
                <div class="overview-details">
                    <div class="detail-section">
                        <h3>${t('overview.projectInfo')}</h3>
                        <div class="info-table">
                            <div class="info-row">
                                <span class="info-label">${t('projects.client')}:</span>
                                <span class="info-value">${this.project.client_name || '-'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">${t('projects.startDate')}:</span>
                                <span class="info-value">${this.project.start_date || '-'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">${t('projects.endDate')}:</span>
                                <span class="info-value">${this.project.planned_end_date || '-'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">${t('projects.status')}:</span>
                                <span class="info-value">
                                    <span class="status-badge status-${this.project.status}">
                                        ${t('projects.status.' + this.project.status)}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 加载概览数据
    async loadOverviewData() {
        try {
            // 加载工序统计
            const processResult = await api.getProcesses(this.projectId);
            if (processResult.success) {
                const processes = processResult.data;
                document.getElementById('overview-processes').textContent = processes.length;
                document.getElementById('overview-completed').textContent = 
                    processes.filter(p => p.status === 'completed').length;
                document.getElementById('overview-inprogress').textContent = 
                    processes.filter(p => p.status === 'in_progress').length;
            }

            // 加载团队成员统计
            const membersResult = await api.getProjectMembers(this.projectId);
            if (membersResult.success) {
                document.getElementById('overview-members').textContent = membersResult.data.length;
            }
        } catch (error) {
            console.error('Load overview data error:', error);
        }
    },

    // 加载今日任务
    async loadDailyTasks() {
        try {
            const result = await api.getDailyTasks(this.projectId);
            if (result.success) {
                // 使用现有的今日任务渲染逻辑
                app.renderDailyTasks(result.data);
            }
        } catch (error) {
            console.error('Load daily tasks error:', error);
        }
    },

    // 加载工序
    async loadProcesses() {
        try {
            const result = await api.getProcesses(this.projectId);
            if (result.success) {
                app.renderProcesses(result.data);
            }
        } catch (error) {
            console.error('Load processes error:', error);
        }
    },

    // 加载照片
    async loadPhotos() {
        try {
            const result = await api.getPhotos(this.projectId);
            if (result.success) {
                app.renderPhotos(result.data);
            }
        } catch (error) {
            console.error('Load photos error:', error);
        }
    },

    // 渲染设置视图
    renderSettings() {
        return `
            <div class="project-settings">
                <h3>${t('projectDetail.settings')}</h3>
                <div class="settings-section">
                    <button class="btn btn-secondary" onclick="projectMembers.showMembersModal(${this.projectId}, '${getI18nField(this.project, 'name')}')">
                        <span>👥</span> ${t('projects.membersManagement')}
                    </button>
                </div>
            </div>
        `;
    },

    // 返回仪表盘
    backToDashboard() {
        app.showView('dashboard');
    }
};

// 暴露到全局
window.ProjectDetail = ProjectDetail;
