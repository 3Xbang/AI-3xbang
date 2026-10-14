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
            A:{zh:'前期准备',th:'งานเตรียมการ'},
            B:{zh:'地基与基础',th:'งานฐานราก'},
            C:{zh:'主体结构',th:'งานโครงสร้างหลัก'},
            D:{zh:'屋面',th:'งานหลังคา'},
            E:{zh:'机电',th:'งานระบบน้ำ-ไฟ'},
            F:{zh:'装饰装修',th:'งานตกแต่งภายใน'},
            G:{zh:'外立面',th:'งานผนังภายนอก'},
            H:{zh:'室外工程',th:'งานภายนอกอาคาร'},
            I:{zh:'验收与交付',th:'ตรวจรับและส่งมอบ'}
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
            const s = SECTIONS[sec] || {zh:sec, th:''};
            opts += `<div class="da-sec-head"><b>${s.th}</b> <small>${s.zh}</small></div>`;
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
        const dlg = document.createElement('div'); dlg.className='sb-overlay';
        dlg.innerHTML=`<div class="sb-dialog narrow"><header><h3>自定义任务</h3><button data-x>&times;</button></header>
            <div class="sb-body">
                <div class="sb-field"><label>任务名称 *</label><input type="text" id="ct-title" placeholder="例如：检查A区防水、采购钢筋"></div>
                <div class="sb-field"><label>说明（可不填）</label><textarea id="ct-desc" rows="2"></textarea></div>
            </div>
            <footer><button class="sb-btn" data-cancel>取消</button><button class="sb-btn primary" data-ok>添加</button></footer></div>`;
        document.body.appendChild(dlg);
        dlg.querySelector('[data-x]').onclick=dlg.querySelector('[data-cancel]').onclick=()=>dlg.remove();
        dlg.querySelector('[data-ok]').onclick=async()=>{
            const title=dlg.querySelector('#ct-title').value.trim();
            if(!title){alert('请填写任务名称');return;}
            dlg.remove();
            await apiRequest('/api/projects/'+this.projectId+'/daily-assignments',{method:'POST',body:JSON.stringify({work_date:this.date,custom_title:title,custom_description:dlg.querySelector('#ct-desc').value.trim(),sort_order:this.tasks.length})});
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
