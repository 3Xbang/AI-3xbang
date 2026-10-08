// 涓诲簲鐢ㄩ€昏緫
const app = {
    currentView: 'projects',
    currentProject: null,

    // 鍒濆鍖?    init() {
        // 妫€鏌ョ櫥褰曠姸鎬?        if (authToken) {
            this.showMainPage();
            this.loadUserInfo();
            this.showView('daily-tasks'); // 榛樿鏄剧ず浠婃棩浠诲姟
        } else {
            this.showLoginPage();
        }

        // 缁戝畾鐧诲綍琛ㄥ崟
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // 鏄剧ず浠婂ぉ鏃ユ湡
        const today = new Date();
        const dateStr = today.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        const dateEl = document.getElementById('today-date');
        if (dateEl) dateEl.textContent = dateStr;

        // 搴旂敤缈昏瘧
        updateTranslations();
    },

    // 鏄剧ず鐧诲綍椤?    showLoginPage() {
        document.getElementById('login-page').classList.add('active');
        document.getElementById('main-page').classList.remove('active');
    },

    // 鏄剧ず涓婚〉闈?    showMainPage() {
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('main-page').classList.add('active');
    },

    // 澶勭悊鐧诲綍
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

    // 鍔犺浇鐢ㄦ埛淇℃伅
    loadUserInfo() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        document.getElementById('user-name').textContent = user.username || '';
    },

    // 閫€鍑虹櫥褰?    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.reload();
    },

    // 鍒囨崲璇█
    setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('language', lang);
        updateTranslations(lang);
        // 閲嶆柊鍔犺浇褰撳墠瑙嗗浘鏁版嵁
        this.refreshCurrentView();
    },

    // 鏄剧ず瑙嗗浘
    showView(viewName) {
        // 闅愯棌鎵€鏈夎鍥?        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        // 鏄剧ず鐩爣瑙嗗浘
        document.getElementById(`${viewName}-view`).classList.add('active');
        this.currentView = viewName;

        // 鍔犺浇瑙嗗浘鏁版嵁
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
                this.loadProjectSelectors();
                break;
            case 'photos':
                this.loadProjectSelectors();
                break;
        }
    },

    // 鍒锋柊褰撳墠瑙嗗浘
    refreshCurrentView() {
        this.showView(this.currentView);
    },

    // 鍔犺浇椤圭洰鍒楄〃
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

    // 娓叉煋椤圭洰鍒楄〃
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

    // 鏄剧ず椤圭洰琛ㄥ崟
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

    // 澶勭悊鍒涘缓椤圭洰
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

    // 鍔犺浇椤圭洰閫夋嫨鍣?    async loadProjectSelectors() {
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

    // 鍔犺浇浠婃棩浠诲姟
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

    // 娓叉煋浠婃棩浠诲姟
    renderDailyTasks(tasks) {
        // 娓叉煋杩涜涓殑浠诲姟
        this.renderTaskSection('tasks-in-progress', tasks.in_progress);
        // 娓叉煋绛夊緟鏉愭枡鐨勪换鍔?        this.renderTaskSection('tasks-waiting-material', tasks.waiting_material);
        // 娓叉煋宸插畬鎴愮殑浠诲姟
        this.renderTaskSection('tasks-completed', tasks.completed);
    },

    // 娓叉煋浠诲姟鍖哄潡
    renderTaskSection(containerId, tasks) {
        const container = document.getElementById(containerId);
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `<p class="empty-hint">${t('common.noData') || '鏆傛棤鏁版嵁'}</p>`;
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
                        ${task.assigned_workers ? `<div>馃懛 ${JSON.parse(task.assigned_workers).length || 0} ${t('daily.workers')}</div>` : ''}
                        ${task.planned_quantity ? `<div>馃搳 ${t('daily.todayPlan')}: ${task.planned_quantity} ${unit}</div>` : ''}
                        ${task.today_completed ? `<div>鉁?${t('daily.todayCompleted')}: ${task.today_completed} ${unit}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn-sm btn-secondary" onclick="event.stopPropagation(); app.showSubtasks(${task.id})">${t('subtasks.view')}</button>
                        <button class="btn-sm btn-primary" onclick="event.stopPropagation(); app.showProgressForm(${task.id}, '${task.quantity_unit || ''}')">${t('daily.updateProgress')}</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 鏄剧ず杩涘害鏇存柊琛ㄥ崟
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

    // 鎻愪氦杩涘害鏇存柊
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
                // 閲嶆柊鍔犺浇浠婃棩浠诲姟
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

    // 鍔犺浇宸ュ簭
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

    // 娓叉煋宸ュ簭鍒楄〃
    renderProcesses(processes) {
        const container = document.getElementById('processes-list');
        if (!processes || processes.length === 0) {
            container.innerHTML = `<p class="empty-state">鏆傛棤宸ュ簭鏁版嵁</p>`;
            return;
        }

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
                        ${process.actual_start_date ? `<div><strong>寮€濮?</strong> ${process.actual_start_date}</div>` : ''}
                        ${process.actual_end_date ? `<div><strong>瀹屾垚:</strong> ${process.actual_end_date}</div>` : ''}
                    </div>
                    <div class="process-actions">
                        <button class="btn-sm btn-secondary" onclick="app.showSubtasks(${process.id})">${t('subtasks.view')}</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 鍒涘缓妯℃€佹
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

    // 鍏抽棴妯℃€佹
    closeModal() {
        document.getElementById('modal-container').innerHTML = '';
    },

    // 鏄剧ず鍔犺浇鐘舵€?    showLoading() {
        document.getElementById('loading').classList.add('active');
    },

    // 闅愯棌鍔犺浇鐘舵€?    hideLoading() {
        document.getElementById('loading').classList.remove('active');
    },

    // 鏄剧ず鎻愮ず娑堟伅
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

    // ===== 瀛愪换鍔″姛鑳?=====
    
    // 鏄剧ず瀛愪换鍔″垪琛?    async showSubtasks(processExecutionId) {
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

    // 娓叉煋瀛愪换鍔″垪琛?    renderSubtasksList(subtasks, processExecutionId) {
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
                        ${subtask.estimated_quantity ? `<span>馃搳 ${subtask.estimated_quantity} ${getUnitText(subtask.unit || '')}</span>` : ''}
                        ${subtask.actual_quantity ? `<span>鉁?${subtask.actual_quantity} ${getUnitText(subtask.unit || '')}</span>` : ''}
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

    // 鏄剧ず娣诲姞瀛愪换鍔¤〃鍗?    showAddSubtaskForm(processExecutionId) {
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

    // 澶勭悊娣诲姞瀛愪换鍔?    async handleAddSubtask() {
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
                // 閲嶆柊鏄剧ず瀛愪换鍔″垪琛?                await this.showSubtasks(processExecutionId);
            }
        } catch (error) {
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 鏄剧ず鏇存柊瀛愪换鍔¤〃鍗?    async showUpdateSubtaskForm(subtaskId, processExecutionId) {
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

    // 澶勭悊鏇存柊瀛愪换鍔?    async handleUpdateSubtask() {
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
                // 閲嶆柊鏄剧ず瀛愪换鍔″垪琛?                await this.showSubtasks(processExecutionId);
                // 閲嶆柊鍔犺浇浠婃棩浠诲姟浠ユ洿鏂拌繘搴?                const projectId = document.getElementById('daily-project-selector').value;
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

    // 瀹屾垚瀛愪换鍔?    async completeSubtask(subtaskId, processExecutionId) {
        if (!confirm(t('subtasks.confirmComplete'))) {
            return;
        }

        try {
            this.showLoading();
            const result = await api.completeSubtask(subtaskId);
            if (result.success) {
                this.showToast(t('common.success'));
                // 閲嶆柊鏄剧ず瀛愪换鍔″垪琛?                await this.showSubtasks(processExecutionId);
                // 閲嶆柊鍔犺浇浠婃棩浠诲姟
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

    // === 新增：子任务模板功能 ===
    // 显示子任务模板选择界面
    async showSubtaskTemplates(processExecutionId) {
        try {
            this.showLoading();
            const result = await api.getSubtaskTemplates(processExecutionId);
            
            if (!result.success || !result.data.templates || result.data.templates.length === 0) {
                this.showToast('该工序没有预定义子任务模板', 'error');
                this.showSubtasksList(processExecutionId, []);
                return;
            }
            
            const templates = result.data.templates;
            
            const modal = this.createModal('选择要创建的子任务', `
                <div class="subtasks-container">
                    <div class="template-hint">
                        <p style="background: #eff6ff; padding: 1rem; border-radius: 0.5rem; color: #1e40af; margin-bottom: 1rem;">
                            ✨ 请勾选需要的子任务，系统将自动创建
                        </p>
                    </div>
                    <div class="template-list" style="max-height: 400px; overflow-y: auto;">
                        ${templates.map((template, index) => `
                            <div class="template-item ${template.isCreated ? 'disabled' : ''}" style="margin-bottom: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; ${template.isCreated ? 'opacity: 0.6; background: #f9fafb;' : 'cursor: pointer;'}">
                                <label class="template-checkbox" style="display: flex; gap: 1rem; cursor: ${template.isCreated ? 'not-allowed' : 'pointer'};">
                                    <input type="checkbox" 
                                           class="template-check" 
                                           value="${index}"
                                           ${template.isCreated ? 'disabled checked' : ''}
                                           style="width: 20px; height: 20px; cursor: pointer;">
                                    <div class="template-content" style="flex: 1;">
                                        <h5 style="margin: 0 0 0.25rem 0; font-size: 1rem;">${getI18nField(template, 'name')}</h5>
                                        ${template.description ? `<p class="template-desc" style="color: #6b7280; font-size: 0.875rem; margin: 0.25rem 0;">${getI18nField(template, 'description')}</p>` : ''}
                                        <div class="template-info" style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">
                                            <span>📊 占比 ${template.typical_percentage}%</span>
                                            <span>📦 ${getUnitText(template.unit)}</span>
                                            ${template.isCreated ? '<span style="color: #10b981; font-weight: 600;">✓ 已创建</span>' : ''}
                                        </div>
                                    </div>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                    <div class="form-actions" style="margin-top: 1.5rem;">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">取消</button>
                        <button type="button" class="btn-primary" onclick="app.confirmSubtaskSelection(${processExecutionId})">创建选中的子任务</button>
                    </div>
                </div>
            `);
            this.hideLoading();
        } catch (error) {
            this.showToast('加载失败', 'error');
            this.hideLoading();
        }
    },

    // 确认选择并创建子任务
    async confirmSubtaskSelection(processExecutionId) {
        const checkboxes = document.querySelectorAll('.template-check:checked:not(:disabled)');
        const selectedIndexes = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (selectedIndexes.length === 0) {
            this.showToast('请至少选择一个子任务', 'error');
            return;
        }
        
        try {
            this.showLoading();
            const result = await api.batchCreateSubtasks(processExecutionId, selectedIndexes);
            
            if (result.success) {
                this.closeModal();
                this.showToast(result.message || '创建成功');
                // 重新加载子任务列表
                const subtasksResult = await api.getSubtasks(processExecutionId);
                this.showSubtasksList(processExecutionId, subtasksResult.data || []);
            }
        } catch (error) {
            this.showToast('创建失败', 'error');
        } finally {
            this.hideLoading();
        }
    },

    // 显示子任务列表（已有子任务时）
    showSubtasksList(processExecutionId, subtasks) {
        const modal = this.createModal('子任务管理', `
            <div class="subtasks-container">
                <div class="subtasks-header">
                    <button class="btn-sm btn-secondary" onclick="app.showSubtaskTemplates(${processExecutionId})">+ 添加更多</button>
                </div>
                <div id="subtasks-list" class="subtasks-list">
                    ${this.renderSubtasksList(subtasks, processExecutionId)}
                </div>
            </div>
        `);
    },
};

// 椤甸潰鍔犺浇瀹屾垚鍚庡垵濮嬪寲
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
