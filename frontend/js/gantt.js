// 甘特图：按9大阶段显示项目进度时间线
// 老板视角：一眼看懂整体，点行展开细节
const GanttChart = {
    projectId: null,
    data: null,
    expanded: new Set(),

    async init(projectId) {
        this.projectId = projectId;
        this.expanded.clear();
        await this.load();
    },

    async load() {
        const c = document.getElementById('gantt-container');
        if (!c) return;
        c.innerHTML = '<div class="td-empty" style="padding:40px;text-align:center">加载中… กำลังโหลด</div>';
        try {
            const r = await apiRequest(`/api/projects/${this.projectId}/gantt`);
            this.data = r.data;
            this.render();
            // 若 render 产生了空 DOM 则显示备用表格
            if (!c.querySelector(".gc-wrap")) this.renderFallback(c);
        } catch (e) {
            c.innerHTML = `<div class="td-empty">加载失败: ${e.message}</div>`;
        }
    },

    render() {
        const c = document.getElementById('gantt-container');
        if (!c || !this.data) return;
        const d = this.data;

        // 时间轴范围
        const start = new Date(d.projectStart || '2026-01-01');
        const endEst = new Date(d.estimatedEnd || d.plannedEnd || '2027-12-31');
        const endPlan = new Date(d.plannedEnd || endEst);
        const totalMs = endEst - start;
        const today = new Date();
        const todayPct = Math.min(100, Math.max(0, ((today - start) / totalMs) * 100));

        const pctOf = (dateStr) => {
            if (!dateStr) return null;
            const p = Math.min(100, Math.max(0, ((new Date(dateStr) - start) / totalMs) * 100));
            return Math.round(p * 10) / 10;
        };

        // 月份标签
        const months = [];
        let cur = new Date(start); cur.setDate(1);
        while (cur <= endEst) {
            months.push({ label: `${cur.getMonth() + 1}月`, pct: pctOf(cur.toISOString().slice(0, 10)) });
            cur.setMonth(cur.getMonth() + 1);
        }
        const monthsHtml = months.map(m => `<div class="gc-month" style="left:${m.pct}%">${m.label}</div>`).join('');

        // 截止线
        const planPct = pctOf(d.plannedEnd);
        const planLine = planPct != null ? `<div class="gc-deadline" style="left:${planPct}%" title="计划完工 ${d.plannedEnd}"></div>` : '';
        // 今日线
        const todayLine = `<div class="gc-today" style="left:${todayPct.toFixed(1)}%" title="今天 ${today.toISOString().slice(0,10)}"><span>今天</span></div>`;

        // 每个阶段的行
        const rows = d.sections.map(s => {
            const sp = pctOf(s.startDate);
            const ep = pctOf(s.endDate);
            let bar = '';
            if (sp != null && ep != null) {
                const w = Math.max(1, ep - sp);
                const fillColor = s.status === 'all_done' ? '#16a34a' : s.color;
                bar = `<div class="gc-bar" style="left:${sp}%;width:${w}%;background:${s.light||fillColor+'22'};border:1.5px solid ${fillColor}60"><div class="gc-bar-fill" style="width:${s.pct}%;background:linear-gradient(90deg,${fillColor}cc,${fillColor}ee);"></div><span class="gc-bar-label" style="color:${fillColor};font-weight:800">${s.pct}%</span></div>`;



            }
            const statusDot = s.inProgressCount > 0 ? '🔵' : (s.doneCount === s.totalCount ? '✅' : '⬜');
            const isExpanded = this.expanded.has(s.sec);
            const taskRows = isExpanded ? this.renderTasks(s) : '';
            return `
                <div class="gc-row-wrap" data-sec="${s.sec}">
                    <div class="gc-row" onclick="GanttChart.toggle('${s.sec}')">
                        <div class="gc-label">
                            <span class="gc-dot">${statusDot}</span>
                            <span class="gc-name"><b>${s.zh}</b></span>
                            <span class="gc-cnt">${s.doneCount}/${s.totalCount}</span><span class="gc-weight">${s.weight}%</span>
                            <span class="gc-arrow">${isExpanded ? '▲' : '▼'}</span>
                        </div>
                        <div class="gc-track">${bar}</div>
                    </div>
                    ${taskRows}
                </div>`;
        }).join('');

        c.innerHTML = `
            <div class="gc-wrap">
                <div class="gc-legend">
                    <span>📅 开工 ${d.projectStart}</span>${d.overallPct != null ? ` <span class="gc-overall">${d.overallPct}% 实际完工(按造价)</span>` : ""}
                    <span class="gc-plan-tag">计划完工 ${d.plannedEnd}</span>
                    <span class="gc-est-tag ${d.estimatedEnd > d.plannedEnd ? 'late' : 'ok'}">预计完工 ${d.estimatedEnd}</span>
                    <button class="sb-btn small" onclick="GanttChart.load()">🔄 刷新</button>
                </div>
                <div class="gc-chart">
                    <div class="gc-header">
                        <div class="gc-label-head">阶段</div>
                        <div class="gc-track-head">${monthsHtml}${planLine}${todayLine}</div>
                    </div>
                    <div class="gc-body">${rows}</div>
                </div>
            </div>`;
    },

    toggle(sec) {
        if (this.expanded.has(sec)) this.expanded.delete(sec);
        else this.expanded.add(sec);
        this.render();
    },

    renderTasks(s) {
        const d = this.data;
        const start = new Date(d.projectStart || '2026-01-01');
        const endEst = new Date(d.estimatedEnd || '2027-12-31');
        const totalMs = endEst - start;
        const pctOf = ds => ds ? Math.min(100, Math.max(0, ((new Date(ds) - start) / totalMs) * 100)) : null;
        return s.tasks.map(t => {
            const sp = pctOf(t.startDate), ep = pctOf(t.endDate);
            let bar = '';
            if (sp != null && ep != null) {
                const w = Math.max(0.5, ep - sp);
                const col = t.status === 'completed' ? '#16a34a' : t.status === 'in_progress' ? '#3b82f6' : '#cbd5e1';
                bar = '<div class="gc-bar task" style="left:'+sp+'%;width:'+w+'%;background:'+(t.status==='not_started'?'#f8fafc':col+'18')+';border:1.5px solid '+(t.status==='not_started'?'#e2e8f0':col+'80')+'"><div class="gc-bar-fill" style="width:'+t.pct+'%;background:linear-gradient(90deg,'+col+'99,'+col+'cc);border-radius:4px;"></div></div>';
            }
            const icon = t.status === 'completed' ? '&#x2705;' : t.status === 'in_progress' ? '&#x1F535;' : '&#x2B1C;';
            const floorTag = t.floor != null ? ' &middot; ' + t.floor + '&#23618;' : '';
            const eid = t.execId;
            const acts = eid ? '<div class="gc-task-acts">' +
                '<button class="gc-act-btn prog" onclick="GanttChart.updateProgress(' + eid + ')">&#128221; &#25913;&#36827;&#24230;</button>' +
                '<button class="gc-act-btn ' + (t.status === 'completed' ? 'done-done' : 'done') + '" onclick="GanttChart.markDone(' + eid + ')">' + (t.status === 'completed' ? '&#10003; &#24050;&#23436;&#25104;' : '&#9989; &#23436;&#25104;') + '</button>' +
                '</div>' : '';
            return '<div class="gc-row task-row"><div class="gc-label sub"><span>' + icon + '</span><span class="gc-name">' + t.name + floorTag + '</span></div><div class="gc-track">' + bar + acts + '</div></div>';
        }).join('');
    },

    async updateProgress(execId) {
        if (typeof app !== 'undefined' && app.showUpdateProgress) {
            const procs = this.data && this.data.sections ? this.data.sections.flatMap(s => s.tasks) : [];
            const task = procs.find(t => t.execId === execId);
            const cur = task ? task.pct : 0;
            app.showUpdateProgress(execId, cur);
            // After modal closes, reload
            const observer = new MutationObserver(() => {
                if (!document.getElementById('modal-container').innerHTML.trim()) {
                    observer.disconnect();
                    setTimeout(() => { SiteEstimate && (SiteEstimate.cache = {}); this.load(); }, 500);
                }
            });
            observer.observe(document.getElementById('modal-container'), { childList: true });
        }
    },

    async markDone(execId) {
        if (typeof app !== 'undefined' && app.completeProcess) {
            await app.completeProcess(execId);
            SiteEstimate && (SiteEstimate.cache = {});
            setTimeout(() => this.load(), 800);
        }
    }

};
window.GanttChart = GanttChart;
