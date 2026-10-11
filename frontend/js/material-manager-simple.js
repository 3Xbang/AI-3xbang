// 简化版材料管理
const MaterialManager = {
    currentProjectId: null,
    materials: [],

    init(projectId) {
        this.currentProjectId = projectId;
        this.loadMaterials();
    },

    async loadMaterials() {
        try {
            app.showLoading();
            const response = await api.materials.getList(this.currentProjectId);
            
            if (response.success) {
                this.materials = response.data || [];
                this.render();
            } else {
                app.showToast(response.message || '加载失败', 'error');
            }
        } catch (error) {
            console.error('Load materials error:', error);
            app.showToast('加载材料列表失败', 'error');
        } finally {
            app.hideLoading();
        }
    },

    render() {
        const container = document.getElementById('materials-container');
        if (!container) {
            console.error('Materials container not found');
            return;
        }

        if (this.materials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>还没有材料记录</h3>
                    <p>开始添加项目所需的材料</p>
                    <button class="btn btn-primary" onclick="MaterialManager.showAddForm()">
                        + 添加材料
                    </button>
                </div>
            `;
            return;
        }

        const html = `
            <div class="materials-header">
                <h3>材料列表 (${this.materials.length})</h3>
                <button class="btn btn-primary" onclick="MaterialManager.showAddForm()">
                    + 添加材料
                </button>
            </div>
            <div class="materials-list">
                ${this.materials.map(m => this.renderMaterialCard(m)).join('')}
            </div>
        `;
        container.innerHTML = html;
    },

    renderMaterialCard(material) {
        // 解析JSON字段
        let materialName = material.material_name;
        let unit = material.unit;
        
        if (typeof materialName === 'string') {
            try {
                materialName = JSON.parse(materialName);
            } catch (e) {}
        }
        if (typeof unit === 'string') {
            try {
                unit = JSON.parse(unit);
            } catch (e) {}
        }
        
        const currentLang = localStorage.getItem('language') || 'zh';
        const displayName = (materialName && materialName[currentLang]) || (materialName && materialName.zh) || material.material_code || '未命名';
        const displayUnit = (unit && unit[currentLang]) || (unit && unit.zh) || '';

        const purchaseQty = parseFloat(material.purchase_quantity || 0);
        const receivedQty = parseFloat(material.received_quantity || 0);
        const usedQty = parseFloat(material.used_quantity || 0);
        const stock = receivedQty - usedQty;

        return `
            <div class="material-card">
                <div class="material-card-header">
                    <h4>${displayName}</h4>
                    <span class="material-code">${material.material_code || ''}</span>
                </div>
                <div class="material-card-body">
                    <div class="material-stat">
                        <span class="label">采购:</span>
                        <span class="value">${purchaseQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat">
                        <span class="label">到货:</span>
                        <span class="value">${receivedQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat">
                        <span class="label">已用:</span>
                        <span class="value">${usedQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat highlight">
                        <span class="label">库存:</span>
                        <span class="value">${stock} ${displayUnit}</span>
                    </div>
                </div>
            </div>
        `;
    },

    showAddForm() {
        app.showToast('材料添加功能开发中，请从材料库中选择', 'info');
    }
};

// 暴露到全局
window.MaterialManager = MaterialManager;

console.log('✓ 简化版材料管理已加载');
