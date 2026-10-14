// permissions.js — 5角色权限系统
// manager(系统管理员), owner(业主), supervisor(工地主管), foreman(工头), purchaser(采购员)

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

    // 只有系统管理员可以管系统
    canManageUsers()          { return this.isManager(); },
    canManageProjects()       { return this.isManager(); },        // 创建/删除项目、生成计划
    canManageProjectMembers() { return this.isManager(); },

    // 可以看项目完整内容（manager + owner + supervisor + purchaser）
    canViewProjectData() {
        return ['manager','owner','supervisor','purchaser'].includes(this.role());
    },

    // 可以分配工作（manager + supervisor）
    canAssignTasks() {
        return this.isManager() || this.isSupervisor();
    },

    // 可以加入正在做 - 启动分配的任务 (manager + supervisor + foreman)
    canStartAssignedTask() {
        return ['manager', 'supervisor', 'foreman'].includes(this.role());
    },

    // 可以采购材料（manager + supervisor + purchaser）
    canPurchaseMaterials() {
        return ['manager','supervisor','purchaser'].includes(this.role());
    },

    // 可以接收入库（manager + supervisor + foreman + purchaser）
    canReceiveMaterials() {
        return ['manager','supervisor','foreman','purchaser'].includes(this.role());
    },

    // 可以看今日现场
    canViewSite() {
        return ['manager','owner','supervisor','foreman','patrol'].includes(this.role());
    },

    // 可以上传照片（所有除 owner）
    canUploadPhotos() {
        return !this.isOwner();
    },

    // 可以更新工序进度（manager + supervisor + foreman）
    canUpdateProcessProgress() {
        return ['manager','supervisor','foreman'].includes(this.role());
    },

    // 可以看甘特图/进度计划
    canViewGantt() {
        return ['manager','owner','supervisor','purchaser'].includes(this.role());
    },

    // 可以看今日现场
    canViewSite() {
        return ['manager','owner','supervisor','foreman'].includes(this.role());
    },

    // 可以看材料设备
    canViewMaterials() {
        return ['manager','supervisor','foreman','purchaser'].includes(this.role());
    },

    // 可以看总览/报告
    canViewOverview() {
        return ['manager','owner','supervisor'].includes(this.role());
    },

    // 旧兼容
    canViewAllProjects()        { return this.isManager(); },
    canOnlyViewAssignedProjects(){ return !this.isManager(); },

    // ── 显示名称 ──
    getRoleDisplayName(role) {
        return {
            manager:    '系统管理员 ผู้ดูแลระบบ',
            owner:      '业主 เจ้าของโครงการ',
            supervisor: '工地主管 หัวหน้างาน',
            foreman:    '工头 โฟร์แมน',
            purchaser:  '采购员 เจ้าหน้าที่จัดซื้อ',
            patrol:     '巡逻员 ยาม'
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
        const def = 'ไม่มีสิทธิ์ / 无权限执行此操作';
        if (typeof app !== 'undefined' && app.showToast) app.showToast(msg || def, 'error');
        else alert(msg || def);
    },
    addPermissionCheckToButton(btn, ok) {
        if (btn && !ok) btn.style.display = 'none';
    }
};

window.PermissionManager = PermissionManager;
