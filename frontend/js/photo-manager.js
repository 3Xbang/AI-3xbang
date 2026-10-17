// photo-manager.js v116 — Horizontal-scroll strip layout (mobile-first)
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
        const todayFmt = new Date(this.currentDate+'T12:00:00').toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
        let html = `
        <div style="max-width:900px;margin:0 auto">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;padding:0 16px">
            <b class="photo-date-display" style="font-size:15px">📅 ${todayFmt}</b>
            <input type="date" value="${this.currentDate}" onchange="photoManager.changeDate(this.value)"
              style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px">
            <div style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px">
              ${dates.slice(0,7).map(d => `<button onclick="photoManager.changeDate('${d}')"
                style="flex:0 0 auto;padding:4px 10px;border:1.5px solid ${d===this.currentDate?'#2563eb':'#e2e8f0'};border-radius:16px;cursor:pointer;font-size:12px;background:${d===this.currentDate?'#eff6ff':'#fff'};color:${d===this.currentDate?'#1e40af':'#475569'}">${d.slice(5)}</button>`).join('')}
            </div>
          </div>
          ${this._section('morning', '☀️ Morning Check-in / เช้า เข้างาน', byCategory.morning, canUpload, null, '#fef9c3', '#ca8a04')}
          <div style='border-top:2px dashed #e2e8f0;margin:6px 0'></div>
          ${this._section('evening', '🌙 Evening Check-out / เย็น เลิกงาน', byCategory.evening, canUpload, null, '#f0fdf4', '#16a34a')}
          <div style='border-top:2px dashed #e2e8f0;margin:6px 0'></div>
          ${this.dailyItems.length ? `
          <div style="margin:16px 0 8px;font-size:15px;font-weight:700;color:#1e3a8a;padding:0 16px">
            🏗️ Today's Work Progress / งานวันนี้
            <small style="font-size:12px;font-weight:400;color:#64748b"> (from daily report)</small>
          </div>
          ${this.dailyItems.map((item,i) => this._section('work_'+i, `${i+1}. ${this.esc(item.work||'')}${item.unit?' · '+this.esc(item.unit):''}${item.today?' · '+item.today+' today':''}`, byCategory['work_'+i], canUpload, {work:item.work,unit:item.unit}, '#eff6ff', '#2563eb')).join('')}`
          : `<div style="background:#f8fafc;border:1.5px dashed #e2e8f0;border-radius:12px;padding:20px;text-align:center;color:#94a3b8;margin:12px 16px 0">
              <div style="font-size:24px">📋</div>
              <div style="margin-top:6px">No daily report for today yet<br>กรอกรายงานประจำวันก่อน</div>
             </div>`}
          ${byCategory.general.length || canUpload ? this._section('general', '📷 Other Photos / รูปอื่นๆ', byCategory.general, canUpload, null, '#f8fafc', '#64748b') : ''}
        </div>`;
        grid.innerHTML = html;
    },

    _cardDimensions() {
        const isMobile = window.innerWidth <= 768;
        const cardW = isMobile ? Math.round(window.innerWidth * 0.75) : 300;
        const cardH = isMobile ? Math.round(window.innerWidth * 0.56) : 220;
        return { cardW, cardH };
    },

    _section(category, title, photos, canUpload, workItem, bgColor, color) {
        const { cardW, cardH } = this._cardDimensions();
        const photoHtml = photos.map(p => this._photoCard(p, cardW, cardH)).join('');
        const uploadBtn = canUpload ? `<div onclick="photoManager.showUploadForCategory('${category}', ${workItem?JSON.stringify(workItem).replace(/"/g,'&quot;'):'null'})"
            style="flex-shrink:0;width:${cardW}px;height:${cardH}px;border:2px dashed #cbd5e1;border-radius:10px;background:#f8fafc;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;scroll-snap-align:start;">
            <span style="font-size:36px;line-height:1">+</span>
            <span style="margin-top:6px">Upload</span>
          </div>` : '';
        const emptyState = (!photos.length && !canUpload)
            ? `<div style="padding:16px;color:#a0aec0;font-size:0.9rem;">暂无照片 No photos yet</div>`
            : '';
        return `<div style="background:${bgColor};border:1.5px solid ${color}30;border-radius:12px;margin-bottom:0;border-bottom:2px dashed #d1d5db;overflow:hidden">
          <div style="font-size:1.1rem;font-weight:700;padding:16px 16px 6px;color:#2d3748">${title}</div>
          ${emptyState}
          <div class="photo-strip" style="display:flex;flex-direction:row;overflow-x:auto;gap:12px;padding:8px 16px 16px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;">
            ${photoHtml}
            ${uploadBtn}
          </div>
        </div>`;
    },

    _photoCard(p, cardW, cardH) {
        const dt = p.upload_time ? new Date(p.upload_time) : null;
        const time = dt ? dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '';
        const canEdit = PermissionManager.isManager() || (p.uploaded_by === (JSON.parse(localStorage.getItem('user')||'{}').username));
        const escapedUrl = this.esc(p.photo_url);
        const escapedTime = this.esc(time);
        return `<div style="position:relative;flex-shrink:0;width:${cardW}px;height:${cardH}px;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.15);scroll-snap-align:start;background:#e2e8f0;">
          <img src="${escapedUrl}" alt="site photo"
            data-photo-url="${escapedUrl}" data-photo-time="${escapedTime}"
            onclick="photoManager._showLightbox(this.dataset.photoUrl,this.dataset.photoTime)"
            style="width:100%;height:100%;object-fit:cover;display:block;cursor:pointer;"
            loading="lazy">
          ${time ? `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.55));color:#fff;font-size:11px;padding:4px 8px;pointer-events:none;">${escapedTime}</div>` : ''}
          ${canEdit ? `
            <button class="photo-overlay-btn" onclick="event.stopPropagation();photoManager.editReason(${p.id},'${this.esc(p.reason||'')}')"
              style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.45);color:#fff;border:none;border-radius:50%;width:30px;height:30px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✏️</button>
            <button class="photo-overlay-btn" onclick="event.stopPropagation();photoManager.deletePhoto(${p.id})"
              style="position:absolute;top:6px;right:6px;background:rgba(220,38,38,0.75);color:#fff;border:none;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          ` : ''}
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

    _showLightbox(imgUrl, timestamp) {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:2000;display:flex;align-items:center;justify-content:center;';
        const img = document.createElement('img');
        img.src = imgUrl;
        img.style.cssText = 'max-width:100vw;max-height:100vh;object-fit:contain;';
        img.onclick = (e) => e.stopPropagation();
        const closeBtn = document.createElement('button');
        closeBtn.className = 'photo-lb-close';
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:22px;cursor:pointer;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;';
        closeBtn.onclick = (e) => { e.stopPropagation(); ov.remove(); };
        ov.appendChild(img);
        ov.appendChild(closeBtn);
        if (timestamp) {
            const tsDiv = document.createElement('div');
            tsDiv.textContent = timestamp;
            tsDiv.style.cssText = 'position:absolute;bottom:16px;left:0;right:0;text-align:center;color:#fff;font-size:12px;opacity:0.8;pointer-events:none;';
            ov.appendChild(tsDiv);
        }
        ov.onclick = () => ov.remove();
        document.body.appendChild(ov);
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
