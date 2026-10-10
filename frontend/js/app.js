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
            this.showView('daily-tasks'); // 默认显示今日任务
        } else {
            this.showLoginPage();
        }

        // 绑定登录表单
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 显示今天日期
        const today = new Date();
        const dateStr = today.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        const dateEl = document.getElementById('today-date');
        if (dateEl) dateEl.textContent = dateStr;

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
        document.getElementById('user-name').textContent = user.full_name || user.username || '';
        
        // 只有manager角色可以看到用户管理菜单
        const navUsers = document.getElementById('nav-users');
        if (navUsers) {
            navUsers.style.display = user.role === 'manager' ? 'block' : 'none';
        }
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
            case 'daily-tasks':
                this.loadProjectSelectors();
                break;
            case 'projects':
                this.loadProjects();
                break;
            case 'processes':
                this.loadProjectSelectors();
                break;
            case 'materials':
                // 初始化材料管理器
                if (this.currentProjectId) {
                    MaterialManager.init(this.currentProjectId);
                } else {
                    // 如果没有选择项目，显示提示
                    document.getElementById('materials-list').innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">📋</div>
                            <p>请先选择一个项目</p>
                        </div>
                    `;
                }
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

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isManager = user.role === 'manager';

        container.innerHTML = projects.map(project => `
            <div class="project-card">
                <div onclick="app.viewProjectDetail(${project.id})" style="cursor: pointer;">
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
                ${isManager ? `
                    <div class="project-actions">
                        <button class="btn btn-small" onclick="event.stopPropagation(); projectMembers.showMembersModal(${project.id}, '${project.name?.zh || project.name}')">
                            👥 ${t('projects.members')}
                        </button>
                    </div>
                ` : ''}
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
                const selectors = ['project-selector', 'material-project-selector', 'photo-project-selector', 'daily-project-selector'];
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

    // 加载今日任务
    async loadDailyTasks(projectId) {
        if (!projectId) return;
        
        try {
            this.showLoading();
            const result = await api.getDailyTasks(projectId);
            if (result.success) {
                this.renderDailyTasks(result.data);
            }
        } catch (error) {
            console.error('Failed to load daily tasks:', error);
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 渲染今日任务
    renderDailyTasks(tasks) {
        // 渲染进行中的任务
        this.renderTaskSection('tasks-in-progress', tasks.in_progress);
        // 渲染等待材料的任务
        this.renderTaskSection('tasks-waiting-material', tasks.waiting_material);
        // 渲染已完成的任务
        this.renderTaskSection('tasks-completed', tasks.completed);
    },

    // 渲染任务区块
    renderTaskSection(containerId, tasks) {
        const container = document.getElementById(containerId);
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `<p class="empty-hint">${t('common.noData') || '暂无数据'}</p>`;
            return;
        }

        container.innerHTML = tasks.map(task => {
            const percentage = Math.round(task.completion_percentage || 0);
            const progressColor = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#3b82f6' : '#f59e0b';
            const unit = getUnitText(task.quantity_unit || '');
            
            return `
                <div class="task-card" onclick="app.showTaskDetail(${task.id})">
                    <div class="task-header">
                        <span class="task-code">${task.process_code}</span>
                        <h4>${getI18nField(task, 'process_name')}</h4>
                    </div>
                    <div class="task-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%; background: ${progressColor}"></div>
                        </div>
                        <span class="progress-text">${percentage}%</span>
                    </div>
                    <div class="task-info">
                        ${task.assigned_workers ? `<div>👷 ${JSON.parse(task.assigned_workers).length || 0} ${t('daily.workers')}</div>` : ''}
                        ${task.planned_quantity ? `<div>📊 ${t('daily.todayPlan')}: ${task.planned_quantity} ${unit}</div>` : ''}
                        ${task.today_completed ? `<div>✅ ${t('daily.todayCompleted')}: ${task.today_completed} ${unit}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn-sm btn-secondary" onclick="event.stopPropagation(); app.showSubtasks(${task.id})">${t('subtasks.view')}</button>
                        <button class="btn-sm btn-primary" onclick="event.stopPropagation(); app.showProgressForm(${task.id}, '${task.quantity_unit || ''}')">${t('daily.updateProgress')}</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 显示进度更新表单
    showProgressForm(processExecutionId, unit) {
        const unitText = getUnitText(unit);
        
        const modal = this.createModal(t('daily.updateProgress'), `
            <form id="progress-form">
                <input type="hidden" id="process-execution-id" value="${processExecutionId}">
                <input type="hidden" id="quantity-unit" value="${unit}">
                <div class="form-group">
                    <label>${t('daily.quantityCompleted')} ${unitText ? '(' + unitText + ')' : ''}</label>
                    <input type="number" step="0.01" id="quantity-completed" required placeholder="0">
                </div>
                <div class="form-group">
                    <label>${t('daily.workStatus')}</label>
                    <select id="work-status">
                        <option value="normal">${t('daily.normal')}</option>
                        <option value="waiting_material">${t('daily.waitingMaterial')}</option>
                        <option value="weather_stop">${t('daily.weatherStop')}</option>
                        <option value="problem">${t('common.error')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${t('common.notes')}</label>
                    <textarea id="progress-notes" rows="3" placeholder="${t('common.notes')}..."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="app.closeModal()">${t('common.cancel')}</button>
                    <button type="submit" class="btn-primary">${t('common.save')}</button>
                </div>
            </form>
        `);

        document.getElementById('progress-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmitProgress();
        });
    },

    // 提交进度更新
    async handleSubmitProgress() {
        const data = {
            process_execution_id: parseInt(document.getElementById('process-execution-id').value),
            quantity_completed: parseFloat(document.getElementById('quantity-completed').value),
            unit: document.getElementById('quantity-unit').value,
            work_status: document.getElementById('work-status').value,
            notes: { [currentLang]: document.getElementById('progress-notes').value }
        };

        try {
            this.showLoading();
            const result = await api.submitDailyProgress(data);
            if (result.success) {
                this.closeModal();
                this.showToast(result.message || t('common.success'));
                // 重新加载今日任务
                const projectId = document.getElementById('daily-project-selector').value;
                if (projectId) {
                    this.loadDailyTasks(projectId);
                }
            }
        } catch (error) {
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
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

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const canAssignTask = user.role === 'manager' || user.role === 'purchaser';

        container.innerHTML = processes.map(process => {
            const statusClass = process.status || 'not_started';
            const statusText = t(`processes.status.${statusClass}`);
            const percentage = Math.round(process.completion_percentage || 0);
            const progressColor = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#3b82f6' : '#f59e0b';
            
            return `
                <div class="process-item status-${statusClass}">
                    <div class="process-header">
                        <span class="process-code">${process.process_code}</span>
                        <h4>${getI18nField(process, 'process_name')}</h4>
                        <span class="process-status">${statusText}</span>
                    </div>
                    <div class="process-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%; background: ${progressColor}"></div>
                        </div>
                        <span class="progress-text">${percentage}%</span>
                    </div>
                    <div class="process-details">
                        ${process.assigned_workers ? `<div><strong>${t('processes.workers')}:</strong> ${JSON.stringify(process.assigned_workers)}</div>` : ''}
                        ${process.actual_start_date ? `<div><strong>开始:</strong> ${process.actual_start_date}</div>` : ''}
                        ${process.actual_end_date ? `<div><strong>完成:</strong> ${process.actual_end_date}</div>` : ''}
                    </div>
                    <div class="process-actions">
                        <button class="btn-sm btn-secondary" onclick="app.showSubtasks(${process.id})">${t('subtasks.view')}</button>
                        ${canAssignTask ? `
                            <button class="btn-sm btn-primary" onclick="taskAssignment.showAssignModal(${process.id}, '${process.process_code}', '${getI18nField(process, 'process_name')}')">
                                📋 ${t('tasks.assign')}
                            </button>
                        ` : ''}
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
    },

    // ===== 子任务功能 =====
    
    // 显示子任务列表
    async showSubtasks(processExecutionId) {
        try {
            this.showLoading();
            const result = await api.getSubtasks(processExecutionId);
            
            if (!result.success) {
                this.showToast(t('common.error'), 'error');
                return;
            }

            const subtasks = result.data || [];
            const modal = this.createModal(t('subtasks.title'), `
                <div class="subtasks-container">
                    <div class="subtasks-header">
                        <button class="btn-sm btn-primary" onclick="app.showAddSubtaskForm(${processExecutionId})">
                            + ${t('subtasks.add')}
                        </button>
                    </div>
                    <div id="subtasks-list" class="subtasks-list">
                        ${this.renderSubtasksList(subtasks, processExecutionId)}
                    </div>
                </div>
            `);
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 渲染子任务列表
    renderSubtasksList(subtasks, processExecutionId) {
        if (!subtasks || subtasks.length === 0) {
            return `<p class="empty-hint">${t('subtasks.empty')}</p>`;
        }

        return subtasks.map(subtask => {
            const percentage = Math.round(subtask.completion_percentage || 0);
            const isCompleted = subtask.status === 'completed';
            const statusClass = isCompleted ? 'completed' : (percentage > 0 ? 'in-progress' : 'not-started');
            
            return `
                <div class="subtask-item ${statusClass}">
                    <div class="subtask-header">
                        <div class="subtask-info">
                            <h5>${getI18nField(subtask, 'name')}</h5>
                            ${subtask.description ? `<p class="subtask-desc">${getI18nField(subtask, 'description') || ''}</p>` : ''}
                        </div>
                        <span class="subtask-status">${percentage}%</span>
                    </div>
                    <div class="subtask-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%; background: ${isCompleted ? '#10b981' : '#3b82f6'}"></div>
                        </div>
                    </div>
                    <div class="subtask-footer">
                        ${subtask.estimated_quantity ? `<span>📊 ${subtask.estimated_quantity} ${getUnitText(subtask.unit || '')}</span>` : ''}
                        ${subtask.actual_quantity ? `<span>✅ ${subtask.actual_quantity} ${getUnitText(subtask.unit || '')}</span>` : ''}
                        <div class="subtask-actions">
                            <button class="btn-xs btn-primary" onclick="event.stopPropagation(); app.showUpdateSubtaskForm(${subtask.id}, ${processExecutionId})">
                                ${t('subtasks.update')}
                            </button>
                            ${!isCompleted ? `<button class="btn-xs btn-success" onclick="event.stopPropagation(); app.completeSubtask(${subtask.id}, ${processExecutionId})">${t('subtasks.complete')}</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 显示添加子任务表单
    showAddSubtaskForm(processExecutionId) {
        const modal = this.createModal(t('subtasks.add'), `
            <form id="add-subtask-form">
                <input type="hidden" id="subtask-process-id" value="${processExecutionId}">
                <div class="form-group">
                    <label>${t('subtasks.name')} (${t('common.chinese')})</label>
                    <input type="text" id="subtask-name-zh" required placeholder="${t('subtasks.namePlaceholder')}">
                </div>
                <div class="form-group">
                    <label>${t('subtasks.name')} (${t('common.thai')})</label>
                    <input type="text" id="subtask-name-th" required placeholder="${t('subtasks.namePlaceholder')}">
                </div>
                <div class="form-group">
                    <label>${t('subtasks.description')} (${t('common.chinese')})</label>
                    <textarea id="subtask-desc-zh" rows="2" placeholder="${t('subtasks.descPlaceholder')}"></textarea>
                </div>
                <div class="form-group">
                    <label>${t('subtasks.description')} (${t('common.thai')})</label>
                    <textarea id="subtask-desc-th" rows="2" placeholder="${t('subtasks.descPlaceholder')}"></textarea>
                </div>
                <div class="form-group">
                    <label>${t('subtasks.estimatedQuantity')}</label>
                    <input type="number" step="0.01" id="subtask-quantity" placeholder="0">
                </div>
                <div class="form-group">
                    <label>${t('subtasks.unit')}</label>
                    <select id="subtask-unit">
                        <option value="sqm">${t('units.sqm')}</option>
                        <option value="cbm">${t('units.cbm')}</option>
                        <option value="item">${t('units.item')}</option>
                        <option value="point">${t('units.point')}</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="app.closeModal()">${t('common.cancel')}</button>
                    <button type="submit" class="btn-primary">${t('common.save')}</button>
                </div>
            </form>
        `);

        document.getElementById('add-subtask-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddSubtask();
        });
    },

    // 处理添加子任务
    async handleAddSubtask() {
        const processExecutionId = parseInt(document.getElementById('subtask-process-id').value);
        const data = {
            process_execution_id: processExecutionId,
            name: {
                zh: document.getElementById('subtask-name-zh').value,
                th: document.getElementById('subtask-name-th').value
            },
            description: {
                zh: document.getElementById('subtask-desc-zh').value || null,
                th: document.getElementById('subtask-desc-th').value || null
            },
            estimated_quantity: parseFloat(document.getElementById('subtask-quantity').value) || null,
            unit: document.getElementById('subtask-unit').value || null
        };

        try {
            this.showLoading();
            const result = await api.createSubtask(data);
            if (result.success) {
                this.closeModal();
                this.showToast(t('common.success'));
                // 重新显示子任务列表
                await this.showSubtasks(processExecutionId);
            }
        } catch (error) {
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 显示更新子任务表单
    async showUpdateSubtaskForm(subtaskId, processExecutionId) {
        try {
            this.showLoading();
            const result = await api.getSubtasks(processExecutionId);
            const subtask = result.data.find(s => s.id === subtaskId);
            
            if (!subtask) {
                this.showToast(t('common.error'), 'error');
                return;
            }

            const modal = this.createModal(t('subtasks.update'), `
                <form id="update-subtask-form">
                    <input type="hidden" id="update-subtask-id" value="${subtaskId}">
                    <input type="hidden" id="update-process-id" value="${processExecutionId}">
                    <div class="form-group">
                        <label>${t('subtasks.actualQuantity')} ${getUnitText(subtask.unit || '')}</label>
                        <input type="number" step="0.01" id="update-actual-quantity" 
                               value="${subtask.actual_quantity || 0}" required>
                    </div>
                    <div class="form-group">
                        <label>${t('common.notes')}</label>
                        <textarea id="update-subtask-notes" rows="3" placeholder="${t('common.notes')}...">${getI18nField(subtask, 'notes') || ''}</textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">${t('common.cancel')}</button>
                        <button type="submit" class="btn-primary">${t('common.save')}</button>
                    </div>
                </form>
            `);

            document.getElementById('update-subtask-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleUpdateSubtask();
            });
        } catch (error) {
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 处理更新子任务
    async handleUpdateSubtask() {
        const subtaskId = parseInt(document.getElementById('update-subtask-id').value);
        const processExecutionId = parseInt(document.getElementById('update-process-id').value);
        const data = {
            actual_quantity: parseFloat(document.getElementById('update-actual-quantity').value),
            notes: {
                [currentLang]: document.getElementById('update-subtask-notes').value || null
            }
        };

        try {
            this.showLoading();
            const result = await api.updateSubtask(subtaskId, data);
            if (result.success) {
                this.closeModal();
                this.showToast(t('common.success'));
                // 重新显示子任务列表
                await this.showSubtasks(processExecutionId);
                // 重新加载今日任务以更新进度
                const projectId = document.getElementById('daily-project-selector').value;
                if (projectId) {
                    this.loadDailyTasks(projectId);
                }
            }
        } catch (error) {
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 完成子任务
    async completeSubtask(subtaskId, processExecutionId) {
        if (!confirm(t('subtasks.confirmComplete'))) {
            return;
        }

        try {
            this.showLoading();
            const result = await api.completeSubtask(subtaskId);
            if (result.success) {
                this.showToast(t('common.success'));
                // 重新显示子任务列表
                await this.showSubtasks(processExecutionId);
                // 重新加载今日任务
                const projectId = document.getElementById('daily-project-selector').value;
                if (projectId) {
                    this.loadDailyTasks(projectId);
                }
            }
        } catch (error) {
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
