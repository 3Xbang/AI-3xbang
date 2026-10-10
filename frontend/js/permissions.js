// 权限管理模块
const PermissionManager = {
    // 获取当前用户角色
    getCurrentUserRole() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.role || null;
    },

    // 获取当前用户信息
    getCurrentUser() {
        return JSON.parse(localStorage.getItem('user') || '{}');
    },

    // 检查是否是管理者
    isManager() {
        return this.getCurrentUserRole() === 'manager';
    },

    // 检查是否是采购者
    isPurchaser() {
        return this.getCurrentUserRole() === 'purchaser';
    },

    // 检查是否是执行者
    isExecutor() {
        return this.getCurrentUserRole() === 'executor';
    },

    // 检查是否可以管理用户 (仅管理者)
    canManageUsers() {
        return this.isManager();
    },

    // 检查是否可以管理项目 (仅管理者)
    canManageProjects() {
        return this.isManager();
    },

    // 检查是否可以管理项目成员 (仅管理者)
    canManageProjectMembers() {
        return this.isManager();
    },

    // 检查是否可以采购材料 (管理者或采购者)
    canPurchaseMaterials() {
        return this.isManager() || this.isPurchaser();
    },

    // 检查是否可以分配任务 (管理者或采购者)
    canAssignTasks() {
        return this.isManager() || this.isPurchaser();
    },

    // 检查是否可以查看所有项目 (管理者或采购者)
    canViewAllProjects() {
        return this.isManager() || this.isPurchaser();
    },

    // 检查是否只能查看分配的项目 (执行者)
    canOnlyViewAssignedProjects() {
        return this.isExecutor();
    },

    // 检查是否可以更新工序进度 (所有角色)
    canUpdateProcessProgress() {
        return true; // 所有角色都可以更新进度
    },

    // 检查是否可以上传照片 (所有角色)
    canUploadPhotos() {
        return true; // 所有角色都可以上传照片
    },

    // 显示或隐藏元素基于权限
    toggleElementByPermission(elementId, hasPermission) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = hasPermission ? '' : 'none';
        }
    },

    // 显示或隐藏多个元素基于权限
    toggleElementsByPermission(selector, hasPermission) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.style.display = hasPermission ? '' : 'none';
        });
    },

    // 禁用或启用元素基于权限
    disableElementByPermission(elementId, hasPermission) {
        const element = document.getElementById(elementId);
        if (element) {
            element.disabled = !hasPermission;
            if (!hasPermission) {
                element.style.opacity = '0.5';
                element.style.cursor = 'not-allowed';
            }
        }
    },

    // 显示权限拒绝消息
    showPermissionDenied(message) {
        const defaultMessage = t ? t('common.permissionDenied') : (
            currentLang === 'zh' 
                ? '抱歉，您没有权限执行此操作' 
                : 'ขออภัย คุณไม่มีสิทธิ์ในการดำเนินการนี้'
        );
        
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message || defaultMessage, 'error');
        } else {
            alert(message || defaultMessage);
        }
    },

    // 为按钮添加权限检查
    addPermissionCheckToButton(buttonElement, hasPermission, deniedMessage) {
        if (!buttonElement) return;

        if (!hasPermission) {
            buttonElement.style.display = 'none';
            // 或者禁用按钮并添加提示
            // buttonElement.disabled = true;
            // buttonElement.title = deniedMessage || '无权限';
            // buttonElement.style.opacity = '0.5';
            // buttonElement.style.cursor = 'not-allowed';
        }
    },

    // 初始化页面权限
    initializePagePermissions() {
        const role = this.getCurrentUserRole();
        
        // 用户管理菜单 - 仅管理者可见
        this.toggleElementByPermission('nav-users', this.canManageUsers());
        
        // 采购材料按钮 - 管理者和采购者可见
        this.toggleElementByPermission('btn-purchase-material', this.canPurchaseMaterials());
        
        // 新建项目按钮 - 仅管理者可见
        const addProjectButtons = document.querySelectorAll('[onclick*="showProjectForm"]');
        addProjectButtons.forEach(btn => {
            btn.style.display = this.canManageProjects() ? '' : 'none';
        });

        // 根据角色显示欢迎信息
        console.log(`Permission Manager initialized for role: ${role}`);
    },

    // 获取角色显示名称
    getRoleDisplayName(role) {
        const roleNames = {
            zh: {
                manager: '管理者',
                purchaser: '采购者',
                executor: '执行者'
            },
            th: {
                manager: 'ผู้จัดการ',
                purchaser: 'ผู้จัดซื้อ',
                executor: 'ผู้ปฏิบัติงาน'
            }
        };

        return roleNames[currentLang]?.[role] || role;
    },

    // 检查并执行需要权限的操作
    checkAndExecute(hasPermission, callback, deniedMessage) {
        if (hasPermission) {
            if (typeof callback === 'function') {
                callback();
            }
        } else {
            this.showPermissionDenied(deniedMessage);
        }
    }
};

// 在页面加载时初始化权限
if (typeof window !== 'undefined') {
    window.PermissionManager = PermissionManager;
}
