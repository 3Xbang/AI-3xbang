/**
 * design-drawings.js
 * Module for managing design drawings: list, upload, delete, and Fabric.js annotation.
 * Exposes window.DesignDrawings with init, load, render, showUploadForm, deleteDrawing,
 * openAnnotator, setTool, setColor, saveAnnotations, undo.
 */

const DesignDrawings = {
    currentProjectId: null,
    drawings: [],
    _fabricCanvas: null,
    _currentDrawing: null,
    _activeTool: 'select',
    _color: '#e53e3e',
    _history: [],
    _mouseDown: false,
    _startPoint: null,
    _activeObj: null,

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

        const isOwner = typeof PermissionManager !== 'undefined' &&
                        typeof PermissionManager.isOwner === 'function' &&
                        PermissionManager.isOwner();
        const canAnnotate = !isOwner;

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
                        ${canAnnotate ? `
                        <span style="width:1px;background:#e2e8f0;height:20px;display:inline-block;margin:0 4px;"></span>
                        <!-- Annotation tools -->
                        <button class="sb-btn" id="tool-select" onclick="DesignDrawings.setTool('select')" title="选择 Select">↖ 选</button>
                        <button class="sb-btn" id="tool-pencil" onclick="DesignDrawings.setTool('pencil')" title="画笔 Pencil">✏️</button>
                        <button class="sb-btn" id="tool-rect"   onclick="DesignDrawings.setTool('rect')"   title="矩形 Rect">⬜</button>
                        <button class="sb-btn" id="tool-text"   onclick="DesignDrawings.setTool('text')"   title="文字 Text">T</button>
                        <button class="sb-btn" id="tool-arrow"  onclick="DesignDrawings.setTool('arrow')"  title="箭头 Arrow">→</button>
                        <span style="width:1px;background:#e2e8f0;height:20px;display:inline-block;margin:0 4px;"></span>
                        <!-- Colors -->
                        <button style="width:20px;height:20px;border-radius:50%;background:#e53e3e;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#e53e3e')" title="Red"></button>
                        <button style="width:20px;height:20px;border-radius:50%;background:#3182ce;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#3182ce')" title="Blue"></button>
                        <button style="width:20px;height:20px;border-radius:50%;background:#38a169;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#38a169')" title="Green"></button>
                        <button style="width:20px;height:20px;border-radius:50%;background:#1a202c;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#1a202c')" title="Black"></button>
                        <button style="width:20px;height:20px;border-radius:50%;background:#d69e2e;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#d69e2e')" title="Yellow"></button>
                        <span style="width:1px;background:#e2e8f0;height:20px;display:inline-block;margin:0 4px;"></span>
                        <button class="sb-btn" onclick="DesignDrawings.undo()" title="撤销 Undo">↩ 撤销</button>
                        <button class="sb-btn primary" onclick="DesignDrawings.saveAnnotations()" title="保存 Save">💾 保存</button>
                        ` : '<span style="font-size:0.8rem;color:#718096;">👁 查看模式 View only</span>'}
                    </div>

                    <!-- Canvas viewport -->
                    <div id="annotator-viewport"
                         style="flex:1;overflow:auto;position:relative;background:#525659;cursor:grab;display:flex;align-items:center;justify-content:center;">
                        <canvas id="annotation-canvas" style="display:block;"></canvas>
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
            selection: canAnnotate,
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

        /* ── Undo history ──────────────────────────────────────────── */
        canvas.on('object:added',    () => self._pushHistory());
        canvas.on('object:modified', () => self._pushHistory());

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

            // Canvas = scaled image size (no wasted gray area)
            const canvasW = Math.round(img.width  * scale);
            const canvasH = Math.round(img.height * scale);
            canvas.setWidth(canvasW);
            canvas.setHeight(canvasH);

            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                originX: 'left', originY: 'top',
                scaleX: scale,   scaleY: scale
            });
            canvas.renderAll();
            self._loadAnnotations();
        }, { crossOrigin: 'anonymous' });

        if (canAnnotate) this.setTool('select');
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

    /* ── Load existing annotations ───────────────────────────────────── */
    async _loadAnnotations() {
        if (!this._currentDrawing || !this._fabricCanvas) return;
        try {
            const res = await apiRequest(`/api/drawings/${this._currentDrawing.id}/annotations`);
            const rows = (res && res.data) ? res.data : [];
            const page1 = rows.find(r => r.page_no === 1);
            if (!page1 || !page1.objects || !page1.objects.length) return;

            const canvas = this._fabricCanvas;
            const bgImg = canvas.backgroundImage;
            canvas.loadFromJSON({ version: '5.3.0', objects: page1.objects }, () => {
                if (bgImg) canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas));
                else canvas.renderAll();
                // Clear history after load so user can undo from clean state
                this._history = [];
            });
        } catch (err) {
            console.error('Load annotations error:', err);
        }
    },

    /* ── Set active drawing tool ─────────────────────────────────────── */
    setTool(tool) {
        this._activeTool = tool;
        const canvas = this._fabricCanvas;
        if (!canvas) return;

        // Remove any existing mouse listeners
        canvas.off('mouse:down');
        canvas.off('mouse:move');
        canvas.off('mouse:up');

        // Highlight active tool button
        ['select','pencil','rect','text','arrow'].forEach(t => {
            const btn = document.getElementById('tool-' + t);
            if (btn) btn.style.fontWeight = (t === tool) ? '700' : '';
        });

        if (tool === 'pencil') {
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush.color = this._color;
            canvas.freeDrawingBrush.width = 3;
        } else {
            canvas.isDrawingMode = false;
        }

        if (tool === 'select') return;

        if (tool === 'rect') {
            let isDown = false, origX, origY, rect;
            canvas.on('mouse:down', (o) => {
                isDown = true;
                const p = canvas.getPointer(o.e);
                origX = p.x; origY = p.y;
                rect = new fabric.Rect({
                    left: origX, top: origY,
                    width: 0, height: 0,
                    fill: 'transparent',
                    stroke: this._color,
                    strokeWidth: 2,
                    selectable: true
                });
                canvas.add(rect);
            });
            canvas.on('mouse:move', (o) => {
                if (!isDown || !rect) return;
                const p = canvas.getPointer(o.e);
                if (p.x < origX) rect.set({ left: p.x, width: origX - p.x });
                else rect.set({ width: p.x - origX });
                if (p.y < origY) rect.set({ top: p.y, height: origY - p.y });
                else rect.set({ height: p.y - origY });
                canvas.renderAll();
            });
            canvas.on('mouse:up', () => {
                isDown = false;
                rect = null;
            });
        }

        if (tool === 'text') {
            const self = this;
            canvas.on('mouse:down', (o) => {
                if (o.target) return; // clicked existing object, don't place new text
                const p = canvas.getPointer(o.e);

                // Build inline floating input at click position
                const vp = document.getElementById('annotator-viewport');
                const rect = vp ? vp.getBoundingClientRect() : { left: 0, top: 0 };
                const zoom = canvas.getZoom();
                const vpt  = canvas.viewportTransform;
                const screenX = Math.round(p.x * zoom + vpt[4] + rect.left);
                const screenY = Math.round(p.y * zoom + vpt[5] + rect.top);

                // Remove any existing inline input
                const old = document.getElementById('text-tool-input');
                if (old) old.remove();

                const inp = document.createElement('input');
                inp.id = 'text-tool-input';
                inp.type = 'text';
                inp.placeholder = '输入文字 / Enter text';
                inp.style.cssText = [
                    'position:fixed',
                    `left:${screenX}px`,
                    `top:${screenY}px`,
                    'min-width:140px',
                    'padding:4px 8px',
                    `border:2px solid ${self._color}`,
                    'border-radius:4px',
                    'font-size:16px',
                    `color:${self._color}`,
                    'background:rgba(255,255,255,0.96)',
                    'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
                    'z-index:9999',
                    'outline:none'
                ].join(';');
                document.body.appendChild(inp);
                inp.focus();

                const commit = () => {
                    const text = inp.value.trim();
                    const existing = document.getElementById('text-tool-input');
                    if (existing) existing.remove();
                    if (!text) return;
                    const itext = new fabric.IText(text, {
                        left: p.x, top: p.y,
                        fontSize: 20,
                        fill: self._color,
                        selectable: true,
                        hasControls: true,
                        shadow: null,
                        fontFamily: 'sans-serif'
                    });
                    canvas.add(itext);
                    canvas.discardActiveObject();
                    canvas.renderAll();
                    self.setTool('select'); // auto-switch so zoom works right away
                };

                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') {
                        const el = document.getElementById('text-tool-input');
                        if (el) el.remove();
                    }
                });
                inp.addEventListener('blur', () => setTimeout(commit, 200));
            });
        }

        if (tool === 'arrow') {
            let isDown = false, origX, origY, line, arrowHead;
            canvas.on('mouse:down', (o) => {
                isDown = true;
                const p = canvas.getPointer(o.e);
                origX = p.x; origY = p.y;
                line = new fabric.Line([origX, origY, origX, origY], {
                    stroke: this._color, strokeWidth: 2, selectable: false
                });
                arrowHead = new fabric.Triangle({
                    width: 12, height: 12,
                    fill: this._color,
                    left: origX, top: origY,
                    selectable: false
                });
                canvas.add(line);
                canvas.add(arrowHead);
            });
            canvas.on('mouse:move', (o) => {
                if (!isDown || !line) return;
                const p = canvas.getPointer(o.e);
                line.set({ x2: p.x, y2: p.y });
                const angle = Math.atan2(p.y - origY, p.x - origX) * 180 / Math.PI;
                arrowHead.set({ left: p.x, top: p.y, angle: angle + 90 });
                canvas.renderAll();
            });
            canvas.on('mouse:up', () => {
                isDown = false;
                line = null; arrowHead = null;
            });
        }
    },

    /* ── Set annotation color ────────────────────────────────────────── */
    setColor(color) {
        this._color = color;
        const canvas = this._fabricCanvas;
        if (!canvas) return;
        if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = color;
        }
        // Update color swatch borders to indicate active
        document.querySelectorAll('[onclick^="DesignDrawings.setColor"]').forEach(btn => {
            btn.style.border = (btn.title.toLowerCase() === this._colorName(color)) ? '3px solid #2d3748' : '2px solid transparent';
        });
    },

    _colorName(hex) {
        const map = { '#e53e3e': 'red', '#3182ce': 'blue', '#38a169': 'green', '#1a202c': 'black', '#d69e2e': 'yellow' };
        return map[hex] || '';
    },

    /* ── Undo history ────────────────────────────────────────────────── */
    _pushHistory() {
        if (!this._fabricCanvas) return;
        const json = JSON.stringify(this._fabricCanvas.toJSON());
        this._history.push(json);
        if (this._history.length > 20) this._history.shift();
    },

    undo() {
        if (!this._fabricCanvas || this._history.length < 2) return;
        this._history.pop(); // remove current
        const prev = this._history[this._history.length - 1];
        if (!prev) return;
        const canvas = this._fabricCanvas;
        const bgImg = canvas.backgroundImage;
        const parsed = JSON.parse(prev);
        canvas.loadFromJSON(parsed, () => {
            if (bgImg) canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas));
            else canvas.renderAll();
        });
    },

    /* ── Save annotations ────────────────────────────────────────────── */
    async saveAnnotations() {
        if (!this._fabricCanvas || !this._currentDrawing) return;
        const objects = this._fabricCanvas.toJSON().objects;
        try {
            await apiRequest(`/api/drawings/${this._currentDrawing.id}/annotations`, {
                method: 'PUT',
                body: JSON.stringify({ page_no: 1, objects: objects }),
                headers: { 'Content-Type': 'application/json' }
            });
            // Show success toast with share shortcut
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#38a169;color:#fff;padding:12px 20px;border-radius:8px;z-index:9999;font-size:0.9rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;';
            toast.innerHTML = '<span>✅ 标注已保存 Annotations saved</span>';
            const shareBtn = document.createElement('button');
            shareBtn.textContent = '📤 立即分享';
            shareBtn.style.cssText = 'background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.5);color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.82rem;white-space:nowrap;';
            const self = this;
            shareBtn.onclick = () => { toast.remove(); self.showShareModal(self._currentDrawing.id); };
            toast.appendChild(shareBtn);
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 6000);
        } catch (err) {
            alert('保存失败 Save failed: ' + err.message);
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