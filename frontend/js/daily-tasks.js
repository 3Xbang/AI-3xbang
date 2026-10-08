// 今日任务和每日进度管理
const dailyTasksManager = {
    currentProjectId: null,
    
    // 初始化
    init(projectId) {
        this.currentProjectId = projectId;
        this.loadTasks();
    },
    
    // 加载今日任务
    async loadTasks() {
        if (!this.currentProjectId) {
            console.warn('No project selected');
            return;
        }
        
        try {
            app.showLoading();
            const result = await api.getDailyTasks(this.currentProjectId);
            
            if (result.success) {
                this.renderTasks(result.data);
            }
        } catch (error) {
            console.error('Failed to load daily tasks:', error);
            app.showToast('加载失败', 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 渲染任务列表
    renderTasks(data) {
        // 渲染进行中
        this.renderSection('tasks-in-progress', data.in_progress || [], 'in_progress');
        // 渲染等待材料
        this.renderSection('tasks-waiting-material', data.waiting_material || [], 'waiting_material');
        // 渲染天气停工
        this.renderSection('tasks-weather-stop', data.weather_stop || [], 'weather_stop');
        // 渲染今日完成
        this.renderSection('tasks-completed', data.completed || [], 'completed');
        // 渲染未开始
        this.renderSection('tasks-not-started', data.not_started || [], 'not_started');
    },
    
    // 渲染单个区块
    renderSection(containerId, tasks, status) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-hint">暂无数据</p>';
            return;
        }
        
        container.innerHTML = tasks.map(task => this.renderTaskCard(task, status)).join('');
    },
    
    // 渲染任务卡片
    renderTaskCard(task, status) {
        const processName = typeof task.process_name === 'string' 
            ? (JSON.parse(task.process_name)[currentLang] || task.process_code)
            : (task.process_name[currentLang] || task.process_code);
            
        const percentage = Math.round(task.completion_percentage || 0);
        const total = task.total_completed || 0;
        const planned = task.planned_quantity || 0;
        const unit = this.getUnitText(task.quantity_unit);
        
        // 状态图标
        const statusIcons = {
            'not_started': '🔴',
            'in_progress': '🔵',
            'waiting_material': '🟡',
            'weather_stop': '⚪',
            'completed': '🟢'
        };
        
        const statusIcon = statusIcons[status] || '⚪';
        
        // 进度条颜色
        const progressColor = percentage >= 80 ? '#10b981' : 
                            percentage >= 50 ? '#3b82f6' : '#f59e0b';
        
        return `
            <div class="task-card" data-task-id="${task.id}" data-status="${status}">
                <div class="task-header">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="task-code">${task.process_code}</span>
                    <h4 class="task-name">${processName}</h4>
                </div>
                
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%; background: ${progressColor}"></div>
                    </div>
                    <div class="progress-info">
                        <span class="progress-percentage">${percentage}%</span>
                        <span class="progress-quantity">${total} / ${planned} ${unit}</span>
                    </div>
                </div>
                
                ${task.today_completed ? `
                    <div class="today-progress">
                        <small>今日完成: ${task.today_completed} ${unit}</small>
                    </div>
                ` : ''}
                
                <div class="task-actions">
                    ${this.renderActions(task, status)}
                </div>
            </div>
        `;
    },
    
    // 渲染操作按钮
    renderActions(task, status) {
        const actions = [];
        
        // 根据状态显示不同操作
        switch(status) {
            case 'not_started':
                actions.push(`
                    <button class="btn-action btn-primary" onclick="dailyTasksManager.startProcess(${task.id})">
                        🚀 开始
                    </button>
                `);
                break;
                
            case 'in_progress':
                actions.push(`
                    <button class="btn-action btn-success" onclick="dailyTasksManager.showProgressForm(${task.id})">
                        ✅ 记录进度
                    </button>
                    <button class="btn-action btn-warning" onclick="dailyTasksManager.markWaitingMaterial(${task.id})">
                        🟡 缺材料
                    </button>
                `);
                break;
                
            case 'waiting_material':
                actions.push(`
                    <button class="btn-action btn-primary" onclick="dailyTasksManager.resumeProcess(${task.id})">
                        ▶️ 恢复
                    </button>
                    <button class="btn-action btn-success" onclick="dailyTasksManager.showProgressForm(${task.id})">
                        ✅ 记录进度
                    </button>
                `);
                break;
                
            case 'weather_stop':
                actions.push(`
                    <button class="btn-action btn-primary" onclick="dailyTasksManager.resumeProcess(${task.id})">
                        ▶️ 恢复
                    </button>
                `);
                break;
                
            case 'completed':
                actions.push(`
                    <button class="btn-action btn-info" onclick="dailyTasksManager.viewHistory(${task.id})">
                        📊 查看历史
                    </button>
                `);
                break;
        }
        
        return actions.join('');
    },
    
    // 开始工序
    async startProcess(processId) {
        if (!confirm('确认开始这个工序吗？')) return;
        
        try {
            app.showLoading();
            const result = await api.updateProcess(processId, {
                status: 'in_progress',
                actual_start_date: new Date().toISOString().split('T')[0]
            });
            
            if (result.success) {
                app.showToast('工序已开始', 'success');
                this.loadTasks();
            }
        } catch (error) {
            app.showToast('操作失败', 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 标记缺材料
    async markWaitingMaterial(processId) {
        const notes = prompt('请输入缺少的材料：');
        if (!notes) return;
        
        try {
            app.showLoading();
            const result = await api.updateProcess(processId, {
                status: 'waiting_material',
                notes: { zh: notes, th: notes }
            });
            
            if (result.success) {
                app.showToast('已标记为等待材料', 'warning');
                this.loadTasks();
            }
        } catch (error) {
            app.showToast('操作失败', 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 恢复工序
    async resumeProcess(processId) {
        if (!confirm('确认恢复这个工序吗？')) return;
        
        try {
            app.showLoading();
            const result = await api.updateProcess(processId, {
                status: 'in_progress'
            });
            
            if (result.success) {
                app.showToast('工序已恢复', 'success');
                this.loadTasks();
            }
        } catch (error) {
            app.showToast('操作失败', 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 显示进度录入表单
    showProgressForm(processId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>记录今日进度</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <form id="progress-form" class="modal-body">
                    <div class="form-group">
                        <label>今日完成数量 *</label>
                        <input type="number" id="quantity-completed" step="0.01" required>
                    </div>
                    
                    <div class="form-group">
                        <label>工作状态</label>
                        <select id="work-status">
                            <option value="normal">正常施工</option>
                            <option value="waiting_material">等待材料</option>
                            <option value="weather_stop">天气停工</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>备注</label>
                        <textarea id="progress-notes" rows="3"></textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
                        <button type="submit" class="btn-primary">提交</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定表单提交
        document.getElementById('progress-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitProgress(processId, modal);
        });
    },
    
    // 提交进度
    async submitProgress(processId, modal) {
        const quantity = parseFloat(document.getElementById('quantity-completed').value);
        const workStatus = document.getElementById('work-status').value;
        const notes = document.getElementById('progress-notes').value;
        
        if (!quantity || quantity <= 0) {
            alert('请输入有效的完成数量');
            return;
        }
        
        try {
            app.showLoading();
            const result = await api.submitDailyProgress({
                process_execution_id: processId,
                quantity_completed: quantity,
                work_status: workStatus,
                notes: notes ? { zh: notes, th: notes } : null
            });
            
            if (result.success) {
                app.showToast('进度已记录', 'success');
                modal.remove();
                this.loadTasks();
            }
        } catch (error) {
            app.showToast('提交失败: ' + (error.message || '未知错误'), 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 查看历史
    async viewHistory(processId) {
        try {
            app.showLoading();
            const result = await api.getProgressHistory(processId);
            
            if (result.success && result.data) {
                this.showHistoryModal(result.data);
            }
        } catch (error) {
            app.showToast('加载失败', 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 显示历史记录
    showHistoryModal(history) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>进度历史</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>完成量</th>
                                <th>累计</th>
                                <th>百分比</th>
                                <th>状态</th>
                                <th>备注</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${history.map(record => `
                                <tr>
                                    <td>${record.date}</td>
                                    <td>${record.quantity_completed} ${record.unit || ''}</td>
                                    <td>${record.total_completed}</td>
                                    <td>${Math.round(record.completion_percentage)}%</td>
                                    <td>${this.getStatusText(record.work_status)}</td>
                                    <td>${record.notes ? (JSON.parse(record.notes)[currentLang] || '-') : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    // 获取单位文本
    getUnitText(unit) {
        const units = {
            'cubic_meter': 'm³',
            'square_meter': 'm²',
            'meter': 'm',
            'piece': '件',
            'point': '点',
            'ton': '吨'
        };
        return units[unit] || unit || '';
    },
    
    // 获取状态文本
    getStatusText(status) {
        const statusTexts = {
            'normal': '正常',
            'waiting_material': '等待材料',
            'weather_stop': '天气停工',
            'problem': '其他问题'
        };
        return statusTexts[status] || status || '-';
    }
};

// 导出到全局
window.dailyTasksManager = dailyTasksManager;
