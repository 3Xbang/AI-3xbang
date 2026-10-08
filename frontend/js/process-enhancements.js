// 工序进度页面增强功能
// Process Progress Page Enhancements

if (typeof app !== 'undefined') {
    // 保存原始的renderProcesses函数
    app._originalRenderProcesses = app.renderProcesses;
    
    // 替换renderProcesses函数以使用新设计
    app.renderProcesses = function(processes) {
        const container = document.getElementById('processes-list');
        if (!processes || processes.length === 0) {
            container.innerHTML = `<p class="empty-state">暂无工序数据</p>`;
            return;
        }

        container.innerHTML = processes.map(process => {
            const statusClass = process.status || 'not_started';
            const statusText = t(`processes.status.${statusClass}`);
            const percentage = Math.round(process.completion_percentage || 0);
            const progressColor = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#3b82f6' : '#f59e0b';
            
            // 状态对应的操作按钮
            let actionButtons = '';
            if (statusClass === 'not_started') {
                actionButtons = `<button class="btn-start" onclick="app.startProcess(${process.id})">开始工序</button>`;
            } else if (statusClass === 'in_progress') {
                actionButtons = `
                    <button class="btn-pause" onclick="app.pauseProcess(${process.id})">暂停</button>
                    <button class="btn-complete" onclick="app.completeProcess(${process.id})">完成</button>
                `;
            } else if (statusClass === 'completed') {
                actionButtons = `<span style="color: #10b981; font-weight: 600;">✓ 已完成</span>`;
            }
            
            return `
                <div class="process-item status-${statusClass}" id="process-${process.id}">
                    <div class="process-header">
                        <span class="process-code">${process.process_code}</span>
                        <h4>${getI18nField(process, 'process_name')}</h4>
                        <span class="process-status">${statusText}</span>
                        <span class="progress-text" style="font-weight: 600; color: ${progressColor};">${percentage}%</span>
                    </div>
                    <div class="process-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%; background: ${progressColor}"></div>
                        </div>
                    </div>
                    <div class="process-actions">
                        ${actionButtons}
                        <button class="btn-toggle-subtasks" onclick="app.toggleSubtasksInline(${process.id})">
                            <span id="subtask-toggle-text-${process.id}">查看子任务 ▼</span>
                        </button>
                    </div>
                    <div class="process-subtasks-area" id="subtasks-area-${process.id}">
                        <div class="loading-subtasks">加载中...</div>
                    </div>
                </div>
            `;
        }).join('');
    };
    
    // 展开/收起子任务（内联显示）
    app.toggleSubtasksInline = async function(processExecutionId) {
        const area = document.getElementById(`subtasks-area-${processExecutionId}`);
        const toggleText = document.getElementById(`subtask-toggle-text-${processExecutionId}`);
        
        if (area.classList.contains('expanded')) {
            // 收起
            area.classList.remove('expanded');
            toggleText.textContent = '查看子任务 ▼';
        } else {
            // 展开并加载子任务
            area.classList.add('expanded');
            toggleText.textContent = '收起子任务 ▲';
            
            try {
                const result = await api.getSubtasks(processExecutionId);
                const subtasks = result.data || [];
                
                if (subtasks.length === 0) {
                    // 没有子任务，显示创建模板选项
                    area.innerHTML = `
                        <div style="text-align: center; padding: 1rem; color: #6b7280;">
                            <p>暂无子任务</p>
                            <button class="btn-start" onclick="app.showSubtaskTemplates(${processExecutionId})" style="margin-top: 0.5rem;">
                                从模板创建子任务
                            </button>
                        </div>
                    `;
                } else {
                    // 显示子任务列表
                    area.innerHTML = `
                        <h5 style="margin-bottom: 0.75rem; color: #374151;">📋 子任务列表</h5>
                        <div class="subtask-list-inline">
                            ${subtasks.map(subtask => this.renderSubtaskInline(subtask, processExecutionId)).join('')}
                        </div>
                        <button class="btn-toggle-subtasks" onclick="app.showSubtaskTemplates(${processExecutionId})" style="margin-top: 0.75rem;">
                            + 添加更多子任务
                        </button>
                    `;
                }
            } catch (error) {
                area.innerHTML = `<p style="color: #ef4444;">加载失败</p>`;
            }
        }
    };
    
    // 渲染内联子任务项
    app.renderSubtaskInline = function(subtask, processExecutionId) {
        const percentage = Math.round(subtask.completion_percentage || 0);
        const isCompleted = subtask.status === 'completed' || percentage >= 100;
        
        return `
            <div class="subtask-item-inline ${isCompleted ? 'completed' : ''}">
                <input type="checkbox" class="subtask-checkbox" ${isCompleted ? 'checked' : ''} disabled>
                <div class="subtask-info-inline">
                    <div class="subtask-name-inline">${getI18nField(subtask, 'subtask_name' || 'name')}</div>
                    <div class="subtask-progress-inline">
                        <span>${percentage}%</span>
                        <span>预计: ${subtask.planned_quantity || subtask.estimated_quantity || 0} ${getUnitText(subtask.quantity_unit || subtask.unit || '')}</span>
                        <span>已完成: ${subtask.actual_quantity || subtask.completed_quantity || 0} ${getUnitText(subtask.quantity_unit || subtask.unit || '')}</span>
                    </div>
                </div>
                <div class="subtask-actions-inline">
                    ${!isCompleted ? `
                        <button class="btn-xs btn-primary" onclick="app.recordSubtaskProgress(${subtask.id}, ${processExecutionId})">
                            记录进度
                        </button>
                    ` : `
                        <span style="color: #10b981; font-weight: 600;">✓</span>
                    `}
                </div>
            </div>
        `;
    };
    
    // 开始工序
    app.startProcess = async function(processExecutionId) {
        if (!confirm('确认开始此工序？')) return;
        
        try {
            this.showLoading();
            const result = await api.updateProcess(processExecutionId, {
                status: 'in_progress',
                actual_start_date: new Date().toISOString().split('T')[0]
            });
            
            if (result.success) {
                this.showToast('工序已开始');
                const projectId = document.getElementById('project-selector').value;
                if (projectId) this.loadProcesses(projectId);
            }
        } catch (error) {
            this.showToast('操作失败', 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 暂停工序
    app.pauseProcess = async function(processExecutionId) {
        const reason = prompt('请选择暂停原因:\n1. 等待材料\n2. 天气原因\n3. 其他\n\n输入数字:');
        
        let status = 'in_progress';
        if (reason === '1') status = 'waiting_material';
        else if (reason === '2') status = 'weather_stop';
        else if (!reason) return;
        
        try {
            this.showLoading();
            const result = await api.updateProcess(processExecutionId, { status });
            
            if (result.success) {
                this.showToast('状态已更新');
                const projectId = document.getElementById('project-selector').value;
                if (projectId) this.loadProcesses(projectId);
            }
        } catch (error) {
            this.showToast('操作失败', 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 完成工序
    app.completeProcess = async function(processExecutionId) {
        if (!confirm('确认此工序已全部完成？')) return;
        
        try {
            this.showLoading();
            const result = await api.updateProcess(processExecutionId, {
                status: 'completed',
                actual_end_date: new Date().toISOString().split('T')[0],
                completion_percentage: 100
            });
            
            if (result.success) {
                this.showToast('工序已完成！');
                const projectId = document.getElementById('project-selector').value;
                if (projectId) this.loadProcesses(projectId);
            }
        } catch (error) {
            this.showToast('操作失败', 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 记录子任务进度
    app.recordSubtaskProgress = function(subtaskId, processExecutionId) {
        // 调用已有的更新子任务表单
        this.showUpdateSubtaskForm(subtaskId, processExecutionId);
    };
}

console.log('✓ 工序进度页面增强功能已加载');
