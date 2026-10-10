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
            error: '操作失败',
            notes: '备注',
            noData: '暂无数据',
            chinese: '中文',
            thai: '泰语',
            add: '添加',
            remove: '移除',
            close: '关闭',
            submit: '提交'
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
            selectProject: '选择项目',
            members: '成员',
            membersManagement: '成员管理',
            currentMembers: '当前成员',
            addMembers: '添加成员',
            noMembers: '暂无成员',
            allUsersAssigned: '所有用户都已分配到此项目',
            assignedAt: '分配时间',
            addMemberSuccess: '添加成员成功',
            addMemberError: '添加成员失败',
            removeMemberSuccess: '移除成员成功',
            removeMemberError: '移除成员失败',
            confirmRemoveMember: '确认移除该成员？',
            loadMembersError: '加载成员列表失败'
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
            notes: '备注',
            units: {
                square_meter: '平米',
                cubic_meter: '立方米',
                meter: '米',
                piece: '件',
                point: '点位',
                ton: '吨'
            }
        },
        materials: {
            title: '材料管理',
            selectProject: '选择项目',
            code: '材料编号',
            name: '材料名称',
            materialName: '材料名称',
            materialCode: '材料编号',
            unit: '单位',
            quantity: '数量',
            calculated: '计算需求',
            purchased: '已采购',
            received: '已接收',
            used: '已使用',
            stock: '库存',
            noMaterials: '暂无材料，点击右上角采购材料',
            purchaseMaterial: '采购材料',
            selectFromLibrary: '从材料库选择',
            manualInput: '手动输入',
            purchaseQuantity: '采购数量',
            receivedQuantity: '到货数量',
            usedQuantity: '已用数量',
            stockQuantity: '库存余额',
            supplier: '供应商',
            supplierName: '供应商名称',
            expectedArrival: '预计到货',
            actualArrival: '实际到货',
            confirmArrival: '确认到货',
            useMaterial: '使用材料',
            reorder: '重新订购',
            unitPrice: '单价',
            ordered: '已订购',
            arrived: '已到货',
            inUse: '使用中',
            depleted: '已用完',
            lowStock: '库存不足',
            actualReceivedQuantity: '实际到货数量',
            anyDifferences: '如有差异请说明',
            selectProcess: '选择工序',
            quantityUsed: '使用数量',
            usageDate: '使用日期',
            currentStock: '当前库存',
            maxAvailable: '最大可用',
            material: '材料',
            noActiveProcesses: '暂无进行中的工序',
            pleaseSelectProcess: '请选择工序',
            purchaseSuccess: '采购记录成功',
            purchaseFailed: '采购失败',
            receiveSuccess: '到货确认成功',
            receiveFailed: '确认失败',
            useSuccess: '使用记录成功',
            useFailed: '记录失败',
            confirmUse: '确认使用'
        },
        photos: {
            title: '现场照片',
            selectProject: '选择项目',
            upload: '上传照片',
            process: '关联工序',
            time: '拍摄时间',
            notes: '说明'
        },
        users: {
            title: '用户管理',
            addUser: '添加用户',
            editUser: '编辑用户',
            username: '用户名',
            password: '密码',
            newPassword: '新密码',
            fullName: '全名',
            role: '角色',
            assignedProjects: '分配项目',
            createdAt: '创建时间',
            actions: '操作',
            selectRole: '选择角色',
            passwordHint: '至少6个字符',
            passwordOptional: '留空则不修改密码',
            usernameCannotChange: '用户名创建后不可修改',
            noUsers: '暂无用户',
            totalUsers: '总用户数',
            managers: '管理者',
            purchasers: '采购者',
            executors: '执行者',
            addSuccess: '用户添加成功',
            addError: '用户添加失败',
            updateSuccess: '用户更新成功',
            updateError: '用户更新失败',
            deleteSuccess: '用户删除成功',
            deleteError: '用户删除失败',
            confirmDelete: '确认删除用户 {name}？此操作无法撤销',
            loadError: '加载用户列表失败',
            assignProjects: '分配项目',
            assignProjectsTo: '为 {name} 分配项目',
            selectProjects: '选择项目',
            assignProjectsSuccess: '项目分配成功',
            assignProjectsError: '项目分配失败',
            loadProjectsError: '加载项目列表失败'
        },
        roles: {
            manager: '管理者',
            purchaser: '采购者',
            executor: '执行者'
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
            progressHistory: '历史进度',
            viewSubtasks: '查看子任务',
            addSubtask: '添加子任务',
            subtaskName: '子任务名称',
            noSubtasks: '暂无子任务',
            subtaskDetail: '子任务详情'
        },
        subtasks: {
            title: '子任务管理',
            view: '查看子任务',
            add: '添加子任务',
            update: '更新进度',
            complete: '标记完成',
            name: '子任务名称',
            description: '描述',
            estimatedQuantity: '预计数量',
            actualQuantity: '实际完成',
            unit: '单位',
            empty: '暂无子任务，点击上方按钮添加',
            namePlaceholder: '例如：浇筑东侧基础',
            descPlaceholder: '详细说明（可选）',
            confirmComplete: '确认标记此子任务为完成状态？'
        },
        units: {
            sqm: '平米',
            cbm: '立方米',
            item: '件',
            point: '点位'
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
            error: 'ผิดพลาด',
            notes: 'หมายเหตุ',
            noData: 'ไม่มีข้อมูล',
            chinese: 'จีน',
            thai: 'ไทย',
            add: 'เพิ่ม',
            remove: 'ลบออก',
            close: 'ปิด',
            submit: 'ส่ง'
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
            selectProject: 'เลือกโครงการ',
            members: 'สมาชิก',
            membersManagement: 'จัดการสมาชิก',
            currentMembers: 'สมาชิกปัจจุบัน',
            addMembers: 'เพิ่มสมาชิก',
            noMembers: 'ยังไม่มีสมาชิก',
            allUsersAssigned: 'ผู้ใช้ทั้งหมดถูกมอบหมายแล้ว',
            assignedAt: 'เวลามอบหมาย',
            addMemberSuccess: 'เพิ่มสมาชิกสำเร็จ',
            addMemberError: 'เพิ่มสมาชิกไม่สำเร็จ',
            removeMemberSuccess: 'ลบสมาชิกสำเร็จ',
            removeMemberError: 'ลบสมาชิกไม่สำเร็จ',
            confirmRemoveMember: 'ยืนยันลบสมาชิก?',
            loadMembersError: 'โหลดรายการสมาชิกไม่สำเร็จ'
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
            notes: 'หมายเหตุ',
            units: {
                square_meter: 'ตร.ม.',
                cubic_meter: 'ลบ.ม.',
                meter: 'เมตร',
                piece: 'ชิ้น',
                point: 'จุด',
                ton: 'ตัน'
            }
        },
        materials: {
            title: 'จัดการวัสดุ',
            selectProject: 'เลือกโครงการ',
            code: 'รหัสวัสดุ',
            name: 'ชื่อวัสดุ',
            materialName: 'ชื่อวัสดุ',
            materialCode: 'รหัสวัสดุ',
            unit: 'หน่วย',
            quantity: 'จำนวน',
            calculated: 'คำนวณแล้ว',
            purchased: 'สั่งซื้อแล้ว',
            received: 'รับแล้ว',
            used: 'ใช้แล้ว',
            stock: 'คงเหลือ',
            noMaterials: 'ยังไม่มีวัสดุ คลิกปุ่มมุมบนขวาเพื่อสั่งซื้อ',
            purchaseMaterial: 'สั่งซื้อวัสดุ',
            selectFromLibrary: 'เลือกจากคลังวัสดุ',
            manualInput: 'กรอกข้อมูลเอง',
            purchaseQuantity: 'จำนวนสั่งซื้อ',
            receivedQuantity: 'จำนวนที่รับ',
            usedQuantity: 'จำนวนที่ใช้',
            stockQuantity: 'ยอดคงเหลือ',
            supplier: 'ผู้จำหน่าย',
            supplierName: 'ชื่อผู้จำหน่าย',
            expectedArrival: 'คาดว่าจะส่ง',
            actualArrival: 'วันที่ส่งจริง',
            confirmArrival: 'ยืนยันรับของ',
            useMaterial: 'ใช้วัสดุ',
            reorder: 'สั่งซื้อเพิ่ม',
            unitPrice: 'ราคาต่อหน่วย',
            ordered: 'สั่งซื้อแล้ว',
            arrived: 'ส่งถึงแล้ว',
            inUse: 'กำลังใช้งาน',
            depleted: 'หมดแล้ว',
            lowStock: 'เหลือน้อย',
            actualReceivedQuantity: 'จำนวนที่รับจริง',
            anyDifferences: 'ระบุถ้ามีความแตกต่าง',
            selectProcess: 'เลือกงาน',
            quantityUsed: 'จำนวนที่ใช้',
            usageDate: 'วันที่ใช้',
            currentStock: 'คงเหลือปัจจุบัน',
            maxAvailable: 'สูงสุดที่มี',
            material: 'วัสดุ',
            noActiveProcesses: 'ยังไม่มีงานที่กำลังทำ',
            pleaseSelectProcess: 'กรุณาเลือกงาน',
            purchaseSuccess: 'บันทึกการสั่งซื้อสำเร็จ',
            purchaseFailed: 'การสั่งซื้อล้มเหลว',
            receiveSuccess: 'ยืนยันรับของสำเร็จ',
            receiveFailed: 'การยืนยันล้มเหลว',
            useSuccess: 'บันทึกการใช้วัสดุสำเร็จ',
            useFailed: 'การบันทึกล้มเหลว',
            confirmUse: 'ยืนยันการใช้'
        },
        photos: {
            title: 'รูปถ่ายหน้างาน',
            selectProject: 'เลือกโครงการ',
            upload: 'อัพโหลดรูป',
            process: 'เกี่ยวกับงาน',
            time: 'เวลาถ่าย',
            notes: 'รายละเอียด'
        },
        users: {
            title: 'จัดการผู้ใช้',
            addUser: 'เพิ่มผู้ใช้',
            editUser: 'แก้ไขผู้ใช้',
            username: 'ชื่อผู้ใช้',
            password: 'รหัสผ่าน',
            newPassword: 'รหัสผ่านใหม่',
            fullName: 'ชื่อเต็ม',
            role: 'บทบาท',
            assignedProjects: 'มอบหมายโครงการ',
            createdAt: 'วันที่สร้าง',
            actions: 'ดำเนินการ',
            selectRole: 'เลือกบทบาท',
            passwordHint: 'อย่างน้อย 6 ตัวอักษร',
            passwordOptional: 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน',
            usernameCannotChange: 'ชื่อผู้ใช้ไม่สามารถเปลี่ยนได้หลังสร้าง',
            noUsers: 'ไม่มีผู้ใช้',
            totalUsers: 'ผู้ใช้ทั้งหมด',
            managers: 'ผู้จัดการ',
            purchasers: 'ผู้จัดซื้อ',
            executors: 'พนักงาน',
            addSuccess: 'เพิ่มผู้ใช้สำเร็จ',
            addError: 'เพิ่มผู้ใช้ไม่สำเร็จ',
            updateSuccess: 'อัพเดทผู้ใช้สำเร็จ',
            updateError: 'อัพเดทผู้ใช้ไม่สำเร็จ',
            deleteSuccess: 'ลบผู้ใช้สำเร็จ',
            deleteError: 'ลบผู้ใช้ไม่สำเร็จ',
            confirmDelete: 'ยืนยันลบผู้ใช้ {name}? ไม่สามารถกู้คืนได้',
            loadError: 'โหลดรายการผู้ใช้ไม่สำเร็จ',
            assignProjects: 'มอบหมายโครงการ',
            assignProjectsTo: 'มอบหมายโครงการให้ {name}',
            selectProjects: 'เลือกโครงการ',
            assignProjectsSuccess: 'มอบหมายโครงการสำเร็จ',
            assignProjectsError: 'มอบหมายโครงการไม่สำเร็จ',
            loadProjectsError: 'โหลดรายการโครงการไม่สำเร็จ'
        },
        roles: {
            manager: 'ผู้จัดการ',
            purchaser: 'ผู้จัดซื้อ',
            executor: 'พนักงาน'
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
            progressHistory: 'ประวัติความคืบหน้า',
            viewSubtasks: 'ดูงานย่อย',
            addSubtask: 'เพิ่มงานย่อย',
            subtaskName: 'ชื่องานย่อย',
            noSubtasks: 'ยังไม่มีงานย่อย',
            subtaskDetail: 'รายละเอียดงานย่อย'
        },
        subtasks: {
            title: 'จัดการงานย่อย',
            view: 'ดูงานย่อย',
            add: 'เพิ่มงานย่อย',
            update: 'อัพเดทความคืบหน้า',
            complete: 'ทำเสร็จแล้ว',
            name: 'ชื่องานย่อย',
            description: 'รายละเอียด',
            estimatedQuantity: 'จำนวนโดยประมาณ',
            actualQuantity: 'จำนวนที่ทำจริง',
            unit: 'หน่วย',
            empty: 'ยังไม่มีงานย่อย คลิกปุ่มด้านบนเพื่อเพิ่ม',
            namePlaceholder: 'ตัวอย่าง: เทคอนกรีตฐานรากด้านตะวันออก',
            descPlaceholder: 'รายละเอียดเพิ่มเติม (ไม่บังคับ)',
            confirmComplete: 'ยืนยันว่างานย่อยนี้เสร็จแล้ว?'
        },
        units: {
            sqm: 'ตร.ม.',
            cbm: 'ลบ.ม.',
            item: 'ชิ้น',
            point: 'จุด'
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

// 为 i18n 对象添加方法
i18n.t = t;
i18n.currentLang = () => currentLang;
i18n.getLocalizedValue = function(value, field = null) {
    if (!value) return '';
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch (e) {
            return value;
        }
    }
    if (field) return value[field] || value.zh || value.th || '';
    return value[currentLang] || value.zh || value.th || '';
};

// 更新页面所有翻译
function updateTranslations(lang = currentLang) {
    currentLang = lang;
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

// 获取单位翻译
function getUnitText(unit) {
    if (!unit) return '';
    const key = `processes.units.${unit}`;
    return t(key) !== key ? t(key) : unit;
}
