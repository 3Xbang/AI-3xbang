// purchase-audit.js — AI采购核实系统 (Google Gemini)
const PurchaseAudit = {
    purchases: [], boq: [], projectId: null, analyzing: false,

    init(pid) { this.projectId=pid; this.purchases=[]; this.boq=[]; this.render(); },
    esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
    fmt(n,d=0){ return n==null?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}); },

    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        const isAdmin = PermissionManager.isManager();
        box.innerHTML = `
        <div style="padding:16px;max-width:1200px;margin:0 auto">
          <div class="td-head">
            <div><h2 class="td-title">🤖 AI ตรวจสอบการจัดซื้อ <small class="td-th">AI采购核实</small></h2>
            <div class="td-sub">อัปโหลดใบเสร็จ → AI วิเคราะห์ทันที · 上传收据，AI实时核实</div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <label style="background:#2563eb;color:#fff;border-radius:10px;padding:9px 14px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px">
                📤 <span>อัปโหลดใบเสร็จ CSV</span>
                <input type="file" accept=".csv" style="display:none" onchange="PurchaseAudit.uploadCSV(this)">
              </label>
              <label style="background:#7c3aed;color:#fff;border-radius:10px;padding:9px 14px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px">
                📷 <span>อ่านรูปใบเสร็จ OCR</span>
                <input type="file" accept="image/*" multiple style="display:none" onchange="PurchaseAudit.ocrImages(this)">
              </label>
            </div>
          </div>
          <div id="pa-status"></div>

          <!-- BOQ + Rules row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
            <div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <div style="font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:8px">📐 BOQ 预算文件</div>
              <label id="pa-boq-btn" style="cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;color:#2563eb">
                📂 <span id="pa-boq-name">อัปโหลด villa_boq.csv</span>
                <input type="file" id="pa-boq-input" accept=".csv" style="display:none">
              </label>
            </div>
            ${isAdmin ? `<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
              <div style="font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:8px">⚙️ กฎโครงการ 项目规则</div>
              <textarea id="pa-rules" rows="2" style="width:100%;font-size:12px;border:1.5px solid #e2e8f0;border-radius:8px;padding:6px;resize:none" placeholder="เช่น: ค่าขนส่งเป็นของผู้รับเหมา / 运输费由建筑方承担"></textarea>
              <button class="sb-btn small" style="margin-top:6px" onclick="PurchaseAudit.saveRules()">💾 บันทึก</button>
            </div>` : '<div></div>'}
          </div>

          <!-- OCR results (appears when processing images) -->
          <div id="pa-ocr-results"></div>

          <!-- AI Analyze button -->
          <div id="pa-analyze-bar" style="display:none;margin-bottom:14px">
            <button id="pa-analyze-btn" onclick="PurchaseAudit.runAnalysis()" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:16px;font-weight:700;cursor:pointer;width:100%">
              🤖 เริ่มวิเคราะห์ด้วย AI / 开始AI分析
            </button>
          </div>

          <div id="pa-report"></div>
        </div>

        <style>
          .pa-kpi{background:#fff;border-radius:12px;padding:14px 18px;border-left:4px solid #2563eb;box-shadow:0 1px 4px rgba(0,0,0,.06)}
          .pa-kpi-n{font-size:1.6rem;font-weight:700;color:#1e3a8a}
          .pa-kpi.danger{border-left-color:#dc2626}.pa-kpi.danger .pa-kpi-n{color:#dc2626}
          .pa-kpi.warn{border-left-color:#f59e0b}.pa-kpi.warn .pa-kpi-n{color:#d97706}
          .pa-kpi.ok{border-left-color:#10b981}.pa-kpi.ok .pa-kpi-n{color:#059669}
          .pa-sec{background:#fff;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
          .pa-table{width:100%;border-collapse:collapse;font-size:13px}
          .pa-table th{background:#f8fafc;padding:8px 12px;border-bottom:2px solid #e2e8f0;text-align:left;white-space:nowrap;color:#475569}
          .pa-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
          .pab{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap;margin:1px}
          .pab.deduct{background:#fef3c7;color:#92400e}
          .pab.dup{background:#fee2e2;color:#dc2626}
          .pab.high{background:#fce7f3;color:#9d174d}
          .pab.ok{background:#dcfce7;color:#166534}
          .prog-bar{height:8px;border-radius:4px;background:#e2e8f0;width:120px;overflow:hidden;display:inline-block;vertical-align:middle}
          .prog-fill{height:8px;border-radius:4px;background:#2563eb}
        </style>`;

        this._bindBoq();
        this._loadData();
    },

    // ── Load existing data from DB ──
    async _loadData() {
        await this._loadRules();
        await this._loadFromDB();
    },

    async _loadRules() {
        try {
            const r = await apiRequest('/api/projects/'+this.projectId+'/ai-rules');
            const el = document.getElementById('pa-rules');
            if (el && r.data?.rules) el.value = r.data.rules;
        } catch(_) {}
    },

    async saveRules() {
        const rules = (document.getElementById('pa-rules')||{}).value||'';
        try {
            await apiRequest('/api/projects/'+this.projectId+'/ai-rules',{method:'PUT',body:JSON.stringify({rules})});
            if (typeof app!=='undefined'&&app.showToast) app.showToast('บันทึกกฎแล้ว 规则已保存','success');
        } catch(e) { alert(e.message); }
    },

    _bindBoq() {
        const btn = document.getElementById('pa-boq-btn');
        const input = document.getElementById('pa-boq-input');
        if (!btn||!input) return;
        btn.onclick = () => input.click();
        input.onchange = e => {
            const file = e.target.files[0]; if (!file) return;
            document.getElementById('pa-boq-name').textContent = '✅ '+file.name;
            Papa.parse(file,{header:true,skipEmptyLines:true,dynamicTyping:true,complete:r=>{
                this.boq = r.data.filter(row=>{
                    const d=(row.Description||'').toLowerCase();
                    return row.Quantity>0&&!d.includes('subtotal')&&!d.includes('grand total')&&!d.includes('total');
                });
                this._showStatus(`📐 BOQ โหลดแล้ว ${this.boq.length} รายการ`,'ok');
            }});
        };
    },

    // ── CSV Upload ──
    async uploadCSV(input) {
        const file = input.files[0]; if (!file) return;
        this._showStatus('⏳ กำลังนำเข้า CSV... 导入中...','info');
        try {
            if (typeof app!=='undefined') app.showLoading();
            const fd = new FormData();
            fd.append('csv',file);
            fd.append('project_id',this.projectId);
            const r = await fetch(window.location.origin+'/api/purchase-records/import-csv',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
            const j = await r.json();
            if (typeof app!=='undefined') app.hideLoading();
            if (!j.success) throw new Error(j.message);
            input.value='';
            this._showStatus(`✅ นำเข้า ${j.data.imported} รายการ · ${j.data.suppliers_created} ผู้ขายใหม่ / 导入${j.data.imported}条`,'ok');
            await this._loadFromDB();
        } catch(e) {
            if (typeof app!=='undefined') app.hideLoading();
            this._showStatus('❌ '+e.message,'error');
        }
    },

    // ── OCR Images ──
    async ocrImages(input) {
        const files = Array.from(input.files);
        if (!files.length) return;
        const box = document.getElementById('pa-ocr-results');
        box.innerHTML = `<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            <div style="font-weight:700;color:#7c3aed;font-size:15px;margin-bottom:12px">📷 AI อ่านใบเสร็จ / 正在识别收据图片</div>
            <div id="pa-ocr-items"></div>
        </div>`;

        for (let i=0; i<files.length; i++) {
            const file = files[i];
            const itemBox = document.createElement('div');
            itemBox.id = 'ocr-'+i;
            itemBox.style.cssText = 'padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;margin-bottom:8px';
            itemBox.innerHTML = `<div style="color:#7c3aed;font-size:13px">⏳ กำลังอ่าน ${file.name}...</div>`;
            document.getElementById('pa-ocr-items').appendChild(itemBox);

            try {
                const fd = new FormData();
                fd.append('image', file);
                const r = await fetch(window.location.origin+'/api/ai/ocr-receipt',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
                const j = await r.json();
                if (j.success) {
                    const d = j.data;
                    itemBox.innerHTML = `
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <b style="color:#166534">✅ ${this.esc(file.name)}</b>
                            <button class="sb-btn small primary" onclick="PurchaseAudit.saveOcrData(${i})">💾 บันทึก 保存</button>
                        </div>
                        <div style="font-size:12px;color:#475569;margin-bottom:6px">📅 ${d.date||'?'} | Invoice: ${this.esc(d.invoice_no||'?')} | ร้าน: ${this.esc(d.supplier||'?')}</div>
                        <table style="width:100%;font-size:12px;border-collapse:collapse">
                            <tr style="background:#f8fafc"><th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">รายการ</th><th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">จำนวน</th><th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">ราคา/หน่วย</th><th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">รวม ฿</th></tr>
                            ${(d.items||[]).map(it=>`<tr>
                                <td style="padding:4px 8px;border:1px solid #f1f5f9">${this.esc(it.name_th||'')} <span style="color:#94a3b8">${this.esc(it.name_cn||'')}</span></td>
                                <td style="padding:4px 8px;border:1px solid #f1f5f9;text-align:right">${it.qty} ${this.esc(it.unit||'')}</td>
                                <td style="padding:4px 8px;border:1px solid #f1f5f9;text-align:right">${this.fmt(it.unit_price,2)}</td>
                                <td style="padding:4px 8px;border:1px solid #f1f5f9;text-align:right;font-weight:600">${this.fmt(it.total_price)}</td>
                            </tr>`).join('')}
                        </table>`;
                    itemBox.setAttribute('data-ocr', JSON.stringify(j.data));
                } else {
                    itemBox.innerHTML = `<div style="color:#dc2626">❌ ${file.name}: ${this.esc(j.message)}</div>`;
                }
            } catch(e) {
                itemBox.innerHTML = `<div style="color:#dc2626">❌ ${file.name}: ${e.message}</div>`;
            }
        }
        input.value='';
    },

    async saveOcrData(idx) {
        const itemBox = document.getElementById('ocr-'+idx);
        const raw = itemBox?.getAttribute('data-ocr');
        if (!raw) return;
        const d = JSON.parse(raw);
        let saved = 0;
        for (const item of (d.items||[])) {
            if (!item.name_th&&!item.name_cn) continue;
            try {
                await apiRequest('/api/purchase-records',{method:'POST',body:JSON.stringify({
                    purchase_date: d.date, invoice_no: d.invoice_no, supplier_name: d.supplier,
                    item_name_th: item.name_th, item_name_cn: item.name_cn,
                    qty: item.qty, unit: item.unit, unit_price: item.unit_price,
                    total_price: item.total_price, project_id: this.projectId
                })});
                saved++;
            } catch(e) { console.warn('save item failed', e.message); }
        }
        if (typeof app!=='undefined'&&app.showToast) app.showToast(`บันทึก ${saved} รายการ 已保存${saved}条`,'success');
        await this._loadFromDB();
    },

    // ── Load from DB ──
    async _loadFromDB() {
        try {
            const r = await apiRequest('/api/purchase-records?limit=300&project_id='+this.projectId);
            this.purchases = (r.data||[]).map(row=>({
                Date:(row.purchase_date||'').slice(0,10), Invoice_No:row.invoice_no||'',
                Supplier:row.supplier_name||'', Item_Category:row.item_category||'',
                Item_Name_TH:row.item_name_th||'', Item_Name_CN:row.item_name_cn||'',
                Qty:row.qty, Unit:row.unit||'', Unit_Price:row.unit_price, Total_Price:row.total_price,
                _id: row.id
            }));
            const bar = document.getElementById('pa-analyze-bar');
            if (bar) bar.style.display = this.purchases.length ? '' : 'none';
            if (!this.purchases.length) {
                document.getElementById('pa-report').innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8"><div style="font-size:40px">📋</div><div>อัปโหลด CSV หรือรูปใบเสร็จด้านบน<br>先上传CSV或收据照片</div></div>`;
            }
        } catch(e) {}
    },

    // ── AI Analysis ──
    async runAnalysis() {
        if (this.analyzing) return;
        this.analyzing = true;
        const btn = document.getElementById('pa-analyze-btn');
        if (btn) btn.disabled = true;
        const report = document.getElementById('pa-report');
        report.innerHTML = `<div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            <div id="pa-ai-log" style="font-size:13px;color:#2563eb;margin-bottom:12px">🤖 กำลังเริ่ม AI... / 启动AI中...</div>
            <div id="pa-ai-progress" style="background:#e2e8f0;border-radius:6px;height:8px;margin-bottom:12px"><div id="pa-ai-bar" style="background:linear-gradient(90deg,#2563eb,#7c3aed);height:8px;border-radius:6px;width:0%;transition:width .5s"></div></div>
        </div>`;

        const log = msg => { const el=document.getElementById('pa-ai-log'); if(el) el.textContent='🤖 '+msg; };
        const setBar = pct => { const el=document.getElementById('pa-ai-bar'); if(el) el.style.width=pct+'%'; };

        try {
            const token = localStorage.getItem('authToken');
            const body = JSON.stringify({ boq: this.boq });
            const resp = await fetch(window.location.origin+'/api/projects/'+this.projectId+'/ai-analyze', {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
                body
            });

            if (!resp.ok) throw new Error('Server error '+resp.status);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            setBar(10);
            while(true) {
                const {done,value} = await reader.read();
                if (done) break;
                buf += decoder.decode(value, {stream:true});
                const parts = buf.split('\n\n');
                buf = parts.pop()||'';
                for (const part of parts) {
                    const lines = part.split('\n');
                    let ev='', data='';
                    for (const l of lines) {
                        if (l.startsWith('event: ')) ev=l.slice(7).trim();
                        if (l.startsWith('data: ')) data=l.slice(6).trim();
                    }
                    if (!data) continue;
                    try {
                        const d = JSON.parse(data);
                        if (ev==='status') { log(d.message); setBar(50); }
                        if (ev==='result') { setBar(100); this._renderAIReport(d); }
                        if (ev==='error') { log('❌ '+d.message); }
                    } catch(_) {}
                }
            }
        } catch(e) {
            if (report) report.innerHTML=`<div style="color:#dc2626;padding:16px">❌ ${e.message}</div>`;
        } finally {
            this.analyzing=false;
            if (btn) btn.disabled=false;
        }
    },

    _renderAIReport(d) {
        const records = d.records||[];
        const deductRows = records.filter(r=>r.ai?.flags?.includes('deduct'));
        const dupRows    = records.filter(r=>r.ai?.flags?.includes('duplicate'));
        const highRows   = records.filter(r=>r.ai?.flags?.includes('price_high'));
        const normalRows = records.filter(r=>!r.ai?.flags?.length||r.ai?.flags?.every(f=>f==='normal'));

        const totalAmt   = records.reduce((s,r)=>s+Number(r.Total_Price||0),0);
        const deductAmt  = deductRows.reduce((s,r)=>s+Number(r.Total_Price||0),0);
        const boqTotal   = this.boq.reduce((s,b)=>s+Number(b.Total_Amount||0),0);

        const report = document.getElementById('pa-report');
        let html = '';

        // KPIs
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">
          <div class="pa-kpi ok"><div class="pa-kpi-n">฿${this.fmt(totalAmt)}</div><div style="font-size:12px;color:#64748b">ยอดใบเสร็จรวม 采购总额</div></div>
          ${boqTotal>0?`<div class="pa-kpi ${totalAmt>boqTotal?'danger':'ok'}"><div class="pa-kpi-n">${Math.round(totalAmt/boqTotal*100)}%</div><div style="font-size:12px;color:#64748b">ใช้งบแล้ว 已用预算</div></div>`:''}
          <div class="pa-kpi warn"><div class="pa-kpi-n">฿${this.fmt(deductAmt)}</div><div style="font-size:12px;color:#64748b">🚫 ควรหักคืน 应扣回</div></div>
          <div class="pa-kpi ${dupRows.length?'danger':'ok'}"><div class="pa-kpi-n">${dupRows.length}</div><div style="font-size:12px;color:#64748b">⚠️ ใบเสร็จซ้ำ 重复单据</div></div>
          <div class="pa-kpi ${highRows.length?'warn':'ok'}"><div class="pa-kpi-n">${highRows.length}</div><div style="font-size:12px;color:#64748b">📈 ราคาสูง 价格偏高</div></div>
        </div>`;

        // Deduct section
        if (deductRows.length) {
            html += `<div class="pa-sec"><h3>🚫 รายการที่ผู้รับเหมารับผิดชอบ 应由建筑方承担（应扣回）</h3>
              <table class="pa-table"><thead><tr><th>วันที่</th><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th><th style="text-align:right">฿</th><th>เหตุผล AI</th></tr></thead><tbody>
              ${deductRows.map(r=>`<tr><td>${r.Date}</td><td style="font-family:monospace;font-size:11px">${this.esc(r.Invoice_No)}</td>
                <td>${this.esc(r.Supplier)}</td>
                <td>${this.esc(r.Item_Name_TH||'')} <span style="color:#94a3b8;font-size:11px">${this.esc(r.Item_Name_CN||'')}</span></td>
                <td style="text-align:right;font-weight:700;color:#92400e">฿${this.fmt(r.Total_Price)}</td>
                <td style="font-size:12px;color:#64748b">${this.esc(r.ai?.reason_th||'')} ${r.ai?.reason_cn?'/ '+this.esc(r.ai.reason_cn):''}</td>
              </tr>`).join('')}
              <tr style="background:#fef3c7;font-weight:700"><td colspan="4" style="text-align:right">รวมหัก 应扣总额</td><td style="text-align:right;color:#92400e">฿${this.fmt(deductAmt)}</td><td></td></tr>
              </tbody></table></div>`;
        }

        // Duplicate section
        if (dupRows.length) {
            html += `<div class="pa-sec"><h3>⚠️ ใบเสร็จซ้ำ 重复单据</h3>
              <table class="pa-table"><thead><tr><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th><th style="text-align:right">฿</th></tr></thead><tbody>
              ${dupRows.map(r=>`<tr style="background:#fff5f5"><td style="font-family:monospace;font-size:11px">${this.esc(r.Invoice_No)}</td>
                <td>${this.esc(r.Supplier)}</td>
                <td>${this.esc(r.Item_Name_TH||r.Item_Name_CN||'')}</td>
                <td style="text-align:right;font-weight:700;color:#dc2626">฿${this.fmt(r.Total_Price)}</td>
              </tr>`).join('')}
              </tbody></table></div>`;
        }

        // Full records table
        html += `<div class="pa-sec"><h3>🧾 รายการทั้งหมด + ผลวิเคราะห์ AI 全部明细 + AI分析结果</h3>
          <div style="overflow-x:auto"><table class="pa-table"><thead><tr>
            <th>วันที่</th><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th>
            <th style="text-align:right">฿</th><th>BOQ Match</th><th>ผล AI</th>
          </tr></thead><tbody>
          ${records.map(r=>{
              const f=r.ai?.flags||[];
              const badges=[
                f.includes('deduct')?'<span class="pab deduct">🚫 หักคืน</span>':'',
                f.includes('duplicate')?'<span class="pab dup">⚠️ ซ้ำ</span>':'',
                f.includes('price_high')?'<span class="pab high">📈 สูง</span>':'',
                (!f.length||f.every(x=>x==='normal'))?'<span class="pab ok">✅ ปกติ</span>':''
              ].filter(Boolean).join('');
              const boqMatch = r.ai?.boq_match ? `<span style="font-size:11px;color:#2563eb">${this.esc(r.ai.boq_match)}</span><span style="font-size:10px;color:#94a3b8"> ${r.ai.boq_confidence}%</span>` : '—';
              return `<tr>
                <td style="white-space:nowrap;font-size:12px">${r.Date}</td>
                <td style="font-family:monospace;font-size:11px;color:#64748b">${this.esc(r.Invoice_No)}</td>
                <td style="font-size:13px">${this.esc(r.Supplier)}</td>
                <td><div>${this.esc(r.Item_Name_TH||'')}</div><div style="font-size:11px;color:#94a3b8">${this.esc(r.Item_Name_CN||'')}</div></td>
                <td style="text-align:right;font-weight:600;color:${Number(r.Total_Price)<0?'#10b981':'#1e3a8a'}">฿${this.fmt(r.Total_Price)}</td>
                <td>${boqMatch}</td>
                <td>${badges}</td>
              </tr>`;
          }).join('')}
          <tr style="background:#f8fafc;font-weight:700">
            <td colspan="4" style="text-align:right">ยอดรวม 合计</td>
            <td style="text-align:right;color:#1e3a8a">฿${this.fmt(totalAmt)}</td>
            <td colspan="2"></td>
          </tr>
          </tbody></table></div></div>`;

        if (document.getElementById('pa-report')) document.getElementById('pa-report').innerHTML = html;
    },

    _showStatus(msg, type) {
        const box = document.getElementById('pa-status');
        if (!box) return;
        const colors = {ok:'#f0fdf4|#86efac|#166534', warn:'#fffbeb|#fde047|#854d0e', error:'#fef2f2|#fca5a5|#dc2626', info:'#eff6ff|#93c5fd|#1e40af'};
        const [bg,border,color] = (colors[type]||colors.info).split('|');
        box.innerHTML = `<div style="background:${bg};border:1.5px solid ${border};border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;color:${color}">${msg}</div>`;
    },

    // ─── Core analysis (fallback without AI) ───
    _analyze() {} // AI replaces this
};

window.PurchaseAudit = PurchaseAudit;
