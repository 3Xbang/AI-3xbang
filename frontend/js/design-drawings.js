/**
 * design-drawings.js  v18
 * Module for managing design drawings: list, upload, delete, and Fabric.js viewer.
 * Exposes window.DesignDrawings with init, load, render, showUploadForm, deleteDrawing,
 * openAnnotator, shareDrawing, showShareModal.
 */

const DesignDrawings = {
    currentProjectId: null,
    drawings: [],
    _fabricCanvas: null,
    _currentDrawing: null,

    /* ── HTML escape helper ─────────────────────────────────────────── */
    esc(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    /* ── Init: load drawings for a project ──────────────────────────── */
    async init(projectId) {
        this.currentProjectId = projectId;
        const container = document.getElementById('drawings-container');
        if (!container) return;
        container.innerHTML = '<div style="padding:24px;text-align:center;color:#718096;">加载中... Loading...</div>';
        await this.load();
    },

    /* ── Load drawings from API ──────────────────────────────────────── */
    async load() {
        try {
            const res = await apiRequest(`/api/projects/${this.currentProjectId}/drawings`);
            this.drawings = (res && res.data) ? res.data : [];
            this.render(this.drawings);
        } catch (err) {
            const container = document.getElementById('drawings-container');
            if (container) container.innerHTML = `<div style="padding:24px;color:#e53e3e;">加载失败 Load failed: ${this.esc(err.message)}</div>`;
        }
    },

    /* ── Render drawings grid ────────────────────────────────────────── */
    render(drawings) {
        const container = document.getElementById('drawings-container');
        if (!container) return;

        const isManager = PermissionManager.role() === 'manager';
        const currentUserId = PermissionManager.userId ? PermissionManager.userId() : null;

        let html = `
            <div style="padding:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
                    <h3 style="margin:0;font-size:1.1rem;color:#2d3748;">📐 设计图 Drawings</h3>
                    ${isManager || PermissionManager.role() === 'supervisor' ? `<button class="sb-btn primary" onclick="DesignDrawings.showUploadForm()">➕ 上传图纸 Upload Drawing</button>` : ''}
                </div>`;

        if (!drawings || drawings.length === 0) {
            html += `<div style="padding:40px;text-align:center;color:#a0aec0;border:2px dashed #e2e8f0;border-radius:8px;">
                <div style="font-size:2rem;margin-bottom:8px;">📐</div>
                <div>暂无设计图 No drawings yet</div>
            </div>`;
        } else {
            html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;">';
            drawings.forEach(d => {
                const canDelete = isManager || (currentUserId && d.uploaded_by == currentUserId);
                const badge = d.file_type === 'pdf'
                    ? '<span style="background:#e9d8fd;color:#6b46c1;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">PDF</span>'
                    : '<span style="background:#bee3f8;color:#2b6cb0;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">IMG</span>';
                const dateStr = d.upload_time ? new Date(d.upload_time).toLocaleDateString('zh-CN') : '';
                const thumbBg = d.file_type !== 'pdf' ? "url('" + d.file_url + "') center/cover no-repeat" : 'none';
                html += `
                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <div style="height:160px;background:#f0f4f8 ${thumbBg};cursor:pointer;display:flex;align-items:center;justify-content:center;"
                             onclick="DesignDrawings.openById(${d.id})" title="点击查看 Click to view">
                            ${thumbBg === 'none' ? '<span style="font-size:2.5rem;">📐</span>' : ''}
                        </div>
                        <div style="padding:12px;">
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                ${badge}
                                <span style="font-size:0.75rem;color:#718096;">${this.esc(dateStr)}</span>
                            </div>
                            <div style="font-weight:600;font-size:0.9rem;color:#2d3748;margin-bottom:4px;word-break:break-all;">${this.esc(d.file_name)}</div>
                            ${d.description ? `<div style="font-size:0.8rem;color:#718096;margin-bottom:8px;">${this.esc(d.description)}</div>` : ''}
                            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                                <button class="sb-btn primary" style="font-size:0.8rem;padding:4px 10px;" onclick="DesignDrawings.openById(${d.id})">✏️ 标注 Annotate</button>
                                ${canDelete ? `<button class="sb-btn" style="font-size:0.8rem;padding:4px 10px;color:#e53e3e;border-color:#e53e3e;" onclick="DesignDrawings.deleteDrawing(${d.id})">🗑️ 删除 Delete</button>` : ''}
                                <button class="sb-btn" style="font-size:0.8rem;padding:4px 10px;color:#3182ce;border-color:#3182ce;" onclick="DesignDrawings.showShareModal(${d.id})">📤 分享</button>
                            </div>
                        </div>
                    </div>`;
            });
            html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
    },

    /* ── Open by drawing ID (from card click) ───────────────────────── */
    openById(id) {
        const d = this.drawings.find(x => x.id === id);
        if (d) this.openAnnotator(d);
    },

    /* ── Upload form modal ───────────────────────────────────────────── */
    showUploadForm() {
        const modal = document.getElementById('modal-container');
        if (!modal) return;
        modal.innerHTML = `
            <div class="modal-overlay" onclick="DesignDrawings._closeModal(event)" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;">
                <div style="background:#fff;border-radius:12px;padding:24px;width:420px;max-width:95vw;" onclick="event.stopPropagation()">
                    <h3 style="margin:0 0 16px;font-size:1.1rem;">📐 上传设计图 Upload Drawing</h3>
                    <div style="margin-bottom:12px;">
                        <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#4a5568;">选择文件 Select File <span style="color:#718096;font-size:0.8rem;">(PDF / JPG / PNG, max 20MB)</span></label>
                        <input type="file" id="drawing-file-input" accept=".pdf,.jpg,.jpeg,.png" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.9rem;">
                    </div>
                    <div style="margin-bottom:16px;">
                        <label style="display:block;margin-bottom:6px;font-size:0.9rem;color:#4a5568;">说明 Description</label>
                        <input type="text" id="drawing-desc-input" placeholder="图纸说明（可选）" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.9rem;box-sizing:border-box;">
                    </div>
                    <div id="drawing-upload-error" style="color:#e53e3e;font-size:0.85rem;margin-bottom:8px;display:none;"></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button class="sb-btn" onclick="document.getElementById('modal-container').innerHTML=''">取消 Cancel</button>
                        <button class="sb-btn primary" onclick="DesignDrawings._submitUpload()">上传 Upload</button>
                    </div>
                </div>
            </div>`;
    },

    _closeModal(event) {
        if (event.target === event.currentTarget) {
            document.getElementById('modal-container').innerHTML = '';
        }
    },

    async _submitUpload() {
        const fileInput = document.getElementById('drawing-file-input');
        const descInput = document.getElementById('drawing-desc-input');
        const errEl = document.getElementById('drawing-upload-error');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            if (errEl) { errEl.textContent = '请选择文件 Please select a file'; errEl.style.display = 'block'; }
            return;
        }
        const formData = new FormData();
        formData.append('drawing', fileInput.files[0]);
        formData.append('description', descInput ? descInput.value : '');

        // Show loading spinner for PDF (can take 10-30s for many pages)
        const _isPdf = fileInput.files[0].name.toLowerCase().endsWith('.pdf');
        if (_isPdf) {
            const _mc = document.getElementById('modal-container');
            if (_mc) _mc.innerHTML = `<div style='position:fixed;inset:0;background:rgba(15,23,42,.8);display:flex;align-items:center;justify-content:center;z-index:9999'><div style='background:#fff;border-radius:16px;padding:32px 40px;text-align:center;max-width:320px;box-shadow:0 20px 60px rgba(0,0,0,.3)'><style>@keyframes dr-spin{to{transform:rotate(360deg)}}</style><div style='font-size:48px;margin-bottom:16px;display:inline-block;animation:dr-spin 1.5s linear infinite'>⚙️</div><div style='font-size:17px;font-weight:700;color:#1e3a8a;margin-bottom:8px'>正在分解 PDF…</div><div style='font-size:14px;color:#475569;margin-bottom:6px'>Splitting PDF into pages</div><div style='font-size:13px;color:#94a3b8;line-height:1.6'>每页转换为图纸，请稍候<br>Converting pages, please wait…</div></div></div>`;  }

        try {
            const token = localStorage.getItem('authToken');
            const resp = await fetch(`/api/projects/${this.currentProjectId}/drawings`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
            const data = await resp.json();
            if (!data.success) throw new Error(data.message || '上传失败');
            document.getElementById('modal-container').innerHTML = '';
            if (data.pages && data.pages > 1 && typeof app !== 'undefined' && app.showToast) app.showToast('PDF split into ' + data.pages + ' pages', 'success');
            await this.load();
        } catch (err) {
            if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
        }
    },

    /* ── Delete a drawing ────────────────────────────────────────────── */
    async deleteDrawing(id) {
        if (!confirm('确定删除这张图纸吗？此操作不可恢复。\nDelete this drawing? This cannot be undone.')) return;
        try {
            await apiRequest(`/api/drawings/${id}`, { method: 'DELETE' });
            await this.load();
        } catch (err) {
            alert('删除失败 Delete failed: ' + err.message);
        }
    },

    /* ── Open the full-screen viewer / annotator ───────────────────── */
    openAnnotator(drawing) {
        if (typeof drawing === 'string') drawing = JSON.parse(drawing);
        this._currentDrawing = drawing;
        this._history = [];
        this._rotation = 0;

        const modal = document.getElementById('modal-container');
        if (!modal) return;

        modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;flex-direction:column;">
                <div style="background:#fff;display:flex;flex-direction:column;height:100vh;max-height:100vh;">

                    <!-- Title bar -->
                    <div style="display:flex;align-items:center;padding:8px 16px;background:#2d3748;color:#fff;gap:12px;flex-shrink:0;">
                        <span style="font-size:1rem;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            📐 ${this.esc(drawing.file_name)}
                        </span>
                        <button onclick="DesignDrawings._closeAnnotator()"
                                style="background:transparent;border:1px solid rgba(255,255,255,0.4);color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.85rem;">
                            ✕ 关闭
                        </button>
                    </div>

                    <!-- Toolbar -->
                    <div style="display:flex;align-items:center;gap:4px;padding:6px 12px;background:#f7fafc;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;flex-shrink:0;">
                        <!-- Rotate -->
                        <button class="sb-btn" onclick="DesignDrawings._rotateView(-90)" title="向左旋转 Rotate Left">↺</button>
                        <span id="rotation-label" style="min-width:32px;text-align:center;font-size:0.82rem;color:#4a5568;font-weight:600;">0°</span>
                        <button class="sb-btn" onclick="DesignDrawings._rotateView(90)" title="向右旋转 Rotate Right">↻</button>
                        <span style="width:1px;background:#e2e8f0;height:20px;display:inline-block;margin:0 4px;"></span>
                        <!-- Zoom -->
                        <button class="sb-btn" onclick="DesignDrawings._zoomCanvas(-0.25)" title="缩小 Zoom Out">−</button>
                        <span id="zoom-label" style="min-width:44px;text-align:center;font-size:0.82rem;color:#4a5568;font-weight:600;">100%</span>
                        <button class="sb-btn" onclick="DesignDrawings._zoomCanvas(0.25)" title="放大 Zoom In">+</button>
                        <button class="sb-btn" onclick="DesignDrawings._resetZoom()" title="适合屏幕 Fit">⊡</button>
                        <span style="width:1px;background:#e2e8f0;height:20px;display:inline-block;margin:0 4px;"></span>
                        <span style="font-size:0.78rem;color:#a0aec0;">🖱 滚轮缩放 | Alt+拖拽平移</span>
                        <button class="sb-btn" onclick="DesignDrawings.showShareModal(${drawing.id})" title="分享 Share">📤 分享</button>
                    </div>

                    <!-- Main area: canvas + revision panel -->
                    <div id="annotator-main-area" style="flex:1;display:flex;overflow:hidden;">
                        <div id="annotator-viewport"
                             style="flex:1;overflow:auto;position:relative;background:#525659;cursor:grab;">
                            <canvas id="annotation-canvas" style="display:block;"></canvas>
                        </div>
                        <div id="revision-panel"
                             style="display:none;width:320px;min-width:220px;border-left:1px solid #e2e8f0;background:#fff;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column;">
                        </div>
                    </div>

                </div>
            </div>`;

        const viewportEl = document.getElementById('annotator-viewport');
        // Start with viewport size; will be resized to image size after load
        const viewportW = viewportEl.clientWidth  || (window.innerWidth);
        const viewportH = viewportEl.clientHeight || (window.innerHeight - 120);

        const canvasEl = document.getElementById('annotation-canvas');
        if (!canvasEl) return;

        if (this._fabricCanvas) {
            try { this._fabricCanvas.dispose(); } catch(e) {}
        }
        this._fabricCanvas = new fabric.Canvas('annotation-canvas', {
            width: viewportW,
            height: viewportH,
            selection: false,
            isDrawingMode: false
        });

        const canvas = this._fabricCanvas;
        const self   = this;

        /* ── Mouse-wheel zoom ──────────────────────────────────────── */
        viewportEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.12 : 0.12;
            const rect  = canvasEl.getBoundingClientRect();
            const pt    = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
            let zoom = Math.max(0.15, Math.min(8, canvas.getZoom() + delta));
            canvas.zoomToPoint(pt, zoom);
            const lbl = document.getElementById('zoom-label');
            if (lbl) lbl.textContent = Math.round(zoom * 100) + '%';
        }, { passive: false });

        /* ── Alt+drag pan ──────────────────────────────────────────── */
        let isPanning = false, lastPX = 0, lastPY = 0;
        canvas.on('mouse:down', (opt) => {
            const e = opt.e;
            if (e.altKey || e.button === 1) {
                isPanning = true;
                lastPX = e.clientX; lastPY = e.clientY;
                canvas.setCursor('grabbing');
                e.preventDefault();
            }
        });
        canvas.on('mouse:move', (opt) => {
            if (!isPanning) return;
            const e = opt.e;
            canvas.relativePan(new fabric.Point(e.clientX - lastPX, e.clientY - lastPY));
            lastPX = e.clientX; lastPY = e.clientY;
        });
        canvas.on('mouse:up', () => { isPanning = false; });

        /* ── Load image ────────────────────────────────────────────── */
        const imgUrl = drawing.file_url.startsWith('http')
            ? drawing.file_url
            : (window.location.origin + drawing.file_url);

        fabric.Image.fromURL(imgUrl, (img) => {
            if (!img || !img.width) {
                viewportEl.innerHTML = '<div style="color:#fff;padding:32px;text-align:center;">⚠️ 图片加载失败 Image failed to load<br>' + imgUrl + '</div>';
                return;
            }
            // Scale to fit viewport, keeping aspect ratio
            const scaleX = viewportW  / img.width;
            const scaleY = viewportH / img.height;
            const scale  = Math.min(scaleX, scaleY, 1);

            // Canvas = full viewport, image centered inside it (no zoom clipping)
            const canvasW = viewportW;
            const canvasH = viewportH;
            const offsetX = Math.round((canvasW - img.width  * scale) / 2);
            const offsetY = Math.round((canvasH - img.height * scale) / 2);

            canvas.setWidth(canvasW);
            canvas.setHeight(canvasH);

            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                originX: 'left', originY: 'top',
                left: offsetX,   top: offsetY,
                scaleX: scale,   scaleY: scale
            });
            canvas.renderAll();
            self._loadRevisions();
        }, { crossOrigin: 'anonymous' });
    },

    /* ── Rotation ───────────────────────────────────────────────────── */
    _rotateView(delta) {
        this._rotation = (((this._rotation || 0) + delta) + 360) % 360;
        const canvas = this._fabricCanvas;
        if (!canvas) return;

        const img = canvas.backgroundImage;
        if (!img) return;

        const vW = canvas.getWidth();
        const vH = canvas.getHeight();
        const r  = this._rotation;

        // Rotate the image itself
        img.set({ angle: r, originX: 'center', originY: 'center',
                  left: vW / 2, top: vH / 2 });

        // Rescale to fit viewport — swap dimensions at 90°/270°
        const rawW = img.width;
        const rawH = img.height;
        const scale = (r === 90 || r === 270)
            ? Math.min(vW / rawH, vH / rawW)
            : Math.min(vW / rawW, vH / rawH);
        img.set({ scaleX: scale, scaleY: scale });

        // Reset pan/zoom so image stays in view
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.renderAll();

        const lbl = document.getElementById('rotation-label');
        if (lbl) lbl.textContent = r + '°';

        const zlbl = document.getElementById('zoom-label');
        if (zlbl) zlbl.textContent = '100%';
    },

    /* ── Zoom helpers ───────────────────────────────────────────────── */
    _zoomCanvas(delta) {
        const canvas = this._fabricCanvas;
        if (!canvas) return;
        const zoom = Math.max(0.15, Math.min(8, canvas.getZoom() + delta));
        canvas.setZoom(zoom);
        canvas.renderAll();
        const lbl = document.getElementById('zoom-label');
        if (lbl) lbl.textContent = Math.round(zoom * 100) + '%';
    },

    _resetZoom() {
        const canvas = this._fabricCanvas;
        if (!canvas) return;
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.renderAll();
        const lbl = document.getElementById('zoom-label');
        if (lbl) lbl.textContent = '100%';
    },

    _closeAnnotator() {
        if (this._fabricCanvas) {
            try { this._fabricCanvas.dispose(); } catch(e) {}
            this._fabricCanvas = null;
        }
        this._currentDrawing = null;
        this._history = [];
        const modal = document.getElementById('modal-container');
        if (modal) modal.innerHTML = '';
    },


    /* ── shareDrawing — alias for showShareModal ──────────────────── */
    shareDrawing(id) {
        return this.showShareModal(id || (this._currentDrawing && this._currentDrawing.id));
    },

    /* ── Load revision notes ─────────────────────────────────────── */
    async _loadRevisions() {
        if (!this._currentDrawing) return;
        try {
            const res = await apiRequest(`/api/drawings/${this._currentDrawing.id}/revisions`);
            const revisions = (res && res.data) ? res.data : [];
            this._renderRevisions(revisions);
        } catch (err) {
            console.error('Load revisions error:', err);
        }
    },

    /* ── Render revision panel ───────────────────────────────────── */
    _renderRevisions(revisions) {
        const panel = document.getElementById('revision-panel');
        if (!panel) return;
        const role    = typeof PermissionManager !== 'undefined' ? PermissionManager.role() : '';
        const canAdd  = role === 'manager' || role === 'supervisor';
        const canDel  = role === 'manager';
        if (revisions.length > 0 || canAdd) {
            panel.style.display = 'flex';
            panel.style.flexDirection = 'column';
        } else {
            panel.style.display = 'none';
        }
        let html = `
            <div style="padding:12px;border-bottom:1px solid #e2e8f0;background:#f7fafc;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <span style="font-weight:600;color:#2d3748;font-size:0.9rem;">📝 修改意见 Revisions (${revisions.length})</span>
                ${canAdd ? '<button class="sb-btn primary" style="font-size:0.78rem;padding:3px 8px;" onclick="DesignDrawings._showAddRevision()">+ 添加</button>' : ''}
            </div>
            <div id="revision-list" style="flex:1;overflow-y:auto;padding:8px;">`;
        if (revisions.length === 0) {
            html += '<div style="padding:20px;text-align:center;color:#a0aec0;font-size:0.85rem;">暂无修改意见<br>No revisions yet</div>';
        } else {
            revisions.forEach(r => {
                const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '';
                html += `
                    <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:8px;background:#fff;">
                        ${r.image_url ? `<img src="${this.esc(r.image_url)}" style="width:100%;border-radius:4px;margin-bottom:8px;cursor:pointer;" onclick="window.open('${this.esc(r.image_url)}','_blank')">` : ''}
                        ${r.note_text ? `<div style="font-size:0.85rem;color:#2d3748;margin-bottom:6px;">${this.esc(r.note_text)}</div>` : ''}
                        <div style="font-size:0.75rem;color:#a0aec0;display:flex;justify-content:space-between;align-items:center;">
                            <span>${this.esc(r.created_by_name || '')} · ${this.esc(dateStr)}</span>
                            ${canDel ? `<button style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:0.78rem;padding:0;" onclick="DesignDrawings._deleteRevision(${r.id})">🗑️</button>` : ''}
                        </div>
                    </div>`;
            });
        }
        html += '</div>';
        panel.innerHTML = html;
    },

    /* ── Show add-revision inline form ───────────────────────────── */
    _showAddRevision() {
        const list = document.getElementById('revision-list');
        if (!list) return;
        const existing = document.getElementById('add-revision-form');
        if (existing) { existing.remove(); return; }
        const formDiv = document.createElement('div');
        formDiv.id = 'add-revision-form';
        formDiv.style.cssText = 'border:1px solid #3182ce;border-radius:6px;padding:10px;margin-bottom:8px;background:#ebf8ff;';
        formDiv.innerHTML = `
            <div style="font-size:0.82rem;font-weight:600;color:#2b6cb0;margin-bottom:8px;">添加修改意见 Add Revision</div>
            <textarea id="revision-note" placeholder="修改说明（可选）Optional note..."
                      style="width:100%;box-sizing:border-box;padding:6px;border:1px solid #bee3f8;border-radius:4px;font-size:0.82rem;resize:vertical;min-height:60px;"></textarea>
            <div style="margin-top:6px;">
                <label style="font-size:0.78rem;color:#4a5568;display:block;margin-bottom:4px;">附图（可选）Image (optional)</label>
                <input type="file" id="revision-image" accept=".jpg,.jpeg,.png" style="font-size:0.78rem;">
            </div>
            <div id="revision-error" style="color:#e53e3e;font-size:0.78rem;margin-top:4px;display:none;"></div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <button class="sb-btn primary" style="font-size:0.78rem;padding:3px 10px;" onclick="DesignDrawings._submitRevision()">提交</button>
                <button class="sb-btn" style="font-size:0.78rem;padding:3px 10px;" onclick="document.getElementById('add-revision-form').remove()">取消</button>
            </div>`;
        list.insertBefore(formDiv, list.firstChild);
        formDiv.querySelector('#revision-note').focus();
    },

    /* ── Submit new revision ─────────────────────────────────────── */
    async _submitRevision() {
        if (!this._currentDrawing) return;
        const note     = document.getElementById('revision-note');
        const imgInput = document.getElementById('revision-image');
        const err      = document.getElementById('revision-error');
        const noteText = note ? note.value.trim() : '';
        const imgFile  = imgInput && imgInput.files && imgInput.files[0] ? imgInput.files[0] : null;
        if (!noteText && !imgFile) {
            if (err) { err.textContent = '请输入说明或选择图片 Please add a note or image'; err.style.display = 'block'; }
            return;
        }
        const formData = new FormData();
        if (noteText) formData.append('note_text', noteText);
        if (imgFile)  formData.append('revision_image', imgFile);
        try {
            const token = localStorage.getItem('authToken');
            const resp = await fetch(`/api/drawings/${this._currentDrawing.id}/revisions`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            });
            const data = await resp.json();
            if (!data.success) throw new Error(data.message || '提交失败');
            await this._loadRevisions();
        } catch (e) {
            if (err) { err.textContent = e.message; err.style.display = 'block'; }
        }
    },

    /* ── Delete a revision ───────────────────────────────────────── */
    async _deleteRevision(revisionId) {
        if (!confirm('确定删除此修改意见？Delete this revision?')) return;
        try {
            const token = localStorage.getItem('authToken');
            const resp  = await fetch(`/api/drawings/revisions/${revisionId}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const data = await resp.json();
            if (!data.success) throw new Error(data.message || '删除失败');
            await this._loadRevisions();
        } catch (e) {
            alert('删除失败 Delete failed: ' + e.message);
        }
    },

    /* ── Share modal ─────────────────────────────────────────────────── */
    async showShareModal(drawingId) {
        try {
            const token = localStorage.getItem('authToken');
            const resp = await fetch(`/api/drawings/${drawingId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });
            const json = await resp.json();
            if (!json.success) throw new Error(json.message || '分享失败');
            const data = json.data;

            const modal = document.getElementById('modal-container');
            if (!modal) return;
            modal.innerHTML = `
                <div class="modal-overlay" onclick="DesignDrawings._closeModal(event)" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;">
                    <div style="background:#fff;border-radius:12px;padding:24px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;" onclick="event.stopPropagation()">
                        <h3 style="margin:0 0 12px;font-size:1.1rem;">📤 分享图纸 Share Drawing</h3>
                        <div style="font-size:0.82rem;color:#718096;margin-bottom:12px;">⏰ 链接24小时后失效 Link expires in 24 hours</div>
                        <div style="margin-bottom:14px;">
                            <label style="display:block;font-size:0.85rem;color:#4a5568;margin-bottom:6px;">分享消息 Share Message（可复制 Copy as needed）</label>
                            <textarea id="share-msg-box" readonly style="width:100%;box-sizing:border-box;height:160px;padding:8px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.82rem;resize:vertical;background:#f7fafc;color:#2d3748;">${this.esc(data.message)}</textarea>
                        </div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                            <button class="sb-btn" style="background:#06c755;color:#fff;border-color:#06c755;" onclick="window.open('https://social-plugins.line.me/lineit/share?url='+encodeURIComponent('${this.esc(data.url)}')+'&text='+encodeURIComponent(document.getElementById('share-msg-box').value),'_blank')">
                                💬 LINE 分享
                            </button>
                            <button class="sb-btn" style="background:#07c160;color:#fff;border-color:#07c160;" onclick="
                                navigator.clipboard.writeText(document.getElementById('share-msg-box').value).then(()=>{
                                    const t=document.createElement('div');
                                    t.textContent='✅ 已复制！粘贴到微信即可 Copied! Paste to WeChat';
                                    t.style.cssText='position:fixed;bottom:80px;right:24px;background:#07c160;color:#fff;padding:10px 18px;border-radius:8px;z-index:9999;font-size:0.88rem;';
                                    document.body.appendChild(t);setTimeout(()=>t.remove(),2800);
                                }).catch(()=>{ document.getElementById('share-msg-box').select(); document.execCommand('copy'); });
                            ">
                                💚 微信复制 WeChat Copy
                            </button>
                            <button class="sb-btn" onclick="document.getElementById('modal-container').innerHTML=''">✕ 关闭 Close</button>
                        </div>
                    </div>
                </div>`;
        } catch (err) {
            alert('分享失败 Share failed: ' + err.message);
        }
    }
};

window.DesignDrawings = DesignDrawings;