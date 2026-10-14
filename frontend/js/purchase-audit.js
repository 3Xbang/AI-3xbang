// purchase-audit.js -- AI Purchase Audit System v5
const PurchaseAudit = {
    purchases: [], boq: [], projectId: null, analyzing: false,

    init(pid) { this.projectId=pid; this.purchases=[]; this.boq=[]; this.render(); },
    esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    fmt(n,d=0){ return n==null?'-':Number(n).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}); },
    fmtDate(v){ if(!v) return ''; return String(v).slice(0,10); },

    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        box.innerHTML = `
        <div style="padding:16px;max-width:1200px;margin:0 auto">
          <div class="td-head" style="margin-bottom:14px">
            <div><h2 class="td-title">AI ตรวจสอบการจัดซื้อ <small class="td-th">AI采购核实</small></h2>
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
        const t1=document.getElementById('pab-t1'), t2=document.getElementById('pab-t2');
        const s=document.getElementById('pab-setup-panel'), a=document.getElementById('pab-analyze-panel');
        if(t1) t1.classList.toggle('active',t==='setup');
        if(t2) t2.classList.toggle('active',t==='analyze');
        if(s) s.style.display=t==='setup'?'':'none';
        if(a) a.style.display=t==='analyze'?'':'none';
        if(t==='setup') this._renderSetup();
        if(t==='analyze') this._renderAnalyze();
    },

    _renderSetup() {
        const box=document.getElementById('pab-setup-panel');
        if(!box) return;
        box.innerHTML=`
          <div class="pa-sec">
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">
              📄 ขั้นตอนที่ 1: อัปโหลดสัญญา <small style="color:#64748b;font-weight:400">步骤1: 上传合同（PDF或DOCX）</small>
            </div>
            <div style="font-size:13px;color:#64748b;margin-bottom:14px">
              AI จะอ่านสัญญาและดึงกฎ "ใครรับผิดชอบอะไร" บันทึกแล้วใช้ตลอด
            </div>
            <label style="display:flex;align-items:center;gap:12px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:18px;cursor:pointer;transition:.2s"
              onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#cbd5e1'">
              <span style="font-size:36px">📋</span>
              <div>
                <div id="pa-contract-name" style="font-weight:700;color:#1e3a8a">คลิกเพื่อเลือกไฟล์สัญญา / 点击选择合同文件</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px">PDF, DOCX, TXT</div>
              </div>
              <input type="file" id="pa-contract-input" accept=".pdf,.txt,.doc,.docx" style="display:none" onchange="PurchaseAudit.extractContract(this)">
            </label>
            <div id="pa-contract-status"></div>
          </div>

          <div id="pa-rules-extract-panel" style="display:none" class="pa-sec">
            <div style="font-size:15px;font-weight:700;color:#166534;margin-bottom:8px">✅ AI อ่านสัญญาแล้ว / AI已分析合同</div>
            <div id="pa-extracted-display"></div>
            <div style="margin-top:12px">
              <div style="font-size:13px;color:#475569;font-weight:600;margin-bottom:6px">ตรวจสอบและแก้ไขกฎ / 确认规则（可修改）：</div>
              <textarea id="pa-rules-text" rows="5" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical"></textarea>
              <button class="sb-btn primary" style="margin-top:8px" onclick="PurchaseAudit.saveRules()">💾 บันทึกกฎ 保存规则</button>
            </div>
          </div>

          <div id="pa-saved-rules-card" style="display:none" class="pa-sec" >
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div style="font-size:15px;font-weight:700;color:#166534">✅ กฎที่บันทึกไว้ / 已保存的项目规则</div>
              <button class="sb-btn small" onclick="PurchaseAudit._editRules()">✏️ แก้ไข</button>
            </div>
            <pre id="pa-saved-rules-pre" style="font-size:12px;color:#475569;white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;margin:0;max-height:200px;overflow-y:auto"></pre>
          </div>

          <div class="pa-sec">
            <div style="font-size:15px;font-weight:700;color:#1e3a8a;margin-bottom:8px">
              📐 ขั้นตอนที่ 2: BOQ <small style="color:#64748b;font-weight:400">步骤2: 上传BOQ预算（可选）</small>
            </div>
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:#2563eb;font-size:13px">
              📂 <span id="pa-boq-name">อัปโหลด villa_boq.csv 上传BOQ预算</span>
              <input type="file" id="pa-boq-inp" accept=".csv" style="display:none">
            </label>
          </div>`;

        const bi=document.getElementById('pa-boq-inp');
        if(bi) bi.onchange=e=>{
            const f=e.target.files[0]; if(!f) return;
            const nm=document.getElementById('pa-boq-name');
            if(nm) nm.textContent='✅ '+f.name;
            Papa.parse(f,{header:true,skipEmptyLines:true,dynamicTyping:true,complete:r=>{
                this.boq=r.data.filter(row=>{const d=(row.Description||'').toLowerCase();return row.Quantity>0&&!d.includes('subtotal')&&!d.includes('total');});
            }});
        };
        this._loadRules();
    },

    async _loadRules() {
        try {
            const r=await apiRequest('/api/projects/'+this.projectId+'/ai-rules');
            const rules=r.data&&r.data.rules;
            if(rules&&rules.trim()){
                const card=document.getElementById('pa-saved-rules-card');
                const pre=document.getElementById('pa-saved-rules-pre');
                if(card) card.style.display='';
                if(pre) pre.textContent=rules;
            }
        } catch(_) {}
    },

    async extractContract(input) {
        const file=input.files[0]; if(!file) return;
        const nm=document.getElementById('pa-contract-name');
        if(nm) nm.textContent='📋 '+file.name;
        const status=document.getElementById('pa-contract-status');
        if(status) status.innerHTML='<div style="padding:10px 0;color:#2563eb;font-size:13px">⏳ AI กำลังอ่านสัญญา... / AI正在分析合同...</div>';
        try {
            if(typeof app!=='undefined') app.showLoading();
            const fd=new FormData();
            fd.append('contract',file);
            const r=await fetch(window.location.origin+'/api/projects/'+this.projectId+'/ai-extract-contract',
                {method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
            const j=await r.json();
            if(typeof app!=='undefined') app.hideLoading();
            if(!j.success) throw new Error(j.message);
            if(status) status.innerHTML='';
            const d=j.data;
            const panel=document.getElementById('pa-rules-extract-panel');
            if(panel) panel.style.display='';
            const disp=document.getElementById('pa-extracted-display');
            if(disp) {
                disp.innerHTML=`
                  <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px;margin-bottom:10px">
                    <b style="color:#166534">✅ AI อ่านสัญญาแล้ว</b>${d.project_name?` <span style="color:#475569">— ${this.esc(d.project_name)}</span>`:''}
                  </div>
                  ${d.owner_responsibilities&&d.owner_responsibilities.length?`<div style="margin-bottom:8px"><b style="font-size:13px;color:#1e3a8a">✅ เจ้าของรับผิดชอบ 甲方：</b><br>${d.owner_responsibilities.map(x=>`<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:8px;font-size:12px;margin:2px;display:inline-block">${this.esc(x)}</span>`).join('')}</div>`:''}
                  ${(d.contractor_responsibilities&&d.contractor_responsibilities.length)||(d.auxiliary_materials&&d.auxiliary_materials.length)?`<div style="margin-bottom:8px"><b style="font-size:13px;color:#dc2626">🚫 ผู้รับเหมารับผิดชอบเอง 乙方自负：</b><br>${[...(d.contractor_responsibilities||[]),...(d.auxiliary_materials||[])].map(x=>`<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;font-size:12px;margin:2px;display:inline-block">${this.esc(x)}</span>`).join('')}</div>`:''}`;}
            const rt=document.getElementById('pa-rules-text');
            if(rt) rt.value=d.system_rules||d.rules_summary_cn||'';
        } catch(e) {
            if(typeof app!=='undefined') app.hideLoading();
            const st=document.getElementById('pa-contract-status');
            if(st) st.innerHTML=`<div style="color:#dc2626;padding:10px 0;font-size:13px">❌ ${e.message}</div>`;
        }
    },

    async saveRules() {
        const rules=(document.getElementById('pa-rules-text')||{}).value||'';
        if(!rules.trim()){alert('กรุณากรอกกฎก่อน');return;}
        try {
            await apiRequest('/api/projects/'+this.projectId+'/ai-rules',{method:'PUT',body:JSON.stringify({rules})});
            if(typeof app!=='undefined'&&app.showToast) app.showToast('บันทึกกฎแล้ว 规则已保存','success');
            const card=document.getElementById('pa-saved-rules-card');
            const pre=document.getElementById('pa-saved-rules-pre');
            if(card) card.style.display='';
            if(pre) pre.textContent=rules;
            const panel=document.getElementById('pa-rules-extract-panel');
            if(panel) panel.style.display='none';
        } catch(e){alert(e.message);}
    },

    _editRules() {
        const pre=document.getElementById('pa-saved-rules-pre');
        const card=document.getElementById('pa-saved-rules-card');
        if(card) card.style.display='none';
        const panel=document.getElementById('pa-rules-extract-panel');
        if(panel) panel.style.display='';
        const rt=document.getElementById('pa-rules-text');
        if(rt&&pre) rt.value=pre.textContent;
    },

    _renderAnalyze() {
        const box=document.getElementById('pab-analyze-panel');
        if(!box) return;
        box.innerHTML=`
          <div class="pa-sec" style="background:#eff6ff;border:1.5px solid #93c5fd">
            <div style="font-size:14px;font-weight:700;color:#1e40af;margin-bottom:4px">
              ℹ️ ข้อมูลใบเสร็จมาจากแท็บ "วัสดุ 收据材料"
            </div>
            <div style="font-size:13px;color:#1e40af">
              ไม่ต้องอัปโหลดใหม่ ข้อมูลจากแท็บวัสดุจะถูกใช้โดยอัตโนมัติ<br>
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

    async _loadFromDB() {
        try {
            const r=await apiRequest('/api/purchase-records?limit=300'+(this.projectId?'&project_id='+this.projectId:''));
            this.purchases=(r.data||[]).map(row=>({...row, _date: row.purchase_date?String(row.purchase_date).slice(0,10):''}));
            const bar=document.getElementById('pa-analyze-bar');
            if(bar) bar.style.display=this.purchases.length?'':'none';
            const summary=document.getElementById('pa-data-summary');
            if(summary&&this.purchases.length){
                const total=this.purchases.reduce((s,r)=>s+Number(r.total_price||0),0);
                summary.innerHTML=`<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;gap:20px;flex-wrap:wrap;font-size:14px;color:#166534">
                    <span>📋 <b>${this.purchases.length}</b> รายการ</span>
                    <span>💰 รวม <b>฿${Number(total).toLocaleString('th-TH',{minimumFractionDigits:0})}</b></span>
                    <span>✅ พร้อมวิเคราะห์ 准备就绪</span>
                </div>`;
            } else if(summary){
                summary.innerHTML=`<div style="text-align:center;padding:24px;color:#94a3b8"><div style="font-size:32px">📋</div><div>ไปอัปโหลดใบเสร็จที่แท็บ วัสดุ ก่อน<br>请先在收据材料标签上传CSV</div></div>`;
            }
        } catch(e){ console.error('loadFromDB',e); }
    },

    async runAnalysis() {
        if(this.analyzing) return;
        this.analyzing=true;
        const btn=document.getElementById('pa-analyze-btn');
        if(btn) btn.disabled=true;
        const report=document.getElementById('pa-report');
        if(report) report.innerHTML=`<div class="pa-sec">
          <div id="pa-ai-log" style="font-size:14px;color:#2563eb;margin-bottom:10px">🤖 กำลังเริ่ม... / 启动中...</div>
          <div style="background:#e2e8f0;border-radius:6px;height:8px"><div id="pa-ai-bar" style="background:linear-gradient(90deg,#2563eb,#7c3aed);height:8px;border-radius:6px;width:5%;transition:width .5s"></div></div>
        </div>`;
        const log=m=>{const el=document.getElementById('pa-ai-log');if(el)el.textContent='🤖 '+m;};
        const setBar=p=>{const el=document.getElementById('pa-ai-bar');if(el)el.style.width=p+'%';};

        const doRun=async()=>{
            const token=localStorage.getItem('authToken');
            const resp=await fetch(window.location.origin+'/api/projects/'+this.projectId+'/ai-analyze',
                {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({boq:this.boq})});
            if(!resp.ok) throw new Error('Server error '+resp.status);
            const reader=resp.body.getReader();
            const dec=new TextDecoder();
            let buf='';
            setBar(20);
            while(true){
                const{done,value}=await reader.read();
                if(done) break;
                buf+=dec.decode(value,{stream:true});
                const parts=buf.split('\n\n');
                buf=parts.pop()||'';
                for(const part of parts){
                    let ev='',data='';
                    for(const l of part.split('\n')){
                        if(l.startsWith('event: ')) ev=l.slice(7).trim();
                        if(l.startsWith('data: ')) data=l.slice(6).trim();
                    }
                    if(!data) continue;
                    try{
                        const d=JSON.parse(data);
                        if(ev==='status'){log(d.message);setBar(60);}
                        if(ev==='result'){setBar(100);this._renderReport(d);}
                        if(ev==='error'){
                            const msg=d.message||'';
                            if(msg.includes('503')||msg.includes('high demand')||msg.includes('Service Unavailable')) throw new Error('__RETRY__:'+msg);
                            log('❌ '+msg);
                        }
                    } catch(ex){if(ex.message&&ex.message.startsWith('__RETRY__')) throw ex;}
                }
            }
        };

        let retryCount=0;
        const maxRetry=3;
        const retry=async()=>{
            try{
                await doRun();
            }catch(e){
                if((e.message||'').startsWith('__RETRY__')||(e.message||'').includes('503')||(e.message||'').includes('high demand')){
                    if(retryCount<maxRetry){
                        retryCount++;
                        const wait=retryCount*15;
                        log(`AI ยุ่ง รอ ${wait} วิ... / 繁忙，${wait}秒后重试 (${retryCount}/${maxRetry})`);
                        setBar(5);
                        for(let i=wait;i>0;i--){await new Promise(r=>setTimeout(r,1000));log(`รอ ${i} วิ...`);}
                        await retry();
                    } else {
                        if(report) report.innerHTML=`<div class="pa-sec" style="background:#fff5f5;border:1.5px solid #fca5a5">
                            <b style="color:#dc2626">AI ยุ่งมาก / AI服务器繁忙</b><br>
                            <div style="font-size:13px;color:#475569;margin:8px 0">ลองใหม่อีกครั้ง / 请重试</div>
                            <button onclick="PurchaseAudit.runAnalysis()" class="sb-btn primary">🔄 ลองใหม่ 重试</button>
                        </div>`;
                    }
                } else {
                    if(report) report.innerHTML=`<div style="color:#dc2626;padding:16px">❌ ${e.message}</div>`;
                }
            } finally {
                this.analyzing=false;
                if(btn) btn.disabled=false;
            }
        };
        try{await retry();}catch(e){this.analyzing=false;if(btn)btn.disabled=false;}
    },

    _renderReport(d) {
        const records=d.records||[];
        const g=(r,...keys)=>{for(const k of keys){if(r[k]!=null&&r[k]!=='')return r[k];}return '';};
        const gn=(r,...keys)=>{for(const k of keys){if(r[k]!=null)return Number(r[k]);}return 0;};

        const deductRows=records.filter(r=>r.ai&&r.ai.flags&&r.ai.flags.includes('deduct'));
        const dupRows=records.filter(r=>r.ai&&r.ai.flags&&r.ai.flags.includes('duplicate'));
        const highRows=records.filter(r=>r.ai&&r.ai.flags&&r.ai.flags.includes('price_high'));
        const totalAmt=records.reduce((s,r)=>s+gn(r,'Total_Price','total_price'),0);
        const deductAmt=deductRows.reduce((s,r)=>s+gn(r,'Total_Price','total_price'),0);
        const boqTotal=this.boq.reduce((s,b)=>s+Number(b.Total_Amount||0),0);
        const report=document.getElementById('pa-report');
        if(!report) return;

        const isAdmin = PermissionManager.isManager() || PermissionManager.isSupervisor();

        // Store for later use by agreement toggle and print
        this._lastDeductRows = deductRows;
        this._lastDeductAmt = deductAmt;

        // Load existing agreements
        this._agreements = this._agreements || new Set();
        apiRequest('/api/projects/'+this.projectId+'/deduction-agreements').then(r=>{
            (r.data||[]).forEach(a=>this._agreements.add(a.invoice_no+'|'+a.item_name_cn));
            this._reRenderDeductSection(deductRows, deductAmt, isAdmin);
        }).catch(()=>{});

        let html='';
        html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">
          <div class="pa-kpi ok"><div class="pa-kpi-n">฿${this.fmt(totalAmt)}</div><div style="font-size:12px;color:#64748b">ยอดรวม 总采购额</div></div>
          ${boqTotal>0?`<div class="pa-kpi ${totalAmt>boqTotal*1.1?'danger':'ok'}"><div class="pa-kpi-n">${Math.round(totalAmt/boqTotal*100)}%</div><div style="font-size:12px;color:#64748b">ใช้งบ 已用预算</div></div>`:''}
          <div class="pa-kpi ${deductAmt>0?'warn':'ok'}"><div class="pa-kpi-n">฿${this.fmt(deductAmt)}</div><div style="font-size:12px;color:#64748b">🚫 ควรหักคืน 应扣回</div></div>
          <div class="pa-kpi ${dupRows.length?'danger':'ok'}"><div class="pa-kpi-n">${dupRows.length}</div><div style="font-size:12px;color:#64748b">⚠️ ใบซ้ำ 重复单据</div></div>
          <div class="pa-kpi ${highRows.length?'warn':'ok'}"><div class="pa-kpi-n">${highRows.length}</div><div style="font-size:12px;color:#64748b">📈 ราคาสูง 价格偏高</div></div>
        </div>`;

        // Deduct section — rendered separately to allow agreement toggle
        html+=`<div id="pa-deduct-section"></div>`;

        if(dupRows.length){
            html+=`<div class="pa-sec"><h3 style="color:#dc2626">⚠️ ใบเสร็จซ้ำ 重复单据</h3>
              <table class="pa-table"><thead><tr><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th><th style="text-align:right">฿</th></tr></thead><tbody>
              ${dupRows.map(r=>`<tr style="background:#fff5f5">
                <td style="font-family:monospace;font-size:11px">${this.esc(g(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(g(r,'Supplier','supplier_name'))}</td>
                <td>${this.esc(g(r,'Item_Name_TH','item_name_th')||g(r,'Item_Name_CN','item_name_cn'))}</td>
                <td style="text-align:right;font-weight:700;color:#dc2626">฿${this.fmt(gn(r,'Total_Price','total_price'))}</td>
              </tr>`).join('')}
              </tbody></table></div>`;
        }

        html+=`<div class="pa-sec"><h3>🧾 รายการทั้งหมด 全部明细</h3>
          <div style="overflow-x:auto"><table class="pa-table"><thead><tr>
            <th>วันที่</th><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th>
            <th style="text-align:right">฿</th><th>ผล AI</th>
          </tr></thead><tbody>
          ${records.map(r=>{
              const f=r.ai&&r.ai.flags||[];
              const badges=[
                f.includes('deduct')?'<span class="pab2 deduct">🚫 หักคืน</span>':'',
                f.includes('duplicate')?'<span class="pab2 dup">⚠️ ซ้ำ</span>':'',
                f.includes('price_high')?'<span class="pab2 high">📈 สูง</span>':'',
                (!f.length||f.every(x=>x==='normal'))?'<span class="pab2 ok">✅ ปกติ</span>':''
              ].filter(Boolean).join('');
              const total=gn(r,'Total_Price','total_price');
              return `<tr>
                <td style="white-space:nowrap;font-size:12px">${this.fmtDate(g(r,'_date','Date','purchase_date'))}</td>
                <td style="font-family:monospace;font-size:11px;color:#64748b">${this.esc(g(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(g(r,'Supplier','supplier_name'))}</td>
                <td><div>${this.esc(g(r,'Item_Name_TH','item_name_th'))}</div><div style="font-size:11px;color:#94a3b8">${this.esc(g(r,'Item_Name_CN','item_name_cn'))}</div></td>
                <td style="text-align:right;font-weight:600;color:${total<0?'#10b981':'#1e3a8a'}">฿${this.fmt(total)}</td>
                <td>${badges}</td>
              </tr>`;
          }).join('')}
          <tr style="background:#f8fafc;font-weight:700">
            <td colspan="4" style="text-align:right">ยอดรวม 合计</td>
            <td style="text-align:right;color:#1e3a8a">฿${this.fmt(totalAmt)}</td>
            <td></td>
          </tr></tbody></table></div></div>`;

        report.innerHTML=html;
        // Render deduct section after setting innerHTML
        this._reRenderDeductSection(deductRows, deductAmt, isAdmin);
    },

    _reRenderDeductSection(deductRows, deductAmt, isAdmin) {
        const sec = document.getElementById('pa-deduct-section');
        if(!sec || !deductRows.length) { if(sec) sec.innerHTML=''; return; }
        const agreed = this._agreements || new Set();
        const g=(r,...keys)=>{for(const k of keys){if(r[k]!=null&&r[k]!=='')return r[k];}return '';};
        const gn=(r,...keys)=>{for(const k of keys){if(r[k]!=null)return Number(r[k]);}return 0;};

        sec.innerHTML=`<div class="pa-sec" style="border:2px solid #fde047">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div>
              <h3 style="color:#92400e;margin:0">🚫 รายการที่ผู้รับเหมาควรรับผิดชอบ 应由建筑方承担</h3>
              <div style="font-size:13px;color:#92400e;margin-top:4px">รวม 合计应追回: <b>฿${this.fmt(deductAmt)}</b></div>
            </div>
            ${isAdmin?`<button class="sb-btn small" onclick="PurchaseAudit.printContractorReport()" style="white-space:nowrap">🏗️ รายงานสำหรับผู้รับเหมา 乙方报告</button>`:''}
          </div>

          ${deductRows.map(r=>{
              const inv=g(r,'Invoice_No','invoice_no');
              const itemCN=g(r,'Item_Name_CN','item_name_cn');
              const itemTH=g(r,'Item_Name_TH','item_name_th');
              const total=gn(r,'Total_Price','total_price');
              const key=inv+'|'+itemCN;
              const isAgreed=agreed.has(key);
              const ai=r.ai||{};
              return `<div style="background:${isAgreed?'#f0fdf4':'#fffbeb'};border:1.5px solid ${isAgreed?'#86efac':'#fde047'};border-radius:12px;padding:14px 16px;margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
                  <div style="flex:1;min-width:200px">
                    <div style="font-weight:700;font-size:15px;color:#1e293b">${this.esc(itemTH)} <span style="color:#94a3b8;font-size:12px">${this.esc(itemCN)}</span></div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px">📅 ${this.fmtDate(g(r,'_date','Date','purchase_date'))} | Invoice: ${this.esc(inv)} | ${this.esc(g(r,'Supplier','supplier_name'))}</div>
                  </div>
                  <div style="text-align:right;flex:0 0 auto">
                    ${isAdmin?`<div style="font-size:18px;font-weight:700;color:#92400e">฿${this.fmt(total)}</div>`:''}
                    ${isAdmin?`<button class="sb-btn small ${isAgreed?'':'primary'}" onclick="PurchaseAudit.toggleAgreement('${this.esc(inv)}','${this.esc(itemCN)}',${isAgreed})" style="margin-top:4px;white-space:nowrap">
                      ${isAgreed?'✅ ตกลงแล้ว 已协商':'🤝 ตกลง 协商同意'}</button>`:''}
                    ${!isAdmin&&isAgreed?'<span style="color:#166534;font-size:12px">✅ ยืนยันแล้ว 已确认</span>':''}
                  </div>
                </div>

                ${ai.reason_th||ai.reason_cn?`<div style="margin-top:10px;padding:10px;background:rgba(255,255,255,.7);border-radius:8px;font-size:13px">
                  <b>🤖 AI วิเคราะห์:</b> ${this.esc(ai.reason_th||'')} ${ai.reason_cn?'/ '+this.esc(ai.reason_cn):''}
                </div>`:''}

                ${ai.contract_clause?`<div style="margin-top:8px;padding:10px;background:rgba(255,255,255,.7);border-radius:8px;font-size:13px;border-left:3px solid #f59e0b">
                  <b>📋 อ้างอิงสัญญา 合同条款: ${this.esc(ai.contract_clause)}</b>
                  ${ai.clause_text?`<div style="margin-top:4px;color:#475569;font-style:italic">"${this.esc(ai.clause_text)}"</div>`:''}
                  ${ai.explanation_th?`<div style="margin-top:8px;color:#1e3a8a">${this.esc(ai.explanation_th)}</div>`:''}
                  ${ai.explanation_cn?`<div style="margin-top:4px;color:#475569;font-size:12px">${this.esc(ai.explanation_cn)}</div>`:''}
                </div>`:''}
              </div>`;
          }).join('')}
        </div>`;
    },

    async toggleAgreement(invoiceNo, itemCN, isCurrentlyAgreed) {
        try {
            if(isCurrentlyAgreed){
                await apiRequest('/api/projects/'+this.projectId+'/deduction-agreements',{method:'DELETE',body:JSON.stringify({invoice_no:invoiceNo,item_name_cn:itemCN})});
                this._agreements && this._agreements.delete(invoiceNo+'|'+itemCN);
            } else {
                await apiRequest('/api/projects/'+this.projectId+'/deduction-agreements',{method:'POST',body:JSON.stringify({invoice_no:invoiceNo,item_name_cn:itemCN})});
                if(!this._agreements) this._agreements=new Set();
                this._agreements.add(invoiceNo+'|'+itemCN);
            }
            if(typeof app!=='undefined'&&app.showToast) app.showToast(isCurrentlyAgreed?'ยกเลิกการตกลง 取消同意':'ตกลงแล้ว 已标记协商同意','success');
            // Re-render deduct section
            if(this._lastDeductRows) this._reRenderDeductSection(this._lastDeductRows, this._lastDeductAmt, true);
        } catch(e){alert(e.message);}
    },

    printContractorReport() {
        const sec = document.getElementById('pa-deduct-section');
        if(!sec) return;
        const items = sec.querySelectorAll('[data-deduct-item]');
        // Open print window without amounts
        const win = window.open('','_blank');
        const agreed = this._agreements||new Set();
        const rows = Array.from(this._lastDeductRows||[]).filter(r=>{
            const key=(r.invoice_no||r.Invoice_No||'')+'|'+(r.item_name_cn||r.Item_Name_CN||'');
            return agreed.has(key);
        });
        if(!rows.length){alert('ยังไม่มีรายการที่ตกลง กรุณาทำเครื่องหมาย "ตกลง" ก่อน\n请先标记"协商同意"的项目');return;}
        const g=(r,...keys)=>{for(const k of keys){if(r[k]!=null&&r[k]!=='')return r[k];}return '';};
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>รายงานสำหรับผู้รับเหมา / 乙方确认报告</title>
        <style>body{font-family:sans-serif;margin:32px;color:#1e293b}h1{color:#1e3a8a}table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:8px;border:1px solid #e2e8f0;text-align:left}td{padding:8px;border:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}.clause{background:#fffbeb;border-left:3px solid #f59e0b;padding:10px;margin-top:6px;font-size:13px}.footer{margin-top:32px;color:#64748b;font-size:12px}</style>
        </head><body>
        <h1>📋 รายงานรายการที่ผู้รับเหมารับผิดชอบ</h1>
        <h2 style="color:#475569;font-weight:400">乙方应承担费用确认报告</h2>
        <p style="color:#64748b">วันที่ออกรายงาน / 报告日期: ${new Date().toLocaleDateString('th-TH')} | โครงการ / 项目: Mira Villa</p>
        <hr>
        ${rows.map((r,i)=>{
            const ai=r.ai||{};
            return `<div style="margin-bottom:24px;padding:16px;border:1px solid #e2e8f0;border-radius:8px">
              <b style="font-size:16px">${i+1}. ${this.esc(g(r,'item_name_th','Item_Name_TH'))} ${g(r,'item_name_cn','Item_Name_CN')?'/ '+this.esc(g(r,'item_name_cn','Item_Name_CN')):''}</b>
              <div style="color:#64748b;font-size:13px;margin:4px 0">วันที่: ${this.fmtDate(g(r,'_date','purchase_date'))} | Invoice: ${this.esc(g(r,'invoice_no','Invoice_No'))} | ผู้ขาย: ${this.esc(g(r,'supplier_name','Supplier'))}</div>
              <div style="color:#dc2626;font-size:13px">⚠️ จำนวน/金额: [ไม่แสดง / 未显示]</div>
              ${ai.contract_clause?`<div class="clause">
                <b>อ้างอิงสัญญา 合同条款: ${this.esc(ai.contract_clause)}</b>
                ${ai.clause_text?`<div style="font-style:italic;margin:4px 0">"${this.esc(ai.clause_text)}"</div>`:''}
                ${ai.explanation_th?`<div style="margin-top:6px">${this.esc(ai.explanation_th)}</div>`:''}
                ${ai.explanation_cn?`<div style="font-size:12px;color:#475569">${this.esc(ai.explanation_cn)}</div>`:''}
              </div>`:''}
            </div>`;
        }).join('')}
        <div class="footer">
          <hr>
          รายงานนี้จัดทำโดยระบบ AI เพื่อให้ข้อมูลตามสัญญา ไม่ใช่การกล่าวหา<br>
          本报告由AI系统根据合同条款生成，供双方参考确认，非指责文件。
        </div>
        </body></html>`);
        win.document.close();
        win.print();
    },

        let html='';
        html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">
          <div class="pa-kpi ok"><div class="pa-kpi-n">฿${this.fmt(totalAmt)}</div><div style="font-size:12px;color:#64748b">ยอดรวม 总采购额</div></div>
          ${boqTotal>0?`<div class="pa-kpi ${totalAmt>boqTotal*1.1?'danger':'ok'}"><div class="pa-kpi-n">${Math.round(totalAmt/boqTotal*100)}%</div><div style="font-size:12px;color:#64748b">ใช้งบ 已用预算</div></div>`:''}
          <div class="pa-kpi ${deductAmt>0?'warn':'ok'}"><div class="pa-kpi-n">฿${this.fmt(deductAmt)}</div><div style="font-size:12px;color:#64748b">🚫 ควรหักคืน 应扣回</div></div>
          <div class="pa-kpi ${dupRows.length?'danger':'ok'}"><div class="pa-kpi-n">${dupRows.length}</div><div style="font-size:12px;color:#64748b">⚠️ ใบซ้ำ 重复单据</div></div>
          <div class="pa-kpi ${highRows.length?'warn':'ok'}"><div class="pa-kpi-n">${highRows.length}</div><div style="font-size:12px;color:#64748b">📈 ราคาสูง 价格偏高</div></div>
        </div>`;

        if(deductRows.length){
            html+=`<div class="pa-sec" style="border:2px solid #fde047">
              <h3 style="color:#92400e">🚫 รายการที่ผู้รับเหมาควรรับผิดชอบ — ต้องเรียกเก็บคืน 应由建筑方承担、需追回</h3>
              <div style="font-weight:700;color:#92400e;margin-bottom:10px">รวม 合计: ฿${this.fmt(deductAmt)}</div>
              <table class="pa-table"><thead><tr>
                <th>วันที่</th><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th>
                <th style="text-align:right">฿</th><th>เหตุผล AI</th>
              </tr></thead><tbody>
              ${deductRows.map(r=>`<tr style="background:#fffbeb">
                <td>${this.fmtDate(g(r,'_date','Date','purchase_date'))}</td>
                <td style="font-family:monospace;font-size:11px">${this.esc(g(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(g(r,'Supplier','supplier_name'))}</td>
                <td>${this.esc(g(r,'Item_Name_TH','item_name_th'))} <span style="color:#94a3b8;font-size:11px">${this.esc(g(r,'Item_Name_CN','item_name_cn'))}</span></td>
                <td style="text-align:right;font-weight:700;color:#92400e">฿${this.fmt(gn(r,'Total_Price','total_price'))}</td>
                <td style="font-size:12px;color:#64748b">${this.esc(r.ai&&r.ai.reason_th||'')} ${r.ai&&r.ai.reason_cn?'/ '+this.esc(r.ai.reason_cn):''}</td>
              </tr>`).join('')}
              </tbody></table>
            </div>`;
        }

        if(dupRows.length){
            html+=`<div class="pa-sec"><h3 style="color:#dc2626">⚠️ ใบเสร็จซ้ำ 重复单据</h3>
              <table class="pa-table"><thead><tr><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th><th style="text-align:right">฿</th></tr></thead><tbody>
              ${dupRows.map(r=>`<tr style="background:#fff5f5">
                <td style="font-family:monospace;font-size:11px">${this.esc(g(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(g(r,'Supplier','supplier_name'))}</td>
                <td>${this.esc(g(r,'Item_Name_TH','item_name_th')||g(r,'Item_Name_CN','item_name_cn'))}</td>
                <td style="text-align:right;font-weight:700;color:#dc2626">฿${this.fmt(gn(r,'Total_Price','total_price'))}</td>
              </tr>`).join('')}
              </tbody></table></div>`;
        }

        html+=`<div class="pa-sec"><h3>🧾 รายการทั้งหมด + ผล AI 全部明细</h3>
          <div style="overflow-x:auto"><table class="pa-table"><thead><tr>
            <th>วันที่</th><th>Invoice</th><th>ผู้ขาย</th><th>รายการ</th>
            <th style="text-align:right">฿</th><th>ผล AI</th>
          </tr></thead><tbody>
          ${records.map(r=>{
              const f=r.ai&&r.ai.flags||[];
              const badges=[
                f.includes('deduct')?'<span class="pab2 deduct">🚫 หักคืน</span>':'',
                f.includes('duplicate')?'<span class="pab2 dup">⚠️ ซ้ำ</span>':'',
                f.includes('price_high')?'<span class="pab2 high">📈 สูง</span>':'',
                (!f.length||f.every(x=>x==='normal'))?'<span class="pab2 ok">✅ ปกติ</span>':''
              ].filter(Boolean).join('');
              const total=gn(r,'Total_Price','total_price');
              return `<tr>
                <td style="white-space:nowrap;font-size:12px">${this.fmtDate(g(r,'_date','Date','purchase_date'))}</td>
                <td style="font-family:monospace;font-size:11px;color:#64748b">${this.esc(g(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(g(r,'Supplier','supplier_name'))}</td>
                <td><div>${this.esc(g(r,'Item_Name_TH','item_name_th'))}</div><div style="font-size:11px;color:#94a3b8">${this.esc(g(r,'Item_Name_CN','item_name_cn'))}</div></td>
                <td style="text-align:right;font-weight:600;color:${total<0?'#10b981':'#1e3a8a'}">฿${this.fmt(total)}</td>
                <td>${badges}</td>
              </tr>`;
          }).join('')}
          <tr style="background:#f8fafc;font-weight:700">
            <td colspan="4" style="text-align:right">ยอดรวม 合计</td>
            <td style="text-align:right;color:#1e3a8a">฿${this.fmt(totalAmt)}</td>
            <td></td>
          </tr></tbody></table></div></div>`;

        report.innerHTML=html;
    }
};

window.PurchaseAudit = PurchaseAudit;
