// 现场安排：项目申请表、团队名册、现场看板、提前开始确认、通知
// 对应后端接口见 backend/src/site-routes.js。泰文请当地同事核对。
(function () {
    'use strict';

    // ---------- 基础工具 ----------
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const call = (method, path, body) => apiRequest('/api' + path, { method, body: body ? JSON.stringify(body) : undefined });
    const hasApp = () => typeof app !== 'undefined' && app;
    const toast = (m, type) => (hasApp() && app.showToast ? app.showToast(m, type || 'success') : alert(m));
    const busy = on => { if (hasApp()) { on ? app.showLoading() : app.hideLoading(); } };
    const isManager = () => window.PermissionManager && PermissionManager.canManageProjects();
    const pctOf = x => Math.round((x.progress || 0) * 100);
    const nm = x => esc(x.name ? getI18nField({ process_name: x.name }, 'process_name') : x.label);

    let TRADES = {
        mach: { zh: '机械', th: 'Machinery' }, scaffold: { zh: '架子工', th: 'Scaffolding' }, rebar: { zh: '钢筋工', th: 'Rebar Work' },
        carpenter: { zh: '木工', th: 'Carpentry' }, concrete: { zh: '混凝土工', th: 'Concrete Work' }, mason: { zh: '瓦工/抹灰', th: 'Masonry/Plastering' },
        tiler: { zh: '贴砖工', th: 'Tiling' }, waterproof: { zh: '防水工', th: 'Waterproofing' }, plumber: { zh: '水工', th: 'Plumbing' },
        electrician: { zh: '电工', th: 'Electrical' }, painter: { zh: '油漆工', th: 'Painting' }, installer: { zh: '安装工', th: 'Installation' },
        general: { zh: '普工/杂工', th: 'General Labor' }, roof: { zh: '屋面工', th: 'Roofing' },
        ceiling: { zh: '吊顶工', th: 'Ceiling Work' }, aluminum: { zh: '铝门窗/玻璃工', th: 'Aluminum & Glass' }, aircon: { zh: '空调工', th: 'Air Conditioning' },
        welder: { zh: '焊工/铁工', th: 'Welding/Steel' }, pool: { zh: '泳池工', th: 'Pool Work' }, landscape: { zh: '园林工', th: 'Landscaping' }
    };
    const tradeName = k => (k === '*' ? '什么都能帮 Can help with anything' : TRADES[k] ? `${TRADES[k].zh} ${TRADES[k].th}` : k);

    function overlay(title, body, footer, narrow) {
        const el = document.createElement('div');
        el.className = 'sb-overlay';
        el.innerHTML = `<div class="sb-dialog ${narrow ? 'narrow' : ''}"><header><h3>${title}</h3><button type="button" data-x aria-label="关闭">&times;</button></header>` +
            `<div class="sb-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
        document.body.appendChild(el);
        const close = () => el.remove();
        el.querySelector('[data-x]').onclick = close;
        el.addEventListener('mousedown', e => { if (e.target === el) close(); });
        return { el, close, q: s => el.querySelector(s), qa: s => Array.from(el.querySelectorAll(s)) };
    }

    // ================= 提前开始确认（所有「开始工序」入口共用） =================
    const SiteStart = {
        // 返回填写的原因；取消返回 null
        askReason(info) {
            busy(false);
            return new Promise(resolve => {
                const reasons = (info.reasons || []).map(r => `<li>${esc(r.zh)}</li>`).join('');
                const d = overlay('现在还不能开始 Cannot Start Yet',
                    `<div class="sb-note">${esc(info.task || '')}<br>还有这些条件没满足 Unmet conditions：<ul class="sb-list">${reasons}</ul></div>` +
                    `<div class="sb-field"><label>如果现场确实要提前开始，请写明原因 If you must start early, please state the reason *</label>` +
                    `<textarea id="sb-force-reason" rows="3" placeholder="例如：业主要求提前交付，已和监理确认"></textarea>` +
                    `<div class="hint">提前开始会记录你的名字和原因，并通知你的上级和老板 System will record your name and reason, and notify supervisor and owner</div></div>`,
                    `<button class="sb-btn" data-cancel>先不开始 Cancel</button><button class="sb-btn warn" data-ok>仍要提前开始 Start Early</button>`, true);
                d.q('[data-cancel]').onclick = () => { d.close(); resolve(null); };
                d.q('[data-x]').onclick = () => { d.close(); resolve(null); };
                d.q('[data-ok]').onclick = () => {
                    const v = d.q('#sb-force-reason').value.trim();
                    if (!v) { toast('请先写明原因 Please state the reason', 'error'); return; }
                    d.close(); resolve(v);
                };
            });
        },
        async start(execId, force) {
            return call('POST', `/processes/${execId}/start`, Object.assign({}, force ? { force_reason: force } : {}, (window.SiteBoard && SiteBoard.date) ? { date: SiteBoard.date } : {}));
        }
    };

    // 旧页面里所有「把状态改成进行中」的请求：被拦住时弹出确认框，写了原因再重发
    function patchUpdate(holder, name) {
        const orig = holder[name];
        if (typeof orig !== 'function') return;
        holder[name] = async function (id, data) {
            try { return await orig.call(holder, id, data); }
            catch (e) {
                if (e.status === 409 && e.data && e.data.code === 'BLOCKED' && data && data.status === 'in_progress') {
                    const reason = await SiteStart.askReason(e.data);
                    if (!reason) { const c = new Error('已取消 Cancel'); c.cancelled = true; throw c; }
                    const r = await orig.call(holder, id, Object.assign({}, data, { force_reason: reason }));
                    toast('已提前开始，并通知了上级和老板 Started early, notified supervisor and owner', 'warning');
                    return r;
                }
                throw e;
            }
        };
    }
    if (typeof api !== 'undefined') { if (api.processes) patchUpdate(api.processes, 'update'); patchUpdate(api, 'updateProcess'); }

    // ================= 通知 =================
    const SiteNotify = {
        async refreshCount() {
            try {
                const r = await call('GET', '/notifications?unread=1');
                const n = r.data.unread;
                const el = document.getElementById('sb-bell-count');
                if (el) { el.textContent = n > 0 ? n : ''; el.style.display = n > 0 ? 'inline-block' : 'none'; }
            } catch (_) { /* 通知失败不影响主流程 */ }
        },
        async open(projectId) {
            const pid = projectId || (window.ProjectDetail && ProjectDetail.projectId);
            const r = await call('GET', '/notifications' + (pid ? `?project_id=${pid}` : ''));
            const items = r.data.items;
            const body = items.length
                ? items.map(n => `<div class="sb-noti ${n.is_read ? '' : 'unread'}"><div class="sb-title">${esc(n.title)}</div><div class="sb-sub">${esc(n.created_at)}</div><pre>${esc(n.body)}</pre></div>`).join('')
                : '<div class="sb-empty">暂无通知 No Notifications</div>';
            const d = overlay('通知 Notifications', body, items.length ? '<button class="sb-btn" data-all>全部标为已读 Mark all as read</button>' : '');
            const b = d.q('[data-all]');
            if (b) b.onclick = async () => { await call('POST', '/notifications/read-all'); d.close(); SiteNotify.refreshCount(); };
        }
    };

    // ================= 团队名册 =================
    // 泰国现场不分细工种，只分这 7 大类（对应后端 COARSE）
    const COARSE = [
        { k: 'rebar', d: '钢筋绑扎 Rebar' },
        { k: 'carpenter', d: '模板/木工 Carpenter' },
        { k: 'scaffold', d: '脚手架 Scaffold' },
        { k: 'concrete', d: '混凝土浇筑 Concrete' },
        { k: 'mason', d: '砌墙/抹灰 Mason' },
        { k: 'tiler', d: '贴砖 Tiler' },
        { k: 'waterproof', d: '防水 Waterproof' },
        { k: 'plumber', d: '水管/洁具 Plumber' },
        { k: 'electrician', d: '强弱电 Electrician' },
        { k: 'painter', d: '腻子/刷漆 Painter' },
        { k: 'ceiling', d: '吊顶 Ceiling' },
        { k: 'installer', d: '室内安装 Installer' },
        { k: 'aluminum', d: '铝合金/玻璃 Aluminum' },
        { k: 'aircon', d: '空调安装 Aircon' },
        { k: 'welder', d: '钢结构/焊接 Welder' },
        { k: 'roof', d: '屋面 Roofing' },
        { k: 'mach', d: '挖机/吊车 Machinery' },
        { k: 'pool', d: '泳池 Pool' },
        { k: 'landscape', d: '园林景观 Landscape' }
    ].map(x => Object.assign({ zh: TRADES[x.k].zh, th: TRADES[x.k].th }, x));
    const coarseName = k => (TRADES[k] ? `${TRADES[k].zh} ${TRADES[k].th}` : k);

    const SiteTeam = {
        async open(projectId) {
            const r = await call('GET', `/projects/${projectId}/crews`);
            const crews = r.data.crews, tot = r.data.total;
            const rows = crews.length ? crews.map(c => {
                const sk = Object.keys(c.skill_counts || {}).map(k => `${esc(coarseName(k))} ${c.skill_counts[k]} 人会`).join('、');
                return `<div class="sb-member-row"><div class="sb-grow"><b>${esc(c.name)}</b>` +
                    `<div class="sb-sub" style="margin-top:4px">大工 ${c.skilled_count} 人${sk ? '：' + sk : ''}</div>` +
                    `<div class="sb-sub">普工 ${c.helper_count} 人（打下手，什么都能帮）</div></div>` +
                    (isManager() ? `<button class="sb-btn small" data-edit="${c.id}">编辑</button><button class="sb-btn small" data-del="${c.id}">删除</button>` : '') + `</div>`;
            }).join('')
                : '<div class="sb-empty">还没有班组。点下面的「添加班组」开始。<br>No teams yet. Click Add Team below.</div>';
            const d = overlay('施工团队 Construction Teams',
                `<div class="sb-note">只需要填：班组名称、大工和普工各几个人、<b>几个大工会干什么</b>。系统会按这个自动分小组。<br>Skilled Workers are team leads, helpers are general labor</div>` +
                `<div class="sb-sub" style="margin-bottom:10px"><b>共 ${crews.length} 个班组 · 大工 ${tot.skilled} 人 · 普工 ${tot.helper} 人</b></div>${rows}`,
                isManager() ? '<button class="sb-btn primary" data-add>+ 添加班组 Add Team</button>' : '');
            const reload = () => { d.close(); SiteTeam.open(projectId); if (window.SiteBoard && ProjectDetail.currentView === 'site') SiteBoard.refresh(); };
            const add = d.q('[data-add]'); if (add) add.onclick = () => SiteTeam.form(projectId, null, reload);
            d.qa('[data-edit]').forEach(b => b.onclick = () => SiteTeam.form(projectId, crews.find(c => String(c.id) === b.dataset.edit), reload));
            d.qa('[data-del]').forEach(b => b.onclick = async () => {
                if (!confirm('确认删除这个班组？ Confirm delete this team')) return;
                try { await call('DELETE', `/crews/${b.dataset.del}`); reload(); } catch (e) { toast(e.message, 'error'); }
            });
        },
        form(projectId, c, done) {
            const sc = (c && c.skill_counts) || {};
            const rows = COARSE.map(x =>
                `<div class="sb-skill-row"><div class="sb-skill-name"><b>${esc(x.zh)}</b> <span class="sb-sub">${esc(x.th)}</span><div class="sb-sub">${esc(x.d)}</div></div>` +
                `<div class="sb-skill-num"><input type="number" min="0" max="100" data-skill="${x.k}" value="${sc[x.k] || 0}"> 人</div></div>`).join('');
            const d = overlay(c ? '编辑班组 Edit Team' : '添加班组 Add Team',
                `<div class="sb-field" style="margin-bottom:12px"><label>班组名称 Team Name *</label><input type="text" id="cr-name" placeholder="例如：A 班组、泥水班" value="${esc(c ? c.name : '')}"></div>` +
                `<div class="sb-grid" style="margin-bottom:12px">` +
                `<div class="sb-field"><label>大工共几个人 Skilled Worker (people)</label><input type="number" id="cr-skilled" min="0" max="100" value="${c ? c.skilled_count : 1}"></div>` +
                `<div class="sb-field"><label>普工共几个人 helpers (people)</label><input type="number" id="cr-helper" min="0" max="300" value="${c ? c.helper_count : 2}"></div></div>` +
                `<div class="sb-field"><label>这些大工里，几个人会干什么？ Skilled WorkerHow many can do each trade?</label>` +
                `<div class="sb-sub" style="margin:2px 0 8px">不会的填 0。一个人可以会好几样，所以各项加起来可以比大工总数多。</div><div class="sb-skill-grid">${rows}</div></div>`,
                '<button class="sb-btn" data-cancel>取消 Cancel</button><button class="sb-btn primary" data-ok>保存 Save</button>');
            d.q('[data-cancel]').onclick = d.close;
            d.q('[data-ok]').onclick = async () => {
                const skill_counts = {};
                d.qa('[data-skill]').forEach(i => { const n = Number(i.value) || 0; if (n > 0) skill_counts[i.dataset.skill] = n; });
                const body = {
                    name: d.q('#cr-name').value.trim(),
                    skilled_count: Number(d.q('#cr-skilled').value) || 0,
                    helper_count: Number(d.q('#cr-helper').value) || 0,
                    skill_counts
                };
                if (!body.name) { toast('请填写班组名称 Please enter team name', 'error'); return; }
                if (body.skilled_count + body.helper_count < 1) { toast('班组至少要有 1 个人', 'error'); return; }
                if (body.skilled_count > 0 && !Object.keys(skill_counts).length) { toast('请填写有几个大工会干什么 Please specify work types', 'error'); return; }
                if (Object.values(skill_counts).some(n => n > body.skilled_count)) { toast('某项的人数不能比大工总数多 Count exceeds total skilled workers', 'error'); return; }
                try {
                    busy(true);
                    if (c) await call('PUT', `/crews/${c.id}`, body); else await call('POST', `/projects/${projectId}/crews`, body);
                    d.close(); done();
                } catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            };
        }
    };

    // ================= 项目申请表 =================
    const OPT = (list) => list.map(([v, l]) => ({ v, l }));
    const FORM = [
        { t: '建筑概况 Building Info', f: [
            { k: 'floors', type: 'num', l: '地上几层 How many floors (excl. basement)', min: 1, max: 10 },
            { k: 'units', type: 'num', l: '一共几套（联排/多户整排一起盖时填，单栋填 1）Number of units', min: 1, max: 100 },
            { k: 'total_area', type: 'num', l: '总建筑面积 Total area (sqm) — total for all units', min: 0 },
            { k: 'attic', type: 'chk', l: '有阁楼或夹层 Has attic/mezzanine' },
            { k: 'basement', type: 'chk', l: '有地下室 Has basement' },
            { k: 'roof', type: 'sel', l: '屋面形式 Roof type', o: OPT([['flat', '平屋面 Flat Roof'], ['pitched', '坡屋面 Pitched Roof'], ['both', '两种都有 Both types']]) },
            { k: 'roof_insulation', type: 'chk', l: '屋面做保温隔热 Has thermal insulation' },
            { k: 'stairs', type: 'num', l: '室内楼梯几部 How many indoor staircases', min: 0 },
            { k: 'balconies', type: 'num', l: '阳台/露台共几个 Balcony/Terrace', min: 0 }
        ] },
        { t: '房间 Rooms', f: [
            { k: 'bathrooms', type: 'num', l: '每层卫生间数（各层相同时）Bathrooms per floor', min: 0 },
            { k: 'bathrooms_by_floor', type: 'list', l: '各层卫生间数（各层不同时填，逗号分隔，如 0,2,2）', hint: '填了这一项，上面的“每层卫生间数”就不起作用 · Must match number of floors' },
            { k: 'kitchens', type: 'num', l: '厨房个数 Number of kitchens', min: 0 },
            { k: 'kitchen_floors', type: 'list', l: '厨房在哪几层（逗号分隔，默认 1 层）Which floors have kitchen' }
        ] },
        { t: '装修标准 Interior Finishing', f: [
            { k: 'floor_finish', type: 'sel', l: '客厅/卧室地面 Living/Bedroom floor', o: OPT([['tile', '地砖 Tile'], ['wood', '木地板 Wood'], ['stone', '石材 Stone']]) },
            { k: 'wall_finish', type: 'sel', l: '墙面 Wall', o: OPT([['paint', '乳胶漆 Paint'], ['wallpaper', '墙纸 Wallpaper'], ['mixed', '漆+局部墙纸 Paint + Wallpaper']]) },
            { k: 'ceiling', type: 'sel', l: '吊顶 Ceiling', o: OPT([['none', '无 None'], ['gypsum', '石膏板 Gypsum Board'], ['aluminum_wet', '厨卫铝扣板+其他石膏板 Aluminum in Bath/Kitchen']]) },
            { k: 'cabinet', type: 'chk', l: '厨房橱柜和台面 Kitchen cabinets and countertop' },
            { k: 'shower_room', type: 'chk', l: '淋浴房 Glass Shower Room' },
            { k: 'fixed_furniture', type: 'chk', l: '固定家具/衣柜 Built-in furniture/wardrobe' }
        ] },
        { t: '外立面 Exterior', f: [
            { k: 'exterior_finish', type: 'sel', l: '外墙做法 Exterior Wall', o: OPT([['paint', '涂料 Paint'], ['tile', '外墙砖 Tile'], ['stone', '石材 Stone'], ['mixed', '混合 Mixed']]) },
            { k: 'exterior_insulation', type: 'chk', l: '外墙保温 Exterior Wall Insulation' }
        ] },
        { t: '机电设备 Systems', f: [
            { k: 'aircon', type: 'sel', l: '空调 Air Con', o: OPT([['none', '无 None'], ['split', '分体 Split unit'], ['central', '中央 Central System']]) },
            { k: 'hot_water', type: 'sel', l: '热水 Hot water', o: OPT([['none', '无 None'], ['electric', '电热水器 Electric'], ['solar', '太阳能 Solar'], ['heatpump', '热泵 Heat pump']]) },
            { k: 'water_supply', type: 'sel', l: '供水 Water supply', o: OPT([['direct', '市政直供 Direct mains'], ['tank', '需水箱水泵 Tank + pump']]) },
            { k: 'elevator', type: 'chk', l: '电梯 Elevator' },
            { k: 'pool', type: 'chk', l: '泳池 Pool' }
        ] },
        { t: '室外 Exterior Work', f: [
            { k: 'fence', type: 'chk', l: '围墙与大门 Fence and gate' },
            { k: 'road', type: 'chk', l: '道路与铺装 Roads and paving' },
            { k: 'landscape', type: 'chk', l: '庭院景观绿化 Landscaping' },
            { k: 'sewage', type: 'sel', l: '污水处理 Wastewater Treatment', o: OPT([['septic', '化粪池 Septic tank'], ['municipal', '接市政 Connect to public sewer']]) }
        ] },
        { t: '技术项（工程师填，不确定就用默认）Technical Data', f: [
            { k: 'foundation', type: 'sel', l: '基础类型 Foundation type', o: OPT([['isolated', '独立基础 Isolated footing'], ['strip', '条形基础 Strip footing'], ['raft', '筏板基础 Raft footing'], ['pile', '桩基 Pile foundation']]) },
            { k: 'soft_soil', type: 'chk', l: '软弱地基需处理 Soft soil needs treatment' },
            { k: 'high_water', type: 'chk', l: '地下水位高 High groundwater level' },
            { k: 'masonry', type: 'sel', l: '砌体材料 Masonry material', o: OPT([['brick', '红砖 Red brick'], ['aac', '加气块 AAC block']]) },
            { k: 'concrete_supply', type: 'sel', l: '混凝土供应 Concrete supply', o: OPT([['ready', '预拌 Ready-mix'], ['site', '现场搅拌 Site-mixed']]) }
        ] }
    ];

    function fieldHtml(f, v) {
        if (f.type === 'chk') return `<div class="sb-field check"><label><input type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''}> ${f.l}</label></div>`;
        if (f.type === 'sel') return `<div class="sb-field"><label>${f.l}</label><select data-k="${f.k}">${f.o.map(o => `<option value="${o.v}" ${o.v === v ? 'selected' : ''}>${o.l}</option>`).join('')}</select></div>`;
        if (f.type === 'list') return `<div class="sb-field"><label>${f.l}</label><input type="text" data-k="${f.k}" value="${esc(Array.isArray(v) ? v.join(',') : '')}">${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
        return `<div class="sb-field"><label>${f.l}</label><input type="number" data-k="${f.k}" value="${v == null ? '' : esc(v)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}></div>`;
    }

    const SiteProfile = {
        async open(projectId) {
            const r = await call('GET', `/projects/${projectId}/profile`);
            const data = Object.assign({}, r.data.defaults, r.data.answers);
            const body = `<div class="sb-note">客户回答这些问题，系统就会自动选出需要的工序、按楼层展开，并排好先后顺序。不需要手动选工序。<br>Fill in this data and the system will select tasks, split by floor, and order them automatically</div>` +
                (r.data.planGeneratedAt ? `<div class="sb-sub" style="margin-bottom:8px">上次生成工序：${esc(r.data.planGeneratedAt)}</div>` : '') +
                FORM.map(s => `<div class="sb-form-sec"><h4>${s.t}</h4><div class="sb-grid">${s.f.map(f => fieldHtml(f, data[f.k])).join('')}</div></div>`).join('');
            const d = overlay('项目申请表 Project Form', body,
                '<button class="sb-btn" data-save>只保存 Save</button><button class="sb-btn primary" data-preview>预览并生成工序 Preview and Generate Tasks</button>');
            const read = () => {
                const a = Object.assign({}, r.data.answers);
                for (const s of FORM) for (const f of s.f) {
                    const el = d.q(`[data-k="${f.k}"]`);
                    if (f.type === 'chk') a[f.k] = el.checked;
                    else if (f.type === 'sel') a[f.k] = el.value;
                    else if (f.type === 'list') {
                        const t = el.value.trim();
                        if (!t) delete a[f.k];
                        else a[f.k] = t.split(/[,，\s]+/).filter(Boolean).map(Number);
                    } else a[f.k] = el.value === '' ? (f.k === 'total_area' ? null : 0) : Number(el.value);
                }
                const n = a.floors + (a.attic ? 1 : 0);
                if (Array.isArray(a.bathrooms_by_floor) && a.bathrooms_by_floor.length !== n) throw new Error(`各层卫生间数要填 ${n} 个数字（共 ${n} 层）`);
                if (Array.isArray(a.kitchen_floors) && a.kitchen_floors.some(x => !(x >= 1 && x <= n))) throw new Error(`厨房所在层必须在 1 到 ${n} 之间`);
                return a;
            };
            d.q('[data-save]').onclick = async () => {
                try { busy(true); await call('PUT', `/projects/${projectId}/profile`, { answers: read() }); toast('申请表已保存 Saved'); }
                catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            };
            d.q('[data-preview]').onclick = async () => {
                try {
                    busy(true);
                    const answers = read();
                    await call('PUT', `/projects/${projectId}/profile`, { answers });
                    const p = await call('POST', `/projects/${projectId}/plan/preview`, { answers });
                    busy(false);
                    SiteProfile.preview(projectId, answers, p.data, d);
                } catch (e) { busy(false); toast(e.message, 'error'); }
            };
        },
        preview(projectId, answers, p, parent) {
            const s = p.summary, ex = p.existing;
            let legacy = '';
            if (ex.legacy > 0) {
                legacy = `<div class="sb-warning">这个项目里已有 ${ex.legacy} 个旧的固定模板工序（其中 ${ex.legacyTouched} 个已开始或有进度）。请选择怎么处理：` +
                    `<div class="sb-field check"><label><input type="radio" name="sb-legacy" value="replace" ${ex.legacyTouched ? 'disabled' : 'checked'}> 替换：删除这些旧工序，只用新生成的（只有全部未开始时才能选）</label></div>` +
                    `<div class="sb-field check"><label><input type="radio" name="sb-legacy" value="keep" ${ex.legacyTouched ? 'checked' : ''}> 保留：旧工序留着，新工序另外加（会有重复，不建议）</label></div></div>`;
            }
            const body = `<div class="sb-summary">` +
                `<div class="sb-stat"><b>${s.processes}</b><span>需要的工序</span></div>` +
                `<div class="sb-stat"><b>${s.tasks}</b><span>任务（按楼层展开）</span></div>` +
                `<div class="sb-stat"><b>${s.deps}</b><span>先后关系</span></div>` +
                `<div class="sb-stat"><b>${s.floors}</b><span>楼层</span></div></div>` +
                `<div style="margin-bottom:8px">${p.bySection.map(x => `<span class="sb-chip">${esc(x.zh)} ${x.tasks}</span>`).join('')}</div>` +
                `<div class="sb-sub">本次将新增 ${p.willAdd} 个，移除 ${p.willRemove} 个没动过的` +
                (p.willKeepStarted.length ? `，保留 ${p.willKeepStarted.length} 个已开始但不在新计划里的（${esc(p.willKeepStarted.join('、'))}）` : '') + `。已有的进度不会丢。</div>` +
                legacy +
                `<details style="margin-top:10px"><summary class="sb-sub">不需要的工序（按你的答案没生成）共 ${p.excluded.length} 个</summary><div style="margin-top:6px">${p.excluded.map(x => `<span class="sb-chip">${esc(x.zh)}</span>`).join('')}</div></details>`;
            const d = overlay('确认生成工序 Confirm Task Generation', body,
                '<button class="sb-btn" data-back>返回修改 Back to Edit</button><button class="sb-btn primary" data-go>确认生成 Generate Tasks</button>', true);
            d.q('[data-back]').onclick = d.close;
            d.q('[data-go]').onclick = async () => {
                const choice = d.q('input[name=sb-legacy]:checked');
                const body = { answers };
                if (ex.legacy > 0) body.legacy = choice ? choice.value : 'keep';
                try {
                    busy(true);
                    const r = await call('POST', `/projects/${projectId}/plan/apply`, body);
                    busy(false);
                    d.close(); parent.close();
                    toast(`已生成：新增 ${r.data.added} 个，移除 ${r.data.removed} 个 Tasks generated successfully`);
                    if (window.ProjectDetail && ProjectDetail.currentView !== 'prepare') await ProjectDetail.showSubView('site');
                    if (window.ProjectDetail && ProjectDetail.currentView === 'prepare') return;
                    try {
                        const tr = await call('GET', `/projects/${projectId}/team`);
                        const n = (tr.data && (tr.data.members || tr.data)) || [];
                        if (!n.length) SiteTeam.open(projectId);
                    } catch (e) { /* ignore */ }
                } catch (e) { busy(false); toast(e.message, 'error'); }
            };
        }
    };

    // ================= 今日现场安排（合并了原来的「今日任务」和「现场安排」） =================
    const bi = (zh, th) => `${esc(zh)}<small class="td-th">${esc(th)}</small>`;
    const bi_th = (th, zh) => `<span class="td-th-main">${esc(th)}</span><small class="td-zh-sub"> ${esc(zh)}</small>`;
    const STATUS_TAG = {
        waiting_material: '<span class="td-tag warn">等材料 Waiting for Materials</span>',
        weather_stop: '<span class="td-tag gray">天气停工 Weather Stop</span>'
    };

    const SiteBoard = {
        projectId: null, date: null, data: null, assign: {}, externalTeams: {}, legacyRows: null,

        async init(projectId) {
            this.projectId = projectId;
            const c = document.getElementById('site-board-container');
            c.innerHTML = '<div class="td-empty">加载中… Loading...</div>';
            await this.refresh();
        },

        async refresh() {
            const c = document.getElementById('site-board-container');
            if (!c) return;
            try {
                const r = await call('GET', `/projects/${this.projectId}/site-board` + (this.date ? `?date=${this.date}` : ''));
                this.data = r.data;
                this.legacyRows = null;
                this.estMap = {};
                this._assignedTasks=[];
                this._yesterdayTasks=[];
                // Restore external teams from localStorage
                const extKey = `ext_teams_${this.projectId}_${this.data.date||this.date||new Date(Date.now()+7*3600000).toISOString().slice(0,10)}`;
                try { this.externalTeams = JSON.parse(localStorage.getItem(extKey)||'{}'); } catch(_) { this.externalTeams = {}; }
                try{
                    const todayBkk = new Date(Date.now()+7*3600000).toISOString().slice(0,10);
                    const yesterdayBkk = new Date(Date.now()+7*3600000-86400000).toISOString().slice(0,10);
                    const [ar,yr] = await Promise.all([
                        call('GET','/projects/'+this.projectId+'/daily-assignments?date='+todayBkk),
                        call('GET','/projects/'+this.projectId+'/daily-assignments?date='+yesterdayBkk)
                    ]);
                    this._assignedTasks=ar.data||[];
                    this._yesterdayTasks=yr.data||[];
                }catch(_){}
                if (r.data.planned) {
                    try { const e = await SiteEstimate.get(this.projectId, true); (e.tasks || []).forEach(x => { this.estMap[x.execId] = x; }); } catch (_) { /* 预计天数失败不影响看板 */ }
                    this.date = r.data.date;
                    this.assign = JSON.parse(JSON.stringify(r.data.assignments || {}));
                } else {
                    const p = await call('GET', `/projects/${this.projectId}/processes`);
                    this.legacyRows = p.data;
                }
                this.render();
            } catch (e) {
                c.innerHTML = `<div class="td-empty">加载失败：${esc(e.message)}<br><button class="sb-btn" id="td-retry" style="margin-top:10px">重试</button></div>`;
                const b = c.querySelector('#td-retry'); if (b) b.onclick = () => this.refresh();
            }
        },

        usedIds() { const s = new Set(); Object.values(this.assign).forEach(a => a.forEach(i => s.add(i))); return s; },
        member(id) { return (this.data.team || []).find(x => x.id === id); },
        peopleChips(execId, removable) {
            const ext = this.externalTeams && this.externalTeams[execId];
            const extChip = ext ? `<span class="fc-chip ext" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d">🏗️ ${esc(ext.name||'外派团队')} ${ext.skilled?ext.skilled+'技工 Skilled':''}${ext.helper?' '+ext.helper+'普工 Helper':''}</span>` : '';
            return (this.assign[execId] || []).map(i => {
                const m = this.member(i);
                return `<span class="td-chip ${m && m.level === 'skilled' ? 'skilled' : ''}">${esc(m ? m.name : '#' + i)}${removable ? ` <a href="#" data-rm="${execId}:${i}" title="移除">✕</a>` : ''}</span>`;
            }).join('') + extChip;
        },
        floorTag(x) { return x.floor != null ? `<span class="td-tag">${x.floor}层</span>` : ''; },

        // ---------- 页面 ----------
        head() {
            const d = this.data;
            const menu = `<details class="td-menu"><summary class="sb-btn">更多 ⋯</summary><div class="td-pop">` +
                (isManager() ? `<a href="#" data-menu="prepare">📝 项目准备 Project Prep</a>` : '') +
                (isManager() ? `<a href="#" data-menu="quota">⚖️ 工序定额设置 Standard Settings</a>` : '') + `<a href="#" data-menu="notify">🔔 通知 Notifications</a>` +
                `<a href="#" data-menu="refresh">🔄 刷新 Refresh</a></div></details>`;
            return `<div class="td-head"><div><h2 class="td-title">今日现场 <small class="td-th">Today's Site</small></h2>` +
                `<div class="td-date"><input type="date" id="td-date" value="${esc(this.date || '')}">` +
                (d && d.planned ? `<span class="td-sub">第 ${d.workingDay} 个工作日 / Working Day ${d.workingDay} (Sun closed)</span>` : '') + `</div></div>${menu}</div>`;
        },

        render() {
            const c = document.getElementById('site-board-container');
            const d = this.data;
            let html = `<div class="td-wrap">${this.head()}`;
            if (!d.planned) html += this.renderLegacy();
            else html += this.renderPlanned();
            html += '</div>';
            c.innerHTML = html;
            this.bind();
        },

        renderLegacy() {
            const rows = this.legacyRows || [];
            const item = r => ({ execId: r.id, name: r.process_name, label: r.process_code, progress: (Number(r.completion_percentage) || 0) / 100, workStatus: r.status || 'not_started', unit: r.quantity_unit, plannedQuantity: Number(r.planned_quantity) > 0 ? Number(r.planned_quantity) : null, floor: null });
            const doing = rows.filter(r => ['in_progress', 'waiting_material', 'weather_stop'].includes(r.status)).map(item);
            const todo = rows.filter(r => !r.status || r.status === 'not_started').map(item);
            let html = `<div class="td-banner">这个项目还没有按申请表生成工序，下面是原来的工序。` +
                (isManager() ? ` <button class="sb-btn primary small" data-menu="prepare">去「项目准备」填写申请表并生成 Generate from project form</button>` : '') + `</div>`;
            html += `<section class="td-sec"><h3>${bi('正在做', 'In Progress')} <span class="td-count">${doing.length}</span></h3>` +
                (doing.length ? doing.map(x => this.cardDoing(x, false)).join('') : '<div class="td-empty">暂无</div>') + `</section>`;
            html += `<section class="td-sec"><h3>${bi('还没开始', 'Not Started')} <span class="td-count">${todo.length}</span></h3>` +
                (todo.length ? todo.slice(0, 30).map(x => this.cardReady(x, null, false)).join('') : '<div class="td-empty">暂无</div>') + `</section>`;
            return html;
        },


        renderWorkBanner() {
            const today = this._assignedTasks || [];
            const yest  = this._yesterdayTasks || [];
            const pid   = this.projectId;
            const yDone = yest.filter(t => t.status === 'completed').length;
            const isExec = PermissionManager.isExecutor();

            if (isExec) {
                // 执行者：直接显示今天的任务大卡片
                if (!today.length) return `<div class="wb-banner wb-exec">
                    <div class="wb-exec-title">👷 <b>Your Tasks Today</b> <small>今天你的工作</small></div>
                    <div class="wb-exec-empty">Supervisor has not assigned tasks yet<br><small>主管还没有安排今天的工作</small></div>
                </div>`;
                return `<div class="wb-banner wb-exec">
                    <div class="wb-exec-title">👷 <b>Your Tasks Today</b> <small>今天你的工作 (${today.length})</small></div>
                    ${today.map(t => {
                        const nm = t.custom_title || t.process_name || '工作';
                        const floor = t.floor_no != null ? `·${t.floor_no}层` : '';
                        const isDone = t.status==='completed', isStart = t.status==='in_progress';
                        const canStart = !isDone && !isStart && t.process_execution_id;
                        return `<div class="wb-exec-task ${isDone?'done':''}">
                            <div class="wb-exec-nm">${esc(nm+floor)}</div>
                            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                                <span class="wb-chip ${isDone?'c-done':isStart?'c-go':'c-wait'}">${isDone?'✅ Done':isStart?'🔄 In Progress':'📋 Pending'}</span>
                                ${canStart ? `<button class="sb-btn primary small" data-da-start="${t.id}" style="font-size:13px;padding:5px 10px">▶ Start 加入正在做</button>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
            }

            // 主管 / 经理
            const todayN  = today.length;
            const urgent  = todayN === 0;
            const yestLine = yest.length
                ? `<div class="wb-yest"><span>📊 Yesterday <b style="color:#fff">${yDone}/${yest.length}</b> <small>昨日完成</small></span>
                   ${yest.filter(t=>t.status!=='completed').map(t=>`<span class="wb-yest-chip">${esc(t.custom_title||getI18nField(t,'process_name')||'?')}</span>`).join('')}</div>`
                : '';
            return `<div class="wb-banner wb-sup ${urgent?'wb-urgent':'wb-ok'}">
                ${yestLine}
                <div class="wb-sup-row">
                    <div class="wb-sup-status">
                        ${urgent
                            ? `<b class="wb-alert-txt">⚠️ No tasks assigned today</b><br><small>今天还没有工作安排</small>`
                            : `<b class="wb-ok-txt">✅ Assigned ${todayN} tasks</b><br><small>今天已安排 ${todayN} 项工作</small>`}
                    </div>
                    <button class="wb-arrange-btn" onclick="DailyAssign.open(${pid})">
                        📋<br><b>Assign Tasks</b><br><small>工作安排</small>
                    </button>
                </div>
            </div>`;
        },

        renderPlanned() {
            const d = this.data;
            const doing = d.inProgress;
            const readyN = d.ready.length, hasTeam = d.team.length > 0;
            const here = d.team.length - d.absent.length;
            let html = '';

            // 没有团队 → 顶部提示
            if (!hasTeam) {
                html += `<div class="td-banner"><b>请先录入施工团队 Please enter team info</b><br>去「项目准备」填写班组信息，填完才能派人。<br>` +
                    (isManager() ? `<button class="sb-btn primary" style="margin-top:8px" data-menu="prepare">录入团队</button>` : '') + `</div>`;
            }
            d.warnings.forEach(w => { html += `<div class="td-warn">⚠ ${esc(w.zh)}</div>`; });

            // ═══ 角色专属工作安排 banner ═══
            html += this.renderWorkBanner();

            // ═══ 今天到场几个人（顶部简单一行）═══
            if (hasTeam) {
                const absent = new Set(d.absent);
                html += `<div class="fc-header"><span class="fc-date">第 ${d.workingDay} 个工作日 / Working Day ${d.workingDay}</span><span class="fc-stat">${doing.length} tasks In Progress · ${readyN > 0 ? readyN + ' Can Start ·' : ''} ${here}/${d.team.length} Present</span></div>`;
            }

            // ═══ 第 1 步：点名 ═══
            html += `<div class="fc-step"><div class="fc-step-label"><span class="fc-num">1</span><b class="fc-th-label">Attendance</b><small class="fc-zh-sub">点名</small></div>`;
            if (!hasTeam) {
                html += `<div class="fc-empty">先录入团队再点名 / Enter team first</div>`;
            } else {
                const absent = new Set(d.absent);
                html += `<div class="fc-att-grid">` +
                    d.team.map(m => {
                        const isAbsent = absent.has(m.id);
                        return `<button class="fc-att ${isAbsent ? 'absent' : (m.level === 'skilled' ? 'skilled' : 'helper')}" data-att="${m.id}">
                            <span class="fc-att-icon">${isAbsent ? '❌' : '✅'}</span>
                            <span class="fc-att-name">${esc(m.name)}</span>
                            <span class="fc-att-status">${isAbsent ? '没来 Absent' : '到了 Present'}</span>
                        </button>`;
                    }).join('') + `</div>`;
            }
            html += `</div>`;

            // ═══ 第 2 步：正在做的任务 ═══
            html += `<div class="fc-step"><div class="fc-step-label"><span class="fc-num">2</span><b class="fc-th-label">In Progress</b><small class="fc-zh-sub">正在做</small>${doing.length ? `<span class="fc-badge">${doing.length}</span>` : ''}</div>`;
            if (doing.length) {
                html += doing.map(x => this.cardDoing(x, true)).join('');
            } else {
                html += `<div class="fc-empty">现在没有进行中的任务 / No tasks in progress</div>`;
            }
            html += `</div>`;

            // ═══ 第 3 步：可以开工的任务 ═══
            html += `<div class="fc-step"><div class="fc-step-label"><span class="fc-num fc-num-green">3</span><b class="fc-th-label">Ready to Start</b><small class="fc-zh-sub">可以开工</small>${readyN ? `<span class="fc-badge green">${readyN}</span>` : ''}</div>`;
            if (readyN) {
                html += d.ready.map(x => this.cardReady(x, d.suggestions.find(s => s.execId === x.execId), true)).join('');
            } else {
                html += `<div class="fc-empty">没有新任务可开工，在等前面的工序完成</div>`;
            }
            html += `</div>`;

            // ═══ 快要能开始（折叠）═══
            const doingKeys = new Set(doing.map(x => x.key));
            const near = d.blocked.filter(b => b.reasons.every(r => (r.type === 'lag' && r.daysLeft <= 5) || ((r.type === 'pred_not_finished' || r.type === 'ss_progress') && doingKeys.has(r.pred))));
            near.sort((a, b) => a.reasons.length - b.reasons.length || a.key.localeCompare(b.key));
            const nearTop = near.slice(0, 8), nearSet = new Set(nearTop.map(x => x.key));
            if (nearTop.length) {
                html += `<div class="fc-step collapsed"><details><summary class="fc-step-label summ"><span class="fc-num fc-num-gray">4</span><b class="fc-th-label">Nearly Ready</b><small class="fc-zh-sub">快要开工</small><span class="fc-badge gray">${nearTop.length}</span></summary>` +
                    nearTop.map(x => this.rowWaiting(x)).join('') + `</details></div>`;
            }

            // ═══ 其他等待中（深度折叠）═══
            const rest = d.blocked.filter(b => !nearSet.has(b.key));
            if (rest.length) {
                const groups = {};
                rest.forEach(x => { const k = x.floor != null ? 'Floor ' + x.floor : 'Whole Building'; (groups[k] = groups[k] || []).push(x); });
                const names = Object.keys(groups).sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999));
                html += `<div class="fc-step collapsed"><details><summary class="fc-step-label summ"><span class="fc-num fc-num-gray">…</span><b>其他在等待 Waiting Tasks</b><span class="fc-badge gray">${rest.length}</span></summary>` +
                    names.map(n => `<details class="td-grp" style="margin:4px 0"><summary style="padding:6px 0;cursor:pointer;font-weight:600">${esc(n)} (${groups[n].length})</summary>${groups[n].map(x => this.rowWaiting(x)).join('')}</details>`).join('') +
                    `</details></div>`;
            }

            if (d.idle.length) {
                html += `<div class="fc-step collapsed"><details><summary class="fc-step-label summ"><span class="fc-num fc-num-gray">👥</span><b>空闲的人 Available Workers</b><span class="fc-badge gray">${d.idle.length}</span></summary>` +
                    d.idle.map(i => `<div class="td-row"><span class="td-chip free">${esc(i.name)}</span><span class="td-sub">${i.canBorrowTo.length ? 'Can go to: ' + i.canBorrowTo.map(esc).join(', ') : 'No suitable task at the moment'}</span></div>`).join('') +
                    `</details></div>`;
            }
            return html;
        },

        cardDoing(x, planned) {
            const pct = pctOf(x);
            const paused = x.workStatus === 'waiting_material' || x.workStatus === 'weather_stop';
            const hasPeople = planned && (this.assign[x.execId] || []).length > 0;
            const est = this.estMap && this.estMap[x.execId];
            const estLine = est && est.kind === 'work' && est.estDays
                ? `<span class="fc-est-pill">~${est.estDays}days/${est.estDays}天 · ${est.crewsUsed}crews/${est.crewsUsed}班 ${est.people.skilled}skilled+${est.people.helper}helpers</span>`
                : '';
            const dailyTarget = est && est.kind === 'work' && est.output && est.crewsUsed ? (est.output * est.crewsUsed) : null;
            const quotaLine = dailyTarget && !paused ? `<div class="fc-quota">🎯 Daily target/今日定额：<b>${dailyTarget} ${esc(est.unit||"")}</b></div>` : "";
            const statusLabel = { waiting_material: '🟡 Missing Materials / 缺材料', weather_stop: '⛅ Weather Stop / 天气停工' }[x.workStatus] || '';

            return `<div class="fc-card doing ${paused ? 'paused' : ''}">
                <div class="fc-card-top">
                    <div class="fc-card-title">${nm(x)} ${this.floorTag(x)}</div>
                    <div class="fc-card-pct">${pct}%</div>
                </div>
                <div class="fc-progress"><div class="fc-progress-fill" style="width:${pct}%"></div></div>
                ${quotaLine}
                ${estLine || statusLabel ? `<div class="fc-card-meta">${statusLabel ? `<span class="fc-status-tag">${statusLabel}</span>` : ''}${estLine && !paused ? estLine : ''}</div>` : ''}
                ${hasPeople ? `<div class="fc-people">${this.peopleChips(x.execId, true)}</div>` : ''}

                ${paused
                    ? `<button class="fc-main-btn resume" data-resume="${x.execId}">▶ Resume</button>`
                    : `<button class="fc-main-btn prog" data-prog="${x.execId}">📝 Record Progress</button>`
                }

                ${!paused ? `
                <div class="fc-reason-label">遇到问题了？ Problem?</div>
                <div class="fc-reason-row">
                    <button class="fc-reason-btn material" data-stat="waiting_material:${x.execId}">
                        <span class="fc-reason-icon">🟡</span>
                        <span>缺材料<br><small>Missing Materials</small></span>
                    </button>
                    <button class="fc-reason-btn weather" data-stat="weather_stop:${x.execId}">
                        <span class="fc-reason-icon">⛅</span>
                        <span>下雨停工<br><small>Rain Stop</small></span>
                    </button>
                    <button class="fc-reason-btn done" data-done="${x.execId}">
                        <span class="fc-reason-icon">✅</span>
                        <span>完成了<br><small>Done</small></span>
                    </button>
                </div>
                ` : ''}

                <div class="fc-more-row">
                    ${planned ? `<button class="fc-more-btn" data-pick="${x.execId}">👷 派人 Assign</button>` : ''}
                    <button class="fc-more-btn" data-qty="${x.execId}">📐 工程量 Qty</button>
                    <button class="fc-more-btn" data-hist="${x.execId}">📊 历史 History</button>
                    <button class="fc-more-btn" data-subtasks="${x.execId}">📑 子任务 Subtasks</button>
                    <button class="fc-more-btn" data-reset="${x.execId}" style="color:#dc2626">🔄 重置 Reset</button>
                </div>
            </div>`;
        },
        cardReady(x, sug, planned) {
            const est = this.estMap && this.estMap[x.execId];
            const estLine = est && est.kind === 'work' && est.estDays
                ? `<span class="fc-est-pill">~${est.estDays}days/${est.estDays}天 · ${est.crewsUsed}crews/${est.crewsUsed}班 ${est.people.skilled}skilled+${est.people.helper}helpers</span>`
                : '';
            const sugPeople = sug ? sug.members.map(m => `<span class="fc-sug-chip">${esc(m.name)}</span>`).join('') : '';
            return `<div class="fc-card ready">
                <div class="fc-card-top">
                    <div class="fc-card-title">${nm(x)} ${this.floorTag(x)}</div>
                </div>
                ${estLine ? `<div class="fc-card-meta">${estLine}</div>` : ''}
                ${sugPeople ? `<div class="fc-sug">💡 Suggested: ${sugPeople}</div>` : ''}
                ${sug && planned
                    ? `<button class="fc-main-btn start" data-go="${x.execId}">▶ Start as Suggested</button>
                       <div class="fc-secondary"><button class="fc-sec-btn" data-start="${x.execId}">Start Work</button>${planned ? `<button class="fc-sec-btn" data-pick="${x.execId}">👷 自己选人</button>` : ''}</div>`
                    : `<button class="fc-main-btn start" data-start="${x.execId}">▶ Start Work</button>
                       ${planned ? `<div class="fc-secondary"><button class="fc-sec-btn" data-pick="${x.execId}">👷 Select & Start</button></div>` : ''}`
                }
            </div>`;
        },
        rowWaiting(x) {
            const why = x.reasons.slice(0, 2).map(r => esc(r.zh)).join('；') + (x.reasons.length > 2 ? ` 等 ${x.reasons.length} 项` : '');
            return `<div class="td-row wait"><div class="td-grow"><b>${nm(x)}</b> ${this.floorTag(x)}<div class="td-sub">${why}</div>${SiteEstimate.mini(this.estMap && this.estMap[x.execId])}</div>` +
                `<a href="#" class="td-link" data-force="${x.execId}">提前开始…</a>` + `</div>`;
        },

        // ---------- 事件 ----------
        bind() {
            const c = document.getElementById('site-board-container');
            const on = (sel, fn) => c.querySelectorAll(sel).forEach(el => el.addEventListener('click', e => { e.preventDefault(); fn(el); }));
            const pid = this.projectId;
            const dt = c.querySelector('#td-date'); if (dt) dt.addEventListener('change', () => { this.date = dt.value || null; this.refresh(); });
            on('[data-menu]', el => {
                const k = el.dataset.menu;
                document.querySelectorAll('.td-menu[open]').forEach(m => m.removeAttribute('open'));
                if (k === 'prepare') ProjectDetail.showSubView('prepare');
                else if (k === 'team') SiteTeam.open(pid);
                else if (k === 'profile') SiteProfile.open(pid);
                else if (k === 'boq') SiteBoq.open(pid);
                else if (k === 'quota') SiteQuota.open();
                else if (k === 'overrides') this.showOverrides(pid);
                else if (k === 'notify') SiteNotify.open(pid);
                else this.refresh();
            });
            on('[data-da-start]',el=>{const id=Number(el.dataset.daStart);this.run(()=>apiRequest('/api/daily-assignments/'+id,{method:'PUT',body:JSON.stringify({status:'in_progress'})}),'已开始');});
            on('[data-da-done]',el=>{const id=Number(el.dataset.daDone);this.run(()=>apiRequest('/api/daily-assignments/'+id,{method:'PUT',body:JSON.stringify({status:'completed'})}),'✅ 完成');});
            on('[data-da-start]',el=>{
                const did=Number(el.dataset.daStart);
                this.run(async()=>{
                    // 1. 更新指派任务状态
                    await apiRequest('/api/daily-assignments/'+did,{method:'PUT',body:JSON.stringify({status:'in_progress'})});
                    // 2. 如果绑定了工序，同时启动工序（从第3块消失）
                    const asgn=(this._assignedTasks||[]).find(t=>t.id===did);
                    if(asgn && asgn.process_execution_id){
                        try{ await SiteStart.start(asgn.process_execution_id); }catch(_){}
                    }
                },'已开始 Started');
            });
            on('[data-da-done]',el=>{const did=Number(el.dataset.daDone);this.run(()=>apiRequest('/api/daily-assignments/'+did,{method:'PUT',body:JSON.stringify({status:'completed'})}),'✅ 完成 Done');});
            on('[data-att]', el => this.toggleAbsent(Number(el.dataset.att)));
            on('[data-rm]', el => { const [k, i] = el.dataset.rm.split(':'); this.assign[k] = (this.assign[k] || []).filter(x => x !== Number(i)); this.commit(); });
            on('[data-pick]', el => this.pickPeople(Number(el.dataset.pick)));
            on('[data-start]', el => this.start(Number(el.dataset.start)));
            on('[data-go]', el => this.startWithSuggestion(Number(el.dataset.go)));
            on('[data-force]', el => this.forceStart(Number(el.dataset.force)));
            on('[data-prog]', el => this.progressDialog(Number(el.dataset.prog)));
            on('[data-done]', el => this.complete(Number(el.dataset.done)));
            on('[data-resume]', el => this.setStatus(Number(el.dataset.resume), 'in_progress'));
            on('[data-stat]', el => { const [s, id] = el.dataset.stat.split(':'); this.setStatus(Number(id), s); });
            on('[data-qty]', el => this.quantityDialog(Number(el.dataset.qty)));
            on('[data-subtasks]', el => { if (hasApp() && app.showSubtasks) app.showSubtasks(Number(el.dataset.subtasks)); else toast('子任务功能不可用', 'error'); });
            on('[data-reset]', el => this.resetProcess(Number(el.dataset.reset)));
            on('[data-hist]', el => this.history(Number(el.dataset.hist)));
        },

        findItem(execId) {
            const d = this.data;
            if (d && d.planned) return [].concat(d.inProgress, d.ready, d.blocked).find(x => x.execId === execId);
            const r = (this.legacyRows || []).find(x => x.id === execId);
            return r ? { execId, name: r.process_name, label: r.process_code, progress: (Number(r.completion_percentage) || 0) / 100, unit: r.quantity_unit, plannedQuantity: Number(r.planned_quantity) > 0 ? Number(r.planned_quantity) : null } : null;
        },
        async run(fn, okMsg) {
            try { busy(true); await fn(); if (okMsg) toast(okMsg); await this.refresh(); SiteNotify.refreshCount(); }
            catch (e) { if (!e.cancelled) toast(e.message, 'error'); await this.refresh(); }
            finally { busy(false); }
        },

        async toggleAbsent(id) {
            const s = new Set(this.data.absent);
            s.has(id) ? s.delete(id) : s.add(id);
            await this.run(() => call('PUT', `/projects/${this.projectId}/attendance`, { date: this.date, absent: Array.from(s) }));
        },
        async commit() {
            const payload = {};
            Object.keys(this.assign).forEach(k => { if (this.assign[k].length) payload[k] = this.assign[k]; });
            // Persist external teams to localStorage
            const key = `ext_teams_${this.projectId}_${this.date||new Date(Date.now()+7*3600000).toISOString().slice(0,10)}`;
            if (this.externalTeams && Object.keys(this.externalTeams).length) {
                try { localStorage.setItem(key, JSON.stringify(this.externalTeams)); } catch(_) {}
            } else {
                try { localStorage.removeItem(key); } catch(_) {}
            }
            await this.run(() => call('PUT', `/projects/${this.projectId}/site-assignments`, {
                date: this.date,
                assignments: payload,
                externalTeams: this.externalTeams || {}
            }), '已保存 Saved');
        },
        pickPeople(execId) {
            const d = this.data, used = this.usedIds(), cur = new Set(this.assign[execId] || []), absent = new Set(d.absent);
            const curExt = (this.externalTeams && this.externalTeams[execId]) || { name:'', skilled:0, helper:0 };
            const opts = (d.team.length ? d.team.map(m => {
                const taken = used.has(m.id) && !cur.has(m.id), off = absent.has(m.id);
                return `<label class="td-pickrow"><input type="checkbox" value="${m.id}" ${cur.has(m.id) ? 'checked' : ''} ${taken || off ? 'disabled' : ''}> <b>${esc(m.name)}</b> ` +
                    `<span class="td-tag">${m.level === 'skilled' ? '技工 Skilled' : '普工 Helper'}</span> <span class="td-sub">${esc(m.skills.map(s => (TRADES[s] ? TRADES[s].zh : '什么都能帮')).join('、'))}</span>` +
                    `${taken ? ' <span class="td-tag gray">已派到别处</span>' : ''}${off ? ' <span class="td-tag warn">今天没来</span>' : ''}</label>`;
            }).join('') : '<div style="color:#94a3b8;padding:8px 0;font-size:13px">暂无注册团队成员</div>') +
            `<div style="margin-top:14px;padding-top:12px;border-top:1.5px solid #e2e8f0">
                <div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:8px">🏗️ External Team / 外派团队</div>
                <div style="display:grid;grid-template-columns:1fr 80px 80px;gap:8px;align-items:center">
                    <input id="ext-name" type="text" placeholder="Team Name / 队伍名称" value="${esc(curExt.name)}"
                        style="padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px">
                    <div>
                        <div style="font-size:11px;color:#64748b;margin-bottom:2px">Skilled 技工</div>
                        <input id="ext-skilled" type="number" min="0" value="${curExt.skilled||0}"
                            style="width:100%;padding:7px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;text-align:center">
                    </div>
                    <div>
                        <div style="font-size:11px;color:#64748b;margin-bottom:2px">helpers 普工</div>
                        <input id="ext-helper" type="number" min="0" value="${curExt.helper||0}"
                            style="width:100%;padding:7px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;text-align:center">
                    </div>
                </div>
                <div style="font-size:12px;color:#94a3b8;margin-top:6px">Fill in only when an external team assists this task / 仅当有外包人员参与本工序时填写</div>
            </div>`;
            const dlg = overlay('选择人员 Select Workers', opts, '<button class="sb-btn" data-cancel>Cancel</button><button class="sb-btn primary" data-ok>确定 OK</button>', true);
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = () => {
                const ids = dlg.qa('input[type=checkbox]:checked').map(x => Number(x.value));
                if (ids.length) this.assign[execId] = ids; else delete this.assign[execId];
                // Save external team info
                const extName = (dlg.q('#ext-name').value || '').trim();
                const extSkilled = parseInt(dlg.q('#ext-skilled').value) || 0;
                const extHelper = parseInt(dlg.q('#ext-helper').value) || 0;
                if (!this.externalTeams) this.externalTeams = {};
                if (extName || extSkilled || extHelper) {
                    this.externalTeams[execId] = { name: extName, skilled: extSkilled, helper: extHelper };
                } else {
                    delete this.externalTeams[execId];
                }
                dlg.close(); this.commit();
            };
        },

        async start(execId, force) {
            await this.run(async () => {
                try { await SiteStart.start(execId, force); }
                catch (e) {
                    if (e.status === 409 && e.data && e.data.code === 'BLOCKED') {
                        const reason = await SiteStart.askReason(e.data);
                        if (!reason) { const c = new Error('cancel'); c.cancelled = true; throw c; }
                        await SiteStart.start(execId, reason);
                        toast('已提前开始，并通知了上级和老板 Started early, notified supervisor and owner', 'warning');
                    } else throw e;
                }
            }, '已开始 Started');
        },
        async startWithSuggestion(execId) {
            const s = this.data.suggestions.find(x => x.execId === execId);
            if (!s) return this.start(execId);
            const used = this.usedIds();
            if (s.members.some(m => used.has(m.id))) { toast('建议的人已经被安排到别处，请自己选人', 'error'); return; }
            await this.run(async () => {
                await SiteStart.start(execId);
                this.assign[execId] = (this.assign[execId] || []).concat(s.members.map(m => m.id));
                const payload = {}; Object.keys(this.assign).forEach(k => { if (this.assign[k].length) payload[k] = this.assign[k]; });
                await call('PUT', `/projects/${this.projectId}/site-assignments`, { date: this.date, assignments: payload });
            }, '已开工并派人 Started and assigned workers');
        },
        async forceStart(execId) {
            const x = this.data.blocked.find(b => b.execId === execId);
            const reason = await SiteStart.askReason({ task: x.label, reasons: x.reasons });
            if (!reason) return;
            await this.run(async () => {
                const r = await SiteStart.start(execId, reason);
                toast('已提前开始，并通知了上级和老板 Started early, notified supervisor and owner', 'warning');
                if (r.data.override) alert('提前开始已记录\n风险等级：' + { high: '高 High', medium: '中 Medium', low: '低 Low' }[r.data.override.severity]);
            });
        },

        progressDialog(execId) {
            const x = this.findItem(execId); if (!x) return;
            const est = this.estMap && this.estMap[x.execId];
            const quota = est && est.kind === 'work' && est.output ? est.output : null;
            const crews = est && est.crewsUsed ? est.crewsUsed : 1;
            const dailyTarget = quota ? (quota * crews) : null;
            const unit = x.unit || (est && est.unit) || '';
            const hasQty = x.plannedQuantity > 0;
            const name = nm(x);

            const targetHtml = dailyTarget
                ? `<div class="pg-target">🎯 Daily target/今日定额：<b>${dailyTarget} ${esc(unit)}</b>（${crews} crews/班）</div>`
                : '';

            const body = `
                <div class="pg-title">${name}</div>
                ${targetHtml}
                <div class="pg-label">今天实际做了多少？ How much completed today</div>
                <div class="pg-qty-row">
                    <input type="number" id="pg-qty" min="0" step="0.1" placeholder="0"
                        style="flex:1;font-size:28px;font-weight:800;padding:14px;text-align:center;border:2.5px solid #bfdbfe;border-radius:12px;color:#1e3a8a">
                    <span class="pg-unit">${esc(unit)}</span>
                </div>
                ${dailyTarget ? `
                <div class="pg-shortcuts">
                    <button type="button" class="pg-scut" data-v="${Math.round(dailyTarget * 0.5 * 10) / 10}">50%<br><small>${Math.round(dailyTarget * 0.5 * 10) / 10}</small></button>
                    <button type="button" class="pg-scut pg-scut-std" data-v="${dailyTarget}">定额<br><small>${dailyTarget}</small></button>
                    <button type="button" class="pg-scut pg-scut-over" data-v="${Math.round(dailyTarget * 1.2 * 10) / 10}">120%⚡<br><small>${Math.round(dailyTarget * 1.2 * 10) / 10}</small></button>
                </div>` : ''}
                ${!hasQty ? `<div class="pg-warn">工程量未录入，进度将按百分比记录</div>` : ''}
                <div class="sb-field" style="margin-top:10px"><label style="font-size:13px">备注（可不填）Notes</label><textarea id="pg-note" rows="2" style="font-size:14px"></textarea></div>`;

            const dlg = overlay("今天完成了多少 Record Today's Progress", body,
                '<button class="sb-btn" data-cancel>Cancel</button><button class="sb-btn primary" data-ok style="font-size:16px;padding:12px 24px">✅ 保存</button>', true);

            dlg.qa('.pg-scut').forEach(b => b.onclick = () => { dlg.q('#pg-qty').value = b.dataset.v; });
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = async () => {
                const qtyVal = parseFloat(dlg.q('#pg-qty').value);
                const note = dlg.q('#pg-note').value.trim();
                if (isNaN(qtyVal) || qtyVal < 0) { toast('请填写完成的数量', 'error'); return; }
                try {
                    busy(true);
                    if (hasQty && qtyVal > 0) {
                        // 有工程量 → 按实物量记录
                        await call('POST', '/daily-progress', {
                            process_execution_id: execId,
                            quantity_completed: qtyVal,
                            unit,
                            work_status: 'normal',
                            notes: note ? { zh: note, th: note } : null
                        });
                        if (dailyTarget && qtyVal > dailyTarget) {
                            toast(`⚡ 超出定额！完成 ${qtyVal} ${unit}，定额 ${dailyTarget} ${unit}`, 'success');
                        } else {
                            toast('进度已记录 ✅');
                        }
                    } else {
                        // 没有工程量 → 按百分比记录（把数量当百分比）
                        const p = Math.min(100, Math.max(0, qtyVal));
                        const body = { completion_percentage: p };
                        if (p >= 100) { body.status = 'completed'; body.actual_end_date = this.date || new Date().toISOString().slice(0, 10); }
                        if (note) body.notes = { zh: note, th: note };
                        await call('PUT', `/processes/${execId}`, body);
                        toast('进度已记录 ✅');
                    }
                    dlg.close(); await this.refresh();
                } catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            };
        },
        async complete(execId) {
            const x = this.findItem(execId);
            if (!confirm(`确认「${x ? x.label : ''}」已经全部完成？ Confirm task is fully completed`)) return;
            await this.run(() => call('PUT', `/processes/${execId}`, { status: 'completed', completion_percentage: 100, actual_end_date: this.date || new Date().toISOString().slice(0, 10) }), '已完成 Done');
        },
        async resetProcess(execId) {
            if (!confirm('确认把这道工序重置为「未开始」？状态会清零，进度数据保留。')) return;
            await this.run(() => call('PUT', '/processes/'+execId, {
                status: 'not_started',
                completion_percentage: 0,
                actual_start_date: null
            }), '已重置 Reset done');
        },
        async setStatus(execId, status) {
            let note = '';
            if (status === 'waiting_material') {
                const dlg = await new Promise(resolve => {
                    const d = overlay('缺什么材料？ What Materials are Missing?', '<div class="sb-field"><label>请写明缺的材料 *</label><input type="text" id="ws-note" placeholder="例如：水泥、PVC线管"></div>',
                        '<button class="sb-btn" data-cancel>Cancel</button><button class="sb-btn primary" data-ok>确定</button>', true);
                    d.q('[data-cancel]').onclick = () => { d.close(); resolve(null); };
                    d.q('[data-x]').onclick = () => { d.close(); resolve(null); };
                    d.q('[data-ok]').onclick = () => { const v = d.q('#ws-note').value.trim(); if (!v) { toast('请写明缺什么材料', 'error'); return; } d.close(); resolve(v); };
                });
                if (dlg == null) return;
                note = dlg;
            }
            const ok = { waiting_material: '已标记缺材料，这几天不算班组的责任 Saved', weather_stop: '已标记天气停工 Saved', in_progress: '已恢复施工 Work resumed' }[status];
            await this.run(() => call('POST', `/processes/${execId}/work-status`, { status, note }), ok);
        },
        quantityDialog(execId) {
            const x = this.findItem(execId); if (!x) return;
            const dlg = overlay('录入工程量 Enter Quantity', `<div class="sb-note">${nm(x)}</div>` +
                `<div class="sb-grid"><div class="sb-field"><label>计划总量 *</label><input type="number" id="qd-q" min="0" step="0.01" value="${x.plannedQuantity || ''}"></div>` +
                `<div class="sb-field"><label>单位</label><input type="text" id="qd-u" value="${esc(x.unit || '')}"></div></div>` +
                `<div class="hint" style="margin-top:6px;font-size:12px;color:#94a3b8">录入后，才能按数量记录每天完成多少，也才能准确估算工期。</div>`,
                '<button class="sb-btn" data-cancel>Cancel</button><button class="sb-btn primary" data-ok>保存</button>', true);
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = async () => {
                const q = parseFloat(dlg.q('#qd-q').value);
                if (!(q > 0)) { toast('请填写大于 0 的数量', 'error'); return; }
                try { busy(true); await call('PUT', `/process-execution/${execId}/plan`, { planned_quantity: q, quantity_unit: dlg.q('#qd-u').value.trim() }); dlg.close(); toast('已保存 Saved'); await this.refresh(); }
                catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            };
        },
        async history(execId) {
            try {
                busy(true);
                const r = await call('GET', `/process-execution/${execId}/progress-history`);
                busy(false);
                const rows = r.data || [];
                const st = { normal: '正常 Normal', waiting_material: '等材料 Waiting for Materials', weather_stop: '天气停工 Weather Stop', problem: '其他问题 Other Issue' };
                const noteOf = n => { try { const o = typeof n === 'string' ? JSON.parse(n) : n; return (o && (o.zh || o.th)) || ''; } catch (_) { return String(n || ''); } };
                overlay('进度历史 History', rows.length ? `<table style="width:100%;font-size:13px;border-collapse:collapse"><tr style="text-align:left;color:#64748b"><th>日期</th><th>完成量</th><th>累计</th><th>%</th><th>状态</th><th>备注</th></tr>` +
                    rows.map(h => `<tr style="border-top:1px solid #f1f5f9"><td>${esc(String(h.date).slice(0, 10))}</td><td>${esc(h.quantity_completed)} ${esc(h.unit || '')}</td><td>${esc(h.total_completed)}</td><td>${Math.round(h.completion_percentage)}</td><td>${esc(st[h.work_status] || h.work_status || '')}</td><td>${esc(noteOf(h.notes))}</td></tr>`).join('') + '</table>'
                    : '<div class="td-empty">还没有按数量记录过进度</div>');
            } catch (e) { busy(false); toast(e.message, 'error'); }
        },

        async showOverrides(projectId) {
            const r = await call('GET', `/projects/${projectId}/overrides`);
            const sev = { high: '高 High', medium: '中 Medium', low: '低 Low' };
            const body = r.data.length ? r.data.map(o =>
                `<div class="sb-noti"><div class="sb-title">${esc(getI18nField({ process_name: o.process_name }, 'process_name'))} <span class="sb-sev-${o.severity}">风险${sev[o.severity]}</span></div>` +
                `<div class="sb-sub">${esc(o.created_at)} · ${esc(o.decided_by_name || '')}</div><pre>原因：${esc(o.reason)}\n未满足：${(o.unmet || []).map(u => esc(u.zh)).join('；')}</pre></div>`).join('')
                : '<div class="sb-empty">还没有提前开始的记录 No early-start records yet</div>';
            overlay('提前开始记录 Early Start Records', body);
        }
    };

    // 点别处时收起「更多」菜单
    document.addEventListener('click', e => {
        document.querySelectorAll('.td-menu[open]').forEach(m => { if (!m.contains(e.target)) m.removeAttribute('open'); });
    });

    // ================= 导入工程量清单（Excel） =================
    const SiteBoq = {
        async post(projectId, action, file, extra) {
            const fd = new FormData();
            fd.append('boq', file);
            if (extra) Object.keys(extra).forEach(k => fd.append(k, extra[k]));
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/boq/${action}`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }, body: fd
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j.success) throw new Error(j.message || '导入失败');
            return j.data;
        },
        open(projectId) {
            const d = overlay('导入工程量清单 Import BOQ',
                `<div class="sb-note">选择报价单/工程量清单的 Excel 文件（.xlsx）。系统会把每一行对应到工序，先给你看对照表，你确认后才会写入。<br>` +
                `Word 或 PDF 的清单，请先另存为 Excel。系统只写入各工序的「计划数量」，不会改动别的数据。</div>` +
                `<div class="sb-field"><input type="file" id="boq-file" accept=".xlsx"></div><div id="boq-result"></div>`,
                `<button class="sb-btn primary" data-preview>读取并预览 Preview</button>`);
            let file = null;
            d.q('[data-preview]').onclick = async () => {
                file = d.q('#boq-file').files[0];
                if (!file) { toast('请先选择文件', 'error'); return; }
                try {
                    busy(true);
                    const r = await SiteBoq.post(projectId, 'preview', file);
                    busy(false);
                    SiteBoq.showResult(d, projectId, file, r);
                } catch (e) { busy(false); toast(e.message, 'error'); }
            };
        },
        showResult(d, projectId, file, r) {
            const kindTag = k => k === 'split' ? '<span class="td-tag">分摊</span>' : k === 'converted' ? '<span class="td-tag">已换算</span>' : '';
            const rows = r.matches.map((m, i) =>
                `<tr><td><input type="checkbox" data-sel="${esc(m.key)}" checked></td><td>${esc(m.name)}${m.floor != null ? ` · ${m.floor}层` : ''}</td>` +
                `<td style="text-align:right"><b>${m.qty}</b> ${esc(m.unit)}${m.existing ? `<div class="sb-sub">原来：${m.existing}</div>` : ''}</td>` +
                `<td>${kindTag(m.kind)}<div class="sb-sub">${m.sources.map(s => esc(s.desc) + ' ' + s.qty + ' ' + esc(s.unit)).slice(0, 4).join('；')}${m.notes.length ? '<br>' + m.notes.map(esc).join('；') : ''}</div></td></tr>`).join('');
            const list = (arr, f) => arr.length ? `<ul class="sb-list">${arr.map(f).join('')}</ul>` : '<div class="sb-sub">无</div>';
            d.q('#boq-result').innerHTML =
                `<div class="sb-note">清单 ${r.itemCount} 行：可对应 <b>${r.matches.length}</b> 道工序，未对应 ${r.unmapped.length} 行，计划里还缺数量的工序 ${r.missing.length} 道。</div>` +
                (r.warnings.length ? `<div class="td-warn">${r.warnings.map(w => '⚠ ' + esc(w)).join('<br>')}</div>` : '') +
                `<div style="overflow-x:auto"><table class="sb-table"><thead><tr><th>导入</th><th>工序</th><th>数量</th><th>来源与说明</th></tr></thead><tbody>${rows}</tbody></table></div>` +
                `<details><summary class="td-sum">清单里没对应的行 (${r.unmapped.length})</summary>${list(r.unmapped, u => `<li>${esc(u.section)} / ${esc(u.desc)} ${u.qty == null ? '' : u.qty} ${esc(u.unit)}<span class="sb-sub"> · ${esc(u.reason)}</span></li>`)}</details>` +
                `<details><summary class="td-sum">还没有数量的工序，需要现场补 (${r.missing.length})</summary>${list(r.missing, m => `<li>${esc(m.name)}${m.floor != null ? ` · ${m.floor}层` : ''} <span class="sb-sub">(${esc(m.unit)})</span></li>`)}</details>`;
            const foot = d.el.querySelector('footer');
            foot.innerHTML = '<button class="sb-btn primary" data-apply>确认导入选中的工序 Import</button>';
            foot.querySelector('[data-apply]').onclick = async () => {
                const skip = d.qa('[data-sel]').filter(c => !c.checked).map(c => c.dataset.sel);
                try {
                    busy(true);
                    const out = await SiteBoq.post(projectId, 'apply', file, { skip: JSON.stringify(skip) });
                    busy(false);
                    d.close();
                    toast(`已写入 ${out.written} 道工序的计划数量 Quantities saved`);
                    if (window.SiteBoard && window.ProjectDetail && ProjectDetail.currentView === 'site') SiteBoard.refresh();
                } catch (e) { busy(false); toast(e.message, 'error'); }
            };
        }
    };

    // ================= 预计工期与人员配置（进度计划、今日现场、总览共用） =================
    const SiteEstimate = {
        cache: {},
        async get(projectId, force) {
            if (!force && this.cache[projectId] && Date.now() - this.cache[projectId].at < 15000) return this.cache[projectId].data;
            const r = await call('GET', `/projects/${projectId}/estimate`);
            this.cache[projectId] = { at: Date.now(), data: r.data };
            return r.data;
        },
        md: iso => (iso ? iso.slice(5).replace('-', '/') : ''),
        // 一道工序：工程量 / 多少人干 / 多长时间，三格显示
        line(t) {
            if (!t) return '';
            const dates = t.startDate ? `${this.md(t.startDate)} → ${this.md(t.finishDate)}` : (t.finishDate ? `预计 ${this.md(t.finishDate)} 完成` : '');
            let qty, people, time;
            if (t.kind !== 'work') {
                qty = '<b class="est-dim">—</b><small>按固定天数</small>';
                people = '<b class="est-dim">不占班组</b>';
                time = `<b>约 ${t.estDays} 天</b>${dates ? `<small>${dates}</small>` : ''}`;
            } else {
                qty = t.qty != null ? `<b>${Math.round(t.qty * 100) / 100} ${esc(t.unit)}</b><small>标准产量 ${t.output} ${esc(t.unit)}/班/天</small>`
                    : '<b class="est-bad">未录入</b><small>录入后才能算准</small>';
                people = `<b>${t.crewsUsed} 班 · ${t.people.skilled} 大工 + ${t.people.helper} 普工</b><small>${esc(t.tradeName)}，每班 ${t.crewStd.skilled}+${t.crewStd.helper} 人</small>`;
                time = t.estDays ? `<b>约 ${t.estDays} 天</b>${dates ? `<small>${dates}</small>` : ''}`
                    : `<b class="est-warn-t">约 2 天（估算）</b>${dates ? `<small>${dates}</small>` : ''}`;
            }
            const warn = t.shortage ? `<div class="est-warn">⚠ ${esc(t.shortageText)}，按 1 个标准班组估算</div>` : '';
            return `<div class="est-grid"><div class="est-cell"><span>📦 工程量</span>${qty}</div>` +
                `<div class="est-cell"><span>👷 多少人干</span>${people}</div>` +
                `<div class="est-cell"><span>⏱ 多长时间</span>${time}</div></div>${warn}`;
        },
        // 等待中的工序：一行简要
        mini(t) {
            if (!t) return '';
            if (t.kind !== 'work') return `<div class="est-mini">⏱ 固定约 ${t.estDays} 天</div>`;
            return `<div class="est-mini">📦 ${t.qty != null ? Math.round(t.qty * 100) / 100 + ' ' + esc(t.unit) : '<span class="est-bad">工程量未录入</span>'} · 👷 ${esc(t.tradeName)} ${t.crewsUsed} 班（${t.people.skilled}+${t.people.helper} 人） · ⏱ ${t.estDays ? '约 ' + t.estDays + ' 天' : '约 2 天（估算）'}</div>`;
        },
        panel(e, withTeamBtn) {
            if (!e || !e.planned) return '<div class="td-empty">还没有生成工序，先到「项目准备」生成。</div>';
            const late = e.lateDays;
            const cmp = late == null ? '—' : late > 0 ? `<span class="est-bad">晚 ${late} 天</span>` : late < 0 ? `<span class="est-good">提前 ${-late} 天</span>` : '<span class="est-good">正好</span>';
            const notes = [];
            if (e.assumed.noTeam) notes.push(`还没有录入施工团队，每个工种都按 1 个标准班组估算。${withTeamBtn ? '<a href="#" data-est-go="prepare">去录入团队</a>' : ''}`);
            else if (e.assumed.missingCrewTrades.length) notes.push(`团队里还没有这些工种的大工：${esc(e.assumed.missingCrewTrades.join('、'))}，先按 1 个标准班组估算。`);
            if (e.assumed.missingQty) notes.push(`有 ${e.assumed.missingQty} 道工序还没有工程量，先按 2 天估算（导入清单或现场录入后会更准）。`);
            const rows = e.byTrade.map(x =>
                `<tr><td><b>${esc(x.name)}</b></td><td>${x.assumed ? '<span class="est-bad">没有，按 1 班估算</span>' : x.crews + ' 班'}</td>` +
                `<td>${x.std.skilled} 大工${x.std.helper ? ' + ' + x.std.helper + ' 普工' : ''}</td><td>${x.busyCrewDays}</td>` +
                `<td>${this.md(x.firstDate)} → ${this.md(x.lastDate)}</td></tr>`).join('');
            return `<div class="est-panel">
                <div class="est-title">📐 预计工期与人员配置 <small>从今天起，按剩余工作、当前团队和工程量排出，仅供参考</small></div>
                <div class="est-stats">
                    <div class="est-stat"><b>${e.remainingDays}</b><span>还需工作日（已完成 ${e.doneCount}/${e.totalCount} 道）</span></div>
                    <div class="est-stat"><b>${e.finishDate}</b><span>预计完工日</span></div>
                    <div class="est-stat"><b>${cmp}</b><span>对比计划完工 ${e.plannedEnd || '未设置'}</span></div>
                    <div class="est-stat"><b>${e.peakHeadcount}</b><span>用工高峰（人/天）</span></div>
                </div>
                ${notes.map(n => `<div class="est-note">ℹ ${n}</div>`).join('')}
                <details class="est-det"><summary>各工种班组配置与用工量（${e.byTrade.length} 个工种）</summary>
                    <div style="overflow-x:auto"><table class="sb-table"><thead><tr><th>工种</th><th>团队可组</th><th>每班配置</th><th>总用工（班组·天）</th><th>作业期间</th></tr></thead><tbody>${rows}</tbody></table></div>
                </details></div>`;
        },
        bindGo(root) {
            root.querySelectorAll('[data-est-go]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); ProjectDetail.showSubView(a.dataset.estGo); }));
        }
    };


    // ================= 定额设置（仅管理者）=================
    const SiteQuota = {
        async open() {
            busy(true);
            let rows;
            try { rows = (await call('GET', '/quotas')).data; } catch(e) { busy(false); toast(e.message,'error'); return; }
            busy(false);
            const th = `<tr><th>工序</th><th>代码</th><th>单位</th><th style="text-align:right">大工</th><th style="text-align:right">普工</th><th style="text-align:right">每班/天</th><th></th></tr>`;
            const trs = rows.map(r =>
                `<tr class="${r.isOverridden ? 'qr-modified' : ''}">
                    <td>${esc(r.name)}</td><td><span class="td-tag">${esc(r.code)}</span></td><td>${esc(r.unit)}</td>
                    <td style="text-align:right"><input class="qin" type="number" data-code="${esc(r.code)}" data-f="skilled" min="0" max="20" value="${r.skilled}" style="width:48px"></td>
                    <td style="text-align:right"><input class="qin" type="number" data-code="${esc(r.code)}" data-f="helper" min="0" max="20" value="${r.helper}" style="width:48px"></td>
                    <td style="text-align:right"><input class="qin qin-out" type="number" data-code="${esc(r.code)}" data-f="output" min="0.01" step="0.01" value="${r.output}" style="width:72px"></td>
                    <td>${r.isOverridden ? `<button class="fc-more-btn qr-reset" data-code="${esc(r.code)}" title="恢复默认 ${r.defaultOutput} ${esc(r.unit)}">↺</button>` : ''}</td>
                </tr>`).join('');
            const d = overlay('工序定额设置 Standard Output Settings',
                `<div class="sb-note">只有管理者能修改。更改后立刻生效，影响今日定额的显示和效率计算。泰文：Only managers can edit</div>
                <div class="qr-note">🟡 高亮 = 已手动修改（默认值显示在恢复按钮提示上）</div>
                <div style="overflow-x:auto"><table class="sb-table qr-table">${th}<tbody>${trs}</tbody></table></div>`,
                '<button class="sb-btn" data-cancel>关闭</button><button class="sb-btn primary" data-save>保存所有修改 Save All</button>');
            d.q('[data-cancel]').onclick = d.close;
            d.qa('.qr-reset').forEach(b => b.onclick = async () => {
                try { await call('DELETE', `/quotas/${b.dataset.code}`); d.close(); SiteQuota.open(); } catch(e) { toast(e.message,'error'); }
            });
            d.q('[data-save]').onclick = async () => {
                const pending = [];
                d.qa('tr').forEach(row => {
                    const code = row.querySelector('[data-f="output"]')?.dataset.code;
                    if (!code) return;
                    const output = parseFloat(row.querySelector('[data-f="output"]').value);
                    const skilled = parseInt(row.querySelector('[data-f="skilled"]').value);
                    const helper = parseInt(row.querySelector('[data-f="helper"]').value);
                    if (output > 0) pending.push({ code, output, skilled, helper });
                });
                try {
                    busy(true);
                    for (const p of pending) await call('PUT', `/quotas/${p.code}`, p);
                    busy(false); d.close(); toast('定额已保存 ✅');
                    if (window.SiteEstimate) SiteEstimate.cache = {};
                    if (window.SiteBoard && ProjectDetail.currentView === 'site') SiteBoard.refresh();
                } catch(e) { busy(false); toast(e.message,'error'); }
            };
        }
    };

    window.SiteQuota = SiteQuota;
    window.SiteEstimate = SiteEstimate;
    window.SiteBoq = SiteBoq;
    window.SiteBoard = SiteBoard;
    window.SiteProfile = SiteProfile;
    window.SiteTeam = SiteTeam;
    window.SiteNotify = SiteNotify;
    window.SiteStart = SiteStart;

    // 工序进度更新后，如果当前在看板页，顺便刷新看板
    document.addEventListener('DOMContentLoaded', () => {
        if (window.ProjectDetail && !ProjectDetail.__sbPatched) {
            const orig = ProjectDetail.loadProcesses.bind(ProjectDetail);
            ProjectDetail.loadProcesses = async function () {
                if (ProjectDetail.currentView === 'site') return SiteBoard.refresh();
                return orig();
            };
            ProjectDetail.__sbPatched = true;
        }
        // 取一次工种名称（以服务器为准）
        setTimeout(() => {
            if (localStorage.getItem('authToken')) call('GET', '/site/meta').then(r => { TRADES = r.data.trades || TRADES; }).catch(() => {});
        }, 800);
    });
})();
