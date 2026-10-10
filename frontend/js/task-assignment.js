// 任务分配模块
const taskAssignment = {
    currentProcessId: null,
    currentProcessCode: '',
    currentProcessName: '',
    currentProjectId: null,
    executors: [],
    currentAssignments: [],
    
    // 显示任务分配模态框
    async showAssignModal(processId, processCode, processName) {
        this.currentProcessId = processId;
        this.currentProcessCode = processCode;
        this.currentProcessName = processName;
        
        // 从当前选择的项目获取projectId
        const projectSelector = document.getElementById('processes-project-selector');
        this.currentProjectId = projectSelector ? projectSelector.value : null;
        
        if (!this.currentProjectId) {
            app.showError(i18n.t('tasks.selectProjectFirst'));
            return;
        }
        
        try {
            app.showLoading();
            
            // 并行加载项目的执行者和当前任务分配
            await Promise.all([
                this.loadProjectExecutors(),
                this.loadCurrentAssignments()
            ]);
            
            this.renderModal();
        } catch (error) {
            console.error('加载任务分配失败:', error);
            app.showError(i18n.t('tasks.loadError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 加载项目中的执行者
    async loadProjectExecutors() {
        try {
            // 获取项目成员
            const response = await api.get(`/projects/${this.currentProjectId}/members`);
            if (response.success) {
                // 只保留执行者角色的成员
                this.executors = response.data.filter(member => member.role === 'executor');
            } else {
                this.executors = [];
            }
        } catch (error) {
            console.error('加载执行者失败:', error);
            this.executors = [];
        }
    },
    
    // 加载当前任务分配
    async loadCurrentAssignments() {
        try {
            const response = await api.get(`/process-execution/${this.currentProcessId}/assignments`);
            if (response.success) {
                this.currentAssignments = response.data;
            } else {
                this.currentAssignments = [];
            }
        } catch (error) {
            console.error('加载任务分配失败:', error);
            this.currentAssignments = [];
        }
    },
    
    // 渲染模态框
    renderModal() {
        const currentAssignmentsList = this.renderCurrentAssignments();
        const availableExecutors = this.getAvailableExecutors();
        
        const modal = `
            <div class="modal" id="task-assignment-modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3>📋 ${i18n.t('tasks.assignTask')}</h3>
                        <button class="close-btn" onclick="taskAssignment.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="task-info-card">
                            <div class="task-info-item">
                                <span class="task-info-label">${i18n.t('tasks.processCode')}:</span>
                                <span class="task-info-value">${this.escapeHtml(this.currentProcessCode)}</span>
                            </div>
                            <div class="task-info-item">
                                <span class="task-info-label">${i18n.t('tasks.processName')}:</span>
                                <span class="task-info-value">${this.escapeHtml(this.currentProcessName)}</span>
                            </div>
                        </div>
                        
                        <div class="assignments-section">
                            <div class="section-header">
                                <h4>${i18n.t('tasks.currentAssignments')} (${this.currentAssignments.length})</h4>
                            </div>
                            <div class="assignments-list">
                                ${currentAssignmentsList}
                            </div>
                        </div>
                        
                        ${availableExecutors.length > 0 ? `
                            <div class="assignments-section">
                                <div class="section-header">
                                    <h4>${i18n.t('tasks.availableExecutors')}</h4>
                                </div>
                                <div class="available-executors-list">
                                    ${this.renderAvailableExecutors(availableExecutors)}
                                </div>
                            </div>
                        ` : this.executors.length === 0 ? `
                            <div class="assignments-section">
                                <p class="warning-message">${i18n.t('tasks.noExecutorsInProject')}</p>
                            </div>
                        ` : `
                            <div class="assignments-section">
                                <p class="info-message">${i18n.t('tasks.allExecutorsAssigned')}</p>
                            </div>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="taskAssignment.closeModal()">
                            ${i18n.t('common.close')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('modal-container').innerHTML = modal;
        document.getElementById('task-assignment-modal').style.display = 'flex';
    },
    
    // 渲染当前任务分配列表
    renderCurrentAssignments() {
        if (this.currentAssignments.length === 0) {
            return `<p class="empty-message">${i18n.t('tasks.noAssignments')}</p>`;
        }
        
        return this.currentAssignments.map(assignment => {
            const assignedDate = new Date(assignment.assigned_at).toLocaleDateString('zh-CN');
            const assignedTime = new Date(assignment.assigned_at).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
            
            return `
                <div class="assignment-item">
                    <div class="executor-info">
                        <div class="executor-avatar">👷</div>
                        <div class="executor-details">
                            <div class="executor-name">${this.escapeHtml(assignment.full_name || assignment.username)}</div>
                            <div class="executor-meta">
                                <span>${i18n.t('tasks.assignedBy')}: ${this.escapeHtml(assignment.assigned_by_name || '-')}</span>
                                <span>${assignedDate} ${assignedTime}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-small btn-danger" onclick="taskAssignment.unassignTask(${assignment.user_id})">
                        🗑️ ${i18n.t('tasks.unassign')}
                    </button>
                </div>
            `;
        }).join('');
    },
    
    // 渲染可分配的执行者列表
    renderAvailableExecutors(executors) {
        return executors.map(executor => {
            return `
                <div class="available-executor-item">
                    <div class="executor-info">
                        <div class="executor-avatar">👷</div>
                        <div class="executor-details">
                            <div class="executor-name">${this.escapeHtml(executor.full_name || executor.username)}</div>
                            <div class="executor-meta">
                                <span class="role-badge">${i18n.t('roles.executor')}</span>
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-small btn-primary" onclick="taskAssignment.assignTask(${executor.user_id})">
                        ➕ ${i18n.t('tasks.assign')}
                    </button>
                </div>
            `;
        }).join('');
    },
    
    // 获取可分配的执行者（未分配的执行者）
    getAvailableExecutors() {
        const assignedUserIds = this.currentAssignments.map(a => a.user_id);
        return this.executors.filter(executor => !assignedUserIds.includes(executor.user_id));
    },
    
    // 分配任务
    async assignTask(userId) {
        try {
            app.showLoading();
            
            const response = await api.post('/tasks/assign', {
                process_execution_id: this.currentProcessId,
                assigned_to: userId
            });
            
            if (response.success) {
                app.showSuccess(i18n.t('tasks.assignSuccess'));
                // 重新加载任务分配
                await this.loadCurrentAssignments();
                this.renderModal();
            } else {
                app.showError(response.message || i18n.t('tasks.assignError'));
            }
        } catch (error) {
            console.error('分配任务失败:', error);
            app.showError(i18n.t('tasks.assignError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 取消分配任务
    async unassignTask(userId) {
        if (!confirm(i18n.t('tasks.confirmUnassign'))) {
            return;
        }
        
        try {
            app.showLoading();
            
            const response = await api.delete(`/tasks/assign/${this.currentProcessId}/${userId}`);
            
            if (response.success) {
                app.showSuccess(i18n.t('tasks.unassignSuccess'));
                // 重新加载任务分配
                await this.loadCurrentAssignments();
                this.renderModal();
            } else {
                app.showError(response.message || i18n.t('tasks.unassignError'));
            }
        } catch (error) {
            console.error('取消分配任务失败:', error);
            app.showError(i18n.t('tasks.unassignError'));
        } finally {
            app.hideLoading();
        }
    },
    
    // 关闭模态框
    closeModal() {
        document.getElementById('modal-container').innerHTML = '';
        this.currentProcessId = null;
        this.currentProcessCode = '';
        this.currentProcessName = '';
        this.currentProjectId = null;
        this.executors = [];
        this.currentAssignments = [];
    },
    
    // HTML转义
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
