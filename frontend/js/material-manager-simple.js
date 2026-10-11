// Material Manager (Simplified)
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
                app.showToast(response.message || t('common.loadError'), 'error');
            }
        } catch (error) {
            console.error('Load materials error:', error);
            app.showToast(t('materials.loadError'), 'error');
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
                    <h3>${t('materials.noMaterials')}</h3>
                    <p>${t('materials.noMaterialsDesc')}</p>
                    <button class="btn btn-primary" onclick="MaterialManager.showAddForm()">
                        + ${t('materials.addMaterial')}
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
        // Parse JSON fields
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
        const displayName = (materialName && materialName[currentLang]) || (materialName && materialName.zh) || material.material_code || t('materials.unnamed');
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
                        <span class="label">${t('materials.purchased')}:</span>
                        <span class="value">${purchaseQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat">
                        <span class="label">${t('materials.received')}:</span>
                        <span class="value">${receivedQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat">
                        <span class="label">${t('materials.used')}:</span>
                        <span class="value">${usedQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat highlight">
                        <span class="label">${t('materials.stock')}:</span>
                        <span class="value">${stock} ${displayUnit}</span>
                    </div>
                </div>
            </div>
        `;
    },

    showAddForm() {
        app.showToast(t('materials.addFromLibrary'), 'info');
    }
};

// Expose to global
window.MaterialManager = MaterialManager;

console.log('✓ Material Manager Loaded');
