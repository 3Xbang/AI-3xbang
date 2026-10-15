// purchase-db.js — 采购价格参考库
// 管理员：完整界面（上传CSV + 价格库 + 供货商）
// 其他角色：简洁界面（价格核实 + 只读参考表）
const PurchaseDB = {
    projectId: null,
    activeTab: 'import',
    _itemsCache: [],
    _selectedBenchmark: null,

    init(projectId) {
        this.projectId = projectId;
        this._itemsCache = [];
        this._selectedBenchmark = null;
        this.activeTab = PermissionManager.isManager() ? 'import' : 'prices';
        this.render();
    },

    esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
    fmt(n,d=2) { return n==null||n===''?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}); },
    fmtDate(s) { return s?String(s).slice(0,10):'—'; },

    // ─── RENDER ───
    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        const isAdmin = PermissionManager.isManager();

        const css = `<style>
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
        </style>`;

        if (!isAdmin) {
            // ── Non-admin: price check + read-only table ──
            box.innerHTML = css + `
            <div style="padding:16px;max-width:1000px;margin:0 auto">
              <div class="td-head">
                <div><h2 class="td-title">🔍 Price Check <small class="td-th">价格核实</small></h2>
                <div class="td-sub">Enter supplier quote, instantly compare with historical average price · 输入供货商报价，即时对比历史均价</div></div>
              </div>
              <div id="pdb-content"></div>
            </div>`;
            this.renderCheckPanel();
            return;
        }

        // ── Admin: full 3-tab interface ──
        box.innerHTML = css + `
        <div style="padding:16px;max-width:1400px;margin:0 auto">
          <div class="td-head">
            <div><h2 class="td-title">📊 Purchase Price Database <small class="td-th">采购价格参考库</small></h2>
            <div class="td-sub">Record from suppliers and materials, build price reference · 积累采购数据，建立价格标准</div></div>
          </div>
          <div style="display:flex;gap:4px;margin-bottom:16px;background:#fff;border-radius:12px;padding:6px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            ${['import','prices','suppliers'].map(t=>{
              const lbl={import:'🔍 Price Check 核实',prices:'💰 Price Library 价格库',suppliers:'🏢 Suppliers 供货商'};
              return `<button class="pdb-tab ${this.activeTab===t?'active':''}" data-tab="${t}" onclick="PurchaseDB.switchTab('${t}')">${lbl[t]}</button>`;
            }).join('')}
          </div>
          <div id="pdb-content"></div>
        </div>`;
        this.loadTab();
    },

    switchTab(t) {
        this.activeTab = t;
        document.querySelectorAll('.pdb-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
        this.loadTab();
    },
    loadTab() {
        if (this.activeTab==='import')    this.renderImport();
        if (this.activeTab==='prices')    this.renderPrices();
        if (this.activeTab==='suppliers') this.renderSuppliers();
    },

    // ─── NON-ADMIN VIEW ───
    async renderCheckPanel() {
        const box = document.getElementById('pdb-content');
        await this._loadItemsCache();
        box.innerHTML = `
          <div class="pdb-card" style="margin-bottom:14px">
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">🔍 Price Check <small style="color:#64748b;font-weight:400">报价核实</small></div>
            <div style="font-size:13px;color:#64748b;margin-bottom:14px">Enter the supplier quoted price, system will compare immediately</div>
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:end">
              <div>
                <div style="font-size:13px;color:#64748b;margin-bottom:4px;font-weight:600">Item 品名 *</div>
                <input type="text" id="pdb-ck-item" placeholder="Search, e.g. DB16..." oninput="PurchaseDB.searchItems(this.value)"
                  style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px">
                <div id="pdb-ck-suggest" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;margin-top:2px;display:none;max-height:200px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.12);position:relative;z-index:10"></div>
              </div>
              <div>
                <div style="font-size:13px;color:#64748b;margin-bottom:4px;font-weight:600">Unit</div>
                <input type="text" id="pdb-ck-unit" placeholder="piece" style="width:80px;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;text-align:center">
              </div>
              <div>
                <div style="font-size:13px;color:#64748b;margin-bottom:4px;font-weight:600">Quoted Price 报价 ฿ *</div>
                <input type="number" id="pdb-ck-price" placeholder="0.00" step="0.01" oninput="PurchaseDB.checkPrice()"
                  style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px">
              </div>
            </div>
            <div id="pdb-ck-result" style="margin-top:14px"></div>
          </div>

          <div class="pdb-card">
            <div style="font-weight:700;color:#1e3a8a;font-size:15px;margin-bottom:12px">💰 Reference Prices <small style="color:#64748b;font-weight:400">价格参考（只读）</small></div>
            ${this._buildRefTable(this._itemsCache.filter(x=>x.sample_count>0))}
          </div>`;
    },

    _buildRefTable(items) {
        if (!items.length) return `<div style="text-align:center;padding:24px;color:#94a3b8">No data yet 暂无数据</div>`;
        return `<div style="overflow-x:auto"><table class="pdb-table">
          <thead><tr>
            <th>Item 品名</th><th>Category 分类</th><th>Unit</th>
            <th style="text-align:right">Avg Price 均价 ฿</th>
            <th style="text-align:right">Min 最低 ฿</th>
            <th style="text-align:right">Max 最高 ฿</th>
            <th style="text-align:right">Times 次数</th>
          </tr></thead>
          <tbody>${items.map(x=>`<tr>
            <td><b style="font-size:14px">${this.esc(x.name_th||x.item_name_cn)}</b>
                ${x.name_th?`<div style="font-size:11px;color:#94a3b8">${this.esc(x.item_name_cn)}</div>`:''}</td>
            <td><span style="background:#e0e7ff;color:#3730a3;padding:2px 7px;border-radius:8px;font-size:11px">${this.esc(x.category||'—')}</span></td>
            <td>${this.esc(x.unit||'—')}</td>
            <td style="text-align:right;font-weight:700;color:#1e3a8a">฿${this.fmt(x.avg_price)}</td>
            <td style="text-align:right;color:#10b981">฿${this.fmt(x.min_price)}</td>
            <td style="text-align:right;color:#dc2626">฿${this.fmt(x.max_price)}</td>
            <td style="text-align:right;color:#64748b">${x.sample_count}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    },

    // ─── TAB 1: Import (admin only) ───
    renderImport() {
        document.getElementById('pdb-content').innerHTML = `
          <div class="pdb-card" id="pdb-drop" style="border:2.5px dashed #94a3b8;text-align:center;cursor:pointer;transition:.2s" onclick="document.getElementById('pdb-csv').click()">
            <div style="font-size:36px;margin-bottom:8px">📂</div>
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">Build Reference Price Database</div>
            <div style="font-size:13px;color:#64748b">Upload purchase_records.csv · 上传新一批采购CSV，自动更新均价</div>
            <input type="file" id="pdb-csv" accept=".csv" style="display:none">
          </div>
          <div id="pdb-import-result"></div>

          <div class="pdb-card">
            <div style="font-size:15px;font-weight:700;color:#1e3a8a;margin-bottom:4px">🔍 Price Check <small style="color:#64748b;font-weight:400">报价核实</small></div>
            <div style="font-size:13px;color:#64748b;margin-bottom:14px">Enter the quoted price, compare with reference</div>
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:end">
              <div>
                <div style="font-size:12px;color:#64748b;margin-bottom:3px">Item 品名 *</div>
                <input type="text" id="pdb-ck-item" placeholder="Search, e.g. DB16..." oninput="PurchaseDB.searchItems(this.value)"
                  style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px">
                <div id="pdb-ck-suggest" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;margin-top:2px;display:none;max-height:160px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.12);position:relative;z-index:10"></div>
              </div>
              <div>
                <div style="font-size:12px;color:#64748b;margin-bottom:3px">Unit 单位</div>
                <input type="text" id="pdb-ck-unit" placeholder="piece" style="width:80px;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center">
              </div>
              <div>
                <div style="font-size:12px;color:#64748b;margin-bottom:3px">Quoted Price 报价 ฿ *</div>
                <input type="number" id="pdb-ck-price" placeholder="0.00" step="0.01" oninput="PurchaseDB.checkPrice()"
                  style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px">
              </div>
            </div>
            <div id="pdb-ck-result" style="margin-top:12px"></div>
          </div>`;
        this._bindDrop();
        this._loadItemsCache();
    },

    _bindDrop() {
        const drop = document.getElementById('pdb-drop');
        if (!drop) return;
        drop.ondragover = e=>{e.preventDefault();drop.style.borderColor='#2563eb';drop.style.background='#eff6ff';};
        drop.ondragleave = ()=>{drop.style.borderColor='';drop.style.background='';};
        drop.ondrop = e=>{e.preventDefault();drop.style.borderColor='';drop.style.background='';this._uploadCSV(e.dataTransfer.files[0]);};
        document.getElementById('pdb-csv').onchange = e=>this._uploadCSV(e.target.files[0]);
    },

    async _loadItemsCache() {
        try {
            const r = await apiRequest('/api/price-benchmarks');
            this._itemsCache = r.data || [];
        } catch(_) {}
    },

    async _uploadCSV(file) {
        if (!file) return;
        const res = document.getElementById('pdb-import-result');
        res.innerHTML = '<div style="padding:10px;color:#2563eb">⏳ Importing... 导入中...</div>';
        try {
            if (typeof app!=='undefined') app.showLoading();
            const fd = new FormData();
            fd.append('csv', file);
            if (this.projectId) fd.append('project_id', this.projectId);
            const r = await fetch(window.location.origin+'/api/purchase-records/import-csv',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
            const j = await r.json();
            if (typeof app!=='undefined') app.hideLoading();
            if (!j.success) throw new Error(j.message);
            const d=j.data;
            res.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px;margin-bottom:12px">
              <b style="color:#166534;font-size:16px">✅ Import successful 导入成功</b>
              <div style="display:flex;gap:20px;margin-top:6px;font-size:14px;color:#166534">
                <span>📋 ${d.imported} items</span>
                <span>🏢 ${d.suppliers_created} new suppliers</span>
                <span>📦 ${d.items_created} new items</span>
              </div>
            </div>`;
            document.getElementById('pdb-drop').querySelector('div:nth-child(2)').textContent = `✅ ${file.name}`;
            await this._loadItemsCache();
        } catch(e) {
            if (typeof app!=='undefined') app.hideLoading();
            res.innerHTML = `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:10px;color:#dc2626;margin-bottom:12px">❌ ${e.message}</div>`;
        }
    },

    // ─── Price search/check (shared by both views) ───
    searchItems(q) {
        const sug = document.getElementById('pdb-ck-suggest');
        if (!q||q.length<1){if(sug)sug.style.display='none';return;}
        const m = this._itemsCache.filter(x=>
            (x.item_name_cn||'').toLowerCase().includes(q.toLowerCase())||
            (x.name_th||'').toLowerCase().includes(q.toLowerCase())
        ).slice(0,8);
        if (!m.length||!sug){if(sug)sug.style.display='none';return;}
        sug.style.display='';
        sug.innerHTML = m.map(x=>`
          <div onclick="PurchaseDB.selectItem('${this.esc(x.item_name_cn)}','${this.esc(x.unit||'')}',${x.avg_price||0},${x.min_price||0},${x.max_price||0},${x.sample_count||0})"
            style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px"
            onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background=''">
            <b>${this.esc(x.name_th||x.item_name_cn)}</b>
            <span style="color:#64748b;font-size:11px;margin-left:4px">${x.name_th?this.esc(x.item_name_cn):''}</span>
            <span style="float:right;color:#1e3a8a;font-weight:700">฿${this.fmt(x.avg_price)}<small style="color:#94a3b8">/${this.esc(x.unit||'')}</small></span>
          </div>`).join('');
    },

    selectItem(nameCn,unit,avg,mn,mx,cnt) {
        this._selectedBenchmark={nameCn,unit,avg:Number(avg),mn:Number(mn),mx:Number(mx),cnt:Number(cnt)};
        const el=document.getElementById('pdb-ck-item'); if(el) el.value=nameCn;
        const ul=document.getElementById('pdb-ck-unit'); if(ul) ul.value=unit;
        const sg=document.getElementById('pdb-ck-suggest'); if(sg) sg.style.display='none';
        this.checkPrice();
    },

    checkPrice() {
        const price=parseFloat((document.getElementById('pdb-ck-price')||{}).value);
        const res=document.getElementById('pdb-ck-result');
        if(!res)return;
        if(!this._selectedBenchmark||!price||isNaN(price)){res.innerHTML='';return;}
        const{nameCn,unit,avg,mn,mx,cnt}=this._selectedBenchmark;
        const diff=price-avg, pct=avg>0?((diff/avg)*100).toFixed(1):0;
        const isHigh=price>avg*1.05, isLow=price<avg*0.95;
        const sig=isHigh?{icon:'⚠️',label:'Price above average 价格偏高',bg:'#fff5f5',border:'#fca5a5',color:'#dc2626'}
                 :isLow ?{icon:'✅',label:'Price below average 价格偏低（有利）',bg:'#f0fdf4',border:'#86efac',color:'#16a34a'}
                 :        {icon:'✅',label:'Normal price 价格正常',bg:'#eff6ff',border:'#93c5fd',color:'#1e3a8a'};
        res.innerHTML=`<div style="background:${sig.bg};border:2px solid ${sig.border};border-radius:12px;padding:16px">
          <div style="font-size:20px;font-weight:700;color:${sig.color};margin-bottom:10px">${sig.icon} ${sig.label}</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:14px">
            ${[['Quoted Price 报价','฿'+this.fmt(price),sig.color],['Avg Price 均价','฿'+this.fmt(avg),'#1e3a8a'],['Range 区间','฿'+this.fmt(mn)+' – ฿'+this.fmt(mx),'#475569'],['Difference 差额',(diff>0?'+':'')+pct+'%',diff>0?'#dc2626':'#16a34a']].map(([l,v,c])=>
              `<div style="background:rgba(255,255,255,.8);border-radius:8px;padding:10px;text-align:center">
                <div style="font-size:11px;color:#64748b;margin-bottom:3px">${l}</div>
                <div style="font-size:1.2rem;font-weight:700;color:${c}">${v}</div>
              </div>`).join('')}
          </div>
          <div style="margin-top:10px;font-size:12px;color:#64748b">Based on ${cnt} records · ${this.esc(nameCn)} / ${this.esc(unit)}</div>
        </div>`;
    },

    // ─── TAB 2: Price Library (admin) ───
    async renderPrices() {
        const box=document.getElementById('pdb-content');
        box.innerHTML='<div style="padding:20px;text-align:center;color:#64748b">Loading...</div>';
        try {
            const r=await apiRequest('/api/material-items');
            const items=r.data||[];
            if(!items.length){box.innerHTML='<div class="pdb-card" style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px">📦</div><div>No data yet 还没有数据<br><small>Upload CSV first 先导入CSV</small></div></div>';return;}
            const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort();
            const maxAvg=Math.max(...items.map(x=>Number(x.avg_price||0)));
            box.innerHTML=`
              <div class="pdb-card" style="padding:10px 14px">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <select id="pdb-p-cat" onchange="PurchaseDB.renderPrices()" style="padding:7px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px">
                    <option value="">All categories 全部</option>
                    ${cats.map(c=>`<option>${c}</option>`).join('')}
                  </select>
                  <input type="text" id="pdb-p-q" placeholder="Search 搜索..." oninput="PurchaseDB.renderPrices()" style="padding:7px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;min-width:160px">
                </div>
              </div>
              <div style="overflow-x:auto;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <table class="pdb-table">
                <thead><tr>
                  <th>Item 品名</th><th>Category</th><th>Unit</th>
                  <th style="text-align:right">Avg 均价 ฿</th>
                  <th style="text-align:right">Min 最低</th>
                  <th style="text-align:right">Max 最高</th>
                  <th style="text-align:right">Latest 最近</th>
                  <th style="text-align:right">Times</th>
                  <th>Last Date</th>
                </tr></thead>
                <tbody>${items.map(it=>{
                  const avg=Number(it.avg_price||0),mn=Number(it.min_price||0),mx=Number(it.max_price||0),last=Number(it.last_price||0);
                  const trend=last>avg*1.05?'📈':last<avg*0.95?'📉':'➡️';
                  const barW=maxAvg>0?Math.round(avg/maxAvg*60):0;
                  return `<tr style="cursor:pointer" onclick="PurchaseDB.showPriceHistory(${it.id},'${this.esc(it.name_cn)}','${this.esc(it.unit||'')}')">
                    <td><b style="font-size:14px">${this.esc(it.name_th||it.name_cn)}</b>${it.name_th?`<div style="font-size:11px;color:#94a3b8">${this.esc(it.name_cn)}</div>`:''}</td>
                    <td><span style="background:#e0e7ff;color:#3730a3;padding:2px 7px;border-radius:8px;font-size:11px">${this.esc(it.category||'—')}</span></td>
                    <td>${this.esc(it.unit||'—')}</td>
                    <td style="text-align:right;font-weight:700;color:#1e3a8a">฿${this.fmt(avg)}</td>
                    <td style="text-align:right;color:#10b981">฿${this.fmt(mn)}</td>
                    <td style="text-align:right;color:#dc2626">฿${this.fmt(mx)}</td>
                    <td style="text-align:right">฿${this.fmt(last)} ${trend}</td>
                    <td style="text-align:right;color:#64748b">${it.sample_count||0}</td>
                    <td style="font-size:12px;color:#64748b">${this.fmtDate(it.last_purchase_date)}</td>
                  </tr>`;
                }).join('')}</tbody>
              </table></div>`;
        } catch(e){box.innerHTML=`<div class="pdb-card" style="color:#dc2626">${e.message}</div>`;}
    },

    async showPriceHistory(itemId,nameCn,unit) {
        try {
            const r=await apiRequest(`/api/material-items/${itemId}/price-history`);
            const recs=r.data.records||[];
            if(!recs.length)return;
            const maxP=Math.max(...recs.map(x=>Number(x.unit_price||0)));
            const dlg=document.createElement('div');dlg.className='sb-overlay';
            dlg.innerHTML=`<div class="sb-dialog" style="max-width:600px">
              <header style="background:#1e3a8a;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
                <div><b>📊 ${this.esc(nameCn)}</b><div style="font-size:12px;opacity:.8">${this.esc(unit)} · ${recs.length} records</div></div>
                <button data-x style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button>
              </header>
              <div class="sb-body" style="max-height:65vh;overflow-y:auto;padding:0">
                <table class="pdb-table">
                  <thead><tr><th>Date</th><th>Supplier</th><th style="text-align:right">Qty</th><th style="text-align:right">Price ฿</th><th>Invoice</th></tr></thead>
                  <tbody>${recs.map(r=>{
                    const p=Number(r.unit_price||0),barW=maxP>0?Math.round(p/maxP*80):0;
                    return `<tr><td>${this.fmtDate(r.purchase_date)}</td><td>${this.esc(r.supplier_name||'')}</td>
                      <td style="text-align:right">${this.fmt(r.qty,3)} ${this.esc(r.unit||'')}</td>
                      <td style="text-align:right;font-weight:700">฿${this.fmt(p)}
                        <div style="background:#e2e8f0;border-radius:3px;height:5px;margin-top:2px"><div style="background:#3b82f6;height:5px;border-radius:3px;width:${barW}px"></div></div>
                      </td>
                      <td style="font-size:11px;color:#64748b">${this.esc(r.invoice_no||'')}</td></tr>`;
                  }).join('')}</tbody>
                </table>
              </div>
            </div>`;
            document.body.appendChild(dlg);
            dlg.querySelector('[data-x]').onclick=()=>dlg.remove();
            dlg.onclick=e=>{if(e.target===dlg)dlg.remove();};
        } catch(e){alert(e.message);}
    },

    // ─── TAB 3: Suppliers (admin) ───
    async renderSuppliers() {
        const box=document.getElementById('pdb-content');
        box.innerHTML='<div style="padding:20px;text-align:center;color:#64748b">Loading...</div>';
        try {
            const r=await apiRequest('/api/suppliers');
            const supps=r.data||[];
            if(!supps.length){box.innerHTML='<div class="pdb-card" style="text-align:center;padding:40px;color:#94a3b8">No data yet</div>';return;}
            const total=supps.reduce((s,x)=>s+Number(x.total_spend||0),0);
            const maxS=Math.max(...supps.map(x=>Number(x.total_spend||0)));
            box.innerHTML=`
              <div class="pdb-kpi-grid">
                <div class="pdb-kpi"><div class="pdb-kpi-n">${supps.length}</div><div class="pdb-kpi-l">🏢 All Suppliers 供货商</div></div>
                <div class="pdb-kpi"><div class="pdb-kpi-n">฿${this.fmt(total,0)}</div><div class="pdb-kpi-l">💰 Total 总采购额</div></div>
              </div>
              <div style="overflow-x:auto;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <table class="pdb-table">
                <thead><tr><th>Supplier 供货商</th><th style="text-align:right">Times</th><th style="text-align:right">Total ฿</th><th>Share</th></tr></thead>
                <tbody>${supps.map(s=>{
                  const sp=Number(s.total_spend||0),pct=total>0?Math.round(sp/total*100):0,barW=maxS>0?Math.round(sp/maxS*150):0;
                  return `<tr><td><b style="font-size:15px">${this.esc(s.name)}</b></td>
                    <td style="text-align:right">${s.purchase_count||0}</td>
                    <td style="text-align:right;font-weight:700;color:#1e3a8a">฿${this.fmt(sp,0)}</td>
                    <td><div style="display:flex;align-items:center;gap:6px"><div style="background:#3b82f6;border-radius:3px;height:8px;width:${barW}px;flex:0 0 auto"></div><span style="font-size:12px;color:#64748b">${pct}%</span></div></td>
                  </tr>`;
                }).join('')}</tbody>
              </table></div>`;
        } catch(e){box.innerHTML=`<div class="pdb-card" style="color:#dc2626">${e.message}</div>`;}
    }
};

window.PurchaseDB = PurchaseDB;
