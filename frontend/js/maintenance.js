/**
 * maintenance.js
 * Module for managing maintenance work orders (维修工单).
 * Exposes window.Maintenance with init, load, render, and CRUD methods.
 * Follows the const X={...}; window.X=X pattern from design-drawings.js.
 */

const Maintenance = {
    projectId: null,
    tickets:   [],

    /* ── HTML escape helper ─────────────────────────────────────────── */
    esc(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    /* ── Init ───────────────────────────────────────────────────────── */
    async init(projectId) {
        this.projectId = projectId;
        const container = document.getElementById('maintenance-container');
        if (!container) return;
        container.innerHTML = '<div style="padding:24px;text-align:center;color:#718096;">加载中… Loading…</div>';
        await this.load();
        this.render();
    },

    /* ── Load tickets from API ──────────────────────────────────────── */
    async load() {
        try {
            const res = await apiRequest(`/api/projects/${this.projectId}/maintenance`);
            this.tickets = (res && res.data) ? res.data : [];

            // Unread badge: pending tickets assigned to current worker
            const role = PermissionManager.role();
            const currentUser = PermissionManager.getCurrentUser();
            const userId = currentUser.id || null;   // use getCurrentUser().id (not .userId())

            if (role === 'worker' && userId) {
                const unread = this.tickets.filter(
                    t => t.status === 'pending' && String(t.assigned_to) === String(userId)
                ).length;
                const tabBtn = document.querySelector('[data-view="maintenance"]');
                if (tabBtn) {
                    let badge = tabBtn.querySelector('.maint-badge');
                    if (unread > 0) {
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'maint-badge';
                            badge.style.cssText =
                                'position:absolute;top:2px;right:2px;background:#e53e3e;color:#fff;' +
                                'border-radius:10px;font-size:10px;padding:1px 5px;';
                            tabBtn.style.position = 'relative';
                            tabBtn.appendChild(badge);
                        }
                        badge.textContent = unread;
                        badge.style.display = 'inline';
                    } else if (badge) {
                        badge.style.display = 'none';
                    }
                }
            }
        } catch (err) {
            this.tickets = [];
        }
    },

    /* ── Render ticket list ─────────────────────────────────────────── */
    render() {
        const container = document.getElementById('maintenance-container');
        if (!container) return;
        const role = PermissionManager.role();
        const isManager    = role === 'manager';
        const isSupervisor = role === 'supervisor';
        const isOwner      = PermissionManager.isOwner();

        let html = `<div style="padding:16px;max-width:600px;margin:0 auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;
                margin-bottom:16px;gap:8px;flex-wrap:wrap;">
      <h3 style="margin:0;font-size:1.1rem;color:#2d3748;">🛠️ 维修工单 Maintenance</h3>
      ${(isManager || isSupervisor)
        ? `<button class="sb-btn primary" style="min-height:44px;"
             onclick="Maintenance.showCreateForm()">➕ 创建工单</button>`
        : ''}
      ${isOwner
        ? `<button class="sb-btn primary" style="min-height:44px;"
             onclick="Maintenance.showCreateForm()">📋 申报维修</button>`
        : ''}
    </div>`;

        if (!this.tickets.length) {
            html += `<div style="padding:40px;text-align:center;color:#a0aec0;
                             border:2px dashed #e2e8f0;border-radius:8px;">
      <div style="font-size:2rem;margin-bottom:8px;">🛠️</div>
      <div>暂无工单 No tickets</div></div>`;
        } else {
            this.tickets.forEach(t => {
                html += `
        <div onclick="Maintenance.showTicketDetail(${t.id})"
             style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;
                    padding:14px 16px;margin-bottom:12px;cursor:pointer;
                    box-shadow:0 1px 3px rgba(0,0,0,.06);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            ${this._badgeHtml(t.status)}
            <span style="font-weight:600;font-size:1rem;flex:1;">${this.esc(t.title)}</span>
          </div>
          <div style="font-size:0.85rem;color:#718096;display:flex;gap:12px;flex-wrap:wrap;">
            <span>👷 ${this.esc(t.assigned_name || '未指派')}</span>
            <span>🕐 ${t.updated_at ? new Date(t.updated_at).toLocaleDateString('zh-CN') : ''}</span>
            ${t.priority === 'urgent'
              ? '<span style="color:#e53e3e;font-weight:600;">⚡ 紧急</span>'
              : ''}
          </div>
        </div>`;
            });
        }
        html += '</div>';
        container.innerHTML = html;
    },

    /* ── Status badge HTML ──────────────────────────────────────────── */
    _badgeHtml(status) {
        const map = {
            'pending':     { bg:'#f6ad55', color:'#7b341e', label:'待处理' },
            'in-progress': { bg:'#63b3ed', color:'#1a365d', label:'进行中' },
            'completed':   { bg:'#68d391', color:'#1c4532', label:'已完成' },
            'cancelled':   { bg:'#e2e8f0', color:'#4a5568', label:'已取消' }
        };
        const s = map[status] || map['pending'];
        return `<span style="background:${s.bg};color:${s.color};padding:2px 10px;
    border-radius:12px;font-size:0.78rem;font-weight:600;white-space:nowrap;">${s.label}</span>`;
    },

    /* ── Create form modal ──────────────────────────────────────────── */
    async showCreateForm() {
        const isOwner = PermissionManager.isOwner();
        let workerOptions = '';
        if (!isOwner) {
            try {
                // /api/users/workers — accessible to manager and supervisor (not /api/users)
                const uRes = await apiRequest('/api/users/workers');
                const workers = uRes.data || [];
                workerOptions = workers.map(w =>
                    `<option value="${w.id}" data-name="${this.esc(w.full_name || w.username)}">
               ${this.esc(w.full_name || w.username)}
             </option>`
                ).join('');
            } catch (_) { /* non-fatal: dropdown stays empty */ }
        }

        const mc = document.getElementById('modal-container');
        if (!mc) return;
        mc.innerHTML = `
    <div class="modal-overlay"
         onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''">
      <div class="modal-content" style="max-width:480px;width:95vw;padding:24px;">
        <h3 style="margin:0 0 16px;">${isOwner ? '📋 申报维修' : '➕ 创建工单'}</h3>
        <form id="maint-create-form" onsubmit="Maintenance.submitCreate(event)">
          <div class="sb-field">
            <label>标题 Title *</label>
            <input id="mc-title" class="sb-input" required maxlength="200"
                   placeholder="请描述问题…">
          </div>
          <div class="sb-field">
            <label>描述 Description</label>
            <textarea id="mc-desc" class="sb-input" rows="3"
                      placeholder="详细说明…"></textarea>
          </div>
          ${!isOwner ? `
          <div class="sb-field">
            <label>指派工人 Assign Worker</label>
            <select id="mc-worker" class="sb-input">
              <option value="">— 暂不指派 —</option>
              ${workerOptions}
            </select>
          </div>
          <div class="sb-field">
            <label>优先级 Priority</label>
            <select id="mc-priority" class="sb-input">
              <option value="normal">普通 Normal</option>
              <option value="urgent">⚡ 紧急 Urgent</option>
            </select>
          </div>` : ''}
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
            <button type="button" class="sb-btn" style="min-height:44px;"
              onclick="document.getElementById('modal-container').innerHTML=''">
              取消 Cancel
            </button>
            <button type="submit" class="sb-btn primary" style="min-height:44px;">
              ${isOwner ? '提交 Submit' : '创建 Create'}
            </button>
          </div>
        </form>
      </div>
    </div>`;
    },

    /* ── Submit create form ─────────────────────────────────────────── */
    async submitCreate(e) {
        e.preventDefault();
        const title = document.getElementById('mc-title')?.value.trim();
        if (!title) return;
        const workerSel     = document.getElementById('mc-worker');
        const assigned_to   = workerSel?.value || null;
        const assigned_name = workerSel?.options[workerSel.selectedIndex]?.dataset.name || null;
        const priority      = document.getElementById('mc-priority')?.value || 'normal';
        const description   = document.getElementById('mc-desc')?.value || null;

        try {
            const res = await apiRequest(`/api/projects/${this.projectId}/maintenance`, {
                method: 'POST',
                body: JSON.stringify({ title, description, assigned_to, assigned_name, priority })
                // submitted_by_owner is set server-side from req.user.role — not sent from client
            });
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('工单已创建 Ticket created', 'success');
            await this.load();
            this.render();
        } catch (err) {
            app.showToast('创建失败: ' + err.message, 'error');
        }
    },

    /* ── Ticket detail modal ────────────────────────────────────────── */
    showTicketDetail(id) {
        const t = this.tickets.find(t => t.id === id);
        if (!t) return;
        const role         = PermissionManager.role();
        const isManager    = role === 'manager';
        const isSupervisor = role === 'supervisor';
        const isWorker     = role === 'worker';

        const beforePhotos = (t.photos || []).filter(p => p.photo_type === 'before');
        const afterPhotos  = (t.photos || []).filter(p => p.photo_type === 'after');

        const photoGrid = (photos) => photos.length
            ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
         ${photos.map(p =>
               `<img src="${this.esc(p.photo_url)}"
                 style="width:80px;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;"
                 onclick="window.open('${this.esc(p.photo_url)}','_blank')">`
             ).join('')}
       </div>`
            : '<div style="color:#a0aec0;font-size:0.85rem;">暂无照片</div>';

        // Workers skip 'in-progress'; complete button disabled until after-photo exists
        const hasAfterPhoto = afterPhotos.length > 0;
        const canComplete   = isWorker && t.status !== 'completed' && t.status !== 'cancelled' && hasAfterPhoto;

        const mc = document.getElementById('modal-container');
        if (!mc) return;
        mc.innerHTML = `
    <div class="modal-overlay"
         onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''">
      <div class="modal-content"
           style="max-width:520px;width:95vw;padding:24px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;
                    margin-bottom:12px;">
          <h3 style="margin:0;flex:1;">
            ${this._badgeHtml(t.status)} ${this.esc(t.title)}
          </h3>
          <button class="sb-btn" style="min-height:44px;margin-left:8px;"
            onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <p style="color:#718096;font-size:0.88rem;margin:0 0 12px;">
          ${this.esc(t.description || '无描述')}
        </p>
        <div style="font-size:0.85rem;color:#4a5568;margin-bottom:16px;">
          <div>👷 指派: ${this.esc(t.assigned_name || '未指派')}</div>
          <div>📅 创建: ${t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : ''}</div>
          ${t.completed_at
            ? `<div>✅ 完成: ${new Date(t.completed_at).toLocaleString('zh-CN')}</div>`
            : ''}
        </div>
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:4px;">📷 施工前照片</div>
          ${photoGrid(beforePhotos)}
        </div>
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:4px;">✅ 完工照片</div>
          ${photoGrid(afterPhotos)}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          ${isWorker && t.status !== 'completed' && t.status !== 'cancelled' ? `
            <button class="sb-btn primary" style="min-height:44px;"
              onclick="Maintenance.uploadPhoto(${t.id},'after')">
              📷 上传完工照片
            </button>
            <button class="sb-btn primary"
                    style="min-height:44px;${!canComplete ? 'opacity:0.5;cursor:not-allowed;' : ''}"
                    ${!canComplete ? 'disabled' : ''}
                    onclick="Maintenance.updateStatus(${t.id},'completed')">
              ✅ 完成工单${!hasAfterPhoto ? ' (需先上传照片)' : ''}
            </button>
          ` : ''}
          ${(isManager || isSupervisor) && t.status !== 'completed' && t.status !== 'cancelled' ? `
            <button class="sb-btn" style="min-height:44px;"
              onclick="Maintenance._showReassignForm(${t.id})">🔄 重新指派</button>
          ` : ''}
          ${isManager && ['pending', 'cancelled'].includes(t.status) ? `
            <button class="sb-btn"
                    style="min-height:44px;color:#e53e3e;border-color:#e53e3e;"
                    onclick="Maintenance._deleteTicket(${t.id})">🗑️ 删除</button>
          ` : ''}
          ${isManager && t.status === 'pending' ? `
            <button class="sb-btn"
                    style="min-height:44px;color:#718096;"
                    onclick="Maintenance.updateStatus(${t.id},'cancelled')">✕ 取消工单</button>
          ` : ''}
          ${isManager && t.status === 'completed' ? `
            <button class="sb-btn primary" style="min-height:44px;"
              onclick="Maintenance.shareTicket(${t.id})">📤 生成分享链接</button>
          ` : ''}
        </div>
      </div>
    </div>`;
    },

    /* ── Update ticket status ───────────────────────────────────────── */
    async updateStatus(id, status) {
        try {
            const res = await apiRequest(`/api/maintenance/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('工单已更新', 'success');
            await this.load();
            this.render();
        } catch (err) {
            app.showToast('更新失败: ' + err.message, 'error');
        }
    },

    /* ── Upload photo for a ticket ──────────────────────────────────── */
    async uploadPhoto(ticketId, photoType) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/jpeg,image/png';
        inp.onchange = async () => {
            if (!inp.files[0]) return;
            const fd = new FormData();
            fd.append('photo', inp.files[0]);
            fd.append('project_id', this.projectId);
            fd.append('ticket_id', ticketId);           // FK to maintenance_tickets
            fd.append('photo_type', photoType);
            fd.append('photo_category', 'maintenance'); // identifies this as a maintenance photo

            const token = localStorage.getItem('authToken');
            try {
                app.showToast('上传中…', 'info');
                const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
                const r = await fetch(`${API_BASE}/api/photos/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: fd
                });
                const json = await r.json();
                if (!json.success) throw new Error(json.message);
                app.showToast('照片已上传', 'success');
                await this.load();
                this.render();
                this.showTicketDetail(ticketId);
            } catch (err) {
                app.showToast('上传失败: ' + err.message, 'error');
            }
        };
        inp.click();
    },

    /* ── Generate share link for a completed ticket ─────────────────── */
    async shareTicket(id) {
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
            const r = await fetch(`${API_BASE}/api/maintenance/${id}/share`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const res = await r.json();
            if (!res.success) throw new Error(res.message);
            const { share_url } = res.data;   // field is share_url per backend design
            const ticket = this.tickets.find(t => t.id === id);
            const msgText = `🛠️ 维修工单\n${ticket ? ticket.title : ''}\n${share_url}`;

            const mc = document.getElementById('modal-container');
            mc.innerHTML = `
      <div class="modal-overlay"
           onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''">
        <div class="modal-content" style="max-width:420px;width:95vw;padding:24px;">
          <h3 style="margin:0 0 12px;">📤 分享工单 Share Ticket</h3>
          <textarea id="share-msg-box" class="sb-input" rows="4"
                    style="margin-bottom:12px;">${this.esc(msgText)}</textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="sb-btn"
                    style="background:#06c755;color:#fff;border-color:#06c755;min-height:44px;"
                    onclick="window.open(
                      'https://social-plugins.line.me/lineit/share?url='
                      +encodeURIComponent('${this.esc(share_url)}')
                      +'&text='+encodeURIComponent(document.getElementById('share-msg-box').value),
                      '_blank')">
              💬 LINE 分享
            </button>
            <button class="sb-btn"
                    style="background:#07c160;color:#fff;border-color:#07c160;min-height:44px;"
                    onclick="navigator.clipboard.writeText(
                      document.getElementById('share-msg-box').value)
                      .then(()=>app.showToast('已复制 Copied!','success'))
                      .catch(()=>{
                        document.getElementById('share-msg-box').select();
                        document.execCommand('copy');
                      })">
              💚 微信复制 WeChat Copy
            </button>
            <button class="sb-btn" style="min-height:44px;"
              onclick="document.getElementById('modal-container').innerHTML=''">✕ 关闭</button>
          </div>
        </div>
      </div>`;
        } catch (err) {
            app.showToast('分享失败: ' + err.message, 'error');
        }
    },

    /* ── Reassign form modal ────────────────────────────────────────── */
    async _showReassignForm(ticketId) {
        let opts = '';
        try {
            const uRes = await apiRequest('/api/users/workers');   // /api/users/workers for supervisor access
            (uRes.data || []).forEach(w => {
                opts += `<option value="${w.id}" data-name="${this.esc(w.full_name || w.username)}">
                 ${this.esc(w.full_name || w.username)}
               </option>`;
            });
        } catch (_) { /* non-fatal */ }

        const mc = document.getElementById('modal-container');
        mc.innerHTML = `
    <div class="modal-overlay"
         onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''">
      <div class="modal-content" style="max-width:360px;width:95vw;padding:24px;">
        <h3 style="margin:0 0 12px;">🔄 重新指派 Reassign</h3>
        <select id="reassign-worker" class="sb-input" style="margin-bottom:12px;">
          <option value="">— 选择工人 —</option>
          ${opts}
        </select>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="sb-btn" style="min-height:44px;"
            onclick="document.getElementById('modal-container').innerHTML=''">取消</button>
          <button class="sb-btn primary" style="min-height:44px;" onclick="
const sel = document.getElementById('reassign-worker');
const v = sel.value;
const n = sel.options[sel.selectedIndex]?.dataset.name || '';
if (!v) { app.showToast('请选择工人','error'); return; }
apiRequest('/api/maintenance/${ticketId}', {
  method: 'PUT',
  body: JSON.stringify({ assigned_to: v, assigned_name: n, status: 'in-progress' })
})
.then(r => {
  if (!r.success) throw new Error(r.message);
  document.getElementById('modal-container').innerHTML = '';
  app.showToast('已重新指派', 'success');
  return Maintenance.load();
})
.then(() => Maintenance.render())
.catch(e => app.showToast('失败: ' + e.message, 'error'));
          ">确认指派</button>
        </div>
      </div>
    </div>`;
    },

    /* ── Delete ticket ──────────────────────────────────────────────── */
    async _deleteTicket(id) {
        if (!confirm('确认删除此工单？')) return;
        try {
            const res = await apiRequest(`/api/maintenance/${id}`, { method: 'DELETE' });
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('工单已删除', 'success');
            await this.load();
            this.render();
        } catch (err) {
            app.showToast('删除失败: ' + err.message, 'error');
        }
    }
};

window.Maintenance = Maintenance;
