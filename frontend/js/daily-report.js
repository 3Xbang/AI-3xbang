// daily-report.js — Daily Construction Report v2 (Mobile-first UX)
const DailyReport = {
    projectId: null,
    date: null,
    data: null,
    config: { machinery: [], workers: [] },
    saving: false,

    _today() { return new Date(Date.now()+7*3600000).toISOString().slice(0,10); },
    esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },

    async init(projectId) {
        this.projectId = projectId;
        this.date = this._today();
        await this.load();
    },

    async load() {
        const box = document.getElementById('site-board-container');
        if (box) box.innerHTML = '<div style="padding:40px;text-align:center"><div style="font-size:32px">⏳</div><div style="color:#64748b;margin-top:8px">กำลังโหลด... Loading...</div></div>';
        try {
            const r = await apiRequest('/api/projects/'+this.projectId+'/daily-report?date='+this.date);
            this.data = r.data;
            this.config = r.config || { machinery: [], workers: [] };
            this.render();
        } catch(e) {
            if (box) box.innerHTML = '<div style="padding:24px;color:#dc2626">โหลดไม่ได้ / Load failed: '+this.esc(e.message)+'</div>';
        }
    },

    render() {
        const box = document.getElementById('site-board-container');
        if (!box) return;
        const d = this.data || {};
        const mach = d.machinery || {};
        const work = d.workers || {};
        const perf = d.performance || [];
        while (perf.length < 5) perf.push({work:'',unit:'',today:'',other_day:'',total:'',description:''});

        box.innerHTML = `
<style>
.dr2{max-width:680px;margin:0 auto;padding:0 0 100px 0;font-family:sans-serif}
.dr2-top{background:#1e3a8a;color:#fff;padding:14px 16px;border-radius:12px 12px 0 0}
.dr2-top h2{font-size:17px;margin:0 0 2px}
.dr2-top small{opacity:.75;font-size:12px}
.dr2-date{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
.dr2-date input[type=date]{padding:8px 10px;border-radius:8px;border:none;font-size:15px;color:#1e3a8a;font-weight:700;background:#fff;min-width:150px}
.dr2-date input[type=text]{padding:8px 10px;border-radius:8px;border:none;font-size:14px;color:#1e3a8a;width:80px}
.dr2-date label{font-size:13px;opacity:.8}

.dr2-sec{background:#fff;margin:2px 0;padding:14px 16px}
.dr2-sec-title{font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.dr2-sec-title small{color:#64748b;font-weight:400;font-size:12px}

/* Stepper rows */
.dr2-row{display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;gap:8px}
.dr2-row:last-child{border-bottom:none}
.dr2-row-label{flex:1;font-size:15px;color:#1e293b}
.dr2-stepper{display:flex;align-items:center;gap:0;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden}
.dr2-stepper button{width:40px;height:40px;border:none;background:#f8fafc;font-size:20px;cursor:pointer;color:#1e3a8a;font-weight:700;flex-shrink:0}
.dr2-stepper button:active{background:#e2e8f0}
.dr2-stepper input{width:50px;height:40px;border:none;border-left:1.5px solid #e2e8f0;border-right:1.5px solid #e2e8f0;text-align:center;font-size:16px;font-weight:700;color:#1e293b;-moz-appearance:textfield}
.dr2-stepper input::-webkit-inner-spin-button{display:none}
.dr2-accum{font-size:13px;color:#64748b;min-width:60px;text-align:center}
.dr2-accum-label{font-size:11px;color:#94a3b8}

/* Performance table - simplified for mobile */
.dr2-perf-row{display:grid;grid-template-columns:1fr 60px 70px 70px;gap:6px;margin-bottom:8px;align-items:start}
.dr2-perf-row input{padding:10px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box}
.dr2-perf-desc{grid-column:1/-1}
.dr2-perf-desc input{font-size:13px;color:#64748b}

/* Weather buttons */
.dr2-weather-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.dr2-w-btn{flex:1;min-width:100px;padding:10px 8px;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;font-size:13px;text-align:center;background:#fff;transition:.15s}
.dr2-w-btn.active{border-color:#3b82f6;background:#eff6ff;color:#1e40af;font-weight:700}
.dr2-w-btn:active{transform:scale(.97)}

/* Sticky save bar */
.dr2-save-bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1.5px solid #e2e8f0;padding:12px 16px;display:flex;gap:10px;z-index:100;box-shadow:0 -4px 20px rgba(0,0,0,.08)}
.dr2-save-btn{flex:1;background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;border:none;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer}
.dr2-sign-check{display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer}
.dr2-sign-check input{width:22px;height:22px;cursor:pointer}
</style>

<div class="dr2">
  <!-- Header -->
  <div class="dr2-top">
    <h2>📋 Daily Construction Report</h2>
    <small>รายงานการก่อสร้างประจำวัน / 施工日报</small>
    <div class="dr2-date">
      <label>วันที่ Date:</label>
      <input type="date" id="dr-date" value="${this.esc(this.date)}" onchange="DailyReport._changeDate(this.value)">
      <label>สัปดาห์ Week:</label>
      <input type="text" id="dr-week" placeholder="W20" value="${this.esc(d.week_no||'')}">
    </div>
  </div>

  <!-- Quick summary bar -->
  <div style="background:#f0fdf4;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #bbf7d0">
    <span style="font-size:13px;color:#166534">
      🔧 <b id="dr-mach-total">${this._sumToday(mach)}</b> เครื่องจักร &nbsp;
      👷 <b id="dr-work-total">${this._sumToday(work)}</b> คน วันนี้
    </span>
    <span style="font-size:12px;color:#64748b">${d.foreman_signed ? '✅ Signed' : '⏳ Not signed'}</span>
  </div>

  <!-- MACHINERY -->
  <div class="dr2-sec">
    <div class="dr2-sec-title">🚜 MACHINERY <small>เครื่องจักร / 机械设备</small>
      <span style="margin-left:auto;font-size:11px;color:#94a3b8">TODAY &nbsp;&nbsp;&nbsp;&nbsp; ACCUM.</span>
    </div>
    ${this.config.machinery.map(m => `
    <div class="dr2-row">
      <div class="dr2-row-label">${this.esc(m)}</div>
      <div class="dr2-stepper">
        <button onclick="DailyReport._step('mach','${this.esc(m)}','today',-1)">−</button>
        <input type="number" id="m-${this.esc(m)}-today" value="${mach[m]?.today||0}" min="0"
          oninput="DailyReport._updateSummary()">
        <button onclick="DailyReport._step('mach','${this.esc(m)}','today',1)">+</button>
      </div>
      <div class="dr2-accum">
        <div class="dr2-accum-label">สะสม</div>
        <input type="number" id="m-${this.esc(m)}-accum" value="${mach[m]?.accum||0}" min="0"
          style="width:50px;border:1.5px solid #e2e8f0;border-radius:6px;padding:4px;text-align:center;font-size:13px">
      </div>
    </div>`).join('')}
  </div>

  <!-- WORKERS -->
  <div class="dr2-sec">
    <div class="dr2-sec-title">👷 WORKER <small>ผู้ปฏิบัติงาน / 工人</small>
      <span style="margin-left:auto;font-size:11px;color:#94a3b8">TODAY &nbsp;&nbsp;&nbsp;&nbsp; ACCUM.</span>
    </div>
    ${this.config.workers.map(w => `
    <div class="dr2-row">
      <div class="dr2-row-label">${this.esc(w)}</div>
      <div class="dr2-stepper">
        <button onclick="DailyReport._step('worker','${this.esc(w)}','today',-1)">−</button>
        <input type="number" id="w-${this.esc(w)}-today" value="${work[w]?.today||0}" min="0"
          oninput="DailyReport._updateSummary()">
        <button onclick="DailyReport._step('worker','${this.esc(w)}','today',1)">+</button>
      </div>
      <div class="dr2-accum">
        <div class="dr2-accum-label">สะสม</div>
        <input type="number" id="w-${this.esc(w)}-accum" value="${work[w]?.accum||0}" min="0"
          style="width:50px;border:1.5px solid #e2e8f0;border-radius:6px;padding:4px;text-align:center;font-size:13px">
      </div>
    </div>`).join('')}
  </div>

  <!-- PERFORMANCE -->
  <div class="dr2-sec">
    <div class="dr2-sec-title">📊 PERFORMANCE <small>ผลการดำเนินการ / 施工量</small></div>
    <div style="display:grid;grid-template-columns:1fr 60px 70px 70px;gap:4px;margin-bottom:6px;font-size:11px;color:#64748b;text-align:center;padding:0 2px">
      <span style="text-align:left">งาน / Work</span><span>หน่วย<br>Unit</span><span>วันนี้<br>Today</span><span>รวม<br>Total</span>
    </div>
    <div id="dr-perf-list">
      ${perf.map((p,i) => this._perfRow(p, i)).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 60px 70px 70px;gap:4px;font-size:11px;color:#94a3b8;padding:4px 2px">
      <span>คำอธิบาย / Description</span>
    </div>
    <button onclick="DailyReport._addPerfRow()"
      style="margin-top:10px;width:100%;padding:12px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:10px;cursor:pointer;font-size:14px;color:#64748b">
      + เพิ่มบรรทัด / Add Row
    </button>
  </div>

  <!-- Problems -->
  <div class="dr2-sec">
    <div class="dr2-sec-title">⚠️ Problems & Obstacles <small>ปัญหาและอุปสรรค / 问题记录</small></div>
    <textarea id="dr-problems" rows="3" placeholder="อธิบายปัญหา... / Describe issues..."
      style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;resize:vertical;box-sizing:border-box">${this.esc(d.problems||'')}</textarea>
  </div>

  <!-- Weather — big buttons -->
  <div class="dr2-sec">
    <div class="dr2-sec-title">🌤️ Weather <small>สภาพอากาศ / 天气</small></div>
    <div style="font-size:13px;color:#64748b;margin-bottom:6px">🌅 ช่วงเช้า AM (06:00–12:00)</div>
    <div class="dr2-weather-row" id="dr-wam">
      ${this._weatherBtns('am', d.weather_am||'clear')}
    </div>
    <div style="font-size:13px;color:#64748b;margin:12px 0 6px">🌆 ช่วงบ่าย PM (12:00–18:00)</div>
    <div class="dr2-weather-row" id="dr-wpm">
      ${this._weatherBtns('pm', d.weather_pm||'clear')}
    </div>
  </div>

  <!-- Remark -->
  <div class="dr2-sec" style="border-radius:0 0 12px 12px">
    <div class="dr2-sec-title">📝 Remark <small>หมายเหตุ / 备注</small></div>
    <textarea id="dr-remark" rows="2" placeholder="หมายเหตุเพิ่มเติม / Additional notes..."
      style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;resize:vertical;box-sizing:border-box">${this.esc(d.remark||'')}</textarea>
  </div>

  <!-- Past reports -->
  <div id="dr-history" style="padding:12px 16px"></div>
</div>

<!-- STICKY SAVE BAR -->
<div class="dr2-save-bar">
  <label class="dr2-sign-check">
    <input type="checkbox" id="dr-signed" ${d.foreman_signed?'checked':''}>
    <span>✅ Confirmed<br><small style="color:#64748b;font-size:11px">ผู้ควบคุมงาน</small></span>
  </label>
  <button class="dr2-save-btn" id="dr-save-btn" onclick="DailyReport.save()">
    💾 บันทึก / Save Report
  </button>
</div>`;

        this._loadHistory();
    },

    _sumToday(obj) {
        return Object.values(obj).reduce((s,v) => s + (parseInt(v?.today)||0), 0);
    },

    _updateSummary() {
        const mach = {}; document.querySelectorAll('[id^="m-"][id$="-today"]').forEach(inp => { const m = inp.id.slice(2,-6); mach[m] = {today: inp.value}; });
        const work = {}; document.querySelectorAll('[id^="w-"][id$="-today"]').forEach(inp => { const w = inp.id.slice(2,-6); work[w] = {today: inp.value}; });
        const mt = document.getElementById('dr-mach-total'); if (mt) mt.textContent = this._sumToday(mach);
        const wt = document.getElementById('dr-work-total'); if (wt) wt.textContent = this._sumToday(work);
    },

    _step(type, name, col, delta) {
        const id = (type==='mach'?'m-':'w-') + name + '-' + col;
        const inp = document.getElementById(id); if (!inp) return;
        const v = Math.max(0, (parseInt(inp.value)||0) + delta);
        inp.value = v;
        this._updateSummary();
    },

    _perfRow(p, i) {
        return `<div id="pr-${i}" style="margin-bottom:8px">
          <div style="display:grid;grid-template-columns:1fr 60px 70px 70px;gap:4px;margin-bottom:4px">
            <input type="text" class="dr-perf" data-row="${i}" data-col="work" value="${this.esc(p.work||'')}" placeholder="งาน / Work description"
              style="padding:10px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box">
            <input type="text" class="dr-perf" data-row="${i}" data-col="unit" value="${this.esc(p.unit||'')}" placeholder="m²"
              style="padding:10px 4px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center;width:100%;box-sizing:border-box">
            <input type="number" class="dr-perf" data-row="${i}" data-col="today" value="${this.esc(p.today||'')}" placeholder="0"
              style="padding:10px 4px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center;width:100%;box-sizing:border-box">
            <input type="number" class="dr-perf" data-row="${i}" data-col="total" value="${this.esc(p.total||'')}" placeholder="0"
              style="padding:10px 4px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center;width:100%;box-sizing:border-box">
          </div>
          <input type="text" class="dr-perf" data-row="${i}" data-col="description" value="${this.esc(p.description||'')}" placeholder="รายละเอียดงาน / Description of work..."
            style="width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;color:#64748b;box-sizing:border-box">
        </div>`;
    },

    _weatherBtns(period, selected) {
        const opts = [
            {v:'clear', e:'☀️', th:'แจ่มใส'},
            {v:'cloudy', e:'🌤️', th:'มีเมฆ'},
            {v:'rainy', e:'🌧️', th:'ฝนตก'},
            {v:'heavy_rain', e:'⛈️', th:'ฝนหนัก'}
        ];
        return opts.map(o => `<button class="dr2-w-btn ${selected===o.v?'active':''}"
          onclick="DailyReport._setWeather('${period}','${o.v}')">
          ${o.e}<br><b>${o.th}</b>
        </button>`).join('');
    },

    _setWeather(period, val) {
        document.querySelectorAll(`#dr-w${period} .dr2-w-btn`).forEach(b => b.classList.remove('active'));
        const btns = document.querySelectorAll(`#dr-w${period} .dr2-w-btn`);
        btns.forEach(b => { if (b.onclick.toString().includes(`'${val}'`)) b.classList.add('active'); });
        // simpler: re-render weather section
        const container = document.getElementById(`dr-w${period}`);
        if (container) container.innerHTML = this._weatherBtns(period, val);
        // store value
        if (!this._weather) this._weather = {};
        this._weather[period] = val;
    },

    _changeDate(d) { this.date = d; this.load(); },

    _addPerfRow() {
        const list = document.getElementById('dr-perf-list'); if (!list) return;
        const i = list.querySelectorAll('[id^="pr-"]').length;
        const div = document.createElement('div');
        div.innerHTML = this._perfRow({}, i);
        list.appendChild(div.firstChild);
    },

    _collectData() {
        const machinery = {};
        this.config.machinery.forEach(m => {
            const t = document.getElementById('m-'+m+'-today');
            const a = document.getElementById('m-'+m+'-accum');
            machinery[m] = { today: t?.value||'0', accum: a?.value||'0' };
        });
        const workers = {};
        this.config.workers.forEach(w => {
            const t = document.getElementById('w-'+w+'-today');
            const a = document.getElementById('w-'+w+'-accum');
            workers[w] = { today: t?.value||'0', accum: a?.value||'0' };
        });
        // Performance
        const rows = {};
        document.querySelectorAll('.dr-perf').forEach(inp => {
            const i = inp.dataset.row, col = inp.dataset.col;
            if (!rows[i]) rows[i] = {};
            rows[i][col] = inp.value;
        });
        const performance = Object.values(rows).filter(r => r.work || r.today);
        // Weather
        const getW = period => {
            const active = document.querySelector(`#dr-w${period} .dr2-w-btn.active`);
            if (active) {
                // extract from onclick
                const m = active.getAttribute('onclick').match(/'(clear|cloudy|rainy|heavy_rain)'/);
                return m ? m[1] : 'clear';
            }
            return (this._weather||{})[period] || 'clear';
        };
        return {
            report_date: this.date,
            week_no: document.getElementById('dr-week')?.value || null,
            machinery, workers, performance,
            problems: document.getElementById('dr-problems')?.value || '',
            weather_am: getW('am'),
            weather_pm: getW('pm'),
            remark: document.getElementById('dr-remark')?.value || '',
            foreman_signed: document.getElementById('dr-signed')?.checked || false
        };
    },

    async save() {
        if (this.saving) return;
        this.saving = true;
        const btn = document.getElementById('dr-save-btn');
        if (btn) { btn.disabled=true; btn.textContent='⏳ กำลังบันทึก...'; }
        try {
            const payload = this._collectData();
            await apiRequest('/api/projects/'+this.projectId+'/daily-report', {
                method: 'PUT', body: JSON.stringify(payload)
            });
            if (typeof app !== 'undefined' && app.showToast) app.showToast('✅ บันทึกแล้ว Saved!', 'success');
            // Trigger AI process analysis if there are work items
            const hasWork = (payload.performance||[]).some(p => (p.work||'').trim());
            if (hasWork) {
                const btn2 = document.getElementById('dr-save-btn');
                if (btn2) btn2.textContent = '🤖 AI กำลังวิเคราะห์... Analyzing...';
                try {
                    const aiR = await apiRequest('/api/projects/'+this.projectId+'/ai-process-update', {
                        method:'POST', body:JSON.stringify({performance:payload.performance, report_date:payload.report_date})
                    });
                    if ((aiR.updates&&aiR.updates.length>0)||(aiR.created&&aiR.created.length>0))
                        this._showAiResult(aiR.updates||[], aiR.created||[]);
                    else if (aiR.success) { if(typeof app!=='undefined'&&app.showToast) app.showToast('🤖 AI: No matching processes found','info'); }
                } catch(e) { /* AI analysis optional, don't block */ }
            }
        } catch(e) { alert('บันทึกไม่ได้ / Save failed: '+e.message); }
        finally {
            this.saving = false;
            const b = document.getElementById('dr-save-btn');
            if (b) { b.disabled=false; b.textContent='💾 บันทึก / Save Report'; }
        }
    },
    _showAiResult(updates, created) {
        created = created || [];
        const box = document.createElement('div');
        box.style.cssText='position:fixed;top:70px;right:12px;z-index:9999;background:#fff;border:2px solid #10b981;border-radius:14px;padding:14px 16px;max-width:340px;box-shadow:0 8px 32px rgba(0,0,0,.18);font-family:sans-serif';
        const updRows = updates.map(u=>`<div style="font-size:13px;padding:5px 0;border-bottom:1px solid #f0fdf4"><span style="color:#374151">${this.esc(u.reason||'Process updated')}</span><br><b style="color:#10b981;font-size:15px">${u.old_pct}% → ${u.new_pct}%</b> <span style="font-size:11px;color:#94a3b8">${Math.round((u.confidence||0)*100)}% match</span></div>`).join('');
        const createdRows = created.map(c=>`<div style="font-size:13px;padding:5px 0;border-bottom:1px solid #fef3c7"><span style="background:#fbbf24;color:#78350f;font-size:10px;font-weight:700;padding:1px 5px;border-radius:6px;margin-right:4px">AI Added</span><span style="color:#374151">${this.esc(c.name_zh||c.name_th||c.reason||'New process')}</span>${c.name_th?`<br><small style="color:#64748b">${this.esc(c.name_th)}</small>`:''}</div>`).join('');
        box.innerHTML=`<div style="font-size:14px;font-weight:700;color:#065f46;margin-bottom:8px">🤖 AI อัปเดตงาน / AI Updated Progress</div>`+
            (updRows||'')+(createdRows ? `<div style="font-size:12px;color:#92400e;font-weight:600;margin-top:6px">✨ New processes added / เพิ่มงานใหม่</div>`+createdRows : '')+
            `<button onclick="this.parentElement.remove()" style="margin-top:8px;font-size:12px;color:#64748b;background:none;border:none;cursor:pointer;float:right">✕ Close</button>`;
        document.body.appendChild(box);
        setTimeout(()=>{ if(box.parentElement) box.remove(); },12000);
    },

    async _loadHistory() {
        try {
            const r = await apiRequest('/api/projects/'+this.projectId+'/daily-reports');
            const list = (r.data||[]).slice(0,7);
            const box = document.getElementById('dr-history');
            if (!box || !list.length) return;
            const wIcon = {clear:'☀️',cloudy:'🌤️',rainy:'🌧️',heavy_rain:'⛈️'};
            box.innerHTML = `<div style="font-size:13px;font-weight:700;color:#64748b;margin-bottom:8px">📅 รายงานล่าสุด / Recent Reports</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${list.map(r => `<button onclick="DailyReport._changeDate('${r.report_date}')"
                  style="background:#fff;border:1.5px solid ${r.report_date===this.date?'#2563eb':'#e2e8f0'};border-radius:10px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:${r.report_date===this.date?'700':'400'}">
                  ${r.report_date.slice(5)} ${wIcon[r.weather_am]||''}${r.foreman_signed?'✅':''}
                </button>`).join('')}
              </div>`;
        } catch(_){}
    }
};
window.DailyReport = DailyReport;