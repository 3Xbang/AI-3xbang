// photo-manager.js v2 — Structured daily photos linked to daily report
const photoManager = {
    currentProjectId: null,
    currentDate: null,
    dailyItems: [],

    init(projectId) {
        this.currentProjectId = projectId;
        this.currentDate = new Date(Date.now()+7*3600000).toISOString().slice(0,10);
        this.load();
    },

    esc(s) { return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },

    async load() {
        const grid = document.getElementById('photos-grid');
        if (!grid) return;
        grid.innerHTML = '<div style="padding:24px;text-align:center;color:#64748b">Loading...</div>';
        try {
            const [photosR, reportR] = await Promise.all([
                apiRequest('/api/photos/project/'+this.currentProjectId+'?date='+this.currentDate),
                apiRequest('/api/projects/'+this.currentProjectId+'/daily-report?date='+this.currentDate).catch(()=>({data:null}))
            ]);
            const photos = photosR.data || [];
            const dates = photosR.dates || [];
            this.dailyItems = [];
            if (reportR.data && reportR.data.performance) {
                this.dailyItems = (reportR.data.performance || []).filter(p => (p.work||'').trim());
            }
            this.render(photos, dates);
        } catch(e) {
            if (grid) grid.innerHTML = '<div style="padding:24px;color:#dc2626">Load failed: '+this.esc(e.message)+'</div>';
        }
    },

    render(photos, dates) {
        const grid = document.getElementById('photos-grid');
        if (!grid) return;
        const canUpload = !PermissionManager.isOwner();
        const byCategory = {morning:[], evening:[]};
        this.dailyItems.forEach((item,i) => { byCategory['work_'+i] = []; });
        byCategory['general'] = [];
        photos.forEach(p => {
            const cat = p.photo_category || 'general';
            if (byCategory[cat] !== undefined) byCategory[cat].push(p);
            else byCategory['general'].push(p);
        });
        const todayFmt = new Date(this.currentDate+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
        let html = `
        <div style="max-width:900px;margin:0 auto">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
            <b style="font-size:15px">📅 ${todayFmt}</b>
            <input type="date" value="${this.currentDate}" onchange="photoManager.changeDate(this.value)"
              style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${dates.slice(0,7).map(d => `<button onclick="photoManager.changeDate('${d}')"
                style="padding:4px 10px;border:1.5px solid ${d===this.currentDate?'#2563eb':'#e2e8f0'};border-radius:16px;cursor:pointer;font-size:12px;background:${d===this.currentDate?'#eff6ff':'#fff'};color:${d===this.currentDate?'#1e40af':'#475569'}">${d.slice(5)}</button>`).join('')}
            </div>
          </div>
          ${this._section('morning', '☀️ Morning Check-in / เช้า เข้างาน', byCategory.morning, canUpload, null, '#fef9c3', '#ca8a04')}
          ${this._section('evening', '🌙 Evening Check-out / เย็น เลิกงาน', byCategory.evening, canUpload, null, '#f0fdf4', '#16a34a')}
          ${this.dailyItems.length ? `
          <div style="margin:16px 0 8px;font-size:15px;font-weight:700;color:#1e3a8a">
            🏗️ Today's Work Progress / งานวันนี้
            <small style="font-size:12px;font-weight:400;color:#64748b"> (from daily report)</small>
          </div>
          ${this.dailyItems.map((item,i) => this._section('work_'+i, `${i+1}. ${this.esc(item.work||'')}${item.unit?' · '+this.esc(item.unit):''}${item.today?' · '+item.today+' today':''}`, byCategory['work_'+i], canUpload, {work:item.work,unit:item.unit}, '#eff6ff', '#2563eb')).join('')}`
          : `<div style="background:#f8fafc;border:1.5px dashed #e2e8f0;border-radius:12px;padding:20px;text-align:center;color:#94a3b8;margin-top:12px">
              <div style="font-size:24px">📋</div>
              <div style="margin-top:6px">No daily report for today yet<br>กรอกรายงานประจำวันก่อน</div>
             </div>`}
          ${byCategory.general.length || canUpload ? this._section('general', '📷 Other Photos / รูปอื่นๆ', byCategory.general, canUpload, null, '#f8fafc', '#64748b') : ''}
        </div>`;
        grid.innerHTML = html;
    },

    _section(category, title, photos, canUpload, workItem, bgColor, color) {
        const photoHtml = photos.map(p => this._photoCard(p)).join('');
        const uploadBtn = canUpload ? `<button onclick="photoManager.showUploadForCategory('${category}', ${workItem?JSON.stringify(workItem):'null'})"
            style="width:100px;height:100px;border:2px dashed #cbd5e1;border-radius:10px;background:#f8fafc;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;flex-shrink:0">
            <span style="font-size:28px">+</span>
            <span>Upload</span>
          </button>` : '';
        return `<div style="background:${bgColor};border:1.5px solid ${color}30;border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:14px;font-weight:700;color:${color};margin-bottom:10px">${title}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start">
            ${photoHtml}
            ${uploadBtn}
          </div>
        </div>`;
    },

    _photoCard(p) {
        const dt = p.upload_time ? new Date(p.upload_time) : null;
        const time = dt ? dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '';
        const canEdit = PermissionManager.isManager() || (p.uploaded_by === (JSON.parse(localStorage.getItem('user')||'{}').username));
        return `<div style="position:relative">
          <div onclick="photoManager.viewPhoto('${p.photo_url}')"
            style="width:100px;height:100px;background-image:url('${p.photo_url}');background-size:cover;background-position:center;border-radius:10px;cursor:pointer;border:1.5px solid #e2e8f0"></div>
          <div style="font-size:10px;color:#64748b;margin-top:3px;text-align:center">${time}</div>
          ${canEdit ? `<div style="position:absolute;top:4px;right:4px;display:flex;gap:2px">
            <button onclick="photoManager.editReason(${p.id},'${this.esc(p.reason||'')}')" style="background:rgba(255,255,255,.9);border:none;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:11px">✏️</button>
            <button onclick="photoManager.deletePhoto(${p.id})" style="background:rgba(220,38,38,.8);border:none;border-radius:4px;width:22px;height:22px;cursor:pointer;color:#fff;font-size:11px">✕</button>
          </div>` : ''}
        </div>`;
    },

    changeDate(d) { this.currentDate = d; this.load(); },

    viewPhoto(url) {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
        ov.innerHTML = `<img src="${this.esc(url)}" style="max-width:95vw;max-height:93vh;border-radius:10px">
            <button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.2);border:none;color:#fff;font-size:28px;cursor:pointer;border-radius:50%;width:44px;height:44px">✕</button>`;
        document.body.appendChild(ov);
        ov.onclick = () => ov.remove();
    },

    showUploadForCategory(category, workItem) {
        const catLabels = {morning:'☀️ Morning Check-in',evening:'🌙 Evening Check-out',general:'📷 General Photo'};
        const title = catLabels[category] || (workItem ? `🏗️ ${workItem.work||''}` : '📷 Upload Photo');
        const dlg = document.createElement('div'); dlg.className = 'sb-overlay';
        dlg.innerHTML = `<div class="sb-dialog" style="max-width:480px">
            <header style="background:#1e3a8a;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
                <b>${title}</b>
                <button data-x style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button>
            </header>
            <div class="sb-body">
                <div style="background:#f0f9ff;border:2px dashed #7dd3fc;border-radius:10px;padding:12px;text-align:center;margin-bottom:12px">
                    <input type="file" id="ph-files" accept="image/*" multiple style="font-size:15px">
                    <div id="ph-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
                </div>
                <div>
                    <div style="font-size:13px;color:#475569;margin-bottom:4px">Notes / หมายเหตุ (optional)</div>
                    <input type="text" id="ph-reason" placeholder="Notes..." 
                        style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px">
                </div>
            </div>
            <footer>
                <button class="sb-btn" data-cancel>Cancel</button>
                <button class="sb-btn primary" data-ok>📤 Upload</button>
            </footer></div>`;
        document.body.appendChild(dlg);
        dlg.querySelector('#ph-files').onchange = (e) => {
            const prev = dlg.querySelector('#ph-preview');
            prev.innerHTML = Array.from(e.target.files).map(f => {
                const url = URL.createObjectURL(f);
                return `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px">`;
            }).join('');
        };
        const close = () => dlg.remove();
        dlg.querySelector('[data-x]').onclick = dlg.querySelector('[data-cancel]').onclick = close;
        dlg.querySelector('[data-ok]').onclick = async () => {
            const okBtn = dlg.querySelector('[data-ok]');
            if (okBtn.disabled) return;
            const files = dlg.querySelector('#ph-files').files;
            if (!files.length) { alert('Please select photos / เลือกรูป'); return; }
            okBtn.disabled = true; okBtn.textContent = '⏳ Uploading...';
            try {
                if (typeof app !== 'undefined') app.showLoading();
                let failed = 0;
                for (const file of files) {
                    const fd = new FormData();
                    fd.append('photo', file);
                    fd.append('project_id', this.currentProjectId);
                    fd.append('photo_type', 'progress');
                    fd.append('reason', dlg.querySelector('#ph-reason').value || title);
                    fd.append('photo_category', category);
                    fd.append('report_date', this.currentDate);
                    if (workItem) fd.append('work_item_name', workItem.work||'');
                    const resp = await fetch(window.location.origin+'/api/photos/upload', {
                        method:'POST',
                        headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},
                        body:fd
                    });
                    if (!resp.ok) {
                        const j = await resp.json().catch(()=>({}));
                        failed++;
                        console.error('Upload failed:', j.message || resp.statusText);
                    }
                }
                if (typeof app !== 'undefined') app.hideLoading();
                close();
                await this.load();
                if (failed > 0) {
                    alert(`${failed} photo(s) failed to upload. / ${failed} รูปอัปโหลดไม่สำเร็จ`);
                } else if (typeof app !== 'undefined' && app.showToast) {
                    app.showToast('✅ Uploaded!','success');
                }
            } catch(e) {
                if (typeof app !== 'undefined') app.hideLoading();
                okBtn.disabled=false; okBtn.textContent='📤 Upload';
                alert('Upload failed: '+e.message);
            }
        };
    },

    async deletePhoto(photoId) {
        if (!confirm('Delete this photo? / ลบรูปนี้?')) return;
        try {
            await apiRequest('/api/photos/'+photoId, {method:'DELETE'});
            if (typeof app!=='undefined'&&app.showToast) app.showToast('Deleted','success');
            await this.load();
        } catch(e) { alert('Delete failed: '+e.message); }
    },

    editReason(photoId, currentReason) {
        const dlg = document.createElement('div'); dlg.className='sb-overlay';
        dlg.innerHTML=`<div class="sb-dialog" style="max-width:400px">
            <header style="background:#1e3a8a;color:#fff;padding:12px 16px;display:flex;justify-content:space-between">
                <b>✏️ Edit Notes</b>
                <button data-x style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button>
            </header>
            <div class="sb-body">
                <input type="text" id="edit-reason-input" value="${this.esc(currentReason)}"
                    style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:15px">
            </div>
            <footer>
                <button class="sb-btn" data-cancel>Cancel</button>
                <button class="sb-btn primary" data-ok>💾 Save</button>
            </footer></div>`;
        document.body.appendChild(dlg);
        dlg.querySelector('#edit-reason-input').focus();
        const close=()=>dlg.remove();
        dlg.querySelector('[data-x]').onclick=dlg.querySelector('[data-cancel]').onclick=close;
        dlg.querySelector('[data-ok]').onclick=async()=>{
            const reason=dlg.querySelector('#edit-reason-input').value.trim();
            try {
                await apiRequest('/api/photos/'+photoId,{method:'PUT',body:JSON.stringify({reason})});
                if(typeof app!=='undefined'&&app.showToast) app.showToast('Saved','success');
                close(); await this.load();
            } catch(e){alert('Save failed: '+e.message);}
        };
    },

    showUploadForm(processExecutionId=null) { this.showUploadForCategory('general', null); }
};

window.photoManager = photoManager;
