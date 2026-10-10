// 工序进度规划模块 - Phase 3B
// Process Scheduling Module

const ProcessScheduling = {
    projectId: null,
    processes: [],
    dependencies: [],

    // 初始化
    init(projectId) {
        this.projectId = projectId;
    },

    // 显示依赖关系管理模态框
    async showDependencyManager(processExecutionId, processName) {
        try {
            app.showLoading();
            
            // 加载工序列表和当前依赖关系
            const [processesResult, depsResult] = await Promise.all([
                api.processes.getList(this.projectId),
                api.processDependencies.get(processExecutionId)
            ]);
            
            if (!processesResult.success) {
                throw new Error('加载工序列表失败');
            }
            
            this.processes = processesResult.data;
            const currentDeps = depsResult.success ? depsResult.data : { predecessors: [], successors: [] };
            
            app.hideLoading();
            
            const modal = app.createModal(t('scheduling.manageDependencies'), `
                <div class="dependency-manager">
                    <div class="current-process-info">
                        <h4>${processName}</h4>
                        <p class="help-text">${t('scheduling.dependencyHelp')}</p>
                    </div>
                    
                    <div class="dependency-section">
                        <h5>${t('scheduling.predecessors')}</h5>
                        <p class="section-desc">${t('scheduling.predecessorsDesc')}</p>
                        
                        ${currentDeps.predecessors.length > 0 ? `
                            <div class="dependency-list">
                                ${currentDeps.predecessors.map(dep => this.renderDependencyItem(dep, 'predecessor')).join('')}
                            </div>
                        ` : `
                            <p class="empty-text">${t('scheduling.noPredecessors')}</p>
                        `}
                        
                        <button class="btn btn-sm btn-secondary" onclick="ProcessScheduling.showAddPredecessor(${processExecutionId})">
                            + ${t('scheduling.addPredecessor')}
                        </button>
                    </div>
                    
                    <div class="dependency-section">
                        <h5>${t('scheduling.successors')}</h5>
                        <p class="section-desc">${t('scheduling.successorsDesc')}</p>
                        
                        ${currentDeps.successors.length > 0 ? `
                            <div class="dependency-list">
                                ${currentDeps.successors.map(dep => this.renderDependencyItem(dep, 'successor')).join('')}
                            </div>
                        ` : `
                            <p class="empty-text">${t('scheduling.noSuccessors')}</p>
                        `}
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                        ${t('common.close')}
                    </button>
                </div>
            `);
            
        } catch (error) {
            app.hideLoading();
            console.error('Show dependency manager error:', error);
            app.showToast(t('common.error'), 'error');
        }
    },

    // 渲染依赖项
    renderDependencyItem(dep, type) {
        const processCode = type === 'predecessor' ? dep.depends_on_code : dep.successor_code;
        const processName = type === 'predecessor' ? dep.depends_on_name : dep.successor_name;
        const depType = dep.dependency_type || 'finish_to_start';
        const lagDays = dep.lag_days || 0;
        
        const typeText = this.getDependencyTypeText(depType);
        const lagText = lagDays > 0 ? `+${lagDays}${t('scheduling.days')}` : 
                        lagDays < 0 ? `${lagDays}${t('scheduling.days')}` : '';
        
        return `
            <div class="dependency-item">
                <div class="dependency-info">
                    <span class="process-code-small">${processCode}</span>
                    <span class="process-name-small">${getI18nField({ process_name: processName }, 'process_name')}</span>
                    <span class="dependency-type-badge">${typeText}</span>
                    ${lagText ? `<span class="lag-badge">${lagText}</span>` : ''}
                </div>
                ${type === 'predecessor' ? `
                    <button class="btn-icon-delete" onclick="ProcessScheduling.deleteDependency(${dep.id})">
                        ✕
                    </button>
                ` : ''}
            </div>
        `;
    },

    // 获取依赖类型文本
    getDependencyTypeText(type) {
        const types = {
            'finish_to_start': 'FS',
            'start_to_start': 'SS',
            'finish_to_finish': 'FF',
            'start_to_finish': 'SF'
        };
        return types[type] || type;
    },

    // 显示添加前置依赖
    async showAddPredecessor(processExecutionId) {
        const availableProcesses = this.processes.filter(p => p.id !== processExecutionId);
        
        if (availableProcesses.length === 0) {
            app.showToast(t('scheduling.noAvailableProcesses'), 'warning');
            return;
        }
        
        const modal = app.createModal(t('scheduling.addPredecessor'), `
            <form id="add-dependency-form" class="form-vertical">
                <div class="form-group">
                    <label>${t('scheduling.selectPredecessor')} *</label>
                    <select id="predecessor-select" required>
                        <option value="">${t('scheduling.pleaseSelect')}</option>
                        ${availableProcesses.map(p => `
                            <option value="${p.id}">
                                [${p.process_code}] ${getI18nField(p, 'process_name')}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>${t('scheduling.dependencyType')} *</label>
                    <select id="dependency-type" required>
                        <option value="finish_to_start">FS - ${t('scheduling.finishToStart')}</option>
                        <option value="start_to_start">SS - ${t('scheduling.startToStart')}</option>
                        <option value="finish_to_finish">FF - ${t('scheduling.finishToFinish')}</option>
                        <option value="start_to_finish">SF - ${t('scheduling.startToFinish')}</option>
                    </select>
                    <small class="form-hint">${t('scheduling.fsIsCommon')}</small>
                </div>
                
                <div class="form-group">
                    <label>${t('scheduling.lagDays')}</label>
                    <input type="number" id="lag-days" value="0" min="-30" max="90">
                    <small class="form-hint">${t('scheduling.lagDaysHint')}</small>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="ProcessScheduling.showDependencyManager(${processExecutionId}, '')">
                        ${t('common.back')}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        ${t('common.add')}
                    </button>
                </div>
            </form>
        `);
        
        document.getElementById('add-dependency-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddDependency(processExecutionId);
        });
    },

    // 处理添加依赖
    async handleAddDependency(processExecutionId) {
        const dependsOnProcessId = document.getElementById('predecessor-select').value;
        const dependencyType = document.getElementById('dependency-type').value;
        const lagDays = parseInt(document.getElementById('lag-days').value);
        
        if (!dependsOnProcessId) {
            app.showToast(t('scheduling.pleaseSelect'), 'warning');
            return;
        }
        
        try {
            app.showLoading();
            const result = await api.processDependencies.add(processExecutionId, {
                dependsOnProcessId: parseInt(dependsOnProcessId),
                dependencyType,
                lagDays
            });
            
            if (result.success) {
                app.showToast(t('scheduling.dependencyAdded'));
                // 重新加载依赖管理器
                const process = this.processes.find(p => p.id === processExecutionId);
                await this.showDependencyManager(processExecutionId, getI18nField(process, 'process_name'));
            } else {
                app.showToast(result.message || t('scheduling.addError'), 'error');
            }
        } catch (error) {
            console.error('Add dependency error:', error);
            app.showToast(error.message || t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 删除依赖关系
    async deleteDependency(dependencyId) {
        if (!confirm(t('scheduling.confirmDeleteDependency'))) {
            return;
        }
        
        try {
            app.showLoading();
            const result = await api.processDependencies.delete(dependencyId);
            
            if (result.success) {
                app.showToast(t('scheduling.dependencyDeleted'));
                // 刷新当前模态框
                location.reload(); // 简单刷新，后续可优化
            } else {
                app.showToast(result.message || t('scheduling.deleteError'), 'error');
            }
        } catch (error) {
            console.error('Delete dependency error:', error);
            app.showToast(t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 显示工序时间规划
    async showProcessSchedule(processExecutionId, processName) {
        const process = this.processes.find(p => p.id === processExecutionId);
        
        const modal = app.createModal(t('scheduling.scheduleProcess'), `
            <form id="schedule-form" class="form-vertical">
                <div class="form-group">
                    <h4>${processName}</h4>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('scheduling.plannedStartDate')}</label>
                        <input type="date" id="planned-start" value="${process.planned_start_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>${t('scheduling.plannedEndDate')}</label>
                        <input type="date" id="planned-end" value="${process.planned_end_date || ''}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>${t('scheduling.plannedDuration')} (${t('scheduling.days')})</label>
                    <input type="number" id="planned-duration" min="1" max="365" 
                           value="${process.planned_duration || ''}" 
                           placeholder="${t('scheduling.autocalculate')}">
                    <small class="form-hint">${t('scheduling.durationHint')}</small>
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
        
        document.getElementById('schedule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleUpdateSchedule(processExecutionId);
        });
    },

    // 处理更新进度计划
    async handleUpdateSchedule(processExecutionId) {
        const plannedStartDate = document.getElementById('planned-start').value;
        const plannedEndDate = document.getElementById('planned-end').value;
        const plannedDuration = document.getElementById('planned-duration').value;
        
        try {
            app.showLoading();
            const result = await api.processSchedule.update(processExecutionId, {
                plannedStartDate: plannedStartDate || null,
                plannedEndDate: plannedEndDate || null,
                plannedDuration: plannedDuration ? parseInt(plannedDuration) : null
            });
            
            if (result.success) {
                app.closeModal();
                app.showToast(t('scheduling.scheduleUpdated'));
                // 刷新工序列表
                await ProjectDetail.loadProcesses();
            } else {
                app.showToast(result.message || t('scheduling.updateError'), 'error');
            }
        } catch (error) {
            console.error('Update schedule error:', error);
            app.showToast(t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    }
};

// 暴露到全局
window.ProcessScheduling = ProcessScheduling;

console.log('✓ 工序进度规划模块已加载');
