// 用户管理模块 — 使用 apiRequest()，样式与系统统一
const userManager = {
    users: [],
    projects: [],

    async init() {
        const box = document.getElementById('user-mgmt-body');
        if (box) box.innerHTML = '<div class="td-empty">加载中…</div>';
        try {
            const [ur, pr] = await Promise.all([
                apiRequest('/api/users'),
                apiRequest('/api/projects')
            ]);
            this.users    = ur.data  || [];
            this.projects = pr.data  || [];
        } catch(e) {
            if (document.getElementById('user-mgmt-body'))
                document.getElementById('user-mgmt-body').innerHTML = '<div class="td-empty">加载失败：' + e.message + '</div>';
            return;
        }
        this.render();
    },

    roleLabel(role) {
        return { manager:'👔 经理 ผู้จัดการ', purchaser:'📋 主管 ผู้ควบคุมงาน', executor:'👷 执行者 ผู้ปฏิบัติงาน' }[role] || role;
    },
    roleBadgeClass(role) {
        return { manager:'um-badge-mgr', purchaser:'um-badge-pur', executor:'um-badge-exe' }[role] || '';
    },
    esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },

    render() {
        const counts = { total: this.users.length,
            manager:   this.users.filter(u=>u.role==='manager').length,
            purchaser: this.users.filter(u=>u.role==='purchaser').length,
            executor:  this.users.filter(u=>u.role==='executor').length };

        const rows = this.users.length ? this.users.map(u => `
            <tr>
                <td><b>${this.esc(u.username)}</b></td>
                <td>${this.esc(u.full_name||'-')}</td>
                <td><span class="um-badge ${this.roleBadgeClass(u.role)}">${this.roleLabel(u.role)}</span></td>
                <td>${u.created_at ? u.created_at.toString().substring(0,10) : '-'}</td>
                <td class="um-actions">
                    <button class="sb-btn small" onclick="userManager.showAssign(${u.id})">📋 分配项目</button>
                    <button class="sb-btn small" onclick="userManager.showEdit(${u.id})">✏️ 编辑</button>
                    <button class="sb-btn small warn" onclick="userManager.confirmDelete(${u.id})">🗑️</button>
                </td>
            </tr>`).join('')
            : '<tr><td colspan="5" class="td-empty">还没有用户</td></tr>';

        document.getElementById('user-mgmt-body').innerHTML = `
            <div class="um-stats">
                <div class="um-stat"><div class="um-stat-n">${counts.total}</div><div class="um-stat-l">全部用户</div></div>
                <div class="um-stat"><div class="um-stat-n">${counts.manager}</div><div class="um-stat-l">👔 经理</div></div>
                <div class="um-stat"><div class="um-stat-n">${counts.purchaser}</div><div class="um-stat-l">📋 主管</div></div>
                <div class="um-stat"><div class="um-stat-n">${counts.executor}</div><div class="um-stat-l">👷 执行者</div></div>
            </div>
            <div class="um-table-wrap">
                <table class="um-table">
                    <thead><tr>
                        <th>用户名</th><th>全名</th><th>角色</th><th>创建时间</th><th>操作</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    },

    // ── 添加用户 ──
    showAdd() {
        this._dialog(`
            <h3>➕ 添加用户 เพิ่มผู้ใช้</h3>
            <div class="sb-field"><label>用户名 *</label><input id="um-username" type="text" placeholder="pakorn" autocomplete="off"></div>
            <div class="sb-field"><label>密码 * (最少6位)</label><input id="um-password" type="password" autocomplete="new-password"></div>
            <div class="sb-field"><label>全名 *</label><input id="um-fullname" type="text" placeholder="Pakorn K."></div>
            <div class="sb-field"><label>角色 *</label>
                <select id="um-role">
                    <option value="">— 选择角色 —</option>
                    <option value="manager">👔 经理 ผู้จัดการ</option>
                    <option value="purchaser">📋 主管 ผู้ควบคุมงาน</option>
                    <option value="executor">👷 执行者 ผู้ปฏิบัติงาน</option>
                </select>
            </div>`,
            '添加', async () => {
                const u = document.getElementById('um-username').value.trim();
                const p = document.getElementById('um-password').value;
                const f = document.getElementById('um-fullname').value.trim();
                const r = document.getElementById('um-role').value;
                if (!u||!p||!f||!r) { alert('请填写所有必填项'); return false; }
                if (p.length < 6) { alert('密码至少6位'); return false; }
                await apiRequest('/api/users', { method:'POST', body: JSON.stringify({username:u,password:p,full_name:f,role:r}) });
            });
    },

    // ── 编辑用户 ──
    showEdit(id) {
        const u = this.users.find(x=>x.id===id); if(!u) return;
        this._dialog(`
            <h3>✏️ 编辑用户</h3>
            <div class="sb-field"><label>用户名</label><input value="${this.esc(u.username)}" disabled style="background:#f1f5f9;color:#94a3b8"></div>
            <div class="sb-field"><label>新密码（不填则不改）</label><input id="um-password" type="password" autocomplete="new-password"></div>
            <div class="sb-field"><label>全名 *</label><input id="um-fullname" type="text" value="${this.esc(u.full_name||'')}"></div>
            <div class="sb-field"><label>角色 *</label>
                <select id="um-role">
                    <option value="manager" ${u.role==='manager'?'selected':''}>👔 经理 ผู้จัดการ</option>
                    <option value="purchaser" ${u.role==='purchaser'?'selected':''}>📋 主管 ผู้ควบคุมงาน</option>
                    <option value="executor" ${u.role==='executor'?'selected':''}>👷 执行者 ผู้ปฏิบัติงาน</option>
                </select>
            </div>`,
            '保存', async () => {
                const body = { full_name: document.getElementById('um-fullname').value.trim(), role: document.getElementById('um-role').value };
                const pw = document.getElementById('um-password').value;
                if (pw) body.password = pw;
                await apiRequest(`/api/users/${id}`, { method:'PUT', body: JSON.stringify(body) });
            });
    },

    // ── 分配项目 ──
    async showAssign(id) {
        const u = this.users.find(x=>x.id===id); if(!u) return;
        let assigned = [];
        try { const r = await apiRequest(`/api/users/${id}/projects`); assigned = (r.data||[]).map(p=>p.id); } catch(_){}
        const checks = this.projects.map(p=>`
            <label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:15px">
                <input type="checkbox" value="${p.id}" ${assigned.includes(p.id)?'checked':''} style="width:20px;height:20px;cursor:pointer">
                ${this.esc(p.name||p.name_zh||'项目'+p.id)}
            </label>`).join('') || '<div class="td-empty">还没有项目</div>';
        this._dialog(`
            <h3>📋 为「${this.esc(u.full_name||u.username)}」分配项目</h3>
            <div id="um-projects" style="max-height:300px;overflow-y:auto">${checks}</div>`,
            '保存', async () => {
                const ids = [...document.querySelectorAll('#um-projects input:checked')].map(x=>+x.value);
                await apiRequest(`/api/users/${id}/assign-projects`, { method:'POST', body: JSON.stringify({project_ids:ids}) });
            });
    },

    // ── 删除 ──
    confirmDelete(id) {
        const u = this.users.find(x=>x.id===id); if(!u) return;
        if (!confirm(`确认删除用户「${u.username}」？此操作不可恢复。`)) return;
        apiRequest(`/api/users/${id}`, {method:'DELETE'})
            .then(() => this.init())
            .catch(e => alert('删除失败：' + e.message));
    },

    // ── 通用对话框 ──
    _dialog(bodyHtml, confirmLabel, onConfirm) {
        const d = document.createElement('div'); d.className = 'sb-overlay';
        d.innerHTML = `<div class="sb-dialog narrow"><div class="sb-body">${bodyHtml}</div>
            <footer><button class="sb-btn" data-cancel>取消</button>
            <button class="sb-btn primary" data-ok>${confirmLabel}</button></footer></div>`;
        document.body.appendChild(d);
        const close = () => d.remove();
        d.querySelector('[data-cancel]').onclick = close;
        d.querySelector('[data-ok]').onclick = async () => {
            try {
                const r = await onConfirm();
                if (r === false) return;
                close();
                await this.init();
            } catch(e) { alert('操作失败：' + e.message); }
        };
    }
};
