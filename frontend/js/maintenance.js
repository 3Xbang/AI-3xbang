/**
 * maintenance.js – maintenance work order module.
 * Live code paths are via project-dashboard.js → loadMaintenancePanel → _openTicketDetail.
 * Dead project-scoped methods (init/load/render/showCreateForm/submitCreate) removed.
 */
const Maintenance = {
    tickets: [],

    esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },

    _badgeHtml(status) {
        const map = {
            'pending':       {bg:'#f6ad55',color:'#7b341e',label:'待处理 รอดำเนินการ'},
            'pending_quote': {bg:'#9f7aea',color:'#44337a',label:'待报价 รอใบเสนอราคา'},
            'quoted':        {bg:'#63b3ed',color:'#1a365d',label:'已报价 รอการอนุมัติ'},
            'in-progress':   {bg:'#4fd1c7',color:'#1d4044',label:'施工中 กำลังดำเนินการ'},
            'completed':     {bg:'#68d391',color:'#1c4532',label:'已完工 ดำเนินการเสร็จสิ้น'},
            'cancelled':     {bg:'#e2e8f0',color:'#4a5568',label:'已取消 ยกเลิก'}
        };
        const s = map[status] || map['pending'];
        return `<span style="background:${s.bg};color:${s.color};padding:2px 10px;border-radius:12px;font-size:0.78rem;font-weight:600;white-space:nowrap;">${s.label}</span>`;
    },

    _categoryBadgeHtml(category) {
        if (!category) return '';
        const colors = {'防水/漏水':'#3182ce','电气/照明':'#d69e2e','木工/门窗':'#744210','泳池/户外':'#2c7a7b','空调/通风':'#2b6cb0','瓷砖/地板':'#c05621','外墙/涂料':'#276749','其他':'#718096'};
        const bg = colors[category] || '#718096';
        return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:600;white-space:nowrap;">${this.esc(category)}</span>`;
    },

    showTicketDetail(id) {
        const t = this.tickets.find(t => t.id === id);
        if (!t) return;
        const role = PermissionManager.role();
        const isManager    = role === 'manager';
        const isSupervisor = role === 'supervisor';
        const isWorker     = role === 'worker';
        const isOwner      = PermissionManager.isOwner();

        const beforePhotos = (t.photos || []).filter(p => p.photo_type === 'before');
        const afterPhotos  = (t.photos || []).filter(p => p.photo_type === 'after');
        const hasAfterPhoto = afterPhotos.length > 0;
        const canComplete   = isWorker && !['completed','cancelled'].includes(t.status) && hasAfterPhoto;

        const photoGrid = (photos) => photos.length
            ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${photos.map(p =>
                `<img src="${this.esc(p.photo_url)}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="window.open('${this.esc(p.photo_url)}','_blank')">`
              ).join('')}</div>`
            : '<div style="color:#a0aec0;font-size:0.85rem;margin-top:4px;">暂无照片</div>';

        // Timeline
        const qs = t.quote_status || 'no_quote';
        let activeStep = 0;
        if (['pending_quote','in-progress','completed'].includes(t.status) || ['quoted','approved'].includes(qs)) activeStep = 1;
        if (qs === 'approved' || ['in-progress','completed'].includes(t.status)) activeStep = 2;
        if (['in-progress','completed'].includes(t.status)) activeStep = 3;
        if (t.status === 'completed') activeStep = 4;
        const tlSteps = ['已提交','已报价','已确认','施工中','已完工'];
        const timelineHtml = '<div style="display:flex;align-items:flex-start;margin:12px 0 16px;background:#f7fafc;border-radius:8px;padding:8px 6px;">' +
            tlSteps.map(function(lbl, i, arr) {
                const done = i <= activeStep;
                const circ = '<div style="width:20px;height:20px;border-radius:50%;background:' + (done?'#38a169':'#fff') + ';border:2px solid ' + (done?'#38a169':'#cbd5e0') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;">' + (done?'✓':'') + '</div>';
                const step = '<div style="display:flex;flex-direction:column;align-items:center;">' + circ + '<div style="font-size:0.6rem;color:' + (done?'#2f855a':'#a0aec0') + ';text-align:center;margin-top:3px;white-space:nowrap;">' + lbl + '</div></div>';
                const conn = i < arr.length-1 ? '<div style="flex:1;height:2px;background:' + (i<activeStep?'#38a169':'#e2e8f0') + ';margin:10px 2px 0;flex-shrink:1;"></div>' : '';
                return step + conn;
            }).join('') + '</div>';

        const isDoneOrCancelled = ['completed','cancelled'].includes(t.status);

        // Quote section (manager/supervisor)
        let quoteSectionHtml = '';
        if ((isManager || isSupervisor) && !isDoneOrCancelled) {
            const curAmt  = t.quote_amount ? Number(t.quote_amount).toLocaleString() : '';
            const curDate = t.scheduled_date ? String(t.scheduled_date).substring(0,10) : '';
            const existingItems = Array.isArray(t.quote_items) ? t.quote_items : [];
            const curLaborCost  = t.labor_cost ? Number(t.labor_cost) : 0;
            const iStyle = 'padding:6px;border:1px solid #bee3f8;border-radius:6px;font-size:0.85rem;';
            let itemRowsHtml = '';
            existingItems.forEach(item => {
                itemRowsHtml +=
                    '<div class="td-item-row" style="display:flex;gap:4px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">' +
                    '<input class="td-item-name" type="text" placeholder="材料名称 Name" value="' + this.esc(item.name || '') + '" style="' + iStyle + 'flex:2;min-width:100px;">' +
                    '<input class="td-item-qty" type="number" min="0" step="1" placeholder="Qty" value="' + Number(item.qty || 0) + '" style="' + iStyle + 'flex:1;min-width:48px;" oninput="Maintenance._updateQuoteTotal()">' +
                    '<input class="td-item-unit" type="text" placeholder="ชิ้น" value="' + this.esc(item.unit || '') + '" style="' + iStyle + 'flex:1;min-width:48px;">' +
                    '<input class="td-item-price" type="number" min="0" step="0.01" placeholder="฿ Unit" value="' + Number(item.unit_price || 0) + '" style="' + iStyle + 'flex:1;min-width:64px;" oninput="Maintenance._updateQuoteTotal()">' +
                    '<button onclick="this.parentElement.remove();Maintenance._updateQuoteTotal()" style="padding:6px 8px;border:1px solid #e53e3e;color:#e53e3e;background:transparent;border-radius:6px;cursor:pointer;min-height:44px;">✕</button>' +
                    '</div>';
            });
            quoteSectionHtml = '<div style="background:#ebf8ff;border:1px solid #bee3f8;border-radius:8px;padding:12px;margin-bottom:16px;">' +
                '<div style="font-weight:600;color:#2b6cb0;margin-bottom:8px;">🏷️ 发送报价 Send Quote</div>' +
                (t.quote_amount ? '<div style="font-size:0.85rem;color:#4a5568;margin-bottom:8px;">当前报价: <strong>฿' + curAmt + '</strong>' + (t.scheduled_date ? '　📅 ' + curDate : '') + '</div>' : '') +
                '<div id="td-items-container">' + itemRowsHtml + '</div>' +
                '<button class="sb-btn" style="width:100%;margin-bottom:8px;min-height:44px;" onclick="Maintenance._addQuoteItem()">+ 添加材料 Add Material</button>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
                '<input id="td-labor-cost" type="number" min="0" step="0.01" placeholder="工费 Labor ฿" value="' + (curLaborCost || '') + '" style="flex:1;min-width:110px;padding:8px;border:1px solid #bee3f8;border-radius:6px;font-size:0.95rem;" oninput="Maintenance._updateQuoteTotal()">' +
                '<input id="td-scheduled-date" type="date" value="' + curDate + '" style="flex:1;min-width:130px;padding:8px;border:1px solid #bee3f8;border-radius:6px;font-size:0.95rem;"></div>' +
                '<div style="text-align:right;font-weight:600;color:#2b6cb0;margin-bottom:8px;">总价 Total: <span id="td-total-display">฿0</span></div>' +
                '<button class="sb-btn primary" style="min-height:44px;width:100%;" onclick="Maintenance.sendQuote(' + t.id + ')">🏷️ 发送报价 Send Quote</button></div>';
        }

        // Owner approval section
        let ownerApprovalHtml = '';
        if (isOwner && qs === 'quoted') {
            const amt   = t.quote_amount ? Number(t.quote_amount).toLocaleString() : '—';
            const sdate = t.scheduled_date ? String(t.scheduled_date).substring(0,10) : '';
            let itemsBreakdownHtml = '';
            if (Array.isArray(t.quote_items) && t.quote_items.length > 0) {
                let tbodyRows = '';
                t.quote_items.forEach(item => {
                    tbodyRows += '<tr>' +
                        '<td style="padding:4px 6px;border-bottom:1px solid #fde68a;">' + this.esc(item.name || '') + '</td>' +
                        '<td style="padding:4px 6px;border-bottom:1px solid #fde68a;text-align:center;">' + this.esc(String(item.qty || '')) + (item.unit ? ' ' + this.esc(item.unit) : '') + '</td>' +
                        '<td style="padding:4px 6px;border-bottom:1px solid #fde68a;text-align:right;">฿' + Number((item.qty || 0) * (item.unit_price || 0)).toLocaleString() + '</td>' +
                        '</tr>';
                });
                if (Number(t.labor_cost) > 0) {
                    tbodyRows += '<tr>' +
                        '<td style="padding:4px 6px;border-bottom:1px solid #fde68a;">工费 Labor</td>' +
                        '<td style="padding:4px 6px;border-bottom:1px solid #fde68a;text-align:center;">—</td>' +
                        '<td style="padding:4px 6px;border-bottom:1px solid #fde68a;text-align:right;">฿' + Number(t.labor_cost).toLocaleString() + '</td>' +
                        '</tr>';
                }
                itemsBreakdownHtml =
                    '<div style="overflow-x:auto;margin-bottom:10px;">' +
                    '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
                    '<thead><tr>' +
                    '<th style="padding:4px 6px;border-bottom:2px solid #f6e05e;text-align:left;">รายการ 项目</th>' +
                    '<th style="padding:4px 6px;border-bottom:2px solid #f6e05e;text-align:center;">จำนวน 数量</th>' +
                    '<th style="padding:4px 6px;border-bottom:2px solid #f6e05e;text-align:right;">จำนวนเงิน ฿</th>' +
                    '</tr></thead>' +
                    '<tbody>' + tbodyRows + '</tbody>' +
                    '<tfoot><tr>' +
                    '<td colspan="2" style="padding:4px 6px;text-align:right;font-weight:600;">รวมทั้งหมด 总计</td>' +
                    '<td style="padding:4px 6px;text-align:right;font-weight:700;color:#c05621;">฿' + Number(t.quote_amount || 0).toLocaleString() + '</td>' +
                    '</tr></tfoot>' +
                    '</table></div>';
                if (sdate) itemsBreakdownHtml += '<div style="font-size:0.85rem;color:#4a5568;margin-bottom:10px;">预定日期 Scheduled: ' + sdate + '</div>';
            } else {
                itemsBreakdownHtml = '<div style="font-size:0.9rem;color:#4a5568;margin-bottom:10px;">报价金额: <strong style="color:#c05621;">฿' + amt + '</strong>' + (sdate ? '<br>预定日期 Scheduled: ' + sdate : '') + '</div>';
            }
            ownerApprovalHtml = '<div style="background:#fffbeb;border:1px solid #f6e05e;border-radius:8px;padding:12px;margin-bottom:16px;">' +
                '<div style="font-weight:600;color:#b7791f;margin-bottom:8px;">📋 报价待确认 Quote Pending Approval</div>' +
                itemsBreakdownHtml +
                '<div style="display:flex;gap:8px;">' +
                '<button class="sb-btn primary" style="min-height:44px;flex:1;background:#38a169;border-color:#38a169;" onclick="Maintenance.approveQuote(' + t.id + ')">✅ 确认接受 Approve</button>' +
                '<button class="sb-btn" style="min-height:44px;flex:1;color:#e53e3e;border-color:#e53e3e;" onclick="Maintenance.rejectQuote(' + t.id + ')">❌ 拒绝 Reject</button></div></div>';
        }

        // Worker section
        let workerSectionHtml = '';
        if (isWorker && !isDoneOrCancelled) {
            const wm = t.warranty_months;
            const warrantyOpts =
                '<option value=""' + (!wm ? ' selected' : '') + '>无 No Warranty</option>' +
                '<option value="1"'  + (wm===1  ? ' selected' : '') + '>1个月</option>' +
                '<option value="3"'  + (wm===3  ? ' selected' : '') + '>3个月</option>' +
                '<option value="6"'  + (wm===6  ? ' selected' : '') + '>6个月</option>' +
                '<option value="12"' + (wm===12 ? ' selected' : '') + '>1年</option>' +
                '<option value="24"' + (wm===24 ? ' selected' : '') + '>2年</option>';
            workerSectionHtml = '<div style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:8px;padding:12px;margin-bottom:16px;">' +
                '<div style="font-weight:600;color:#276749;margin-bottom:8px;">🔧 完工提交 Worker Completion</div>' +
                '<label style="display:block;font-size:0.85rem;margin-bottom:4px;">完工说明 Completion Note</label>' +
                '<textarea id="td-completion-note" class="sb-input" rows="3" placeholder="请描述完工情况…" style="margin-bottom:8px;">' + this.esc(t.completion_note || '') + '</textarea>' +
                '<label style="display:block;font-size:0.85rem;margin-bottom:4px;">保修期 Warranty</label>' +
                '<select id="td-warranty" class="sb-input" style="margin-bottom:8px;">' + warrantyOpts + '</select>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
                '<button class="sb-btn" style="min-height:44px;flex:1;" onclick="Maintenance.uploadPhoto(' + t.id + ',\'before\')">📷 施工前照片</button>' +
                '<button class="sb-btn" style="min-height:44px;flex:1;" onclick="Maintenance.uploadPhoto(' + t.id + ',\'after\')">📷 完工照片</button></div>' +
                (afterPhotos.length > 0 ? '<div style="margin-bottom:8px;"><div style="font-size:0.82rem;color:#276749;font-weight:600;margin-bottom:4px;">✅ 已上传完工照片 (' + afterPhotos.length + '张)</div>' + photoGrid(afterPhotos) + '</div>' : '') +
                (beforePhotos.length > 0 ? '<div style="margin-bottom:8px;"><div style="font-size:0.82rem;color:#4a5568;font-weight:600;margin-bottom:4px;">📷 已上传施工前照片 (' + beforePhotos.length + '张)</div>' + photoGrid(beforePhotos) + '</div>' : '') +
                '<button class="sb-btn primary" style="min-height:44px;width:100%;' + (!canComplete?'opacity:0.5;cursor:not-allowed;':'') + '" ' + (!canComplete?'disabled':'') + ' onclick="Maintenance.updateStatus(' + t.id + ',\'completed\')">✅ 完成工单' + (!hasAfterPhoto?' (需先上传完工照片)':'') + '</button></div>';
        }

        // Completion details
        const wLabel = m => !m ? '无' : m===12 ? '1年' : m===24 ? '2年' : m+'个月';
        let completionDetailsHtml = '';
        if (t.status === 'completed') {
            completionDetailsHtml = '<div style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:8px;padding:12px;margin-bottom:16px;">' +
                '<div style="font-weight:600;color:#276749;margin-bottom:6px;">✅ 完工信息</div>' +
                (t.completion_note ? '<div style="font-size:0.9rem;color:#4a5568;margin-bottom:6px;"><strong>完工说明:</strong> ' + this.esc(t.completion_note) + '</div>' : '') +
                '<div style="font-size:0.85rem;color:#4a5568;"><strong>保修期:</strong> ' + wLabel(t.warranty_months) + '</div></div>';
        }

        // Manager/supervisor extra actions
        let managerActionsHtml = '';
        if (isManager || isSupervisor) {
            let btns = '';
            if (!isDoneOrCancelled) btns += '<button class="sb-btn" style="min-height:44px;" onclick="Maintenance._showReassignForm(' + t.id + ')">🔄 重新指派 Reassign</button>';
            if (isManager && t.status === 'pending') btns += '<button class="sb-btn" style="min-height:44px;color:#718096;" onclick="Maintenance.updateStatus(' + t.id + ',\'cancelled\')">✕ 取消工单 Cancel</button>';
            if (isManager && ['pending','cancelled'].includes(t.status)) btns += '<button class="sb-btn" style="min-height:44px;color:#e53e3e;border-color:#e53e3e;" onclick="Maintenance._deleteTicket(' + t.id + ')">🗑️ 删除 Delete</button>';
            if (isManager && t.status === 'completed') btns += '<button class="sb-btn primary" style="min-height:44px;" onclick="Maintenance.shareTicket(' + t.id + ')">📤 生成分享链接 Share</button>';
            if (btns) managerActionsHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' + btns + '</div>';
        }

        const mc = document.getElementById('modal-container');
        if (!mc) return;
        mc.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''">
      <div class="modal-content" style="max-width:520px;width:95vw;padding:24px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
          <h3 style="margin:0;flex:1;font-size:1.05rem;">${this._badgeHtml(t.status)} ${this.esc(t.title)}</h3>
          <button class="sb-btn" style="min-height:44px;margin-left:8px;" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <div style="background:#f7fafc;border-radius:8px;padding:12px;margin-bottom:12px;font-size:0.88rem;color:#4a5568;">
          <div>${this.esc(t.description || '无描述')}</div>
          ${t.location ? `<div style="margin-top:4px;">📍 ${this.esc(t.location)}</div>` : ''}
          ${t.category ? `<div style="margin-top:6px;">${this._categoryBadgeHtml(t.category)}</div>` : ''}
          <div style="margin-top:6px;">👷 ${this.esc(t.assigned_name || '未指派')}</div>
          <div>📅 创建: ${t.created_at ? new Date(t.created_at).toLocaleString('zh-CN') : '—'}</div>
          ${t.scheduled_date ? `<div>🗓️ 预定: ${String(t.scheduled_date).substring(0,10)}</div>` : ''}
          ${t.completed_at ? `<div>✅ 完成: ${new Date(t.completed_at).toLocaleString('zh-CN')}</div>` : ''}
        </div>
        ${timelineHtml}
        ${quoteSectionHtml}
        ${ownerApprovalHtml}
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:4px;">📷 施工前照片</div>
          ${photoGrid(beforePhotos)}
        </div>
        ${workerSectionHtml}
        ${completionDetailsHtml}
        ${t.status === 'completed' ? `<div style="margin-bottom:16px;"><div style="font-weight:600;margin-bottom:4px;">✅ 完工照片</div>${photoGrid(afterPhotos)}</div>` : ''}
        ${managerActionsHtml}
      </div>
    </div>`;
        if (document.getElementById('td-total-display')) Maintenance._updateQuoteTotal();
    },

    _addQuoteItem() {
        const container = document.getElementById('td-items-container');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'td-item-row';
        row.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:6px;flex-wrap:wrap;';
        const iStyle = 'padding:6px;border:1px solid #bee3f8;border-radius:6px;font-size:0.85rem;';
        row.innerHTML =
            '<input class="td-item-name" type="text" placeholder="材料名称 Name" style="' + iStyle + 'flex:2;min-width:100px;">' +
            '<input class="td-item-qty" type="number" min="0" step="1" placeholder="Qty" style="' + iStyle + 'flex:1;min-width:48px;" oninput="Maintenance._updateQuoteTotal()">' +
            '<input class="td-item-unit" type="text" placeholder="ชิ้น" style="' + iStyle + 'flex:1;min-width:48px;">' +
            '<input class="td-item-price" type="number" min="0" step="0.01" placeholder="฿ Unit" style="' + iStyle + 'flex:1;min-width:64px;" oninput="Maintenance._updateQuoteTotal()">' +
            '<button onclick="this.parentElement.remove();Maintenance._updateQuoteTotal()" style="padding:6px 8px;border:1px solid #e53e3e;color:#e53e3e;background:transparent;border-radius:6px;cursor:pointer;min-height:44px;">✕</button>';
        container.appendChild(row);
    },

    _updateQuoteTotal() {
        let total = 0;
        document.querySelectorAll('.td-item-row').forEach(row => {
            const qty   = parseFloat(row.querySelector('.td-item-qty')?.value)   || 0;
            const price = parseFloat(row.querySelector('.td-item-price')?.value) || 0;
            total += qty * price;
        });
        total += parseFloat(document.getElementById('td-labor-cost')?.value) || 0;
        const el = document.getElementById('td-total-display');
        if (el) el.textContent = '฿' + total.toLocaleString();
    },

    async sendQuote(id) {
        const rows = document.querySelectorAll('.td-item-row');
        const quote_items = [];
        rows.forEach(row => {
            const name = (row.querySelector('.td-item-name')?.value || '').trim();
            if (!name) return;
            quote_items.push({
                name,
                qty:        parseFloat(row.querySelector('.td-item-qty')?.value)   || 0,
                unit:       (row.querySelector('.td-item-unit')?.value || '').trim(),
                unit_price: parseFloat(row.querySelector('.td-item-price')?.value) || 0
            });
        });
        const labor_cost   = parseFloat(document.getElementById('td-labor-cost')?.value) || 0;
        const quote_amount = quote_items.reduce((s, i) => s + i.qty * i.unit_price, 0) + labor_cost;
        if (quote_amount <= 0) { app.showToast('请输入有效报价金额 Enter a valid quote amount', 'error'); return; }
        const scheduled_date = document.getElementById('td-scheduled-date')?.value || null;
        try {
            const res = await apiRequest(`/api/maintenance/${id}/quote`, {method:'POST', body:JSON.stringify({quote_amount, quote_items, labor_cost, scheduled_date})});
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('报价已发送 Quote sent', 'success');
            await ProjectDashboard.loadMaintenancePanel();
            Maintenance.tickets = ProjectDashboard._maintenanceTickets;
            Maintenance.showTicketDetail(id);
        } catch(err) { app.showToast('发送失败: ' + err.message, 'error'); }
    },

    async approveQuote(id) {
        try {
            const res = await apiRequest(`/api/maintenance/${id}`, {method:'PUT', body:JSON.stringify({quote_status:'approved'})});
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('已确认接受 Approved', 'success');
            await ProjectDashboard.loadMaintenancePanel();
            Maintenance.tickets = ProjectDashboard._maintenanceTickets;
            Maintenance.showTicketDetail(id);
        } catch(err) { app.showToast('操作失败: ' + err.message, 'error'); }
    },

    async rejectQuote(id) {
        try {
            const res = await apiRequest(`/api/maintenance/${id}`, {method:'PUT', body:JSON.stringify({quote_status:'rejected'})});
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('已拒绝报价 Rejected', 'info');
            await ProjectDashboard.loadMaintenancePanel();
            Maintenance.tickets = ProjectDashboard._maintenanceTickets;
            Maintenance.showTicketDetail(id);
        } catch(err) { app.showToast('操作失败: ' + err.message, 'error'); }
    },

    async updateStatus(id, status) {
        try {
            const body = {status};
            if (status === 'completed') {
                body.completion_note  = document.getElementById('td-completion-note')?.value || null;
                const wv = document.getElementById('td-warranty')?.value;
                body.warranty_months  = wv ? parseInt(wv) : null;
            }
            const res = await apiRequest(`/api/maintenance/${id}`, {method:'PUT', body:JSON.stringify(body)});
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('工单已更新', 'success');
            await ProjectDashboard.loadMaintenancePanel();
        } catch(err) { app.showToast('更新失败: ' + err.message, 'error'); }
    },

    async uploadPhoto(ticketId, photoType) {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/jpeg,image/png';
        inp.onchange = async () => {
            if (!inp.files[0]) return;
            const fd = new FormData();
            fd.append('photo', inp.files[0]);
            // Use the ticket's own project_id (null for standalone tickets)
            const tkObj = this.tickets.find(x => x.id === ticketId);
            const projId = tkObj ? tkObj.project_id : null;
            if (projId) fd.append('project_id', projId);
            fd.append('ticket_id', ticketId);
            fd.append('photo_type', photoType);
            fd.append('photo_category', 'maintenance');
            const token = localStorage.getItem('authToken');
            try {
                app.showToast('上传中…', 'info');
                const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
                const r = await fetch(`${API_BASE}/api/photos/upload`, {method:'POST', headers:{'Authorization':`Bearer ${token}`}, body:fd});
                const json = await r.json();
                if (!json.success) throw new Error(json.message);
                app.showToast('照片已上传', 'success');
                await ProjectDashboard.loadMaintenancePanel();
                Maintenance.tickets = ProjectDashboard._maintenanceTickets;
                Maintenance.showTicketDetail(ticketId);
            } catch(err) { app.showToast('上传失败: ' + err.message, 'error'); }
        };
        inp.click();
    },

    async shareTicket(id) {
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
            const r = await fetch(`${API_BASE}/api/maintenance/${id}/share`, {method:'POST', headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}});
            const res = await r.json();
            if (!res.success) throw new Error(res.message);
            const {share_url} = res.data;
            const ticket = this.tickets.find(t => t.id === id);
            const msgText = `🛠️ 维修工单\n${ticket ? ticket.title : ''}\n${share_url}`;
            const mc = document.getElementById('modal-container');
            mc.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''"><div class="modal-content" style="max-width:420px;width:95vw;padding:24px;"><h3 style="margin:0 0 12px;">📤 分享工单 Share Ticket</h3><textarea id="share-msg-box" class="sb-input" rows="4" style="margin-bottom:12px;">${this.esc(msgText)}</textarea><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;"><button class="sb-btn" style="background:#06c755;color:#fff;border-color:#06c755;min-height:44px;" onclick="window.open('https://social-plugins.line.me/lineit/share?url='+encodeURIComponent('${this.esc(share_url)}')+'&text='+encodeURIComponent(document.getElementById('share-msg-box').value),'_blank')">💬 LINE 分享</button><button class="sb-btn" style="background:#07c160;color:#fff;border-color:#07c160;min-height:44px;" onclick="navigator.clipboard.writeText(document.getElementById('share-msg-box').value).then(()=>app.showToast('已复制 Copied!','success')).catch(()=>{document.getElementById('share-msg-box').select();document.execCommand('copy');})">💚 微信复制 WeChat Copy</button><button class="sb-btn" style="min-height:44px;" onclick="document.getElementById('modal-container').innerHTML=''">✕ 关闭</button></div></div></div>`;
        } catch(err) { app.showToast('分享失败: ' + err.message, 'error'); }
    },

    async _showReassignForm(ticketId) {
        let opts = '';
        try {
            const uRes = await apiRequest('/api/users/workers');
            (uRes.data || []).forEach(w => {
                opts += `<option value="${w.id}" data-name="${this.esc(w.full_name||w.username)}">${this.esc(w.full_name||w.username)}</option>`;
            });
        } catch(_) {}
        const mc = document.getElementById('modal-container');
        mc.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)document.getElementById('modal-container').innerHTML=''"><div class="modal-content" style="max-width:360px;width:95vw;padding:24px;"><h3 style="margin:0 0 12px;">🔄 重新指派 Reassign</h3><select id="reassign-worker" class="sb-input" style="margin-bottom:12px;"><option value="">— 选择工人 —</option>${opts}</select><div style="display:flex;gap:8px;justify-content:flex-end;"><button class="sb-btn" style="min-height:44px;" onclick="document.getElementById('modal-container').innerHTML=''">取消</button><button class="sb-btn primary" style="min-height:44px;" onclick="(function(){const sel=document.getElementById('reassign-worker');const v=sel.value;const n=sel.options[sel.selectedIndex]?.dataset.name||'';if(!v){app.showToast('请选择工人','error');return;}apiRequest('/api/maintenance/${ticketId}',{method:'PUT',body:JSON.stringify({assigned_to:v,assigned_name:n,status:'in-progress'})}).then(r=>{if(!r.success)throw new Error(r.message);document.getElementById('modal-container').innerHTML='';app.showToast('已重新指派','success');return ProjectDashboard.loadMaintenancePanel();}).then(()=>{}).catch(e=>app.showToast('失败: '+e.message,'error'));})()">确认指派</button></div></div></div>`;
    },

    async _deleteTicket(id) {
        if (!confirm('确认删除此工单？')) return;
        try {
            const res = await apiRequest(`/api/maintenance/${id}`, {method:'DELETE'});
            if (!res.success) throw new Error(res.message);
            document.getElementById('modal-container').innerHTML = '';
            app.showToast('工单已删除', 'success');
            await ProjectDashboard.loadMaintenancePanel();
        } catch(err) { app.showToast('删除失败: ' + err.message, 'error'); }
    }
};

window.Maintenance = Maintenance;
