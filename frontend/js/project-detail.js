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
        if (PermissionManager.canManageProjects()) list.push({ v: 'prepare', icon: '📝', zh: '项目准备', th: 'Project Prep', warn: true });
        if (PermissionManager.canViewSite())       list.push({ v: 'site',     icon: '🏗️', zh: '今日现场', th: "Today's Site" });
        if (PermissionManager.canViewGantt())      list.push({ v: 'processes',icon: '🔧', zh: '进度计划', th: 'Progress Plan' });
        if (['manager','supervisor','purchaser','foreman','owner'].includes(PermissionManager.role())) list.push({ v: 'procurement', icon: '📦', zh: '采购总览', th: 'Procurement' });
        list.push({ v: 'photos', icon: '📷', zh: '现场照片', th: 'Photos' }); // All roles can see site photos
        list.push({ v: 'drawings', icon: '📐', zh: '设计图', th: 'Drawings' }); // All roles can view design drawings
        list.push({ v: 'maintenance', icon: '🛠️', zh: '维修', th: 'Maintenance' });
        if (PermissionManager.canViewOverview())   list.push({ v: 'overview', icon: '📊', zh: '总览提醒', th: 'Overview' });
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
                        <span>←</span> 返回 Back
                    </button>
                    <button class="sb-btn hero-bell" onclick="SiteNotify.open(${this.projectId})" title="通知 Notifications">🔔<span id="sb-bell-count" class="sb-badge" style="display:none"></span></button>
                </div>
                <div class="hero-main">
                    <div class="hero-title">
                        <h2>${getI18nField(this.project, 'name')}</h2>
                        <p class="project-location">📍 ${getI18nField(this.project, 'location')}</p>
                    </div>
                    <div class="hero-progress">
                        <div class="hp-label">总进度 Total Progress</div>
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
        // 采购员 landing: go to materials
        if (viewName === 'site' && PermissionManager.isPurchaser()) viewName = 'materials';
        // 业主 landing: go to overview
        if (viewName === 'site' && PermissionManager.isOwner()) viewName = 'overview';
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
                {
                const _role = PermissionManager.role();
                const _isOwner = _role === 'owner';
                const _isManager = _role === 'manager' || _role === 'supervisor';
                const _goBoard = localStorage.getItem('force_site_board') === '1';

                if (_isOwner || _goBoard) {
                    // 业主 或 点击了"进度看板"按钮 → 显示进度看板
                    localStorage.removeItem('force_site_board');
                    await SiteBoard.init(this.projectId);
                    if (!_isOwner) {
                        // 管理员看板时，右下角显示"返回日报"按钮
                        setTimeout(() => {
                            if (!document.getElementById('to-report-btn')) {
                                const _b = document.createElement('button');
                                _b.id = 'to-report-btn';
                                _b.innerHTML = '📋 日报记录<br><small style="font-size:11px">Daily Reports</small>';
                                _b.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999;background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px 18px;cursor:pointer;font-size:14px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.25);line-height:1.5';
                                _b.onclick = () => ProjectDetail.showSubView('site');
                                document.body.appendChild(_b);
                            }
                        }, 400);
                    }
                    break;
                }

                // 所有内部人员（非业主）→ 直接显示日报
                if (typeof DailyReport !== 'undefined') {
                    await DailyReport.init(this.projectId);
                    // 管理员/主管 显示"进度看板"切换按钮
                    if (_isManager) {
                        setTimeout(() => {
                            if (!document.getElementById('to-board-btn')) {
                                const _b = document.createElement('button');
                                _b.id = 'to-board-btn';
                                _b.innerHTML = '📊 进度看板<br><small style="font-size:11px">Site Board</small>';
                                _b.style.cssText = 'position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));left:20px;z-index:999;background:#1e3a8a;color:#fff;border:none;border-radius:10px;padding:10px 18px;cursor:pointer;font-size:14px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.25);line-height:1.5';
                                _b.onclick = () => { localStorage.setItem('force_site_board','1'); ProjectDetail.showSubView('site'); };
                                document.body.appendChild(_b);
                            }
                        }, 400);
                    }
                } else {
                    await SiteBoard.init(this.projectId);
                }
                break;
                }
                break;
            case 'processes':
                container.innerHTML = `<div class="proc-toolbar">
                    <span class="proc-view-label">视图 View：</span>
                    <button class="proc-toggle active" id="btn-gantt" onclick="ProjectDetail.switchProcView('gantt')">📊 甘特图</button>
                    <button class="proc-toggle" id="btn-cards" onclick="ProjectDetail.switchProcView('cards')">🃏 卡片</button>
                </div>
                <div id="gantt-container"></div>
                <div id="processes-list" class="process-timeline" style="display:none"></div>`;
                await Ganttohart.init(this.projectId);
                break;

            case 'materials':
                container.innerHTML = '<div id="materials-container"></div>';
                MaterialManager.init(this.projectId);
                break;
            case 'drawings':
                container.innerHTML = '<div id="drawings-container"></div>';
                if (typeof DesignDrawings !== 'undefined') DesignDrawings.init(this.projectId);
                break;
            case 'maintenance':
                container.innerHTML = '<div id="maintenance-container"></div>';
                if (typeof Maintenance !== 'undefined') Maintenance.init(this.projectId);
                break;
            case 'photos':
                container.innerHTML = this.renderPhotos();
                photoManager.init(this.projectId);
                break;
            case 'purchase':
                container.innerHTML = '<div id="purchase-audit-container"></div>';
                if (typeof PurchaseAudit !== 'undefined') PurchaseAudit.init(this.projectId);
                break;
            case 'procurement':
                container.innerHTML = this.renderProcurement();
                this._initProcurement();
                break;
            case 'overview':
                container.innerHTML = this.renderOverview();
                this.loadOverviewData();
                break;
        }
    },

    // ---------- Procurement Overview ----------
    renderProcurement() {
        const isAdmin = PermissionManager.isManager();
        return `<div style="padding:16px;max-width:1400px;margin:0 auto">
          <div class="td-head">
            <div>
              <h2 class="td-title">📦 采购总览 <small class="td-th">Procurement</small></h2>
              <div class="td-sub">Materials and procurement analysis · 材料设备与采购分析</div>
            </div>
          </div>

          <div style="display:flex;gap:4px;margin-bottom:14px;background:#fff;border-radius:12px;padding:6px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
            <button class="proc-tab active" id="proc-tab-mat" onclick="ProjectDetail._switchProcTab('mat')">🧱 Materials 收据材料</button>
            <button class="proc-tab" id="proc-tab-ai" onclick="ProjectDetail._switchProcTab('ai')">📋 Analysis 采购分析</button>
          </div>
          <style>
            .proc-tab{flex:1;padding:10px;border:none;border-radius:8px;cursor:pointer;font-size:14px;background:transparent;color:#475569}
            .proc-tab.active{background:#2563eb;color:#fff;font-weight:700}
            .proc-tab:hover:not(.active){background:#f1f5f9}
          </style>

          <div id="proc-mat-panel"><div id="materials-container"></div></div>
          <div id="proc-ai-panel" style="display:none"><div id="purchase-audit-container"></div></div>
        </div>`;
    },

    _initProcurement() {
        MaterialManager.init(this.projectId);
    },

    switchProcView(view) {
        const gantt = document.getElementById('gantt-container');
        const cards = document.getElementById('processes-list');
        const btnG  = document.getElementById('btn-gantt');
        const btnC  = document.getElementById('btn-cards');
        if (view === 'gantt') {
            if (gantt) gantt.style.display = '';
            if (cards) cards.style.display = 'none';
            if (btnG) { btnG.classList.add('active'); }
            if (btnC) { btnC.classList.remove('active'); }
            if (typeof Ganttohart !== 'undefined') Ganttohart.init(this.projectId);
        } else {
            if (gantt) gantt.style.display = 'none';
            if (cards) cards.style.display = '';
            if (btnG) { btnG.classList.remove('active'); }
            if (btnC) { btnC.classList.add('active'); }
            if (typeof ProcessManager !== 'undefined') ProcessManager.init(this.projectId);
        }
    },
    _switchProcTab(tab) {
        document.getElementById('proc-tab-mat')?.classList.toggle('active', tab==='mat');
        document.getElementById('proc-tab-ai')?.classList.toggle('active', tab==='ai');
        const matPanel = document.getElementById('proc-mat-panel');
        const aiPanel = document.getElementById('proc-ai-panel');
        if(matPanel) matPanel.style.display = tab==='mat' ? '' : 'none';
        if(aiPanel) aiPanel.style.display = tab==='ai' ? '' : 'none';
        // Lazy init AI panel (admin only)
        if (tab==='ai' && typeof PurchaseAudit!=='undefined') {
            const box = document.getElementById('purchase-audit-container');
            if (box && !box.hasAttribute('data-init')) {
                box.setAttribute('data-init','1');
                PurchaseAudit.init(this.projectId);
            }
        }
    },

    // ---------- 现场照片 ----------
    renderPhotos() {
        return `<div style="padding:16px;max-width:900px;margin:0 auto">
            <div class="td-head">
                <div><h2 class="td-title">📷 Site Photos <small class="td-th">现场照片</small></h2>
                <div class="td-sub"><span class="td-sub-en">Upload construction progress photos · </span>上传施工进度照片</div></div>
                <button class="sb-btn primary" onclick="photoManager.showUploadForm()">📷 Upload 上传照片</button>
            </div>
            <div id="photos-grid" class="photo-grid" style="margin-top:12px"></div>
        </div>`;
    },

    // ---------- 总览提醒 ----------
    renderOverview() {
        const p = this.project || {};
        const day = d => (d ? String(d).slice(0, 10) : '-');
        const statusTxt = { active: '进行中 In Progress', planning: '筹备中 Planning', completed: '已完工 Completed', paused: '暂停 Paused' }[p.status] || (p.status || '-');
        return `
            <div class="project-overview">
                <div class="overview-cards">
                    <div class="overview-card"><div class="card-icon">📊</div><div class="card-content"><h3>总工序数 Total Processes</h3><p class="card-value" id="overview-processes">-</p></div></div>
                    <div class="overview-card"><div class="card-icon">✅</div><div class="card-content"><h3>已完成 Completed</h3><p class="card-value" id="overview-completed">-</p></div></div>
                    <div class="overview-card"><div class="card-icon">🚧</div><div class="card-content"><h3>进行中 In Progress</h3><p class="card-value" id="overview-inprogress">-</p></div></div>
                    <div class="overview-card"><div class="card-icon">👷</div><div class="card-content"><h3>施工人员 Workers</h3><p class="card-value" id="overview-members">-</p></div></div>
                </div>

                <div id="overview-estimate"></div>

                <div class="detail-section">
                    <h3>需要关注 Items to watch</h3>
                    <div id="overview-alerts"><div class="td-empty">读取中…</div></div>
                </div>

                <div class="detail-section">
                    <h3>项目信息 Project Info</h3>
                    <div class="info-table">
                        <div class="info-row"><span class="info-label">客户 Client:</span><span class="info-value">${p.client_name || '-'}</span></div>
                        <div class="info-row"><span class="info-label">开始日期 Start Date:</span><span class="info-value">${day(p.start_date)}</span></div>
                        <div class="info-row"><span class="info-label">结束日期 End Date:</span><span class="info-value">${day(p.planned_end_date)}</span></div>
                        <div class="info-row"><span class="info-label">状态 Status:</span><span class="info-value">${statusTxt}</span></div>
                    </div>
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

            SiteEstimate.get(pid, true).then(est => {
                const eb = document.getElementById('overview-estimate');
                if (eb && est && est.planned) { eb.innerHTML = SiteEstimate.panel(est, true); SiteEstimate.bindGo(eb); }
            }).catch(() => { /* 预计天数失败不影响总览 */ });

            const box = document.getElementById('overview-alerts');
            if (!box) return;
            const nameOf = p => getI18nField({ process_name: p.process_name }, 'process_name');
            const sections = [];

            const stuck = procs.filter(p => p.status === 'waiting_material' || p.status === 'weather_stop');
            if (stuck.length) {
                sections.push(`<h4>停工中的工序（${stuck.length}）</h4><ul class="sb-list">` + stuck.map(p =>
                    `<li>${esc(nameOf(p))} — ${p.status === 'waiting_material' ? '🟡 缺材料 Missing Materials' : '⛅ 天气停工 Weather Stop'}</li>`).join('') + '</ul>');
            }
            const ovs = ovRes && ovRes.success ? ovRes.data : [];
            if (ovs.length) {
                const sev = { high: '高 High', medium: '中 Medium', low: '低 Low' };
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
            this.showEstimate();
        } catch (error) {
            console.error('Load processes error:', error);
        }
    },

    // 在进度计划页顶部放“预计工期与人员配置”，并在每张工序卡片上加配置和预计天数
    async showEstimate() {
        try {
            const e = await SiteEstimate.get(this.projectId, true);
            const list = document.getElementById('processes-list');
            if (!list || !e || !e.planned) return;
            const box = document.createElement('div');
            box.innerHTML = SiteEstimate.panel(e, true);
            const header = list.querySelector('.processes-header');
            if (header) header.after(box); else list.prepend(box);
            SiteEstimate.bindGo(box);
            e.tasks.forEach(t => {
                const card = document.getElementById('process-' + t.execId);
                if (!card || t.status === 'completed') return;
                const anchor = card.querySelector('.process-card-progress');
                const html = SiteEstimate.line(t);
                if (anchor && html) anchor.insertAdjacentHTML('afterend', html);
            });
        } catch (err) {
            console.error('Load estimate error:', err);
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
            s.innerHTML = `${k === 0 ? '整栋 / Whole Building' : k + ' 层 / Floor ' + k} <span class="td-count">${done}/${items.length} 完成 Done</span>`;
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
