// 双语显示配置 (中文 + 泰语)
const translations = {
    app: {
        title: 'Mira Villa',
        subtitle: '建筑项目管理系统 ระบบจัดการโครงการก่อสร้าง'
    },
    nav: {
        projects: '项目管理 จัดการโครงการ',
        processes: '工序进度 ความคืบหน้างาน',
        materials: '材料管理 จัดการวัสดุ',
        photos: '现场照片 รูปถ่ายหน้างาน',
        dailyTasks: '今日任务 งานวันนี้',
        users: '用户管理 ผู้ใช้งาน'
    },
    common: {
        logout: '退出 ออกจากระบบ',
        save: '保存 บันทึก',
        cancel: '取消 ยกเลิก',
        delete: '删除 ลบ',
        edit: '编辑 แก้ไข',
        confirm: '确认 ยืนยัน',
        confirmDelete: '确认删除 ยืนยันลบ',
        loading: '加载中... กำลังโหลด...',
        success: '成功 สำเร็จ',
        error: '错误 ผิดพลาด',
        notes: '备注 หมายเหตุ',
        noData: '暂无数据 ไม่มีข้อมูล',
        add: '添加 เพิ่ม',
        remove: '移除 ลบออก',
        close: '关闭 ปิด',
        submit: '提交 ส่ง',
        back: '返回 กลับ',
        next: '下一步 ถัดไป',
        create: '创建 สร้าง'
    },
    dashboard: {
        title: '项目概览 แดชบอร์ดโครงการ',
        noProjects: '暂无项目 ยังไม่มีโครงการ',
        noProjectsDesc: '开始创建第一个项目 เริ่มต้นสร้างโครงการแรกของคุณ',
        myProjects: '我的项目 โครงการของฉัน'
    },
    projectDetail: {
        overview: '项目概览 ภาพรวมโครงการ',
        settings: '项目设置 ตั้งค่าโครงการ'
    },
    overview: {
        totalProcesses: '总工序数 จำนวนงานทั้งหมด',
        completedProcesses: '已完成 เสร็จแล้ว',
        inProgress: '进行中 กำลังดำเนินการ',
        teamMembers: '团队成员 สมาชิกทีม'
    },
    projects: {
        title: '项目管理 จัดการโครงการ',
        name: '项目名称 ชื่อโครงการ',
        code: '项目编号 รหัสโครงการ',
        description: '项目描述 คำอธิบาย',
        location: '项目地址 ที่ตั้งโครงการ',
        startDate: '开始日期 วันเริ่ม',
        endDate: '结束日期 วันสิ้นสุด',
        manager: '项目经理 ผู้จัดการโครงการ',
        create: '创建项目 สร้างโครงการ',
        edit: '编辑项目 แก้ไขโครงการ',
        delete: '删除项目 ลบโครงการ',
        confirmDelete: '确认删除项目？ ยืนยันลบโครงการ?',
        createSuccess: '项目创建成功 สร้างโครงการสำเร็จ',
        updateSuccess: '项目更新成功 อัพเดทโครงการสำเร็จ',
        deleteSuccess: '项目删除成功 ลบโครงการสำเร็จ',
        loadError: '加载项目失败 โหลดโครงการไม่สำเร็จ',
        basicInfo: '基本信息 ข้อมูลพื้นฐาน',
        selectProcesses: '选择工序 เลือกงาน',
        processes: '工序 งาน',
        addProcess: '添加工序 เพิ่มงาน',
        noProcesses: '暂无工序 ยังไม่มีงาน',
        noProcessesDesc: '开始添加第一个工序 เริ่มต้นเพิ่มงานแรก',
        addFirst: '添加第一个工序 เพิ่มงานแรก'
    },
    processes: {
        title: '工序进度 ความคืบหน้างาน',
        addProcess: '添加工序 เพิ่มงาน',
        noProcesses: '暂无工序 ยังไม่มีงาน',
        noProcessesDesc: '开始添加工序 เริ่มเพิ่มงาน',
        addFirst: '添加第一个工序 เพิ่มงานแรก',
        processCode: '工序编号 รหัสงาน',
        status: {
            not_started: '未开始 ยังไม่เริ่ม',
            in_progress: '进行中 กำลังดำเนินการ',
            waiting_material: '等待材料 รอวัสดุ',
            weather_stop: '天气停工 หยุดเพราะสภาพอากาศ',
            completed: '已完成 เสร็จแล้ว',
            paused: '已暂停 หยุดชั่วคราว'
        }
    },
    scheduling: {
        schedule: '计划 แผนงาน',
        dependencies: '依赖 งานที่เกี่ยวข้อง',
        days: '天 วัน',
        plannedStartDate: '计划开始 วันเริ่มตามแผน',
        plannedEndDate: '计划完成 วันสิ้นสุดตามแผน',
        plannedDuration: '计划工期 ระยะเวลาตามแผน'
    },
    materials: {
        title: '材料管理 จัดการวัสดุ',
        materialList: '材料列表 รายการวัสดุ',
        addMaterial: '添加材料 เพิ่มวัสดุ',
        noMaterials: '暂无材料 ไม่มีวัสดุ',
        purchased: '采购 สั่งซื้อ',
        received: '到货 เข้าคลัง',
        used: '已用 ใช้แล้ว',
        stock: '库存 คงเหลือ'
    },
    daily: {
        title: '今日任务 งานวันนี้',
        updateProgress: '更新进度 อัพเดทความคืบหน้า',
        viewSubtasks: '查看子任务 ดูงานย่อย',
        currentProgress: '当前完成度 ความคืบหน้าปัจจุบัน',
        newProgress: '新的完成度 ความคืบหน้าใหม่ (%)',
        progressNotes: '进度说明 หมายเหตุความคืบหน้า'
    },
    users: {
        title: '用户管理 จัดการผู้ใช้',
        username: '用户名 ชื่อผู้ใช้',
        password: '密码 รหัสผ่าน',
        role: '角色 บทบาท',
        addUser: '添加用户 เพิ่มผู้ใช้'
    }
};

// 翻译函数 - 直接返回双语文本
function t(key) {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn('Translation missing:', key);
            return key;
        }
    }
    
    return value || key;
}

// 获取双语字段（用于数据库返回的 JSON 字段）
function getI18nField(obj, fieldName) {
    if (!obj) return '';
    
    const field = obj[fieldName];
    
    // 如果是 JSON 对象，返回 "中文 ไทย" 格式
    if (field && typeof field === 'object') {
        const zh = field.zh || '';
        const th = field.th || '';
        return zh && th ? `${zh} ${th}` : (zh || th);
    }
    
    // 否则直接返回
    return field || '';
}

// 获取单位文本（双语）
function getUnitText(unit) {
    if (!unit) return '';
    if (typeof unit === 'object') {
        const zh = unit.zh || '';
        const th = unit.th || '';
        return zh && th ? `${zh} ${th}` : (zh || th);
    }
    return unit;
}

console.log('✓ 双语 i18n 系统已加载');
