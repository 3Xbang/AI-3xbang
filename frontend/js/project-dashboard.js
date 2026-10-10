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
            <div class="project-card">
                <div class="project-card-main" onclick="ProjectDashboard.enterProject(${project.id})">
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
                ${PermissionManager.canManageProjects() ? `
                    <div class="project-card-actions">
                        <button class="btn-icon-only btn-edit" 
                                onclick="event.stopPropagation(); ProjectDashboard.showEditProjectModal(${project.id})" 
                                title="${t('projects.edit')}">
                            ✏️
                        </button>
                        <button class="btn-icon-only btn-delete" 
                                onclick="event.stopPropagation(); ProjectDashboard.confirmDeleteProject(${project.id})" 
                                title="${t('projects.delete')}">
                            🗑️
                        </button>
                    </div>
                ` : ''}
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
        this.createProjectStep = 1; // 步骤：1=基本信息, 2=选择工序
        this.createProjectData = {}; // 临时存储数据
        this.selectedTemplates = []; // 选中的工序模板ID
        
        this.showCreateProjectStep1();
    },

    // 第一步：基本信息
    showCreateProjectStep1() {
        const modal = app.createModal(t('projects.add'), `
            <div class="create-project-steps">
                <div class="step active">
                    <div class="step-number">1</div>
                    <div class="step-label">${t('projects.basicInfo')}</div>
                </div>
                <div class="step-connector"></div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div class="step-label">${t('projects.selectProcesses')}</div>
                </div>
            </div>
            <form id="create-project-form" class="form-vertical">
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.name')} (${t('common.thai')}) *</label>
                        <input type="text" id="project-name-th" required placeholder="เช่น: วิลล่ามิร่า">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.name')} (${t('common.chinese')})</label>
                        <input type="text" id="project-name-zh" placeholder="例如：Mira别墅">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.location')} (${t('common.thai')}) *</label>
                        <input type="text" id="project-location-th" required placeholder="เช่น: เชียงใหม่">
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
                        ${t('common.next')}
                    </button>
                </div>
            </form>
        `);

        document.getElementById('create-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 保存第一步的数据
            this.createProjectData = {
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
            
            // 进入第二步
            await this.showCreateProjectStep2();
        });
    },

    // 第二步：选择工序
    async showCreateProjectStep2() {
        try {
            app.showLoading();
            
            // 加载工序模板和分类
            const [templatesResult, categoriesResult] = await Promise.all([
                api.processTemplates.getAll(),
                api.processTemplates.getCategories()
            ]);
            
            if (!templatesResult.success || !categoriesResult.success) {
                throw new Error('加载工序模板失败');
            }
            
            const templates = templatesResult.data;
            const categories = categoriesResult.data;
            
            // 按分类组织工序
            const templatesByCategory = {};
            categories.forEach(cat => {
                templatesByCategory[cat.category_code] = {
                    ...cat,
                    templates: templates.filter(t => t.category === cat.category_code)
                };
            });
            
            app.hideLoading();
            
            const modal = app.createModal(t('projects.selectProcesses'), `
                <div class="create-project-steps">
                    <div class="step completed">
                        <div class="step-number">✓</div>
                        <div class="step-label">${t('projects.basicInfo')}</div>
                    </div>
                    <div class="step-connector"></div>
                    <div class="step active">
                        <div class="step-number">2</div>
                        <div class="step-label">${t('projects.selectProcesses')}</div>
                    </div>
                </div>
                
                <div class="process-selection-container">
                    <div class="process-selection-header">
                        <p class="help-text">${t('projects.selectProcessesHelp')}</p>
                        <div class="selection-actions">
                            <button type="button" class="btn btn-sm" onclick="ProjectDashboard.selectAllProcesses()">
                                ${t('projects.selectAll')}
                            </button>
                            <button type="button" class="btn btn-sm" onclick="ProjectDashboard.deselectAllProcesses()">
                                ${t('projects.deselectAll')}
                            </button>
                        </div>
                    </div>
                    
                    <div class="process-categories">
                        ${categories.map(cat => this.renderProcessCategory(cat, templatesByCategory[cat.category_code].templates)).join('')}
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="ProjectDashboard.showCreateProjectStep1()">
                        ${t('common.back')}
                    </button>
                    <button type="button" class="btn btn-primary" onclick="ProjectDashboard.handleCreateProject()">
                        ${t('common.create')} (<span id="selected-count">0</span> ${t('projects.processesSelected')})
                    </button>
                </div>
            `);
            
            // 恢复之前选中的工序
            this.selectedTemplates.forEach(id => {
                const checkbox = document.querySelector(`input[data-template-id="${id}"]`);
                if (checkbox) checkbox.checked = true;
            });
            
            this.updateSelectedCount();
            
        } catch (error) {
            app.hideLoading();
            console.error('Load process templates error:', error);
            app.showToast(t('projects.loadProcessError'), 'error');
        }
    },

    // 渲染工序分类
    renderProcessCategory(category, templates) {
        return `
            <div class="process-category">
                <div class="category-header" onclick="ProjectDashboard.toggleCategory('${category.category_code}')">
                    <div class="category-info">
                        <h4>${getI18nField(category, 'name')}</h4>
                        <span class="category-count">${templates.length} ${t('projects.processes')}</span>
                    </div>
                    <button type="button" class="btn-icon-only">▼</button>
                </div>
                <div class="category-processes" id="category-${category.category_code}">
                    ${templates.map(tmpl => this.renderProcessTemplate(tmpl)).join('')}
                </div>
            </div>
        `;
    },

    // 渲染工序模板
    renderProcessTemplate(template) {
        return `
            <label class="process-item">
                <input type="checkbox" 
                    data-template-id="${template.id}" 
                    onchange="ProjectDashboard.toggleTemplateSelection(${template.id})">
                <div class="process-info">
                    <div class="process-name">
                        <span class="process-code">${template.code}</span>
                        ${getI18nField(template, 'name')}
                    </div>
                    ${template.quality_points ? `
                        <div class="process-quality">${t('projects.qualityPoints')}: ${template.quality_points}</div>
                    ` : ''}
                </div>
            </label>
        `;
    },

    // 切换分类展开/折叠
    toggleCategory(category) {
        const categoryEl = document.getElementById(`category-${category}`);
        if (categoryEl) {
            categoryEl.classList.toggle('collapsed');
        }
    },

    // 切换工序选择
    toggleTemplateSelection(templateId) {
        const index = this.selectedTemplates.indexOf(templateId);
        if (index > -1) {
            this.selectedTemplates.splice(index, 1);
        } else {
            this.selectedTemplates.push(templateId);
        }
        this.updateSelectedCount();
    },

    // 全选工序
    selectAllProcesses() {
        const checkboxes = document.querySelectorAll('.process-item input[type="checkbox"]');
        this.selectedTemplates = [];
        checkboxes.forEach(cb => {
            cb.checked = true;
            this.selectedTemplates.push(parseInt(cb.dataset.templateId));
        });
        this.updateSelectedCount();
    },

    // 取消全选
    deselectAllProcesses() {
        const checkboxes = document.querySelectorAll('.process-item input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.selectedTemplates = [];
        this.updateSelectedCount();
    },

    // 更新选中计数
    updateSelectedCount() {
        const countEl = document.getElementById('selected-count');
        if (countEl) {
            countEl.textContent = this.selectedTemplates.length;
        }
    },

    // 处理创建项目
    async handleCreateProject() {
        try {
            app.showLoading();
            
            // 第一步：创建项目
            const result = await api.createProject(this.createProjectData);
            if (!result.success) {
                throw new Error(result.message || t('projects.createError'));
            }
            
            const projectId = result.data.id;
            
            // 第二步：如果选择了工序，批量添加
            if (this.selectedTemplates.length > 0) {
                const batchResult = await api.processTemplates.batchAdd(projectId, this.selectedTemplates);
                if (!batchResult.success) {
                    console.warn('添加工序失败:', batchResult.message);
                    // 不阻止项目创建，只显示警告
                    app.showToast(t('projects.createSuccessProcessWarning'), 'warning');
                }
            }
            
            app.closeModal();
            app.showToast(t('projects.createSuccess'));
            
            // 刷新项目列表
            await this.loadProjects();
            this.render();
            
            // 清理临时数据
            this.createProjectData = {};
            this.selectedTemplates = [];
            
        } catch (error) {
            console.error('Create project error:', error);
            app.showToast(error.message || t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 显示编辑项目模态框
    async showEditProjectModal(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) {
            app.showToast(t('common.error'), 'error');
            return;
        }

        const modal = app.createModal(t('projects.edit'), `
            <form id="edit-project-form" class="form-vertical">
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.name')} (${t('common.thai')}) *</label>
                        <input type="text" id="edit-project-name-th" required value="${project.name_th || ''}">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.name')} (${t('common.chinese')})</label>
                        <input type="text" id="edit-project-name-zh" value="${project.name_zh || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.location')} (${t('common.thai')}) *</label>
                        <input type="text" id="edit-project-location-th" required value="${project.location_th || ''}">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.location')} (${t('common.chinese')})</label>
                        <input type="text" id="edit-project-location-zh" value="${project.location_zh || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.client')}</label>
                        <input type="text" id="edit-project-client" value="${project.client_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.status')}</label>
                        <select id="edit-project-status">
                            <option value="active" ${project.status === 'active' ? 'selected' : ''}>${t('projects.status.active')}</option>
                            <option value="completed" ${project.status === 'completed' ? 'selected' : ''}>${t('projects.status.completed')}</option>
                            <option value="paused" ${project.status === 'paused' ? 'selected' : ''}>${t('projects.status.paused')}</option>
                            <option value="cancelled" ${project.status === 'cancelled' ? 'selected' : ''}>${t('projects.status.cancelled')}</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.startDate')}</label>
                        <input type="date" id="edit-project-start-date" value="${project.start_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.endDate')}</label>
                        <input type="date" id="edit-project-end-date" value="${project.planned_end_date || ''}">
                    </div>
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

        document.getElementById('edit-project-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleUpdateProject(projectId);
        });
    },

    // 处理更新项目
    async handleUpdateProject(projectId) {
        try {
            app.showLoading();
            
            const projectData = {
                name: {
                    th: document.getElementById('edit-project-name-th').value,
                    zh: document.getElementById('edit-project-name-zh').value || document.getElementById('edit-project-name-th').value
                },
                location: {
                    th: document.getElementById('edit-project-location-th').value,
                    zh: document.getElementById('edit-project-location-zh').value || document.getElementById('edit-project-location-th').value
                },
                client_name: document.getElementById('edit-project-client').value,
                status: document.getElementById('edit-project-status').value,
                start_date: document.getElementById('edit-project-start-date').value,
                planned_end_date: document.getElementById('edit-project-end-date').value
            };
            
            const result = await api.updateProject(projectId, projectData);
            
            if (!result.success) {
                throw new Error(result.message || t('projects.updateError'));
            }
            
            app.closeModal();
            app.showToast(t('projects.updateSuccess'));
            
            // 刷新项目列表
            await this.loadProjects();
            this.render();
            
        } catch (error) {
            console.error('Update project error:', error);
            app.showToast(error.message || t('projects.updateError'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 确认删除项目
    confirmDeleteProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) {
            app.showToast(t('common.error'), 'error');
            return;
        }

        const projectName = getI18nField(project, 'name');
        
        const modal = app.createModal(t('projects.delete'), `
            <div class="confirm-delete">
                <div class="warning-icon">⚠️</div>
                <h3>${t('projects.confirmDelete')}</h3>
                <p class="delete-warning-text">
                    ${t('projects.deleteWarning', { name: projectName })}
                </p>
                <ul class="delete-items-list">
                    <li>${t('projects.deleteItems.processes')}</li>
                    <li>${t('projects.deleteItems.materials')}</li>
                    <li>${t('projects.deleteItems.photos')}</li>
                    <li>${t('projects.deleteItems.progress')}</li>
                    <li>${t('projects.deleteItems.members')}</li>
                </ul>
                <p class="delete-final-warning">${t('projects.deleteFinalWarning')}</p>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                    ${t('common.cancel')}
                </button>
                <button type="button" class="btn btn-danger" onclick="ProjectDashboard.handleDeleteProject(${projectId})">
                    ${t('common.confirmDelete')}
                </button>
            </div>
        `);
    },

    // 处理删除项目
    async handleDeleteProject(projectId) {
        try {
            app.showLoading();
            
            const result = await api.deleteProject(projectId);
            
            if (!result.success) {
                throw new Error(result.message || t('projects.deleteError'));
            }
            
            app.closeModal();
            app.showToast(t('projects.deleteSuccess'));
            
            // 刷新项目列表
            await this.loadProjects();
            this.render();
            
        } catch (error) {
            console.error('Delete project error:', error);
            app.showToast(error.message || t('projects.deleteError'), 'error');
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
