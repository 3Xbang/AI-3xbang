// 工序进度页面增强功能
// Process Progress Page Enhancements

if (typeof app !== 'undefined') {
    // 保存原始的renderProcesses函数
    app._originalRenderProcesses = app.renderProcesses;
    
    // 替换renderProcesses函数以使用新设计
    app.renderProcesses = function(processes) {
        const container = document.getElementById('processes-list');
        
        // 添加工序管理头部（如果有权限）
        let header = '';
        if (typeof PermissionManager !== 'undefined' && PermissionManager.canManageProjects()) {
            header = `
                <div class="processes-header">
                    <h3>${t('nav.processes')}</h3>
                    <button class="btn btn-primary" onclick="ProcessManager.showAddProcessModal()">
                        <span class="btn-icon">+</span>
                        <span>${t('processes.addProcess')}</span>
                    </button>
                </div>
            `;
        }
        
        if (!processes || processes.length === 0) {
            container.innerHTML = `
                ${header}
                <div class="empty-state">
                    <div class="empty-icon">🔧</div>
                    <h3>${t('processes.noProcesses')}</h3>
                    <p>${t('processes.noProcessesDesc')}</p>
                    ${PermissionManager.canManageProjects() ? `
                        <button class="btn btn-primary btn-large" onclick="ProcessManager.showAddProcessModal()">
                            <span class="btn-icon">+</span>
                            <span>${t('processes.addFirst')}</span>
                        </button>
                    ` : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = header + processes.map(process => {
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
            
            // 删除按钮（只有未开始和管理员权限才能删除）
            let deleteButton = '';
            if (PermissionManager.canManageProjects() && statusClass === 'not_started') {
                deleteButton = `
                    <button class="btn-delete-process" 
                            onclick="ProcessManager.confirmDeleteProcess(${process.id}, '${getI18nField(process, 'process_name').replace(/'/g, "\\'")}')">
                        <span>🗑️</span>
                    </button>
                `;
            }
            
            return `
                <div class="process-item status-${statusClass}" id="process-${process.id}">
                    <div class="process-header">
                        <span class="process-code">${process.process_code}</span>
                        <h4>${getI18nField(process, 'process_name')}</h4>
                        ${deleteButton}
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
                        ${PermissionManager.canManageProjects() ? `
                            <button class="btn-schedule" onclick="ProcessScheduling.showDependencyManager(${process.id}, '${getI18nField(process, 'process_name').replace(/'/g, "\\'")}')">
                                🔗 ${t('scheduling.dependencies')}
                            </button>
                            <button class="btn-schedule" onclick="ProcessScheduling.showProcessSchedule(${process.id}, '${getI18nField(process, 'process_name').replace(/'/g, "\\'")}')">
                                📅 ${t('scheduling.schedule')}
                            </button>
                        ` : ''}
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
        try {
            app.showLoading();
            
            // 获取工序信息
            const processesResult = await api.processes.getList(ProjectDetail.projectId);
            if (!processesResult.success) {
                throw new Error('获取工序信息失败');
            }
            
            const process = processesResult.data.find(p => p.id === processExecutionId);
            if (!process) {
                throw new Error('工序不存在');
            }
            
            app.hideLoading();
            
            // 显示工程量输入表单
            await this.showQuantityInput(process);
            
        } catch (error) {
            app.hideLoading();
            console.error('Start process error:', error);
            app.showToast(error.message || '操作失败', 'error');
        }
    };
    
    // 显示工程量输入表单
    app.showQuantityInput = async function(process) {
        const processName = getI18nField(process, 'process_name');
        const processCode = process.process_code;
        
        // 根据工序代码获取需要输入的字段
        const quantityFields = this.getQuantityFields(processCode);
        
        if (!quantityFields || quantityFields.length === 0) {
            // 如果没有定义字段，直接开始工序
            if (!confirm(`确认开始工序：${processName}？`)) return;
            await this.doStartProcess(process.id, null);
            return;
        }
        
        const modal = app.createModal(`开始工序：${processName}`, `
            <form id="quantity-form" class="form-vertical">
                <div class="form-section">
                    <h4 style="margin-bottom: 20px;">📊 请输入工程量数据</h4>
                    <p class="help-text" style="margin-bottom: 20px; color: #666;">
                        系统将根据您输入的数据自动计算材料需求
                    </p>
                </div>
                
                ${quantityFields.map(field => `
                    <div class="form-group">
                        <label>
                            ${field.label}
                            <span style="color: #999; font-weight: normal;">(${field.unit})</span>
                            ${field.required ? '<span style="color: red;">*</span>' : ''}
                        </label>
                        <input 
                            type="number" 
                            id="field-${field.key}" 
                            name="${field.key}"
                            step="0.01" 
                            min="0"
                            ${field.required ? 'required' : ''}
                            placeholder="请输入${field.label}"
                            style="width: 100%;"
                        >
                        ${field.hint ? `<small class="form-hint">${field.hint}</small>` : ''}
                    </div>
                `).join('')}
                
                <div class="form-group" id="calculated-result" style="display: none; background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <div style="font-weight: 600; color: #0066cc; margin-bottom: 10px;">📈 计算结果</div>
                    <div id="result-content"></div>
                </div>
                
                <div class="form-actions" style="margin-top: 30px;">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                        取消
                    </button>
                    <button type="submit" class="btn btn-primary">
                        确认并开始工序
                    </button>
                </div>
            </form>
        `);
        
        // 添加实时计算
        quantityFields.forEach(field => {
            const input = document.getElementById(`field-${field.key}`);
            if (input) {
                input.addEventListener('input', () => {
                    this.calculateQuantity(quantityFields, processCode);
                });
            }
        });
        
        // 表单提交
        document.getElementById('quantity-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 收集数据
            const measurements = {};
            quantityFields.forEach(field => {
                const value = document.getElementById(`field-${field.key}`).value;
                if (value) {
                    measurements[field.key] = parseFloat(value);
                }
            });
            
            await this.doStartProcess(process.id, measurements);
        });
    };
    
    // 获取工序需要的字段定义
    app.getQuantityFields = function(processCode) {
        // 根据工序代码返回需要输入的字段
        const fieldDefinitions = {
            // 土方类 - 需要长宽高
            'N01_EXCAVATION': [
                { key: 'length', label: '长度', unit: 'm', required: true, hint: '开挖区域的长度' },
                { key: 'width', label: '宽度', unit: 'm', required: true, hint: '开挖区域的宽度' },
                { key: 'depth', label: '深度', unit: 'm', required: true, hint: '开挖深度' }
            ],
            'P001': [ // 地基开挖
                { key: 'length', label: '长度', unit: 'm', required: true },
                { key: 'width', label: '宽度', unit: 'm', required: true },
                { key: 'depth', label: '深度', unit: 'm', required: true }
            ],
            'P005': [ // 地基回填
                { key: 'volume', label: '回填体积', unit: 'm³', required: true }
            ],
            
            // 混凝土类 - 需要体积或面积+厚度
            'P002': [ // 垫层浇筑
                { key: 'area', label: '面积', unit: 'm²', required: true },
                { key: 'thickness', label: '厚度', unit: 'cm', required: true }
            ],
            'P004': [ // 基础混凝土
                { key: 'volume', label: '混凝土体积', unit: 'm³', required: true }
            ],
            'P008': [ // 柱混凝土
                { key: 'count', label: '柱子数量', unit: '根', required: true }
            ],
            'P013': [ // 楼板混凝土
                { key: 'volume', label: '混凝土体积', unit: 'm³', required: true }
            ],
            
            // 钢筋类 - 需要面积
            'P003': [ // 基础钢筋
                { key: 'area', label: '钢筋面积', unit: 'm²', required: true }
            ],
            'P007': [ // 柱钢筋
                { key: 'count', label: '柱子数量', unit: '根', required: true }
            ],
            'P010': [ // 梁钢筋
                { key: 'area', label: '梁底面积', unit: 'm²', required: true }
            ],
            'P012': [ // 楼板钢筋
                { key: 'area', label: '楼板面积', unit: 'm²', required: true }
            ],
            
            // 模板类
            'P006': [ // 柱模板
                { key: 'count', label: '柱子数量', unit: '根', required: true }
            ],
            'P009': [ // 梁模板
                { key: 'area', label: '梁底面积', unit: 'm²', required: true }
            ],
            'P011': [ // 楼板模板
                { key: 'area', label: '楼板面积', unit: 'm²', required: true }
            ],
            
            // 砌筑类
            'P014': [ // 砌墙
                { key: 'area', label: '墙体面积', unit: 'm²', required: true }
            ],
            
            // 防水类
            'P015': [ // 屋面防水
                { key: 'area', label: '屋面面积', unit: 'm²', required: true }
            ],
            'P016': [ // 卫生间防水
                { key: 'count', label: '卫生间数量', unit: '间', required: true }
            ],
            
            // 水电类
            'P017': [ // 水电预埋
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'P018': [ // 给水管
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'P019': [ // 排水管
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'P020': [ // 电线穿管
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            
            // 装修类
            'P021': [ // 内墙抹灰
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'P022': [ // 地面找平
                { key: 'area', label: '地面面积', unit: 'm²', required: true }
            ],
            'P023': [ // 墙面贴砖
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'P024': [ // 地面铺砖
                { key: 'area', label: '地面面积', unit: 'm²', required: true }
            ],
            'P025': [ // 吊顶龙骨
                { key: 'area', label: '吊顶面积', unit: 'm²', required: true }
            ],
            'P026': [ // 吊顶封板
                { key: 'area', label: '吊顶面积', unit: 'm²', required: true }
            ],
            'P027': [ // 墙面涂料
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'P028': [ // 门窗安装
                { key: 'count', label: '门窗数量', unit: '樘', required: true }
            ],
            'P029': [ // 洁具安装
                { key: 'count', label: '洁具件数', unit: '件', required: true }
            ],
            'P030': [ // 灯具安装
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'P031': [ // 验收
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ]
        };
        
        return fieldDefinitions[processCode] || null;
    };
    
    // 实时计算工程量
    app.calculateQuantity = function(fields, processCode) {
        const values = {};
        fields.forEach(field => {
            const input = document.getElementById(`field-${field.key}`);
            if (input && input.value) {
                values[field.key] = parseFloat(input.value);
            }
        });
        
        // 检查是否所有必填字段都有值
        const allFilled = fields.filter(f => f.required).every(f => values[f.key]);
        if (!allFilled) {
            document.getElementById('calculated-result').style.display = 'none';
            return;
        }
        
        // 计算结果
        let result = '';
        let calculatedValue = 0;
        let unit = '';
        
        if (values.length && values.width && values.depth) {
            // 体积 = 长 × 宽 × 高
            calculatedValue = values.length * values.width * values.depth;
            unit = 'm³';
            result = `<div>工程量：<strong style="color: #0066cc; font-size: 18px;">${calculatedValue.toFixed(2)}</strong> ${unit}</div>`;
        } else if (values.area && values.thickness) {
            // 体积 = 面积 × 厚度
            calculatedValue = values.area * (values.thickness / 100); // 厚度转换为米
            unit = 'm³';
            result = `<div>工程量：<strong style="color: #0066cc; font-size: 18px;">${calculatedValue.toFixed(2)}</strong> ${unit}</div>`;
        } else if (values.volume) {
            calculatedValue = values.volume;
            unit = 'm³';
            result = `<div>工程量：<strong style="color: #0066cc; font-size: 18px;">${calculatedValue.toFixed(2)}</strong> ${unit}</div>`;
        } else if (values.area) {
            calculatedValue = values.area;
            unit = 'm²';
            result = `<div>工程量：<strong style="color: #0066cc; font-size: 18px;">${calculatedValue.toFixed(2)}</strong> ${unit}</div>`;
        } else if (values.count) {
            calculatedValue = values.count;
            unit = '个';
            result = `<div>工程量：<strong style="color: #0066cc; font-size: 18px;">${calculatedValue}</strong> ${unit}</div>`;
        }
        
        if (result) {
            document.getElementById('result-content').innerHTML = result;
            document.getElementById('calculated-result').style.display = 'block';
        }
    };
    
    // 执行开始工序
    app.doStartProcess = async function(processExecutionId, measurements) {
        try {
            this.showLoading();
            
            const updateData = {
                status: 'in_progress',
                actual_start_date: new Date().toISOString().split('T')[0]
            };
            
            // 如果有工程量数据，添加到更新中
            if (measurements) {
                updateData.measurements = JSON.stringify(measurements);
                
                // 计算 planned_quantity
                if (measurements.length && measurements.width && measurements.depth) {
                    updateData.planned_quantity = measurements.length * measurements.width * measurements.depth;
                } else if (measurements.area && measurements.thickness) {
                    updateData.planned_quantity = measurements.area * (measurements.thickness / 100);
                } else if (measurements.volume) {
                    updateData.planned_quantity = measurements.volume;
                } else if (measurements.area) {
                    updateData.planned_quantity = measurements.area;
                } else if (measurements.count) {
                    updateData.planned_quantity = measurements.count;
                }
            }
            
            const result = await api.processes.update(processExecutionId, updateData);
            
            if (result.success) {
                app.closeModal();
                this.showToast('工序已开始');
                // 重新加载工序列表
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                }
            }
        } catch (error) {
            console.error('Start process error:', error);
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
            const result = await api.processes.update(processExecutionId, { status });
            
            if (result.success) {
                this.showToast('状态已更新');
                // 重新加载工序列表
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                }
            }
        } catch (error) {
            console.error('Pause process error:', error);
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
            const result = await api.processes.update(processExecutionId, {
                status: 'completed',
                actual_end_date: new Date().toISOString().split('T')[0],
                completion_percentage: 100
            });
            
            if (result.success) {
                this.showToast('工序已完成！');
                // 重新加载工序列表
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                }
            }
        } catch (error) {
            console.error('Complete process error:', error);
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
