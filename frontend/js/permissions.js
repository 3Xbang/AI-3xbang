// permissions.js — 5角色权限系统
// manager(系统管理员), owner(业主), supervisor(工地主管), foreman(工头), purchaser(采购员)
// NOTE: The non-manager rows of PERMISSIONS are also mirrored in UM_ROLE_DEFAULTS (frontend/js/user-manager.js).
// Keep both tables in sync when role defaults change.

const PERMISSIONS = {
    manager:    { view_site:true,  view_gantt:true,  view_overview:true,  manage_projects:true,  purchase_material:true,  assign_task:true,  manage_users:true,  view_photos:true,  view_drawings:true  },
    owner:      { view_site:true,  view_gantt:true,  view_overview:true,  manage_projects:false, purchase_material:false, assign_task:false, manage_users:false, view_photos:true,  view_drawings:true  },
    supervisor: { view_site:true,  view_gantt:true,  view_overview:true,  manage_projects:true,  purchase_material:true,  assign_task:true,  manage_users:false, view_photos:true,  view_drawings:true  },
    foreman:    { view_site:true,  view_gantt:false, view_overview:false, manage_projects:false, purchase_material:false, assign_task:true,  manage_users:false, view_photos:true,  view_drawings:true  },
    purchaser:  { view_site:false, view_gantt:true,  view_overview:false, manage_projects:false, purchase_material:true,  assign_task:false, manage_users:false, view_photos:true,  view_drawings:true  },
    patrol:     { view_site:true,  view_gantt:false, view_overview:false, manage_projects:false, purchase_material:false, assign_task:false, manage_users:false, view_photos:true,  view_drawings:true  },
    worker:     { view_site:true,  view_gantt:false, view_overview:false, manage_projects:false, purchase_material:false, assign_task:false, manage_users:false, view_photos:true,  view_drawings:true  }
};

const PermissionManager = {

    getCurrentUserRole() {
        return (JSON.parse(localStorage.getItem('user') || '{}')).role || null;
    },

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('user') || '{}');
    },

    role() { return this.getCurrentUserRole(); },

    // ── 角色判断 ──
    isManager()    { return this.role() === 'manager'; },
    isOwner()      { return this.role() === 'owner'; },
    isSupervisor() { return this.role() === 'supervisor'; },
    isForeman()    { return this.role() === 'foreman'; },
    isPurchaser()  { return this.role() === 'purchaser'; },
    isPatrol()     { return this.role() === 'patrol'; },

    // 兼容旧调用
    isExecutor()   { return this.isForeman(); },

    // ── 权限判断 ──

    // 只有系统管理员可以管系统（默认），但自定义权限可以覆盖
    canManageUsers()          { return this.hasPermission('manage_users'); },
    canManageProjects()       { return this.hasPermission('manage_projects'); }, // 创建/删除项目、生成计划
    canManageProjectMembers() { return this.isManager(); }, // always manager-only, not in the 7 custom keys

    // 可以看项目完整内容（manager + owner + supervisor + purchaser）
    canViewProjectData() {
        return ['manager','owner','supervisor','purchaser'].includes(this.role());
    },

    // 可以分配工作（manager + supervisor，或自定义覆盖）
    canAssignTasks() {
        return this.hasPermission('assign_task');
    },

    // 可以加入正在做 - 启动分配的任务 (manager + supervisor + foreman)
    canStartAssignedTask() {
        return ['manager', 'supervisor', 'foreman'].includes(this.role());
    },

    // 可以采购材料（manager + supervisor + purchaser，或自定义覆盖）
    canPurchaseMaterials() {
        return this.hasPermission('purchase_material');
    },

    // 可以接收入库（manager + supervisor + foreman + purchaser）
    canReceiveMaterials() {
        return ['manager','supervisor','foreman','purchaser'].includes(this.role());
    },

    // 可以上传照片（所有除 owner）
    canUploadPhotos() {
        return !this.isOwner();
    },

    // 可以更新工序进度（manager + supervisor + foreman）
    canUpdateProcessProgress() {
        return ['manager','supervisor','foreman'].includes(this.role());
    },

    // 可以看甘特图/进度计划（manager+owner+supervisor+purchaser，或自定义覆盖）
    canViewGantt() {
        return this.hasPermission('view_gantt');
    },

    // 可以看今日现场（manager+owner+supervisor+foreman+patrol+worker，或自定义覆盖）
    canViewSite() {
        return this.hasPermission('view_site');
    },

    // 可以看材料设备
    canViewMaterials() {
        return ['manager','supervisor','foreman','purchaser'].includes(this.role());
    },

    // 可以看总览/报告（manager+owner+supervisor，或自定义覆盖）
    canViewOverview() {
        return this.hasPermission('view_overview');
    },

    canViewPhotos()   { return this.hasPermission('view_photos');   },
    canViewDrawings() { return this.hasPermission('view_drawings'); },

    // 旧兼容
    canViewAllProjects()        { return this.isManager(); },
    canOnlyViewAssignedProjects(){ return !this.isManager(); },

    // ── 显示名称 ──
    getRoleDisplayName(role) {
        return {
            manager:    '系统管理员 System Admin',
            owner:      '业主 Project Owner',
            supervisor: '工地主管 Site Supervisor',
            foreman:    '工头 Foreman',
            purchaser:  '采购员 Purchaser',
            patrol:     '巡逻员 Security'
        }[role] || role;
    },

    getRoleBadgeIcon(role) {
        return { manager:'⚙️', owner:'👑', supervisor:'🏗️', foreman:'🪚', purchaser:'🛒', patrol:'🔦' }[role] || '👤';
    },

    // ── 初始化页面权限 ──
    initializePagePermissions() {
        const btn = document.getElementById('btn-user-mgmt');
        if (btn) btn.style.display = this.canManageUsers() ? '' : 'none';
        console.log('Role:', this.role());
    },

    // ── 工具方法 ──
    toggleElementByPermission(id, ok) {
        const el = document.getElementById(id);
        if (el) el.style.display = ok ? '' : 'none';
    },
    toggleElementsByPermission(sel, ok) {
        document.querySelectorAll(sel).forEach(el => { el.style.display = ok ? '' : 'none'; });
    },
    showPermissionDenied(msg) {
        const def = 'No permission / 无权限执行此操作';
        if (typeof app !== 'undefined' && app.showToast) app.showToast(msg || def, 'error');
        else alert(msg || def);
    },
    addPermissionCheckToButton(btn, ok) {
        if (btn && !ok) btn.style.display = 'none';
    },

    hasPermission(permission) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.custom_permissions && user.custom_permissions[permission] !== undefined) {
            return !!user.custom_permissions[permission];
        }
        const role = user.role || 'viewer';
        return !!(PERMISSIONS[role] && PERMISSIONS[role][permission]);
    },
};

window.PermissionManager = PermissionManager;
