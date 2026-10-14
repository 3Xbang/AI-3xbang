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
        if (!container) return;

        container.innerHTML = `
            <!-- Upload button + sub tabs -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <div style="display:flex;gap:6px;background:#fff;border-radius:10px;padding:5px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
                    <button class="mm-tab active" id="mm-tab-receipts" onclick="MaterialManager.showTab('receipts')">🧾 ใบเสร็จ 收据明细</button>
                    <button class="mm-tab" id="mm-tab-materials" onclick="MaterialManager.showTab('materials')">📦 วัสดุ 材料管理</button>
                </div>
                <label style="background:#2563eb;color:#fff;border-radius:10px;padding:9px 16px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px" title="อัปโหลด CSV ใบเสร็จ">
                    📤 <span>อัปโหลดใบเสร็จ 上传收据</span>
                    <input type="file" accept=".csv" id="mm-upload-csv" style="display:none" onchange="MaterialManager.uploadReceipts(this)">
                </label>
            </div>
            <div id="mm-upload-status"></div>
            <div id="mm-tab-content"></div>
            <style>
              .mm-tab{padding:8px 14px;border:none;border-radius:8px;cursor:pointer;font-size:13px;background:transparent;color:#475569}
              .mm-tab.active{background:#2563eb;color:#fff;font-weight:700}
              .mm-tab:hover:not(.active){background:#f1f5f9}
            </style>`;

        MaterialManager.showTab('receipts');
    },

    activeTab: 'receipts',
    showTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.mm-tab').forEach(b => b.classList.toggle('active', b.id === 'mm-tab-' + tab));
        const box = document.getElementById('mm-tab-content');
        if (!box) return;
        if (tab === 'receipts') this.renderReceipts(box);
        else this.renderMaterials(box);
    },

    async renderReceipts(box) {
        box.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b">กำลังโหลด... 加载中</div>';
        try {
            const r = await apiRequest('/api/purchase-records?limit=200&project_id=' + this.currentProjectId);
            const rows = (r.data || []);
            if (!rows.length) {
                box.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8">
                    <div style="font-size:40px;margin-bottom:8px">🧾</div>
                    <div>ยังไม่มีใบเสร็จ 还没有收据记录</div>
                    <div style="font-size:13px;margin-top:6px">อัปโหลด CSV เพื่อเริ่มต้น · 上传CSV收据文件开始使用</div>
                </div>`;
                return;
            }
            const totalAmt = rows.reduce((s,r)=>s+Number(r.total_price||0),0);
            box.innerHTML = `
              <div style="background:#f0f9ff;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;display:flex;gap:20px;flex-wrap:wrap">
                <span>📋 <b>${rows.length}</b> รายการ</span>
                <span>💰 รวม <b>฿${Number(totalAmt).toLocaleString('th-TH',{minimumFractionDigits:0})}</b></span>
              </div>
              <div style="overflow-x:auto;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#f8fafc">
                  <th style="padding:9px 12px;border-bottom:2px solid #e2e8f0;white-space:nowrap">วันที่ 日期</th>
                  <th style="padding:9px 12px;border-bottom:2px solid #e2e8f0">Invoice</th>
                  <th style="padding:9px 12px;border-bottom:2px solid #e2e8f0">ผู้ขาย 供货商</th>
                  <th style="padding:9px 12px;border-bottom:2px solid #e2e8f0">รายการ 品名</th>
                  <th style="padding:9px 12px;border-bottom:2px solid #e2e8f0;text-align:right">จำนวน</th>
                  <th style="padding:9px 12px;border-bottom:2px solid #e2e8f0;text-align:right">ราคา/หน่วย ฿</th>
                  <th style="padding:9px 12px;border-bottom:2px solid #e2e8f0;text-align:right">รวม ฿</th>
                </tr></thead>
                <tbody>
                ${rows.map(r => {
                    const esc = s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
                    const fmt = n=>Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:0});
                    const isDeduct = ['Machinery','Service','Transport','Consumable'].includes(r.item_category);
                    const bg = isDeduct ? 'background:#fffbeb' : '';
                    return `<tr style="${bg};border-bottom:1px solid #f1f5f9">
                      <td style="padding:8px 12px;white-space:nowrap;font-size:12px">${esc(r.purchase_date||'').slice(0,10)}</td>
                      <td style="padding:8px 12px;font-family:monospace;font-size:11px;color:#64748b">${esc(r.invoice_no||'')}</td>
                      <td style="padding:8px 12px">${esc(r.supplier_name||'')}</td>
                      <td style="padding:8px 12px">
                        <div style="font-size:13px">${esc(r.item_name_th||'')}</div>
                        <div style="font-size:11px;color:#94a3b8">${esc(r.item_name_cn||'')}</div>
                        ${isDeduct?`<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;font-size:10px">🚫 ${esc(r.item_category)}</span>`:''}
                      </td>
                      <td style="padding:8px 12px;text-align:right;font-size:12px">${r.qty||''} ${esc(r.unit||'')}</td>
                      <td style="padding:8px 12px;text-align:right">${r.unit_price>0?'฿'+Number(r.unit_price).toLocaleString('th-TH',{minimumFractionDigits:2}):'—'}</td>
                      <td style="padding:8px 12px;text-align:right;font-weight:600;color:${Number(r.total_price)<0?'#10b981':'#1e3a8a'}">฿${fmt(r.total_price)}</td>
                    </tr>`;
                }).join('')}
                <tr style="background:#f8fafc;font-weight:700">
                  <td colspan="6" style="padding:8px 12px;text-align:right">ยอดรวม 合计</td>
                  <td style="padding:8px 12px;text-align:right;color:#1e3a8a">฿${Number(totalAmt).toLocaleString('th-TH',{minimumFractionDigits:0})}</td>
                </tr>
                </tbody>
              </table></div>`;
        } catch(e) {
            box.innerHTML = `<div style="color:#dc2626;padding:12px">${e.message}</div>`;
        }
    },

    renderMaterials(box) {
        const t = MaterialTexts;
        if (this.materials.length === 0) {
            box.innerHTML = `<div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>暂无材料 ยังไม่มีวัสดุ</h3>
                <p>请添加项目材料开始管理 โปรดเพิ่มวัสดุโครงการ</p>
                <button class="btn btn-primary" onclick="MaterialManager.showAddForm()">+ 添加材料 เพิ่มวัสดุ</button>
            </div>`;
            return;
        }
        box.innerHTML = `<div class="materials-header">
            <h3>材料列表 (${this.materials.length})</h3>
            <button class="btn btn-primary" onclick="MaterialManager.showAddForm()">+ 添加材料</button>
        </div>
        <div class="materials-list">${this.materials.map(m => this.renderMaterialCard(m)).join('')}</div>`;
    },

    async uploadReceipts(input) {
        const file = input.files[0];
        if (!file) return;
        const statusBox = document.getElementById('mm-upload-status');
        if (statusBox) statusBox.innerHTML = '<div style="padding:8px 12px;color:#2563eb;font-size:13px">⏳ กำลังนำเข้า... 导入中...</div>';
        try {
            if (typeof app !== 'undefined') app.showLoading();
            const fd = new FormData();
            fd.append('csv', file);
            fd.append('project_id', this.currentProjectId);
            const r = await fetch(window.location.origin + '/api/purchase-records/import-csv', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + localStorage.getItem('authToken') },
                body: fd
            });
            const j = await r.json();
            if (typeof app !== 'undefined') app.hideLoading();
            if (!j.success) throw new Error(j.message);
            const d = j.data;
            if (statusBox) statusBox.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;color:#166534">
                ✅ นำเข้าสำเร็จ ${d.imported} รายการ · ${d.suppliers_created} ผู้ขายใหม่ · ${d.items_created} รายการใหม่ · 导入 ${d.imported} 条
            </div>`;
            // Refresh receipt view
            this.activeTab = 'receipts';
            document.querySelectorAll('.mm-tab').forEach(b => b.classList.toggle('active', b.id === 'mm-tab-receipts'));
            const box = document.getElementById('mm-tab-content');
            if (box) this.renderReceipts(box);
            // Clear input for reuse
            input.value = '';
        } catch(e) {
            if (typeof app !== 'undefined') app.hideLoading();
            const statusBox = document.getElementById('mm-upload-status');
            if (statusBox) statusBox.innerHTML = `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:10px;color:#dc2626;font-size:13px;margin-bottom:10px">❌ ${e.message}</div>`;
        }
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
