// 项目卡片增强 - 添加工程量设置按钮

if (typeof app !== 'undefined') {
    // 保存原始函数
    app._originalRenderProjects = app.renderProjects;
    
    // 替换renderProjects函数
    app.renderProjects = function(projects) {
        const container = document.getElementById('projects-list');
        if (projects.length === 0) {
            container.innerHTML = `<p class="empty-state">${t('projects.empty', currentLang)}</p>`;
            return;
        }

        container.innerHTML = projects.map(project => `
            <div class="project-card" style="cursor: default;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 0.5rem;">${getI18nField(project, 'name')}</h4>
                        <div class="project-info">
                            <span><strong>${t('projects.location')}:</strong> ${getI18nField(project, 'location') || '-'}</span>
                            <span><strong>${t('projects.progress')}:</strong> ${project.progress || 0}%</span>
                        </div>
                    </div>
                    <button 
                        class="btn-sm btn-primary" 
                        onclick="app.showQuantitiesForm(${project.id}); event.stopPropagation();"
                        style="flex-shrink: 0; margin-left: 1rem;">
                        📊 设置工程量
                    </button>
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
    };
}

console.log('✓ 项目卡片增强已加载');
