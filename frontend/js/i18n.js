// 双语显示配置 (中文 + English)
const translations = {
    app: {
        title: 'Mira Villa',
        subtitle: '建筑项目管理系统 Construction Project Management System'
    },
    nav: {
        projects: '项目管理 Project Management',
        processes: '工序进度 Process Progress',
        materials: '材料管理 Material Management',
        photos: '现场照片 Site Photos',
        dailyTasks: '今日任务 Today\'s Tasks',
        users: '用户管理 User Management'
    },
    common: {
        logout: '退出 Logout',
        save: '保存 Save',
        cancel: '取消 Cancel',
        delete: '删除 Delete',
        edit: '编辑 Edit',
        confirm: '确认 Confirm',
        confirmDelete: '确认删除 Confirm Delete',
        loading: '加载中... Loading...',
        success: '成功 Success',
        error: '错误 Error',
        notes: '备注 Notes',
        noData: '暂无数据 No Data',
        add: '添加 Add',
        remove: '移除 Remove',
        close: '关闭 Close',
        submit: '提交 Submit',
        back: '返回 Back',
        next: '下一步 Next',
        create: '创建 Create',
        fillRequired: '请填写必填项 Please fill in required fields',
        updateError: '更新失败 Update failed'
    },
    quantities: {
        instruction: '说明 Description',
        instructionText: '请填写下列工程量数据 Please enter the quantity data below',
        enterData: '输入工程量 Enter Quantity',
        calculationResult: '计算结果 Calculation Result',
        notSupported: '该工序未预设字段，使用通用输入 No predefined fields for this task, using general input',
        quantity: '工程量 Quantity',
        enterQuantity: '请输入数量 Please enter quantity',
        unit: '单位 Unit',
        unitPlaceholder: '如 m²、m³、个 e.g. m², m³, pcs',
        unitExample: '如 m²、m³、个 e.g. m², m³, pcs',
        validQuantityError: '请输入大于0的数量 Please enter a quantity greater than 0',
        updateSuccess: '工程量已保存 Quantity saved'
    },
    dashboard: {
        title: '项目概览 Project Dashboard',
        noProjects: '暂无项目 No Projects',
        noProjectsDesc: '开始创建第一个项目 Start by creating your first project',
        myProjects: '我的项目 My Projects'
    },
    projectDetail: {
        overview: '项目概览 Project Overview',
        settings: '项目设置 Project Settings'
    },
    overview: {
        totalProcesses: '总工序数 Total Processes',
        completedProcesses: '已完成 Completed',
        inProgress: '进行中 In Progress',
        teamMembers: '团队成员 Team Members'
    },
    projects: {
        title: '项目管理 Project Management',
        add: '新建项目 Create New Project',
        name: '项目名称 Project Name',
        code: '项目编号 Project Code',
        description: '项目描述 Project Description',
        location: '项目地址 Project Location',
        startDate: '开始日期 Start Date',
        endDate: '结束日期 End Date',
        client: '业主 Owner',
        progress: '进度 Progress',
        manager: '项目经理 Project Manager',
        create: '创建项目 Create Project',
        edit: '编辑项目 Edit Project',
        delete: '删除项目 Delete Project',
        confirmDelete: '确认删除项目？ Confirm delete project?',
        createSuccess: '项目创建成功 Project created successfully',
        updateSuccess: '项目更新成功 Project updated successfully',
        deleteSuccess: '项目删除成功 Project deleted successfully',
        loadError: '加载项目失败 Failed to load project',
        basicInfo: '基本信息 Basic Info',
        selectProcesses: '选择工序 Select Tasks',
        processes: '工序 Task',
        addProcess: '添加工序 Add Task',
        noProcesses: '暂无工序 No Tasks',
        noProcessesDesc: '开始添加第一个工序 Start adding the first task',
        addFirst: '添加第一个工序 Add First Task',
        status: {
            active: '进行中 In Progress',
            completed: '已完成 Completed',
            paused: '已暂停 Paused',
            planning: '规划中 Planning'
        }
    },
    processes: {
        title: '工序进度 Process Progress',
        addProcess: '添加工序 Add Task',
        noProcesses: '暂无工序 No Tasks',
        noProcessesDesc: '开始添加工序 Start adding tasks',
        addFirst: '添加第一个工序 Add First Task',
        processCode: '工序编号 Task Code',
        startSuccess: '工序已开始 Task started',
        completeSuccess: '工序已完成 Task completed',
        notFound: '未找到工序 Task not found',
        status: {
            not_started: '未开始 Not Started',
            in_progress: '进行中 In Progress',
            waiting_material: '等待材料 Waiting for Materials',
            weather_stop: '天气停工 Weather Stop',
            completed: '已完成 Completed',
            paused: '已暂停 Paused'
        }
    },
    scheduling: {
        schedule: '计划 Plan',
        dependencies: '依赖 Dependencies',
        days: '天 Days',
        plannedStartDate: '计划开始 Planned Start',
        plannedEndDate: '计划完成 Planned End',
        plannedDuration: '计划工期 Planned Duration'
    },
    materials: {
        title: '材料管理 Material Management',
        materialList: '材料列表 Material List',
        addMaterial: '添加材料 Add Material',
        noMaterials: '暂无材料 No Materials',
        purchased: '采购 Purchased',
        received: '到货 Received',
        used: '已用 Used',
        stock: '库存 Stock'
    },
    daily: {
        title: '今日任务 Today\'s Tasks',
        updateProgress: '更新进度 Update Progress',
        viewSubtasks: '查看子任务 View Subtasks',
        currentProgress: '当前完成度 Current Progress',
        newProgress: '新的完成度 New Progress (%)',
        progressNotes: '进度说明 Progress Notes'
    },
    users: {
        title: '用户管理 Manage Users',
        username: '用户名 Username',
        password: '密码 Password',
        role: '角色 Role',
        addUser: '添加用户 Add User'
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
    
    // 如果是 JSON 对象，只返回中文（th字段是数据库中的泰语，不显示）
    if (field && typeof field === 'object') {
        const zh = field.zh || '';
        return zh || field.th || '';
    }
    
    // 否则直接返回（过滤掉泰语字符及其前缀分隔符）
    if (typeof field === 'string') {
        return field
            .replace(/\s*•\s*[\u0E00-\u0E7F][^•]*/g, '') // Remove "• Thai text..." segments
            .replace(/[\u0E00-\u0E7F]+\s*/g, '')           // Remove remaining Thai chars
            .replace(/\s*•\s*$/, '')                        // Remove trailing bullet
            .replace(/\s{2,}/g, ' ')                        // Collapse spaces
            .trim();
    }
    return field || '';
}

// 获取单位文本（只返回中文，剥离泰语）
function getUnitText(unit) {
    if (!unit) return '';
    if (typeof unit === 'object') {
        return unit.zh || unit.th || '';
    }
    if (typeof unit === 'string') {
        return unit.replace(/[\u0E00-\u0E7F]+\s*/g, '').trim();
    }
    return unit;
}

console.log('✓ 双语 i18n 系统已加载');
