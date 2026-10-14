// purchase-audit.js — 采购单据核实系统
// 功能: BOQ对比 + 应扣回检测 + 重复发票检测
// 纯前端，不需要后端，两个CSV上传后直接分析

const PurchaseAudit = {
    purchases: [],   // 实际采购记录
    boq: [],         // BOQ预算行
    projectId: null,

    init(projectId) {
        this.projectId = projectId;
        this.purchases = [];
        this.boq = [];
        this.render();
    },

    esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
    fmt(n,d=0) { return n==null?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}); },

    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        box.innerHTML = `
        <div style="padding:16px;max-width:1200px;margin:0 auto">
          <div class="td-head">
            <div>
              <h2 class="td-title">📋 ตรวจสอบการจัดซื้อ <small class="td-th">采购核实报告</small></h2>
              <div class="td-sub">เปรียบเทียบใบเสร็จจริงกับ BOQ · 对比实际采购与预算，检查超支/应扣回/重复报销</div>
            </div>
            <label style="background:#2563eb;color:#fff;border-radius:10px;padding:9px 16px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap">
                📤 <span>อัปโหลดใบเสร็จ 上传收据</span>
                <input type="file" accept=".csv" style="display:none" onchange="PurchaseAudit.uploadReceipts(this)">
            </label>
          </div>
          <div id="pa-upload-status"></div>

          <!-- BOQ upload (still needed for comparison) -->
          <div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span style="font-size:14px;font-weight:600;color:#1e3a8a">📐 BOQ 预算文件：</span>
            <label class="drop-zone" id="pa-boq-btn" style="cursor:pointer;padding:8px 16px;display:inline-flex;align-items:center;gap:6px;font-size:13px">
              📂 <span id="pa-boq-name">อัปโหลด villa_boq.csv 上传BOQ预算</span>
              <input type="file" id="pa-csv2" accept=".csv" style="display:none">
            </label>
          </div>

          <div id="pa-report"></div>
        </div>

        <style>
          .pa-kpi{background:#fff;border-radius:12px;padding:14px 18px;border-left:4px solid #2563eb;box-shadow:0 1px 4px rgba(0,0,0,.06)}
          .pa-kpi-n{font-size:1.7rem;font-weight:700;color:#1e3a8a}
          .pa-kpi.danger{border-left-color:#dc2626}.pa-kpi.danger .pa-kpi-n{color:#dc2626}
          .pa-kpi.warn{border-left-color:#f59e0b}.pa-kpi.warn .pa-kpi-n{color:#d97706}
          .pa-kpi.ok{border-left-color:#10b981}.pa-kpi.ok .pa-kpi-n{color:#059669}
          .pa-sec{background:#fff;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
          .pa-sec h3{font-size:15px;font-weight:700;color:#1e3a8a;margin-bottom:12px}
          .pa-table{width:100%;border-collapse:collapse;font-size:13px}
          .pa-table th{background:#f8fafc;padding:8px 12px;border-bottom:2px solid #e2e8f0;text-align:left;white-space:nowrap;color:#475569}
          .pa-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
          .pa-table tr.row-dup td{background:#fff5f5}
          .pa-table tr.row-deduct td{background:#fffbeb}
          .pab{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap}
          .pab.dup{background:#fee2e2;color:#dc2626}
          .pab.deduct{background:#fef3c7;color:#92400e}
          .pab.ok{background:#dcfce7;color:#166534}
          .prog-wrap{display:flex;align-items:center;gap:6px;min-width:120px}
          .prog-bar{height:8px;border-radius:4px;background:#e2e8f0;width:100px;overflow:hidden;flex:0 0 auto}
          .prog-fill{height:8px;border-radius:4px;background:#2563eb}
          .drop-zone{background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;transition:.2s}
          .drop-zone:hover,.drop-zone.loaded{border-color:#10b981;background:#f0fdf4}
        </style>`;

        this._bindBoq();
        // Auto-load from DB
        this._loadFromDB();
    },

    async uploadReceipts(input) {
        const file = input.files[0]; if (!file) return;
        const status = document.getElementById('pa-upload-status');
        if (status) status.innerHTML = '<div style="padding:8px 12px;color:#2563eb;font-size:13px">⏳ กำลังนำเข้า... 导入中...</div>';
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
            if (status) status.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;color:#166534">
                ✅ ${d.imported} รายการ · ${d.suppliers_created} ผู้ขายใหม่ · ${d.items_created} รายการใหม่
            </div>`;
            input.value='';
            await this._loadFromDB();
        } catch(e) {
            if (typeof app!=='undefined') app.hideLoading();
            if (status) status.innerHTML=`<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:10px;color:#dc2626;font-size:13px;margin-bottom:10px">❌ ${e.message}</div>`;
        }
    },

    async _loadFromDB() {
        const report = document.getElementById('pa-report');
        if (report) report.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b">กำลังโหลด... 加载中</div>';
        try {
            const r = await apiRequest('/api/purchase-records?limit=300' + (this.projectId ? '&project_id='+this.projectId : ''));
            if (!r.data || !r.data.length) {
                if (report) report.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px">📋</div><div>ยังไม่มีข้อมูล 还没有收据数据<br><small>อัปโหลด CSV ด้านบน · 先上传收据CSV</small></div></div>`;
                return;
            }
            // Map DB rows to same format as CSV-parsed purchases
            this.purchases = r.data.map(row => ({
                Date: row.purchase_date ? String(row.purchase_date).slice(0,10) : '',
                Invoice_No: row.invoice_no || '',
                Supplier: row.supplier_name || '',
                Item_Category: row.item_category || '',
                Item_Name_TH: row.item_name_th || '',
                Item_Name_CN: row.item_name_cn || '',
                Qty: row.qty,
                Unit: row.unit || '',
                Unit_Price: row.unit_price,
                Total_Price: row.total_price
            }));
            if (this.purchases.length) this._analyze();
        } catch(e) {
            if (report) report.innerHTML=`<div style="color:#dc2626;padding:12px">${e.message}</div>`;
        }
    },

    _bindBoq() {
        const btn = document.getElementById('pa-boq-btn');
        if (!btn) return;
        btn.onclick = () => document.getElementById('pa-csv2').click();
        document.getElementById('pa-csv2').onchange = e => {
            const file = e.target.files[0]; if (!file) return;
            document.getElementById('pa-boq-name').textContent = '✅ ' + file.name;
            btn.classList.add('loaded');
            Papa.parse(file, {
                header:true, skipEmptyLines:true, dynamicTyping:true,
                complete: r => {
                    this.boq = r.data.filter(row=>{
                        const desc=(row.Description||'').toLowerCase();
                        return row.Quantity>0&&!desc.includes('subtotal')&&!desc.includes('grand total')&&!desc.includes('total');
                    });
                    if (this.purchases.length) this._analyze();
                }
            });
        };
    },

    // ─── Core analysis ───
    _analyze() {
        const P = this.purchases;
        const B = this.boq;

        // Rule A: Duplicate invoices
        const invMap = {};
        P.forEach(r => {
            const k = (r.Invoice_No||'').trim();
            if (k) invMap[k] = (invMap[k]||[]).concat(r);
        });
        const dups = Object.entries(invMap).filter(([,rows])=>rows.length>1);

        // Rule B: Contractor responsibility
        const DEDUCT_CATS = ['Consumable','Machinery','Service','Transport'];
        const deductRows = P.filter(r => DEDUCT_CATS.includes(r.Item_Category));
        const deductTotal = deductRows.reduce((s,r)=>s+Number(r.Total_Price||0),0);

        // Totals
        const totalPurchased = P.reduce((s,r)=>s+Number(r.Total_Price||0),0);
        const totalBOQ = B.reduce((s,r)=>s+Number(r.Total_Amount||0),0);
        const netPurchased = totalPurchased - deductTotal;

        // BOQ vs Actual matching (by Description keyword)
        const boqRows = this._matchBOQ(P, B);

        // Render
        this._renderReport({ P, B, dups, deductRows, deductTotal, totalPurchased, totalBOQ, netPurchased, boqRows });
    },

    // Simple keyword matching: BOQ Description ↔ purchase Item_Name_CN or Item_Name_TH
    _matchBOQ(P, B) {
        // Group purchases by normalized description
        const normPurch = {};
        P.forEach(r => {
            const keys = this._keywords(r.Item_Name_CN||'', r.Item_Name_TH||'', r.Item_Category||'');
            keys.forEach(k => {
                normPurch[k] = (normPurch[k]||0) + Number(r.Total_Price||0);
            });
        });

        return B.map(b => {
            const desc = b.Description||'';
            const unit = b.Unit||'';
            const budgetQty = Number(b.Quantity||0);
            const budgetUP = Number(b.Supply_Unit_Price||0);
            const budgetAmt = Number(b.Total_Amount||0);

            // Find matching purchases
            const matchKey = this._matchKey(desc);
            const actualAmt = normPurch[matchKey] || 0;
            const pct = budgetAmt > 0 ? Math.round(actualAmt / budgetAmt * 100) : 0;

            return { desc, category: b.Category, unit, budgetQty, budgetUP, budgetAmt, actualAmt, pct, matchKey };
        }).filter(r => r.budgetAmt > 0);
    },

    _keywords(cn, th, cat) {
        const s = (cn+' '+th+' '+cat).toLowerCase();
        const res = [];
        if (/db\s*12|螺纹.*12|12mm|12มิล/.test(s)) res.push('db12');
        if (/db\s*16|螺纹.*16|16mm|16มิล/.test(s)) res.push('db16');
        if (/rb\s*9|圆钢.*9|rebar.*9|9มิล/.test(s)) res.push('rb9');
        if (/rb\s*6|rebar.*6|6มิล/.test(s)) res.push('rb6');
        if (/concrete|คอนกรีต|混凝土/.test(s)) res.push('concrete');
        if (/precast|สำเร็จ|楼板/.test(s)) res.push('precast');
        if (/wire\s*mesh|ตาข่าย|网片/.test(s)) res.push('wiremesh');
        if (/wire|ลวด|铁丝/.test(s)) res.push('wire');
        if (/nail|ตะปู|钉子/.test(s)) res.push('nail');
        if (/formwork|แบบหล่อ|模板/.test(s)) res.push('formwork');
        if (/cement|ซีเมนต์|水泥/.test(s)) res.push('cement');
        if (/block|บล็อก|砖/.test(s)) res.push('block');
        if (/pvc|ท่อ/.test(s)) res.push('pvc');
        if (/c.?channel|c型钢/.test(s)) res.push('cchannel');
        if (/metal\s*sheet|matal|彩钢/.test(s)) res.push('metalsheet');
        if (/excavat|ขุด|挖/.test(s)) res.push('excavation');
        if (/plaster|ฉาบ|抹灰/.test(s)) res.push('plastering');
        if (res.length===0) res.push(cn.toLowerCase().replace(/\s+/g,'_').slice(0,20)||'other');
        return res;
    },

    _matchKey(desc) {
        const s = desc.toLowerCase().replace(/\s+/g,'');
        if (/db12/.test(s)) return 'db12';
        if (/db16/.test(s)) return 'db16';
        if (/rb9/.test(s)) return 'rb9';
        if (/rb6/.test(s)) return 'rb6';
        if (/concret|คอนกรีต/.test(s)) return 'concrete';
        if (/precast/.test(s)) return 'precast';
        if (/wiremesh/.test(s)) return 'wiremesh';
        if (/wire/.test(s)) return 'wire';
        if (/nail/.test(s)) return 'nail';
        if (/formwork/.test(s)) return 'formwork';
        if (/cement/.test(s)) return 'cement';
        if (/block/.test(s)) return 'block';
        if (/pvc/.test(s)) return 'pvc';
        if (/cchannel|c-channel/.test(s)) return 'cchannel';
        if (/metalsheet|matalsheet/.test(s)) return 'metalsheet';
        if (/excavat/.test(s)) return 'excavation';
        if (/plaster/.test(s)) return 'plastering';
        return desc.toLowerCase().replace(/\s+/g,'_').slice(0,20);
    },

    _renderReport({ P, B, dups, deductRows, deductTotal, totalPurchased, totalBOQ, netPurchased, boqRows }) {
        const pct = totalBOQ > 0 ? Math.round(netPurchased / totalBOQ * 100) : 0;
        const dupCount = dups.length;

        let html = '';

        // ── KPIs ──
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px">
          <div class="pa-kpi ${pct>100?'danger':pct>80?'warn':'ok'}">
            <div class="pa-kpi-n">${pct}%</div>
            <div style="font-size:12px;color:#64748b">BOQ ที่ใช้แล้ว 已用预算</div>
            <div style="font-size:11px;color:#94a3b8">฿${this.fmt(netPurchased)} / ฿${this.fmt(totalBOQ)}</div>
          </div>
          <div class="pa-kpi ok">
            <div class="pa-kpi-n">฿${this.fmt(totalPurchased)}</div>
            <div style="font-size:12px;color:#64748b">ยอดใบเสร็จรวม 采购总额</div>
          </div>
          <div class="pa-kpi warn">
            <div class="pa-kpi-n">฿${this.fmt(deductTotal)}</div>
            <div style="font-size:12px;color:#64748b">🚫 ควรหักคืน 应扣回</div>
            <div style="font-size:11px;color:#94a3b8">${deductRows.length} รายการ (Machinery/Service)</div>
          </div>
          <div class="pa-kpi ${dupCount>0?'danger':'ok'}">
            <div class="pa-kpi-n">${dupCount}</div>
            <div style="font-size:12px;color:#64748b">⚠️ ใบเสร็จซ้ำ 重复单据</div>
          </div>
          <div class="pa-kpi ok">
            <div class="pa-kpi-n">฿${this.fmt(totalBOQ - netPurchased)}</div>
            <div style="font-size:12px;color:#64748b">งบคงเหลือ 预算剩余</div>
          </div>
        </div>`;

        // ── Duplicate Invoices ──
        if (dups.length) {
            html += `<div class="pa-sec">
              <h3>⚠️ ใบเสร็จซ้ำ 重复单据 — ควรตรวจสอบ 需核实</h3>
              <table class="pa-table"><thead><tr>
                <th>Invoice No.</th><th>ครั้ง 次数</th><th>ผู้ขาย 供货商</th><th>รายการ 品名</th><th style="text-align:right">รวม ฿</th>
              </tr></thead><tbody>
              ${dups.map(([inv,rows])=>rows.map((r,i)=>`<tr class="row-dup">
                <td style="font-family:monospace">${i===0?this.esc(inv):''}</td>
                <td>${i===0?`<span class="pab dup">${rows.length}× ซ้ำ</span>`:''}</td>
                <td>${this.esc(r.Supplier||'')}</td>
                <td>${this.esc(r.Item_Name_CN||r.Item_Name_TH||'')}</td>
                <td style="text-align:right">฿${this.fmt(r.Total_Price)}</td>
              </tr>`).join('')).join('')}
              </tbody></table>
            </div>`;
        }

        // ── Contractor Responsibility ──
        if (deductRows.length) {
            html += `<div class="pa-sec">
              <h3>🚫 ควรหักคืน 应扣回 — รายการที่ผู้รับเหมาต้องรับผิดชอบเอง 建筑方应自行承担</h3>
              <div style="background:#fef3c7;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#92400e">
                Machinery（机械租赁）和 Service（劳务/服务）按合同应由施工方承担，不应报销为项目材料费。共 <b>฿${this.fmt(deductTotal)}</b> 需扣回。
              </div>
              <table class="pa-table"><thead><tr>
                <th>วันที่ 日期</th><th>ผู้ขาย 供货商</th><th>ประเภท 分类</th><th>รายการ 品名</th><th style="text-align:right">฿</th>
              </tr></thead><tbody>
              ${deductRows.map(r=>`<tr class="row-deduct">
                <td style="white-space:nowrap">${r.Date||''}</td>
                <td>${this.esc(r.Supplier||'')}</td>
                <td><span class="pab deduct">${this.esc(r.Item_Category||'')}</span></td>
                <td>${this.esc(r.Item_Name_CN||r.Item_Name_TH||'')}</td>
                <td style="text-align:right;font-weight:700;color:#92400e">฿${this.fmt(r.Total_Price)}</td>
              </tr>`).join('')}
              <tr style="background:#fef3c7;font-weight:700">
                <td colspan="4" style="text-align:right">รวมหัก 合计应扣</td>
                <td style="text-align:right;color:#92400e">฿${this.fmt(deductTotal)}</td>
              </tr>
              </tbody></table>
            </div>`;
        }

        // ── BOQ Comparison ──
        if (B.length && boqRows.length) {
            // Group by Category
            const cats = [...new Set(boqRows.map(r=>r.category))];
            const catSums = {};
            boqRows.forEach(r => {
                if (!catSums[r.category]) catSums[r.category]={budget:0,actual:0};
                catSums[r.category].budget += r.budgetAmt;
                catSums[r.category].actual += r.actualAmt;
            });

            html += `<div class="pa-sec">
              <h3>📐 เปรียบเทียบ BOQ กับการจัดซื้อจริง BOQ预算对比</h3>
              <div style="background:#eff6ff;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#1e3a8a">
                หมายเหตุ: การจับคู่ใช้ keyword matching (DB12↔DB12螺纹钢) อาจมีความคลาดเคลื่อน ใช้เป็นแนวทางเท่านั้น · 匹配基于关键词，仅供参考
              </div>

              <!-- Category Summary -->
              <table class="pa-table" style="margin-bottom:14px"><thead><tr>
                <th>หมวด 章节</th>
                <th style="text-align:right">งบ BOQ ฿</th>
                <th style="text-align:right">จัดซื้อแล้ว ฿</th>
                <th>ความคืบหน้า</th>
                <th style="text-align:right">ผลต่าง ฿</th>
              </tr></thead><tbody>
              ${cats.map(cat=>{
                const s=catSums[cat];
                const pct2=s.budget>0?Math.min(150,Math.round(s.actual/s.budget*100)):0;
                const over=s.actual>s.budget;
                const barColor=pct2>110?'#dc2626':pct2>90?'#f59e0b':'#10b981';
                const diff=s.actual-s.budget;
                return `<tr>
                  <td><b>${this.esc(cat)}</b></td>
                  <td style="text-align:right">฿${this.fmt(s.budget)}</td>
                  <td style="text-align:right">฿${this.fmt(s.actual)}</td>
                  <td><div class="prog-wrap">
                    <div class="prog-bar"><div class="prog-fill" style="width:${Math.min(100,pct2)}%;background:${barColor}"></div></div>
                    <span style="font-size:12px;${over?'color:#dc2626;font-weight:700':''}">${pct2}%</span>
                  </div></td>
                  <td style="text-align:right;font-weight:${Math.abs(diff)>0?'700':'400'};color:${diff>0?'#dc2626':diff<0?'#10b981':'#64748b'}">
                    ${diff>0?'▲ +':'▼ '}฿${this.fmt(Math.abs(diff))}
                  </td>
                </tr>`;
              }).join('')}
              <tr style="background:#f8fafc;font-weight:700">
                <td>รวม 合计</td>
                <td style="text-align:right">฿${this.fmt(cats.reduce((s,c)=>s+catSums[c].budget,0))}</td>
                <td style="text-align:right">฿${this.fmt(cats.reduce((s,c)=>s+catSums[c].actual,0))}</td>
                <td></td>
                <td style="text-align:right;color:${cats.reduce((s,c)=>s+catSums[c].actual,0)>cats.reduce((s,c)=>s+catSums[c].budget,0)?'#dc2626':'#10b981'}">
                  ${cats.reduce((s,c)=>s+catSums[c].actual-catSums[c].budget,0)>0?'▲':'▼'} ฿${this.fmt(Math.abs(cats.reduce((s,c)=>s+catSums[c].actual-catSums[c].budget,0)))}
                </td>
              </tr>
              </tbody></table>
            </div>`;
        }

        // ── All Records with Flags ──
        const invCount = {};
        this.purchases.forEach(r=>{const k=(r.Invoice_No||'').trim();invCount[k]=(invCount[k]||0)+1;});
        const DEDUCT = new Set(['Consumable','Machinery','Service','Transport']);

        html += `<div class="pa-sec">
          <h3>🧾 รายการทั้งหมด + ผลตรวจ 明细清单 + 标记结果</h3>
          <div style="overflow-x:auto"><table class="pa-table"><thead><tr>
            <th>วันที่</th><th>Invoice</th><th>ผู้ขาย</th><th>ประเภท</th><th>รายการ 品名</th>
            <th style="text-align:right">จำนวน</th><th style="text-align:right">ราคา/หน่วย</th>
            <th style="text-align:right">รวม ฿</th><th>ผลตรวจ 标记</th>
          </tr></thead><tbody>
          ${this.purchases.map(r=>{
            const isDup = (invCount[(r.Invoice_No||'').trim()]||0)>1;
            const isDeduct = DEDUCT.has(r.Item_Category);
            const trCls = isDup?'row-dup':isDeduct?'row-deduct':'';
            const badges = [
              isDup    ? '<span class="pab dup">⚠️ ใบซ้ำ</span>' : '',
              isDeduct ? '<span class="pab deduct">🚫 หักคืน</span>' : '',
              (!isDup&&!isDeduct) ? '<span class="pab ok">✅ ปกติ</span>' : ''
            ].filter(Boolean).join(' ');
            return `<tr class="${trCls}">
              <td style="white-space:nowrap;font-size:12px">${r.Date||''}</td>
              <td style="font-family:monospace;font-size:11px">${this.esc(r.Invoice_No||'')}</td>
              <td>${this.esc(r.Supplier||'')}</td>
              <td><span style="background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:6px;font-size:11px">${this.esc(r.Item_Category||'')}</span></td>
              <td>
                <div style="font-size:13px">${this.esc(r.Item_Name_TH||'')}</div>
                <div style="font-size:11px;color:#94a3b8">${this.esc(r.Item_Name_CN||'')}</div>
              </td>
              <td style="text-align:right;font-size:12px">${r.Qty||''} ${this.esc(r.Unit||'')}</td>
              <td style="text-align:right">฿${this.fmt(r.Unit_Price,2)}</td>
              <td style="text-align:right;font-weight:600">฿${this.fmt(r.Total_Price)}</td>
              <td>${badges}</td>
            </tr>`;
          }).join('')}
          <tr style="background:#f8fafc;font-weight:700">
            <td colspan="7" style="text-align:right">ยอดรวม 合计</td>
            <td style="text-align:right;color:#1e3a8a">฿${this.fmt(this.purchases.reduce((s,r)=>s+Number(r.Total_Price||0),0))}</td>
            <td></td>
          </tr>
          </tbody></table></div>
        </div>`;

        document.getElementById('pa-report').innerHTML = html;
    }
};

window.PurchaseAudit = PurchaseAudit;
