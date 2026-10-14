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
            // Sort ASC by date so we see chronological order
            const r = await apiRequest('/api/purchase-records?limit=300&project_id=' + this.currentProjectId);
            const rows = (r.data || []).sort((a,b)=>(a.purchase_date||'').localeCompare(b.purchase_date||''));
            if (!rows.length) {
                box.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8">
                    <div style="font-size:40px;margin-bottom:8px">🧾</div>
                    <div>ยังไม่มีใบเสร็จ 还没有收据记录</div>
                    <div style="font-size:13px;margin-top:6px">อัปโหลด CSV 上传CSV文件</div>
                </div>`;
                return;
            }

            const esc = s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
            const fmt = n=>Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:0,maximumFractionDigits:0});
            const fmt2 = n=>Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});

            // Group by date
            const groups = {};
            rows.forEach(r => {
                const d = (r.purchase_date||'').slice(0,10);
                if (!groups[d]) groups[d] = [];
                groups[d].push(r);
            });

            const totalAmt = rows.reduce((s,r)=>s+Number(r.total_price||0),0);

            // Summary bar
            let html = `<div style="background:#f8fafc;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#475569;display:flex;gap:20px;flex-wrap:wrap">
                <span>📋 <b style="color:#1e3a8a">${rows.length}</b> รายการ 条记录</span>
                <span>📅 <b style="color:#1e3a8a">${Object.keys(groups).length}</b> วัน 天</span>
                <span>💰 รวม <b style="color:#1e3a8a">฿${fmt(totalAmt)}</b></span>
            </div>`;

            // Table with date groups
            html += `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#f8fafc">
                <th style="padding:9px 14px;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569;white-space:nowrap">Invoice</th>
                <th style="padding:9px 14px;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569">ผู้ขาย 供货商</th>
                <th style="padding:9px 14px;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569">รายการ 品名</th>
                <th style="padding:9px 14px;border-bottom:2px solid #e2e8f0;text-align:right;color:#475569;white-space:nowrap">จำนวน 数量</th>
                <th style="padding:9px 14px;border-bottom:2px solid #e2e8f0;text-align:right;color:#475569;white-space:nowrap">ราคา/หน่วย ฿</th>
                <th style="padding:9px 14px;border-bottom:2px solid #e2e8f0;text-align:right;color:#475569;white-space:nowrap">รวม ฿</th>
              </tr></thead>
              <tbody>`;

            // Alternating soft background per date group
            const groupBgs = ['#ffffff','#fafbfc'];
            let gIdx = 0;

            Object.keys(groups).sort().forEach(date => {
                const dayRows = groups[date];
                const dayTotal = dayRows.reduce((s,r)=>s+Number(r.total_price||0),0);
                const bg = groupBgs[gIdx % 2];
                gIdx++;

                // Format date nicely: 2026-06-13 → 13 มิ.ย. 2026
                const [y,m,d2] = (date||'').split('-');
                const thMonths = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
                const dateLabel = (y&&m&&d2) ? `${parseInt(d2)} ${thMonths[parseInt(m)]||m} ${y}` : date;

                // Date group header row
                html += `<tr>
                  <td colspan="6" style="padding:7px 14px;background:${bg};border-top:1.5px solid #e2e8f0;border-bottom:1px solid #edf0f3">
                    <span style="font-weight:700;color:#334155;font-size:13px">📅 ${dateLabel}</span>
                    <span style="color:#94a3b8;font-size:12px;margin-left:8px">${dayRows.length} รายการ</span>
                    <span style="float:right;color:#475569;font-size:12px">฿${fmt(dayTotal)}</span>
                  </td>
                </tr>`;

                // Day's rows
                dayRows.forEach((r, i) => {
                    const isLast = (i === dayRows.length-1);
                    const borderBottom = isLast ? '1px solid #e8ebef' : '1px solid #f1f3f5';
                    const total = Number(r.total_price||0);
                    const isCredit = total < 0;
                    html += `<tr style="background:${bg}">
                      <td style="padding:8px 14px;border-bottom:${borderBottom};font-family:monospace;font-size:11px;color:#64748b">${esc(r.invoice_no||'')}</td>
                      <td style="padding:8px 14px;border-bottom:${borderBottom}">${esc(r.supplier_name||'')}</td>
                      <td style="padding:8px 14px;border-bottom:${borderBottom}">
                        <div style="font-size:13px;color:#1e293b">${esc(r.item_name_th||'')}</div>
                        ${r.item_name_cn?`<div style="font-size:11px;color:#94a3b8">${esc(r.item_name_cn)}</div>`:''}
                      </td>
                      <td style="padding:8px 14px;border-bottom:${borderBottom};text-align:right;font-size:12px;color:#475569">${r.qty!=null&&r.qty!=0?r.qty+' '+(r.unit||''):''}</td>
                      <td style="padding:8px 14px;border-bottom:${borderBottom};text-align:right;font-size:12px;color:#475569">${r.unit_price>0?'฿'+fmt2(r.unit_price):'—'}</td>
                      <td style="padding:8px 14px;border-bottom:${borderBottom};text-align:right;font-weight:600;color:${isCredit?'#10b981':'#1e3a8a'}">฿${fmt(total)}</td>
                    </tr>`;
                });
            });

            // Grand total
            html += `<tr style="background:#f8fafc">
              <td colspan="5" style="padding:9px 14px;border-top:2px solid #e2e8f0;text-align:right;font-weight:700;color:#475569">ยอดรวม 合计</td>
              <td style="padding:9px 14px;border-top:2px solid #e2e8f0;text-align:right;font-weight:700;color:#1e3a8a;font-size:15px">฿${fmt(totalAmt)}</td>
            </tr>`;

            html += `</tbody></table></div>`;
            box.innerHTML = html;
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
