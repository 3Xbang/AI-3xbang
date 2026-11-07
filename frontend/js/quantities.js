// 工程量设置功能
// Project Quantities Management

const QTY_SECTIONS = {
    A: { zh: 'A — 地基与基础', th: 'A — Foundation' },
    B: { zh: 'B — 主体结构', th: 'B — Structure' },
    C: { zh: 'C — 屋面工程', th: 'C — Roofing' },
    D: { zh: 'D — 砌体与隔墙', th: 'D — Masonry' },
    E: { zh: 'E — 抹灰与贴砖', th: 'E — Plastering & Tiling' },
    F: { zh: 'F — 门窗工程', th: 'F — Doors & Windows' },
    G: { zh: 'G — 电气工程', th: 'G — Electrical' },
    H: { zh: 'H — 给排水', th: 'H — Plumbing' },
    I: { zh: 'I — 装饰装修', th: 'I — Finishing' },
    X: { zh: 'X — 其他', th: 'X — Others' }
};

if (typeof app !== 'undefined') {
    // 显示工程量设置表单
    app.showQuantitiesForm = async function(projectId) {
        try {
            this.showLoading();

            // 获取当前工程量
            const result = await api.getProjectQuantities(projectId);

            if (!result.success) {
                this.showToast('加载失败', 'error');
                return;
            }

            const quantities = result.data || [];

            // Group by section letter (master_code[0] → section, null → X)
            const sections = {};
            for (const q of quantities) {
                const letter = (q.master_code && q.master_code[0])
                    ? q.master_code[0].toUpperCase()
                    : 'X';
                if (!sections[letter]) sections[letter] = [];
                sections[letter].push(q);
            }

            const sectionHtml = Object.entries(sections)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([letter, rows]) => {
                    const secDef = QTY_SECTIONS[letter] || { zh: letter + ' — 其他', th: letter + ' — Other' };
                    const hasQty = rows.some(q => q.planned_quantity > 0);

                    const rowsHtml = rows.map(q => {
                        // input name: master_code@floor_no or master_code or process_code fallback
                        let inputName;
                        if (q.master_code && q.floor_no != null) {
                            inputName = q.master_code + '@' + q.floor_no;
                        } else if (q.master_code) {
                            inputName = q.master_code;
                        } else {
                            inputName = q.process_code;
                        }

                        const badgeHtml = q.planned_quantity > 0
                            ? `<span class="qty-badge" style="display:inline-block;background:#d1fae5;color:#065f46;border-radius:10px;padding:1px 8px;font-size:11px;margin-left:6px;font-weight:600">BOQ: ${q.planned_quantity}</span>`
                            : '';

                        return `<tr style="border-bottom:1px solid #f1f5f9">
                            <td style="padding:8px 12px">
                                <div style="font-weight:600;font-size:13px">${q.master_code || q.process_code}${badgeHtml}</div>
                                <div style="color:#6b7280;font-size:12px">${typeof getI18nField === 'function' ? getI18nField(q, 'process_name') : (q.process_name_zh || q.process_name || '')}</div>
                                ${q.floor_no != null ? `<div style="color:#94a3b8;font-size:11px">楼层 ${q.floor_no}</div>` : ''}
                            </td>
                            <td style="padding:8px 12px;text-align:center;width:140px">
                                <input type="number" step="0.01" min="0"
                                    name="${inputName}"
                                    value="${q.planned_quantity || ''}"
                                    placeholder="0"
                                    style="width:110px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;text-align:center;font-size:13px">
                            </td>
                            <td style="padding:8px 12px;text-align:center;color:#6b7280;font-size:13px;width:70px">
                                ${typeof getUnitText === 'function' ? getUnitText(q.unit) : (q.unit || '')}
                            </td>
                        </tr>`;
                    }).join('');

                    return `<details ${hasQty ? 'open' : ''} style="margin-bottom:8px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                        <summary style="padding:10px 14px;background:#f8fafc;cursor:pointer;font-weight:700;font-size:14px;user-select:none;list-style:none;display:flex;justify-content:space-between;align-items:center">
                            <span>${secDef.zh} <small style="font-weight:400;color:#64748b">${secDef.th}</small></span>
                            <span style="color:#94a3b8;font-size:12px">${rows.length} 项</span>
                        </summary>
                        <table style="width:100%;border-collapse:collapse">
                            <thead>
                                <tr style="background:#f3f4f6">
                                    <th style="padding:6px 12px;text-align:left;font-size:12px;color:#475569;font-weight:600">工序</th>
                                    <th style="padding:6px 12px;text-align:center;font-size:12px;color:#475569;font-weight:600;width:140px">计划数量</th>
                                    <th style="padding:6px 12px;text-align:center;font-size:12px;color:#475569;font-weight:600;width:70px">单位</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </details>`;
                }).join('');

            const modal = this.createModal('📐 设置工程量 Set Quantities', `
                <form id="quantities-form">
                    <div style="max-height:60vh;overflow-y:auto;margin-bottom:1rem;padding-right:4px">
                        <p style="color:#6b7280;margin-bottom:12px;font-size:13px">
                            📋 请根据设计图纸填写每个工序的计划工程量。这将用于计算进度、材料和工期。
                        </p>
                        ${sectionHtml || '<p style="color:#94a3b8;text-align:center;padding:24px">暂无工序数据</p>'}
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">取消</button>
                        <button type="submit" class="btn-primary">保存工程量</button>
                    </div>
                </form>
            `);

            document.getElementById('quantities-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveProjectQuantities(projectId);
            });

            this.hideLoading();
        } catch (error) {
            this.showToast('加载失败', 'error');
            this.hideLoading();
        }
    };

    // 保存工程量
    app.saveProjectQuantities = async function(projectId) {
        const form = document.getElementById('quantities-form');
        if (!form) return;

        const quantities = {};
        form.querySelectorAll('input[type=number]').forEach(input => {
            const num = parseFloat(input.value);
            if (!isNaN(num) && num > 0 && input.name) {
                quantities[input.name] = num;
            }
        });

        if (Object.keys(quantities).length === 0) {
            this.showToast('请至少填写一个工序的工程量', 'error');
            return;
        }

        try {
            this.showLoading();
            const result = await api.setProjectQuantities(projectId, quantities);

            if (result.success) {
                this.closeModal();
                this.showToast(result.message || '工程量设置成功');
                // 刷新工序列表
                if (typeof this.loadProcesses === 'function') {
                    this.loadProcesses(projectId);
                }
            }
        } catch (error) {
            this.showToast('保存失败', 'error');
        } finally {
            this.hideLoading();
        }
    };
}

// 添加API方法
if (typeof api !== 'undefined') {
    api.getProjectQuantities = (projectId) => apiRequest(`/api/projects/${projectId}/quantities`);

    api.setProjectQuantities = (projectId, quantities) => apiRequest(`/api/projects/${projectId}/set-quantities`, {
        method: 'POST',
        body: JSON.stringify({ quantities })
    });
}

console.log('✓ 工程量管理功能已加载');
