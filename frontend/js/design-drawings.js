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
                html += `
                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <div style="background:#f7fafc;height:120px;display:flex;align-items:center;justify-content:center;font-size:3rem;">
                            ${d.file_type === 'pdf' ? '📄' : '🖼️'}
                        </div>
                        <div style="padding:12px;">
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                ${badge}
                                <span style="font-size:0.75rem;color:#718096;">${this.esc(dateStr)}</span>
                            </div>
                            <div style="font-weight:600;font-size:0.9rem;color:#2d3748;margin-bottom:4px;word-break:break-all;">${this.esc(d.file_name)}</div>
                            ${d.description ? `<div style="font-size:0.8rem;color:#718096;margin-bottom:8px;">${this.esc(d.description)}</div>` : ''}
                            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                                <button class="sb-btn primary" style="font-size:0.8rem;padding:4px 10px;" onclick="DesignDrawings.openAnnotator(${this.esc(JSON.stringify(JSON.stringify(d)))})">✏️ 标注 Annotate</button>
                                ${canDelete ? `<button class="sb-btn" style="font-size:0.8rem;padding:4px 10px;color:#e53e3e;border-color:#e53e3e;" onclick="DesignDrawings.deleteDrawing(${d.id})">🗑️ 删除 Delete</button>` : ''}
                            </div>
                        </div>
                    </div>`;
            });
            html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
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

    /* ── Open the Fabric.js annotator modal ─────────────────────────── */
    openAnnotator(drawingJson) {
        const drawing = typeof drawingJson === 'string' ? JSON.parse(drawingJson) : drawingJson;
        this._currentDrawing = drawing;
        this._history = [];

        const isOwner = typeof PermissionManager.isOwner === 'function' && PermissionManager.isOwner();
        const canvasW = Math.min(window.innerWidth - 48, 1200);
        const canvasH = Math.min(window.innerHeight - 200, 800);

        const modal = document.getElementById('modal-container');
        if (!modal) return;

        const toolbarHTML = isOwner ? '' : `
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:#f7fafc;border-bottom:1px solid #e2e8f0;">
                <button class="sb-btn" id="tool-select" onclick="DesignDrawings.setTool('select')" title="Select">↖ 选择</button>
                <button class="sb-btn" id="tool-pencil" onclick="DesignDrawings.setTool('pencil')" title="Pencil">✏️ 笔</button>
                <button class="sb-btn" id="tool-rect" onclick="DesignDrawings.setTool('rect')" title="Rectangle">⬜ 矩形</button>
                <button class="sb-btn" id="tool-text" onclick="DesignDrawings.setTool('text')" title="Text">T 文字</button>
                <button class="sb-btn" id="tool-arrow" onclick="DesignDrawings.setTool('arrow')" title="Arrow">→ 箭头</button>
                <span style="width:1px;background:#e2e8f0;height:24px;display:inline-block;margin:0 4px;"></span>
                <button style="width:22px;height:22px;border-radius:50%;background:#e53e3e;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#e53e3e')" title="Red"></button>
                <button style="width:22px;height:22px;border-radius:50%;background:#3182ce;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#3182ce')" title="Blue"></button>
                <button style="width:22px;height:22px;border-radius:50%;background:#38a169;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#38a169')" title="Green"></button>
                <button style="width:22px;height:22px;border-radius:50%;background:#1a202c;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#1a202c')" title="Black"></button>
                <button style="width:22px;height:22px;border-radius:50%;background:#d69e2e;border:2px solid transparent;cursor:pointer;" onclick="DesignDrawings.setColor('#d69e2e')" title="Yellow"></button>
                <span style="width:1px;background:#e2e8f0;height:24px;display:inline-block;margin:0 4px;"></span>
                <button class="sb-btn" onclick="DesignDrawings.undo()" title="Undo">↩ 撤销</button>
                <button class="sb-btn primary" onclick="DesignDrawings.saveAnnotations()" title="Save">💾 保存</button>
                <button class="sb-btn" onclick="DesignDrawings._closeAnnotator()" style="margin-left:auto;">✕ 关闭</button>
            </div>`;

        const ownerBarHTML = isOwner ? `
            <div style="display:flex;align-items:center;justify-content:flex-end;padding:8px 12px;background:#f7fafc;border-bottom:1px solid #e2e8f0;">
                <span style="color:#718096;font-size:0.85rem;margin-right:auto;">👁 查看模式 View only</span>
                <button class="sb-btn" onclick="DesignDrawings._closeAnnotator()">✕ 关闭</button>
            </div>` : '';

        modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;flex-direction:column;">
                <div style="background:#fff;display:flex;flex-direction:column;height:100vh;max-height:100vh;">
                    <div style="display:flex;align-items:center;padding:8px 16px;background:#2d3748;color:#fff;gap:12px;">
                        <span style="font-size:1rem;font-weight:600;">📐 ${this.esc(drawing.file_name)}</span>
                    </div>
                    ${isOwner ? ownerBarHTML : toolbarHTML}
                    <div style="flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:16px;background:#e2e8f0;">
                        <canvas id="annotation-canvas"></canvas>
                    </div>
                </div>
            </div>`;

        // Init Fabric canvas
        const canvasEl = document.getElementById('annotation-canvas');
        if (!canvasEl) return;
        canvasEl.width = canvasW;
        canvasEl.height = canvasH;

        if (this._fabricCanvas) {
            try { this._fabricCanvas.dispose(); } catch(e) {}
        }
        this._fabricCanvas = new fabric.Canvas('annotation-canvas', {
            width: canvasW,
            height: canvasH,
            selection: !isOwner,
            isDrawingMode: false
        });

        const canvas = this._fabricCanvas;

        // Track undo history
        canvas.on('object:added', () => this._pushHistory());
        canvas.on('object:modified', () => this._pushHistory());

        const self = this;

        const loadBackground = (dataUrl) => {
            fabric.Image.fromURL(dataUrl, (img) => {
                img.scaleToWidth(canvasW);
                const scaledH = img.getScaledHeight();
                if (scaledH > canvasH) {
                    img.scaleToHeight(canvasH);
                }
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
                // After bg is set, load existing annotations
                self._loadAnnotations();
            }, { crossOrigin: 'anonymous' });
        };

        if (drawing.file_type === 'pdf') {
            if (typeof pdfjsLib === 'undefined') {
                alert('PDF.js library not loaded');
                return;
            }
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            const loadingTask = pdfjsLib.getDocument(drawing.file_url);
            loadingTask.promise.then((pdf) => {
                return pdf.getPage(1);
            }).then((page) => {
                const viewport = page.getViewport({ scale: 1.5 });
                const offscreen = document.createElement('canvas');
                offscreen.width = viewport.width;
                offscreen.height = viewport.height;
                const ctx = offscreen.getContext('2d');
                return page.render({ canvasContext: ctx, viewport }).promise.then(() => offscreen);
            }).then((offscreen) => {
                loadBackground(offscreen.toDataURL());
            }).catch((err) => {
                console.error('PDF load error:', err);
            });
        } else {
            // Image
            const imgUrl = drawing.file_url.startsWith('http') ? drawing.file_url : (window.location.origin + drawing.file_url);
            loadBackground(imgUrl);
        }

        if (!isOwner) {
            this.setTool('select');
        }
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
            canvas.on('mouse:down', (o) => {
                const p = canvas.getPointer(o.e);
                const text = prompt('输入文字 Enter text:');
                if (!text) return;
                const itext = new fabric.IText(text, {
                    left: p.x, top: p.y,
                    fontSize: 18,
                    fill: this._color,
                    selectable: true
                });
                canvas.add(itext);
                canvas.setActiveObject(itext);
                canvas.renderAll();
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
            // Show success toast
            const toast = document.createElement('div');
            toast.textContent = '✅ 标注已保存 Annotations saved';
            toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#38a169;color:#fff;padding:12px 20px;border-radius:8px;z-index:9999;font-size:0.9rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
        } catch (err) {
            alert('保存失败 Save failed: ' + err.message);
        }
    }
};

window.DesignDrawings = DesignDrawings;