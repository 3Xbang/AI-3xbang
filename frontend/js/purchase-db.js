// purchase-db.js — 采购价格参考数据库
const PurchaseDB = {
    projectId: null,
    activeTab: 'import',

    init(projectId) {
        this.projectId = projectId;
        this.render();
    },

    esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
    fmt(n, d=2) { return n==null||n===''?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}); },
    fmtDate(s) { return s ? String(s).slice(0,10) : '—'; },

    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        box.innerHTML = `
        <div style="padding:16px;max-width:1400px;margin:0 auto">
          <div class="td-head">
            <div>
              <h2 class="td-title">📊 ฐานข้อมูลราคาจัดซื้อ <small class="td-th">采购价格参考库</small></h2>
              <div class="td-sub">บันทึกราคาจากผู้ขายและรายการวัสดุ สร้างมาตรฐานราคาอ้างอิง · 积累价格数据，建立采购标准参考</div>
            </div>
          </div>

          <!-- Tab bar -->
          <div style="display:flex;gap:4px;margin-bottom:16px;background:#fff;border-radius:12px;padding:6px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            ${['import','prices','suppliers'].map(t => {
              const labels={import:'📥 นำเข้า 导入',prices:'💰 ฐานราคา 价格库',suppliers:'🏢 ผู้ขาย 供货商'};
              return `<button class="pdb-tab ${this.activeTab===t?'active':''}" data-tab="${t}" onclick="PurchaseDB.switchTab('${t}')">${labels[t]}</button>`;
            }).join('')}
          </div>

          <!-- Tab content -->
          <div id="pdb-content"></div>
        </div>

        <style>
          .pdb-tab{flex:1;padding:10px;border:none;border-radius:8px;cursor:pointer;font-size:14px;background:transparent;color:#475569;transition:.15s}
          .pdb-tab.active{background:#2563eb;color:#fff;font-weight:700}
          .pdb-tab:hover:not(.active){background:#f1f5f9}
          .pdb-card{background:#fff;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
          .pdb-table{width:100%;border-collapse:collapse;font-size:13px}
          .pdb-table th{background:#f8fafc;padding:9px 12px;border-bottom:2px solid #e2e8f0;text-align:left;white-space:nowrap;color:#475569}
          .pdb-table td{padding:9px 12px;border-bottom:1px solid #f1f5f9}
          .pdb-table tr:hover td{background:#fafbff}
          .pdb-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
          .pdb-kpi{background:#fff;border-radius:12px;padding:14px 16px;border-left:4px solid #2563eb;box-shadow:0 1px 4px rgba(0,0,0,.06)}
          .pdb-kpi-n{font-size:1.6rem;font-weight:700;color:#1e3a8a}
          .pdb-kpi-l{font-size:12px;color:#64748b;margin-top:2px}
          .price-bar-wrap{display:flex;align-items:center;gap:6px;min-width:120px}
          .price-bar{height:6px;border-radius:3px;background:#3b82f6;flex:0 0 auto}
        </style>`;
        this.loadTab();
    },

    switchTab(t) {
        this.activeTab = t;
        document.querySelectorAll('.pdb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab===t));
        this.loadTab();
    },

    loadTab() {
        if (this.activeTab === 'import')    this.renderImport();
        if (this.activeTab === 'prices')    this.renderPrices();
        if (this.activeTab === 'suppliers') this.renderSuppliers();
    },

    // ═══ TAB 1: Import ═══
    renderImport() {
        document.getElementById('pdb-content').innerHTML = `
          <!-- CSV Drop zone -->
          <div class="pdb-card" id="pdb-drop" style="border:2.5px dashed #94a3b8;text-align:center;cursor:pointer;transition:.2s" onclick="document.getElementById('pdb-csv').click()">
            <div style="font-size:36px;margin-bottom:8px">📂</div>
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">อัปโหลด purchase_records.csv</div>
            <div style="font-size:13px;color:#64748b">คลิกหรือลากไฟล์มาวาง · 点击或拖放CSV文件</div>
            <input type="file" id="pdb-csv" accept=".csv" style="display:none">
          </div>
          <div id="pdb-import-result"></div>

          <!-- Manual add -->
          <div class="pdb-card">
            <div style="font-weight:700;color:#1e3a8a;font-size:15px;margin-bottom:12px">✏️ บันทึกรายการเดี่ยว <small style="color:#64748b;font-weight:400">手动添加单笔</small></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">วันที่ 日期</div><input type="date" id="pdb-m-date" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">เลขที่ใบเสร็จ 单据号</div><input type="text" id="pdb-m-inv" placeholder="IN-001" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">ผู้ขาย 供货商 *</div><input type="text" id="pdb-m-supp" placeholder="Fa Thawee Porn" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">ประเภท 分类</div>
                <select id="pdb-m-cat" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px">
                  <option value="">เลือก...</option>
                  ${['Rebar','Concrete','Precast','Block','Cement','Aggregate','PVC','Steel','Transport','Service','Machinery','Consumable','Misc'].map(c=>`<option>${c}</option>`).join('')}
                </select>
              </div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">ชื่อ(ไทย) 泰文品名</div><input type="text" id="pdb-m-nth" placeholder="เหล็ก DB16" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">ชื่อ(จีน) 中文品名 *</div><input type="text" id="pdb-m-ncn" placeholder="DB16螺纹钢" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">จำนวน 数量</div><input type="number" id="pdb-m-qty" placeholder="0" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">หน่วย 单位</div><input type="text" id="pdb-m-unit" placeholder="เส้น / kg" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
              <div><div style="font-size:12px;color:#64748b;margin-bottom:3px">ราคา/หน่วย 单价 ฿</div><input type="number" id="pdb-m-price" placeholder="0.00" step="0.01" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px"></div>
            </div>
            <div style="margin-top:12px">
              <button class="sb-btn primary" onclick="PurchaseDB.addManual()">✅ บันทึก 保存</button>
            </div>
          </div>`;

        this._bindDrop();
    },

    _bindDrop() {
        const drop = document.getElementById('pdb-drop');
        if (!drop) return;
        drop.ondragover = e => { e.preventDefault(); drop.style.borderColor='#2563eb'; drop.style.background='#eff6ff'; };
        drop.ondragleave = () => { drop.style.borderColor=''; drop.style.background=''; };
        drop.ondrop = e => { e.preventDefault(); drop.style.borderColor=''; drop.style.background=''; this._uploadCSV(e.dataTransfer.files[0]); };
        document.getElementById('pdb-csv').onchange = e => this._uploadCSV(e.target.files[0]);
    },

    async _uploadCSV(file) {
        if (!file) return;
        const res = document.getElementById('pdb-import-result');
        res.innerHTML = '<div style="padding:12px;color:#2563eb">⏳ กำลังนำเข้า... 导入中...</div>';
        try {
            if (typeof app !== 'undefined') app.showLoading();
            const fd = new FormData();
            fd.append('csv', file);
            if (this.projectId) fd.append('project_id', this.projectId);
            const r = await fetch(window.location.origin + '/api/purchase-records/import-csv', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + localStorage.getItem('authToken') },
                body: fd
            });
            const j = await r.json();
            if (typeof app !== 'undefined') app.hideLoading();
            if (!j.success) throw new Error(j.message);
            const d = j.data;
            res.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px 16px;margin-bottom:14px">
              <b style="color:#166534;font-size:16px">✅ นำเข้าสำเร็จ 导入成功！</b>
              <div style="display:flex;gap:20px;margin-top:8px;font-size:14px;color:#166534">
                <span>📋 ${d.imported} รายการ 条记录</span>
                <span>🏢 ${d.suppliers_created} ผู้ขายใหม่ 新供货商</span>
                <span>📦 ${d.items_created} รายการใหม่ 新品种</span>
              </div>
            </div>`;
            document.getElementById('pdb-drop').querySelector('div:nth-child(2)').textContent = `✅ ${file.name}`;
        } catch(e) {
            if (typeof app !== 'undefined') app.hideLoading();
            res.innerHTML = `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:12px;color:#dc2626">❌ ${e.message}</div>`;
        }
    },

    async addManual() {
        const g = id => (document.getElementById(id)||{}).value||'';
        const body = {
            purchase_date: g('pdb-m-date')||null,
            invoice_no: g('pdb-m-inv'),
            supplier_name: g('pdb-m-supp'),
            item_category: g('pdb-m-cat'),
            item_name_th: g('pdb-m-nth'),
            item_name_cn: g('pdb-m-ncn'),
            qty: parseFloat(g('pdb-m-qty'))||0,
            unit: g('pdb-m-unit'),
            unit_price: parseFloat(g('pdb-m-price'))||0,
            project_id: this.projectId
        };
        if (!body.supplier_name||!body.item_name_cn||!body.unit) { alert('กรุณากรอกผู้ขาย ชื่อรายการ และหน่วย / 请填写供货商、品名、单位'); return; }
        try {
            await apiRequest('/api/purchase-records', { method:'POST', body:JSON.stringify(body) });
            if (typeof app !== 'undefined' && app.showToast) app.showToast('บันทึกสำเร็จ 保存成功', 'success');
            ['pdb-m-inv','pdb-m-supp','pdb-m-nth','pdb-m-ncn','pdb-m-qty','pdb-m-unit','pdb-m-price'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value='';
            });
        } catch(e) { alert(e.message); }
    },

    // ═══ TAB 2: Price Reference Library ═══
    async renderPrices() {
        const box = document.getElementById('pdb-content');
        box.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">กำลังโหลด... 加载中</div>';
        try {
            const r = await apiRequest('/api/material-items');
            const items = r.data || [];
            if (!items.length) {
                box.innerHTML = '<div class="pdb-card" style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px">📦</div><div>ยังไม่มีข้อมูล 还没有数据<br><small>อัปโหลด CSV ก่อน 先导入CSV</small></div></div>';
                return;
            }

            const cats = [...new Set(items.map(x=>x.category).filter(Boolean))].sort();
            const maxAvg = Math.max(...items.map(x=>Number(x.avg_price||0)));

            box.innerHTML = `
              <div class="pdb-card" style="padding:12px 16px;margin-bottom:12px">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <select id="pdb-p-cat" onchange="PurchaseDB.renderPrices()" style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px">
                    <option value="">ทุกประเภท 全部分类</option>
                    ${cats.map(c=>`<option>${c}</option>`).join('')}
                  </select>
                  <input type="text" id="pdb-p-q" placeholder="ค้นหา 搜索品名..." oninput="PurchaseDB.renderPrices()" style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;min-width:180px">
                  <span style="color:#64748b;font-size:13px">${items.length} รายการ</span>
                </div>
              </div>
              <div style="overflow-x:auto;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <table class="pdb-table">
                <thead><tr>
                  <th>รายการ 品名</th><th>ประเภท 分类</th><th>หน่วย 单位</th>
                  <th style="text-align:right">ราคาเฉลี่ย 均价 ฿</th>
                  <th style="text-align:right">ต่ำสุด 最低</th>
                  <th style="text-align:right">สูงสุด 最高</th>
                  <th style="text-align:right">ล่าสุด 最近价</th>
                  <th>แนวโน้ม 趋势</th>
                  <th style="text-align:right">ครั้ง 次数</th>
                  <th>วันล่าสุด 最近日期</th>
                </tr></thead>
                <tbody>${items.map(it => {
                  const avg=Number(it.avg_price||0), mn=Number(it.min_price||0), mx=Number(it.max_price||0), last=Number(it.last_price||0);
                  const barW = maxAvg>0 ? Math.round(avg/maxAvg*80) : 0;
                  const trend = last>avg*1.05 ? '📈' : last<avg*0.95 ? '📉' : '➡️';
                  return `<tr style="cursor:pointer" onclick="PurchaseDB.showPriceHistory(${it.id},'${this.esc(it.name_cn)}','${this.esc(it.unit||'')}')">
                    <td>
                      <b style="font-size:14px">${this.esc(it.name_th||it.name_cn)}</b>
                      <div style="font-size:11px;color:#64748b">${it.name_th?this.esc(it.name_cn):''}</div>
                    </td>
                    <td><span style="background:#e0e7ff;color:#3730a3;padding:2px 7px;border-radius:8px;font-size:11px">${this.esc(it.category||'—')}</span></td>
                    <td>${this.esc(it.unit||'—')}</td>
                    <td style="text-align:right;font-weight:700;color:#1e3a8a">฿${this.fmt(avg)}</td>
                    <td style="text-align:right;color:#10b981">฿${this.fmt(mn)}</td>
                    <td style="text-align:right;color:#dc2626">฿${this.fmt(mx)}</td>
                    <td style="text-align:right">฿${this.fmt(last)}</td>
                    <td><div class="price-bar-wrap"><div class="price-bar" style="width:${barW}px"></div><span style="font-size:14px">${trend}</span></div></td>
                    <td style="text-align:right">${it.sample_count||0}</td>
                    <td style="font-size:12px;color:#64748b">${this.fmtDate(it.last_purchase_date)}</td>
                  </tr>`;
                }).join('')}</tbody>
              </table></div>`;
        } catch(e) {
            box.innerHTML = `<div class="pdb-card" style="color:#dc2626">ข้อผิดพลาด: ${e.message}</div>`;
        }
    },

    async showPriceHistory(itemId, nameCn, unit) {
        try {
            const r = await apiRequest(`/api/material-items/${itemId}/price-history`);
            const recs = r.data.records || [];
            if (!recs.length) return;

            const maxP = Math.max(...recs.map(x=>Number(x.unit_price||0)));
            const dlg = document.createElement('div'); dlg.className='sb-overlay';
            dlg.innerHTML = `<div class="sb-dialog" style="max-width:600px">
              <header style="background:#1e3a8a;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
                <div><b style="font-size:16px">📊 ประวัติราคา ${this.esc(nameCn)}</b><div style="font-size:12px;opacity:.8">${this.esc(unit)} · ${recs.length} ครั้ง</div></div>
                <button data-x style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button>
              </header>
              <div class="sb-body" style="max-height:70vh;overflow-y:auto;padding:0">
                <table class="pdb-table">
                  <thead><tr>
                    <th>วันที่ 日期</th><th>ผู้ขาย 供货商</th>
                    <th style="text-align:right">จำนวน</th>
                    <th style="text-align:right">ราคา/หน่วย ฿</th>
                    <th>แนวโน้ม</th>
                    <th>Invoice</th>
                  </tr></thead>
                  <tbody>${recs.map((r,i)=>{
                    const p=Number(r.unit_price||0), barW=maxP>0?Math.round(p/maxP*100):0;
                    const isHigh=p>Number(recs.find(x=>x.id!==r.id)?.unit_price||p)*1.10;
                    return `<tr>
                      <td style="white-space:nowrap">${this.fmtDate(r.purchase_date)}</td>
                      <td>${this.esc(r.supplier_name||'')}</td>
                      <td style="text-align:right">${this.fmt(r.qty,3)} ${this.esc(r.unit||'')}</td>
                      <td style="text-align:right;font-weight:700;color:${isHigh?'#dc2626':'#1e3a8a'}">฿${this.fmt(p)}</td>
                      <td><div style="background:#e2e8f0;border-radius:3px;height:8px;width:${barW}px;background:#3b82f6"></div></td>
                      <td style="font-size:11px;color:#64748b">${this.esc(r.invoice_no||'')}</td>
                    </tr>`;
                  }).join('')}</tbody>
                </table>
              </div>
            </div>`;
            document.body.appendChild(dlg);
            dlg.querySelector('[data-x]').onclick = () => dlg.remove();
            dlg.onclick = e => { if (e.target===dlg) dlg.remove(); };
        } catch(e) { alert(e.message); }
    },

    // ═══ TAB 3: Suppliers ═══
    async renderSuppliers() {
        const box = document.getElementById('pdb-content');
        box.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b">กำลังโหลด... 加载中</div>';
        try {
            const r = await apiRequest('/api/suppliers');
            const supps = r.data || [];
            if (!supps.length) {
                box.innerHTML = '<div class="pdb-card" style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px">🏢</div><div>ยังไม่มีข้อมูล 还没有数据</div></div>';
                return;
            }
            const totalSpend = supps.reduce((s,x)=>s+Number(x.total_spend||0),0);
            const maxSpend = Math.max(...supps.map(x=>Number(x.total_spend||0)));

            box.innerHTML = `
              <div class="pdb-kpi-grid">
                <div class="pdb-kpi"><div class="pdb-kpi-n">${supps.length}</div><div class="pdb-kpi-l">🏢 ผู้ขายทั้งหมด 供货商总数</div></div>
                <div class="pdb-kpi"><div class="pdb-kpi-n">฿${this.fmt(totalSpend,0)}</div><div class="pdb-kpi-l">💰 ยอดรวม 总采购额</div></div>
              </div>
              <div style="overflow-x:auto;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <table class="pdb-table">
                <thead><tr>
                  <th>ผู้ขาย 供货商</th>
                  <th style="text-align:right">ครั้ง 次数</th>
                  <th style="text-align:right">ยอดรวม 总金额 ฿</th>
                  <th>สัดส่วน 占比</th>
                </tr></thead>
                <tbody>${supps.map(s=>{
                  const spend=Number(s.total_spend||0);
                  const pct=totalSpend>0?Math.round(spend/totalSpend*100):0;
                  const barW=maxSpend>0?Math.round(spend/maxSpend*150):0;
                  return `<tr>
                    <td><b style="font-size:15px">${this.esc(s.name)}</b></td>
                    <td style="text-align:right">${s.purchase_count||0}</td>
                    <td style="text-align:right;font-weight:700;color:#1e3a8a">฿${this.fmt(spend,0)}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:6px">
                        <div style="background:#e2e8f0;border-radius:3px;height:8px;width:${barW}px;background:#3b82f6;flex:0 0 auto"></div>
                        <span style="font-size:12px;color:#64748b">${pct}%</span>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}</tbody>
              </table></div>`;
        } catch(e) {
            box.innerHTML = `<div class="pdb-card" style="color:#dc2626">${e.message}</div>`;
        }
    }
};

window.PurchaseDB = PurchaseDB;
