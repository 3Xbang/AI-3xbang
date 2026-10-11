// 项目准备：把“开工前要做的事”排成步骤清单，显示每一步是否完成，并给出下一步按钮。
// 前 3 步（申请表、团队、生成工序）必须完成才能开工；后 2 步（工程量、账号）可以边做边补。
const ProjectPrepare = {
    projectId: null,
    data: null,
    timer: null,

    STEPS: {
        profile: {
            zh: '项目申请表', th: 'แบบฟอร์มโครงการ',
            why: '告诉系统这栋楼是什么样：几层、几套、有几个卫生间、屋顶和装修做法。',
            btn: '填写 / 修改', run: pid => SiteProfile.open(pid)
        },
        team: {
            zh: '施工团队与工种', th: 'ทีมงานและประเภทช่าง',
            why: '按班组填：班组名称、大工几个人、大工会干什么、普工几个人。不需要一个个录名字。',
            btn: '录入 / 修改团队', run: pid => SiteTeam.open(pid)
        },
        plan: {
            zh: '生成工序计划', th: 'สร้างแผนงาน',
            why: '系统按申请表自动生成每层的工序和先后顺序。先预览，确认后再生成。',
            btn: '预览并生成工序', run: pid => SiteProfile.open(pid), needs: ['profile']
        },
        quantities: {
            zh: '工程量清单', th: 'ปริมาณงาน (BOQ)', optional: true,
            why: '导入报价单的 Excel，系统自动对应到各工序。没有的可以先开工，现场再补。',
            btn: '导入清单（Excel）', run: pid => SiteBoq.open(pid), needs: ['plan']
        },
        accounts: {
            zh: '系统账号与权限', th: 'บัญชีผู้ใช้และสิทธิ์', optional: true,
            why: '决定哪些账号能进这个项目（老板、主管、采购、工头）。注意这里不是现场工人。',
            btn: '管理账号', run: pid => projectMembers.showMembersModal(pid, getI18nField(ProjectDetail.project, 'name'))
        }
    },

    async init(projectId) {
        this.projectId = projectId;
        this.watch();
        await this.load();
    },

    async load() {
        const box = document.getElementById('prepare-container');
        if (!box) return;
        try {
            const r = await apiRequest(`/api/projects/${this.projectId}/readiness`);
            this.data = r.data;
            ProjectDetail.readiness = r.data;
            const warn = document.querySelector('.project-nav [data-view="prepare"] .nav-warn');
            if (warn) warn.style.display = r.data.ready ? 'none' : 'inline';
            this.render();
        } catch (e) {
            box.innerHTML = `<div class="td-empty">读取失败：${this.esc(e.message)}</div>`;
        }
    },

    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

    render() {
        const box = document.getElementById('prepare-container');
        if (!box || !this.data) return;
        const steps = this.data.steps;
        const done = Object.fromEntries(steps.map(s => [s.key, s.done]));

        const cards = steps.map((s, i) => {
            const def = this.STEPS[s.key];
            const blockedBy = (def.needs || []).find(k => !done[k]);
            const state = s.done ? 'done' : (def.optional ? 'later' : 'todo');
            const chip = s.done ? '<span class="pp-chip ok">已完成 ✓</span>'
                : def.optional ? '<span class="pp-chip later">可以稍后补</span>' : '<span class="pp-chip todo">还没做</span>';
            return `<div class="pp-step ${state}">
                <div class="pp-num">${s.done ? '✓' : i + 1}</div>
                <div class="pp-main">
                    <div class="pp-title">${def.zh} <small>${def.th}</small> ${chip}</div>
                    <div class="pp-why">${def.why}</div>
                    <div class="pp-detail">${this.esc(s.detail)}</div>
                </div>
                <div class="pp-act">
                    <button class="sb-btn ${s.done ? '' : 'primary'}" data-run="${s.key}" ${blockedBy ? 'disabled' : ''}>${def.btn}</button>
                    ${blockedBy ? `<div class="pp-hint">请先完成「${this.STEPS[blockedBy].zh}」</div>` : ''}
                </div>
            </div>`;
        }).join('');

        const miss = this.data.missing.map(k => `「${this.STEPS[k].zh}」`).join('、');
        const banner = this.data.ready
            ? `<div class="pp-banner ok"><b>准备完成，可以开工了 ✅</b><br>前 3 步都已完成。工程量和账号可以边做边补。` +
              `<div style="margin-top:8px"><button class="sb-btn primary" data-go="site">进入今日现场 ไปหน้างานวันนี้</button></div></div>`
            : `<div class="pp-banner todo"><b>还没准备好</b><br>还差：${miss}。完成这些步骤后，才能在“今日现场”里安排工作。</div>`;

        box.innerHTML = `<div class="pp-wrap">
            <div class="td-head"><div><h2 class="td-title">项目准备 <small class="td-th">เตรียมโครงการ</small></h2>
            <div class="td-sub">按顺序做。前 3 步必须完成，后 2 步可以边做边补。</div></div>
            <button class="sb-btn" data-refresh>🔄 刷新</button></div>
            ${banner}${cards}</div>`;

        box.querySelectorAll('[data-run]').forEach(b => b.onclick = () => this.STEPS[b.dataset.run].run(this.projectId));
        box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => ProjectDetail.showSubView(b.dataset.go));
        const rf = box.querySelector('[data-refresh]'); if (rf) rf.onclick = () => this.load();
    },

    // 弹窗关闭后自动刷新完成度
    watch() {
        if (this._observer) return;
        const refresh = () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => { if (ProjectDetail.currentView === 'prepare') this.load(); }, 400);
        };
        this._observer = new MutationObserver(muts => {
            for (const m of muts) {
                m.removedNodes.forEach(n => { if (n.nodeType === 1 && n.classList && n.classList.contains('sb-overlay')) refresh(); });
                if (m.target && m.target.id === 'modal-container') refresh();
            }
        });
        this._observer.observe(document.body, { childList: true, subtree: true });
    }
};

window.ProjectPrepare = ProjectPrepare;
