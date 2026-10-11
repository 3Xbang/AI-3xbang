// Material Manager (Simplified)

// 双语文本定义 (中文 + 泰语)
const MaterialTexts = {
    loadError: '加载失败 โหลดไม่สำเร็จ',
    loadMaterialsError: '加载材料列表失败 โหลดรายการวัสดุไม่สำเร็จ',
    noMaterials: '还没有材料记录 ยังไม่มีข้อมูลวัสดุ',
    noMaterialsDesc: '开始添加项目所需的材料 เริ่มเพิ่มวัสดุสำหรับโครงการ',
    addMaterial: '添加材料 เพิ่มวัสดุ',
    materialList: '材料列表 รายการวัสดุ',
    unnamed: '未命名 ไม่มีชื่อ',
    purchased: '采购 สั่งซื้อ',
    received: '到货 เข้าคลัง',
    used: '已用 ใช้แล้ว',
    stock: '库存 คงเหลือ',
    addFromLibrary: '材料添加功能开发中，请从材料库中选择<br>ฟีเจอร์เพิ่มวัสดุกำลังพัฒนา กรุณาเลือกจากคลังวัสดุ'
};

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
                app.showToast(response.message || t.loadError, 'error');
            }
        } catch (error) {
            console.error('Load materials error:', error);
            app.showToast(t.loadMaterialsError, 'error');
        } finally {
            app.hideLoading();
        }
    },

    render() {
        const t = MaterialTexts;
        const container = document.getElementById('materials-container');
        if (!container) {
            console.error('Materials container not found');
            return;
        }

        if (this.materials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <h3>暂无材料 ยังไม่มีวัสดุ</h3>
                    <p>请添加项目材料开始管理 โปรดเพิ่มวัสดุโครงการ</p>
                    <button class="btn btn-primary" onclick="MaterialManager.showAddForm()">
                        + 添加材料 เพิ่มวัสดุ
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
        const t = MaterialTexts;
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
        const displayName = (materialName && materialName[currentLang]) || (materialName && materialName.zh) || material.material_code || t.unnamed;
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
                        <span class="label">已采购 ซื้อแล้ว:</span>
                        <span class="value">${purchaseQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat">
                        <span class="label">已到货 ได้รับแล้ว:</span>
                        <span class="value">${receivedQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat">
                        <span class="label">已使用 ใช้แล้ว:</span>
                        <span class="value">${usedQty} ${displayUnit}</span>
                    </div>
                    <div class="material-stat highlight">
                        <span class="label">库存 คงเหลือ:</span>
                        <span class="value">${stock} ${displayUnit}</span>
                    </div>
                </div>
            </div>
        `;
    },

    showAddForm() {
        const t = MaterialTexts;
        app.showToast(t.addFromLibrary, 'info');
    }
};

// Expose to global
window.MaterialManager = MaterialManager;

console.log('✓ Material Manager Loaded');
