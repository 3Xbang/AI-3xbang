// 工序卡片渲染函数 v2.0 - 优化版本
// Process Card Rendering v2.0 - Optimized Version

function renderProcessCardV2(process) {
    const statusClass = process.status || 'not_started';
    const statusText = getStatusText(statusClass);
    const percentage = Math.round(process.completion_percentage || 0);
    
    // 确定主要操作按钮
    let primaryAction = '';
    if (statusClass === 'not_started') {
        primaryAction = `
            <button class="primary-action" onclick="app.startProcess(${process.id})">
                <span>▶️</span>
                <span>开始工序 เริ่มกระบวนการ</span>
            </button>
        `;
    } else if (statusClass === 'in_progress') {
        primaryAction = `
            <button class="primary-action" onclick="app.showUpdateProgress(${process.id}, ${percentage})">
                <span>📈</span>
                <span>更新进度 อัปเดตความคืบหน้า</span>
            </button>
        `;
    } else if (statusClass === 'completed') {
        primaryAction = `
            <div class="status-badge">
                <span>✅</span>
                <span>已完成 เสร็จสิ้น</span>
            </div>
        `;
    }
    
    // 次要操作按钮
    const secondaryActions = [];
    
    // 工程量按钮
    secondaryActions.push(`
        <button class="secondary-action" onclick="app.showQuantityInputById(${process.id})">
            <span>📊</span>
            <span>工程量</span>
        </button>
    `);
    
    // 子任务按钮
    secondaryActions.push(`
        <button class="secondary-action" onclick="app.toggleSubtasksInline(${process.id})">
            <span>📋</span>
            <span>子任务</span>
        </button>
    `);
    
    // 管理员权限按钮
    if (PermissionManager.canManageProjects()) {
        secondaryActions.push(`
            <button class="secondary-action" onclick="ProcessScheduling.showDependencyManager(${process.id}, '${getI18nField(process, 'process_name').replace(/'/g, "\\'")}')">
                <span>🔗</span>
                <span>依赖</span>
            </button>
        `);
        
        secondaryActions.push(`
            <button class="secondary-action" onclick="ProcessScheduling.showProcessSchedule(${process.id}, '${getI18nField(process, 'process_name').replace(/'/g, "\\'")}')">
                <span>📅</span>
                <span>计划</span>
            </button>
        `);
    }
    
    // 暂停/完成按钮（进行中时显示）
    if (statusClass === 'in_progress') {
        secondaryActions.push(`
            <button class="secondary-action" onclick="app.pauseProcess(${process.id})">
                <span>⏸️</span>
                <span>暂停</span>
            </button>
        `);
        
        secondaryActions.push(`
            <button class="secondary-action" onclick="app.completeProcess(${process.id})">
                <span>✅</span>
                <span>完成</span>
            </button>
        `);
    }
    
    // 计划日期信息
    let dateInfo = '';
    if (process.planned_start_date && process.planned_end_date) {
        const startDate = new Date(process.planned_start_date).toLocaleDateString('zh-CN', {month:'short', day:'numeric'});
        const endDate = new Date(process.planned_end_date).toLocaleDateString('zh-CN', {month:'short', day:'numeric'});
        const duration = process.planned_duration || '-';
        dateInfo = `
            <div class="info-item">
                <span class="info-icon">📅</span>
                <div class="info-content">
                    <div class="info-label">计划日期 กำหนดการ</div>
                    <div class="info-value">${startDate} → ${endDate} (${duration}天)</div>
                </div>
            </div>
        `;
    }
    
    // 工程量信息
    let quantityInfo = '';
    if (process.planned_quantity && process.quantity_unit) {
        quantityInfo = `
            <div class="info-item">
                <span class="info-icon">📊</span>
                <div class="info-content">
                    <div class="info-label">工程量 ปริมาณงาน</div>
                    <div class="info-value">${process.planned_quantity} ${process.quantity_unit}</div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="process-card status-${statusClass}" id="process-${process.id}">
            <!-- 状态条 -->
            <div class="process-card-status-bar"></div>
            
            <!-- 卡片内容 -->
            <div class="process-card-content">
                <!-- 头部：代码和标题 -->
                <div class="process-card-header">
                    <div class="process-code-badge">${process.process_code}</div>
                    <h3 class="process-card-title">${getI18nField(process, 'process_name')}</h3>
                    <p class="process-card-title-bilingual">${getI18nField(process, 'process_name', true)}</p>
                </div>
                
                <!-- 进度条 -->
                <div class="process-card-progress">
                    <div class="progress-header">
                        <span class="progress-label">完成度 ความคืบหน้า</span>
                        <span class="progress-percentage">${percentage}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                
                <!-- 关键信息 -->
                ${(dateInfo || quantityInfo) ? `
                    <div class="process-card-info">
                        ${dateInfo}
                        ${quantityInfo}
                    </div>
                ` : ''}
                
                <!-- 操作按钮 -->
                <div class="process-card-actions">
                    ${primaryAction}
                    <div class="secondary-actions">
                        ${secondaryActions.join('')}
                    </div>
                </div>
            </div>
            
            <!-- 子任务展开区域 -->
            <div class="process-subtasks-area" id="subtasks-area-${process.id}" style="display: none;">
                <div class="loading-subtasks">加载中... กำลังโหลด...</div>
            </div>
        </div>
    `;
}

// 帮助函数：获取双语字段
function getI18nField(obj, fieldName, showBoth = false) {
    const zhField = obj[fieldName + '_zh'] || obj[fieldName];
    const thField = obj[fieldName + '_th'] || obj[fieldName];
    
    if (showBoth && zhField && thField && zhField !== thField) {
        return `${zhField} / ${thField}`;
    }
    
    return zhField || thField || '';
}
