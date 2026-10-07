// 国际化配置
const i18n = {
    zh: {
        app: {
            title: '施工管理系统',
            subtitle: '极简版工地管理'
        },
        nav: {
            projects: '项目管理',
            processes: '工序进度',
            materials: '材料管理',
            photos: '现场照片',
            dailyTasks: '今日任务'
        },
        login: {
            username: '用户名',
            password: '密码',
            submit: '登录',
            error: '用户名或密码错误'
        },
        common: {
            logout: '退出',
            save: '保存',
            cancel: '取消',
            delete: '删除',
            edit: '编辑',
            confirm: '确认',
            loading: '加载中...',
            success: '操作成功',
            error: '操作失败'
        },
        projects: {
            title: '项目管理',
            add: '+ 新建项目',
            name: '项目名称',
            location: '项目地点',
            client: '客户名称',
            startDate: '开始日期',
            endDate: '计划完工日期',
            status: '状态',
            progress: '进度',
            selectProject: '选择项目'
        },
        processes: {
            title: '工序进度',
            selectProject: '选择项目',
            addWorker: '分配工人',
            status: {
                not_started: '未开始',
                in_progress: '进行中',
                waiting_material: '等待材料',
                weather_stop: '天气停工',
                completed: '已完成'
            },
            measurements: '尺寸测量',
            workers: '分配工人',
            notes: '备注'
        },
        materials: {
            title: '材料管理',
            selectProject: '选择项目',
            code: '材料编号',
            name: '材料名称',
            unit: '单位',
            quantity: '数量',
            calculated: '计算需求',
            purchased: '已采购',
            received: '已接收',
            used: '已使用',
            stock: '库存'
        },
        photos: {
            title: '现场照片',
            selectProject: '选择项目',
            upload: '上传照片',
            process: '关联工序',
            time: '拍摄时间',
            notes: '说明'
        },
        daily: {
            title: '今日任务',
            date: '日期',
            inProgress: '进行中',
            waitingMaterial: '等待材料',
            weatherStop: '天气停工',
            completed: '今日完成',
            notStarted: '未开始',
            todayPlan: '今日计划',
            todayCompleted: '今日完成',
            updateProgress: '更新进度',
            reportIssue: '上报问题',
            quantityCompleted: '完成数量',
            workStatus: '工作状态',
            normal: '正常进行',
            totalProgress: '总进度',
            workers: '人员',
            materialStock: '材料库存',
            sufficient: '充足',
            insufficient: '不足',
            progressHistory: '历史进度'
        }
    },
    th: {
        app: {
            title: 'ระบบจัดการก่อสร้าง',
            subtitle: 'Construction Management System'
        },
        nav: {
            projects: 'จัดการโครงการ',
            processes: 'ความคืบหน้างาน',
            materials: 'จัดการวัสดุ',
            photos: 'รูปถ่ายหน้างาน',
            dailyTasks: 'งานวันนี้'
        },
        login: {
            username: 'ชื่อผู้ใช้',
            password: 'รหัสผ่าน',
            submit: 'เข้าสู่ระบบ',
            error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        },
        common: {
            logout: 'ออกจากระบบ',
            save: 'บันทึก',
            cancel: 'ยกเลิก',
            delete: 'ลบ',
            edit: 'แก้ไข',
            confirm: 'ยืนยัน',
            loading: 'กำลังโหลด...',
            success: 'สำเร็จ',
            error: 'ผิดพลาด'
        },
        projects: {
            title: 'จัดการโครงการ',
            add: '+ สร้างโครงการใหม่',
            name: 'ชื่อโครงการ',
            location: 'ที่อยู่โครงการ',
            client: 'ชื่อลูกค้า',
            startDate: 'วันเริ่มงาน',
            endDate: 'วันแล้วเสร็จตามแผน',
            status: 'สถานะ',
            progress: 'ความคืบหน้า',
            selectProject: 'เลือกโครงการ'
        },
        processes: {
            title: 'ความคืบหน้างาน',
            selectProject: 'เลือกโครงการ',
            addWorker: 'มอบหมายคนงาน',
            status: {
                not_started: 'ยังไม่เริ่ม',
                in_progress: 'กำลังทำงาน',
                waiting_material: 'รอวัสดุ',
                weather_stop: 'หยุดเพราะอากาศ',
                completed: 'เสร็จสิ้น'
            },
            measurements: 'ขนาด',
            workers: 'คนงาน',
            notes: 'หมายเหตุ'
        },
        materials: {
            title: 'จัดการวัสดุ',
            selectProject: 'เลือกโครงการ',
            code: 'รหัสวัสดุ',
            name: 'ชื่อวัสดุ',
            unit: 'หน่วย',
            quantity: 'จำนวน',
            calculated: 'คำนวณแล้ว',
            purchased: 'สั่งซื้อแล้ว',
            received: 'รับแล้ว',
            used: 'ใช้แล้ว',
            stock: 'คงเหลือ'
        },
        photos: {
            title: 'รูปถ่ายหน้างาน',
            selectProject: 'เลือกโครงการ',
            upload: 'อัพโหลดรูป',
            process: 'เกี่ยวกับงาน',
            time: 'เวลาถ่าย',
            notes: 'รายละเอียด'
        },
        daily: {
            title: 'งานวันนี้',
            date: 'วันที่',
            inProgress: 'กำลังทำงาน',
            waitingMaterial: 'รอวัสดุ',
            weatherStop: 'หยุดเพราะอากาศ',
            completed: 'เสร็จวันนี้',
            notStarted: 'ยังไม่เริ่ม',
            todayPlan: 'เป้าหมายวันนี้',
            todayCompleted: 'ทำเสร็จวันนี้',
            updateProgress: 'อัพเดทความคืบหน้า',
            reportIssue: 'รายงานปัญหา',
            quantityCompleted: 'จำนวนที่ทำเสร็จ',
            workStatus: 'สถานะงาน',
            normal: 'ปกติ',
            totalProgress: 'ความคืบหน้ารวม',
            workers: 'คนงาน',
            materialStock: 'คงเหลือวัสดุ',
            sufficient: 'เพียงพอ',
            insufficient: 'ไม่พอ',
            progressHistory: 'ประวัติความคืบหน้า'
        }
    }
};

// 当前语言
let currentLang = localStorage.getItem('language') || 'zh';

// 翻译函数
function t(key, lang = currentLang) {
    const keys = key.split('.');
    let value = i18n[lang];
    for (const k of keys) {
        value = value?.[k];
    }
    return value || key;
}

// 更新页面所有翻译
function updateTranslations(lang = currentLang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t(key, lang);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = translation;
        } else {
            el.textContent = translation;
        }
    });
}

// 获取JSONB双语字段
function getI18nField(obj, field) {
    if (!obj || !obj[field]) return '';
    const value = obj[field];
    if (typeof value === 'string') return value;
    return value[currentLang] || value.zh || value.th || '';
}
