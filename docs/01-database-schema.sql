-- ============================================================
-- 通用型工程项目全生命周期管理系统 - PostgreSQL 数据库设计
-- 版本: 1.0
-- 工序标准: 中国建筑施工规范 GB 50300-2013 + 装修规范 GB 50210-2018
-- 设计理念: 
--   1. 责任追踪 (initiator/approver/executor/verifier)
--   2. 数据按项目隔离
--   3. 状态机工作流
--   4. 三级进度管控 (日报/周报/月报)
--   5. 采购闭环与三单匹配
-- ============================================================

-- ============================================================
-- 1. 系统基础模块 (System Core)
-- ============================================================

-- 1.1 用户表
CREATE TABLE sys_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE sys_users IS '系统用户表';
COMMENT ON COLUMN sys_users.password_hash IS 'bcrypt 加密后的密码';

-- 1.2 角色表
CREATE TABLE sys_roles (
    id SERIAL PRIMARY KEY,
    role_code VARCHAR(20) UNIQUE NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE sys_roles IS '角色表';
COMMENT ON COLUMN sys_roles.role_code IS '角色代码: ADMIN, PM, SITE_MGR, PURCHASER, WORKER';
COMMENT ON COLUMN sys_roles.permissions IS 'JSON数组存储权限点: ["project:create", "report:approve"]';

-- 插入默认角色
INSERT INTO sys_roles (role_code, role_name, description, permissions) VALUES
('ADMIN', '系统管理员/老板', '最高权限，可查看所有项目、审批所有流程', '["*:*"]'),
('PM', '项目经理', '负责项目计划、周报月报、资源调度', '["project:manage", "report:submit", "purchase:approve", "change:approve"]'),
('SITE_MGR', '现场管理员', '负责日报提交、工序验收、到货验收', '["report:daily", "task:verify", "goods:receive"]'),
('PURCHASER', '采购员', '负责执行采购订单、录入账单', '["purchase:execute", "invoice:create"]'),
('WORKER', '施工班组', '负责填写日报、上传施工照片', '["report:daily", "photo:upload"]');

-- 1.3 项目表
CREATE TABLE sys_projects (
    id SERIAL PRIMARY KEY,
    project_code VARCHAR(50) UNIQUE NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    location VARCHAR(255),
    owner_id INTEGER REFERENCES sys_users(id),
    pm_id INTEGER REFERENCES sys_users(id),
    start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_end_date DATE,
    total_budget DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'planning',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE sys_projects IS '项目主表';
COMMENT ON COLUMN sys_projects.status IS '项目状态: planning(规划中), executing(施工中), paused(暂停), completed(已完工), cancelled(已取消)';
COMMENT ON COLUMN sys_projects.owner_id IS '项目业主/老板';
COMMENT ON COLUMN sys_projects.pm_id IS '项目经理';

-- 1.4 项目成员表 (多对多关系)
CREATE TABLE project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES sys_users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES sys_roles(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

COMMENT ON TABLE project_members IS '项目成员表，实现项目级数据隔离';

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ============================================================
-- 2. 工序管理模块 (Work Breakdown Structure)
-- ============================================================

-- 2.1 工序任务表 (WBS)
CREATE TABLE wbs_tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES wbs_tasks(id),
    task_code VARCHAR(50) NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_type VARCHAR(20) DEFAULT 'construction',
    phase VARCHAR(20),
    planned_start DATE NOT NULL,
    planned_end DATE NOT NULL,
    actual_start DATE,
    actual_end DATE,
    planned_quantity DECIMAL(10, 2) DEFAULT 0,
    actual_quantity DECIMAL(10, 2) DEFAULT 0,
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES sys_users(id),
    verifier_id INTEGER REFERENCES sys_users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, task_code)
);

COMMENT ON TABLE wbs_tasks IS '工作分解结构/工序任务表 - 基于中国建筑施工规范';
COMMENT ON COLUMN wbs_tasks.task_type IS '任务类型: construction(建筑工程), decoration(装修工程), milestone(里程碑), custom(自定义)';
COMMENT ON COLUMN wbs_tasks.phase IS '工序阶段代码，如 C01-01(土方工程), D08-01(水性涂料) 等，见 construction_phases 和 decoration_phases 参考表';
COMMENT ON COLUMN wbs_tasks.status IS '状态: pending(待开始), executing(施工中), verifying(验收中), completed(已完成), rejected(验收不通过)';
COMMENT ON COLUMN wbs_tasks.planned_quantity IS '计划工程量 (如: 100平方米混凝土)';
COMMENT ON COLUMN wbs_tasks.actual_quantity IS '实际完成工程量';
COMMENT ON COLUMN wbs_tasks.assigned_to IS '负责人/施工班组';
COMMENT ON COLUMN wbs_tasks.verifier_id IS '验收人';

CREATE INDEX idx_wbs_tasks_project ON wbs_tasks(project_id);
CREATE INDEX idx_wbs_tasks_status ON wbs_tasks(status);
CREATE INDEX idx_wbs_tasks_phase ON wbs_tasks(phase);
CREATE INDEX idx_wbs_tasks_type ON wbs_tasks(task_type);

-- 2.2 工序验收记录表
CREATE TABLE task_verifications (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES wbs_tasks(id) ON DELETE CASCADE,
    verifier_id INTEGER NOT NULL REFERENCES sys_users(id),
    verify_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result VARCHAR(20) NOT NULL,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    issues TEXT,
    corrective_actions TEXT,
    photos_json JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE task_verifications IS '工序验收记录表';
COMMENT ON COLUMN task_verifications.result IS '验收结果: passed(通过), failed(不通过), conditional(有条件通过)';
COMMENT ON COLUMN task_verifications.photos_json IS 'JSON数组存储照片URL: [{"url": "/uploads/...", "watermark": "..."}]';

CREATE INDEX idx_task_verifications_task ON task_verifications(task_id);

-- 2.3 建筑工程标准工序阶段参考表 (基于中国建筑施工规范 GB 50300-2013)
CREATE TABLE construction_phases (
    id SERIAL PRIMARY KEY,
    phase_code VARCHAR(20) UNIQUE NOT NULL,
    phase_name VARCHAR(100) NOT NULL,
    parent_code VARCHAR(20),
    sort_order INTEGER NOT NULL,
    description TEXT,
    acceptance_standard TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE construction_phases IS '建筑工程标准工序阶段参考表 - 依据《建筑工程施工质量验收统一标准》GB 50300-2013';

-- 插入建筑工程标准阶段 (三级结构)
INSERT INTO construction_phases (phase_code, phase_name, parent_code, sort_order, description, acceptance_standard) VALUES
-- 一级阶段 (主要分部工程)
('C01', '地基与基础工程', NULL, 1, '包含土方、地基处理、桩基、基础等', 'GB 50202-2018《建筑地基基础工程施工质量验收标准》'),
('C02', '主体结构工程', NULL, 2, '包含混凝土结构、砌体结构、钢结构、木结构等', 'GB 50204-2015《混凝土结构工程施工质量验收规范》'),
('C03', '建筑装饰装修工程', NULL, 3, '包含地面、抹灰、门窗、吊顶、轻质隔墙、饰面板、幕墙、涂饰、裱糊与软包、细部等', 'GB 50210-2018《建筑装饰装修工程质量验收标准》'),
('C04', '建筑屋面工程', NULL, 4, '包含卷材防水、涂膜防水、刚性防水、瓦面、细部构造等', 'GB 50207-2012《屋面工程质量验收规范》'),
('C05', '建筑给水排水及采暖工程', NULL, 5, '包含室内给水系统、室内排水系统、室内热水供应系统、卫生器具、室内采暖系统等', 'GB 50242-2002《建筑给水排水及采暖工程施工质量验收规范》'),
('C06', '建筑电气工程', NULL, 6, '包含架空线路及杆上电气设备、变压器、成套配电柜、电线导管等', 'GB 50303-2015《建筑电气工程施工质量验收规范》'),
('C07', '智能建筑工程', NULL, 7, '包含通信网络系统、信息网络系统、建筑设备监控系统等', 'GB 50339-2013《智能建筑工程质量验收规范》'),
('C08', '通风与空调工程', NULL, 8, '包含送排风系统、防排烟系统、空调系统等', 'GB 50243-2016《通风与空调工程施工质量验收规范》'),
('C09', '电梯工程', NULL, 9, '包含电力驱动的曳引式或强制式电梯、液压电梯、自动扶梯等', 'GB 50310-2002《电梯工程施工质量验收规范》'),
('C10', '建筑节能工程', NULL, 10, '包含墙体节能、幕墙节能、门窗节能、屋面节能等', 'GB 50411-2019《建筑节能工程施工质量验收标准》'),

-- 二级阶段 (C01 地基与基础的子工序)
('C01-01', '土方工程', 'C01', 11, '场地平整、基坑开挖、土方回填', '《土方与爆破工程施工及验收规范》GBJ 201-83'),
('C01-02', '地基处理工程', 'C01', 12, '换填垫层、预压地基、振冲地基、砂石桩等', '《建筑地基处理技术规范》JGJ 79-2012'),
('C01-03', '桩基工程', 'C01', 13, '灌注桩、预制桩等', '《建筑桩基技术规范》JGJ 94-2008'),
('C01-04', '基础工程', 'C01', 14, '无筋扩展基础、钢筋混凝土扩展基础、筏形基础等', '《混凝土结构工程施工质量验收规范》GB 50204-2015'),

-- 二级阶段 (C02 主体结构的子工序)
('C02-01', '模板工程', 'C02', 21, '模板制作、安装、拆除', '《混凝土结构工程施工质量验收规范》GB 50204-2015'),
('C02-02', '钢筋工程', 'C02', 22, '钢筋加工、连接、安装', '《混凝土结构工程施工质量验收规范》GB 50204-2015'),
('C02-03', '混凝土工程', 'C02', 23, '混凝土制备、运输、浇筑、养护', '《混凝土结构工程施工质量验收规范》GB 50204-2015'),
('C02-04', '砌体工程', 'C02', 24, '砖砌体、混凝土小型空心砌块、石砌体', '《砌体结构工程施工质量验收规范》GB 50203-2011'),
('C02-05', '钢结构工程', 'C02', 25, '钢结构焊接、螺栓连接、制作、安装', '《钢结构工程施工质量验收标准》GB 50205-2020'),

-- 二级阶段 (C04 屋面工程的子工序)
('C04-01', '找平层工程', 'C04', 41, '水泥砂浆找平、细石混凝土找平', '《屋面工程质量验收规范》GB 50207-2012'),
('C04-02', '保温隔热层工程', 'C04', 42, '板状保温材料、喷涂硬泡聚氨酯', '《屋面工程质量验收规范》GB 50207-2012'),
('C04-03', '防水层工程', 'C04', 43, '卷材防水、涂膜防水、刚性防水', '《屋面工程质量验收规范》GB 50207-2012'),
('C04-04', '瓦屋面工程', 'C04', 44, '平瓦、油毡瓦、金属板材等', '《屋面工程质量验收规范》GB 50207-2012'),

-- 二级阶段 (C05 给排水的子工序)
('C05-01', '室内给水系统安装', 'C05', 51, '给水管道及配件安装、水表、阀门、卫生器具安装', '《建筑给水排水及采暖工程施工质量验收规范》GB 50242-2002'),
('C05-02', '室内排水系统安装', 'C05', 52, '排水管道及配件安装、雨水管道', '《建筑给水排水及采暖工程施工质量验收规范》GB 50242-2002'),
('C05-03', '室内采暖系统安装', 'C05', 53, '管道及配件安装、辐射采暖、散热器', '《建筑给水排水及采暖工程施工质量验收规范》GB 50242-2002'),

-- 二级阶段 (C06 电气工程的子工序)
('C06-01', '配电箱柜安装', 'C06', 61, '成套配电柜、控制柜、动力照明配电箱', '《建筑电气工程施工质量验收规范》GB 50303-2015'),
('C06-02', '电缆桥架及线槽敷设', 'C06', 62, '电缆桥架安装、电缆敷设', '《建筑电气工程施工质量验收规范》GB 50303-2015'),
('C06-03', '电线导管敷设', 'C06', 63, '电线导管、电线、电缆穿管及线槽敷设', '《建筑电气工程施工质量验收规范》GB 50303-2015'),
('C06-04', '照明灯具安装', 'C06', 64, '照明灯具、开关插座、风扇安装', '《建筑电气工程施工质量验收规范》GB 50303-2015'),
('C06-05', '防雷接地安装', 'C06', 65, '接地装置、避雷引下线、均压环、接闪器', '《建筑电气工程施工质量验收规范》GB 50303-2015');

CREATE INDEX idx_construction_phases_parent ON construction_phases(parent_code);
CREATE INDEX idx_construction_phases_sort ON construction_phases(sort_order);

-- 2.4 装修工程标准工序阶段参考表 (基于中国装修规范 GB 50210-2018 & GB 50327-2001)
CREATE TABLE decoration_phases (
    id SERIAL PRIMARY KEY,
    phase_code VARCHAR(20) UNIQUE NOT NULL,
    phase_name VARCHAR(100) NOT NULL,
    parent_code VARCHAR(20),
    sort_order INTEGER NOT NULL,
    description TEXT,
    acceptance_standard TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE decoration_phases IS '装修工程标准工序阶段参考表 - 依据《建筑装饰装修工程质量验收标准》GB 50210-2018、《住宅装饰装修工程施工规范》GB 50327-2001';

-- 插入装修工程标准阶段
INSERT INTO decoration_phases (phase_code, phase_name, parent_code, sort_order, description, acceptance_standard) VALUES
-- 一级阶段 (主要分项)
('D01', '抹灰工程', NULL, 1, '一般抹灰、装饰抹灰、清水砌体勾缝', 'GB 50210-2018 第4章'),
('D02', '门窗工程', NULL, 2, '木门窗、金属门窗、塑料门窗、特种门、门窗玻璃', 'GB 50210-2018 第5章'),
('D03', '吊顶工程', NULL, 3, '暗龙骨吊顶、明龙骨吊顶', 'GB 50210-2018 第6章'),
('D04', '轻质隔墙工程', NULL, 4, '板材隔墙、骨架隔墙、活动隔墙、玻璃隔墙', 'GB 50210-2018 第7章'),
('D05', '饰面板工程', NULL, 5, '石材饰面、陶瓷饰面、木饰面、金属饰面、塑料饰面', 'GB 50210-2018 第8章'),
('D06', '饰面砖工程', NULL, 6, '内墙饰面砖、外墙饰面砖', 'GB 50210-2018 第9章'),
('D07', '幕墙工程', NULL, 7, '玻璃幕墙、金属幕墙、石材幕墙', 'GB 50210-2018 第10章'),
('D08', '涂饰工程', NULL, 8, '水性涂料涂饰、溶剂型涂料涂饰、美术涂饰', 'GB 50210-2018 第11章'),
('D09', '裱糊与软包工程', NULL, 9, '裱糊、软包', 'GB 50210-2018 第12章'),
('D10', '细部工程', NULL, 10, '橱柜、窗帘盒、窗台板、散热器罩、栏杆扶手、花饰等', 'GB 50210-2018 第13章'),
('D11', '地面工程', NULL, 11, '整体地面、板块地面、木竹地面', 'GB 50209-2010《建筑地面工程施工质量验收规范》'),

-- 二级阶段 (D01 抹灰工程的子工序)
('D01-01', '水泥砂浆抹灰', 'D01', 111, '内墙抹灰、外墙抹灰、顶棚抹灰', 'GB 50210-2018'),
('D01-02', '装饰抹灰', 'D01', 112, '水刷石、斩假石、干粘石、假面砖等', 'GB 50210-2018'),
('D01-03', '清水砌体勾缝', 'D01', 113, '砖砌体、石砌体勾缝', 'GB 50210-2018'),

-- 二级阶段 (D02 门窗工程的子工序)
('D02-01', '木门窗安装', 'D02', 121, '木门、木窗及其配件安装', 'GB 50210-2018'),
('D02-02', '金属门窗安装', 'D02', 122, '铝合金门窗、钢门窗、不锈钢门窗', 'GB 50210-2018'),
('D02-03', '塑料门窗安装', 'D02', 123, 'PVC、塑钢门窗', 'GB 50210-2018'),
('D02-04', '特种门安装', 'D02', 124, '防火门、防盗门、自动门、全玻门', 'GB 50210-2018'),
('D02-05', '门窗玻璃安装', 'D02', 125, '平板玻璃、安全玻璃、节能玻璃', 'GB 50210-2018'),

-- 二级阶段 (D03 吊顶工程的子工序)
('D03-01', '暗龙骨吊顶', 'D03', 131, '纸面石膏板、纤维水泥板、矿棉板、金属板、塑料板、木板等', 'GB 50210-2018'),
('D03-02', '明龙骨吊顶', 'D03', 132, '金属条板、矿棉板、塑料板、玻璃板等', 'GB 50210-2018'),

-- 二级阶段 (D05 饰面板工程的子工序)
('D05-01', '石材饰面安装', 'D05', 151, '大理石、花岗石等板材饰面', 'GB 50210-2018'),
('D05-02', '陶瓷饰面安装', 'D05', 152, '陶瓷锦砖、陶瓷饰面板', 'GB 50210-2018'),
('D05-03', '木饰面安装', 'D05', 153, '人造木板、复合木板饰面', 'GB 50210-2018'),
('D05-04', '金属饰面安装', 'D05', 154, '铝单板、铝塑板、不锈钢板等', 'GB 50210-2018'),

-- 二级阶段 (D08 涂饰工程的子工序)
('D08-01', '水性涂料涂饰', 'D08', 181, '乳液型涂料、水溶性涂料', 'GB 50210-2018'),
('D08-02', '溶剂型涂料涂饰', 'D08', 182, '丙烯酸酯涂料、硝基涂料、氟碳涂料等', 'GB 50210-2018'),
('D08-03', '美术涂饰', 'D08', 183, '套色涂饰、滚花涂饰、仿花纹涂饰等', 'GB 50210-2018'),

-- 二级阶段 (D10 细部工程的子工序)
('D10-01', '橱柜制作安装', 'D10', 1001, '壁柜、吊柜安装', 'GB 50210-2018'),
('D10-02', '窗帘盒及窗台板安装', 'D10', 1002, '木质窗帘盒、窗台板', 'GB 50210-2018'),
('D10-03', '护栏扶手安装', 'D10', 1003, '木护栏、金属护栏、楼梯扶手', 'GB 50210-2018'),
('D10-04', '花饰安装', 'D10', 1004, '石膏花饰、木花饰、塑料花饰', 'GB 50210-2018'),

-- 二级阶段 (D11 地面工程的子工序)
('D11-01', '整体地面', 'D11', 1101, '水泥混凝土、水泥砂浆、水磨石、防油渗、不发火地面', 'GB 50209-2010'),
('D11-02', '板块地面', 'D11', 1102, '砖面层、大理石花岗石、预制板块、料石、塑料、活动地板、地毯等', 'GB 50209-2010'),
('D11-03', '木竹地面', 'D11', 1103, '实木地板、实木复合地板、强化复合地板、竹地板', 'GB 50209-2010');

CREATE INDEX idx_decoration_phases_parent ON decoration_phases(parent_code);
CREATE INDEX idx_decoration_phases_sort ON decoration_phases(sort_order);

-- ============================================================
-- 3. 三级进度汇报模块 (核心新增)
-- ============================================================

-- 3.1 日报表 (Daily Report)
CREATE TABLE daily_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    worker_group VARCHAR(100) NOT NULL,
    submitter_id INTEGER NOT NULL REFERENCES sys_users(id),
    
    -- 今日完成情况 (量化数据)
    completed_tasks JSONB DEFAULT '[]',
    total_completed_qty DECIMAL(10, 2) DEFAULT 0,
    unit VARCHAR(20),
    
    -- 明日计划
    plan_next_day TEXT,
    
    -- 异常与缺料报告
    issues TEXT,
    material_shortage TEXT,
    
    -- 多照片存储 (强制至少3张)
    photos_json JSONB DEFAULT '[]',
    photo_count INTEGER DEFAULT 0,
    
    -- 天气与工人数量
    weather VARCHAR(50),
    worker_count INTEGER DEFAULT 0,
    
    -- 审批流
    status VARCHAR(20) DEFAULT 'pending',
    reviewer_id INTEGER REFERENCES sys_users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(project_id, report_date, worker_group)
);

COMMENT ON TABLE daily_reports IS '日报表 - 现场班组每日必填';
COMMENT ON COLUMN daily_reports.completed_tasks IS 'JSON数组: [{"task_id": 1, "task_name": "浇筑混凝土", "qty": 50, "unit": "m³"}]';
COMMENT ON COLUMN daily_reports.photos_json IS 'JSON数组: [{"url": "/uploads/...", "watermark": "2024-01-15 16:30 | GPS: 9.5°N, 100.0°E | 项目A | 张三"}]';
COMMENT ON COLUMN daily_reports.status IS '状态: pending(待审核), approved(已批准), rejected(已驳回)';

CREATE INDEX idx_daily_reports_project ON daily_reports(project_id);
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_daily_reports_status ON daily_reports(status);

-- 3.2 周报表 (Weekly Report)
CREATE TABLE weekly_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    submitter_id INTEGER NOT NULL REFERENCES sys_users(id),
    
    -- 本周计划 vs 实际对比 (从日报自动汇总)
    plan_vs_actual_json JSONB DEFAULT '{}',
    
    -- 进度偏差分析
    deviation_percentage DECIMAL(5, 2) DEFAULT 0,
    deviation_analysis TEXT,
    
    -- 下周计划
    next_week_plan TEXT,
    
    -- 资源需求
    resource_needs TEXT,
    
    -- 质量与安全总结
    quality_summary TEXT,
    safety_summary TEXT,
    
    -- 审批流
    status VARCHAR(20) DEFAULT 'pending',
    approver_id INTEGER REFERENCES sys_users(id),
    approved_at TIMESTAMP,
    approval_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(project_id, week_start)
);

COMMENT ON TABLE weekly_reports IS '周报表 - 项目经理每周五填写';
COMMENT ON COLUMN weekly_reports.plan_vs_actual_json IS 'JSON对象: {"planned": 500, "actual": 450, "completion_rate": 90, "tasks": [...]}';
COMMENT ON COLUMN weekly_reports.deviation_percentage IS '进度偏差百分比，超过10%自动标红';

CREATE INDEX idx_weekly_reports_project ON weekly_reports(project_id);
CREATE INDEX idx_weekly_reports_week ON weekly_reports(week_start);

-- 3.3 月报表 (Monthly Report)
CREATE TABLE monthly_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    report_month DATE NOT NULL,
    submitter_id INTEGER NOT NULL REFERENCES sys_users(id),
    
    -- 月度里程碑达成情况
    milestone_achievement_json JSONB DEFAULT '[]',
    overall_completion_rate DECIMAL(5, 2) DEFAULT 0,
    
    -- 成本消耗分析
    planned_cost DECIMAL(15, 2) DEFAULT 0,
    actual_cost DECIMAL(15, 2) DEFAULT 0,
    cost_variance DECIMAL(15, 2) DEFAULT 0,
    cost_analysis TEXT,
    
    -- 质量与安全总结
    quality_summary TEXT,
    safety_incidents INTEGER DEFAULT 0,
    safety_summary TEXT,
    
    -- 下月计划
    next_month_plan TEXT,
    
    -- 风险与建议
    risks TEXT,
    recommendations TEXT,
    
    -- 审批流
    status VARCHAR(20) DEFAULT 'draft',
    approver_id INTEGER REFERENCES sys_users(id),
    approved_at TIMESTAMP,
    approval_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(project_id, report_month)
);

COMMENT ON TABLE monthly_reports IS '月报表 - 系统自动生成 + 项目经理补充';
COMMENT ON COLUMN monthly_reports.milestone_achievement_json IS 'JSON数组: [{"milestone": "主体结构封顶", "planned_date": "2024-01-31", "actual_date": "2024-02-05", "achieved": true}]';
COMMENT ON COLUMN monthly_reports.status IS '状态: draft(草稿), pending(待审批), approved(已批准)';

CREATE INDEX idx_monthly_reports_project ON monthly_reports(project_id);
CREATE INDEX idx_monthly_reports_month ON monthly_reports(report_month);

-- ============================================================
-- 4. 照片管理模块
-- ============================================================

CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    uploader_id INTEGER NOT NULL REFERENCES sys_users(id),
    related_type VARCHAR(50) NOT NULL,
    related_id INTEGER NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size INTEGER,
    original_name VARCHAR(255),
    
    -- 水印信息 (前端 Canvas 生成)
    watermark_info JSONB DEFAULT '{}',
    
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE photos IS '照片统一管理表';
COMMENT ON COLUMN photos.related_type IS '关联类型: daily_report, task_verification, purchase_request, change_order';
COMMENT ON COLUMN photos.watermark_info IS 'JSON对象: {"timestamp": "2024-01-15 16:30", "gps": "9.5°N, 100.0°E", "project": "项目A", "uploader": "张三"}';

CREATE INDEX idx_photos_project ON photos(project_id);
CREATE INDEX idx_photos_related ON photos(related_type, related_id);

-- ============================================================
-- 5. 材料采购闭环模块 (三单匹配)
-- ============================================================

-- 5.1 采购申请表
CREATE TABLE purchase_requests (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    request_no VARCHAR(50) UNIQUE NOT NULL,
    initiator_id INTEGER NOT NULL REFERENCES sys_users(id),
    request_date DATE NOT NULL,
    
    -- 申请明细
    items_json JSONB DEFAULT '[]',
    total_estimated_cost DECIMAL(15, 2) DEFAULT 0,
    urgency VARCHAR(20) DEFAULT 'normal',
    reason TEXT NOT NULL,
    
    -- 审批流
    status VARCHAR(20) DEFAULT 'pending',
    approver_id INTEGER REFERENCES sys_users(id),
    approved_at TIMESTAMP,
    approval_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE purchase_requests IS '采购申请表 - 现场发起';
COMMENT ON COLUMN purchase_requests.items_json IS 'JSON数组: [{"material": "水泥", "spec": "425#", "qty": 100, "unit": "吨", "estimated_price": 500}]';
COMMENT ON COLUMN purchase_requests.urgency IS '紧急程度: urgent(紧急), normal(正常), low(不急)';
COMMENT ON COLUMN purchase_requests.status IS '状态: pending(待审批), approved(已批准), rejected(已驳回), cancelled(已取消)';

CREATE INDEX idx_purchase_requests_project ON purchase_requests(project_id);
CREATE INDEX idx_purchase_requests_status ON purchase_requests(status);

-- 5.2 采购订单表
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    purchaser_id INTEGER NOT NULL REFERENCES sys_users(id),
    supplier_name VARCHAR(200) NOT NULL,
    supplier_contact VARCHAR(100),
    order_date DATE NOT NULL,
    expected_delivery DATE,
    
    -- 订单明细
    items_json JSONB DEFAULT '[]',
    total_amount DECIMAL(15, 2) DEFAULT 0,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'ordered',
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE purchase_orders IS '采购订单表 - 采购员执行';
COMMENT ON COLUMN purchase_orders.items_json IS 'JSON数组: [{"material": "水泥", "qty": 100, "unit": "吨", "price": 480, "amount": 48000}]';
COMMENT ON COLUMN purchase_orders.status IS '状态: ordered(已下单), partial_received(部分到货), received(全部到货), cancelled(已取消)';

CREATE INDEX idx_purchase_orders_project ON purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_request ON purchase_orders(request_id);

-- 5.3 到货验收表
CREATE TABLE goods_receipts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    receipt_no VARCHAR(50) UNIQUE NOT NULL,
    receiver_id INTEGER NOT NULL REFERENCES sys_users(id),
    receipt_date DATE NOT NULL,
    
    -- 实收明细
    items_json JSONB DEFAULT '[]',
    
    -- 质量验收
    quality_status VARCHAR(20) DEFAULT 'accepted',
    quality_notes TEXT,
    
    -- 照片留痕
    photos_json JSONB DEFAULT '[]',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE goods_receipts IS '到货验收表 - 现场验收';
COMMENT ON COLUMN goods_receipts.items_json IS 'JSON数组: [{"material": "水泥", "ordered_qty": 100, "received_qty": 98, "unit": "吨", "variance": -2}]';
COMMENT ON COLUMN goods_receipts.quality_status IS '质量状态: accepted(合格), rejected(不合格), partial(部分合格)';

CREATE INDEX idx_goods_receipts_order ON goods_receipts(order_id);
CREATE INDEX idx_goods_receipts_project ON goods_receipts(project_id);

-- 5.4 账单表
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_date DATE NOT NULL,
    
    -- 账单明细
    items_json JSONB DEFAULT '[]',
    total_amount DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    
    -- 三单匹配状态
    matching_status VARCHAR(20) DEFAULT 'pending',
    variance_notes TEXT,
    
    -- 付款状态
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    paid_at TIMESTAMP,
    
    created_by INTEGER REFERENCES sys_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE invoices IS '账单表 - 财务录入';
COMMENT ON COLUMN invoices.matching_status IS '三单匹配状态: pending(待匹配), matched(匹配通过), mismatched(有差异-禁止付款)';
COMMENT ON COLUMN invoices.payment_status IS '付款状态: unpaid(未付款), partial(部分付款), paid(已付款)';

CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_matching ON invoices(matching_status);
CREATE INDEX idx_invoices_payment ON invoices(payment_status);

-- ============================================================
-- 6. 工程变更签证模块
-- ============================================================

CREATE TABLE change_orders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES sys_projects(id) ON DELETE CASCADE,
    change_no VARCHAR(50) UNIQUE NOT NULL,
    initiator_id INTEGER NOT NULL REFERENCES sys_users(id),
    submit_date DATE NOT NULL,
    
    -- 变更描述
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    reason TEXT NOT NULL,
    
    -- 影响分析
    cost_impact DECIMAL(15, 2) DEFAULT 0,
    schedule_impact_days INTEGER DEFAULT 0,
    scope_impact TEXT,
    
    -- 对比照片/图纸
    before_photos_json JSONB DEFAULT '[]',
    after_photos_json JSONB DEFAULT '[]',
    
    -- 审批流 (只有老板能批)
    status VARCHAR(20) DEFAULT 'pending',
    approver_id INTEGER REFERENCES sys_users(id),
    approved_at TIMESTAMP,
    approval_notes TEXT,
    
    -- 执行情况
    executor_id INTEGER REFERENCES sys_users(id),
    executed_at TIMESTAMP,
    actual_cost DECIMAL(15, 2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE change_orders IS '工程变更签证表 - 严格审批';
COMMENT ON COLUMN change_orders.status IS '状态: pending(待审批), approved(已批准), rejected(已驳回), executing(执行中), completed(已完成)';
COMMENT ON COLUMN change_orders.cost_impact IS '预计增加成本 (可为负数，表示减少)';
COMMENT ON COLUMN change_orders.schedule_impact_days IS '预计延长工期天数 (可为负数)';

CREATE INDEX idx_change_orders_project ON change_orders(project_id);
CREATE INDEX idx_change_orders_status ON change_orders(status);

-- ============================================================
-- 7. 系统日志与审计
-- ============================================================

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES sys_users(id),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    ip_address VARCHAR(50),
    user_agent TEXT,
    request_body JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE audit_logs IS '系统审计日志';

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- 8. 触发器与自动更新
-- ============================================================

-- 8.1 自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用到所有需要的表
CREATE TRIGGER update_sys_users_updated_at BEFORE UPDATE ON sys_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sys_projects_updated_at BEFORE UPDATE ON sys_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wbs_tasks_updated_at BEFORE UPDATE ON wbs_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_reports_updated_at BEFORE UPDATE ON daily_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_reports_updated_at BEFORE UPDATE ON weekly_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_reports_updated_at BEFORE UPDATE ON monthly_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_change_orders_updated_at BEFORE UPDATE ON change_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. 初始化测试数据 (可选)
-- ============================================================

-- 创建默认管理员账户 (密码: Admin@123)
INSERT INTO sys_users (username, password_hash, full_name, email, phone) VALUES
('admin', '$2b$10$rKYQP5Y3Zu6nQXvZxK5qS.vPjE8fFqX9nZnTVU0wLg2oc5KxLQDdq', '系统管理员', 'admin@example.com', '+66-123-456-789');

-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
