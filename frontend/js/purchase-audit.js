// purchase-audit.js — AI采购核实系统 v4
// 流程: 设置合同规则(一次) → 上传收据 → AI分析
const PurchaseAudit = {
    purchases: [], boq: [], projectId: null, analyzing: false,

    init(pid) { this.projectId=pid; this.purchases=[]; this.boq=[]; this.render(); },
    esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
    fmt(n,d=0){ return n==null?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}); },

    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        box.innerHTML = `
        <div style="padding:16px;max-width:1200px;margin:0 auto">
          <div class="td-head" style="margin-bottom:14px">
            <div><h2 class="td-title">🤖 AI ตรวจสอบการจัดซื้อ <small class="td-th">AI采购核实</small></h2>
            <div class="td-sub">ตั้งค่าสัญญา → อัปโหลดใบเสร็จ → AI วิเคราะห์ทันที</div></div>
          </div>

          <div style="display:flex;gap:4px;margin-bottom:14px;background:#fff;border-radius:12px;padding:6px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            <button class="pab-tab active" id="pab-t1" onclick="PurchaseAudit._tab('setup')">⚙️ ตั้งค่า 设置规则</button>
            <button class="pab-tab" id="pab-t2" onclick="PurchaseAudit._tab('analyze')">📋 วิเคราะห์ 分析单据</button>
          </div>
          <style>
            .pab-tab{flex:1;padding:10px;border:none;border-radius:8px;cursor:pointer;font-size:14px;background:transparent;color:#475569}
            .pab-tab.active{background:#2563eb;color:#fff;font-weight:700}
            .pab-tab:hover:not(.active){background:#f1f5f9}
            .pa-kpi{background:#fff;border-radius:12px;padding:14px 18px;border-left:4px solid #2563eb;box-shadow:0 1px 4px rgba(0,0,0,.06)}
            .pa-kpi-n{font-size:1.6rem;font-weight:700;color:#1e3a8a}
            .pa-kpi.danger{border-left-color:#dc2626}.pa-kpi.danger .pa-kpi-n{color:#dc2626}
            .pa-kpi.warn{border-left-color:#f59e0b}.pa-kpi.warn .pa-kpi-n{color:#d97706}
            .pa-kpi.ok{border-left-color:#10b981}.pa-kpi.ok .pa-kpi-n{color:#059669}
            .pa-sec{background:#fff;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
            .pa-table{width:100%;border-collapse:collapse;font-size:13px}
            .pa-table th{background:#f8fafc;padding:8px 12px;border-bottom:2px solid #e2e8f0;text-align:left;white-space:nowrap;color:#475569}
            .pa-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
            .pab2{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap;margin:1px}
            .pab2.deduct{background:#fef3c7;color:#92400e}
            .pab2.dup{background:#fee2e2;color:#dc2626}
            .pab2.high{background:#fce7f3;color:#9d174d}
            .pab2.ok{background:#dcfce7;color:#166534}
          </style>

          <div id="pab-setup-panel"></div>
          <div id="pab-analyze-panel" style="display:none"></div>
        </div>`;

        this._tab('setup');
    },

    _tab(t) {
        document.getElementById('pab-t1')?.classList.toggle('active', t==='setup');
        document.getElementById('pab-t2')?.classList.toggle('active', t==='analyze');
        if (document.getElementById('pab-setup-panel')) document.getElementById('pab-setup-panel').style.display = t==='setup' ? '' : 'none';
        if (document.getElementById('pab-analyze-panel')) document.getElementById('pab-analyze-panel').style.display = t==='analyze' ? '' : 'none';
        if (t==='setup') this._renderSetup();
        if (t==='analyze') this._renderAnalyze();
    },

    // ─── TAB 1: Setup ───
    _renderSetup() {
        const box = document.getElementById('pab-setup-panel');
        if (!box) return;
        box.innerHTML = `
          <!-- Step 1: Contract -->
          <div class="pa-sec">
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">
              📄 ขั้นตอนที่ 1: อัปโหลดสัญญา <small style="color:#64748b;font-weight:400">步骤1: 上传合同</small>
            </div>
            <div style="font-size:13px;color:#64748b;margin-bottom:14px">
              AI จะอ่านสัญญาและดึงกฎ "ใครรับผิดชอบอะไร" · AI自动提取甲方/乙方责任条款，保存后永久使用
            </div>
            <label style="display:flex;align-items:center;gap:12px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:18px;cursor:pointer;transition:.2s"
              onmouseover="this.style.borderColor='#2563eb';this.style.background='#eff6ff'"
              onmouseout="this.style.borderColor='#cbd5e1';this.style.background='#f8fafc'">
              <span style="font-size:36px">📋</span>
              <div>
                <div id="pa-contract-name" style="font-weight:700;color:#1e3a8a">คลิกเพื่อเลือกไฟล์สัญญา / 点击选择合同文件</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px">PDF, TXT, DOC · ไม่รองรับรูปภาพ / 不支持图片</div>
              </div>
              <input type="file" id="pa-contract-input" accept=".pdf,.txt,.doc,.docx" style="display:none" onchange="PurchaseAudit.extractContract(this)">
            </label>
            <div id="pa-contract-status"></div>
            <div id="pa-rules-extract-panel" style="display:none;margin-top:14px">
              <div id="pa-extracted-display"></div>
              <div style="margin-top:12px">
                <div style="font-size:13px;color:#475569;font-weight:600;margin-bottom:6px">ตรวจสอบและแก้ไขกฎ / 确认规则内容（可修改）：</div>
                <textarea id="pa-rules-text" rows="6" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical"></textarea>
                <button class="sb-btn primary" style="margin-top:8px" onclick="PurchaseAudit.saveRules()">💾 บันทึกกฎลงระบบ 保存规则</button>
              </div>
            </div>
          </div>

          <!-- Saved rules display -->
          <div id="pa-saved-rules-card" style="display:none" class="pa-sec" >
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div style="font-size:15px;font-weight:700;color:#166534">✅ กฎโครงการที่บันทึกไว้แล้ว / 项目规则已保存</div>
              <button class="sb-btn small" onclick="PurchaseAudit._editRules()">✏️ แก้ไข</button>
            </div>
            <pre id="pa-saved-rules-pre" style="font-size:12px;color:#475569;white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;margin:0;max-height:200px;overflow-y:auto"></pre>
          </div>

          <!-- Step 2: BOQ -->
          <div class="pa-sec">
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">
              📐 ขั้นตอนที่ 2: อัปโหลด BOQ <small style="color:#64748b;font-weight:400">步骤2: 上传BOQ预算（可选）</small>
            </div>
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:#2563eb;font-size:13px">
              📂 <span id="pa-boq-name">อัปโหลด villa_boq.csv</span>
              <input type="file" id="pa-boq-inp" accept=".csv" style="display:none">
            </label>
          </div>`;

        // Bind BOQ
        const bi = document.getElementById('pa-boq-inp');
        if (bi) bi.onchange = e => {
            const f=e.target.files[0]; if(!f)return;
            document.getElementById('pa-boq-name').textContent='✅ '+f.name;
            Papa.parse(f,{header:true,skipEmptyLines:true,dynamicTyping:true,complete:r=>{
                this.boq=r.data.filter(row=>{const d=(row.Description||'').toLowerCase();return row.Quantity>0&&!d.includes('subtotal')&&!d.includes('total');});
            }});
        };

        // Load saved rules
        this._loadRules();
    },

    async _loadRules() {
        try {
            const r = await apiRequest('/api/projects/'+this.projectId+'/ai-rules');
            const rules = r.data?.rules;
            if (rules && rules.trim()) {
                const card = document.getElementById('pa-saved-rules-card');
                const pre = document.getElementById('pa-saved-rules-pre');
                if (card) card.style.display = '';
                if (pre) pre.textContent = rules;
            }
        } catch(_) {}
    },

    async extractContract(input) {
        const file = input.files[0]; if (!file) return;
        document.getElementById('pa-contract-name').textContent = '📋 '+file.name;
        const status = document.getElementById('pa-contract-status');
        status.innerHTML = '<div style="padding:10px 0;color:#2563eb;font-size:13px">⏳ AI กำลังอ่านสัญญา... / AI正在分析合同，请稍候...</div>';

        try {
            if (typeof app!=='undefined') app.showLoading();
            const fd = new FormData();
            fd.append('contract', file);
            const r = await fetch(window.location.origin+'/api/projects/'+this.projectId+'/ai-extract-contract',
                {method:'POST', headers:{Authorization:'Bearer '+localStorage.getItem('authToken')}, body:fd});
            const j = await r.json();
            if (typeof app!=='undefined') app.hideLoading();
            if (!j.success) throw new Error(j.message);

            status.innerHTML = '';
            const d = j.data;
            const panel = document.getElementById('pa-rules-extract-panel');
            if (panel) panel.style.display = '';

            // Show extracted info
            const disp = document.getElementById('pa-extracted-display');
            if (disp) {
                disp.innerHTML = `
                  <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;margin-bottom:12px">
                    <b style="color:#166534">✅ AI อ่านสัญญาแล้ว / AI已完成合同分析</b>
                    ${d.project_name ? `<div style="font-size:13px;color:#475569;margin-top:4px">โครงการ: ${this.esc(d.project_name)}</div>` : ''}
                  </div>
                  ${d.owner_responsibilities?.length ? `<div style="margin-bottom:10px">
                    <div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:4px">✅ เจ้าของรับผิดชอบ 甲方负责：</div>
                    ${d.owner_responsibilities.map(x=>`<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:8px;font-size:12px;margin:2px;display:inline-block">${this.esc(x)}</span>`).join('')}
                  </div>` : ''}
                  ${d.contractor_responsibilities?.length || d.auxiliary_materials?.length ? `<div style="margin-bottom:10px">
                    <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:4px">🚫 ผู้รับเหมารับผิดชอบเอง 乙方自负：</div>
                    ${[...(d.contractor_responsibilities||[]),...(d.auxiliary_materials||[])].map(x=>`<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;font-size:12px;margin:2px;display:inline-block">${this.esc(x)}</span>`).join('')}
                  </div>` : ''}`;
            }

            // Pre-fill text for editing
            const rt = document.getElementById('pa-rules-text');
            if (rt) rt.value = d.system_rules || d.rules_summary_cn || '';

        } catch(e) {
            if (typeof app!=='undefined') app.hideLoading();
            const status = document.getElementById('pa-contract-status');
            if (status) status.innerHTML=`<div style="color:#dc2626;padding:10px 0;font-size:13px">❌ ${e.message}</div>`;
        }
    },

    async saveRules() {
        const rules = (document.getElementById('pa-rules-text')||{}).value||'';
        if (!rules.trim()) { alert('กรุณากรอกกฎก่อน / 请先填写规则'); return; }
        try {
            await apiRequest('/api/projects/'+this.projectId+'/ai-rules',{method:'PUT',body:JSON.stringify({rules})});
            if (typeof app!=='undefined'&&app.showToast) app.showToast('✅ บันทึกกฎแล้ว 规则已保存','success');
            // Show saved card
            const card = document.getElementById('pa-saved-rules-card');
            const pre = document.getElementById('pa-saved-rules-pre');
            if (card) card.style.display='';
            if (pre) pre.textContent=rules;
            if (document.getElementById('pa-rules-extract-panel')) document.getElementById('pa-rules-extract-panel').style.display='none';
        } catch(e) { alert(e.message); }
    },

    _editRules() {
        const pre = document.getElementById('pa-saved-rules-pre');
        const card = document.getElementById('pa-saved-rules-card');
        if (card) card.style.display='none';
        const panel = document.getElementById('pa-rules-extract-panel');
        if (panel) panel.style.display='';
        const rt = document.getElementById('pa-rules-text');
        if (rt && pre) rt.value = pre.textContent;
    },

    // ─── TAB 2: Analyze ───
    _renderAnalyze() {
        const box = document.getElementById('pab-analyze-panel');
        if (!box) return;
        box.innerHTML = `
          <div class="pa-sec" style="background:#eff6ff;border:1.5px solid #93c5fd">
            <div style="font-size:15px;font-weight:700;color:#1e40af;margin-bottom:6px">
              ℹ️ ข้อมูลใบเสร็จมาจากแท็บ "วัสดุ 收据材料"
            </div>
            <div style="font-size:13px;color:#1e40af">
              ไม่ต้องอัปโหลดใหม่ · <b>ข้อมูลทั้งหมดที่อัปโหลดในแท็บวัสดุจะถูกใช้โดยอัตโนมัติ</b><br>
              不需要重复上传，「收据材料」里已上传的数据会自动用于分析
            </div>
          </div>
          <div id="pa-data-summary"></div>
          <div id="pa-analyze-bar" style="display:none;margin-bottom:14px">
            <button id="pa-analyze-btn" onclick="PurchaseAudit.runAnalysis()" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;border:none;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;width:100%">
              🤖 เริ่มวิเคราะห์ / 开始AI分析（根据合同规则）
            </button>
          </div>
          <div id="pa-report"></div>`;
        this._loadFromDB();
    },

    // ─── Upload CSV ───
    async uploadCSV(input) {
        const file = input.files[0]; if (!file) return;
        const status = document.getElementById('pa-upload-status');
        if (status) status.innerHTML='<div style="padding:8px 0;color:#2563eb;font-size:13px">⏳ กำลังนำเข้า... 导入中...</div>';
        try {
            if (typeof app!=='undefined') app.showLoading();
            const fd = new FormData();
            fd.append('csv',file);
            if (this.projectId) fd.append('project_id',this.projectId);
            const r = await fetch(window.location.origin+'/api/purchase-records/import-csv',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
            const j = await r.json();
            if (typeof app!=='undefined') app.hideLoading();
            if (!j.success) throw new Error(j.message);
            input.value='';
            if (status) status.innerHTML=`<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;color:#166534">
              ✅ นำเข้า ${j.data.imported} รายการ · ${j.data.suppliers_created} ผู้ขายใหม่ / 导入${j.data.imported}条，新增${j.data.suppliers_created}个供应商
            </div>`;
            await this._loadFromDB();
        } catch(e) {
            if (typeof app!=='undefined') app.hideLoading();
            if (status) status.innerHTML=`<div style="color:#dc2626;padding:8px 0;font-size:13px">❌ ${e.message}</div>`;
        }
    },

    async _loadFromDB() {
        try {
            const r = await apiRequest('/api/purchase-records?limit=300'+(this.projectId?'&project_id='+this.projectId:''));
            this.purchases=(r.data||[]).map(row=>({
                Date: row.purchase_date ? String(row.purchase_date).slice(0,10) : '',Invoice_No:row.invoice_no||'',
                Supplier:row.supplier_name||'',Item_Category:row.item_category||'',
                Item_Name_TH:row.item_name_th||'',Item_Name_CN:row.item_name_cn||'',
                Qty:row.qty,Unit:row.unit||'',Unit_Price:row.unit_price,Total_Price:row.total_price,_id:row.id
            }));
            const bar = document.getElementById('pa-analyze-bar');
            if (bar) bar.style.display = this.purchases.length ? '' : 'none';

            // Show summary
            const summary = document.getElementById('pa-data-summary');
            if (summary && this.purchases.length) {
                const total = this.purchases.reduce((s,r)=>s+Number(r.Total_Price||0),0);
                summary.innerHTML = `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;gap:20px;flex-wrap:wrap;font-size:14px;color:#166534">
                    <span>📋 <b>${this.purchases.length}</b> รายการ 条记录</span>
                    <span>💰 รวม <b>฿${Number(total).toLocaleString('th-TH',{minimumFractionDigits:0})}</b></span>
                    <span>✅ พร้อมวิเคราะห์ 准备就绪，可以分析</span>
                </div>`;
            } else if (summary) {
                summary.innerHTML = `<div style="text-align:center;padding:24px;color:#94a3b8">
                    <div style="font-size:32px">📋</div>
                    <div>ไปอัปโหลดใบเสร็จที่แท็บ "วัสดุ 收据材料" ก่อน<br>请先在「收据材料」标签上传CSV</div>
                </div>`;
            }
        } catch(_) {}
    },

    async runAnalysis() {
        if (this.analyzing) return;
        this.analyzing=true;
        const btn=document.getElementById('pa-analyze-btn');
        if (btn) btn.disabled=true;
        const report=document.getElementById('pa-report');
        if (report) report.innerHTML=`<div class="pa-sec">
          <div id="pa-ai-log" style="font-size:14px;color:#2563eb;margin-bottom:10px">🤖 กำลังเริ่ม... / 启动中...</div>
          <div style="background:#e2e8f0;border-radius:6px;height:8px"><div id="pa-ai-bar" style="background:linear-gradient(90deg,#2563eb,#7c3aed);height:8px;border-radius:6px;width:5%;transition:width .5s"></div></div>
        </div>`;

        const log=m=>{const el=document.getElementById('pa-ai-log');if(el)el.textContent='🤖 '+m;};
        const setBar=p=>{const el=document.getElementById('pa-ai-bar');if(el)el.style.width=p+'%';};

        const doRun = async () => {
            const token=localStorage.getItem('authToken');
            const resp=await fetch(window.location.origin+'/api/projects/'+this.projectId+'/ai-analyze',
                {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({boq:this.boq})});
            if (!resp.ok) throw new Error('Server error '+resp.status);
            const reader=resp.body.getReader();
            const dec=new TextDecoder();
            let buf='';
            setBar(20);
            while(true){
                const{done,value}=await reader.read();
                if(done)break;
                buf+=dec.decode(value,{stream:true});
                const parts=buf.split('\n\n');
                buf=parts.pop()||'';
                for(const part of parts){
                    let ev='',data='';
                    for(const l of part.split('\n')){
                        if(l.startsWith('event: '))ev=l.slice(7).trim();
                        if(l.startsWith('data: '))data=l.slice(6).trim();
                    }
                    if(!data)continue;
                    try{
                        const d=JSON.parse(data);
                        if(ev==='status'){log(d.message);setBar(60);}
                        if(ev==='result'){setBar(100);this._renderReport(d);}
                        if(ev==='error'){
                            const msg = d.message||'';
                            if (msg.includes('503') || msg.includes('high demand') || msg.includes('Service Unavailable')) {
                                throw new Error('__RETRY__:' + msg);
                            }
                            log('❌ '+msg);
                        }
                    }catch(ex){ if(ex.message.startsWith('__RETRY__')) throw ex; }
                }
            }
        };

        // Auto-retry with countdown
        let retryCount = 0;
        const maxRetry = 3;
        const retry = async () => {
            try {
                await doRun();
            } catch(e) {
                if ((e.message||'').startsWith('__RETRY__') || (e.message||'').includes('503') || (e.message||'').includes('high demand')) {
                    if (retryCount < maxRetry) {
                        retryCount++;
                        const wait = retryCount * 15; // 15s, 30s, 45s
                        log(`⏳ AI ยุ่ง รอ ${wait} วินาที... / 模型繁忙，${wait}秒后自动重试 (${retryCount}/${maxRetry})`);
                        setBar(5);
                        for (let i=wait; i>0; i--) {
                            await new Promise(r=>setTimeout(r,1000));
                            log(`⏳ รอ ${i} วินาที... / 等待 ${i} 秒...`);
                        }
                        await retry();
                    } else {
                        if (report) report.innerHTML=`<div class="pa-sec" style="background:#fff5f5;border:1.5px solid #fca5a5">
                            <div style="font-size:16px;font-weight:700;color:#dc2626;margin-bottom:8px">⏰ AI เซิร์ฟเวอร์ยุ่งมาก / AI服务器拥挤</div>
                            <div style="font-size:13px;color:#475569;margin-bottom:12px">
                                ลองใหม่ช่วงอื่น เช่น เช้าตรู่หรือกลางคืน · 建议在非高峰时间重试（早晨或深夜泰国时间）
                            </div>
                            <button onclick="PurchaseAudit.runAnalysis()" class="sb-btn primary">🔄 ลองใหม่ 重试</button>
                        </div>`;
                    }
                } else {
                    if (report) report.innerHTML=`<div style="color:#dc2626;padding:16px">❌ ${e.message}</div>`;
                }
            } finally {
                this.analyzing=false;
                if(btn)btn.disabled=false;
            }
        };

        try { await retry(); }
        catch(e) { this.analyzing=false; if(btn)btn.disabled=false; }
    },

    _renderReport(d) {
        const records=d.records||[];
        const deductRows=records.filter(r=>r.ai?.flags?.includes('deduct'));
        const dupRows=records.filter(r=>r.ai?.flags?.includes('duplicate'));
        const highRows=records.filter(r=>r.ai?.flags?.includes('price_high'));
        const totalAmt=records.reduce((s,r)=>s+Number(r.Total_Price||0),0);
        const deductAmt=deductRows.reduce((s,r)=>s+Number(r.Total_Price||0),0);
        const boqTotal=this.boq.reduce((s,b)=>s+Number(b.Total_Amount||0),0);
        const report=document.getElementById('pa-report');
        if(!report)return;

        let html='';

        // KPIs
        html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">
          <div class="pa-kpi ok"><div class="pa-kpi-n">฿${this.fmt(totalAmt)}</div><div style="font-size:12px;color:#64748b">ยอดรวม 总采购额</div></div>
          ${boqTotal>0?`<div class="pa-kpi ${totalAmt>boqTotal*1.1?'danger':'ok'}"><div class="pa-kpi-n">${Math.round(totalAmt/boqTotal*100)}%</div><div style="font-size:12px;color:#64748b">ใช้งบ 已用预算</div></div>`:''}
          <div class="pa-kpi ${deductAmt>0?'warn':'ok'}"><div class="pa-kpi-n">฿${this.fmt(deductAmt)}</div><div style="font-size:12px;color:#64748b">🚫 ควรหักคืน 应扣回</div></div>
          <div class="pa-kpi ${dupRows.length?'danger':'ok'}"><div class="pa-kpi-n">${dupRows.length}</div><div style="font-size:12px;color:#64748b">⚠️ ใบซ้ำ 重复单据</div></div>
          <div class="pa-kpi ${highRows.length?'warn':'ok'}"><div class="pa-kpi-n">${highRows.length}</div><div style="font-size:12px;color:#64748b">📈 ราคาสูง 价格偏高</div></div>
        </div>`;

        // Deduct section — this is the most important
        if (deductRows.length) {
            html+=`<div class="pa-sec" style="border:2px solid #fde047">
              <h3 style="color:#92400e;font-size:16px">🚫 รายการที่ผู้รับเหมาควรรับผิดชอบ — ต้องเรียกเก็บคืน<br><small style="font-size:13px;color:#475569">应由建筑方承担、需追回款项 · ฿${this.fmt(deductAmt)}</small></h3>
              <table class="pa-table"><thead><tr>
                <th>วันที่ 日期</th><th>Invoice</th><th>ผู้ขาย 供货商</th><th>รายการ 品名</th>
                <th style="text-align:right">฿</th><th>เหตุผล AI</th>
              </tr></thead><tbody>
              ${deductRows.map(r=>`<tr style="background:#fffbeb">
                <td>${r.Date}</td>
                <td style="font-family:monospace;font-size:11px">${this.esc(r.Invoice_No)}</td>
                <td>${this.esc(r.Supplier)}</td>
                <td>${this.esc(r.Item_Name_TH||'')} <span style="color:#94a3b8;font-size:11px">${this.esc(r.Item_Name_CN||'')}</span></td>
                <td style="text-align:right;font-weight:700;color:#92400e">฿${this.fmt(r.Total_Price)}</td>
                <td style="font-size:12px;color:#64748b">${this.esc(r.ai?.reason_th||'')} ${r.ai?.reason_cn?'/ '+this.esc(r.ai.reason_cn):''}</td>
              </tr>`).join('')}
              <tr style="background:#fef3c7;font-weight:700">
                <td colspan="4" style="text-align:right">รวมทั้งหมดที่ต้องเรียกคืน 合计应追回</td>
                <td style="text-align:right;color:#92400e;font-size:16px">฿${this.fmt(deductAmt)}</td>
                <td></td>
              </tr></tbody></table>
            </div>`;
        }

        if (dupRows.length) {
            html+=`<div class="pa-sec"><h3 style="color:#dc2626">⚠️ ใบเสร็จซ้ำ 重复单据</h3>
              <table class="pa-table"><thead><tr><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th><th style="text-align:right">฿</th></tr></thead><tbody>
              ${dupRows.map(r=>`<tr style="background:#fff5f5"><td style="font-family:monospace;font-size:11px">${this.esc(r.Invoice_No)}</td>
                <td>${this.esc(r.Supplier)}</td><td>${this.esc(r.Item_Name_TH||r.Item_Name_CN||'')}</td>
                <td style="text-align:right;font-weight:700;color:#dc2626">฿${this.fmt(r.Total_Price)}</td></tr>`).join('')}
              </tbody></table></div>`;
        }

        // Full table
        html+=`<div class="pa-sec"><h3>🧾 รายการทั้งหมด + ผล AI / 全部明细 + AI分析</h3>
          <div style="overflow-x:auto"><table class="pa-table"><thead><tr>
            <th>วันที่</th><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th>
            <th style="text-align:right">฿</th><th>BOQ</th><th>ผล AI</th>
          </tr></thead><tbody>
          ${records.map(r=>{
              const f=r.ai?.flags||[];
              const badges=[
                f.includes('deduct')?'<span class="pab2 deduct">🚫 หักคืน</span>':'',
                f.includes('duplicate')?'<span class="pab2 dup">⚠️ ซ้ำ</span>':'',
                f.includes('price_high')?'<span class="pab2 high">📈 สูง</span>':'',
                (!f.length||f.every(x=>x==='normal'))?'<span class="pab2 ok">✅ ปกติ</span>':''
              ].filter(Boolean).join('');
              return `<tr>
                <td style="white-space:nowrap;font-size:12px">${r.Date}</td>
                <td style="font-family:monospace;font-size:11px;color:#64748b">${this.esc(r.Invoice_No)}</td>
                <td>${this.esc(r.Supplier)}</td>
                <td><div>${this.esc(r.Item_Name_TH||'')}</div><div style="font-size:11px;color:#94a3b8">${this.esc(r.Item_Name_CN||'')}</div></td>
                <td style="text-align:right;font-weight:600;color:${Number(r.Total_Price)<0?'#10b981':'#1e3a8a'}">฿${this.fmt(r.Total_Price)}</td>
                <td style="font-size:11px;color:#2563eb">${r.ai?.boq_match?this.esc(r.ai.boq_match)+'<br><span style="color:#94a3b8">'+r.ai.boq_confidence+'%</span>':'—'}</td>
                <td>${badges}</td>
              </tr>`;
          }).join('')}
          <tr style="background:#f8fafc;font-weight:700">
            <td colspan="4" style="text-align:right">ยอดรวม 合计</td>
            <td style="text-align:right;color:#1e3a8a">฿${this.fmt(totalAmt)}</td>
            <td colspan="2"></td>
          </tr></tbody></table></div></div>`;

        report.innerHTML=html;
    },

    _showStatus(msg, type) {
        const box=document.getElementById('pa-upload-status');
        if(!box)return;
        const c={ok:'#f0fdf4|#86efac|#166534',warn:'#fffbeb|#fde047|#854d0e',error:'#fef2f2|#fca5a5|#dc2626',info:'#eff6ff|#93c5fd|#1e40af'}[type]||'#eff6ff|#93c5fd|#1e40af';
        const[bg,border,color]=c.split('|');
        box.innerHTML=`<div style="background:${bg};border:1.5px solid ${border};border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;color:${color}">${msg}</div>`;
    },

    _analyze(){}
};

window.PurchaseAudit = PurchaseAudit;
