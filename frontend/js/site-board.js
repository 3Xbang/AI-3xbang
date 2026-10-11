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
        general: { zh: '普工/杂工', th: 'คนงานทั่วไป' }, roof: { zh: '屋面工', th: 'ช่างหลังคา' }
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
            return call('POST', `/processes/${execId}/start`, force ? { force_reason: force } : {});
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
    const SiteTeam = {
        async open(projectId) {
            const r = await call('GET', `/projects/${projectId}/team`);
            const members = r.data.members, cap = r.data.crewCapacity || {};
            const capHtml = Object.keys(cap).length
                ? Object.keys(cap).map(k => `<span class="sb-chip">${esc(tradeName(k))} 最多 ${cap[k]} 组</span>`).join('')
                : '<span class="sb-sub">还没有够组成一个班组的人 ยังไม่มีคนพอจะตั้งทีม</span>';
            const rows = members.length ? members.map(m =>
                `<div class="sb-member-row"><div class="sb-grow"><b>${esc(m.name)}</b> <span class="sb-chip ${m.level === 'skilled' ? 'skilled' : ''}">${m.level === 'skilled' ? '技工 ช่างฝีมือ' : '普工 ผู้ช่วย'}</span>` +
                `<div class="sb-sub">${m.skills.map(s => esc(tradeName(s))).join('、') || '未设置工种'}</div></div>` +
                (isManager() ? `<button class="sb-btn small" data-edit="${m.id}">编辑</button><button class="sb-btn small" data-del="${m.id}">移除</button>` : '') + `</div>`).join('')
                : '<div class="sb-empty">还没有团队成员。请先添加，看板才能给你派人建议。<br>ยังไม่มีสมาชิก กรุณาเพิ่มก่อน</div>';
            const d = overlay('项目团队 ทีมงานโครงการ',
                `<div class="sb-note">技工带班，一个技工可以会多个工种（同一天只能在一个任务上）；普工打下手。<br>ช่างฝีมือนำทีม คนหนึ่งทำได้หลายงาน (แต่วันเดียวทำได้งานเดียว) ผู้ช่วยช่วยงาน</div>` +
                `<div class="sb-sub" style="margin-bottom:8px">共 ${members.length} 人，按名册估算各工种最多能组的班组（多能工是共享的，所以是上限）：</div><div style="margin-bottom:10px">${capHtml}</div>${rows}`,
                isManager() ? '<button class="sb-btn primary" data-add>+ 添加成员 เพิ่มสมาชิก</button>' : '');
            const reload = () => { d.close(); SiteTeam.open(projectId); if (window.SiteBoard && ProjectDetail.currentView === 'site') SiteBoard.refresh(); };
            const add = d.q('[data-add]'); if (add) add.onclick = () => SiteTeam.form(projectId, null, reload);
            d.qa('[data-edit]').forEach(b => b.onclick = () => SiteTeam.form(projectId, members.find(m => String(m.id) === b.dataset.edit), reload));
            d.qa('[data-del]').forEach(b => b.onclick = async () => {
                if (!confirm('确认移除这位成员？ ยืนยันลบสมาชิก')) return;
                await call('DELETE', `/team/${b.dataset.del}`); reload();
            });
        },
        form(projectId, m, done) {
            const skills = m ? m.skills : [];
            const boxes = Object.keys(TRADES).map(k =>
                `<label><input type="checkbox" name="skill" value="${k}" ${skills.includes(k) ? 'checked' : ''}> ${esc(TRADES[k].zh)} ${esc(TRADES[k].th)}</label>`).join('');
            const d = overlay(m ? '编辑成员 แก้ไขสมาชิก' : '添加成员 เพิ่มสมาชิก',
                `<div class="sb-field" style="margin-bottom:10px"><label>姓名 ชื่อ *</label><input type="text" id="tm-name" value="${esc(m ? m.name : '')}"></div>` +
                `<div class="sb-field" style="margin-bottom:10px"><label>级别 ระดับ</label><select id="tm-level"><option value="skilled">技工（能带班）ช่างฝีมือ</option><option value="helper">普工（打下手）ผู้ช่วย</option></select></div>` +
                `<div class="sb-field" style="margin-bottom:10px"><label id="tm-skill-label">会什么工种（可多选）ทำงานอะไรได้บ้าง</label>` +
                `<div class="sb-skill-box" id="tm-skills">${boxes}</div>` +
                `<label class="sb-field check" style="margin-top:6px"><span id="tm-any-wrap"><input type="checkbox" id="tm-any" ${skills.includes('*') ? 'checked' : ''}> 普工：什么工种都能帮 ช่วยได้ทุกงาน</span></label></div>` +
                `<div class="sb-grid"><div class="sb-field"><label>电话 โทร</label><input type="text" id="tm-phone" value="${esc(m && m.phone ? m.phone : '')}"></div>` +
                `<div class="sb-field"><label>日薪 ค่าแรงต่อวัน</label><input type="number" id="tm-wage" value="${esc(m && m.daily_wage ? m.daily_wage : '')}"></div></div>`,
                '<button class="sb-btn" data-cancel>取消 ยกเลิก</button><button class="sb-btn primary" data-ok>保存 บันทึก</button>', true);
            d.q('#tm-level').value = m ? m.level : 'skilled';
            const sync = () => {
                const helper = d.q('#tm-level').value === 'helper';
                d.q('#tm-any-wrap').parentElement.style.display = helper ? '' : 'none';
            };
            d.q('#tm-level').onchange = sync; sync();
            d.q('[data-cancel]').onclick = d.close;
            d.q('[data-ok]').onclick = async () => {
                const level = d.q('#tm-level').value;
                let sk = d.qa('input[name=skill]:checked').map(x => x.value);
                if (level === 'helper' && d.q('#tm-any').checked) sk = ['*'];
                const body = { name: d.q('#tm-name').value.trim(), level, skills: sk, phone: d.q('#tm-phone').value.trim(), daily_wage: d.q('#tm-wage').value };
                if (!body.name) { toast('请填写姓名 กรุณากรอกชื่อ', 'error'); return; }
                if (level === 'skilled' && !sk.length) { toast('技工至少选一个工种 เลือกอย่างน้อย 1 งาน', 'error'); return; }
                try {
                    busy(true);
                    if (m) await call('PUT', `/team/${m.id}`, body); else await call('POST', `/projects/${projectId}/team`, body);
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
            { k: 'total_area', type: 'num', l: '总建筑面积 พื้นที่รวม (ตร.ม.)', min: 0 },
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
                    if (window.ProjectDetail) ProjectDetail.showSubView('site');
                } catch (e) { busy(false); toast(e.message, 'error'); }
            };
        }
    };

    // ================= 现场看板 =================
    const SiteBoard = {
        projectId: null, date: null, data: null, draft: {}, saved: {},

        async init(projectId) {
            this.projectId = projectId;
            if (!this.date) this.date = null;
            const c = document.getElementById('site-board-container');
            c.innerHTML = '<div class="sb-empty">加载中… กำลังโหลด</div>';
            await this.refresh();
        },

        async refresh() {
            const c = document.getElementById('site-board-container');
            if (!c) return;
            try {
                const r = await call('GET', `/projects/${this.projectId}/site-board` + (this.date ? `?date=${this.date}` : ''));
                this.data = r.data;
                if (r.data.planned) {
                    this.date = r.data.date;
                    this.saved = JSON.parse(JSON.stringify(r.data.assignments || {}));
                    this.draft = JSON.parse(JSON.stringify(r.data.assignments || {}));
                }
                this.render();
            } catch (e) {
                c.innerHTML = `<div class="sb-empty">加载失败：${esc(e.message)}</div>`;
            }
        },

        dirty() { return JSON.stringify(this.draft) !== JSON.stringify(this.saved); },
        memberName(id) { const m = (this.data.team || []).find(x => x.id === id); return m ? m.name : '#' + id; },
        usedIds() { const s = new Set(); Object.values(this.draft).forEach(a => a.forEach(i => s.add(i))); return s; },

        toolbar() {
            return `<div class="sb-toolbar">` +
                `<input type="date" id="sb-date" value="${esc(this.date || '')}" class="sb-btn">` +
                `<button class="sb-btn" id="sb-refresh">刷新 รีเฟรช</button><span class="sb-spacer"></span>` +
                `<button class="sb-btn" id="sb-att">今天谁没来 ใครไม่มา</button>` +
                `<button class="sb-btn" id="sb-team">团队名册 ทีมงาน</button>` +
                (isManager() ? `<button class="sb-btn" id="sb-profile">项目申请表 แบบฟอร์ม</button>` : '') + `</div>`;
        },

        render() {
            const c = document.getElementById('site-board-container');
            const d = this.data;
            if (!d.planned) {
                c.innerHTML = `<div class="sb-wrap">${this.toolbar()}<div class="sb-empty"><b>这个项目还没有按申请表生成工序</b><br>ยังไม่ได้สร้างงานตามแบบฟอร์ม<br><br>` +
                    (isManager() ? '<button class="sb-btn primary" id="sb-profile2">填写项目申请表并生成工序 กรอกแบบฟอร์มและสร้างงาน</button>' : '请联系管理者填写项目申请表') + `</div></div>`;
                this.bind(); return;
            }
            const used = this.usedIds();
            const noTeam = !d.team.length;
            let html = `<div class="sb-wrap">${this.toolbar()}`;
            html += `<div class="sb-summary">` +
                `<div class="sb-stat"><b>第 ${d.workingDay} 天</b><span>工作日（周日休息）</span></div>` +
                `<div class="sb-stat"><b>${d.counts.completed}/${d.counts.total}</b><span>已完成/总任务</span></div>` +
                `<div class="sb-stat"><b>${d.inProgress.length}</b><span>进行中</span></div>` +
                `<div class="sb-stat"><b>${d.ready.length}</b><span>现在可以开始</span></div>` +
                `<div class="sb-stat"><b>${d.blocked.length}</b><span>现在不能开始</span></div></div>`;
            html += `<div class="sb-note">系统只给建议，怎么安排由工头决定。 ระบบแนะนำเท่านั้น หัวหน้าช่างเป็นผู้ตัดสินใจ</div>`;
            d.warnings.forEach(w => { html += `<div class="sb-warning">⚠ ${esc(w.zh)}</div>`; });
            if (noTeam) html += `<div class="sb-warning">还没有团队成员，无法给出派人建议。请先点“团队名册”添加。 ยังไม่มีสมาชิกทีม</div>`;

            // 今日派工
            const keys = Object.keys(this.draft).filter(k => this.draft[k].length);
            html += `<div class="sb-section"><h3>今日派工 มอบหมายวันนี้</h3><span class="sb-count">${keys.length} 个任务</span><span class="sb-spacer" style="flex:1"></span>` +
                `<button class="sb-btn primary small" id="sb-save-asg" ${this.dirty() ? '' : 'disabled'}>${this.dirty() ? '确认派工（有未保存的修改）' : '已保存'}</button></div>`;
            if (!keys.length) html += '<div class="sb-empty" style="padding:14px">还没有派工。可以采纳下面的建议，或在“可以开始/进行中”里手动派人。</div>';
            keys.forEach(k => {
                const item = [].concat(d.inProgress, d.ready, d.blocked).find(x => String(x.execId) === String(k));
                html += `<div class="sb-card sug"><div class="sb-row"><span class="sb-title">${item ? nm(item) : '任务 #' + k}</span><span class="sb-spacer" style="flex:1"></span>` +
                    `<button class="sb-btn small" data-clear="${k}">清空</button></div><div>${this.draft[k].map(i => `<span class="sb-chip skilled">${esc(this.memberName(i))} <a href="#" data-rm="${k}:${i}" style="color:#991b1b;text-decoration:none">✕</a></span>`).join('')}</div></div>`;
            });

            // 建议
            const sug = d.suggestions;
            html += `<div class="sb-section"><h3>建议先做 แนะนำให้ทำก่อน</h3><span class="sb-count">${sug.length} 条</span><span style="flex:1"></span>` +
                (sug.length ? '<button class="sb-btn small" id="sb-adopt-all">采纳全部 รับทั้งหมด</button>' : '') + `</div>`;
            if (!sug.length) html += `<div class="sb-empty" style="padding:14px">${noTeam ? '先添加团队成员' : '暂时没有可建议的派人（可能正在等前置工序、养护，或空闲的人不够）'}</div>`;
            sug.forEach(s => {
                const conflict = s.members.some(m => used.has(m.id));
                html += `<div class="sb-card sug"><div class="sb-row"><span class="sb-title">${nm(s)}</span><span class="sb-tag">${s.crews} 组</span><span style="flex:1"></span>` +
                    `<button class="sb-btn small primary" data-adopt="${s.execId}" ${conflict ? 'disabled' : ''}>${conflict ? '人已被占用' : '采纳 รับ'}</button></div>` +
                    `<div>${s.members.map(m => `<span class="sb-chip ${m.level === 'skilled' ? 'skilled' : ''}">${esc(m.name)}</span>`).join('')}</div>` +
                    `<div class="sb-reason">${s.reasons.slice(0, 2).map(esc).join('；')}</div></div>`;
            });
            if (d.queued.length) {
                html += `<div class="sb-section"><h3>可以做，但人不够 ทำได้แต่คนไม่พอ</h3></div>`;
                d.queued.forEach(q => { html += `<div class="sb-card"><div class="sb-title">${esc(q.label)}</div><div class="sb-reason">${esc(q.note)}</div></div>`; });
            }
            if (d.idle.length) {
                html += `<div class="sb-section"><h3>空闲的人 คนที่ว่าง</h3><span class="sb-count">${d.idle.length} 人</span></div><div class="sb-card">` +
                    d.idle.map(i => `<div class="sb-member-row"><span class="sb-chip free">${esc(i.name)}</span><span class="sb-sub sb-grow">${i.canBorrowTo.length ? '可借调到：' + i.canBorrowTo.map(esc).join('、') : '暂时没有合适的任务'}</span></div>`).join('') + `</div>`;
            }

            // 进行中
            html += `<div class="sb-section"><h3>进行中 กำลังทำ</h3><span class="sb-count">${d.inProgress.length}</span></div>`;
            if (!d.inProgress.length) html += '<div class="sb-empty" style="padding:14px">暂无</div>';
            d.inProgress.forEach(x => {
                html += `<div class="sb-card prog"><div class="sb-row"><span class="sb-title">${nm(x)}</span><span class="sb-bar"><i style="width:${pctOf(x)}%"></i></span><span class="sb-sub">${pctOf(x)}%</span>` +
                    (x.quantityMissing ? '<span class="sb-tag">工程量未录入</span>' : '') + `<span style="flex:1"></span>` +
                    `<button class="sb-btn small" data-prog="${x.execId}" data-pct="${pctOf(x)}">更新进度 อัพเดท</button>` +
                    `<button class="sb-btn small" data-pick="${x.execId}">派人</button></div></div>`;
            });

            // 可以开始
            html += `<div class="sb-section"><h3>现在可以开始 เริ่มได้ตอนนี้</h3><span class="sb-count">${d.ready.length}</span></div>`;
            if (!d.ready.length) html += '<div class="sb-empty" style="padding:14px">现在没有新的任务可以开始（多半在等前置工序或养护）</div>';
            d.ready.forEach(x => {
                html += `<div class="sb-card ready"><div class="sb-row"><span class="sb-title">${nm(x)}</span>` +
                    (x.quantityMissing ? '<span class="sb-tag">工程量未录入</span>' : '') + `<span style="flex:1"></span>` +
                    `<button class="sb-btn small" data-pick="${x.execId}">派人</button>` +
                    `<button class="sb-btn small primary" data-start="${x.execId}">开始 เริ่ม</button></div></div>`;
            });

            // 不能开始
            html += `<details class="sb-section" style="display:block"><summary style="cursor:pointer"><b>现在不能开始 ยังเริ่มไม่ได้</b> <span class="sb-count">${d.blocked.length} 个，点开看原因</span></summary><div style="margin-top:8px">`;
            d.blocked.forEach(x => {
                html += `<div class="sb-card blocked"><div class="sb-row"><span class="sb-title">${nm(x)}</span><span style="flex:1"></span>` +
                    `<button class="sb-btn small warn" data-force="${x.execId}">提前开始…</button></div>` +
                    `<div class="sb-reason">${x.reasons.map(r => esc(r.zh)).join('<br>')}</div></div>`;
            });
            html += `</div></details></div>`;
            c.innerHTML = html;
            this.bind();
        },

        bind() {
            const c = document.getElementById('site-board-container');
            const on = (sel, fn) => c.querySelectorAll(sel).forEach(el => el.addEventListener('click', e => { e.preventDefault(); fn(el); }));
            const one = (sel, fn) => { const el = c.querySelector(sel); if (el) el.addEventListener('click', e => { e.preventDefault(); fn(el); }); };
            const pid = this.projectId;
            const dt = c.querySelector('#sb-date'); if (dt) dt.addEventListener('change', () => { this.date = dt.value; this.refresh(); });
            one('#sb-refresh', () => this.refresh());
            one('#sb-team', () => SiteTeam.open(pid));
            one('#sb-profile', () => SiteProfile.open(pid));
            one('#sb-profile2', () => SiteProfile.open(pid));
            one('#sb-att', () => this.attendance());
            if (!this.data.planned) return;
            one('#sb-save-asg', () => this.saveAssignments());
            one('#sb-adopt-all', () => { this.data.suggestions.forEach(s => this.adopt(s.execId, true)); this.render(); });
            on('[data-adopt]', el => { this.adopt(Number(el.dataset.adopt)); this.render(); });
            on('[data-clear]', el => { delete this.draft[el.dataset.clear]; this.render(); });
            on('[data-rm]', el => { const [k, i] = el.dataset.rm.split(':'); this.draft[k] = this.draft[k].filter(x => x !== Number(i)); this.render(); });
            on('[data-prog]', el => { if (hasApp() && app.showUpdateProgress) app.showUpdateProgress(Number(el.dataset.prog), Number(el.dataset.pct)); });
            on('[data-pick]', el => this.pickPeople(Number(el.dataset.pick)));
            on('[data-start]', async el => {
                if (!confirm('确认开始这个任务？ ยืนยันเริ่มงานนี้')) return;
                try { busy(true); await SiteStart.start(Number(el.dataset.start)); toast('已开始 เริ่มแล้ว'); await this.refresh(); }
                catch (e) { toast(e.message, 'error'); await this.refresh(); } finally { busy(false); }
            });
            on('[data-force]', async el => {
                const x = this.data.blocked.find(b => String(b.execId) === el.dataset.force);
                const reason = await SiteStart.askReason({ task: x.label, reasons: x.reasons });
                if (!reason) return;
                try {
                    busy(true);
                    const r = await SiteStart.start(Number(el.dataset.force), reason);
                    toast('已提前开始，并通知了上级和老板 เริ่มก่อนแล้ว แจ้งหัวหน้ากับเจ้าของแล้ว', 'warning');
                    if (r.data.override) alert('提前开始已记录\n风险等级：' + { high: '高', medium: '中', low: '低' }[r.data.override.severity]);
                    await this.refresh(); SiteNotify.refreshCount();
                } catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            });
        },

        adopt(execId, quiet) {
            const s = this.data.suggestions.find(x => x.execId === execId);
            if (!s) return;
            const used = this.usedIds();
            if (s.members.some(m => used.has(m.id))) { if (!quiet) toast('这几个人已经被安排了', 'error'); return; }
            this.draft[execId] = (this.draft[execId] || []).concat(s.members.map(m => m.id));
        },

        pickPeople(execId) {
            const d = this.data, used = this.usedIds();
            const cur = new Set(this.draft[execId] || []);
            const absent = new Set(d.absent);
            const opts = d.team.map(m => {
                const taken = used.has(m.id) && !cur.has(m.id);
                const off = absent.has(m.id);
                return `<label class="sb-field check" style="margin:4px 0"><span><input type="checkbox" value="${m.id}" ${cur.has(m.id) ? 'checked' : ''} ${taken || off ? 'disabled' : ''}> ${esc(m.name)} ` +
                    `<span class="sb-chip ${m.level === 'skilled' ? 'skilled' : ''}">${m.level === 'skilled' ? '技工' : '普工'}</span>` +
                    `<span class="sb-sub">${esc(m.skills.map(s => (TRADES[s] ? TRADES[s].zh : '全能')).join('、'))}</span>` +
                    `${taken ? ' <span class="sb-chip off">已派到别处</span>' : ''}${off ? ' <span class="sb-chip off">今天没来</span>' : ''}</span></label>`;
            }).join('');
            const dlg = overlay('选择人员 เลือกคนงาน', opts || '<div class="sb-empty">还没有团队成员</div>',
                '<button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-ok>确定</button>', true);
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = () => {
                const ids = dlg.qa('input[type=checkbox]:checked').map(x => Number(x.value));
                if (ids.length) this.draft[execId] = ids; else delete this.draft[execId];
                dlg.close(); this.render();
            };
        },

        async saveAssignments() {
            const payload = {};
            Object.keys(this.draft).forEach(k => { if (this.draft[k].length) payload[k] = this.draft[k]; });
            try {
                busy(true);
                await call('PUT', `/projects/${this.projectId}/site-assignments`, { date: this.date, assignments: payload });
                toast('派工已保存 บันทึกการมอบหมายแล้ว');
                await this.refresh();
            } catch (e) {
                if (e.data && e.data.code === 'BLOCKED') toast(e.message, 'error'); else toast(e.message, 'error');
            } finally { busy(false); }
        },

        attendance() {
            const d = this.data, absent = new Set(d.absent);
            if (!d.team.length) { toast('请先添加团队成员 กรุณาเพิ่มสมาชิกทีม', 'error'); return; }
            const rows = d.team.map(m => `<label class="sb-field check" style="margin:5px 0"><span><input type="checkbox" value="${m.id}" ${absent.has(m.id) ? 'checked' : ''}> ${esc(m.name)}</span></label>`).join('');
            const dlg = overlay(`今天谁没来（${esc(this.date)}）ใครไม่มาวันนี้`, `<div class="sb-sub" style="margin-bottom:8px">勾选没来的人，其余默认来了。没来的人当天的派工会被撤掉。</div>${rows}`,
                '<button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-ok>保存 บันทึก</button>', true);
            dlg.q('[data-cancel]').onclick = dlg.close;
            dlg.q('[data-ok]').onclick = async () => {
                const ids = dlg.qa('input:checked').map(x => Number(x.value));
                try { busy(true); await call('PUT', `/projects/${this.projectId}/attendance`, { date: this.date, absent: ids }); dlg.close(); await this.refresh(); }
                catch (e) { toast(e.message, 'error'); } finally { busy(false); }
            };
        },

        async showOverrides(projectId) {
            const r = await call('GET', `/projects/${projectId}/overrides`);
            const sev = { high: '高', medium: '中', low: '低' };
            const body = r.data.length ? r.data.map(o =>
                `<div class="sb-noti"><div class="sb-title">${getI18nField({ process_name: o.process_name }, 'process_name')} <span class="sb-sev-${o.severity}">风险${sev[o.severity]}</span></div>` +
                `<div class="sb-sub">${esc(o.created_at)} · ${esc(o.decided_by_name || '')}</div><pre>原因：${esc(o.reason)}\n未满足：${(o.unmet || []).map(u => esc(u.zh)).join('；')}</pre></div>`).join('')
                : '<div class="sb-empty">还没有提前开始的记录 ยังไม่มีบันทึกการเริ่มก่อน</div>';
            overlay('提前开始记录 บันทึกการเริ่มก่อนกำหนด', body);
        }
    };

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
