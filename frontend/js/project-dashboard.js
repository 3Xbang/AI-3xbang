
// 获取状态双语文本
function getStatusText(status) {
    const statusTexts = {
        'not_started': '未开始 Not Started',
        'in_progress': '进行中 In Progress',
        'waiting_material': '等待材料 Waiting for Materials',
        'weather_stop': '天气停工 Weather Stop',
        'completed': '已完成 Completed',
        'paused': '已暂停 Paused'
    };
    return statusTexts[status] || status;
}
// 项目仪表盘模块 - 登录后的首页
const ProjectDashboard = {
    projects: [],
    currentProjectId: null,
    currentTab: 'projects',
    _maintenanceTickets: [],

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

        const projectsContent = this.projects.length === 0
            ? this.renderEmptyState()
            : `
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
            </div>`;

        container.innerHTML = `
            <div style="display:flex;gap:8px;padding:16px 16px 0;border-bottom:2px solid #e2e8f0;margin-bottom:16px;">
                <button id="dash-tab-projects"
                        class="sb-btn${this.currentTab === 'projects' ? ' primary' : ''}"
                        style="min-height:44px;"
                        onclick="ProjectDashboard.switchTab('projects')">
                    🏗️ 建筑项目
                </button>
                <button id="dash-tab-maintenance"
                        class="sb-btn${this.currentTab === 'maintenance' ? ' primary' : ''}"
                        style="min-height:44px;"
                        onclick="ProjectDashboard.switchTab('maintenance')">
                    🛠️ 维修工单
                </button>
            </div>
            <div id="dash-panel-projects" style="${this.currentTab !== 'projects' ? 'display:none' : ''}">
                ${projectsContent}
            </div>
            <div id="dash-panel-maintenance" style="${this.currentTab !== 'maintenance' ? 'display:none' : ''}">
                <div style="padding:24px;text-align:center;color:#a0aec0;">点击标签加载 Click tab to load</div>
            </div>
        `;

        if (this.currentTab === 'maintenance') {
            this.loadMaintenancePanel();
        }
    },

    // 渲染项目卡片
    renderProjectCard(project) {
        const progress = Math.round(project.progress || 0);
        const progressColor = this.getProgressColor(progress);
        const statusClass = project.status || 'active';
        // Format date cleanly
        const startDate = project.start_date ? project.start_date.toString().substring(0, 10) : '-';

        const coverHtml = project.cover_photo
            ? `<div class="project-card-cover" style="background-image:url('${project.cover_photo}')">
                   ${PermissionManager.canManageProjects() ? `<label class="cover-upload-btn" title="更换封面" onclick="event.stopPropagation()">📷<input type="file" accept="image/*" style="display:none" onchange="ProjectDashboard.uploadCover(${project.id},this)"></label>` : ''}
               </div>`
            : (PermissionManager.canManageProjects()
                ? `<div class="project-card-cover project-card-cover--empty">
                       <label class="cover-upload-btn cover-upload-btn--add" title="添加封面照片" onclick="event.stopPropagation()">📷 添加封面照片<input type="file" accept="image/*" style="display:none" onchange="ProjectDashboard.uploadCover(${project.id},this)"></label>
                   </div>`
                : '');

        return `
            <div class="project-card">
                <div class="project-card-main" onclick="ProjectDashboard.enterProject(${project.id})">
                    ${coverHtml}
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
                            <span class="info-value">${startDate}</span>
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
        if (progress >= 80) return '#10b981';
        if (progress >= 50) return '#3b82f6';
        if (progress >= 20) return '#f59e0b';
        return '#ef4444';
    },

    // 上传封面照片
    async uploadCover(projectId, input) {
        const file = input.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('cover', file);
        try {
            if (typeof app !== 'undefined') app.showLoading();
            const r = await fetch(window.location.origin + '/api/projects/' + projectId + '/cover', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + localStorage.getItem('authToken') },
                body: fd
            });
            const j = await r.json();
            if (typeof app !== 'undefined') app.hideLoading();
            if (j.success) { await this.load(); }
            else alert(j.message || '上传失败');
        } catch (e) {
            if (typeof app !== 'undefined') app.hideLoading();
            alert(e.message);
        }
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
                        <input type="text" id="project-name-th" required placeholder="e.g. Mira Villa">
                    </div>
                    <div class="form-group">
                        <label>${t('projects.name')} (${t('common.chinese')})</label>
                        <input type="text" id="project-name-zh" placeholder="例如：Mira别墅">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('projects.location')} (${t('common.thai')}) *</label>
                        <input type="text" id="project-location-th" required placeholder="e.g. Chiang Mai">
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
                        ${"取消 Cancel"}
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
                        ${"取消 Cancel"}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        ${"保存 Save"}
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
                    ${"取消 Cancel"}
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
    },

    // 切换标签页
    switchTab(tab) {
        this.currentTab = tab;
        const panelP = document.getElementById('dash-panel-projects');
        const panelM = document.getElementById('dash-panel-maintenance');
        const btnP   = document.getElementById('dash-tab-projects');
        const btnM   = document.getElementById('dash-tab-maintenance');
        if (panelP) panelP.style.display = tab === 'projects' ? '' : 'none';
        if (panelM) panelM.style.display = tab === 'maintenance' ? '' : 'none';
        if (btnP) { btnP.classList.toggle('primary', tab === 'projects'); }
        if (btnM) { btnM.classList.toggle('primary', tab === 'maintenance'); }
        if (tab === 'maintenance') this.loadMaintenancePanel();
    },

    // 加载维修面板
    async loadMaintenancePanel() {
        const panel = document.getElementById('dash-panel-maintenance');
        if (!panel) return;
        panel.innerHTML = '<div style="padding:24px;text-align:center;color:#718096;">加载中… Loading…</div>';
        try {
            const res = await apiRequest('/api/maintenance');
            const tickets = (res && res.data) ? res.data : [];
            this._maintenanceTickets = tickets;
            this._renderMaintenancePanel(tickets);
        } catch (err) {
            panel.innerHTML = `<div style="padding:24px;text-align:center;color:#e53e3e;">加载失败 ${err.message}</div>`;
        }
    },

    // 渲染维修工单列表
    _renderMaintenancePanel(tickets) {
        const panel = document.getElementById('dash-panel-maintenance');
        if (!panel) return;
        const role       = PermissionManager.role();
        const isManager  = role === 'manager';
        const isSupervisor = role === 'supervisor';
        const isOwner    = PermissionManager.isOwner();

        let html = `<div style="padding:16px;max-width:600px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:16px;gap:8px;flex-wrap:wrap;">
        <h3 style="margin:0;font-size:1.1rem;color:#2d3748;">🛠️ 所有维修工单 All Maintenance</h3>
        ${(isManager || isSupervisor)
          ? '<button class="sb-btn primary" style="min-height:44px;" onclick="ProjectDashboard.showCreateTicketModal()">➕ 新建工单</button>'
          : ''}
        ${isOwner
          ? '<button class="sb-btn primary" style="min-height:44px;" onclick="ProjectDashboard.showCreateTicketModal()">📋 申报维修</button>'
          : ''}
      </div>`;

        if (!tickets.length) {
            html += `<div style="padding:40px;text-align:center;color:#a0aec0;
                             border:2px dashed #e2e8f0;border-radius:8px;">
          <div style="font-size:2rem;margin-bottom:8px;">🛠️</div>
          <div>暂无工单 No tickets</div></div>`;
        } else {
            tickets.forEach(t => {
                const esc = typeof Maintenance !== 'undefined' ? Maintenance.esc.bind(Maintenance) : (s => String(s||''));
                const badge = typeof Maintenance !== 'undefined' ? Maintenance._badgeHtml(t.status) : '';
                const catBadge = this._categoryBadgeHtml(t.category);

                // Owner compact status timeline
                let ownerTimeline = '';
                if (isOwner) {
                    const qs = t.quote_status || 'no_quote';
                    let active = 0;
                    if (['pending_quote','in-progress','completed'].includes(t.status) || ['quoted','approved'].includes(qs)) active = 1;
                    if (qs === 'approved' || ['in-progress','completed'].includes(t.status)) active = 2;
                    if (['in-progress','completed'].includes(t.status)) active = 3;
                    if (t.status === 'completed') active = 4;
                    const tlLabels = ['提交','报价中','等待确认','施工中','已完工'];
                    ownerTimeline = '<div style="display:flex;align-items:flex-start;padding:4px 12px 8px;background:#f7fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;margin-top:-2px;margin-bottom:6px;">' +
                        tlLabels.map(function(lbl, i, arr) {
                            const done = i <= active;
                            const dot  = '<div style="display:flex;flex-direction:column;align-items:center;"><div style="width:14px;height:14px;border-radius:50%;background:' + (done?'#38a169':'#e2e8f0') + ';border:2px solid ' + (done?'#276749':'#cbd5e0') + ';"></div><div style="font-size:0.55rem;color:' + (done?'#276749':'#a0aec0') + ';white-space:nowrap;margin-top:2px;">' + lbl + '</div></div>';
                            const conn = i < arr.length-1 ? '<div style="flex:1;height:2px;background:' + (i<active?'#38a169':'#e2e8f0') + ';margin-top:7px;margin-left:1px;margin-right:1px;flex-shrink:1;"></div>' : '';
                            return dot + conn;
                        }).join('') + '</div>';
                }

                html += `
        <div onclick="ProjectDashboard._openTicketDetail(${t.id})"
             style="background:#fff;border:1px solid #e2e8f0;border-radius:${isOwner?'10px 10px 0 0':'10px'};
                    padding:14px 16px;margin-bottom:${isOwner?'0':'12px'};cursor:pointer;
                    box-shadow:0 1px 3px rgba(0,0,0,.06);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            ${badge}
            <span style="font-weight:600;font-size:1rem;flex:1;">${esc(t.title)}</span>
            ${catBadge}
          </div>
          <div style="font-size:0.82rem;color:#718096;display:flex;gap:8px;flex-wrap:wrap;">
            <span>📁 ${esc(t.customer_name || t.project_name || '—')}</span>
            ${t.location ? `<span>📍 ${esc(t.location)}</span>` : ''}
            <span>👷 ${esc(t.assigned_name || '未指派')}</span>
            <span>🕐 ${t.updated_at ? new Date(t.updated_at).toLocaleDateString('zh-CN') : ''}</span>
            ${t.priority === 'urgent' ? '<span style="color:#e53e3e;font-weight:600;">⚡ 紧急</span>' : ''}
            ${t.quote_amount ? `<span style="color:#c05621;font-weight:600;">🏷️ ฿${Number(t.quote_amount).toLocaleString()}</span>` : ''}
          </div>
        </div>
        ${ownerTimeline}`;
            });
        }
        html += '</div>';
        panel.innerHTML = html;
    },

    // Category badge helper (mirrors Maintenance._categoryBadgeHtml — decoupled copy)
    _categoryBadgeHtml(category) {
        if (!category) return '';
        const esc = typeof Maintenance !== 'undefined' ? Maintenance.esc.bind(Maintenance) : (s => String(s||''));
        const colors = {'防水/漏水':'#3182ce','电气/照明':'#d69e2e','木工/门窗':'#744210','泳池/户外':'#2c7a7b','空调/通风':'#2b6cb0','瓷砖/地板':'#c05621','外墙/涂料':'#276749','其他':'#718096'};
        const bg = colors[category] || '#718096';
        return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;white-space:nowrap;">${esc(category)}</span>`;
    },

    // 打开工单详情
    _openTicketDetail(ticketId) {
        if (typeof Maintenance === 'undefined') return;
        const ticket = (this._maintenanceTickets || []).find(t => t.id === ticketId);
        if (!ticket) return;
        Maintenance.tickets   = this._maintenanceTickets;
        Maintenance.projectId = ticket.project_id;
        Maintenance.showTicketDetail(ticketId);
    },

    // 显示新建工单模态框
    async showCreateTicketModal() {
        const isOwner = PermissionManager.isOwner();
        const esc = typeof Maintenance !== 'undefined' ? Maintenance.esc.bind(Maintenance) : (s => String(s||''));
        let workerOptions = '';
        if (!isOwner) {
            try {
                const uRes = await apiRequest('/api/users/workers');
                workerOptions = (uRes.data || []).map(w =>
                    `<option value="${w.id}" data-name="${esc(w.full_name || w.username)}">${esc(w.full_name || w.username)}</option>`
                ).join('');
            } catch (_) {}
        }

        const mc = document.getElementById('modal-container');
        if (!mc) return;
        mc.innerHTML = `
    <div class="modal-overlay"
         onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''">
      <div class="modal-content" style="max-width:480px;width:95vw;padding:24px;">
        <h3 style="margin:0 0 16px;">${isOwner ? '📋 申报维修' : '➕ 新建工单'}</h3>
        <form id="maint-dash-create-form" onsubmit="ProjectDashboard._submitCreateTicket(event)">
          <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:4px;font-weight:600;">客户名称 Customer *</label>
            <input type="text" id="create-ticket-customer" placeholder="请输入客户姓名或地址"
                   style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;font-size:1rem;">
          </div>
          <div class="sb-field">
            <label>标题 Title *</label>
            <input id="mdc-title" class="sb-input" required maxlength="200" placeholder="请描述问题…">
          </div>
          <div class="sb-field">
            <label>描述 Description</label>
            <textarea id="mdc-desc" class="sb-input" rows="3" placeholder="详细说明…"></textarea>
          </div>
          <div class="sb-field">
            <label>位置 Location</label>
            <input id="mdc-location" class="sb-input" maxlength="200" placeholder="哪个房间/区域 e.g. 主卧卫生间, 客厅, 泳池">
          </div>
          <div class="sb-field">
            <label>类别 Category</label>
            <select id="mdc-category" class="sb-input">
              <option value="">— 请选择 —</option>
              <option value="防水/漏水">防水/漏水</option>
              <option value="电气/照明">电气/照明</option>
              <option value="木工/门窗">木工/门窗</option>
              <option value="泳池/户外">泳池/户外</option>
              <option value="空调/通风">空调/通风</option>
              <option value="瓷砖/地板">瓷砖/地板</option>
              <option value="外墙/涂料">外墙/涂料</option>
              <option value="其他">其他</option>
            </select>
          </div>
          ${!isOwner ? `
          <div class="sb-field">
            <label>指派工人 Assign Worker</label>
            <select id="mdc-worker" class="sb-input">
              <option value="">— 暂不指派 —</option>
              ${workerOptions}
            </select>
          </div>
          <div class="sb-field">
            <label>优先级 Priority</label>
            <select id="mdc-priority" class="sb-input">
              <option value="normal">普通 Normal</option>
              <option value="urgent">⚡ 紧急 Urgent</option>
            </select>
          </div>` : ''}
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
            <button type="button" class="sb-btn" style="min-height:44px;"
              onclick="document.getElementById('modal-container').innerHTML=''">取消 Cancel</button>
            <button type="submit" class="sb-btn primary" style="min-height:44px;">
              ${isOwner ? '提交 Submit' : '创建 Create'}
            </button>
          </div>
        </form>
      </div>
    </div>`;
    },

    // 提交新建工单
    async _submitCreateTicket(e) {
        e.preventDefault();
        const customer_name = document.getElementById('create-ticket-customer')?.value.trim();
        const title         = document.getElementById('mdc-title')?.value.trim();
        if (!customer_name || !title) {
            app.showToast('请填写标题和客户名称 Title and customer name required', 'error');
            return;
        }
        const workerSel     = document.getElementById('mdc-worker');
        const assigned_to   = workerSel?.value || null;
        const assigned_name = workerSel?.options[workerSel.selectedIndex]?.dataset.name || null;
        const priority      = document.getElementById('mdc-priority')?.value || 'normal';
        const description   = document.getElementById('mdc-desc')?.value || null;
        const location      = document.getElementById('mdc-location')?.value.trim() || null;
        const category      = document.getElementById('mdc-category')?.value || null;
        try {
            const res = await apiRequest('/api/maintenance', {
                method: 'POST',
                body: JSON.stringify({ title, description, customer_name, priority, assigned_to, assigned_name, location, category })
            });
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('工单已创建 Ticket created', 'success');
            await this.loadMaintenancePanel();
        } catch (err) {
            app.showToast('创建失败: ' + err.message, 'error');
        }
    }
};

// 暴露到全局
window.ProjectDashboard = ProjectDashboard;
