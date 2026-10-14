// 每日指派任务：老板在进度计划里安排明天，工头在今日现场看到并执行
const DailyAssign = {
    projectId: null,
    date: null,  // 正在安排哪一天
    tasks: [],

    // 打开安排面板（从甘特图或进度计划页调用）
    async open(projectId, targetDate) {
        this.projectId = projectId;
        this.date = targetDate || this._tomorrow();
        await this.load();
    },

    _tomorrow() {
        const d = new Date(Date.now() + 7*3600000);
        d.setDate(d.getDate()+1);
        return d.toISOString().slice(0,10);
    },
    _today() { return new Date(Date.now()+7*3600000).toISOString().slice(0,10); },

    async load() {
        const r = await apiRequest('/api/projects/'+this.projectId+'/daily-assignments?date='+this.date);
        this.tasks = r.data || [];
        this.render();
    },

    esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },

    render() {
        const existing = document.getElementById('da-panel');
        if(existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'da-panel';
        panel.className = 'da-panel';
        const rows = this.tasks.map(t => this.taskRow(t)).join('') ||
            '<div class="td-empty" style="padding:16px">还没有安排。点下面的按钮添加。<br>ยังไม่มีงานที่มอบหมาย</div>';

        // 加载昨日情况（异步，渲染后填入）
        const yesterdayBkk = new Date(Date.now()+7*3600000-86400000).toISOString().slice(0,10);
        apiRequest('/api/projects/'+this.projectId+'/daily-assignments?date='+yesterdayBkk)
            .then(r => {
                const yt = r.data||[], done = yt.filter(t=>t.status==='completed').length;
                const el = document.getElementById('da-yest-bar');
                if(!el||!yt.length) return;
                el.innerHTML = `<div class="da-yest">📊 เมื่อวาน <small>昨日</small>：` +
                    `<b style="color:${done===yt.length?'#16a34a':'#ea580c'}">${done}/${yt.length} เสร็จ</b>` +
                    (done<yt.length ? `&nbsp;|&nbsp;ยังค้าง <small>未完成：</small>` + yt.filter(t=>t.status!=='completed').map(t=>`<span class="da-yest-chip">${t.custom_title||t.process_name||'?'}</span>`).join('') : ' ✅ ครบทุกงาน') +
                    `</div>`;
            }).catch(()=>{});

        panel.innerHTML = `
            <div class="da-header">
                <div>
                    <b>📋 มอบหมายงาน</b> <small style="color:#64748b">工作安排</small>
                    <input type="date" id="da-date" value="${this.esc(this.date)}" style="margin-left:10px;padding:4px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px">
                </div>
                <button class="sb-btn" onclick="DailyAssign.close()">✕</button>
            </div>
            <div id="da-yest-bar"></div>
            <div class="da-sub">为 <b>${this.esc(this.date)}</b> 安排任务，执行者今日现场会看到。</div>
            <div id="da-list">${rows}</div>
            <div class="da-actions">
                <button class="sb-btn primary" onclick="DailyAssign.addProcess()">+ 选工序 เลือกงาน</button>
                <button class="sb-btn" onclick="DailyAssign.addCustom()">+ 自定义任务</button>
            </div>`;

        document.body.appendChild(panel);
        document.getElementById('da-date').onchange = (e) => { this.date = e.target.value; this.load(); };
    },

    taskRow(t) {
        const name = t.custom_title || (t.process_name ? this._pname(t.process_name) + (t.floor_no ? ' · '+t.floor_no+'层' : '') : '未知');
        const photos = Array.isArray(t.reference_photos) ? t.reference_photos : [];
        const photoThumbs = photos.map(p=>`<img src="${this.esc(p.url)}" onclick="DailyAssign.viewPhoto('${this.esc(p.url)}')" style="width:48px;height:48px;object-fit:cover;border-radius:6px;cursor:pointer">`).join('');
        const statusTag = {assigned:'<span class="da-chip gray">待开始</span>',in_progress:'<span class="da-chip blue">进行中</span>',completed:'<span class="da-chip green">✅ 完成</span>'}[t.status]||'';
        return `<div class="da-task-row" data-id="${t.id}">
            <div class="da-task-main">
                <div class="da-task-name">${this.esc(name)} ${statusTag}</div>
                ${t.custom_description ? `<div class="da-task-desc">${this.esc(t.custom_description)}</div>` : ''}
                ${photoThumbs ? `<div class="da-photos">${photoThumbs}</div>` : ''}
            </div>
            <div class="da-task-btns">
                <label class="sb-btn small da-photo-btn" title="上传参考图">
                    📷 <input type="file" accept="image/*" multiple style="display:none" onchange="DailyAssign.uploadPhotos(${t.id},this)">
                </label>
                
                ${t.status==="assigned" ? `<button class="sb-btn small primary" onclick="DailyAssign.startNow(${t.id})" style="white-space:nowrap;margin-bottom:4px">▶ 加入正在做</button>` : `<span class="da-chip green" style="padding:3px 8px;font-size:12px">✅ 已在正在做</span>`}
                <button class="sb-btn small warn" onclick="DailyAssign.remove(${t.id})">🗑</button>
            </div>
        </div>`;
    },

    _pname(n) { try { const o=typeof n==='string'?JSON.parse(n):n; return o.zh||o.th||''; } catch { return String(n); } },

    close() { const p=document.getElementById('da-panel'); if(p) p.remove(); },

    async addProcess() {
        const SECTIONS = {
            A:{zh:'前期准备',th:'งานเตรียมการ',      color:'#64748b', bg:'#f1f5f9'},
            B:{zh:'地基与基础',th:'งานฐานราก',       color:'#b45309', bg:'#fef3c7'},
            C:{zh:'主体结构',th:'งานโครงสร้างหลัก',  color:'#1d4ed8', bg:'#dbeafe'},
            D:{zh:'屋面',th:'งานหลังคา',              color:'#15803d', bg:'#dcfce7'},
            E:{zh:'机电',th:'งานระบบน้ำ-ไฟ',         color:'#7c3aed', bg:'#ede9fe'},
            F:{zh:'装饰装修',th:'งานตกแต่งภายใน',    color:'#c2410c', bg:'#ffedd5'},
            G:{zh:'外立面',th:'งานผนังภายนอก',       color:'#0e7490', bg:'#cffafe'},
            H:{zh:'室外工程',th:'งานภายนอกอาคาร',   color:'#065f46', bg:'#d1fae5'},
            I:{zh:'验收与交付',th:'ตรวจรับและส่งมอบ',color:'#374151', bg:'#f9fafb'}
        };

        const r = await apiRequest('/api/projects/'+this.projectId+'/estimate');
        const tasks = (r.data && r.data.tasks ? r.data.tasks : []).filter(t=>t.status!=='completed');
        if(!tasks.length){ alert('没有可以安排的工序了'); return; }

        // Group by section (first char of key)
        const groups = {};
        tasks.forEach(t => {
            const sec = t.key.charAt(0).toUpperCase();
            if(!groups[sec]) groups[sec] = [];
            groups[sec].push(t);
        });

        const secOrder = ['A','B','C','D','E','F','G','H','I'];
        let opts = '';
        secOrder.forEach(sec => {
            const items = groups[sec];
            if(!items || !items.length) return;
            const s = SECTIONS[sec] || {zh:sec, th:'', color:'#334155', bg:'#f1f5f9'};
            opts += `<div class="da-sec-head" style="background:${s.bg};border-left:5px solid ${s.color}">
                <span style="color:${s.color};font-size:16px;font-weight:800">${s.th}</span>
                <span style="color:${s.color};opacity:.75;font-size:12px;margin-left:7px">${s.zh}</span>
                <span style="float:right;background:${s.color};color:#fff;border-radius:12px;padding:2px 8px;font-size:12px">${items.length}</span>
            </div>`;
            items.forEach(t => {
                const nm = (t.th||'') ? `<b>${t.th}</b> <small style="color:#64748b">${t.name}</small>` : t.name;
                const floor = t.floor!=null ? ` <span class="da-floor-tag">ชั้น ${t.floor}</span>` : '';
                opts += `<label class="da-opt-row"><input type="checkbox" value="${t.execId}" data-name="${this.esc(t.name+(t.floor!=null?' · '+t.floor+'层':''))}"> <span class="da-opt-nm">${nm}${floor}</span></label>`;
            });
        });

        const dlg = document.createElement('div'); dlg.className='sb-overlay';
        dlg.innerHTML=`<div class="sb-dialog" style="max-width:560px"><header style="background:#1e3a8a;color:#fff"><h3>📋 เลือกงานที่จะมอบหมาย <small style="opacity:.8;font-size:13px;font-weight:400">选择要安排的工序</small></h3><button data-x style="color:#fff;background:transparent;border:none;font-size:22px;cursor:pointer">&times;</button></header>
            <div class="sb-body" style="max-height:65vh;overflow-y:auto;padding:0">${opts}</div>
            <footer><button class="sb-btn" data-cancel>ยกเลิก 取消</button><button class="sb-btn primary" data-ok>✅ ยืนยัน 确认添加</button></footer></div>`;
        document.body.appendChild(dlg);
        dlg.querySelector('[data-x]').onclick=dlg.querySelector('[data-cancel]').onclick=()=>dlg.remove();
        dlg.querySelector('[data-ok]').onclick=async()=>{
            const selected=Array.from(dlg.querySelectorAll('input:checked'));
            dlg.remove();
            for(let i=0;i<selected.length;i++){
                await apiRequest('/api/projects/'+this.projectId+'/daily-assignments',{method:'POST',body:JSON.stringify({work_date:this.date,process_execution_id:Number(selected[i].value),sort_order:this.tasks.length+i})});
            }
            await this.load();
        };
    },

    async addCustom() {
        // ─── preset work types with bilingual task suggestions ───
        const CATS = [
            { id:'structure', th:'งานโครงสร้าง', zh:'结构工程',
              tasks:[
                {th:'ผูกเหล็กเสา/คาน',zh:'钢筋绑扎',unit:'kg'},{th:'เทคอนกรีต',zh:'混凝土浇筑',unit:'m³'},
                {th:'แบบหล่อ',zh:'模板安装/拆除',unit:'m²'},{th:'ก่ออิฐ',zh:'砌砖',unit:'m²'},
                {th:'ฉาบปูน',zh:'抹灰',unit:'m²'},{th:'ถอดแบบ/บ่มคอนกรีต',zh:'养护拆模',unit:'项'}
              ]},
            { id:'mep', th:'งานระบบน้ำ-ไฟ', zh:'水电工程',
              tasks:[
                {th:'เดินท่อน้ำ',zh:'给排水管安装',unit:'m'},{th:'เดินสายไฟ',zh:'电线敷设',unit:'m'},
                {th:'ฝังท่อ',zh:'预埋管线',unit:'m²'},{th:'ตรวจงานน้ำไฟ',zh:'水电验收',unit:'项'},
                {th:'ติดตั้งสุขภัณฑ์',zh:'洁具安装',unit:'套'},{th:'ติดตั้งสวิตช์/ปลั๊ก',zh:'开关插座安装',unit:'个'}
              ]},
            { id:'finishing', th:'งานตกแต่ง', zh:'装修工程',
              tasks:[
                {th:'ปูกระเบื้องพื้น',zh:'地砖铺贴',unit:'m²'},{th:'ปูกระเบื้องผนัง',zh:'墙砖铺贴',unit:'m²'},
                {th:'ทาสี',zh:'涂料/乳胶漆',unit:'m²'},{th:'โป๊วผนัง',zh:'腻子批刮',unit:'m²'},
                {th:'ติดตั้งบานประตู/หน้าต่าง',zh:'门窗安装',unit:'樘'},{th:'เพดานยิปซั่ม',zh:'石膏板吊顶',unit:'m²'},
                {th:'กันซึมห้องน้ำ',zh:'卫生间防水',unit:'m²'}
              ]},
            { id:'exterior', th:'งานภายนอก', zh:'外立面/室外',
              tasks:[
                {th:'ฉาบปูนผนังนอก',zh:'外墙抹灰',unit:'m²'},{th:'ทาสีผนังนอก',zh:'外墙涂料',unit:'m²'},
                {th:'กันสาดหน้าต่าง',zh:'外窗收口打胶',unit:'m'},{th:'ถนน/ลานพื้น',zh:'道路铺装',unit:'m²'},
                {th:'รั้วและประตู',zh:'围墙大门',unit:'m'},{th:'สระว่ายน้ำ',zh:'泳池施工',unit:'项'}
              ]},
            { id:'inspect', th:'ตรวจสอบ/แก้ไข', zh:'检查整改',
              tasks:[
                {th:'ตรวจงานฐานราก',zh:'基础验收',unit:'项'},{th:'ตรวจกันซึม',zh:'防水检查',unit:'项'},
                {th:'ตรวจน้ำ-ไฟ',zh:'水电检查',unit:'项'},{th:'แก้ไขงาน',zh:'整改修补',unit:'项'},
                {th:'ตรวจรับแต่ละชั้น',zh:'分层验收',unit:'项'}
              ]},
            { id:'procure', th:'จัดซื้อ/ขนส่ง', zh:'采购运输',
              tasks:[
                {th:'สั่งซื้อเหล็ก',zh:'采购钢筋',unit:'kg'},{th:'สั่งซื้อปูน/คอนกรีต',zh:'采购水泥/混凝土',unit:'m³'},
                {th:'สั่งซื้อกระเบื้อง',zh:'采购瓷砖',unit:'m²'},{th:'สั่งซื้อวัสดุ',zh:'采购材料',unit:'项'},
                {th:'ขนส่งวัสดุ',zh:'材料运输',unit:'项'}
              ]},
            { id:'other', th:'อื่นๆ', zh:'其他', tasks:[] }
        ];
        const FLOORS = ['ชั้น 1','ชั้น 2','ชั้น 3','ดาดฟ้า','ทุกชั้น'];
        const ZONES  = ['ห้องน้ำ','ครัว','ห้องนอน','ห้องนั่งเล่น','ระเบียง','บันได','ทั้งหลัง','ภายนอก'];
        const UNITS  = ['m','m²','m³','kg','t','ชิ้น','ชุด/套','แห่ง/项','วัน/天','คน/人'];

        const catOpts = CATS.map(c=>`<option value="${c.id}">${c.th}  ${c.zh}</option>`).join('');
        const floorOpts = ['— ชั้น (ไม่ระบุ) —',...FLOORS].map(f=>`<option>${f}</option>`).join('');
        const zoneOpts  = ['— บริเวณ (ไม่ระบุ) —',...ZONES].map(z=>`<option>${z}</option>`).join('');
        const unitOpts  = UNITS.map(u=>`<option>${u}</option>`).join('');

        const dlg = document.createElement('div'); dlg.className='sb-overlay';
        dlg.innerHTML=`<div class="sb-dialog ct-dlg"><header>
            <div><b class="ct-title-th">📋 สร้างงาน</b><small class="ct-title-zh"> 添加工作任务</small></div>
            <button data-x>&times;</button></header>
            <div class="sb-body ct-body">

            <div class="ct-row"><label class="ct-lbl"><b>ประเภทงาน</b><small>工作类型 *</small></label>
                <select id="ct-cat" class="ct-select">${catOpts}</select></div>

            <div class="ct-row ct-preset-row">
                <label class="ct-lbl"><b>เลือกงาน</b><small>快速选择</small></label>
                <div id="ct-presets" class="ct-preset-chips"></div>
            </div>

            <div class="ct-row"><label class="ct-lbl"><b>ชื่องาน</b><small>任务名称 *</small></label>
                <input id="ct-title" type="text" class="ct-input" placeholder="ระบุงาน / 描述工作内容"></div>

            <div class="ct-row2">
                <div class="ct-half"><label class="ct-lbl"><b>ชั้น</b><small>楼层</small></label>
                    <select id="ct-floor" class="ct-select">${floorOpts}</select></div>
                <div class="ct-half"><label class="ct-lbl"><b>บริเวณ</b><small>区域</small></label>
                    <select id="ct-zone" class="ct-select">${zoneOpts}</select></div>
            </div>

            <div class="ct-row2">
                <div class="ct-half"><label class="ct-lbl"><b>ปริมาณ</b><small>数量</small></label>
                    <input id="ct-qty" type="number" min="0" step="0.1" class="ct-input" placeholder="0"></div>
                <div class="ct-half"><label class="ct-lbl"><b>หน่วย</b><small>单位</small></label>
                    <select id="ct-unit" class="ct-select">${unitOpts}</select></div>
            </div>

            <div class="ct-row"><label class="ct-lbl"><b>หมายเหตุ</b><small>备注</small></label>
                <textarea id="ct-desc" class="ct-input" rows="2" placeholder="รายละเอียดเพิ่มเติม..."></textarea></div>
            </div>
            <footer>
                <button class="sb-btn" data-cancel>ยกเลิก 取消</button>
                <button class="sb-btn primary" data-ok>✅ เพิ่ม 添加</button>
            </footer></div>`;
        document.body.appendChild(dlg);

        // Update preset chips when category changes
        const updatePresets = () => {
            const cat = CATS.find(c=>c.id===dlg.querySelector('#ct-cat').value);
            const box = dlg.querySelector('#ct-presets');
            if(!cat||!cat.tasks.length){ box.innerHTML='<span style="color:#94a3b8;font-size:13px">—</span>'; return; }
            box.innerHTML = cat.tasks.map(t=>`<button class="ct-chip" data-th="${t.th}" data-zh="${t.zh}" data-unit="${t.unit}">${t.th}<small>${t.zh}</small></button>`).join('');
            box.querySelectorAll('.ct-chip').forEach(b=>b.onclick=()=>{
                dlg.querySelector('#ct-title').value = b.dataset.th + ' ' + b.dataset.zh;
                const uid = dlg.querySelector('#ct-unit');
                Array.from(uid.options).forEach(o=>{ if(o.value.startsWith(b.dataset.unit)) uid.value=o.value; });
                box.querySelectorAll('.ct-chip').forEach(x=>x.classList.remove('active'));
                b.classList.add('active');
            });
        };
        dlg.querySelector('#ct-cat').onchange = updatePresets;
        updatePresets();

        dlg.querySelector('[data-x]').onclick=dlg.querySelector('[data-cancel]').onclick=()=>dlg.remove();
        dlg.querySelector('[data-ok]').onclick=async()=>{
            let title = dlg.querySelector('#ct-title').value.trim();
            if(!title){alert('กรุณาระบุชื่องาน / 请填写任务名称');return;}
            const floor = dlg.querySelector('#ct-floor').value; const hasFloor = !floor.startsWith('—');
            const zone  = dlg.querySelector('#ct-zone').value;  const hasZone  = !zone.startsWith('—');
            const qty   = dlg.querySelector('#ct-qty').value;
            const unit  = dlg.querySelector('#ct-unit').value;
            // Build rich description
            let desc = dlg.querySelector('#ct-desc').value.trim();
            const extra = [hasFloor?floor:'', hasZone?zone:'', qty?qty+' '+unit:''].filter(Boolean).join(' | ');
            if(extra) desc = (desc ? desc+'\n' : '') + extra;
            dlg.remove();
            await apiRequest('/api/projects/'+this.projectId+'/daily-assignments',{method:'POST',body:JSON.stringify({
                work_date:this.date, custom_title:title, custom_description:desc||null, sort_order:this.tasks.length
            })});
            await this.load();
        };
    },

    async uploadPhotos(id, input) {
        const files = Array.from(input.files);
        if(!files.length) return;
        const fd = new FormData();
        files.forEach(f=>fd.append('photos',f));
        const r = await fetch(window.location.origin+'/api/daily-assignments/'+id+'/photos',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('authToken')},body:fd});
        const j = await r.json();
        if(j.success) await this.load(); else alert(j.message||'上传失败');
    },

    async remove(id) {
        if(!confirm('确认删除这个任务安排？')) return;
        await apiRequest('/api/daily-assignments/'+id,{method:'DELETE'});
        await this.load();
    },

    viewPhoto(url) {
        const ov=document.createElement('div'); ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
        ov.innerHTML=`<img src="${this.esc(url)}" style="max-width:90vw;max-height:90vh;border-radius:10px">`;
        ov.onclick=()=>ov.remove(); document.body.appendChild(ov);
    }
    ,async startNow(id) {
        const asgn = this.tasks.find(t => t.id === id);
        if (!asgn) return;
        try {
            if (typeof app !== 'undefined') app.showLoading();
            // 1. Update assignment status to in_progress
            await apiRequest('/api/daily-assignments/' + id, {method:'PUT', body:JSON.stringify({status:'in_progress'})});
            // 2. If linked to a process, start it too (move from section 3 to section 2)
            if (asgn.process_execution_id) {
                try { await apiRequest('/api/processes/'+asgn.process_execution_id+'/start',{method:'POST',body:JSON.stringify({force_reason:'老板安排，直接开始 มอบหมายจากเจ้าของ'})}); } catch(_) { /* ignore */ }
            }
            if (typeof app !== 'undefined') app.hideLoading();
            if (typeof app !== 'undefined' && app.showToast) app.showToast('已加入正在做 ✅');
            // Refresh the assignment panel and site board
            await this.load();
            if (window.SiteBoard && window.ProjectDetail && ProjectDetail.currentView === 'site') SiteBoard.refresh();
            this.close(); // auto-close panel
        } catch(e) {
            if (typeof app !== 'undefined') app.hideLoading();
            alert('失败: ' + e.message);
        }
    }
    ,async updateStatus(id, status) {
        await apiRequest('/api/daily-assignments/'+id, {method:'PUT', body:JSON.stringify({status})});
        if(window.SiteBoard && window.ProjectDetail && ProjectDetail.currentView==='site') SiteBoard.refresh();
    }
};
window.DailyAssign = DailyAssign;
