// 工程量设置功能
// Project Quantities Management

if (typeof app !== 'undefined') {
    // 显示工程量设置表单
    app.showQuantitiesForm = async function(projectId) {
        try {
            this.showLoading();
            
            // 获取当前工程量
            const result = await api.getProjectQuantities(projectId);
            
            if (!result.success) {
                this.showToast('加载失败', 'error');
                return;
            }
            
            const quantities = result.data || [];
            
            const modal = this.createModal('设置工程量', `
                <form id="quantities-form">
                    <div style="max-height: 500px; overflow-y: auto; margin-bottom: 1rem;">
                        <p style="color: #6b7280; margin-bottom: 1rem;">
                            📋 请根据设计图纸填写每个工序的计划工程量。这将用于计算进度、材料和工期。
                        </p>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">工序</th>
                                    <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 150px;">计划数量</th>
                                    <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #e5e7eb; width: 80px;">单位</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quantities.map((q, index) => `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 0.75rem;">
                                            <strong>${q.process_code}</strong><br>
                                            <span style="color: #6b7280; font-size: 0.875rem;">${getI18nField(q, 'process_name')}</span>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                min="0"
                                                name="${q.process_code}"
                                                value="${q.planned_quantity || ''}"
                                                placeholder="0"
                                                style="width: 120px; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; text-align: center;"
                                                ${index === 0 ? 'autofocus' : ''}
                                            >
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center; color: #6b7280;">
                                            ${getUnitText(q.unit)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">取消</button>
                        <button type="submit" class="btn-primary">保存工程量</button>
                    </div>
                </form>
            `);
            
            document.getElementById('quantities-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveProjectQuantities(projectId);
            });
            
            this.hideLoading();
        } catch (error) {
            this.showToast('加载失败', 'error');
            this.hideLoading();
        }
    };
    
    // 保存工程量
    app.saveProjectQuantities = async function(projectId) {
        const form = document.getElementById('quantities-form');
        const formData = new FormData(form);
        
        const quantities = {};
        for (const [key, value] of formData.entries()) {
            const num = parseFloat(value);
            if (!isNaN(num) && num > 0) {
                quantities[key] = num;
            }
        }
        
        if (Object.keys(quantities).length === 0) {
            this.showToast('请至少填写一个工序的工程量', 'error');
            return;
        }
        
        try {
            this.showLoading();
            const result = await api.setProjectQuantities(projectId, quantities);
            
            if (result.success) {
                this.closeModal();
                this.showToast(result.message || '工程量设置成功');
                // 刷新工序列表
                this.loadProcesses(projectId);
            }
        } catch (error) {
            this.showToast('保存失败', 'error');
        } finally {
            this.hideLoading();
        }
    };
}

// 添加API方法
if (typeof api !== 'undefined') {
    api.getProjectQuantities = (projectId) => apiRequest(`/api/projects/${projectId}/quantities`);
    
    api.setProjectQuantities = (projectId, quantities) => apiRequest(`/api/projects/${projectId}/set-quantities`, {
        method: 'POST',
        body: JSON.stringify({ quantities })
    });
}

console.log('✓ 工程量管理功能已加载');
