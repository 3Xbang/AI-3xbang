// 材料管理模块
const MaterialManager = {
    currentProjectId: null,
    materials: [],

    // 初始化材料管理器
    init(projectId) {
        this.currentProjectId = projectId;
        this.loadMaterials();
        this.setupEventListeners();
    },

    // 设置事件监听
    setupEventListeners() {
        // 采购材料按钮
        document.getElementById('btn-purchase-material')?.addEventListener('click', () => {
            this.showPurchaseForm();
        });

        // 刷新按钮
        document.getElementById('btn-refresh-materials')?.addEventListener('click', () => {
            this.loadMaterials();
        });

        // 筛选状态
        document.getElementById('filter-material-status')?.addEventListener('change', (e) => {
            this.filterMaterials(e.target.value);
        });
    },

    // 加载材料列表
    async loadMaterials() {
        try {
            showLoading();
            const response = await API.materials.getList(this.currentProjectId);
            
            if (response.success) {
                this.materials = response.data;
                this.renderMaterialsList();
            } else {
                showError(response.message || '加载材料列表失败');
            }
        } catch (error) {
            console.error('Load materials error:', error);
            showError('加载材料列表失败');
        } finally {
            hideLoading();
        }
    },

    // 渲染材料列表
    renderMaterialsList() {
        const container = document.getElementById('materials-list');
        if (!container) return;

        if (this.materials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <p>${i18n.t('noMaterials')}</p>
                    <button class="btn btn-primary" onclick="MaterialManager.showPurchaseForm()">
                        ${i18n.t('purchaseMaterial')}
                    </button>
                </div>
            `;
            return;
        }

        const html = this.materials.map(material => this.renderMaterialCard(material)).join('');
        container.innerHTML = html;
    },

    // 渲染单个材料卡片
    renderMaterialCard(material) {
        const name = typeof material.material_name === 'string' 
            ? JSON.parse(material.material_name) 
            : material.material_name;
        const unit = typeof material.unit === 'string'
            ? JSON.parse(material.unit)
            : material.unit;

        const purchaseQty = parseFloat(material.purchase_quantity || 0);
        const receivedQty = parseFloat(material.received_quantity || 0);
        const usedQty = parseFloat(material.used_quantity || 0);
        const stockQty = material.stock || (receivedQty - usedQty);

        // 计算库存百分比
        const stockPercentage = receivedQty > 0 ? (stockQty / receivedQty * 100) : 0;
        
        // 状态颜色和文本
        const statusConfig = this.getStatusConfig(material.status, stockPercentage);

        return `
            <div class="material-card" data-material-id="${material.id}">
                <div class="material-header">
                    <div class="material-name">
                        <h3>${i18n.getLocalizedValue(name)}</h3>
                        <span class="material-code">${material.material_code || '-'}</span>
                    </div>
                    <div class="material-status status-${statusConfig.class}">
                        ${statusConfig.icon} ${i18n.t(statusConfig.text)}
                    </div>
                </div>

                <div class="material-stats">
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('purchaseQuantity')}</span>
                        <span class="stat-value">${purchaseQty.toFixed(2)} ${i18n.getLocalizedValue(unit)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('receivedQuantity')}</span>
                        <span class="stat-value">${receivedQty.toFixed(2)} ${i18n.getLocalizedValue(unit)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('usedQuantity')}</span>
                        <span class="stat-value">${usedQty.toFixed(2)} ${i18n.getLocalizedValue(unit)}</span>
                    </div>
                    <div class="stat-item stat-highlight">
                        <span class="stat-label">${i18n.t('stockQuantity')}</span>
                        <span class="stat-value stock-value">${stockQty.toFixed(2)} ${i18n.getLocalizedValue(unit)}</span>
                    </div>
                </div>

                <div class="stock-progress">
                    <div class="stock-bar">
                        <div class="stock-fill" style="width: ${Math.min(stockPercentage, 100)}%; background: ${statusConfig.color};"></div>
                    </div>
                    <span class="stock-percentage">${stockPercentage.toFixed(0)}%</span>
                </div>

                ${material.supplier ? `<div class="material-info"><strong>${i18n.t('supplier')}:</strong> ${material.supplier}</div>` : ''}
                ${material.expected_arrival_date ? `<div class="material-info"><strong>${i18n.t('expectedArrival')}:</strong> ${formatDate(material.expected_arrival_date)}</div>` : ''}
                ${material.actual_arrival_date ? `<div class="material-info"><strong>${i18n.t('actualArrival')}:</strong> ${formatDate(material.actual_arrival_date)}</div>` : ''}

                <div class="material-actions">
                    ${material.status === 'ordered' ? `
                        <button class="btn btn-sm btn-success" onclick="MaterialManager.showReceiveForm(${material.id})">
                            ✓ ${i18n.t('confirmArrival')}
                        </button>
                    ` : ''}
                    ${material.status === 'arrived' || material.status === 'in_use' ? `
                        <button class="btn btn-sm btn-primary" onclick="MaterialManager.showUseForm(${material.id})">
                            📤 ${i18n.t('useMaterial')}
                        </button>
                    ` : ''}
                    ${material.status === 'depleted' ? `
                        <button class="btn btn-sm btn-warning" onclick="MaterialManager.showPurchaseForm(${material.id})">
                            🔄 ${i18n.t('reorder')}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // 获取状态配置
    getStatusConfig(status, stockPercentage) {
        const configs = {
            ordered: { class: 'ordered', icon: '⏳', text: 'ordered', color: '#3498db' },
            arrived: { class: 'arrived', icon: '✅', text: 'arrived', color: '#2ecc71' },
            in_use: { class: 'in-use', icon: '🔄', text: 'inUse', color: '#f39c12' },
            depleted: { class: 'depleted', icon: '🚫', text: 'depleted', color: '#e74c3c' }
        };

        const config = configs[status] || configs.ordered;

        // 低库存警告
        if ((status === 'arrived' || status === 'in_use') && stockPercentage < 20) {
            config.class = 'low-stock';
            config.icon = '⚠️';
            config.text = 'lowStock';
            config.color = '#e67e22';
        }

        return config;
    },

    // 显示采购表单
    showPurchaseForm(materialId = null) {
        const isReorder = materialId !== null;
        const material = isReorder ? this.materials.find(m => m.id === materialId) : null;

        const formHtml = `
            <div class="modal-overlay" id="purchase-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${isReorder ? i18n.t('reorderMaterial') : i18n.t('purchaseMaterial')}</h2>
                        <button class="modal-close" onclick="MaterialManager.closeModal('purchase-modal')">&times;</button>
                    </div>
                    <form id="purchase-form" class="modal-form">
                        <div class="form-group">
                            <label>${i18n.t('materialName')} *</label>
                            <input type="text" id="material_name_zh" placeholder="${i18n.t('chinese')}" required 
                                value="${material ? i18n.getLocalizedValue(material.material_name, 'zh') : ''}">
                            <input type="text" id="material_name_th" placeholder="${i18n.t('thai')}" 
                                value="${material ? i18n.getLocalizedValue(material.material_name, 'th') : ''}">
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('materialCode')}</label>
                            <input type="text" id="material_code" placeholder="MAT-001" 
                                value="${material?.material_code || ''}">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>${i18n.t('purchaseQuantity')} *</label>
                                <input type="number" id="purchase_quantity" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label>${i18n.t('unit')} *</label>
                                <input type="text" id="unit_zh" placeholder="${i18n.t('chinese')}" required 
                                    value="${material ? i18n.getLocalizedValue(material.unit, 'zh') : ''}">
                                <input type="text" id="unit_th" placeholder="${i18n.t('thai')}" 
                                    value="${material ? i18n.getLocalizedValue(material.unit, 'th') : ''}">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>${i18n.t('unitPrice')}</label>
                                <input type="number" id="unit_price" step="0.01" min="0" placeholder="0.00">
                            </div>
                            <div class="form-group">
                                <label>${i18n.t('supplier')}</label>
                                <input type="text" id="supplier" placeholder="${i18n.t('supplierName')}">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('expectedArrival')}</label>
                            <input type="date" id="expected_arrival_date">
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="MaterialManager.closeModal('purchase-modal')">
                                ${i18n.t('cancel')}
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${i18n.t('confirm')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHtml);
        document.getElementById('purchase-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPurchase();
        });
    },

    // 提交采购
    async submitPurchase() {
        const data = {
            project_id: this.currentProjectId,
            material_name: {
                zh: document.getElementById('material_name_zh').value.trim(),
                th: document.getElementById('material_name_th').value.trim() || document.getElementById('material_name_zh').value.trim()
            },
            material_code: document.getElementById('material_code').value.trim() || null,
            purchase_quantity: parseFloat(document.getElementById('purchase_quantity').value),
            unit: {
                zh: document.getElementById('unit_zh').value.trim(),
                th: document.getElementById('unit_th').value.trim() || document.getElementById('unit_zh').value.trim()
            },
            unit_price: parseFloat(document.getElementById('unit_price').value) || 0,
            supplier: document.getElementById('supplier').value.trim() || null,
            expected_arrival_date: document.getElementById('expected_arrival_date').value || null
        };

        try {
            showLoading();
            const response = await API.materials.purchase(data);
            
            if (response.success) {
                showSuccess(i18n.t('purchaseSuccess'));
                this.closeModal('purchase-modal');
                this.loadMaterials();
            } else {
                showError(response.message || i18n.t('purchaseFailed'));
            }
        } catch (error) {
            console.error('Purchase material error:', error);
            showError(i18n.t('purchaseFailed'));
        } finally {
            hideLoading();
        }
    },

    // 显示到货确认表单
    showReceiveForm(materialId) {
        const material = this.materials.find(m => m.id === materialId);
        if (!material) return;

        const name = i18n.getLocalizedValue(material.material_name);
        const unit = i18n.getLocalizedValue(material.unit);

        const formHtml = `
            <div class="modal-overlay" id="receive-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${i18n.t('confirmArrival')}</h2>
                        <button class="modal-close" onclick="MaterialManager.closeModal('receive-modal')">&times;</button>
                    </div>
                    <form id="receive-form" class="modal-form">
                        <div class="info-box">
                            <strong>${i18n.t('material')}:</strong> ${name}<br>
                            <strong>${i18n.t('purchaseQuantity')}:</strong> ${material.purchase_quantity} ${unit}
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('actualReceivedQuantity')} *</label>
                            <input type="number" id="received_quantity" step="0.01" min="0" 
                                value="${material.purchase_quantity}" required>
                            <small class="form-hint">${i18n.t('unit')}: ${unit}</small>
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('actualArrival')} *</label>
                            <input type="date" id="actual_arrival_date" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('notes')}</label>
                            <textarea id="receive_notes" rows="3" placeholder="${i18n.t('anyDifferences')}"></textarea>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="MaterialManager.closeModal('receive-modal')">
                                ${i18n.t('cancel')}
                            </button>
                            <button type="submit" class="btn btn-success">
                                ${i18n.t('confirmArrival')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHtml);
        document.getElementById('receive-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReceive(materialId);
        });
    },

    // 提交到货确认
    async submitReceive(materialId) {
        const data = {
            received_quantity: parseFloat(document.getElementById('received_quantity').value),
            actual_arrival_date: document.getElementById('actual_arrival_date').value,
            notes: document.getElementById('receive_notes').value.trim() || null
        };

        try {
            showLoading();
            const response = await API.materials.receive(materialId, data);
            
            if (response.success) {
                showSuccess(i18n.t('receiveSuccess'));
                this.closeModal('receive-modal');
                this.loadMaterials();
            } else {
                showError(response.message || i18n.t('receiveFailed'));
            }
        } catch (error) {
            console.error('Receive material error:', error);
            showError(i18n.t('receiveFailed'));
        } finally {
            hideLoading();
        }
    },

    // 显示使用材料表单
    async showUseForm(materialId) {
        const material = this.materials.find(m => m.id === materialId);
        if (!material) return;

        const name = i18n.getLocalizedValue(material.material_name);
        const unit = i18n.getLocalizedValue(material.unit);
        const stock = material.stock || 0;

        // 加载项目的工序列表
        let processesHtml = '<option value="">加载中...</option>';
        try {
            const response = await API.processes.getList(this.currentProjectId);
            if (response.success && response.data.length > 0) {
                processesHtml = '<option value="">' + i18n.t('selectProcess') + '</option>' +
                    response.data
                        .filter(p => p.status === 'in_progress' || p.status === 'not_started')
                        .map(p => {
                            const processName = i18n.getLocalizedValue(p.process_name);
                            return `<option value="${p.id}">${processName}</option>`;
                        })
                        .join('');
            } else {
                processesHtml = '<option value="">' + i18n.t('noActiveProcesses') + '</option>';
            }
        } catch (error) {
            console.error('Load processes error:', error);
        }

        const formHtml = `
            <div class="modal-overlay" id="use-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${i18n.t('useMaterial')}</h2>
                        <button class="modal-close" onclick="MaterialManager.closeModal('use-modal')">&times;</button>
                    </div>
                    <form id="use-form" class="modal-form">
                        <div class="info-box">
                            <strong>${i18n.t('material')}:</strong> ${name}<br>
                            <strong>${i18n.t('currentStock')}:</strong> <span class="highlight">${stock.toFixed(2)} ${unit}</span>
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('selectProcess')} *</label>
                            <select id="process_execution_id" required>
                                ${processesHtml}
                            </select>
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('quantityUsed')} *</label>
                            <input type="number" id="quantity_used" step="0.01" min="0.01" max="${stock}" required>
                            <small class="form-hint">${i18n.t('unit')}: ${unit}, ${i18n.t('maxAvailable')}: ${stock.toFixed(2)}</small>
                        </div>

                        <div class="form-group">
                            <label>${i18n.t('usageDate')} *</label>
                            <input type="date" id="usage_date" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="MaterialManager.closeModal('use-modal')">
                                ${i18n.t('cancel')}
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${i18n.t('confirmUse')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHtml);
        document.getElementById('use-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitUse(materialId);
        });
    },

    // 提交使用材料
    async submitUse(materialId) {
        const data = {
            process_execution_id: parseInt(document.getElementById('process_execution_id').value),
            quantity_used: parseFloat(document.getElementById('quantity_used').value),
            usage_date: document.getElementById('usage_date').value
        };

        if (!data.process_execution_id) {
            showError(i18n.t('pleaseSelectProcess'));
            return;
        }

        try {
            showLoading();
            const response = await API.materials.use(materialId, data);
            
            if (response.success) {
                showSuccess(i18n.t('useSuccess'));
                this.closeModal('use-modal');
                this.loadMaterials();
            } else {
                showError(response.message || i18n.t('useFailed'));
            }
        } catch (error) {
            console.error('Use material error:', error);
            showError(i18n.t('useFailed'));
        } finally {
            hideLoading();
        }
    },

    // 筛选材料
    filterMaterials(status) {
        const cards = document.querySelectorAll('.material-card');
        cards.forEach(card => {
            if (!status || card.querySelector('.material-status').classList.contains(`status-${status}`)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    },

    // 关闭模态框
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }
};

// 辅助函数
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
}

function showLoading() {
    // 实现加载指示器
    console.log('Loading...');
}

function hideLoading() {
    console.log('Loading complete');
}

function showSuccess(message) {
    alert(message);
}

function showError(message) {
    alert(message);
}
