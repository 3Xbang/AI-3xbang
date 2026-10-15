// photo-manager.js — 现场照片：所有角色可上传，显示上传人+时间+理由
const photoManager = {
    currentProjectId: null,

    init(projectId) {
        this.currentProjectId = projectId;
        this.loadPhotos();
    },

    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },

    async loadPhotos() {
        const grid = document.getElementById('photos-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="td-empty">Loading... 加载中</div>';
        try {
            const r = await apiRequest('/api/photos/project/' + this.currentProjectId);
            this.renderPhotos(r.data || []);
        } catch(e) {
            grid.innerHTML = '<div class="td-empty">Load failed 加载失败</div>';
        }
    },

    renderPhotos(photos) {
        const grid = document.getElementById('photos-grid');
        if (!grid) return;
        if (!photos.length) {
            grid.innerHTML = '<div class="ph-empty"><div style="font-size:48px">📷</div><div><b>No photos yet</b></div><div style="font-size:13px;color:#94a3b8">No photos uploaded yet</div></div>';
            return;
        }
        // Group by date
        const groups = {};
        photos.forEach(p => {
            const d = p.upload_time ? p.upload_time.slice(0, 10) : 'unknown';
            if (!groups[d]) groups[d] = [];
            groups[d].push(p);
        });
        const dateLabel = dateStr => {
            if (dateStr === 'unknown') return 'Date unknown 日期不详';
            const d = new Date(dateStr);
            const today = new Date(); today.setHours(0,0,0,0);
            const yest = new Date(today); yest.setDate(today.getDate()-1);
            d.setHours(0,0,0,0);
            const label = d.getTime()===today.getTime() ? '📅 Today 今天' :
                          d.getTime()===yest.getTime()  ? '📅 Yesterday 昨天' :
                          '📅 ' + d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
            return label;
        };
        grid.innerHTML = Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(date => `
            <div class="ph-date-group">
                <div class="ph-date-header">
                    ${dateLabel(date)}
                    <span class="ph-date-count">${groups[date].length} photos 张</span>
                </div>
                <div class="photo-grid">
                    ${groups[date].map(p => this.renderCard(p)).join('')}
                </div>
            </div>`).join('');
    },

    renderCard(p) {
        const dt = p.upload_time ? new Date(p.upload_time) : null;
        const dateStr = dt ? dt.toLocaleDateString('th-TH', {day:'numeric',month:'short',year:'numeric'}) + ' ' + dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '';
        const uploader = this.esc(p.uploader_name || p.uploaded_by || '?');
        const reason = p.reason ? `<div class="ph-reason">📝 ${this.esc(p.reason)}</div>` : '';

        // Show edit/delete: admin can manage any photo, others only their own
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const isManager = PermissionManager.isManager();
        const isOwn = p.uploaded_by === currentUser.username;
        const canManage = isManager || isOwn;

        const actions = canManage ? `
            <div class="ph-actions">
                <button class="ph-btn-edit" onclick="photoManager.editReason(${p.id},'${this.esc(p.reason||'')}')" title="Edit Reason 编辑理由">✏️</button>
                <button class="ph-btn-del" onclick="photoManager.deletePhoto(${p.id})" title="Delete 删除">🗑️</button>
            </div>` : '';

        return `<div class="ph-card">
            <div class="ph-img" style="background-image:url('${p.photo_url}')" onclick="photoManager.viewPhoto('${p.photo_url}')">
                <div class="ph-overlay"></div>
                ${actions}
            </div>
            <div class="ph-meta">
                <div class="ph-who">👤 <b>${uploader}</b></div>
                <div class="ph-time">🕐 ${dateStr}</div>
                ${reason}
            </div>
        </div>`;
    },

    viewPhoto(url) {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
        ov.innerHTML = `<img src="${this.esc(url)}" style="max-width:95vw;max-height:93vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6)">
            <button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.2);border:none;color:#fff;font-size:28px;cursor:pointer;border-radius:50%;width:44px;height:44px">✕</button>`;
        document.body.appendChild(ov);
        ov.onclick = () => ov.remove();
    },

    // 上传表单 — 所有角色可见，泰语优先
    showUploadForm(processExecutionId = null) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userName = user.full_name || user.username || '?';

        const dlg = document.createElement('div'); dlg.className = 'sb-overlay';
        dlg.innerHTML = `<div class="sb-dialog" style="max-width:500px">
            <header style="background:#1e3a8a;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
                <div><b style="font-size:18px">📷 Upload Photos</b><small style="display:block;opacity:.8;font-size:12px">上传现场照片</small></div>
                <button data-x style="background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer">&times;</button>
            </header>
            <div class="sb-body" style="display:flex;flex-direction:column;gap:14px">

                <div style="background:#f0f9ff;border:1.5px dashed #7dd3fc;border-radius:10px;padding:12px;text-align:center">
                    <div style="font-size:13px;color:#0369a1;margin-bottom:8px">Select Photos 选择照片 *</div>
                    <input type="file" id="ph-files" accept="image/*" multiple style="font-size:15px;padding:4px 0">
                    <div id="ph-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
                </div>

                <div>
                    <div style="font-size:13px;color:#475569;margin-bottom:4px"><b>Reason for Photo</b> <small>上传理由 *</small></div>
                    <input type="text" id="ph-reason" placeholder="e.g. Wall plastering progress / 例如：记录墙面抹灰进度" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:15px">
                </div>

                <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:13px;color:#475569">
                    <b>Uploaded by 上传人：</b><b style="color:#1e3a8a">${this.esc(userName)}</b>
                    &nbsp;&nbsp; <b>Date/Time 时间：</b>${new Date().toLocaleDateString('th-TH')} ${new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}
                </div>

            </div>
            <footer>
                <button class="sb-btn" data-cancel>Cancel 取消</button>
                <button class="sb-btn primary" data-ok>📤 Upload 上传</button>
            </footer></div>`;
        document.body.appendChild(dlg);

        // Preview
        dlg.querySelector('#ph-files').onchange = (e) => {
            const prev = dlg.querySelector('#ph-preview');
            prev.innerHTML = Array.from(e.target.files).map(f => {
                const url = URL.createObjectURL(f);
                return `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid #e2e8f0">`;
            }).join('');
        };

        const close = () => dlg.remove();
        dlg.querySelector('[data-x]').onclick = dlg.querySelector('[data-cancel]').onclick = close;

        dlg.querySelector('[data-ok]').onclick = async () => {
            const okBtn = dlg.querySelector('[data-ok]');
            if (okBtn.disabled) return;          // prevent double-submit
            const files = dlg.querySelector('#ph-files').files;
            const reason = dlg.querySelector('#ph-reason').value.trim();
            if (!files.length) { alert('Please select photos / 请选择照片'); return; }
            if (!reason) { alert('Please enter reason / 请填写上传理由'); return; }

            okBtn.disabled = true;
            okBtn.textContent = '⏳ Uploading... 上传中...';
            try {
                if (typeof app !== 'undefined') app.showLoading();
                let uploaded = 0;
                for (const file of files) {
                    const fd = new FormData();
                    fd.append('photo', file);
                    fd.append('project_id', this.currentProjectId);
                    fd.append('photo_type', 'progress');
                    fd.append('reason', reason);
                    if (processExecutionId) fd.append('process_execution_id', processExecutionId);
                    const resp = await fetch(window.location.origin + '/api/photos/upload', {
                        method: 'POST',
                        headers: { Authorization: 'Bearer ' + localStorage.getItem('authToken') },
                        body: fd
                    });
                    const j = await resp.json();
                    if (j.success) uploaded++;
                }
                if (typeof app !== 'undefined') app.hideLoading();
                if (typeof app !== 'undefined' && app.showToast) app.showToast(`Uploaded ${uploaded}  photos / 已上传${uploaded}张`, 'success');
                close();
                await this.loadPhotos();
            } catch(e) {
                if (typeof app !== 'undefined') app.hideLoading();
                okBtn.disabled = false;
                okBtn.textContent = '📤 Upload 上传';
                alert('Upload failed / 上传失败：' + e.message);
            }
        };
    },

    async deletePhoto(photoId) {
        if (!confirm('Delete this photo? / 确认删除这张照片？')) return;
        try {
            await apiRequest('/api/photos/' + photoId, { method: 'DELETE' });
            if (typeof app !== 'undefined' && app.showToast) app.showToast('Deleted 已删除', 'success');
            await this.loadPhotos();
        } catch(e) {
            alert('Delete failed 删除失败：' + e.message);
        }
    },

    editReason(photoId, currentReason) {
        const dlg = document.createElement('div'); dlg.className = 'sb-overlay';
        dlg.innerHTML = `<div class="sb-dialog" style="max-width:420px">
            <header style="background:#1e3a8a;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
                <b>✏️ Edit Reason 编辑理由</b>
                <button data-x style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer">&times;</button>
            </header>
            <div class="sb-body">
                <div style="font-size:13px;color:#475569;margin-bottom:6px">Reason/Description 理由/说明</div>
                <input type="text" id="edit-reason-input" value="${this.esc(currentReason)}" 
                    style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:15px">
            </div>
            <footer>
                <button class="sb-btn" data-cancel>Cancel 取消</button>
                <button class="sb-btn primary" data-ok>💾 Save 保存</button>
            </footer></div>`;
        document.body.appendChild(dlg);
        dlg.querySelector('#edit-reason-input').focus();
        const close = () => dlg.remove();
        dlg.querySelector('[data-x]').onclick = dlg.querySelector('[data-cancel]').onclick = close;
        dlg.querySelector('[data-ok]').onclick = async () => {
            const reason = dlg.querySelector('#edit-reason-input').value.trim();
            try {
                await apiRequest('/api/photos/' + photoId, { method: 'PUT', body: JSON.stringify({ reason }) });
                if (typeof app !== 'undefined' && app.showToast) app.showToast('Saved 已保存', 'success');
                close();
                await this.loadPhotos();
            } catch(e) {
                alert('Save failed 保存失败：' + e.message);
            }
        };
    },

    formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1048576) return (bytes/1024).toFixed(1) + 'KB';
        return (bytes/1048576).toFixed(1) + 'MB';
    }
};

window.photoManager = photoManager;
