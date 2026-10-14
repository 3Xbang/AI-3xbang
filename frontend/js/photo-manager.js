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
        grid.innerHTML = '<div class="td-empty">กำลังโหลด... 加载中</div>';
        try {
            const r = await apiRequest('/api/photos/project/' + this.currentProjectId);
            this.renderPhotos(r.data || []);
        } catch(e) {
            grid.innerHTML = '<div class="td-empty">โหลดไม่สำเร็จ 加载失败</div>';
        }
    },

    renderPhotos(photos) {
        const grid = document.getElementById('photos-grid');
        if (!grid) return;
        if (!photos.length) {
            grid.innerHTML = '<div class="ph-empty"><div style="font-size:48px">📷</div><div><b>ยังไม่มีรูปถ่าย</b></div><div style="font-size:13px;color:#94a3b8">还没有上传照片</div></div>';
            return;
        }
        grid.innerHTML = photos.map(p => this.renderCard(p)).join('');
    },

    renderCard(p) {
        const dt = p.upload_time ? new Date(p.upload_time) : null;
        const dateStr = dt ? dt.toLocaleDateString('th-TH', {day:'numeric',month:'short',year:'numeric'}) + ' ' + dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '';
        const uploader = this.esc(p.uploader_name || p.uploaded_by || '?');
        const reason = p.reason ? `<div class="ph-reason">📝 ${this.esc(p.reason)}</div>` : '';
        return `<div class="ph-card">
            <div class="ph-img" style="background-image:url('${p.photo_url}')" onclick="photoManager.viewPhoto('${p.photo_url}')">
                <div class="ph-overlay"></div>
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
                <div><b style="font-size:18px">📷 อัปโหลดรูปถ่าย</b><small style="display:block;opacity:.8;font-size:12px">上传现场照片</small></div>
                <button data-x style="background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer">&times;</button>
            </header>
            <div class="sb-body" style="display:flex;flex-direction:column;gap:14px">

                <div style="background:#f0f9ff;border:1.5px dashed #7dd3fc;border-radius:10px;padding:12px;text-align:center">
                    <div style="font-size:13px;color:#0369a1;margin-bottom:8px">เลือกรูปภาพ 选择照片 *</div>
                    <input type="file" id="ph-files" accept="image/*" multiple style="font-size:15px;padding:4px 0">
                    <div id="ph-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
                </div>

                <div>
                    <div style="font-size:13px;color:#475569;margin-bottom:4px"><b>เหตุผลที่ถ่าย</b> <small>上传理由 *</small></div>
                    <input type="text" id="ph-reason" placeholder="เช่น ความคืบหน้างานฉาบ / 例如：记录墙面抹灰进度" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:15px">
                </div>

                <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:13px;color:#475569">
                    <b>ผู้อัปโหลด 上传人：</b><b style="color:#1e3a8a">${this.esc(userName)}</b>
                    &nbsp;&nbsp; <b>วันที่ 时间：</b>${new Date().toLocaleDateString('th-TH')} ${new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}
                </div>

            </div>
            <footer>
                <button class="sb-btn" data-cancel>ยกเลิก 取消</button>
                <button class="sb-btn primary" data-ok>📤 อัปโหลด 上传</button>
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
            const files = dlg.querySelector('#ph-files').files;
            const reason = dlg.querySelector('#ph-reason').value.trim();
            if (!files.length) { alert('กรุณาเลือกรูปภาพ / 请选择照片'); return; }
            if (!reason) { alert('กรุณาระบุเหตุผล / 请填写上传理由'); return; }

            try {
                if (typeof app !== 'undefined') app.showLoading();
                for (const file of files) {
                    const fd = new FormData();
                    fd.append('photo', file);
                    fd.append('project_id', this.currentProjectId);
                    fd.append('photo_type', 'progress');
                    fd.append('reason', reason);
                    if (processExecutionId) fd.append('process_execution_id', processExecutionId);
                    await fetch(window.location.origin + '/api/photos/upload', {
                        method: 'POST',
                        headers: { Authorization: 'Bearer ' + localStorage.getItem('authToken') },
                        body: fd
                    });
                }
                if (typeof app !== 'undefined') app.hideLoading();
                close();
                await this.loadPhotos();
            } catch(e) {
                if (typeof app !== 'undefined') app.hideLoading();
                alert('อัปโหลดไม่สำเร็จ / 上传失败：' + e.message);
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
