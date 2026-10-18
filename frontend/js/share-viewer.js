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

            const revisions = d.revisions || [];
            const isMobile = window.innerWidth <= 768;

            const revPanelHtml = revisions.length > 0 ? `
              <div style="${isMobile
                ? 'background:#fff;border-top:2px solid #e2e8f0;overflow-y:auto;flex-shrink:0;max-height:55vh;'
                : 'width:300px;min-width:220px;max-width:360px;background:#fff;border-left:1px solid #e2e8f0;overflow-y:auto;flex-shrink:0;'}display:flex;flex-direction:column;">
                <div style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f7fafc;font-weight:700;font-size:0.88rem;color:#2d3748;flex-shrink:0;">
                  📝 修改意见 Revisions (${revisions.length})
                </div>
                <div style="padding:8px;overflow-y:auto;flex:1;">
                  ${revisions.map(r => {
                    const rDate = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '';
                    return `<div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:8px;background:#fff;">
                      ${r.image_url ? `<img src="${this._esc(r.image_url)}" style="width:100%;border-radius:4px;margin-bottom:8px;cursor:pointer;" onclick="window.open('${this._esc(r.image_url)}','_blank')">` : ''}
                      ${r.note_text ? `<div style="font-size:0.9rem;color:#2d3748;margin-bottom:6px;">${this._esc(r.note_text)}</div>` : ''}
                      <div style="font-size:0.75rem;color:#a0aec0;">${this._esc(r.created_by_name || '')} · ${this._esc(rDate)}</div>
                    </div>`;
                  }).join('')}
                </div>
              </div>` : '';

            document.getElementById('sv-root').innerHTML = `
              <!-- Top bar -->
              <div style="background:#2d3748;color:#fff;padding:8px 12px;flex-shrink:0;z-index:10;">
                <div style="font-size:${isMobile ? '0.88rem' : '1rem'};font-weight:700;margin-bottom:4px;">📐 ${this._esc(d.drawing_name)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.78rem;color:#a0aec0;">
                  <span>项目: ${this._esc(d.project_name)}</span>
                  <span>分享人: ${this._esc(d.shared_by_name)} ${this._esc(createdStr)}</span>
                  <span style="color:#f6ad55;">⚠️ 链接24小时有效 Valid 24h</span>
                </div>
              </div>
              <!-- Main: drawing + revision panel -->
              <div style="flex:1;display:flex;flex-direction:${isMobile ? 'column' : 'row'};overflow:hidden;min-height:0;">
                <div id="sv-viewport" style="flex:1;${isMobile ? 'min-height:40vh;max-height:45vh;' : ''}overflow:hidden;display:flex;align-items:center;justify-content:center;background:#525659;cursor:grab;position:relative;">
                  <img id="sv-img" src="${this._esc(d.file_url)}"
                       style="max-width:100%;max-height:100%;transform-origin:center center;user-select:none;pointer-events:none;"
                       draggable="false" alt="${this._esc(d.drawing_name)}" />
                </div>
                ${revPanelHtml}
              </div>
              <!-- Bottom bar -->
              <div style="background:#2d3748;color:#718096;padding:5px 12px;font-size:0.72rem;text-align:center;flex-shrink:0;">
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
        const imgEl   = document.getElementById('sv-img');
        const viewport = document.getElementById('sv-viewport');
        if (!imgEl || !viewport) return;

        let scale = 1, ox = 0, oy = 0;

        function apply() {
            imgEl.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
        }

        /* ── Mouse: wheel zoom + drag pan ───────────────────────── */
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const r   = viewport.getBoundingClientRect();
            const cx  = e.clientX - r.left - r.width  / 2;
            const cy  = e.clientY - r.top  - r.height / 2;
            const ns  = Math.max(0.5, Math.min(6, scale + (e.deltaY > 0 ? -0.15 : 0.15)));
            const rat = ns / scale;
            ox = cx - rat * (cx - ox);
            oy = cy - rat * (cy - oy);
            scale = ns;
            apply();
        }, { passive: false });

        let mPan = false, mSX = 0, mSY = 0, mSOX = 0, mSOY = 0;
        viewport.addEventListener('mousedown', (e) => {
            mPan = true; mSX = e.clientX; mSY = e.clientY; mSOX = ox; mSOY = oy;
            viewport.style.cursor = 'grabbing'; e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!mPan) return;
            ox = mSOX + e.clientX - mSX; oy = mSOY + e.clientY - mSY; apply();
        });
        window.addEventListener('mouseup', () => { mPan = false; viewport.style.cursor = 'grab'; });

        /* ── Touch: pinch-zoom + single-finger pan + double-tap ─── */
        let td = 0, tmx = 0, tmy = 0;           // pinch tracking
        let tpan = false, tSX = 0, tSY = 0, tSOX = 0, tSOY = 0; // 1-finger pan
        let lastTap = 0;

        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                tpan = true;
                tSX = e.touches[0].clientX; tSY = e.touches[0].clientY;
                tSOX = ox; tSOY = oy; td = 0;
            } else if (e.touches.length === 2) {
                tpan = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                td  = Math.hypot(dx, dy);
                tmx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                tmy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            }
        }, { passive: true });

        viewport.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && tpan) {
                ox = tSOX + e.touches[0].clientX - tSX;
                oy = tSOY + e.touches[0].clientY - tSY;
                apply();
            } else if (e.touches.length === 2 && td) {
                const dx  = e.touches[0].clientX - e.touches[1].clientX;
                const dy  = e.touches[0].clientY - e.touches[1].clientY;
                const nd  = Math.hypot(dx, dy);
                const nmx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const nmy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const r   = viewport.getBoundingClientRect();
                const cx  = tmx - r.left - r.width  / 2;
                const cy  = tmy - r.top  - r.height / 2;
                const ns  = Math.max(0.5, Math.min(6, scale * (nd / td)));
                const rat = ns / scale;
                ox = cx - rat * (cx - ox) + (nmx - tmx);
                oy = cy - rat * (cy - oy) + (nmy - tmy);
                scale = ns; td = nd; tmx = nmx; tmy = nmy;
                apply();
            }
        }, { passive: false });

        viewport.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) td = 0;
            if (e.touches.length === 0) { tpan = false; }

            // Double-tap: zoom 2.5× or reset
            const now = Date.now();
            if (now - lastTap < 280 && e.changedTouches.length === 1) {
                if (scale > 1.5) {
                    scale = 1; ox = 0; oy = 0;
                } else {
                    const r  = viewport.getBoundingClientRect();
                    const cx = e.changedTouches[0].clientX - r.left - r.width  / 2;
                    const cy = e.changedTouches[0].clientY - r.top  - r.height / 2;
                    scale = 2.5;
                    ox = -cx * (scale - 1);
                    oy = -cy * (scale - 1);
                }
                apply();
            }
            lastTap = now;
        }, { passive: true });
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
