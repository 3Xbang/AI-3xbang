// 项目准备：把“开工前要做的事”排成步骤清单，显示每一步是否完成，并给出下一步按钮。
// 前 3 步（申请表、团队、生成工序）必须完成才能开工；后 2 步（工程量、账号）可以边做边补。
const ProjectPrepare = {
    projectId: null,
    data: null,
    timer: null,

    STEPS: {
        drawings: {
            zh: '图纸上传', th: 'อัปโหลดแบบก่อสร้าง', optional: true,
            why: '上传设计图纸（PDF 或图片）。工头和老板都能在系统里查看，不需要到处找文件。',
            btn: '上传图纸', run: pid => ProjectPrepare.openDrawings(pid)
        },
        boq: {
            zh: '工程量清单 BOQ', th: 'ปริมาณงาน (BOQ)', optional: true,
            why: '有报价单 Excel 就上传，系统自动识别楼层、套数、卫生间等，帮你填好申请表。没有就跳过，手动填。',
            btn: '上传 BOQ（自动识别）', run: pid => ProjectPrepare.openBoqExtract(pid)
        },
        profile: {
            zh: '项目申请表', th: 'แบบฟอร์มโครงการ',
            why: '告诉系统这栋楼是什么样：几层、几套、有几个卫生间、屋顶和装修做法。BOQ上传后已自动填好部分内容。',
            btn: '填写 / 确认申请表', run: pid => SiteProfile.open(pid)
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
    async openDrawings(pid) {
        const d = document.createElement('div'); d.className='sb-overlay';
        d.innerHTML = '<div class="sb-dialog"><header><h3>📐 图纸上传 อัปโหลดแบบก่อสร้าง</h3><button data-x>&times;</button></header>' +
            '<div class="sb-body">' +
            '<div class="sb-note">支持 PDF、JPG、PNG 格式，最大 50MB 每个文件。上传后工头可以在手机上查看。</div>' +
            '<div id="draw-list" style="margin:10px 0"></div>' +
            '<div class="sb-field"><label>上传图纸</label><input type="file" id="draw-files" multiple accept=".pdf,image/*" style="font-size:14px;padding:8px 0"></div>' +
            '<div class="sb-field"><label>备注（可选）</label><input type="text" id="draw-desc" placeholder="例如：一楼平面图、立面图"></div>' +
            '</div>' +
            '<footer><button class="sb-btn" data-cancel>关闭</button><button class="sb-btn primary" data-upload>📤 上传</button></footer></div>';
        document.body.appendChild(d);
        const close = () => d.remove();
        d.querySelector('[data-x]').onclick = d.querySelector('[data-cancel]').onclick = close;
        // Load existing drawings
        try {
            const r = await apiRequest('/api/projects/'+pid+'/drawings');
            const list = d.querySelector('#draw-list');
            list.innerHTML = (r.data||[]).length ? '<b>已上传的图纸：</b><br>' + r.data.map(f=>'<div style="margin:4px 0">📄 <a href="'+f.file_url+'" target="_blank">'+this.esc(f.file_name)+'</a> <button class="sb-btn small" data-del="'+f.id+'">删除</button></div>').join('') : '<div class="sb-sub">还没有上传图纸</div>';
            list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ await apiRequest('/api/drawings/'+b.dataset.del,{method:'DELETE'}); close(); this.openDrawings(pid); });
        } catch(e){}
        d.querySelector('[data-upload]').onclick = async () => {
            const files = d.querySelector('#draw-files').files;
            if(!files.length){if(typeof app!=='undefined'&&app.showToast)app.showToast('请选择文件','error');return;}
            const fd = new FormData();
            Array.from(files).forEach(f=>fd.append('files',f));
            fd.append('description',d.querySelector('#draw-desc').value);
            try {
                if(typeof app!=='undefined')app.showLoading();
                await fetch(window.location.origin+'/api/projects/'+pid+'/drawings',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
                if(typeof app!=='undefined')app.hideLoading();
                close(); this.openDrawings(pid); await this.load();
            } catch(e){ if(typeof app!=='undefined')app.hideLoading(); alert(e.message); }
        };
    },

    async openBoqExtract(pid) {
        const d = document.createElement('div'); d.className='sb-overlay';
        d.innerHTML = '<div class="sb-dialog narrow"><header><h3>📊 上传 BOQ 自动识别项目信息</h3><button data-x>&times;</button></header>' +
            '<div class="sb-body">' +
            '<div class="sb-note">上传报价单 Excel（.xlsx），系统自动识别楼层数、套数、卫生间等，帮你填好申请表里的基础信息。</div>' +
            '<div class="sb-field"><label>选择 BOQ Excel 文件 *</label><input type="file" id="boq-xls" accept=".xlsx" style="font-size:14px;padding:8px 0"></div>' +
            '<div id="boq-hints" style="margin-top:10px"></div>' +
            '</div>' +
            '<footer><button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-analyze>🔍 识别并填入申请表</button></footer></div>';
        document.body.appendChild(d);
        const close = () => d.remove();
        d.querySelector('[data-x]').onclick = d.querySelector('[data-cancel]').onclick = close;
        d.querySelector('[data-analyze]').onclick = async () => {
            const file = d.querySelector('#boq-xls').files[0];
            if(!file){if(typeof app!=='undefined'&&app.showToast)app.showToast('请选择Excel文件','error');return;}
            const fd = new FormData();
            fd.append('boq', file);
            try {
                if(typeof app!=='undefined')app.showLoading();
                const r = await fetch(window.location.origin+'/api/projects/'+pid+'/boq/extract-profile',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
                const j = await r.json();
                if(typeof app!=='undefined')app.hideLoading();
                if(!j.success){alert(j.message||'识别失败');return;}
                const {profile,hints} = j.data;
                d.querySelector('#boq-hints').innerHTML = '<div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:10px;padding:10px 12px;margin-top:8px"><b>识别结果：</b><br>' +
                    (hints.length ? hints.map(h=>'✅ '+h).join('<br>') : '未能识别出关键信息，请手动填写申请表') + '</div>';
                if(Object.keys(profile).length>0){
                    // Save extracted profile
                    const cur = await apiRequest('/api/projects/'+pid+'/profile');
                    const merged = Object.assign({}, (cur.data&&cur.data.answers)||{}, profile);
                    await apiRequest('/api/projects/'+pid+'/profile',{method:'PUT',body:JSON.stringify({answers:merged})});
                    d.querySelector('#boq-hints').innerHTML += '<div style="margin-top:8px;color:#166534;font-weight:700">✅ 已自动填入申请表！请点「填写/确认申请表」核对。</div>';
                    await this.load();
                }
            } catch(e){if(typeof app!=='undefined')app.hideLoading();alert(e.message);}
        };
    },

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
