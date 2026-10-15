// 工序进度页面增强功能 / Process Progress Page Enhancements

// 双语文本定义 (中文 + 泰语)
const BilingualTexts = {
    startProcess: '开始工序 Start Work',
    updateProgress: '更新进度 Update Progress',
    pause: '暂停 Paused',
    complete: '完成 Completed',
    completed: '已完成 Completed',
    viewSubtasks: '查看子任务 View Subtasks',
    collapseSubtasks: '收起子任务 Hide Subtasks',
    quantity: '工程量 Quantity',
    schedule: '计划 Plan',
    dependencies: '依赖 Related Tasks',
    days: '天 Days',
    loading: '加载中... Loading...',
    noSubtasks: '暂无子任务 No subtasks yet',
    createFromTemplate: '从模板创建子任务 Create from Template',
    subtaskList: '子任务列表 Subtask List',
    addMoreSubtasks: '+ 添加更多子任务 Add Subtask',
    loadError: '加载失败 Load failed',
    estimated: '预计 Estimated',
    completed_qty: '已完成 Completed',
    recordProgress: '记录进度 Record Progress'
};

if (typeof app !== 'undefined') {
    // ${t('common.save')}原始的renderProcesses函数
    app._originalRenderProcesses = app.renderProcesses;
    
    // 存储当前加载的工序列表（用于快速访问）
    app._currentProcesses = [];
    
    // 替换renderProcesses函数以使用新设计
    app.renderProcesses = function(processes) {
        app._currentProcesses = processes || [];
        const t = BilingualTexts;  // 使用双语文本
        
        const container = document.getElementById('processes-list');
        
        // 工序管理头部已移除（工序通过项目申请表自动生成）












        
        if (!processes || processes.length === 0) {
            container.innerHTML = `
                ${header}
                <div class="empty-state">
                    <div class="empty-icon">🔧</div>
                    <h3>暂无工序 No Processes</h3>
                    <p>请添加项目工序开始管理 Please add processes to start managing</p>
                    ${PermissionManager.canManageProjects() ? `



                        </button>
                    ` : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = header + `<div class="processes-grid">` + processes.map(process => {
            const statusClass = process.status || 'not_started';
            const statusText = getStatusText(statusClass);
            const percentage = Math.round(process.completion_percentage || 0);
            const progressColor = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#3b82f6' : '#f59e0b';
            
            // 状态对应的操作按钮
            let actionButtons = '';
            if (statusClass === 'not_started') {
                actionButtons = `<button class="btn-start" onclick="app.startProcess(${process.id})">▶ 开始 Start</button>
                    <button class="btn-complete" onclick="app.completeProcess(${process.id})" title="直接标记已完成（接手旧项目时用）" style="background:#6b7280;border-color:#6b7280">✅ 标记完成</button>`;
            } else if (statusClass === 'in_progress') {
                actionButtons = `
                    <button class="btn-update-progress" onclick="app.showUpdateProgress(${process.id}, ${percentage})">更新进度 Update Progress</button>
                    <button class="btn-pause" onclick="app.pauseProcess(${process.id})">暂停 Paused</button>
                    <button class="btn-complete" onclick="app.completeProcess(${process.id})">完成 Completed</button>
                `;
            } else if (statusClass === 'completed') {
                actionButtons = `<span style="color: #10b981; font-weight: 600;">✓ 已完成 Completed</span>`;
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
            
            // 计划日期显示
            let scheduledInfo = '';
            if (process.planned_start_date || process.planned_end_date) {
                const startDate = process.planned_start_date ? new Date(process.planned_start_date).toLocaleDateString('zh-CN', {month:'short', day:'numeric'}) : '未设定';
                const endDate = process.planned_end_date ? new Date(process.planned_end_date).toLocaleDateString('zh-CN', {month:'short', day:'numeric'}) : '未设定';
                scheduledInfo = `
                    <div class="process-schedule-info">
                        <span class="schedule-label">📅 计划日期 Planned Date:</span>
                        <span class="schedule-dates">${startDate} → ${endDate}</span>
                        ${process.planned_duration ? `<span class="schedule-duration">(${process.planned_duration}天 Days)</span>` : ''}
                    </div>
                `;
            }
            
            // 工程量显示
            let quantityInfo = '';
            if (process.planned_quantity && process.quantity_unit) {
                quantityInfo = `
                    <div class="process-quantity-info">
                        <span class="quantity-label">📊 工程量 Quantity:</span>
                        <span class="quantity-value">${process.planned_quantity} ${process.quantity_unit}</span>
                    </div>
                `;
            }
            
            return `
                <div class="process-card status-${statusClass.replace('_', '-')}" id="process-${process.id}">
                    <!-- 状态条 -->
                    <div class="process-card-status-bar"></div>
                    
                    <!-- 卡片内容 -->
                    <div class="process-card-content">
                        <!-- 头部：代码和标题 -->
                        <div class="process-card-header">
                            <div class="process-code-badge">${process.process_code}</div>
                            <h3 class="process-card-title">${getI18nField(process, 'process_name')}</h3>
                        </div>
                        
                        <!-- 进度条 -->
                        <div class="process-card-progress">
                            <div class="progress-header">
                                <span class="progress-label">完成度 Progress</span>
                                <span class="progress-percentage">${percentage}%</span>
                            </div>
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                        
                        <!-- 关键信息 -->
                        ${(scheduledInfo || quantityInfo) ? `
                            <div class="process-card-info">
                                ${scheduledInfo ? `
                                    <div class="info-item">
                                        <span class="info-icon">📅</span>
                                        <div class="info-content">
                                            <div class="info-label">计划日期</div>
                                            <div class="info-value">${process.planned_start_date ? new Date(process.planned_start_date).toLocaleDateString('zh-CN', {month:'short', day:'numeric'}) : '未设定'} → ${process.planned_end_date ? new Date(process.planned_end_date).toLocaleDateString('zh-CN', {month:'short', day:'numeric'}) : '未设定'}</div>
                                        </div>
                                    </div>
                                ` : ''}
                                ${quantityInfo ? `
                                    <div class="info-item">
                                        <span class="info-icon">📊</span>
                                        <div class="info-content">
                                            <div class="info-label">工程量</div>
                                            <div class="info-value">${process.planned_quantity} ${process.quantity_unit}</div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        <!-- 操作按钮 -->
                        <div class="process-card-actions">
                            ${statusClass === 'not_started' ? `
                                <button class="primary-action" onclick="app.startProcess(${process.id})">
                                    <span>▶️</span>
                                    <span>开始工序 Start Process</span>
                                </button>
                            ` : statusClass === 'in_progress' ? `
                                <button class="primary-action" onclick="app.showUpdateProgress(${process.id}, ${percentage})">
                                    <span>📈</span>
                                    <span>更新进度 Update Progress</span>
                                </button>
                            ` : `
                                <div class="status-badge">
                                    <span>✅</span>
                                    <span>已完成 Completed</span>
                                </div>
                            `}
                            
                            <div class="secondary-actions">
                                <button class="secondary-action" onclick="app.showQuantityInputById(${process.id})">
                                    <span>📊</span>
                                    <span>工程量</span>
                                </button>
                                <button class="secondary-action" onclick="app.toggleSubtasksInline(${process.id})">
                                    <span>📋</span>
                                    <span>子任务</span>
                                </button>
                                ${PermissionManager.canManageProjects() ? `
                                    <button class="secondary-action" onclick="ProcessScheduling.showDependencyManager(${process.id}, '${getI18nField(process, 'process_name').replace(/'/g, "\\'")}')">
                                        <span>🔗</span>
                                        <span>依赖</span>
                                    </button>
                                    <button class="secondary-action" onclick="ProcessScheduling.showProcessSchedule(${process.id}, '${getI18nField(process, 'process_name').replace(/'/g, "\\'")}')">
                                        <span>📅</span>
                                        <span>计划</span>
                                    </button>
                                ` : ''}
                                ${statusClass === 'in_progress' ? `
                                    <button class="secondary-action" onclick="app.pauseProcess(${process.id})">
                                        <span>⏸️</span>
                                        <span>暂停</span>
                                    </button>
                                    <button class="secondary-action" onclick="app.completeProcess(${process.id})">
                                        <span>✅</span>
                                        <span>完成</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- 子任务展开区域 -->
                    <div class="process-subtasks-area" id="subtasks-area-${process.id}">
                        <div class="loading-subtasks">加载中... Loading...</div>
                    </div>
                </div>
            `;
        }).join('') + `</div>`; // 闭合 processes-grid
    };
    
    // 展开/收起子任务（内联显示）
    app.toggleSubtasksInline = async function(processExecutionId) {
        const t = BilingualTexts;
        const area = document.getElementById(`subtasks-area-${processExecutionId}`);
        const toggleText = document.getElementById(`subtask-toggle-text-${processExecutionId}`);
        
        if (area.classList.contains('expanded')) {
            // 收起
            area.classList.remove('expanded');
            if (toggleText) toggleText.textContent = t.viewSubtasks + ' ▼';
        } else {
            // 展开并加载子任务
            area.classList.add('expanded');
            if (toggleText) toggleText.textContent = t.collapseSubtasks + ' ▲';
            
            try {
                const result = await api.getSubtasks(processExecutionId);
                const subtasks = result.data || [];
                
                if (subtasks.length === 0) {
                    // 没有子任务，显示创建模板选项
                    area.innerHTML = `
                        <div style="text-align: center; padding: 1rem; color: #6b7280;">
                            <p>暂无子任务 No subtasks yet</p>
                            <button class="btn-start" onclick="app.showSubtaskTemplates(${processExecutionId})" style="margin-top: 0.5rem;">
                                从模板创建 Create from Template
                            </button>
                        </div>
                    `;
                } else {
                    // 显示子任务列表
                    area.innerHTML = `
                        <h5 style="margin-bottom: 0.75rem; color: #374151;">📋 子任务列表 Subtask List</h5>
                        <div class="subtask-list-inline">
                            ${subtasks.map(subtask => this.renderSubtaskInline(subtask, processExecutionId)).join('')}
                        </div>
                        <button class="btn-toggle-subtasks" onclick="app.showSubtaskTemplates(${processExecutionId})" style="margin-top: 0.75rem;">
                            + 添加更多子任务 Add Subtask
                        </button>
                    `;
                }
            } catch (error) {
                area.innerHTML = `<p style="color: #ef4444;">加载失败 Load failed</p>`;
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
                        <span>预计 Estimated: ${subtask.planned_quantity || subtask.estimated_quantity || 0} ${getUnitText(subtask.quantity_unit || subtask.unit || '')}</span>
                        <span>完成 Completed: ${subtask.actual_quantity || subtask.completed_quantity || 0} ${getUnitText(subtask.quantity_unit || subtask.unit || '')}</span>
                    </div>
                </div>
                <div class="subtask-actions-inline">
                    ${!isCompleted ? `

                            记录进度 Record Progress
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
                throw new Error('加载工序失败 Load process failed');
            }
            
            const process = processesResult.data.find(p => p.id === processExecutionId);
            if (!process) {
                throw new Error('工序不存在 Process not found');
            }
            
            app.hideLoading();
            
            // 显示工程量输入表单
            await this.showQuantityInput(process);
            
        } catch (error) {
            app.hideLoading();
            console.error('Start process error:', error);
            app.showToast(error.message || '操作失败 Operation failed', 'error');
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
        
        const modal = app.createModal(`开始工序 Start Process: ${processName}`, `
            <form id="quantity-form" class="form-vertical">
                <div class="form-section">
                    <h4 style="margin-bottom: 20px;">📊 ${t('quantities.enterData')}</h4>
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
                            placeholder="${t('common.pleaseEnter')} ${field.label}"
                            style="width: 100%;"
                        >
                        ${field.hint ? `<small class="form-hint">${field.hint}</small>` : ''}
                    </div>
                `).join('')}
                
                <div class="form-group" id="calculated-result" style="display: none; background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <div style="font-weight: 600; color: #0066cc; margin-bottom: 10px;">📈 ${t('quantities.calculationResult')}</div>
                    <div id="result-content"></div>
                </div>
                
                <div class="form-actions" style="margin-top: 30px;">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                        ${t('common.cancel')}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        ${t('processes.confirmAndStart')}
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
            'FND-01-01': [ // 场地平整
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            'FND-01-02': [ // 基坑开挖
                { key: 'length', label: '长度', unit: 'm', required: true },
                { key: 'width', label: '宽度', unit: 'm', required: true },
                { key: 'depth', label: '深度', unit: 'm', required: true }
            ],
            'FND-01-03': [ // 地基处理
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            'FND-01-04': [ // 混凝土垫层
                { key: 'area', label: '面积', unit: 'm²', required: true },
                { key: 'thickness', label: '厚度', unit: 'cm', required: true }
            ],
            'FND-01-05': [ // 基础防水
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            'FND-01-06': [ // 基础混凝土浇筑
                { key: 'volume', label: '混凝土体积', unit: 'm³', required: true }
            ],
            'N02_FOUNDATION': [ // 地基浇筑
                { key: 'volume', label: '混凝土体积', unit: 'm³', required: true }
            ],
            
            // 结构类
            'STR-02-01': [ // 柱钢筋绑扎
                { key: 'count', label: '柱子数量', unit: '根', required: true }
            ],
            'STR-02-02': [ // 柱模板安装
                { key: 'count', label: '柱子数量', unit: '根', required: true }
            ],
            'STR-02-03': [ // 柱混凝土浇筑
                { key: 'count', label: '柱子数量', unit: '根', required: true }
            ],
            'STR-02-04': [ // 梁板钢筋绑扎
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            'STR-02-05': [ // 梁板模板安装
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            'STR-02-06': [ // 梁板混凝土浇筑
                { key: 'volume', label: '混凝土体积', unit: 'm³', required: true }
            ],
            'STR-02-07': [ // 楼梯施工（按台阶数+尺寸）
                { key: 'steps', label: '台阶数量 Number of Steps', unit: '步', required: true, placeholder: '如：18' },
                { key: 'width', label: '楼梯宽度 Stair Width', unit: 'm', required: true, placeholder: '如：1.2' },
                { key: 'step_depth', label: '踏步深度（进深）Tread Depth', unit: 'cm', required: true, placeholder: '如：30' },
                { key: 'step_height', label: '踏步高度（踢面高）Step Height', unit: 'cm', required: true, placeholder: '如：17' }
            ],
            'STR-02-08': [ // 屋面结构层
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            'STR-02-09': [ // 屋面防水层
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            'N03_STRUCTURE': [ // 主体框架
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'N04_ROOF_FRAME': [ // 屋面封顶
                { key: 'area', label: '屋面面积', unit: 'm²', required: true }
            ],
            
            // 砌筑类
            'MAS-03-01': [ // 砖墙砌筑
                { key: 'area', label: '墙体面积', unit: 'm²', required: true }
            ],
            'MAS-03-02': [ // 构造柱施工
                { key: 'count', label: '构造柱数量', unit: '根', required: true }
            ],
            'MAS-03-03': [ // 圈梁施工
                { key: 'length', label: '长度', unit: 'm', required: true }
            ],
            'N08_WALL_PARTITION': [ // 砌墙隔断
                { key: 'area', label: '墙体面积', unit: 'm²', required: true }
            ],
            
            // 装修类 - 抹灰
            'FIN-01-01': [ // 墙面基层处理
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'FIN-01-02': [ // 内墙抹灰
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'FIN-01-03': [ // 外墙抹灰
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'FIN-01-04': [ // 天花抹灰
                { key: 'area', label: '天花面积', unit: 'm²', required: true }
            ],
            'N09_PLASTERING': [ // 泥瓦抹灰
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            
            // 地面类
            'FLR-02-01': [ // 地面找平层
                { key: 'area', label: '地面面积', unit: 'm²', required: true }
            ],
            'FLR-02-02': [ // 地砖铺贴
                { key: 'area', label: '地面面积', unit: 'm²', required: true }
            ],
            'FLR-02-03': [ // 木地板安装
                { key: 'area', label: '地面面积', unit: 'm²', required: true }
            ],
            'FLR-02-04': [ // 石材地面
                { key: 'area', label: '地面面积', unit: 'm²', required: true }
            ],
            'N10_TILING': [ // 瓷砖铺贴
                { key: 'area', label: '面积', unit: 'm²', required: true }
            ],
            
            // 吊顶类
            'CLG-03-01': [ // 轻钢龙骨骨架
                { key: 'area', label: '吊顶面积', unit: 'm²', required: true }
            ],
            'CLG-03-02': [ // 石膏板吊顶
                { key: 'area', label: '吊顶面积', unit: 'm²', required: true }
            ],
            'CLG-03-03': [ // 铝扣板吊顶
                { key: 'area', label: '吊顶面积', unit: 'm²', required: true }
            ],
            'N11_CEILING': [ // 木工吊顶
                { key: 'area', label: '吊顶面积', unit: 'm²', required: true }
            ],
            
            // 墙面装修类
            'WAL-04-01': [ // 墙面找平
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'WAL-04-02': [ // 腻子批刮
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'WAL-04-03': [ // 乳胶漆涂刷
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'WAL-04-04': [ // 墙砖铺贴
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'WAL-04-05': [ // 墙纸粘贴
                { key: 'area', label: '墙面面积', unit: 'm²', required: true }
            ],
            'N12_PAINTING': [ // 油漆涂刷
                { key: 'area', label: '涂刷面积', unit: 'm²', required: true }
            ],
            
            // 门窗类（注意：数据库单位统一使用"樘"）
            'DOR-05-01': [ // 门窗框安装
                { key: 'count', label: '门窗数量', unit: '樘', required: true }
            ],
            'DOR-05-02': [ // 门扇安装
                { key: 'count', label: '门数量', unit: '樘', required: true }
            ],
            'DOR-05-03': [ // 窗扇安装
                { key: 'count', label: '窗数量', unit: '樘', required: true }
            ],
            'DOR-05-04': [ // 玻璃安装
                { key: 'area', label: '玻璃面积', unit: 'm²', required: true }
            ],
            'N13_DOOR_WINDOW': [ // 门窗安装
                { key: 'count', label: '门窗数量', unit: '樘', required: true }
            ],
            
            // 水电类
            'MEP-06-01': [ // 给水管道安装
                { key: 'length', label: '管道长度', unit: 'm', required: true }
            ],
            'MEP-06-02': [ // 排水管道安装
                { key: 'length', label: '管道长度', unit: 'm', required: true }
            ],
            'MEP-06-03': [ // 强电线路敷设
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'MEP-06-04': [ // 弱电线路敷设
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'MEP-06-05': [ // 灯具安装
                { key: 'count', label: '灯具数量', unit: '盏', required: true }
            ],
            'MEP-06-06': [ // 开关插座安装
                { key: 'count', label: '开关插座数量', unit: '个', required: true }
            ],
            'N05_MEP_ROUGH': [ // 水电布管
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'N06_MEP_HIDDEN': [ // 水电隐蔽工程
                { key: 'area', label: '建筑面积', unit: 'm²', required: true }
            ],
            'N15_LIGHTING': [ // 灯具开关
                { key: 'count', label: '灯具数量', unit: '盏', required: true }
            ],
            
            // 卫浴类（注意：数据库单位统一使用"套"）
            'SAN-07-01': [ // 卫生间防水
                { key: 'area', label: '防水面积', unit: 'm²', required: true }
            ],
            'SAN-07-02': [ // 卫生洁具安装
                { key: 'count', label: '洁具数量', unit: '套', required: true }
            ],
            'SAN-07-03': [ // 淋浴房安装
                { key: 'count', label: '淋浴房数量', unit: '套', required: true }
            ],
            'N07_WATERPROOF': [ // 防水工程
                { key: 'area', label: '防水面积', unit: 'm²', required: true }
            ],
            'N14_SANITARY': [ // 洁具安装
                { key: 'count', label: '洁具数量', unit: '套', required: true }
            ],
            
            // 厨房类
            'KIT-07-04': [ // 橱柜安装
                { key: 'length', label: '橱柜长度', unit: 'm', required: true }
            ],
            'KIT-07-05': [ // 台面安装
                { key: 'length', label: '台面长度', unit: 'm', required: true }
            ],
            
            // 其他
            'N16_CLEANING': [ // 清洁验收
                { key: 'area', label: '清洁面积', unit: 'm²', required: true }
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
        
        // ${t('quantities.calculationResult')}
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
            // 根据工序代码获取正确的单位，而不是硬编码"个"
            const field = fields.find(f => f.key === 'count');
            unit = field ? field.unit : '个';
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
                this.showToast(t('processes.startSuccess'));
                // 重新加载工序列表
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                }
            }
        } catch (error) {
            console.error('Start process error:', error);
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 暂停工序
    app.pauseProcess = async function(processExecutionId) {
        const reason = prompt(t('processes.pauseReason'));
        
        let status = 'in_progress';
        if (reason === '1') status = 'waiting_material';
        else if (reason === '2') status = 'weather_stop';
        else if (!reason) return;
        
        try {
            this.showLoading();
            const result = await api.processes.update(processExecutionId, { status });
            
            if (result.success) {
                this.showToast(t('processes.statusUpdated'));
                // 重新加载工序列表
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                }
            }
        } catch (error) {
            console.error('Pause process error:', error);
            this.showToast(t('common.error'), 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 完成工序
    app.completeProcess = async function(processExecutionId) {
        // 弹窗：选实际完成日期，历史任务用过去的日期
        const today = new Date(Date.now() + 7*3600000).toISOString().split('T')[0];
        const dlg = await new Promise(resolve => {
            const el = document.createElement('div');
            el.className = 'sb-overlay';
            el.innerHTML = `<div class="sb-dialog narrow"><header><h3>标记完成 Mark as Done</h3><button data-x>&times;</button></header>
                <div class="sb-body">
                    <div class="sb-note" style="margin-bottom:12px">是今天刚完成，还是之前已经完成了？</div>
                    <div class="sb-field"><label>实际完成日期 *</label><input type="date" id="cp-date" value="${today}" max="${today}" style="font-size:16px;padding:10px;width:100%;border:2px solid #bfdbfe;border-radius:10px"></div>
                    <div class="sb-sub" style="margin-top:6px">如果这道工序之前就完成了，请改成实际完成的日期。日期越早，后面依赖它的工序等待期越快满足。</div>
                </div>
                <footer><button class="sb-btn" data-cancel>取消 Cancel</button><button class="sb-btn primary" data-ok>✅ 确认完成 Confirm</button></footer></div>`;
            document.body.appendChild(el);
            el.querySelector('[data-x]').onclick = () => { el.remove(); resolve(null); };
            el.querySelector('[data-cancel]').onclick = () => { el.remove(); resolve(null); };
            el.querySelector('[data-ok]').onclick = () => { const v = el.querySelector('#cp-date').value; el.remove(); resolve(v || today); };
        });
        if (!dlg) return;
        try {
            this.showLoading();
            const result = await api.processes.update(processExecutionId, {
                status: 'completed',
                actual_end_date: dlg,
                actual_start_date: dlg,   // 如果没有开始日期，一并补上
                completion_percentage: 100
            });
            if (result.success) {
                this.showToast('已完成 ✅ Completed');
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                    // 完成后刷新今日现场（如果已加载）
                    if (window.SiteBoard && SiteBoard.projectId === ProjectDetail.projectId) {
                        SiteEstimate && (SiteEstimate.cache = {});
                        SiteBoard.refresh().catch(() => {});
                    }
                }
            }
        } catch (error) {
            console.error('Complete process error:', error);
            this.showToast(typeof t !== 'undefined' ? t('common.error') : '操作失败', 'error');
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

    // 显示${t.updateProgress}对话框
    app.showUpdateProgress = async function(processExecutionId, currentPercentage) {
        const modal = app.createModal(t('daily.updateProgress'), `
            <form id="update-progress-form" class="form-vertical">
                <div class="form-group">
                    <label>${t('daily.currentProgress')}: ${currentPercentage}%</label>
                    <div class="progress-bar" style="margin: 10px 0;">
                        <div class="progress-fill" style="width: ${currentPercentage}%; background: #3b82f6;"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>${t('daily.newProgress')} *</label>
                    <input type="number" id="new-percentage" min="0" max="100" value="${currentPercentage}" required>
                    <small class="form-hint">${t('daily.progressHint')}</small>
                </div>
                
                <div class="form-group">
                    <label>${t('daily.progressNotes')}</label>
                    <textarea id="progress-note" rows="3" placeholder="${t('daily.progressNotesPlaceholder')}"></textarea>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                        ${t('common.cancel')}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        更新进度 Update Progress
                    </button>
                </div>
            </form>
        `);
        
        document.getElementById('update-progress-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateProcessProgress(processExecutionId);
        });
        
        // 实时预览
        document.getElementById('new-percentage').addEventListener('input', (e) => {
            const value = Math.min(100, Math.max(0, e.target.value));
            document.querySelector('#update-progress-form .progress-fill').style.width = value + '%';
        });
    };
    
    // 更新工序进度
    app.updateProcessProgress = async function(processExecutionId) {
        const newPercentage = parseInt(document.getElementById('new-percentage').value);
        const progressNote = document.getElementById('progress-note').value;
        
        if (newPercentage < 0 || newPercentage > 100) {
            this.showToast(t('daily.progressRangeError'), 'error');
            return;
        }
        
        try {
            app.showLoading();
            
            const updateData = {
                completion_percentage: newPercentage
            };
            
            // 如果达到100%，自动标记为完成
            if (newPercentage >= 100) {
                updateData.status = 'completed';
                updateData.actual_end_date = new Date().toISOString().split('T')[0];
            }
            
            const result = await api.processes.update(processExecutionId, updateData);
            
            if (result.success) {
                app.closeModal();
                this.showToast(newPercentage >= 100 ? t('processes.completeSuccess') : t('daily.progressUpdated').replace('{percent}', newPercentage));
                
                // 如果有${t('daily.progressNotes')}，记录活动日志
                if (progressNote) {
                    await api.logActivity(ProjectDetail.projectId, 'update', {
                        message: `${t('daily.progressUpdate')}: ${newPercentage}% - ${progressNote}`
                    });
                }
                
                // 重新加载工序列表
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                }
            }
        } catch (error) {
            console.error('Update progress error:', error);
            this.showToast(t('common.updateError'), 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 修改 showQuantityInput 使其可以独立使用（不自动开始工序）
    const originalShowQuantityInput = app.showQuantityInput;
    app.showQuantityInput = async function(process) {
        const processCode = process.process_code || process.code;
        const processName = getI18nField(process, 'process_name');
        const processId = process.id;
        
        // 获取工序类型对应的字段
        const fields = app.getQuantityFields(processCode);
        
        // 如果没有找到字段定义，使用通用字段
        if (!fields || fields.length === 0) {
            this.showToast(t('quantities.notSupported'), 'warning');
            
            // 使用通用字段：数量
            const genericFields = [
                { key: 'quantity', label: t('quantities.quantity'), unit: '', required: true, placeholder: t('quantities.enterQuantity') },
                { key: 'unit', label: t('quantities.unit'), unit: '', required: false, placeholder: t('quantities.unitPlaceholder') }
            ];
            
            await this.showGenericQuantityInput(process, genericFields);
            return;
        }
        
        // 解析现有的 measurements 数据
        let existingMeasurements = {};
        if (process.measurements) {
            try {
                existingMeasurements = typeof process.measurements === 'string' 
                    ? JSON.parse(process.measurements) 
                    : process.measurements;
            } catch (e) {
                console.error('Parse measurements error:', e);
            }
        }
        
        // 构建表单字段HTML
        const fieldsHtml = fields.map(field => {
            const value = existingMeasurements[field.key] || '';
            return `
                <div class="form-group">
                    <label>${field.label}${field.required ? ' *' : ''}</label>
                    <input 
                        type="number" 
                        id="qty-${field.key}" 
                        value="${value}"
                        min="0" 
                        step="0.01" 
                        ${field.required ? 'required' : ''}
                        placeholder="${field.placeholder || ''}">
                    ${field.unit ? `<small class="form-hint">${t('quantities.unit')}: ${field.unit}</small>` : ''}
                </div>
            `;
        }).join('');
        
        // 计算结果显示（始终显示，随输入实时更新）
        const resultHtml = `
            <div class="form-group">
                <label style="font-weight: bold; color: #059669;">${t('quantities.calculationResult')}</label>
                <div id="quantity-result" style="font-size: 1.2em; color: #059669; padding: 10px; background: #f0fdf4; border-radius: 0.5rem; text-align: center;">
                    ${process.planned_quantity ? process.planned_quantity + ' ' + (process.quantity_unit || '') : '等待输入 Awaiting input'}
                </div>
                <div id="quantity-derived" style="text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 6px;"></div>
            </div>
        `;
        
        const modal = app.createModal(`工程量 Quantity - ${processName}`, `
            <form id="quantity-form" class="form-vertical">
                <div class="form-hint" style="margin-bottom: 1rem; padding: 10px; background: #eff6ff; border-radius: 0.5rem;">
                    <strong>${t('quantities.instruction')}:</strong> ${t('quantities.instructionText')}${process.status === 'not_started' ? ' 保存后将自动开始此流程 Save will auto-start this process' : ''}
                </div>
                
                ${fieldsHtml}
                ${resultHtml}
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                        ${t('common.cancel')}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        ${process.status === 'not_started' ? '保存并开始 Save and Start' : '保存 Save'}
                    </button>
                </div>
            </form>
        `);
        
        // 实时计算：每次输入后刷新结果和推算值
        const refreshResult = () => {
            const m = {};
            fields.forEach(f => {
                const el = document.getElementById(`qty-${f.key}`);
                const v = el ? parseFloat(el.value) : NaN;
                if (!isNaN(v) && v > 0) m[f.key] = v;
            });
            const calc = app.computeQuantity(m);
            const resultDiv = document.getElementById('quantity-result');
            const derivedDiv = document.getElementById('quantity-derived');
            if (!resultDiv) return;
            if (calc.value > 0) {
                const unit = process.quantity_unit || calc.unit;
                resultDiv.textContent = `${Math.round(calc.value * 100) / 100} ${unit}`;
            } else {
                resultDiv.textContent = '等待输入 Awaiting input';
            }
            if (derivedDiv) derivedDiv.textContent = calc.note || '';
        };
        fields.forEach(f => {
            const el = document.getElementById(`qty-${f.key}`);
            if (el) el.addEventListener('input', refreshResult);
        });
        refreshResult();
        
        // 表单提交
        document.getElementById('quantity-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveQuantityData(processId, fields, process.status === 'not_started');
        });
    };
    
    // ${t('common.save')}工程量数据
    app.saveQuantityData = async function(processId, fields, shouldStart) {
        const measurements = {};
        let isValid = true;
        
        // 收集所有字段的值
        fields.forEach(field => {
            const input = document.getElementById(`qty-${field.key}`);
            if (input) {
                const value = parseFloat(input.value);
                if (field.required && (!value || value <= 0)) {
                    isValid = false;
                    input.style.borderColor = 'red';
                } else {
                    measurements[field.key] = value || 0;
                    input.style.borderColor = '';
                }
            }
        });
        
        if (!isValid) {
            this.showToast(t('common.fillRequired'), 'error');
            return;
        }
        
        try {
            this.showLoading();
            
            // 从已加载的工序列表取当前工序（api.processes 没有 getById）
            const currentProcess = (app._currentProcesses || []).find(p => p.id === processId) || {};
            
            // 统一计算：主工程量 + 单位
            const calc = app.computeQuantity(measurements);
            const plannedQuantity = Math.round(calc.value * 100) / 100;
            
            // 数据库里的单位是准的；如果算出来的单位和它不一致，提示出来方便排查
            if (currentProcess.quantity_unit && calc.unit && currentProcess.quantity_unit !== calc.unit) {
                console.warn('Quantity unit mismatch:', currentProcess.process_code, 'DB=', currentProcess.quantity_unit, 'calc=', calc.unit);
            }
            
            const updateData = {
                measurements: JSON.stringify(measurements),
                planned_quantity: plannedQuantity
                // 不传 quantity_unit，保持数据库中的值不变
            };
            // 数据库里没有单位时才补上
            if (!currentProcess.quantity_unit && calc.unit) {
                updateData.quantity_unit = calc.unit;
            }
            
            // 如果是未开始状态，自动开始
            if (shouldStart) {
                updateData.status = 'in_progress';
                updateData.actual_start_date = new Date().toISOString().split('T')[0];
            }
            
            const apiResult = await api.processes.update(processId, updateData);
            
            if (apiResult.success) {
                app.closeModal();
                this.showToast(shouldStart ? t('processes.startSuccess') : t('quantities.updateSuccess'));
                
                // 重新加载工序列表
                if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                    await ProjectDetail.loadProcesses();
                }
            } else {
                this.showToast(apiResult.message || '保存失败 Save failed', 'error');
            }
        } catch (error) {
            console.error('Save quantity error:', error);
            this.showToast('保存失败 Save failed: ' + (error.message || '未知错误'), 'error');
        } finally {
            this.hideLoading();
        }
    };
    
    // 统一计算主工程量（保存和实时显示共用）
    // 返回 { value, unit, note }：note 是附带的推算值，仅用于显示
    app.computeQuantity = function(m) {
        const r = { value: 0, unit: '', note: '' };
        if (m.length && m.width && m.depth) {
            // 土方：体积 = 长 × 宽 × 深
            r.value = m.length * m.width * m.depth; r.unit = 'm³';
        } else if (m.area && m.thickness) {
            // 垫层：体积 = 面积 × 厚度（cm 转 m）
            r.value = m.area * (m.thickness / 100); r.unit = 'm³';
        } else if (m.volume) {
            r.value = m.volume; r.unit = 'm³';
        } else if (m.area) {
            r.value = m.area; r.unit = 'm²';
        } else if (m.steps) {
            // 楼梯：按台阶数计量，同时推算水平投影面积
            r.value = m.steps; r.unit = '步';
            if (m.width && m.step_depth) {
                const proj = m.steps * (m.step_depth / 100) * m.width;
                r.note = `水平投影面积 Horizontal projected area ≈ ${proj.toFixed(2)} m²`;
            }
            if (m.step_height) {
                r.note += `${r.note ? ' ｜ ' : ''}总高 Total height ≈ ${(m.steps * m.step_height / 100).toFixed(2)} m`;
            }
        } else if (m.count) {
            r.value = m.count; r.unit = '';
        } else if (m.length) {
            r.value = m.length; r.unit = 'm';
        } else {
            const first = Object.values(m).find(v => v > 0);
            r.value = first || 0;
        }
        return r;
    };
    
    // 通过ID显示工程量输入（新增的包装函数）
    app.showQuantityInputById = async function(processId) {
        // 从缓存的工序列表中查找
        const process = app._currentProcesses.find(p => p.id === processId);
        
        if (!process) {
            console.error('Process not found:', processId);
            this.showToast(t('processes.notFound'), 'error');
            return;
        }
        
        // 调用原有的 showQuantityInput 函数
        await this.showQuantityInput(process);
    };
    
    // 通用工程量输入（用于没有预定义字段的工序）
    app.showGenericQuantityInput = async function(process, fields) {
        const processName = getI18nField(process, 'process_name');
        const processId = process.id;
        
        // 解析现有数据
        let existingMeasurements = {};
        if (process.measurements) {
            try {
                existingMeasurements = typeof process.measurements === 'string' 
                    ? JSON.parse(process.measurements) 
                    : process.measurements;
            } catch (e) {
                console.error('Parse measurements error:', e);
            }
        }
        
        const modal = app.createModal(`工程量 Quantity - ${processName}`, `
            <form id="quantity-form" class="form-vertical">
                <div class="form-hint" style="margin-bottom: 1rem; padding: 10px; background: #eff6ff; border-radius: 0.5rem;">
                    <strong>说明:</strong> 填写工程量数据。${process.status === 'not_started' ? ' 保存后将自动开始此流程 Save will auto-start this process' : ''}
                </div>
                
                <div class="form-group">
                    <label>工程量 *</label>
                    <input type="number" id="qty-quantity" value="${existingMeasurements.quantity || process.planned_quantity || ''}" min="0" step="0.01" required>
                </div>
                
                <div class="form-group">
                    <label>单位 Unit</label>
                    <input type="text" id="qty-unit" value="${process.quantity_unit || existingMeasurements.unit || ''}" ${process.quantity_unit ? 'readonly style="background-color: #f3f4f6; cursor: not-allowed;"' : ''} placeholder="${process.quantity_unit ? '' : t('quantities.unitExample')}">
                    ${process.quantity_unit ? '<small class="form-hint" style="color: #059669;">✓ 已设置标准单位 (不可修改)</small>' : '<small class="form-hint">可选：如 m²、m³、m、个等</small>'}
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">
                        ${t('common.cancel')}
                    </button>
                    <button type="submit" class="btn btn-primary">
                        ${process.status === 'not_started' ? '保存并开始 Save and Start' : '保存 Save'}
                    </button>
                </div>
            </form>
        `);
        
        document.getElementById('quantity-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const quantity = parseFloat(document.getElementById('qty-quantity').value);
            const unit = document.getElementById('qty-unit').value || '';
            
            if (!quantity || quantity <= 0) {
                this.showToast(t('quantities.validQuantityError'), 'error');
                return;
            }
            
            try {
                this.showLoading();
                
                const updateData = {
                    measurements: JSON.stringify({ quantity, unit: process.quantity_unit || unit }),
                    planned_quantity: quantity
                };
                
                // 只在数据库没有单位时才设置单位
                if (!process.quantity_unit && unit) {
                    updateData.quantity_unit = unit;
                }
                
                // 如果是未开始状态，自动开始
                if (process.status === 'not_started') {
                    updateData.status = 'in_progress';
                    updateData.actual_start_date = new Date().toISOString().split('T')[0];
                }
                
                const result = await api.processes.update(processId, updateData);
                
                if (result.success) {
                    app.closeModal();
                    this.showToast(process.status === 'not_started' ? t('processes.startSuccess') : t('quantities.updateSuccess'));
                    
                    if (typeof ProjectDetail !== 'undefined' && ProjectDetail.projectId) {
                        await ProjectDetail.loadProcesses();
                    }
                }
            } catch (error) {
                console.error('Save generic quantity error:', error);
                this.showToast('保存失败 Save failed', 'error');
            } finally {
                this.hideLoading();
            }
        });
    };
