// 工序管理模块 - Phase 3A
// Process Manager Module

const ProcessManager = {
    projectId: null,
    selectedTemplates: [],

    // 初始化
    init(projectId) {
        this.projectId = projectId;
    },

    // 显示添加工序模态框
    async showAddProcessModal() {
        const modal = app.createModal(t('processes.addProcess'), `
            <div class="add-process-options">
                <div class="option-card" onclick="ProcessManager.showTemplateSelection()">
                    <div class="option-icon">📚</div>
                    <h4>${t('processes.fromTemplate')}</h4>
                    <p>${t('processes.fromTemplateDesc')}</p>
                </div>
                <div class="option-card" onclick="ProcessManager.showCustomProcessForm()">
                    <div class="option-icon">✏️</div>
                    <h4>${t('processes.customProcess')}</h4>
                    <p>${t('processes.customProcessDesc')}</p>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                    ${t('common.cancel')}
                </button>
            </div>
        `);
    },

    // 显示模板选择
    async showTemplateSelection() {
        try {
            app.showLoading();
            
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
                templatesByCategory[cat.category] = {
                    ...cat,
                    templates: templates.filter(t => t.category === cat.category)
                };
            });
            
            // 获取当前项目已有的工序代码
            const processesResult = await api.processes.getList(this.projectId);
            const existingCodes = processesResult.success 
                ? processesResult.data.map(p => p.process_code) 
                : [];
            
            app.hideLoading();
            
            const modal = app.createModal(t('processes.selectFromTemplate'), `
                <div class="process-selection-container">
                    <div class="process-selection-header">
                        <p class="help-text">${t('processes.selectTemplateHelp')}</p>
                        <div class="selection-actions">
                            <button type="button" class="btn btn-sm" onclick="ProcessManager.selectAllAvailableProcesses()">
                                ${t('projects.selectAll')}
                            </button>
                            <button type="button" class="btn btn-sm" onclick="ProcessManager.deselectAllProcesses()">
                                ${t('projects.deselectAll')}
                            </button>
                        </div>
                    </div>
                    
                    <div class="process-categories">
                        ${categories.map(cat => this.renderProcessCategory(cat, templatesByCategory[cat.category].templates, existingCodes)).join('')}
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="ProcessManager.showAddProcessModal()">
                        ${t('common.back')}
                    </button>
                    <button type="button" class="btn btn-primary" onclick="ProcessManager.handleAddFromTemplate()">
                        ${t('common.add')} (<span id="selected-count">0</span> ${t('projects.processesSelected')})
                    </button>
                </div>
            `);
            
            this.selectedTemplates = [];
            this.updateSelectedCount();
            
        } catch (error) {
            app.hideLoading();
            console.error('Load process templates error:', error);
            app.showToast(t('projects.loadProcessError'), 'error');
        }
    },

    // 渲染工序分类
    renderProcessCategory(category, templates, existingCodes) {
        return `
            <div class="process-category">
                <div class="category-header" onclick="ProcessManager.toggleCategory('${category.category}')">
                    <div class="category-info">
                        <h4>${getI18nField(category, 'name')}</h4>
                        <span class="category-count">${templates.length} ${t('projects.processes')}</span>
                    </div>
                    <button type="button" class="btn-icon-only">▼</button>
                </div>
                <div class="category-processes" id="category-${category.category}">
                    ${templates.map(tmpl => this.renderProcessTemplate(tmpl, existingCodes.includes(tmpl.code))).join('')}
                </div>
            </div>
        `;
    },

    // 渲染工序模板
    renderProcessTemplate(template, isExisting) {
        return `
            <label class="process-item ${isExisting ? 'disabled' : ''}">
                <input type="checkbox" 
                    data-template-id="${template.id}" 
                    ${isExisting ? 'disabled' : ''}
                    onchange="ProcessManager.toggleTemplateSelection(${template.id})">
                <div class="process-info">
                    <div class="process-name">
                        <span class="process-code">${template.code}</span>
                        ${getI18nField(template, 'name')}
                        ${isExisting ? '<span class="badge-existing">已添加</span>' : ''}
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
    selectAllAvailableProcesses() {
        const checkboxes = document.querySelectorAll('.process-item:not(.disabled) input[type="checkbox"]');
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

    // 处理从模板添加
    async handleAddFromTemplate() {
        if (this.selectedTemplates.length === 0) {
            app.showToast(t('processes.selectAtLeastOne'), 'warning');
            return;
        }

        try {
            app.showLoading();
            const result = await api.processTemplates.batchAdd(this.projectId, this.selectedTemplates);
            
            if (result.success) {
                app.closeModal();
                app.showToast(t('processes.addSuccess'));
                // 刷新工序列表
                await ProjectDetail.loadProcesses();
            } else {
                app.showToast(result.message || t('processes.addError'), 'error');
            }
        } catch (error) {
            console.error('Add processes error:', error);
            app.showToast(t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 显示自定义工序表单
    showCustomProcessForm() {
        const modal = app.createModal(t('processes.customProcess'), `
            <form id="custom-process-form" class="form-vertical">
                <div class="form-group">
                    <label>${t('processes.processCode')} *</label>
                    <input type="text" id="custom-code" required placeholder="${t('processes.codeExample')}">
                    <small class="form-hint">${t('processes.codeHint')}</small>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>${t('processes.processName')} (${t('common.thai')}) *</label>
                        <input type="text" id="custom-name-th" required placeholder="เช่น: งานพิเศษ">
                    </div>
                    <div class="form-group">
                        <label>${t('processes.processName')} (${t('common.chinese')})</label>
                        <input type="text" id="custom-name-zh" placeholder="例如：特殊工序">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>${t('processes.unit')} *</label>
                    <select id="custom-unit" required>
                        <option value="m²">m² (平方米)</option>
                        <option value="m³">m³ (立方米)</option>
                        <option value="m">m (米)</option>
                        <option value="项">项 (รายการ)</option>
                        <option value="个">个 (ชิ้น)</option>
                        <option value="天">天 (วัน)</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="ProcessManager.showAddProcessModal()">
                        ${t('common.back')}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        ${t('common.add')}
                    </button>
                </div>
            </form>
        `);

        document.getElementById('custom-process-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddCustomProcess();
        });
    },

    // 处理添加自定义工序
    async handleAddCustomProcess() {
        const code = document.getElementById('custom-code').value.trim().toUpperCase();
        const nameTh = document.getElementById('custom-name-th').value.trim();
        const nameZh = document.getElementById('custom-name-zh').value.trim() || nameTh;
        const unit = document.getElementById('custom-unit').value;

        if (!code || !nameTh) {
            app.showToast(t('processes.fillRequired'), 'warning');
            return;
        }

        try {
            app.showLoading();
            const result = await api.processTemplates.addSingle(this.projectId, {
                customProcess: {
                    code,
                    name: { th: nameTh, zh: nameZh },
                    unit
                }
            });
            
            if (result.success) {
                app.closeModal();
                app.showToast(t('processes.addSuccess'));
                // 刷新工序列表
                await ProjectDetail.loadProcesses();
            } else {
                app.showToast(result.message || t('processes.addError'), 'error');
            }
        } catch (error) {
            console.error('Add custom process error:', error);
            app.showToast(t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    },

    // 确认删除工序
    confirmDeleteProcess(processExecutionId, processName) {
        if (!confirm(`${t('processes.confirmDelete')}\n\n${processName}`)) {
            return;
        }
        this.deleteProcess(processExecutionId);
    },

    // 删除工序
    async deleteProcess(processExecutionId) {
        try {
            app.showLoading();
            const result = await api.processTemplates.delete(this.projectId, processExecutionId);
            
            if (result.success) {
                app.showToast(t('processes.deleteSuccess'));
                // 刷新工序列表
                await ProjectDetail.loadProcesses();
            } else {
                app.showToast(result.message || t('processes.deleteError'), 'error');
            }
        } catch (error) {
            console.error('Delete process error:', error);
            app.showToast(error.message || t('common.error'), 'error');
        } finally {
            app.hideLoading();
        }
    }
};

// 暴露到全局
window.ProcessManager = ProcessManager;

console.log('✓ 工序管理模块已加载');
