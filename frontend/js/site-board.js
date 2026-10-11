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
        mach: { zh: '机械', th: 'เครื่องจักร' }, scaffold: { zh: '架子工', th: 'ช่างนั่งร้าน' }, rebar: { zh: '钢筋工', th: 'ช่างเหล็ก' },
        carpenter: { zh: '木工', th: 'ช่างไม้' }, concrete: { zh: '混凝土工', th: 'ช่างคอนกรีต' }, mason: { zh: '瓦工/抹灰', th: 'ช่างปูน' },
        tiler: { zh: '贴砖工', th: 'ช่างปูกระเบื้อง' }, waterproof: { zh: '防水工', th: 'ช่างกันซึม' }, plumber: { zh: '水工', th: 'ช่างประปา' },
        electrician: { zh: '电工', th: 'ช่างไฟฟ้า' }, painter: { zh: '油漆工', th: 'ช่างทาสี' }, installer: { zh: '安装工', th: 'ช่างติดตั้ง' },
        general: { zh: '普工/杂工', th: 'คนงานทั่วไป' }, roof: { zh: '屋面工', th: 'ช่างหลังคา' },
        ceiling: { zh: '吊顶工', th: 'ช่างฝ้าเพดาน' }, aluminum: { zh: '铝门窗/玻璃工', th: 'ช่างอลูมิเนียมและกระจก' }, aircon: { zh: '空调工', th: 'ช่างแอร์' },
        welder: { zh: '焊工/铁工', th: 'ช่างเชื่อม' }, pool: { zh: '泳池工', th: 'ช่างสระว่ายน้ำ' }, landscape: { zh: '园林工', th: 'ช่างจัดสวน' }
    };
    const tradeName = k => (k === '*' ? '什么都能帮 ช่วยได้ทุกงาน' : TRADES[k] ? `${TRADES[k].zh} ${TRADES[k].th}` : k);

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
                const d = overlay('现在还不能开始 ยังเริ่มงานไม่ได้',
                    `<div class="sb-note">${esc(info.task || '')}<br>还有这些条件没满足 เงื่อนไขที่ยังไม่ครบ：<ul class="sb-list">${reasons}</ul></div>` +
                    `<div class="sb-field"><label>如果现场确实要提前开始，请写明原因 ถ้าจำเป็นต้องเริ่มก่อน กรุณาระบุเหตุผล *</label>` +
                    `<textarea id="sb-force-reason" rows="3" placeholder="例如：业主要求提前交付，已和监理确认"></textarea>` +
                    `<div class="hint">提前开始会记录你的名字和原因，并通知你的上级和老板 ระบบจะบันทึกชื่อและเหตุผล และแจ้งหัวหน้ากับเจ้าของ</div></div>`,
                    `<button class="sb-btn" data-cancel>先不开始 ยกเลิก</button><button class="sb-btn warn" data-ok>仍要提前开始 เริ่มก่อน</button>`, true);
                d.q('[data-cancel]').onclick = () => { d.close(); resolve(null); };
                d.q('[data-x]').onclick = () => { d.close(); resolve(null); };
                d.q('[data-ok]').onclick = () => {
                    const v = d.q('#sb-force-reason').value.trim();
                    if (!v) { toast('请先写明原因 กรุณาระบุเหตุผล', 'error'); return; }
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
                    if (!reason) { const c = new Error('已取消 ยกเลิก'); c.cancelled = true; throw c; }
                    const r = await orig.call(holder, id, Object.assign({}, data, { force_reason: reason }));
                    toast('已提前开始，并通知了上级和老板 เริ่มก่อนแล้ว และแจ้งหัวหน้ากับเจ้าของแล้ว', 'warning');
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
                : '<div class="sb-empty">暂无通知 ไม่มีการแจ้งเตือน</div>';
            const d = overlay('通知 การแจ้งเตือน', body, items.length ? '<button class="sb-btn" data-all>全部标为已读 อ่านทั้งหมด</button>' : '');
            const b = d.q('[data-all]');
            if (b) b.onclick = async () => { await call('POST', '/notifications/read-all'); d.close(); SiteNotify.refreshCount(); };
        }
    };

    // ================= 团队名册 =================
    // 泰国现场不分细工种，只分这 7 大类（对应后端 COARSE）
    const COARSE = [
        { k: 'rebar', d: '钢筋绑扎' },
        { k: 'carpenter', d: '模板、橱柜、木地板' },
        { k: 'scaffold', d: '脚手架' },
        { k: 'concrete', d: '混凝土浇筑' },
        { k: 'mason', d: '砌墙、抹灰、找平' },
        { k: 'tiler', d: '墙砖、地砖、石材' },
        { k: 'waterproof', d: '防水' },
        { k: 'plumber', d: '给排水、洁具' },
        { k: 'electrician', d: '强弱电、灯具开关' },
        { k: 'painter', d: '腻子、刷漆' },
        { k: 'ceiling', d: '龙骨、石膏板吊顶' },
        { k: 'installer', d: '室内门、楼梯栏杆' },
        { k: 'aluminum', d: '铝合金门窗、玻璃' },
        { k: 'aircon', d: '空调安装' },
        { k: 'welder', d: '屋架、钢结构、栏杆' },
        { k: 'roof', d: '铁皮、瓦屋面' },
        { k: 'mach', d: '挖机、吊车' },
        { k: 'pool', d: '泳池' },
        { k: 'landscape', d: '园林景观' }
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
                : '<div class="sb-empty">还没有班组。点下面的「添加班组」开始。<br>ยังไม่มีทีม กดเพิ่มทีมด้านล่าง</div>';
            const d = overlay('施工团队 ทีมงานก่อสร้าง',
                `<div class="sb-note">只需要填：班组名称、大工和普工各几个人、<b>几个大工会干什么</b>。系统会按这个自动分小组。<br>ช่างฝีมือคือหัวหน้างาน ผู้ช่วยคือคนงานทั่วไป</div>` +
                `<div class="sb-sub" style="margin-bottom:10px"><b>共 ${crews.length} 个班组 · 大工 ${tot.skilled} 人 · 普工 ${tot.helper} 人</b></div>${rows}`,
                isManager() ? '<button class="sb-btn primary" data-add>+ 添加班组 เพิ่มทีม</button>' : '');
            const reload = () => { d.close(); SiteTeam.open(projectId); if (window.SiteBoard && ProjectDetail.currentView === 'site') SiteBoard.refresh(); };
            const add = d.q('[data-add]'); if (add) add.onclick = () => SiteTeam.form(projectId, null, reload);
            d.qa('[data-edit]').forEach(b => b.onclick = () => SiteTeam.form(projectId, crews.find(c => String(c.id) === b.dataset.edit), reload));
            d.qa('[data-del]').forEach(b => b.onclick = async () => {
                if (!confirm('确认删除这个班组？ ยืนยันลบทีมนี้')) return;
                try { await call('DELETE', `/crews/${b.dataset.del}`); reload(); } catch (e) { toast(e.message, 'error'); }
            });
        },
        form(projectId, c, done) {
            const sc = (c && c.skill_counts) || {};
            const rows = COARSE.map(x =>
                `<div class="sb-skill-row"><div class="sb-skill-name"><b>${esc(x.zh)}</b> <span class="sb-sub">${esc(x.th)}</span><div class="sb-sub">${esc(x.d)}</div></div>` +
                `<div class="sb-skill-num"><input type="number" min="0" max="100" data-skill="${x.k}" value="${sc[x.k] || 0}"> 人</div></div>`).join('');
            const d = overlay(c ? '编辑班组 แก้ไขทีม' : '添加班组 เพิ่มทีม',
                `<div class="sb-field" style="margin-bottom:12px"><label>班组名称 ชื่อทีม *</label><input type="text" id="cr-name" placeholder="例如：A 班组、泥水班" value="${esc(c ? c.name : '')}"></div>` +
                `<div class="sb-grid" style="margin-bottom:12px">` +
                `<div class="sb-field"><label>大工共几个人 ช่างฝีมือ (คน)</label><input type="number" id="cr-skilled" min="0" max="100" value="${c ? c.skilled_count : 1}"></div>` +
                `<div class="sb-field"><label>普工共几个人 ผู้ช่วย (คน)</label><input type="number" id="cr-helper" min="0" max="300" value="${c ? c.helper_count : 2}"></div></div>` +
                `<div class="sb-field"><label>这些大工里，几个人会干什么？ ช่างฝีมือทำงานอะไรได้กี่คน</label>` +
                `<div class="sb-sub" style="margin:2px 0 8px">不会的填 0。一个人可以会好几样，所以各项加起来可以比大工总数多。</div><div class="sb-skill-grid">${rows}</div></div>`,
                '<button class="sb-btn" data-cancel>取消 ยกเลิก</button><button class="sb-btn primary" data-ok>保存 บันทึก</button>');
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
                if (!body.name) { toast('请填写班组名称 กรุณากรอกชื่อทีม', 'error'); return; }
                if (body.skilled_count + body.helper_count < 1) { toast('班组至少要有 1 个人', 'error'); return; }
                if (body.skilled_count > 0 && !Object.keys(skill_counts).length) { toast('请填写有几个大工会干什么 กรุณาระบุงานที่ทำได้', 'error'); return; }
                if (Object.values(skill_counts).some(n => n > body.skilled_count)) { toast('某项的人数不能比大工总数多 จำนวนเกินช่างฝีมือทั้งหมด', 'error'); return; }
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
        { t: '建筑概况 ข้อมูลอาคาร', f: [
            { k: 'floors', type: 'num', l: '地上几层 กี่ชั้น (ไม่รวมใต้ดิน)', min: 1, max: 10 },
            { k: 'units', type: 'num', l: '一共几套（联排/多户整排一起盖时填，单栋填 1）จำนวนยูนิต', min: 1, max: 100 },
            { k: 'total_area', type: 'num', l: '总建筑面积 พื้นที่รวม (ตร.ม.) — 多套时填整排合计', min: 0 },
            { k: 'attic', type: 'chk', l: '有阁楼或夹层 มีห้องใต้หลังคา' },
            { k: 'basement', type: 'chk', l: '有地下室 มีชั้นใต้ดิน' },
            { k: 'roof', type: 'sel', l: '屋面形式 รูปแบบหลังคา', o: OPT([['flat', '平屋面 ดาดฟ้า'], ['pitched', '坡屋面 หลังคาลาด'], ['both', '两种都有 มีทั้งสอง']]) },
            { k: 'roof_insulation', type: 'chk', l: '屋面做保温隔热 มีฉนวนกันความร้อน' },
            { k: 'stairs', type: 'num', l: '室内楼梯几部 บันไดภายในกี่ชุด', min: 0 },
            { k: 'balconies', type: 'num', l: '阳台/露台共几个 ระเบียง/ดาดฟ้า', min: 0 }
        ] },
        { t: '房间 ห้อง', f: [
            { k: 'bathrooms', type: 'num', l: '每层卫生间数（各层相同时）ห้องน้ำต่อชั้น', min: 0 },
            { k: 'bathrooms_by_floor', type: 'list', l: '各层卫生间数（各层不同时填，逗号分隔，如 0,2,2）', hint: '填了这一项，上面的“每层卫生间数”就不起作用 · ต้องมีจำนวนเท่ากับจำนวนชั้น' },
            { k: 'kitchens', type: 'num', l: '厨房个数 จำนวนครัว', min: 0 },
            { k: 'kitchen_floors', type: 'list', l: '厨房在哪几层（逗号分隔，默认 1 层）ครัวอยู่ชั้นไหน' }
        ] },
        { t: '装修标准 การตกแต่ง', f: [
            { k: 'floor_finish', type: 'sel', l: '客厅/卧室地面 พื้นห้องนั่งเล่น/ห้องนอน', o: OPT([['tile', '地砖 กระเบื้อง'], ['wood', '木地板 ไม้'], ['stone', '石材 หิน']]) },
            { k: 'wall_finish', type: 'sel', l: '墙面 ผนัง', o: OPT([['paint', '乳胶漆 สีน้ำ'], ['wallpaper', '墙纸 วอลเปเปอร์'], ['mixed', '漆+局部墙纸 สีและวอลเปเปอร์']]) },
            { k: 'ceiling', type: 'sel', l: '吊顶 ฝ้าเพดาน', o: OPT([['none', '无 ไม่มี'], ['gypsum', '石膏板 ยิปซัม'], ['aluminum_wet', '厨卫铝扣板+其他石膏板 อลูมิเนียมในห้องน้ำ/ครัว']]) },
            { k: 'cabinet', type: 'chk', l: '厨房橱柜和台面 ตู้ครัวและท็อป' },
            { k: 'shower_room', type: 'chk', l: '淋浴房 ห้องอาบน้ำกระจก' },
            { k: 'fixed_furniture', type: 'chk', l: '固定家具/衣柜 เฟอร์นิเจอร์บิลท์อิน' }
        ] },
        { t: '外立面 ภายนอกอาคาร', f: [
            { k: 'exterior_finish', type: 'sel', l: '外墙做法 ผนังภายนอก', o: OPT([['paint', '涂料 สี'], ['tile', '外墙砖 กระเบื้อง'], ['stone', '石材 หิน'], ['mixed', '混合 ผสม']]) },
            { k: 'exterior_insulation', type: 'chk', l: '外墙保温 ฉนวนผนังภายนอก' }
        ] },
        { t: '机电设备 ระบบ', f: [
            { k: 'aircon', type: 'sel', l: '空调 แอร์', o: OPT([['none', '无 ไม่มี'], ['split', '分体 แยกส่วน'], ['central', '中央 ระบบรวม']]) },
            { k: 'hot_water', type: 'sel', l: '热水 น้ำร้อน', o: OPT([['none', '无 ไม่มี'], ['electric', '电热水器 ไฟฟ้า'], ['solar', '太阳能 โซลาร์'], ['heatpump', '热泵 ฮีทปั๊ม']]) },
            { k: 'water_supply', type: 'sel', l: '供水 การจ่ายน้ำ', o: OPT([['direct', '市政直供 ประปาตรง'], ['tank', '需水箱水泵 ถังน้ำและปั๊ม']]) },
            { k: 'elevator', type: 'chk', l: '电梯 ลิฟต์' },
            { k: 'pool', type: 'chk', l: '泳池 สระว่ายน้ำ' }
        ] },
        { t: '室外 งานภายนอก', f: [
            { k: 'fence', type: 'chk', l: '围墙与大门 รั้วและประตู' },
            { k: 'road', type: 'chk', l: '道路与铺装 ถนนและพื้น' },
            { k: 'landscape', type: 'chk', l: '庭院景观绿化 จัดสวน' },
            { k: 'sewage', type: 'sel', l: '污水处理 การบำบัดน้ำเสีย', o: OPT([['septic', '化粪池 ถังบำบัด'], ['municipal', '接市政 ต่อท่อสาธารณะ']]) }
        ] },
        { t: '技术项（工程师填，不确定就用默认）ข้อมูลเทคนิค', f: [
            { k: 'foundation', type: 'sel', l: '基础类型 ประเภทฐานราก', o: OPT([['isolated', '独立基础 ฐานแผ่เดี่ยว'], ['strip', '条形基础 ฐานแถบ'], ['raft', '筏板基础 ฐานแผ่'], ['pile', '桩基 เสาเข็ม']]) },
            { k: 'soft_soil', type: 'chk', l: '软弱地基需处理 ดินอ่อนต้องปรับปรุง' },
            { k: 'high_water', type: 'chk', l: '地下水位高 ระดับน้ำใต้ดินสูง' },
            { k: 'masonry', type: 'sel', l: '砌体材料 วัสดุก่อ', o: OPT([['brick', '红砖 อิฐแดง'], ['aac', '加气块 อิฐมวลเบา']]) },
            { k: 'concrete_supply', type: 'sel', l: '混凝土供应 การจัดหาคอนกรีต', o: OPT([['ready', '预拌 ผสมเสร็จ'], ['site', '现场搅拌 ผสมหน้างาน']]) }
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
            const body = `<div class="sb-note">客户回答这些问题，系统就会自动选出需要的工序、按楼层展开，并排好先后顺序。不需要手动选工序。<br>กรอกข้อมูลนี้ ระบบจะเลือกงาน แบ่งตามชั้น และเรียงลำดับให้อัตโนมัติ</div>` +
                (r.data.planGeneratedAt ? `<div class="sb-sub" style="margin-bottom:8px">上次生成工序：${esc(r.data.planGeneratedAt)}</div>` : '') +
                FORM.map(s => `<div class="sb-form-sec"><h4>${s.t}</h4><div class="sb-grid">${s.f.map(f => fieldHtml(f, data[f.k])).join('')}</div></div>`).join('');
            const d = overlay('项目申请表 แบบฟอร์มโครงการ', body,
                '<button class="sb-btn" data-save>只保存 บันทึก</button><button class="sb-btn primary" data-preview>预览并生成工序 ดูตัวอย่างและสร้างงาน</button>');
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
                try { busy(true); await call('PUT', `/projects/${projectId}/profile`, { answers: read() }); toast('申请表已保存 บันทึกแล้ว'); }
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
            const d = overlay('确认生成工序 ยืนยันการสร้างงาน', body,
                '<button class="sb-btn" data-back>返回修改 กลับไปแก้ไข</button><button class="sb-btn primary" data-go>确认生成 สร้างงาน</button>', true);
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
                    toast(`已生成：新增 ${r.data.added} 个，移除 ${r.data.removed} 个 สร้างเรียบร้อย`);
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
    const STATUS_TAG = {
        waiting_material: '<span class="td-tag warn">等材料 รอวัสดุ</span>',
        weather_stop: '<span class="td-tag gray">天气停工 หยุดเพราะอากาศ</span>'
    };

    const SiteBoard = {
        projectId: null, date: null, data: null, assign: {}, legacyRows: null,

        async init(projectId) {
            this.projectId = projectId;
            const c = document.getElementById('site-board-container');
            c.innerHTML = '<div class="td-empty">加载中… กำลังโหลด</div>';
            await this.refresh();
        },

        async refresh() {
            const c = document.getElementById('site-board-container');
            if (!c) return;
            try {
                const r = await call('GET', `/projects/${this.projectId}/site-board` + (this.date ? `?date=${this.date}` : ''));
                this.data = r.data;
                this.legacyRows = null;
                if (r.data.planned) {
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
            return (this.assign[execId] || []).map(i => {
                const m = this.member(i);
                return `<span class="td-chip ${m && m.level === 'skilled' ? 'skilled' : ''}">${esc(m ? m.name : '#' + i)}${removable ? ` <a href="#" data-rm="${execId}:${i}" title="移除">✕</a>` : ''}</span>`;
            }).join('');
        },
        floorTag(x) { return x.floor != null ? `<span class="td-tag">${x.floor}层</span>` : ''; },

        // ---------- 页面 ----------
        head() {
            const d = this.data;
            const menu = `<details class="td-menu"><summary class="sb-btn">更多 ⋯</summary><div class="td-pop">` +
                (isManager() ? `<a href="#" data-menu="prepare">📝 项目准备 เตรียมโครงการ</a>` : '') +
                `<a href="#" data-menu="notify">🔔 通知 การแจ้งเตือน</a>` +
                `<a href="#" data-menu="refresh">🔄 刷新 รีเฟรช</a></div></details>`;
            return `<div class="td-head"><div><h2 class="td-title">今日现场 <small class="td-th">หน้างานวันนี้</small></h2>` +
                `<div class="td-date"><input type="date" id="td-date" value="${esc(this.date || '')}">` +
                (d && d.planned ? `<span class="td-sub">第 ${d.workingDay} 个工作日（周日休息）</span>` : '') + `</div></div>${menu}</div>`;
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
                (isManager() ? ` <button class="sb-btn primary small" data-menu="prepare">去「项目准备」填写申请表并生成 สร้างงานจากแบบฟอร์ม</button>` : '') + `</div>`;
            html += `<section class="td-sec"><h3>${bi('正在做', 'กำลังทำ')} <span class="td-count">${doing.length}</span></h3>` +
                (doing.length ? doing.map(x => this.cardDoing(x, false)).join('') : '<div class="td-empty">暂无</div>') + `</section>`;
            html += `<section class="td-sec"><h3>${bi('还没开始', 'ยังไม่เริ่ม')} <span class="td-count">${todo.length}</span></h3>` +
                (todo.length ? todo.slice(0, 30).map(x => this.cardReady(x, null, false)).join('') : '<div class="td-empty">暂无</div>') + `</section>`;
            return html;
        },

        renderPlanned() {
            const d = this.data;
            const doing = d.inProgress;
            const readyN = d.ready.length, waitN = d.blocked.length, hasTeam = d.team.length > 0;
            const here = d.team.length - d.absent.length;
            let html = `<div class="td-summary">` +
                `<div class="td-stat s-doing"><i>🔨</i><div><b>${doing.length}</b><span>${bi('正在做', 'กำลังทำ')}</span></div></div>` +
                `<div class="td-stat s-ready ${readyN ? 'hot' : ''}"><i>✅</i><div><b>${readyN}</b><span>${bi('现在能开工', 'เริ่มได้เลย')}</span></div></div>` +
                `<div class="td-stat s-wait"><i>⏳</i><div><b>${waitN}</b><span>${bi('在等前面的工序', 'รองานก่อนหน้า')}</span></div></div>` +
                `<div class="td-stat s-here"><i>👷</i><div><b>${hasTeam ? here + '/' + d.team.length : '—'}</b><span>${bi('今天到场', 'มาวันนี้')}</span></div></div></div>` +
                `<div class="td-tip">系统只给建议，怎么安排由工头决定。<small class="td-th">ระบบแนะนำเท่านั้น หัวหน้าช่างตัดสินใจ</small></div>`;
            if (!hasTeam) {
                html = `<div class="td-banner"><b>项目准备未完成 · 请先录入施工团队</b><br>` +
                    `需要登记：班组名称、大工几个人和会干什么、普工几个人。录入后系统才能按人员安排工作和评估班组效率。<br>` +
                    `<span class="td-sub">ขั้นตอน: 1. ข้อมูลโครงการ ✓  2. ทีมงานและประเภทช่าง (ยังไม่ได้กรอก)  3. สร้างงาน ✓</span><br>` +
                    (isManager() ? `<button class="sb-btn primary" style="margin-top:8px" data-menu="prepare">去「项目准备」录入团队 กรอกทีมงาน</button>` : '请联系管理者录入施工团队') + `</div>` + html;
            }
            d.warnings.forEach(w => { html += `<div class="td-warn">⚠ ${esc(w.zh)}</div>`; });

            // ① 出勤登记
            html += `<section class="td-sec"><h3><span class="td-num">1</span>${bi('出勤登记', 'บันทึกการเข้างาน')}</h3>`;
            if (!hasTeam) {
                html += `<div class="td-empty">项目团队还没有录入，无法登记出勤和安排工作。</div>`;
            } else {
                const absent = new Set(d.absent);
                html += `<div class="td-sub" style="margin-bottom:6px">点一下名字，标记今天没来的人 · แตะชื่อเพื่อทำเครื่องหมายคนที่ไม่มา</div><div>` +
                    d.team.map(m => `<a href="#" class="td-chip big ${absent.has(m.id) ? 'off' : (m.level === 'skilled' ? 'skilled' : 'free')}" data-att="${m.id}">${esc(m.name)}${absent.has(m.id) ? ' · 没来' : ''}</a>`).join('') + `</div>`;
            }
            html += `</section>`;

            // ② 正在做
            html += `<section class="td-sec"><h3><span class="td-num">2</span>${bi('正在做的事', 'งานที่กำลังทำ')} <span class="td-count">${doing.length}</span></h3>` +
                (doing.length ? doing.map(x => this.cardDoing(x, true)).join('') : '<div class="td-empty">现在没有在做的任务</div>') + `</section>`;

            // ③ 现在能开工
            html += `<section class="td-sec"><h3><span class="td-num">3</span>${bi('现在可以开工', 'เริ่มงานได้ตอนนี้')} <span class="td-count">${readyN}</span></h3>` +
                (readyN ? d.ready.map(x => this.cardReady(x, d.suggestions.find(s => s.execId === x.execId), true)).join('')
                    : '<div class="td-empty">现在没有新的任务可以开工，多半在等前面的工序或混凝土养护。<br>下面“快要能开始”里可以提前做准备。</div>') + `</section>`;

            // ④ 快要能开始 / ⑤ 其他在等
            const doingKeys = new Set(doing.map(x => x.key));
            const near = d.blocked.filter(b => b.reasons.every(r => (r.type === 'lag' && r.daysLeft <= 5) || ((r.type === 'pred_not_finished' || r.type === 'ss_progress') && doingKeys.has(r.pred))));
            near.sort((a, b) => a.reasons.length - b.reasons.length || a.key.localeCompare(b.key));
            const nearTop = near.slice(0, 8), nearSet = new Set(nearTop.map(x => x.key));
            if (nearTop.length) {
                html += `<section class="td-sec"><h3><span class="td-num">4</span>${bi('快要能开始', 'ใกล้เริ่มได้')} <span class="td-count">${nearTop.length}</span></h3>` +
                    nearTop.map(x => this.rowWaiting(x)).join('') + `</section>`;
            }

            const rest = d.blocked.filter(b => !nearSet.has(b.key));
            if (rest.length) {
                const groups = {};
                rest.forEach(x => { const k = x.floor != null ? x.floor + '层' : '整栋'; (groups[k] = groups[k] || []).push(x); });
                const names = Object.keys(groups).sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999));
                html += `<section class="td-sec"><details><summary class="td-sum"><span class="td-num">5</span>${bi('其他在等待的', 'งานอื่นที่รออยู่')} <span class="td-count">${rest.length} 项，点开看在等什么</span></summary>` +
                    names.map(n => `<details class="td-grp"><summary>${esc(n)} <span class="td-count">${groups[n].length} 项</span></summary>${groups[n].map(x => this.rowWaiting(x)).join('')}</details>`).join('') +
                    `</details></section>`;
            }
            if (d.idle.length) {
                html += `<section class="td-sec"><details><summary class="td-sum">${bi('空闲的人', 'คนที่ว่าง')} <span class="td-count">${d.idle.length} 人</span></summary>` +
                    d.idle.map(i => `<div class="td-row"><span class="td-chip free">${esc(i.name)}</span><span class="td-sub">${i.canBorrowTo.length ? '可去：' + i.canBorrowTo.map(esc).join('、') : '暂时没有合适的任务'}</span></div>`).join('') + `</details></section>`;
            }
            return html;
        },

        rowWaiting(x) {
            const why = x.reasons.slice(0, 2).map(r => esc(r.zh)).join('；') + (x.reasons.length > 2 ? ` 等 ${x.reasons.length} 项` : '');
            return `<div class="td-row wait"><div class="td-grow"><b>${nm(x)}</b> ${this.floorTag(x)}<div class="td-sub">${why}</div></div>` +
                `<a href="#" class="td-link" data-force="${x.execId}">提前开始…</a>` + `</div>`;
        },

        cardDoing(x, planned) {
            const pct = pctOf(x), paused = x.workStatus === 'waiting_material' || x.workStatus === 'weather_stop';
            const hasPeople = planned && (this.assign[x.execId] || []).length > 0;
            return `<div class="td-card doing ${paused ? 'paused' : ''}"><div class="td-top"><div class="td-grow"><b class="td-name">${nm(x)}</b> ${this.floorTag(x)} ${STATUS_TAG[x.workStatus] || ''}` +
                `${x.quantityMissing ? '<span class="td-tag warn">工程量未录入</span>' : ''}</div><div class="td-pct">${pct}%</div></div>` +
                `<div class="td-bar"><i style="width:${pct}%"></i></div>` +
                (planned ? `<div class="td-people">${hasPeople ? this.peopleChips(x.execId, true) : '<span class="td-sub">还没派人</span>'}</div>` : '') +
                `<div class="td-actions">` +
                (paused ? `<button class="sb-btn primary" data-resume="${x.execId}">恢复施工 ทำต่อ</button>`
                    : `<button class="sb-btn primary" data-prog="${x.execId}">记录进度 บันทึกความคืบหน้า</button>`) +
                (planned && !paused ? `<button class="sb-btn" data-pick="${x.execId}">派人 มอบหมาย</button>` : '') +
                `<button class="sb-btn" data-done="${x.execId}">完成 เสร็จ</button>` +
                `<details class="td-menu inline"><summary class="sb-btn">更多 ⋯</summary><div class="td-pop">` +
                (!paused ? `<a href="#" data-stat="waiting_material:${x.execId}">🟡 缺材料 ขาดวัสดุ</a><a href="#" data-stat="weather_stop:${x.execId}">⛅ 天气停工 หยุดเพราะอากาศ</a>` : '') +
                `<a href="#" data-qty="${x.execId}">📐 录入工程量 ใส่ปริมาณงาน</a>` +
                `<a href="#" data-subtasks="${x.execId}">📑 子任务 งานย่อย</a>` +
                `<a href="#" data-hist="${x.execId}">📊 进度历史 ประวัติ</a></div></details>` +
                `</div></div>`;
        },

        cardReady(x, sug, planned) {
            const why = sug ? sug.reasons.filter(r => !/^已经开工/.test(r)).slice(0, 1).map(esc).join('') : (x.unlocks > 0 ? `做完后可以解锁 ${x.unlocks} 个任务` : '');
            return `<div class="td-card ready"><div class="td-top"><div class="td-grow"><b class="td-name">${nm(x)}</b> ${this.floorTag(x)}` +
                `${x.quantityMissing ? '<span class="td-tag warn">工程量未录入</span>' : ''}</div></div>` +
                (sug ? `<div class="td-suggest">💡 建议派：${sug.members.map(m => `<span class="td-chip ${m.level === 'skilled' ? 'skilled' : ''}">${esc(m.name)}</span>`).join('')}<span class="td-sub">（${sug.crews} 组）</span></div>` : '') +
                (why ? `<div class="td-sub">${why}</div>` : '') +
                `<div class="td-actions">` +
                (sug && planned ? `<button class="sb-btn primary" data-go="${x.execId}">按建议开工 เริ่มตามคำแนะนำ</button><button class="sb-btn" data-start="${x.execId}">只开始，不派人</button>`
                    : `<button class="sb-btn primary" data-start="${x.execId}">开始 เริ่ม</button>`) +
                (planned ? `<button class="sb-btn" data-pick="${x.execId}">自己选人 เลือกเอง</button>` : '') +
                `</div></div>`;
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
                else if (k === 'overrides') this.showOverrides(pid);
                else if (k === 'notify') SiteNotify.open(pid);
                else this.refresh();
            });
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
            await this.run(() => call('PUT', `/projects/${this.projectId}/site-assignments`, { date: this.date, assignments: payload }), '已保存 บันทึกแล้ว');
        },
        pickPeople(execId) {
            const d = this.data, used = this.usedIds(), cur = new Set(this.assign[execId] || []), absent = new Set(d.absent);
            if (!d.team.length) { toast('请先添加团队成员 กรุณาเพิ่มสมาชิกทีม', 'error'); return; }
            const opts = d.team.map(m => {
                const taken = used.has(m.id) && !cur.has(m.id), off = absent.has(m.id);
                return `<label class="td-pickrow"><input type="checkbox" value="${m.id}" ${cur.has(m.id) ? 'checked' : ''} ${taken || off ? 'disabled' : ''}> <b>${esc(m.name)}</b> ` +
                    `<span class="td-tag">${m.level === 'skilled' ? '技工' : '普工'}</span> <span class="td-sub">${esc(m.skills.map(s => (TRADES[s] ? TRADES[s].zh : '什么都能帮')).join('、'))}</span>` +
                    `${taken ? ' <span class="td-tag gray">已派到别处</span>' : ''}${off ? ' <span class="td-tag warn">今天没来</span>' : ''}</label>`;
            }).join('');
            const dlg = overlay('选择人员 เลือกคนงาน', opts, '<button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-ok>确定 ตกลง</button>', true);
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = () => {
                const ids = dlg.qa('input[type=checkbox]:checked').map(x => Number(x.value));
                if (ids.length) this.assign[execId] = ids; else delete this.assign[execId];
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
                        toast('已提前开始，并通知了上级和老板 เริ่มก่อนแล้ว แจ้งหัวหน้ากับเจ้าของแล้ว', 'warning');
                    } else throw e;
                }
            }, '已开始 เริ่มแล้ว');
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
            }, '已开工并派人 เริ่มงานและมอบหมายแล้ว');
        },
        async forceStart(execId) {
            const x = this.data.blocked.find(b => b.execId === execId);
            const reason = await SiteStart.askReason({ task: x.label, reasons: x.reasons });
            if (!reason) return;
            await this.run(async () => {
                const r = await SiteStart.start(execId, reason);
                toast('已提前开始，并通知了上级和老板 เริ่มก่อนแล้ว แจ้งหัวหน้ากับเจ้าของแล้ว', 'warning');
                if (r.data.override) alert('提前开始已记录\n风险等级：' + { high: '高', medium: '中', low: '低' }[r.data.override.severity]);
            });
        },

        progressDialog(execId) {
            const x = this.findItem(execId); if (!x) return;
            const cur = pctOf(x), hasQty = x.plannedQuantity > 0;
            const body = `<div class="sb-note">${nm(x)}：目前完成 ${cur}%</div>` +
                (hasQty ? `<div class="sb-field" style="margin-bottom:10px"><label>怎么记？ จะบันทึกแบบไหน</label><select id="pg-mode"><option value="pct">直接填现在完成了百分之几</option><option value="qty">填今天完成了多少（${esc(x.unit || '')}）</option></select></div>` : '') +
                `<div class="sb-field" id="pg-pct-box" style="margin-bottom:10px"><label>现在一共完成了百分之几 (0–100) *</label><input type="number" id="pg-pct" min="0" max="100" value="${cur}"></div>` +
                (hasQty ? `<div class="sb-field" id="pg-qty-box" style="margin-bottom:10px;display:none"><label>今天完成的数量 (${esc(x.unit || '')}，计划总量 ${x.plannedQuantity}) *</label><input type="number" id="pg-qty" min="0" step="0.01"></div>` : '') +
                `<div class="sb-field"><label>备注 หมายเหตุ（可不填）</label><textarea id="pg-note" rows="2"></textarea></div>`;
            const dlg = overlay('记录进度 บันทึกความคืบหน้า', body, '<button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-ok>保存 บันทึก</button>', true);
            const mode = dlg.q('#pg-mode');
            if (mode) mode.onchange = () => { const q = mode.value === 'qty'; dlg.q('#pg-pct-box').style.display = q ? 'none' : ''; dlg.q('#pg-qty-box').style.display = q ? '' : 'none'; };
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = async () => {
                const note = dlg.q('#pg-note').value.trim();
                const byQty = mode && mode.value === 'qty';
                try {
                    busy(true);
                    if (byQty) {
                        const q = parseFloat(dlg.q('#pg-qty').value);
                        if (!(q > 0)) { toast('请填写大于 0 的数量', 'error'); busy(false); return; }
                        await call('POST', '/daily-progress', { process_execution_id: execId, quantity_completed: q, unit: x.unit, work_status: 'normal', notes: note ? { zh: note, th: note } : null });
                    } else {
                        const p = parseFloat(dlg.q('#pg-pct').value);
                        if (!(p >= 0 && p <= 100)) { toast('百分比要在 0 到 100 之间', 'error'); busy(false); return; }
                        const body = { completion_percentage: p };
                        if (p >= 100) { body.status = 'completed'; body.actual_end_date = this.date || new Date().toISOString().slice(0, 10); }
                        if (note) body.notes = { zh: note, th: note };
                        await call('PUT', `/processes/${execId}`, body);
                    }
                    dlg.close(); toast('进度已记录 บันทึกแล้ว'); await this.refresh();
                } catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            };
        },
        async complete(execId) {
            const x = this.findItem(execId);
            if (!confirm(`确认「${x ? x.label : ''}」已经全部完成？ ยืนยันว่างานเสร็จสมบูรณ์`)) return;
            await this.run(() => call('PUT', `/processes/${execId}`, { status: 'completed', completion_percentage: 100, actual_end_date: this.date || new Date().toISOString().slice(0, 10) }), '已完成 เสร็จแล้ว');
        },
        async setStatus(execId, status) {
            let note = '';
            if (status === 'waiting_material') {
                const dlg = await new Promise(resolve => {
                    const d = overlay('缺什么材料？ ขาดวัสดุอะไร', '<div class="sb-field"><label>请写明缺的材料 *</label><input type="text" id="ws-note" placeholder="例如：水泥、PVC线管"></div>',
                        '<button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-ok>确定</button>', true);
                    d.q('[data-cancel]').onclick = () => { d.close(); resolve(null); };
                    d.q('[data-x]').onclick = () => { d.close(); resolve(null); };
                    d.q('[data-ok]').onclick = () => { const v = d.q('#ws-note').value.trim(); if (!v) { toast('请写明缺什么材料', 'error'); return; } d.close(); resolve(v); };
                });
                if (dlg == null) return;
                note = dlg;
            }
            const ok = { waiting_material: '已标记缺材料，这几天不算班组的责任 บันทึกแล้ว', weather_stop: '已标记天气停工 บันทึกแล้ว', in_progress: '已恢复施工 ทำต่อแล้ว' }[status];
            await this.run(() => call('POST', `/processes/${execId}/work-status`, { status, note }), ok);
        },
        quantityDialog(execId) {
            const x = this.findItem(execId); if (!x) return;
            const dlg = overlay('录入工程量 ใส่ปริมาณงาน', `<div class="sb-note">${nm(x)}</div>` +
                `<div class="sb-grid"><div class="sb-field"><label>计划总量 *</label><input type="number" id="qd-q" min="0" step="0.01" value="${x.plannedQuantity || ''}"></div>` +
                `<div class="sb-field"><label>单位</label><input type="text" id="qd-u" value="${esc(x.unit || '')}"></div></div>` +
                `<div class="hint" style="margin-top:6px;font-size:12px;color:#94a3b8">录入后，才能按数量记录每天完成多少，也才能准确估算工期。</div>`,
                '<button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-ok>保存</button>', true);
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = async () => {
                const q = parseFloat(dlg.q('#qd-q').value);
                if (!(q > 0)) { toast('请填写大于 0 的数量', 'error'); return; }
                try { busy(true); await call('PUT', `/process-execution/${execId}/plan`, { planned_quantity: q, quantity_unit: dlg.q('#qd-u').value.trim() }); dlg.close(); toast('已保存'); await this.refresh(); }
                catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            };
        },
        async history(execId) {
            try {
                busy(true);
                const r = await call('GET', `/process-execution/${execId}/progress-history`);
                busy(false);
                const rows = r.data || [];
                const st = { normal: '正常', waiting_material: '等材料', weather_stop: '天气停工', problem: '其他问题' };
                const noteOf = n => { try { const o = typeof n === 'string' ? JSON.parse(n) : n; return (o && (o.zh || o.th)) || ''; } catch (_) { return String(n || ''); } };
                overlay('进度历史 ประวัติ', rows.length ? `<table style="width:100%;font-size:13px;border-collapse:collapse"><tr style="text-align:left;color:#64748b"><th>日期</th><th>完成量</th><th>累计</th><th>%</th><th>状态</th><th>备注</th></tr>` +
                    rows.map(h => `<tr style="border-top:1px solid #f1f5f9"><td>${esc(String(h.date).slice(0, 10))}</td><td>${esc(h.quantity_completed)} ${esc(h.unit || '')}</td><td>${esc(h.total_completed)}</td><td>${Math.round(h.completion_percentage)}</td><td>${esc(st[h.work_status] || h.work_status || '')}</td><td>${esc(noteOf(h.notes))}</td></tr>`).join('') + '</table>'
                    : '<div class="td-empty">还没有按数量记录过进度</div>');
            } catch (e) { busy(false); toast(e.message, 'error'); }
        },

        async showOverrides(projectId) {
            const r = await call('GET', `/projects/${projectId}/overrides`);
            const sev = { high: '高', medium: '中', low: '低' };
            const body = r.data.length ? r.data.map(o =>
                `<div class="sb-noti"><div class="sb-title">${esc(getI18nField({ process_name: o.process_name }, 'process_name'))} <span class="sb-sev-${o.severity}">风险${sev[o.severity]}</span></div>` +
                `<div class="sb-sub">${esc(o.created_at)} · ${esc(o.decided_by_name || '')}</div><pre>原因：${esc(o.reason)}\n未满足：${(o.unmet || []).map(u => esc(u.zh)).join('；')}</pre></div>`).join('')
                : '<div class="sb-empty">还没有提前开始的记录 ยังไม่มีบันทึกการเริ่มก่อน</div>';
            overlay('提前开始记录 บันทึกการเริ่มก่อนกำหนด', body);
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
            const d = overlay('导入工程量清单 นำเข้า BOQ',
                `<div class="sb-note">选择报价单/工程量清单的 Excel 文件（.xlsx）。系统会把每一行对应到工序，先给你看对照表，你确认后才会写入。<br>` +
                `Word 或 PDF 的清单，请先另存为 Excel。系统只写入各工序的「计划数量」，不会改动别的数据。</div>` +
                `<div class="sb-field"><input type="file" id="boq-file" accept=".xlsx"></div><div id="boq-result"></div>`,
                `<button class="sb-btn primary" data-preview>读取并预览 ดูตัวอย่าง</button>`);
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
            foot.innerHTML = '<button class="sb-btn primary" data-apply>确认导入选中的工序 นำเข้า</button>';
            foot.querySelector('[data-apply]').onclick = async () => {
                const skip = d.qa('[data-sel]').filter(c => !c.checked).map(c => c.dataset.sel);
                try {
                    busy(true);
                    const out = await SiteBoq.post(projectId, 'apply', file, { skip: JSON.stringify(skip) });
                    busy(false);
                    d.close();
                    toast(`已写入 ${out.written} 道工序的计划数量 บันทึกปริมาณแล้ว`);
                    if (window.SiteBoard && window.ProjectDetail && ProjectDetail.currentView === 'site') SiteBoard.refresh();
                } catch (e) { busy(false); toast(e.message, 'error'); }
            };
        }
    };

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
