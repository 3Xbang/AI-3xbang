// 项目详情页面 - 进入项目后的主界面
// 页签按真实流程排：项目准备 → 今日现场 → 进度计划 → 材料设备 → 总览提醒
const ProjectDetail = {
    projectId: null,
    project: null,
    readiness: null,
    currentView: 'site', // prepare(项目准备), site(今日现场), processes(进度计划), materials(材料设备), overview(总览提醒)

    // 初始化项目详情
    async init(projectId) {
        this.projectId = projectId;
        await this.loadProjectInfo();

        if (typeof ProcessManager !== 'undefined') ProcessManager.init(projectId);
        if (typeof ProcessScheduling !== 'undefined') ProcessScheduling.init(projectId);

        // 默认首页：管理者——准备没完成进“项目准备”，完成了进“总览提醒”；其他人进“今日现场”
        this.readiness = null;
        let first = 'site';
        if (PermissionManager.canManageProjects()) {
            await this.loadReadiness();
            first = this.readiness && !this.readiness.ready ? 'prepare' : 'overview';
        }
        this.currentView = first;
        this.render();
        this.showSubView(first);
        if (typeof SiteNotify !== 'undefined') SiteNotify.refreshCount();
    },

    async loadReadiness() {
        try {
            const r = await apiRequest(`/api/projects/${this.projectId}/readiness`);
            this.readiness = r.success ? r.data : null;
        } catch (e) { this.readiness = null; }
        const tab = document.querySelector('.project-nav [data-view="prepare"] .nav-warn');
        if (tab) tab.style.display = this.readiness && !this.readiness.ready ? 'inline' : 'none';
    },

    // 加载项目信息
    async loadProjectInfo() {
        try {
            if (app.currentProject && app.currentProject.id === this.projectId) {
                this.project = app.currentProject;
            } else {
                const result = await api.getProjects();
                if (result.success) this.project = result.data.find(p => p.id === this.projectId);
            }
        } catch (error) {
            console.error('Load project info error:', error);
        }
    },

    tabs() {
        const list = [];
        if (PermissionManager.canManageProjects()) list.push({ v: 'prepare', icon: '📝', zh: '项目准备', th: 'เตรียมโครงการ', warn: true });
        list.push({ v: 'site', icon: '🏗️', zh: '今日现场', th: 'หน้างานวันนี้' });
        list.push({ v: 'processes', icon: '🔧', zh: '进度计划', th: 'แผนความคืบหน้า' });
        list.push({ v: 'materials', icon: '🧱', zh: '材料设备', th: 'วัสดุและอุปกรณ์' });
        list.push({ v: 'overview', icon: '📊', zh: '总览提醒', th: 'ภาพรวมและแจ้งเตือน' });
        return list;
    },

    // 渲染项目详情页面
    render() {
        const container = document.getElementById('project-detail-container');
        if (!container) return;
        const notReady = this.readiness && !this.readiness.ready;

        container.innerHTML = `
            <div class="project-detail-header hero">
                <div class="hero-top">
                    <button class="btn-back" onclick="ProjectDetail.backToDashboard()">
                        <span>←</span> 返回 กลับ
                    </button>
                    <button class="sb-btn hero-bell" onclick="SiteNotify.open(${this.projectId})" title="通知 การแจ้งเตือน">🔔<span id="sb-bell-count" class="sb-badge" style="display:none"></span></button>
                </div>
                <div class="hero-main">
                    <div class="hero-title">
                        <h2>${getI18nField(this.project, 'name')}</h2>
                        <p class="project-location">📍 ${getI18nField(this.project, 'location')}</p>
                    </div>
                    <div class="hero-progress">
                        <div class="hp-label">总进度 ความคืบหน้ารวม</div>
                        <div class="hp-row"><div class="hp-bar"><i style="width:${Math.min(100, Math.round(this.project.progress || 0))}%"></i></div><b>${Math.round(this.project.progress || 0)}%</b></div>
                    </div>
                </div>
            </div>

            <div class="project-nav tabs-v2">
                ${this.tabs().map(t => `
                    <button class="nav-item ${this.currentView === t.v ? 'active' : ''}" data-view="${t.v}" onclick="ProjectDetail.showSubView('${t.v}')">
                        <span class="nav-icon">${t.icon}</span>
                        <span class="nav-label"><b>${t.zh}${t.warn ? `<span class="nav-warn" style="display:${notReady ? 'inline' : 'none'}"> ●</span>` : ''}</b><small>${t.th}</small></span>
                    </button>`).join('')}
            </div>

            <div id="project-subview-container" class="project-subview-container"></div>
        `;
    },

    // 显示子视图
    async showSubView(viewName) {
        if (viewName === 'prepare' && !PermissionManager.canManageProjects()) viewName = 'site';
        this.currentView = viewName;

        document.querySelectorAll('.project-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        const container = document.getElementById('project-subview-container');
        if (!container) return;

        switch (viewName) {
            case 'prepare':
                container.innerHTML = '<div id="prepare-container"></div>';
                await ProjectPrepare.init(this.projectId);
                break;
            case 'site':
                container.innerHTML = '<div id="site-board-container"></div>';
                await SiteBoard.init(this.projectId);
                break;
            case 'processes':
                container.innerHTML = '<div id="processes-list" class="process-timeline"></div>';
                await this.loadProcesses();
                break;
            case 'materials':
                container.innerHTML = '<div id="materials-container"></div>';
                MaterialManager.init(this.projectId);
                break;
            case 'overview':
                container.innerHTML = this.renderOverview();
                this.loadOverviewData();
                photoManager.init(this.projectId);
                break;
        }
    },

    // ---------- 总览提醒 ----------
    renderOverview() {
        const p = this.project || {};
        const day = d => (d ? String(d).slice(0, 10) : '-');
        const statusTxt = { active: '进行中 กำลังดำเนินการ', planning: '筹备中 เตรียมการ', completed: '已完工 เสร็จสิ้น', paused: '暂停 หยุดชั่วคราว' }[p.status] || (p.status || '-');
        return `
            <div class="project-overview">
                <div class="overview-cards">
                    <div class="overview-card"><div class="card-icon">📊</div><div class="card-content"><h3>总工序数 จำนวนงานทั้งหมด</h3><p class="card-value" id="overview-processes">-</p></div></div>
                    <div class="overview-card"><div class="card-icon">✅</div><div class="card-content"><h3>已完成 เสร็จแล้ว</h3><p class="card-value" id="overview-completed">-</p></div></div>
                    <div class="overview-card"><div class="card-icon">🚧</div><div class="card-content"><h3>进行中 กำลังดำเนินการ</h3><p class="card-value" id="overview-inprogress">-</p></div></div>
                    <div class="overview-card"><div class="card-icon">👷</div><div class="card-content"><h3>施工人员 คนงาน</h3><p class="card-value" id="overview-members">-</p></div></div>
                </div>

                <div class="detail-section">
                    <h3>需要关注 สิ่งที่ต้องดู</h3>
                    <div id="overview-alerts"><div class="td-empty">读取中…</div></div>
                </div>

                <div class="detail-section">
                    <h3>项目信息 ข้อมูลโครงการ</h3>
                    <div class="info-table">
                        <div class="info-row"><span class="info-label">客户 ลูกค้า:</span><span class="info-value">${p.client_name || '-'}</span></div>
                        <div class="info-row"><span class="info-label">开始日期 วันเริ่ม:</span><span class="info-value">${day(p.start_date)}</span></div>
                        <div class="info-row"><span class="info-label">结束日期 วันสิ้นสุด:</span><span class="info-value">${day(p.planned_end_date)}</span></div>
                        <div class="info-row"><span class="info-label">状态 สถานะ:</span><span class="info-value">${statusTxt}</span></div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>现场照片 รูปถ่ายหน้างาน</h3>
                    <div style="margin:8px 0 12px"><button class="btn-primary" onclick="photoManager.showUploadForm()">📷 上传照片 อัปโหลดรูป</button></div>
                    <div id="photos-grid" class="photo-grid"></div>
                </div>
            </div>
        `;
    },

    async loadOverviewData() {
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const pid = this.projectId;
        const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        try {
            const [procRes, teamRes, ovRes, notiRes] = await Promise.all([
                api.processes.getList(pid),
                apiRequest(`/api/projects/${pid}/team`).catch(() => null),
                apiRequest(`/api/projects/${pid}/overrides`).catch(() => null),
                apiRequest(`/api/notifications?unread=1&project_id=${pid}`).catch(() => null)
            ]);
            const procs = procRes.success ? procRes.data : [];
            setText('overview-processes', procs.length);
            setText('overview-completed', procs.filter(p => p.status === 'completed').length);
            setText('overview-inprogress', procs.filter(p => p.status === 'in_progress').length);
            setText('overview-members', teamRes && teamRes.success ? teamRes.data.members.length : '-');

            const box = document.getElementById('overview-alerts');
            if (!box) return;
            const nameOf = p => getI18nField({ process_name: p.process_name }, 'process_name');
            const sections = [];

            const stuck = procs.filter(p => p.status === 'waiting_material' || p.status === 'weather_stop');
            if (stuck.length) {
                sections.push(`<h4>停工中的工序（${stuck.length}）</h4><ul class="sb-list">` + stuck.map(p =>
                    `<li>${esc(nameOf(p))} — ${p.status === 'waiting_material' ? '🟡 缺材料' : '⛅ 天气停工'}</li>`).join('') + '</ul>');
            }
            const ovs = ovRes && ovRes.success ? ovRes.data : [];
            if (ovs.length) {
                const sev = { high: '高', medium: '中', low: '低' };
                sections.push(`<h4>最近的提前开工（${ovs.length}）</h4><ul class="sb-list">` + ovs.slice(0, 5).map(o =>
                    `<li>${esc(nameOf(o))} · 风险${sev[o.severity] || ''} · ${esc(o.decided_by_name || '')} · ${esc(o.created_at)}<br><span class="sb-sub">原因：${esc(o.reason)}</span></li>`).join('') + '</ul>');
            }
            const unread = notiRes && notiRes.success ? notiRes.data.unread : 0;
            if (unread) sections.push(`<h4>未读通知</h4><p>有 ${unread} 条未读通知，点右上角 🔔 查看。</p>`);

            box.innerHTML = sections.length ? sections.join('') : '<div class="td-empty">目前没有需要关注的事 ✅</div>';
        } catch (error) {
            console.error('Load overview data error:', error);
        }
    },

    // ---------- 进度计划：按楼层分组 ----------
    async loadProcesses() {
        try {
            const result = await api.processes.getList(this.projectId);
            if (!result.success) return;
            const list = result.data.slice().sort((a, b) =>
                (a.floor_no || 0) - (b.floor_no || 0) || (a.sequence_number || 0) - (b.sequence_number || 0));
            app.renderProcesses(list);
            this.groupByFloor(list);
        } catch (error) {
            console.error('Load processes error:', error);
        }
    },

    // 把卡片按楼层收进可折叠的区块（只对按申请表生成的工序有效）
    groupByFloor(list) {
        const grid = document.querySelector('#processes-list .processes-grid');
        if (!grid || !list.some(p => p.master_code)) return;
        const cards = Array.from(grid.children);
        if (cards.length !== list.length) return;
        const groups = new Map();
        list.forEach((p, i) => {
            const k = p.floor_no == null ? 0 : p.floor_no;
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push({ p, card: cards[i] });
        });
        const wrap = document.createElement('div');
        let openedOne = false;
        Array.from(groups.keys()).sort((a, b) => a - b).forEach(k => {
            const items = groups.get(k);
            const done = items.filter(x => x.p.status === 'completed').length;
            const active = items.some(x => x.p.status === 'in_progress');
            const d = document.createElement('details');
            d.className = 'td-grp';
            if (active || (!openedOne && done < items.length)) { d.open = true; openedOne = true; }
            const s = document.createElement('summary');
            s.innerHTML = `${k === 0 ? '整栋 / 基础 / 室外' : k + ' 层'} <span class="td-count">${done}/${items.length} 完成</span>`;
            const g = document.createElement('div');
            g.className = 'processes-grid';
            items.forEach(x => g.appendChild(x.card));
            d.appendChild(s); d.appendChild(g);
            wrap.appendChild(d);
        });
        grid.replaceWith(wrap);
    },

    // 返回仪表盘
    backToDashboard() {
        app.showView('dashboard');
    }
};


// 暴露到全局
window.ProjectDetail = ProjectDetail;
