/**
 * share-viewer.js
 * Public read-only drawing viewer for shared links (?share=TOKEN).
 * No login required. Called from app.js init() before auth check.
 */
const ShareViewer = {
    async init(token) {
        // Replace body content with full-screen viewer
        document.body.innerHTML = `
            <div id="sv-root" style="position:fixed;inset:0;background:#1a202c;display:flex;flex-direction:column;font-family:system-ui,sans-serif;">
              <div id="sv-loading" style="display:flex;align-items:center;justify-content:center;flex:1;color:#a0aec0;font-size:1.1rem;">
                ⏳ 加载中 Loading…
              </div>
            </div>`;

        try {
            const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
              ? 'http://localhost:3001' : '';
            const resp = await fetch(`${API_BASE}/api/share/${encodeURIComponent(token)}`);
            const json = await resp.json();

            if (resp.status === 410 || (json && json.message === 'expired')) {
                this._showError('⏰ 链接已失效 Link Expired', '此分享链接已过期或已被删除。\nThis share link has expired or has been removed.');
                return;
            }
            if (resp.status === 404 || !json.success) {
                this._showError('❌ 链接无效 Link Not Found', '此分享链接不存在或已被删除。\nThis share link does not exist or has been removed.');
                return;
            }

            const d = json.data;
            if (json.share_type === 'maintenance') {
                this._renderMaintenance(json.data);
                return;
            }
            const expiryStr = d.expires_at ? new Date(d.expires_at).toLocaleString('zh-CN', { timeZone: 'Asia/Bangkok', hour12: false }) : '';
            const createdStr = d.created_at ? new Date(d.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Bangkok', hour12: false }) : '';

            document.getElementById('sv-root').innerHTML = `
              <!-- Top bar -->
              <div style="background:#2d3748;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0;z-index:10;">
                <span style="font-size:1rem;font-weight:700;">📐 ${this._esc(d.drawing_name)}</span>
                <span style="color:#a0aec0;font-size:0.85rem;">项目: ${this._esc(d.project_name)}</span>
                <span style="color:#a0aec0;font-size:0.85rem;">分享人: ${this._esc(d.shared_by_name)} ${this._esc(createdStr)}</span>
                <span style="color:#f6ad55;font-size:0.82rem;">⚠️ 链接24小时有效 Valid 24h</span>
              </div>
              <!-- Image container -->
              <div id="sv-viewport" style="flex:1;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#525659;cursor:grab;position:relative;">
                <img id="sv-img" src="${this._esc(d.file_url)}"
                     style="max-width:100%;max-height:100%;transform-origin:center center;user-select:none;pointer-events:none;"
                     draggable="false" alt="${this._esc(d.drawing_name)}" />
              </div>
              <!-- Bottom bar -->
              <div style="background:#2d3748;color:#718096;padding:6px 16px;font-size:0.78rem;text-align:center;flex-shrink:0;">
                此为只读查看链接 This is a read-only view link &nbsp;|&nbsp; 有效至 Expires: ${this._esc(expiryStr)}
              </div>`;

            this._initZoom();
        } catch (err) {
            this._showError('⚠️ 加载失败 Load Failed', err.message || '网络错误 Network error');
        }
    },

    _showError(title, detail) {
        document.getElementById('sv-root').innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#fff;text-align:center;padding:32px;">
              <div style="font-size:3rem;margin-bottom:16px;">${title.split(' ')[0]}</div>
              <div style="font-size:1.2rem;font-weight:700;margin-bottom:12px;">${this._esc(title)}</div>
              <div style="color:#a0aec0;font-size:0.95rem;white-space:pre-line;">${this._esc(detail)}</div>
            </div>`;
    },

    _initZoom() {
        const imgEl = document.getElementById('sv-img');
        const viewport = document.getElementById('sv-viewport');
        if (!imgEl || !viewport) return;
        let scale = 1, translateX = 0, translateY = 0;
        let isPanning = false, startX = 0, startY = 0, startTX = 0, startTY = 0;

        function applyTransform() {
            imgEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }

        imgEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            scale = Math.max(0.2, Math.min(5, scale + (e.deltaY > 0 ? -0.1 : 0.1)));
            applyTransform();
        }, { passive: false });

        viewport.addEventListener('mousedown', (e) => {
            isPanning = true;
            startX = e.clientX; startY = e.clientY;
            startTX = translateX; startTY = translateY;
            viewport.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            translateX = startTX + (e.clientX - startX);
            translateY = startTY + (e.clientY - startY);
            applyTransform();
        });
        window.addEventListener('mouseup', () => {
            isPanning = false;
            viewport.style.cursor = 'grab';
        });

        // Touch zoom (pinch)
        let lastTouchDist = null;
        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            }
        }, { passive: true });
        viewport.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && lastTouchDist) {
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                scale = Math.max(0.2, Math.min(5, scale * (dist / lastTouchDist)));
                lastTouchDist = dist;
                applyTransform();
            }
        }, { passive: true });
        viewport.addEventListener('touchend', () => { lastTouchDist = null; }, { passive: true });
    },

    _esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _renderMaintenance(d) {
        const beforePhotos = (d.photos || []).filter(p => p.photo_type === 'before');
        const afterPhotos  = (d.photos || []).filter(p => p.photo_type === 'after');
        const photoGrid = (photos, label) => photos.length
            ? `<div style="margin-bottom:20px;">
         <div style="font-weight:600;color:#e2e8f0;margin-bottom:8px;">${label}</div>
         <div style="display:flex;flex-wrap:wrap;gap:8px;">
           ${photos.map(p =>
               `<img src="${this._esc(p.photo_url)}"
                   style="width:120px;height:120px;object-fit:cover;border-radius:6px;">`
             ).join('')}
         </div>
       </div>`
            : '';
        const expiryStr = d.expires_at
            ? new Date(d.expires_at).toLocaleString('zh-CN', { timeZone: 'Asia/Bangkok', hour12: false })
            : '';

        document.getElementById('sv-root').innerHTML = `
    <div style="background:#2d3748;color:#fff;padding:12px 16px;flex-shrink:0;">
      <div style="font-size:1.05rem;font-weight:700;">🛠️ ${this._esc(d.ticket_title)}</div>
      <div style="color:#a0aec0;font-size:0.85rem;">
        项目: ${this._esc(d.project_name)} &nbsp;|&nbsp; 分享人: ${this._esc(d.shared_by_name)}
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:20px 16px;color:#e2e8f0;
                max-width:640px;margin:0 auto;">
      <p style="color:#cbd5e0;margin-bottom:20px;">${this._esc(d.description || '')}</p>
      ${photoGrid(beforePhotos, '📷 施工前照片 Before')}
      ${photoGrid(afterPhotos,  '✅ 完工照片 After')}
    </div>
    <div style="background:#2d3748;color:#718096;padding:6px 16px;
                font-size:0.78rem;text-align:center;flex-shrink:0;">
      只读查看链接 Read-only &nbsp;|&nbsp; 有效至 Expires: ${this._esc(expiryStr)}
    </div>`;
    }
};

window.ShareViewer = ShareViewer;
