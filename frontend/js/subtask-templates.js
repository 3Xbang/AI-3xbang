// 子任务模板功能扩展

// 扩展api对象添加模板方法
if (typeof api !== 'undefined') {
    api.getSubtaskTemplates = (processExecutionId) => apiRequest(`/api/process-execution/${processExecutionId}/subtask-templates`);
    api.batchCreateSubtasks = (processExecutionId, selectedIndexes) => apiRequest(`/api/process-execution/${processExecutionId}/subtasks/batch`, {
        method: 'POST',
        body: JSON.stringify({ selectedSubtasks: selectedIndexes })
    });
}

// 扩展app对象添加模板功能
if (typeof app !== 'undefined') {
    // 替换原有的showSubtasks函数
    app._originalShowSubtasks = app.showSubtasks;
    
    app.showSubtasks = async function(processExecutionId) {
        try {
            this.showLoading();
            const result = await api.getSubtasks(processExecutionId);
            
            if (!result.success) {
                this.showToast('加载失败', 'error');
                return;
            }

            const subtasks = result.data || [];
            
            // 如果已有子任务，显示列表；否则显示模板选择
            if (subtasks.length > 0) {
                this.showSubtasksList(processExecutionId, subtasks);
            } else {
                await this.showSubtaskTemplates(processExecutionId);
            }
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            this.showToast('加载失败', 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 显示子任务模板选择界面
    app.showSubtaskTemplates = async function(processExecutionId) {
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
    };

    // 确认选择并创建子任务
    app.confirmSubtaskSelection = async function(processExecutionId) {
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
    };

    // 显示子任务列表（已有子任务时）
    app.showSubtasksList = function(processExecutionId, subtasks) {
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
    };
}

console.log('✓ 子任务模板功能已加载');