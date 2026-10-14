// purchase-audit.js — 采购账务核实分析
// 集成在项目「采购分析」标签页里，纯前端运行，不需要后端
const PurchaseAudit = {
    projectId: null,
    records: [],
    boqData: [],
    charts: {},

    init(projectId) {
        this.projectId = projectId;
        this.records = [];
        this.boqData = [];
        this.charts = {};
        this.render();
    },

    esc(s) { return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
    fmt(n)  { return n==null?'-':Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}); },
    fmtN(n) { return n==null?'-':Number(n).toLocaleString('th-TH'); },

    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        box.innerHTML = `
        <div style="padding:16px;max-width:1400px;margin:0 auto">
          <div class="td-head">
            <div>
              <h2 class="td-title">📊 วิเคราะห์การจัดซื้อ <small class="td-th">采购分析</small></h2>
              <div class="td-sub">อัปโหลด CSV เพื่อตรวจสอบใบเสร็จ · 上传采购CSV自动核实</div>
            </div>
          </div>

          <!-- Upload zone -->
          <div id="pa-drop" style="background:#fff;border:2.5px dashed #94a3b8;border-radius:14px;padding:28px;text-align:center;cursor:pointer;margin-bottom:16px;transition:.2s">
            <div style="font-size:36px;margin-bottom:6px">📂</div>
            <div style="font-size:15px;font-weight:700;color:#1e3a8a;margin-bottom:4px">อัปโหลดไฟล์ purchase_records.csv</div>
            <div style="font-size:13px;color:#64748b">คลิกหรือลากไฟล์มาวาง / 点击或拖放 CSV</div>
            <input type="file" id="pa-input" accept=".csv" style="display:none">
          </div>

          <!-- KPIs -->
          <div id="pa-kpis" style="display:none;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px"></div>

          <!-- Charts -->
          <div id="pa-charts" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:8px;font-size:14px">🏢 供货商采购占比</div>
              <div id="pa-chart1" style="height:280px"></div>
            </div>
            <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <div style="font-weight:700;color:#1e3a8a;margin-bottom:8px;font-size:14px">📦 各分类支出金额</div>
              <div id="pa-chart2" style="height:280px"></div>
            </div>
          </div>

          <!-- Filters + Table -->
          <div id="pa-table-sec" style="display:none;background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px">
            <div style="font-weight:700;color:#1e3a8a;margin-bottom:12px;font-size:15px">🧾 采购明细 · 智能核实</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
              <select id="pa-fcat" onchange="PurchaseAudit.renderTable()" style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px"><option value="">全部分类</option></select>
              <select id="pa-fflag" onchange="PurchaseAudit.renderTable()" style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px">
                <option value="">全部状态</option>
                <option value="dup">⚠️ 重复单据</option>
                <option value="deduct">🚫 需扣回</option>
                <option value="high">📈 价格偏高</option>
              </select>
              <input id="pa-ftxt" type="text" placeholder="搜索供货商/品名..." oninput="PurchaseAudit.renderTable()" style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;min-width:160px">
              <button class="sb-btn small" onclick="PurchaseAudit.exportCSV()">⬇️ 导出</button>
            </div>
            <div id="pa-table" style="overflow-x:auto"></div>
          </div>

          <!-- BOQ Compare -->
          <div id="pa-boq-sec" style="display:none;background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            <div style="font-weight:700;color:#1e3a8a;margin-bottom:12px;font-size:15px">📐 BOQ 预算对比</div>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
              <button class="sb-btn small primary" onclick="document.getElementById('pa-boq-input').click()">📂 上传 BOQ CSV</button>
              <input type="file" id="pa-boq-input" accept=".csv" style="display:none">
              <span id="pa-boq-name" style="font-size:13px;color:#64748b">字段: 材料名称, 预算数量, 预算单价</span>
            </div>
            <div id="pa-boq-table"><div style="text-align:center;padding:24px;color:#94a3b8">上传 BOQ CSV 后显示对比</div></div>
          </div>
        </div>`;

        this._bindEvents();
    },

    _bindEvents() {
        const drop = document.getElementById('pa-drop');
        if (!drop) return;
        drop.onclick = () => document.getElementById('pa-input').click();
        drop.ondragover = e => { e.preventDefault(); drop.style.borderColor='#2563eb'; drop.style.background='#eff6ff'; };
        drop.ondragleave = () => { drop.style.borderColor=''; drop.style.background=''; };
        drop.ondrop = e => { e.preventDefault(); drop.style.borderColor=''; drop.style.background=''; this._loadCSV(e.dataTransfer.files[0]); };
        document.getElementById('pa-input').onchange = e => this._loadCSV(e.target.files[0]);
        document.getElementById('pa-boq-input').onchange = e => {
            const f = e.target.files[0]; if (!f) return;
            document.getElementById('pa-boq-name').textContent = f.name;
            Papa.parse(f, { header:true, skipEmptyLines:true, complete: r => { this.boqData = r.data; this.renderBOQ(); } });
        };
    },

    _loadCSV(file) {
        if (!file) return;
        Papa.parse(file, {
            header:true, skipEmptyLines:true, dynamicTyping:true,
            complete: r => {
                this.records = r.data.map(row => ({...row, _flags:[]}));
                document.getElementById('pa-drop').querySelector('div:nth-child(2)').textContent = `✅ ${file.name} — ${this.records.length} 条`;
                this._applyRules();
                this._showAll();
            }
        });
    },

    _applyRules() {
        // Rule A: Duplicate Invoice_No
        const inv = {};
        this.records.forEach(r => { const k=(r.Invoice_No||'').trim(); inv[k]=(inv[k]||0)+1; });

        // Rule C: Price anomaly
        const pm = {};
        this.records.forEach(r => {
            const k=(r.Item_Name_CN||'').trim();
            if (!pm[k]) pm[k]=[];
            if (r.Unit_Price>0) pm[k].push(Number(r.Unit_Price));
        });
        const avg = {};
        Object.keys(pm).forEach(k => { avg[k]=pm[k].reduce((a,b)=>a+b,0)/pm[k].length; });

        this.records.forEach(r => {
            r._flags = [];
            if ((r.Invoice_No||'').trim() && inv[(r.Invoice_No||'').trim()]>1) r._flags.push('dup');
            if (['Consumable','Machinery'].includes(r.Item_Category)) r._flags.push('deduct');
            const k=(r.Item_Name_CN||'').trim();
            if (avg[k] && r.Unit_Price > avg[k]*1.10 && pm[k].length>1) r._flags.push('high');
        });
    },

    _showAll() {
        // KPIs
        const total = this.records.reduce((s,r)=>s+Number(r.Total_Price||0),0);
        const invSet = new Set(this.records.map(r=>(r.Invoice_No||'').trim()).filter(Boolean));
        const dupSet = new Set(this.records.filter(r=>r._flags.includes('dup')).map(r=>(r.Invoice_No||'').trim()));
        const deduct = this.records.filter(r=>r._flags.includes('deduct')).reduce((s,r)=>s+Number(r.Total_Price||0),0);
        const high = this.records.filter(r=>r._flags.includes('high')).length;

        const kpis = document.getElementById('pa-kpis');
        kpis.style.display = 'grid';
        kpis.innerHTML = `
          ${this._kpi('💰 总采购金额','฿'+this.fmt(total),'ok')}
          ${this._kpi('🧾 单据总数',invSet.size,'')}
          ${this._kpi('⚠️ 重复单据',dupSet.size,'danger')}
          ${this._kpi('🚫 应扣回金额','฿'+this.fmt(deduct),'warn')}
          ${this._kpi('📈 价格偏高笔数',high,'warn')}`;

        // Charts
        const cr = document.getElementById('pa-charts');
        cr.style.display = 'grid';
        setTimeout(() => this._renderCharts(), 100);

        // Filter options
        const cats = [...new Set(this.records.map(r=>r.Item_Category).filter(Boolean))].sort();
        const sel = document.getElementById('pa-fcat');
        sel.innerHTML = '<option value="">全部分类</option>' + cats.map(c=>`<option>${c}</option>`).join('');

        document.getElementById('pa-table-sec').style.display = '';
        document.getElementById('pa-boq-sec').style.display = '';
        this.renderTable();
    },

    _kpi(label, val, cls) {
        const border = {ok:'#10b981',danger:'#dc2626',warn:'#f59e0b','':'#2563eb'}[cls]||'#2563eb';
        const color  = {ok:'#10b981',danger:'#dc2626',warn:'#f59e0b','':'#1e3a8a'}[cls]||'#1e3a8a';
        return `<div style="background:#fff;border-radius:12px;padding:14px 18px;border-left:4px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <div style="font-size:1.6rem;font-weight:700;color:${color}">${val}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${label}</div>
        </div>`;
    },

    _renderCharts() {
        // Supplier pie
        const sm = {};
        this.records.forEach(r=>{ const s=r.Supplier||'其他'; sm[s]=(sm[s]||0)+Number(r.Total_Price||0); });
        const sd = Object.entries(sm).sort((a,b)=>b[1]-a[1]).map(([n,v])=>({name:n,value:Math.round(v)}));

        const el1 = document.getElementById('pa-chart1');
        if (el1 && el1.offsetHeight > 0) {
            if (this.charts.c1) this.charts.c1.dispose();
            this.charts.c1 = echarts.init(el1);
            this.charts.c1.setOption({
                tooltip:{trigger:'item',formatter:'{b}<br/>฿{c} ({d}%)'},
                legend:{orient:'vertical',right:0,top:'middle',textStyle:{fontSize:11}},
                series:[{type:'pie',radius:['38%','68%'],center:['40%','50%'],data:sd,
                    label:{formatter:'{d}%',fontSize:11},
                    emphasis:{itemStyle:{shadowBlur:8,shadowColor:'rgba(0,0,0,.2)'}}}]
            });
        }

        // Category bar
        const cm = {};
        this.records.forEach(r=>{ const c=r.Item_Category||'其他'; cm[c]=(cm[c]||0)+Number(r.Total_Price||0); });
        const cats = Object.keys(cm).sort((a,b)=>cm[b]-cm[a]);
        const colors = ['#2563eb','#f59e0b','#10b981','#a855f7','#f97316','#0891b2','#dc2626','#64748b','#6366f1','#14b8a6'];

        const el2 = document.getElementById('pa-chart2');
        if (el2 && el2.offsetHeight > 0) {
            if (this.charts.c2) this.charts.c2.dispose();
            this.charts.c2 = echarts.init(el2);
            this.charts.c2.setOption({
                tooltip:{trigger:'axis',formatter:p=>`${p[0].name}<br/>฿${p[0].value.toLocaleString()}`},
                xAxis:{type:'category',data:cats,axisLabel:{rotate:30,fontSize:11}},
                yAxis:{type:'value',axisLabel:{formatter:v=>'฿'+(v/1000).toFixed(0)+'k'}},
                series:[{type:'bar',data:cats.map((c,i)=>({value:Math.round(cm[c]),itemStyle:{color:colors[i%colors.length]}})),
                    label:{show:true,position:'top',formatter:p=>'฿'+(p.value/1000).toFixed(0)+'k',fontSize:10}}]
            });
        }
    },

    renderTable() {
        const catF = (document.getElementById('pa-fcat')||{}).value||'';
        const flagF = (document.getElementById('pa-fflag')||{}).value||'';
        const txt = ((document.getElementById('pa-ftxt')||{}).value||'').toLowerCase();

        const rows = this.records.filter(r=>{
            if (catF && r.Item_Category!==catF) return false;
            if (flagF && !r._flags.includes(flagF)) return false;
            if (txt && !((r.Supplier||'')+(r.Item_Name_CN||'')+(r.Item_Name_TH||'')).toLowerCase().includes(txt)) return false;
            return true;
        });

        const wrap = document.getElementById('pa-table'); if (!wrap) return;

        if (!rows.length) { wrap.innerHTML='<div style="text-align:center;padding:24px;color:#94a3b8">ไม่มีข้อมูล 没有记录</div>'; return; }

        const subtotal = rows.reduce((s,r)=>s+Number(r.Total_Price||0),0);
        wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead style="position:sticky;top:0;z-index:1">
            <tr style="background:#f8fafc">
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left;white-space:nowrap">วันที่ 日期</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left;white-space:nowrap">Invoice No.</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left">ผู้ขาย 供货商</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left">ประเภท 分类</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left">รายการ 品名(TH)</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left">中文品名</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">จำนวน 数量</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">ราคา/หน่วย 单价</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">รวม 总价 ฿</th>
              <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left">ผลตรวจ 审核</th>
            </tr>
          </thead>
          <tbody>${rows.map(r=>{
              const f=r._flags||[];
              const bg=f.includes('dup')?'#fff5f5':f.includes('deduct')?'#fffbeb':'';
              const badges=[
                f.includes('dup')    ?'<span style="background:#fee2e2;color:#dc2626;padding:2px 7px;border-radius:8px;font-size:11px;white-space:nowrap">⚠️ ซ้ำ/重复</span>':'',
                f.includes('deduct') ?'<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:8px;font-size:11px;white-space:nowrap">🚫 หักคืน/扣回</span>':'',
                f.includes('high')   ?'<span style="background:#fce7f3;color:#9d174d;padding:2px 7px;border-radius:8px;font-size:11px;white-space:nowrap">📈 ราคาสูง</span>':'',
                !f.length            ?'<span style="background:#dcfce7;color:#166534;padding:2px 7px;border-radius:8px;font-size:11px">✅ ปกติ</span>':''
              ].filter(Boolean).join(' ');
              return `<tr style="background:${bg};border-bottom:1px solid #f1f5f9">
                <td style="padding:8px 10px;white-space:nowrap">${this.esc(r.Date||'')}</td>
                <td style="padding:8px 10px;font-family:monospace;font-size:12px">${this.esc(r.Invoice_No||'')}</td>
                <td style="padding:8px 10px">${this.esc(r.Supplier||'')}</td>
                <td style="padding:8px 10px"><span style="background:#e0e7ff;color:#3730a3;padding:2px 7px;border-radius:8px;font-size:11px">${this.esc(r.Item_Category||'')}</span></td>
                <td style="padding:8px 10px;font-size:12px">${this.esc(r.Item_Name_TH||'')}</td>
                <td style="padding:8px 10px">${this.esc(r.Item_Name_CN||'')}</td>
                <td style="padding:8px 10px;text-align:right">${this.fmtN(r.Qty)} ${this.esc(r.Unit||'')}</td>
                <td style="padding:8px 10px;text-align:right">${this.fmt(r.Unit_Price)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:600">${this.fmt(r.Total_Price)}</td>
                <td style="padding:8px 10px">${badges}</td>
              </tr>`;
          }).join('')}</tbody>
          <tfoot><tr style="background:#f8fafc;font-weight:700">
            <td colspan="8" style="padding:8px 10px;text-align:right">รวม/小计 (${rows.length} รายการ)</td>
            <td style="padding:8px 10px;text-align:right;color:#1e3a8a">฿${this.fmt(subtotal)}</td>
            <td></td>
          </tr></tfoot>
        </table>`;
    },

    renderBOQ() {
        if (!this.boqData.length || !this.records.length) return;
        const sample = this.boqData[0];
        const keys = Object.keys(sample);
        const nameKey  = keys.find(k=>/名称|name|item/i.test(k))||keys[0];
        const qtyKey   = keys.find(k=>/数量|qty/i.test(k))||keys[2];
        const priceKey = keys.find(k=>/单价|price/i.test(k))||keys[3];

        const actMap = {};
        this.records.forEach(r=>{
            const k=(r.Item_Name_CN||'').trim();
            if (!actMap[k]) actMap[k]={qty:0,amount:0};
            actMap[k].qty+=Number(r.Qty||0);
            actMap[k].amount+=Number(r.Total_Price||0);
        });

        const rows = this.boqData.map(b=>{
            const name=b[nameKey]||'';
            const bq=Number(b[qtyKey]||0), bp=Number(b[priceKey]||0), ba=bq*bp;
            const a=actMap[name]||{qty:0,amount:0};
            const pct=bq>0?Math.min(150,Math.round(a.qty/bq*100)):0;
            const diff=a.amount-ba;
            return {name,bq,bp,ba,aq:a.qty,aa:a.amount,pct,diff};
        });

        const wrap = document.getElementById('pa-boq-table'); if (!wrap) return;
        wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left">รายการ 材料名称</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">ประมาณ 预算量</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">จัดซื้อแล้ว 已采购</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0">ความคืบหน้า 进度</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">งบ ฿ 预算金额</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">จริง ฿ 实际金额</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:right">ผลต่าง 盈亏 ฿</th>
          </tr></thead>
          <tbody>${rows.map(r=>{
              const barColor=r.pct>110?'#dc2626':r.pct>90?'#f59e0b':'#10b981';
              const diffColor=r.diff>0?'#dc2626':'#10b981';
              return `<tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:8px 10px">${this.esc(r.name)}</td>
                <td style="padding:8px 10px;text-align:right">${this.fmt(r.bq)}</td>
                <td style="padding:8px 10px;text-align:right">${this.fmt(r.aq)}</td>
                <td style="padding:8px 10px">
                  <div style="background:#e2e8f0;border-radius:4px;height:6px;width:80px;display:inline-block;vertical-align:middle">
                    <div style="background:${barColor};height:6px;border-radius:4px;width:${Math.min(100,r.pct)}%"></div>
                  </div>
                  <span style="font-size:12px;margin-left:6px">${r.pct}%</span>
                </td>
                <td style="padding:8px 10px;text-align:right">${this.fmt(r.ba)}</td>
                <td style="padding:8px 10px;text-align:right">${this.fmt(r.aa)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;color:${diffColor}">${r.diff>0?'+':''}${this.fmt(r.diff)}</td>
              </tr>`;
          }).join('')}</tbody>
          <tfoot><tr style="font-weight:700;background:#f8fafc">
            <td colspan="4" style="padding:8px 10px;text-align:right">รวม 合计</td>
            <td style="padding:8px 10px;text-align:right">฿${this.fmt(rows.reduce((s,r)=>s+r.ba,0))}</td>
            <td style="padding:8px 10px;text-align:right">฿${this.fmt(rows.reduce((s,r)=>s+r.aa,0))}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:${rows.reduce((s,r)=>s+r.diff,0)>0?'#dc2626':'#10b981'}">
              ${rows.reduce((s,r)=>s+r.diff,0)>0?'+':''}฿${this.fmt(rows.reduce((s,r)=>s+r.diff,0))}
            </td>
          </tr></tfoot>
        </table>`;
    },

    exportCSV() {
        const catF=(document.getElementById('pa-fcat')||{}).value||'';
        const flagF=(document.getElementById('pa-fflag')||{}).value||'';
        const txt=((document.getElementById('pa-ftxt')||{}).value||'').toLowerCase();
        const rows=this.records.filter(r=>{
            if(catF&&r.Item_Category!==catF)return false;
            if(flagF&&!r._flags.includes(flagF))return false;
            if(txt&&!((r.Supplier||'')+(r.Item_Name_CN||'')+(r.Item_Name_TH||'')).toLowerCase().includes(txt))return false;
            return true;
        });
        if(!rows.length){alert('没有数据可导出');return;}
        const csv=Papa.unparse(rows.map(r=>({...r,审核标记:r._flags.map(f=>({dup:'重复单据',deduct:'应扣回',high:'价格偏高'})[f]||f).join(',')||'正常'})));
        const a=document.createElement('a');
        a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
        a.download='purchase_audit_'+new Date().toISOString().slice(0,10)+'.csv';
        a.click();
    }
};

window.PurchaseAudit = PurchaseAudit;
