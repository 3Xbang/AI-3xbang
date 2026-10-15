// daily-report.js — Daily Construction Report (施工日报) v1
// Shown to foreman/worker roles instead of the complex site board
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
        if (box) box.innerHTML = '<div style="padding:24px;text-align:center;color:#64748b">Loading... 加载中...</div>';
        try {
            const r = await apiRequest('/api/projects/'+this.projectId+'/daily-report?date='+this.date);
            this.data = r.data;
            this.config = r.config || { machinery: [], workers: [] };
            this.render();
        } catch(e) {
            if (box) box.innerHTML = '<div style="padding:24px;color:#dc2626">加载失败: '+this.esc(e.message)+'</div>';
        }
    },

    render() {
        const box = document.getElementById('site-board-container');
        if (!box) return;
        const d = this.data || {};
        const mach = d.machinery || {};
        const work = d.workers || {};
        const perf = d.performance || [];
        const signed = d.foreman_signed || false;

        // Ensure at least 6 performance rows
        const perfRows = [...perf];
        while (perfRows.length < 6) perfRows.push({work:'',unit:'',today:'',other_day:'',total:'',description:''});

        box.innerHTML = `
<div class="dr-wrap" style="padding:12px;max-width:960px;margin:0 auto;font-family:sans-serif">

  <!-- Header -->
  <div class="dr-header" style="background:#1e3a8a;color:#fff;border-radius:12px 12px 0 0;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-size:18px;font-weight:700">📋 Daily Construction Report</div>
      <div style="font-size:13px;opacity:.8">รายงานการก่อสร้างประจำวัน / 施工日报</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label style="font-size:13px;color:#93c5fd">Date 日期:</label>
      <input type="date" id="dr-date" value="${this.esc(this.date)}"
        style="padding:6px 10px;border-radius:7px;border:none;font-size:14px;background:#fff;color:#1e3a8a;font-weight:600"
        onchange="DailyReport._changeDate(this.value)">
      <span style="font-size:13px;color:#93c5fd">Week:</span>
      <input type="text" id="dr-week" placeholder="e.g. W20" value="${this.esc(d.week_no||'')}"
        style="width:70px;padding:6px 8px;border-radius:7px;border:none;font-size:13px">
    </div>
  </div>

  <!-- 2-column: Machinery + Workers -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e2e8f0;border-top:none">

    <!-- MACHINERY -->
    <div style="border-right:1px solid #e2e8f0">
      <div class="dr-col-head" style="background:#f8fafc;padding:8px 12px;font-weight:700;font-size:13px;border-bottom:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 70px 70px;gap:4px;text-align:center">
        <span style="text-align:left">MACHINERY<br><small style="font-weight:400;color:#64748b">เครื่องจักรทำงาน</small></span>
        <span>TODAY<br><small>วันนี้</small></span>
        <span>ACCUM.<br><small>สะสม</small></span>
      </div>
      ${this.config.machinery.map(m => `
      <div style="display:grid;grid-template-columns:1fr 70px 70px;gap:4px;padding:4px 12px;border-bottom:1px solid #f1f5f9;align-items:center">
        <span style="font-size:13px">${this.esc(m)}</span>
        <input type="number" min="0" class="dr-num" data-mach="${this.esc(m)}" data-col="today"
          value="${this.esc(mach[m]?.today||'')}" placeholder="0"
          style="text-align:center;padding:4px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px;width:100%">
        <input type="number" min="0" class="dr-num" data-mach="${this.esc(m)}" data-col="accum"
          value="${this.esc(mach[m]?.accum||'')}" placeholder="0"
          style="text-align:center;padding:4px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px;width:100%">
      </div>`).join('')}
    </div>

    <!-- WORKERS -->
    <div>
      <div class="dr-col-head" style="background:#f8fafc;padding:8px 12px;font-weight:700;font-size:13px;border-bottom:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 70px 70px;gap:4px;text-align:center">
        <span style="text-align:left">WORKER<br><small style="font-weight:400;color:#64748b">ผู้ปฏิบัติงาน</small></span>
        <span>TODAY<br><small>วันนี้</small></span>
        <span>ACCUM.<br><small>สะสม</small></span>
      </div>
      ${this.config.workers.map(w => `
      <div style="display:grid;grid-template-columns:1fr 70px 70px;gap:4px;padding:4px 12px;border-bottom:1px solid #f1f5f9;align-items:center">
        <span style="font-size:13px">${this.esc(w)}</span>
        <input type="number" min="0" class="dr-num" data-worker="${this.esc(w)}" data-col="today"
          value="${this.esc(work[w]?.today||'')}" placeholder="0"
          style="text-align:center;padding:4px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px;width:100%">
        <input type="number" min="0" class="dr-num" data-worker="${this.esc(w)}" data-col="accum"
          value="${this.esc(work[w]?.accum||'')}" placeholder="0"
          style="text-align:center;padding:4px;border:1px solid #e2e8f0;border-radius:5px;font-size:13px;width:100%">
      </div>`).join('')}
    </div>
  </div>

  <!-- PERFORMANCE -->
  <div style="border:1px solid #e2e8f0;border-top:none">
    <div style="background:#1e3a8a;color:#fff;padding:8px 12px;font-weight:700;font-size:13px;text-align:center">
      ผลการดำเนินการ / PERFORMANCE
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc;text-align:center">
            <th style="padding:8px;border:1px solid #e2e8f0;min-width:160px;text-align:left">WORK<br><small style="font-weight:400;color:#64748b">งาน / 工作内容</small></th>
            <th style="padding:8px;border:1px solid #e2e8f0;width:60px">UNIT<br><small style="font-weight:400;color:#64748b">หน่วย</small></th>
            <th style="padding:8px;border:1px solid #e2e8f0;width:70px">TODAY<br><small style="font-weight:400;color:#64748b">วันนี้</small></th>
            <th style="padding:8px;border:1px solid #e2e8f0;width:70px">PREV.<br><small style="font-weight:400;color:#64748b">ก่อนหน้า</small></th>
            <th style="padding:8px;border:1px solid #e2e8f0;width:70px">TOTAL<br><small style="font-weight:400;color:#64748b">สะสม</small></th>
            <th style="padding:8px;border:1px solid #e2e8f0;min-width:180px;text-align:left">DESCRIPTION OF WORK<br><small style="font-weight:400;color:#64748b">รายละเอียด / 说明</small></th>
          </tr>
        </thead>
        <tbody id="dr-perf-body">
          ${perfRows.map((p,i) => this._perfRow(p, i)).join('')}
        </tbody>
      </table>
    </div>
    <div style="padding:6px 12px">
      <button onclick="DailyReport._addPerfRow()" style="background:#eff6ff;color:#2563eb;border:1px dashed #93c5fd;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px">+ Add Row / เพิ่มบรรทัด</button>
    </div>
  </div>

  <!-- Problems + Weather -->
  <div style="display:grid;grid-template-columns:1fr auto;gap:0;border:1px solid #e2e8f0;border-top:none">
    <div style="border-right:1px solid #e2e8f0;padding:10px 12px">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px">Problems and Obstacles<br><small style="font-weight:400;color:#64748b">ปัญหาและอุปสรรค / 问题记录</small></div>
      <textarea id="dr-problems" rows="4" style="width:100%;border:1px solid #e2e8f0;border-radius:7px;padding:8px;font-size:13px;resize:vertical;box-sizing:border-box"
        placeholder="Describe any issues... / อธิบายปัญหา...">${this.esc(d.problems||'')}</textarea>
    </div>
    <div style="padding:10px 16px;min-width:200px">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;text-align:center">สภาพอากาศ / Weather</div>
      <div style="margin-bottom:10px">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px">🌅 AM (06:00–12:00)</div>
        ${this._weatherSel('dr-weather-am', d.weather_am||'clear')}
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;margin-bottom:4px">🌆 PM (12:00–18:00)</div>
        ${this._weatherSel('dr-weather-pm', d.weather_pm||'clear')}
      </div>
    </div>
  </div>

  <!-- Remark -->
  <div style="border:1px solid #e2e8f0;border-top:none;padding:10px 12px">
    <div style="font-weight:700;font-size:13px;margin-bottom:6px">Remark / หมายเหตุ / 备注</div>
    <textarea id="dr-remark" rows="2" style="width:100%;border:1px solid #e2e8f0;border-radius:7px;padding:8px;font-size:13px;resize:vertical;box-sizing:border-box"
      placeholder="Additional notes...">${this.esc(d.remark||'')}</textarea>
  </div>

  <!-- Save + Sign -->
  <div style="border:1px solid #e2e8f0;border-top:none;padding:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:#f8fafc;border-radius:0 0 12px 12px">
    <div style="display:flex;gap:10px;align-items:center">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;font-weight:600">
        <input type="checkbox" id="dr-signed" ${signed?'checked':''} style="width:18px;height:18px">
        <span>✅ Foreman Confirmed / ผู้ควบคุมงานยืนยัน / 工头确认</span>
      </label>
    </div>
    <div style="display:flex;gap:10px">
      <button onclick="DailyReport._loadPrev()" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:14px">
        ← Previous Report / รายงานก่อนหน้า
      </button>
      <button id="dr-save-btn" onclick="DailyReport.save()" style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:15px;font-weight:700">
        💾 Save Report / บันทึกรายงาน / 保存日报
      </button>
    </div>
  </div>

  <!-- Past reports quick list -->
  <div id="dr-history" style="margin-top:14px"></div>
</div>`;

        this._loadHistory();
    },

    _perfRow(p, i) {
        const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        return `<tr>
          <td style="padding:4px;border:1px solid #f1f5f9"><input type="text" class="dr-perf" data-row="${i}" data-col="work" value="${esc(p.work||'')}" placeholder="Work description / งาน" style="width:100%;border:none;padding:4px;font-size:13px;outline:none"></td>
          <td style="padding:4px;border:1px solid #f1f5f9"><input type="text" class="dr-perf" data-row="${i}" data-col="unit" value="${esc(p.unit||'')}" placeholder="m², m³" style="width:100%;border:none;padding:4px;font-size:13px;text-align:center;outline:none"></td>
          <td style="padding:4px;border:1px solid #f1f5f9"><input type="number" class="dr-perf" data-row="${i}" data-col="today" value="${esc(p.today||'')}" placeholder="0" style="width:100%;border:none;padding:4px;font-size:13px;text-align:center;outline:none"></td>
          <td style="padding:4px;border:1px solid #f1f5f9"><input type="number" class="dr-perf" data-row="${i}" data-col="other_day" value="${esc(p.other_day||'')}" placeholder="0" style="width:100%;border:none;padding:4px;font-size:13px;text-align:center;outline:none"></td>
          <td style="padding:4px;border:1px solid #f1f5f9"><input type="number" class="dr-perf" data-row="${i}" data-col="total" value="${esc(p.total||'')}" placeholder="0" style="width:100%;border:none;padding:4px;font-size:13px;text-align:center;outline:none"></td>
          <td style="padding:4px;border:1px solid #f1f5f9"><input type="text" class="dr-perf" data-row="${i}" data-col="description" value="${esc(p.description||'')}" placeholder="Details / รายละเอียด" style="width:100%;border:none;padding:4px;font-size:13px;outline:none"></td>
        </tr>`;
    },

    _weatherSel(id, val) {
        const opts = [
            {v:'clear', label:'☀️ Clear / แจ่มใส'},
            {v:'cloudy', label:'🌤️ Cloudy / มีเมฆ'},
            {v:'rainy', label:'🌧️ Rain / ฝนตก'},
            {v:'heavy_rain', label:'⛈️ Heavy Rain / ฝนหนัก'}
        ];
        return `<div style="display:flex;flex-direction:column;gap:4px">${opts.map(o => `
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
            <input type="radio" name="${id}" value="${o.v}" ${val===o.v?'checked':''}> ${o.label}
          </label>`).join('')}</div>`;
    },

    _changeDate(d) {
        this.date = d;
        this.load();
    },

    _addPerfRow() {
        const tbody = document.getElementById('dr-perf-body');
        if (!tbody) return;
        const i = tbody.querySelectorAll('tr').length;
        const div = document.createElement('tbody');
        div.innerHTML = this._perfRow({work:'',unit:'',today:'',other_day:'',total:'',description:''}, i);
        tbody.appendChild(div.querySelector('tr'));
    },

    _collectData() {
        // Machinery
        const machinery = {};
        document.querySelectorAll('.dr-num[data-mach]').forEach(inp => {
            const m = inp.dataset.mach, col = inp.dataset.col;
            if (!machinery[m]) machinery[m] = {};
            machinery[m][col] = inp.value;
        });
        // Workers
        const workers = {};
        document.querySelectorAll('.dr-num[data-worker]').forEach(inp => {
            const w = inp.dataset.worker, col = inp.dataset.col;
            if (!workers[w]) workers[w] = {};
            workers[w][col] = inp.value;
        });
        // Performance rows
        const rows = {};
        document.querySelectorAll('.dr-perf').forEach(inp => {
            const i = inp.dataset.row, col = inp.dataset.col;
            if (!rows[i]) rows[i] = {};
            rows[i][col] = inp.value;
        });
        const performance = Object.values(rows).filter(r => r.work || r.unit || r.today);

        return {
            report_date: this.date,
            week_no: (document.getElementById('dr-week')||{}).value || null,
            machinery,
            workers,
            performance,
            problems: (document.getElementById('dr-problems')||{}).value || '',
            weather_am: (document.querySelector('input[name="dr-weather-am"]:checked')||{}).value || 'clear',
            weather_pm: (document.querySelector('input[name="dr-weather-pm"]:checked')||{}).value || 'clear',
            remark: (document.getElementById('dr-remark')||{}).value || '',
            foreman_signed: (document.getElementById('dr-signed')||{}).checked || false
        };
    },

    async save() {
        if (this.saving) return;
        this.saving = true;
        const btn = document.getElementById('dr-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }
        try {
            const payload = this._collectData();
            await apiRequest('/api/projects/'+this.projectId+'/daily-report', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('✅ Report saved / บันทึกแล้ว / 已保存', 'success');
            }
            if (btn) { btn.disabled = false; btn.textContent = '💾 Save Report / บันทึกรายงาน / 保存日报'; }
        } catch(e) {
            alert('Save failed: ' + e.message);
            if (btn) { btn.disabled = false; btn.textContent = '💾 Save Report / บันทึกรายงาน / 保存日报'; }
        }
        this.saving = false;
    },

    async _loadHistory() {
        try {
            const r = await apiRequest('/api/projects/'+this.projectId+'/daily-reports');
            const list = (r.data||[]).slice(0,7);
            const box = document.getElementById('dr-history');
            if (!box || !list.length) return;
            const wIcon = {clear:'☀️',cloudy:'🌤️',rainy:'🌧️',heavy_rain:'⛈️'};
            box.innerHTML = `<div style="font-size:13px;color:#64748b;margin-bottom:6px">📅 Recent Reports / รายงานล่าสุด</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${list.map(r => `<button onclick="DailyReport._changeDate('${r.report_date}')"
                  style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;${r.report_date===this.date?'border-color:#2563eb;background:#eff6ff;':''}">
                  ${r.report_date} ${wIcon[r.weather_am]||''}${r.foreman_signed?'✅':''}
                </button>`).join('')}
              </div>`;
        } catch(_) {}
    },

    async _loadPrev() {
        try {
            const r = await apiRequest('/api/projects/'+this.projectId+'/daily-reports');
            const list = r.data||[];
            // Find the one before current date
            const prev = list.filter(x => x.report_date < this.date)[0];
            if (prev) { this._changeDate(prev.report_date); }
            else { if (typeof app !== 'undefined' && app.showToast) app.showToast('No earlier reports', 'error'); }
        } catch(_) {}
    }
};

window.DailyReport = DailyReport;