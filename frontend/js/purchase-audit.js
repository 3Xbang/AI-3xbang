// purchase-audit.js 鈥?AI閲囪喘鏍稿疄绯荤粺 v4
// 娴佺▼: 璁剧疆鍚堝悓瑙勫垯(涓€娆? 鈫?涓婁紶鏀舵嵁 鈫?AI鍒嗘瀽
const PurchaseAudit = {
    purchases: [], boq: [], projectId: null, analyzing: false,

    init(pid) { this.projectId=pid; this.purchases=[]; this.boq=[]; this.render(); },
    esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); },
    fmt(n,d=0){ return n==null?'-':Number(n).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d}); },

    render() {
        const box = document.getElementById('purchase-audit-container');
        if (!box) return;
        box.innerHTML = `
        <div style="padding:16px;max-width:1200px;margin:0 auto">
          <div class="td-head" style="margin-bottom:14px">
            <div><h2 class="td-title">馃 AI 喔曕福喔о笀喔腑喔氞竵喔侧福喔堗副喔斷笅喔粪箟喔?<small class="td-th">AI閲囪喘鏍稿疄</small></h2>
            <div class="td-sub">喔曕副喙夃竾喔勦箞喔侧釜喔编笉喔嵿覆 鈫?喔副喔涏箓喔弗喔斷箖喔氞箑喔福喙囙笀 鈫?AI 喔о复喙€喔勦福喔侧赴喔箤喔椸副喔權笚喔?/div></div>
          </div>

          <div style="display:flex;gap:4px;margin-bottom:14px;background:#fff;border-radius:12px;padding:6px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            <button class="pab-tab active" id="pab-t1" onclick="PurchaseAudit._tab('setup')">鈿欙笍 喔曕副喙夃竾喔勦箞喔?璁剧疆瑙勫垯</button>
            <button class="pab-tab" id="pab-t2" onclick="PurchaseAudit._tab('analyze')">馃搵 喔о复喙€喔勦福喔侧赴喔箤 鍒嗘瀽鍗曟嵁</button>
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

    // 鈹€鈹€鈹€ TAB 1: Setup 鈹€鈹€鈹€
    _renderSetup() {
        const box = document.getElementById('pab-setup-panel');
        if (!box) return;
        box.innerHTML = `
          <!-- Step 1: Contract -->
          <div class="pa-sec">
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">
              馃搫 喔傕副喙夃笝喔曕腑喔權笚喔掂箞 1: 喔副喔涏箓喔弗喔斷釜喔编笉喔嵿覆 <small style="color:#64748b;font-weight:400">姝ラ1: 涓婁紶鍚堝悓</small>
            </div>
            <div style="font-size:13px;color:#64748b;margin-bottom:14px">
              AI 喔堗赴喔箞喔侧笝喔副喔嵿笉喔侧箒喔ム赴喔斷付喔囙竵喔?"喙冟竸喔｀福喔编笟喔溹复喔斷笂喔笟喔赴喙勦福" 路 AI鑷姩鎻愬彇鐢叉柟/涔欐柟璐ｄ换鏉℃锛屼繚瀛樺悗姘镐箙浣跨敤
            </div>
            <label style="display:flex;align-items:center;gap:12px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:18px;cursor:pointer;transition:.2s"
              onmouseover="this.style.borderColor='#2563eb';this.style.background='#eff6ff'"
              onmouseout="this.style.borderColor='#cbd5e1';this.style.background='#f8fafc'">
              <span style="font-size:36px">馃搵</span>
              <div>
                <div id="pa-contract-name" style="font-weight:700;color:#1e3a8a">喔勦弗喔脆竵喙€喔炧阜喙堗腑喙€喔ム阜喔竵喙勦笩喔ム箤喔副喔嵿笉喔?/ 鐐瑰嚮閫夋嫨鍚堝悓鏂囦欢</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px">PDF, TXT, DOC 路 喙勦浮喙堗福喔竾喔｀副喔氞福喔灌笡喔犩覆喔?/ 涓嶆敮鎸佸浘鐗?/div>
              </div>
              <input type="file" id="pa-contract-input" accept=".pdf,.txt,.doc,.docx" style="display:none" onchange="PurchaseAudit.extractContract(this)">
            </label>
            <div id="pa-contract-status"></div>
            <div id="pa-rules-extract-panel" style="display:none;margin-top:14px">
              <div id="pa-extracted-display"></div>
              <div style="margin-top:12px">
                <div style="font-size:13px;color:#475569;font-weight:600;margin-bottom:6px">喔曕福喔о笀喔腑喔氞箒喔ム赴喙佮竵喙夃箘喔傕竵喔?/ 纭瑙勫垯鍐呭锛堝彲淇敼锛夛細</div>
                <textarea id="pa-rules-text" rows="6" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical"></textarea>
                <button class="sb-btn primary" style="margin-top:8px" onclick="PurchaseAudit.saveRules()">馃捑 喔氞副喔權笚喔多竵喔佮笌喔ム竾喔｀赴喔氞笟 淇濆瓨瑙勫垯</button>
              </div>
            </div>
          </div>

          <!-- Saved rules display -->
          <div id="pa-saved-rules-card" style="display:none" class="pa-sec" >
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div style="font-size:15px;font-weight:700;color:#166534">鉁?喔佮笌喙傕竸喔｀竾喔佮覆喔｀笚喔掂箞喔氞副喔權笚喔多竵喙勦抚喙夃箒喔ム箟喔?/ 椤圭洰瑙勫垯宸蹭繚瀛?/div>
              <button class="sb-btn small" onclick="PurchaseAudit._editRules()">鉁忥笍 喙佮竵喙夃箘喔?/button>
            </div>
            <pre id="pa-saved-rules-pre" style="font-size:12px;color:#475569;white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;margin:0;max-height:200px;overflow-y:auto"></pre>
          </div>

          <!-- Step 2: BOQ -->
          <div class="pa-sec">
            <div style="font-size:16px;font-weight:700;color:#1e3a8a;margin-bottom:4px">
              馃搻 喔傕副喙夃笝喔曕腑喔權笚喔掂箞 2: 喔副喔涏箓喔弗喔?BOQ <small style="color:#64748b;font-weight:400">姝ラ2: 涓婁紶BOQ棰勭畻锛堝彲閫夛級</small>
            </div>
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:#2563eb;font-size:13px">
              馃搨 <span id="pa-boq-name">喔副喔涏箓喔弗喔?villa_boq.csv</span>
              <input type="file" id="pa-boq-inp" accept=".csv" style="display:none">
            </label>
          </div>`;

        // Bind BOQ
        const bi = document.getElementById('pa-boq-inp');
        if (bi) bi.onchange = e => {
            const f=e.target.files[0]; if(!f)return;
            document.getElementById('pa-boq-name').textContent='鉁?'+f.name;
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
        document.getElementById('pa-contract-name').textContent = '馃搵 '+file.name;
        const status = document.getElementById('pa-contract-status');
        status.innerHTML = '<div style="padding:10px 0;color:#2563eb;font-size:13px">鈴?AI 喔佮赋喔ム副喔囙腑喙堗覆喔權釜喔编笉喔嵿覆... / AI姝ｅ湪鍒嗘瀽鍚堝悓锛岃绋嶅€?..</div>';

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
                    <b style="color:#166534">鉁?AI 喔箞喔侧笝喔副喔嵿笉喔侧箒喔ム箟喔?/ AI宸插畬鎴愬悎鍚屽垎鏋?/b>
                    ${d.project_name ? `<div style="font-size:13px;color:#475569;margin-top:4px">喙傕竸喔｀竾喔佮覆喔? ${this.esc(d.project_name)}</div>` : ''}
                  </div>
                  ${d.owner_responsibilities?.length ? `<div style="margin-bottom:10px">
                    <div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:4px">鉁?喙€喔堗箟喔侧競喔竾喔｀副喔氞笢喔脆笖喔娻腑喔?鐢叉柟璐熻矗锛?/div>
                    ${d.owner_responsibilities.map(x=>`<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:8px;font-size:12px;margin:2px;display:inline-block">${this.esc(x)}</span>`).join('')}
                  </div>` : ''}
                  ${d.contractor_responsibilities?.length || d.auxiliary_materials?.length ? `<div style="margin-bottom:10px">
                    <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:4px">馃毇 喔溹腹喙夃福喔编笟喙€喔浮喔侧福喔编笟喔溹复喔斷笂喔笟喙€喔竾 涔欐柟鑷礋锛?/div>
                    ${[...(d.contractor_responsibilities||[]),...(d.auxiliary_materials||[])].map(x=>`<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;font-size:12px;margin:2px;display:inline-block">${this.esc(x)}</span>`).join('')}
                  </div>` : ''}`;
            }

            // Pre-fill text for editing
            const rt = document.getElementById('pa-rules-text');
            if (rt) rt.value = d.system_rules || d.rules_summary_cn || '';

        } catch(e) {
            if (typeof app!=='undefined') app.hideLoading();
            const status = document.getElementById('pa-contract-status');
            if (status) status.innerHTML=`<div style="color:#dc2626;padding:10px 0;font-size:13px">鉂?${e.message}</div>`;
        }
    },

    async saveRules() {
        const rules = (document.getElementById('pa-rules-text')||{}).value||'';
        if (!rules.trim()) { alert('喔佮福喔膏笓喔侧竵喔｀腑喔佮竵喔庎竵喙堗腑喔?/ 璇峰厛濉啓瑙勫垯'); return; }
        try {
            await apiRequest('/api/projects/'+this.projectId+'/ai-rules',{method:'PUT',body:JSON.stringify({rules})});
            if (typeof app!=='undefined'&&app.showToast) app.showToast('鉁?喔氞副喔權笚喔多竵喔佮笌喙佮弗喙夃抚 瑙勫垯宸蹭繚瀛?,'success');
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

    // 鈹€鈹€鈹€ TAB 2: Analyze 鈹€鈹€鈹€
    _renderAnalyze() {
        const box = document.getElementById('pab-analyze-panel');
        if (!box) return;
        box.innerHTML = `
          <div class="pa-sec" style="background:#eff6ff;border:1.5px solid #93c5fd">
            <div style="font-size:15px;font-weight:700;color:#1e40af;margin-bottom:6px">
              鈩癸笍 喔傕箟喔浮喔灌弗喙冟笟喙€喔福喙囙笀喔∴覆喔堗覆喔佮箒喔椸箛喔?"喔о副喔笖喔?鏀舵嵁鏉愭枡"
            </div>
            <div style="font-size:13px;color:#1e40af">
              喙勦浮喙堗笗喙夃腑喔囙腑喔编笡喙傕斧喔ム笖喙冟斧喔∴箞 路 <b>喔傕箟喔浮喔灌弗喔椸副喙夃竾喔浮喔斷笚喔掂箞喔副喔涏箓喔弗喔斷箖喔權箒喔椸箛喔氞抚喔编釜喔斷父喔堗赴喔栢腹喔佮箖喔娻箟喙傕笖喔⑧腑喔编笗喙傕笝喔∴副喔曕复</b><br>
              涓嶉渶瑕侀噸澶嶄笂浼狅紝銆屾敹鎹潗鏂欍€嶉噷宸蹭笂浼犵殑鏁版嵁浼氳嚜鍔ㄧ敤浜庡垎鏋?            </div>
          </div>
          <div id="pa-data-summary"></div>
          <div id="pa-analyze-bar" style="display:none;margin-bottom:14px">
            <button id="pa-analyze-btn" onclick="PurchaseAudit.runAnalysis()" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;border:none;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;width:100%">
              馃 喙€喔｀复喙堗浮喔о复喙€喔勦福喔侧赴喔箤 / 寮€濮婣I鍒嗘瀽锛堟牴鎹悎鍚岃鍒欙級
            </button>
          </div>
          <div id="pa-report"></div>`;
        this._loadFromDB();
    },

    // 鈹€鈹€鈹€ Upload CSV 鈹€鈹€鈹€
    async uploadCSV(input) {
        const file = input.files[0]; if (!file) return;
        const status = document.getElementById('pa-upload-status');
        if (status) status.innerHTML='<div style="padding:8px 0;color:#2563eb;font-size:13px">鈴?喔佮赋喔ム副喔囙笝喔赤箑喔傕箟喔?.. 瀵煎叆涓?..</div>';
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
              鉁?喔權赋喙€喔傕箟喔?${j.data.imported} 喔｀覆喔⑧竵喔侧福 路 ${j.data.suppliers_created} 喔溹腹喙夃競喔侧涪喙冟斧喔∴箞 / 瀵煎叆${j.data.imported}鏉★紝鏂板${j.data.suppliers_created}涓緵搴斿晢
            </div>`;
            await this._loadFromDB();
        } catch(e) {
            if (typeof app!=='undefined') app.hideLoading();
            if (status) status.innerHTML=`<div style="color:#dc2626;padding:8px 0;font-size:13px">鉂?${e.message}</div>`;
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
                    <span>馃搵 <b>${this.purchases.length}</b> 喔｀覆喔⑧竵喔侧福 鏉¤褰?/span>
                    <span>馃挵 喔｀抚喔?<b>喔?{Number(total).toLocaleString('th-TH',{minimumFractionDigits:0})}</b></span>
                    <span>鉁?喔炧福喙夃腑喔∴抚喔脆箑喔勦福喔侧赴喔箤 鍑嗗灏辩华锛屽彲浠ュ垎鏋?/span>
                </div>`;
            } else if (summary) {
                summary.innerHTML = `<div style="text-align:center;padding:24px;color:#94a3b8">
                    <div style="font-size:32px">馃搵</div>
                    <div>喙勦笡喔副喔涏箓喔弗喔斷箖喔氞箑喔福喙囙笀喔椸傅喙堗箒喔椸箛喔?"喔о副喔笖喔?鏀舵嵁鏉愭枡" 喔佮箞喔笝<br>璇峰厛鍦ㄣ€屾敹鎹潗鏂欍€嶆爣绛句笂浼燙SV</div>
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
          <div id="pa-ai-log" style="font-size:14px;color:#2563eb;margin-bottom:10px">馃 喔佮赋喔ム副喔囙箑喔｀复喙堗浮... / 鍚姩涓?..</div>
          <div style="background:#e2e8f0;border-radius:6px;height:8px"><div id="pa-ai-bar" style="background:linear-gradient(90deg,#2563eb,#7c3aed);height:8px;border-radius:6px;width:5%;transition:width .5s"></div></div>
        </div>`;

        const log=m=>{const el=document.getElementById('pa-ai-log');if(el)el.textContent='馃 '+m;};
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
                            log('鉂?'+msg);
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
                        log(`鈴?AI 喔⑧父喙堗竾 喔｀腑 ${wait} 喔о复喔權覆喔椸傅... / 妯″瀷绻佸繖锛?{wait}绉掑悗鑷姩閲嶈瘯 (${retryCount}/${maxRetry})`);
                        setBar(5);
                        for (let i=wait; i>0; i--) {
                            await new Promise(r=>setTimeout(r,1000));
                            log(`鈴?喔｀腑 ${i} 喔о复喔權覆喔椸傅... / 绛夊緟 ${i} 绉?..`);
                        }
                        await retry();
                    } else {
                        if (report) report.innerHTML=`<div class="pa-sec" style="background:#fff5f5;border:1.5px solid #fca5a5">
                            <div style="font-size:16px;font-weight:700;color:#dc2626;margin-bottom:8px">鈴?AI 喙€喔嬥复喔｀箤喔熰箑喔о腑喔｀箤喔⑧父喙堗竾喔∴覆喔?/ AI鏈嶅姟鍣ㄦ嫢鎸?/div>
                            <div style="font-size:13px;color:#475569;margin-bottom:12px">
                                喔ム腑喔囙箖喔浮喙堗笂喙堗抚喔囙腑喔粪箞喔?喙€喔娻箞喔?喙€喔娻箟喔侧笗喔｀腹喙堗斧喔｀阜喔竵喔ム覆喔囙竸喔粪笝 路 寤鸿鍦ㄩ潪楂樺嘲鏃堕棿閲嶈瘯锛堟棭鏅ㄦ垨娣卞娉板浗鏃堕棿锛?                            </div>
                            <button onclick="PurchaseAudit.runAnalysis()" class="sb-btn primary">馃攧 喔ム腑喔囙箖喔浮喙?閲嶈瘯</button>
                        </div>`;
                    }
                } else {
                    if (report) report.innerHTML=`<div style="color:#dc2626;padding:16px">鉂?${e.message}</div>`;
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
        // Handle both DB field names (snake_case) and mapped names
        const get = (r, ...keys) => { for(const k of keys) { if(r[k]!=null && r[k]!=='') return r[k]; } return ''; };
        const getN = (r, ...keys) => { for(const k of keys) { if(r[k]!=null) return Number(r[k]); } return 0; };

        const deductRows=records.filter(r=>r.ai?.flags?.includes('deduct'));
        const dupRows=records.filter(r=>r.ai?.flags?.includes('duplicate'));
        const highRows=records.filter(r=>r.ai?.flags?.includes('price_high'));
        const totalAmt=records.reduce((s,r)=>s+getN(r,'Total_Price','total_price'),0);
        const deductAmt=deductRows.reduce((s,r)=>s+getN(r,'Total_Price','total_price'),0);
        const boqTotal=this.boq.reduce((s,b)=>s+Number(b.Total_Amount||0),0);
        const report=document.getElementById('pa-report');
        if(!report)return;

        let html='';

        // KPIs
        html+=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">
          <div class="pa-kpi ok"><div class="pa-kpi-n">喔?{this.fmt(totalAmt)}</div><div style="font-size:12px;color:#64748b">喔⑧腑喔斷福喔о浮 鎬婚噰璐</div></div>
          ${boqTotal>0?`<div class="pa-kpi ${totalAmt>boqTotal*1.1?'danger':'ok'}"><div class="pa-kpi-n">${Math.round(totalAmt/boqTotal*100)}%</div><div style="font-size:12px;color:#64748b">喙冟笂喙夃竾喔?宸茬敤棰勭畻</div></div>`:''}
          <div class="pa-kpi ${deductAmt>0?'warn':'ok'}"><div class="pa-kpi-n">喔?{this.fmt(deductAmt)}</div><div style="font-size:12px;color:#64748b">馃毇 喔勦抚喔｀斧喔编竵喔勦阜喔?搴旀墸鍥?/div></div>
          <div class="pa-kpi ${dupRows.length?'danger':'ok'}"><div class="pa-kpi-n">${dupRows.length}</div><div style="font-size:12px;color:#64748b">鈿狅笍 喙冟笟喔嬥箟喔?閲嶅鍗曟嵁</div></div>
          <div class="pa-kpi ${highRows.length?'warn':'ok'}"><div class="pa-kpi-n">${highRows.length}</div><div style="font-size:12px;color:#64748b">馃搱 喔｀覆喔勦覆喔腹喔?浠锋牸鍋忛珮</div></div>
        </div>`;

        // Deduct section
        if (deductRows.length) {
            html+=`<div class="pa-sec" style="border:2px solid #fde047">
              <h3 style="color:#92400e;font-size:16px">馃毇 喔｀覆喔⑧竵喔侧福喔椸傅喙堗笢喔灌箟喔｀副喔氞箑喔浮喔侧竸喔о福喔｀副喔氞笢喔脆笖喔娻腑喔?鈥?喔曕箟喔竾喙€喔｀傅喔⑧竵喙€喔佮箛喔氞竸喔粪笝<br><small style="font-size:13px;color:#475569">搴旂敱寤虹瓚鏂规壙鎷呫€侀渶杩藉洖娆鹃」 路 喔?{this.fmt(deductAmt)}</small></h3>
              <table class="pa-table"><thead><tr>
                <th>喔о副喔權笚喔掂箞 鏃ユ湡</th><th>Invoice</th><th>喔溹腹喙夃競喔侧涪 渚涜揣鍟?/th><th>喔｀覆喔⑧竵喔侧福 鍝佸悕</th>
                <th style="text-align:right">喔?/th><th>喙€喔笗喔膏笢喔?AI</th>
              </tr></thead><tbody>
              ${deductRows.map(r=>`<tr style="background:#fffbeb">
                <td>${get(r,'Date','purchase_date')}</td>
                <td style="font-family:monospace;font-size:11px">${this.esc(get(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(get(r,'Supplier','supplier_name'))}</td>
                <td>${this.esc(get(r,'Item_Name_TH','item_name_th'))} <span style="color:#94a3b8;font-size:11px">${this.esc(get(r,'Item_Name_CN','item_name_cn'))}</span></td>
                <td style="text-align:right;font-weight:700;color:#92400e">喔?{this.fmt(getN(r,'Total_Price','total_price'))}</td>
                <td style="font-size:12px;color:#64748b">${this.esc(r.ai?.reason_th||'')} ${r.ai?.reason_cn?'/ '+this.esc(r.ai.reason_cn):''}</td>
              </tr>`).join('')}
              <tr style="background:#fef3c7;font-weight:700">
                <td colspan="4" style="text-align:right">喔｀抚喔∴笚喔编箟喔囙斧喔∴笖喔椸傅喙堗笗喙夃腑喔囙箑喔｀傅喔⑧竵喔勦阜喔?鍚堣搴旇拷鍥?/td>
                <td style="text-align:right;color:#92400e;font-size:16px">喔?{this.fmt(deductAmt)}</td>
                <td></td>
              </tr></tbody></table>
            </div>`;
        }

        if (dupRows.length) {
            html+=`<div class="pa-sec"><h3 style="color:#dc2626">鈿狅笍 喙冟笟喙€喔福喙囙笀喔嬥箟喔?閲嶅鍗曟嵁</h3>
              <table class="pa-table"><thead><tr><th>Invoice</th><th>喔溹腹喙夃競喔侧涪</th><th>喔｀覆喔⑧竵喔侧福</th><th style="text-align:right">喔?/th></tr></thead><tbody>
              ${dupRows.map(r=>`<tr style="background:#fff5f5"><td style="font-family:monospace;font-size:11px">${this.esc(get(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(get(r,'Supplier','supplier_name'))}</td>
                <td>${this.esc(get(r,'Item_Name_TH','item_name_th')||get(r,'Item_Name_CN','item_name_cn'))}</td>
                <td style="text-align:right;font-weight:700;color:#dc2626">喔?{this.fmt(getN(r,'Total_Price','total_price'))}</td></tr>`).join('')}
              </tbody></table></div>`;
        }

        // Full table
        html+=`<div class="pa-sec"><h3>馃Ь 喔｀覆喔⑧竵喔侧福喔椸副喙夃竾喔浮喔?+ 喔溹弗 AI / 鍏ㄩ儴鏄庣粏 + AI鍒嗘瀽</h3>
          <div style="overflow-x:auto"><table class="pa-table"><thead><tr>
            <th>喔о副喔權笚喔掂箞</th><th>Invoice</th><th>喔溹腹喙夃競喔侧涪</th><th>喔｀覆喔⑧竵喔侧福</th>
            <th style="text-align:right">喔?/th><th>BOQ</th><th>喔溹弗 AI</th>
          </tr></thead><tbody>
          ${records.map(r=>{
              const f=r.ai?.flags||[];
              const badges=[
                f.includes('deduct')?'<span class="pab2 deduct">馃毇 喔副喔佮竸喔粪笝</span>':'',
                f.includes('duplicate')?'<span class="pab2 dup">鈿狅笍 喔嬥箟喔?/span>':'',
                f.includes('price_high')?'<span class="pab2 high">馃搱 喔腹喔?/span>':'',
                (!f.length||f.every(x=>x==='normal'))?'<span class="pab2 ok">鉁?喔涏竵喔曕复</span>':''
              ].filter(Boolean).join('');
              const dateStr = get(r,'Date','purchase_date');
              const total = getN(r,'Total_Price','total_price');
              return `<tr>
                <td style="white-space:nowrap;font-size:12px">${typeof dateStr==='object'?String(dateStr).slice(0,10):dateStr}</td>
                <td style="font-family:monospace;font-size:11px;color:#64748b">${this.esc(get(r,'Invoice_No','invoice_no'))}</td>
                <td>${this.esc(get(r,'Supplier','supplier_name'))}</td>
                <td><div>${this.esc(get(r,'Item_Name_TH','item_name_th'))}</div><div style="font-size:11px;color:#94a3b8">${this.esc(get(r,'Item_Name_CN','item_name_cn'))}</div></td>
                <td style="text-align:right;font-weight:600;color:${total<0?'#10b981':'#1e3a8a'}">喔?{this.fmt(total)}</td>
                <td style="font-size:11px;color:#2563eb">${r.ai?.boq_match?this.esc(r.ai.boq_match)+'<br><span style="color:#94a3b8">'+r.ai.boq_confidence+'%</span>':'鈥?}</td>
                <td>${badges}</td>
              </tr>`;
          }).join('')}
          <tr style="background:#f8fafc;font-weight:700">
            <td colspan="4" style="text-align:right">喔⑧腑喔斷福喔о浮 鍚堣</td>
            <td style="text-align:right;color:#1e3a8a">喔?{this.fmt(totalAmt)}</td>
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
