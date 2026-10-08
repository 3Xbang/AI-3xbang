// 照片管理模块
const photoManager = {
    currentProjectId: null,
    selectedFiles: [],
    
    // 初始化
    init(projectId) {
        this.currentProjectId = projectId;
        this.loadPhotos();
    },
    
    // 加载照片列表
    async loadPhotos() {
        if (!this.currentProjectId) {
            console.warn('No project selected');
            return;
        }
        
        try {
            app.showLoading();
            const result = await api.getProjectPhotos(this.currentProjectId);
            
            if (result.success) {
                this.renderPhotos(result.data);
            }
        } catch (error) {
            console.error('Failed to load photos:', error);
            app.showToast('加载失败', 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 渲染照片网格
    renderPhotos(photos) {
        const container = document.getElementById('photos-grid');
        if (!container) return;
        
        if (photos.length === 0) {
            container.innerHTML = '<p class="empty-hint">暂无照片</p>';
            return;
        }
        
        container.innerHTML = photos.map(photo => this.renderPhotoCard(photo)).join('');
    },
    
    // 渲染单个照片卡片
    renderPhotoCard(photo) {
        const uploadTime = new Date(photo.upload_time).toLocaleString('zh-CN');
        const fileSize = this.formatFileSize(photo.file_size);
        
        return `
            <div class="photo-card" onclick="photoManager.viewPhoto(${photo.id})">
                <div class="photo-image" style="background-image: url('${photo.photo_url}')"></div>
                <div class="photo-info">
                    <div class="photo-type">${this.getPhotoTypeText(photo.photo_type)}</div>
                    <div class="photo-time">${uploadTime}</div>
                    <div class="photo-size">${fileSize}</div>
                </div>
            </div>
        `;
    },
    
    // 显示上传表单
    showUploadForm(processExecutionId = null) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>上传照片</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <form id="photo-upload-form" class="modal-body">
                    <div class="form-group">
                        <label>选择照片 *</label>
                        <input type="file" id="photo-file" accept="image/jpeg,image/png,image/jpg" multiple required>
                        <small>支持 JPG、PNG 格式，最大 5MB</small>
                    </div>
                    
                    <div class="form-group">
                        <label>照片类型</label>
                        <select id="photo-type">
                            <option value="process">工序照片</option>
                            <option value="material">材料照片</option>
                            <option value="issue">问题照片</option>
                            <option value="other">其他</option>
                        </select>
                    </div>
                    
                    ${processExecutionId ? `
                        <input type="hidden" id="process-execution-id" value="${processExecutionId}">
                    ` : `
                        <div class="form-group">
                            <label>关联工序（可选）</label>
                            <select id="process-execution-id">
                                <option value="">无</option>
                            </select>
                        </div>
                    `}
                    
                    <div id="preview-container" class="preview-container"></div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
                        <button type="submit" class="btn-primary">上传</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定文件选择事件
        document.getElementById('photo-file').addEventListener('change', (e) => {
            this.selectedFiles = Array.from(e.target.files);
            this.previewFiles(this.selectedFiles);
        });
        
        // 绑定表单提交
        document.getElementById('photo-upload-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.uploadPhotos(modal);
        });
        
        // 如果没有指定工序，加载工序列表
        if (!processExecutionId) {
            this.loadProcessesForSelect();
        }
    },
    
    // 预览选择的文件
    previewFiles(files) {
        const container = document.getElementById('preview-container');
        container.innerHTML = '';
        
        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.createElement('div');
                preview.className = 'photo-preview';
                preview.innerHTML = `
                    <img src="${e.target.result}" alt="${file.name}">
                    <button type="button" class="remove-photo" onclick="photoManager.removeFile(${index})">✕</button>
                    <div class="file-name">${file.name}</div>
                `;
                container.appendChild(preview);
            };
            reader.readAsDataURL(file);
        });
    },
    
    // 移除文件
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.previewFiles(this.selectedFiles);
    },
    
    // 上传照片
    async uploadPhotos(modal) {
        if (this.selectedFiles.length === 0) {
            app.showToast('请选择照片', 'warning');
            return;
        }
        
        const photoType = document.getElementById('photo-type').value;
        const processExecutionId = document.getElementById('process-execution-id')?.value || null;
        
        try {
            app.showLoading('上传中...');
            
            // 逐个上传
            for (let i = 0; i < this.selectedFiles.length; i++) {
                const file = this.selectedFiles[i];
                const formData = new FormData();
                formData.append('photo', file);
                formData.append('project_id', this.currentProjectId);
                formData.append('photo_type', photoType);
                if (processExecutionId) {
                    formData.append('process_execution_id', processExecutionId);
                }
                
                await api.uploadPhoto(formData);
            }
            
            app.showToast(`成功上传 ${this.selectedFiles.length} 张照片`, 'success');
            modal.remove();
            this.loadPhotos();
            
        } catch (error) {
            app.showToast('上传失败: ' + (error.message || '未知错误'), 'error');
        } finally {
            app.hideLoading();
        }
    },
    
    // 加载工序列表用于选择
    async loadProcessesForSelect() {
        try {
            const result = await api.getProcesses(this.currentProjectId);
            if (result.success) {
                const select = document.getElementById('process-execution-id');
                select.innerHTML = '<option value="">无</option>' +
                    result.data.map(p => {
                        const name = typeof p.process_name === 'string' 
                            ? JSON.parse(p.process_name)[currentLang]
                            : p.process_name[currentLang];
                        return `<option value="${p.id}">${p.process_code} - ${name}</option>`;
                    }).join('');
            }
        } catch (error) {
            console.error('Failed to load processes:', error);
        }
    },
    
    // 查看照片
    viewPhoto(photoId) {
        // 创建全屏查看器
        const modal = document.createElement('div');
        modal.className = 'photo-viewer-overlay';
        modal.onclick = () => modal.remove();
        
        // 这里应该获取照片详情，简化版本直接从DOM获取
        const photoCard = event.currentTarget;
        const photoUrl = photoCard.querySelector('.photo-image').style.backgroundImage
            .replace('url("', '').replace('")', '');
        
        modal.innerHTML = `
            <div class="photo-viewer-content" onclick="event.stopPropagation()">
                <button class="photo-viewer-close" onclick="this.closest('.photo-viewer-overlay').remove()">✕</button>
                <img src="${photoUrl}" alt="照片">
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },
    
    // 获取照片类型文本
    getPhotoTypeText(type) {
        const types = {
            'process': '工序照片',
            'material': '材料照片',
            'issue': '问题照片',
            'other': '其他'
        };
        return types[type] || type;
    }
};

// 导出到全局
window.photoManager = photoManager;
