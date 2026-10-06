-- ============================================================
-- 极简工程项目管理系统 - 最终数据库设计
-- 版本: 2.0 FINAL
-- 核心原则：字段命名完全一致，架构清晰
-- ============================================================

-- 清理旧数据
DROP TABLE IF EXISTS daily_attendance CASCADE;
DROP TABLE IF EXISTS process_materials CASCADE;
DROP TABLE IF EXISTS project_materials CASCADE;
DROP TABLE IF EXISTS material_library CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS issue_reports CASCADE;
DROP TABLE IF EXISTS material_records CASCADE;
DROP TABLE IF EXISTS node_records CASCADE;
DROP TABLE IF EXISTS process_nodes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ============================================================
-- 1. 项目表
-- ============================================================
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    start_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE projects IS '项目表';
COMMENT ON COLUMN projects.status IS 'active/paused/completed';

-- ============================================================
-- 2. 用户表（登录账号）
-- ============================================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS '用户表 - 登录账号';
COMMENT ON COLUMN users.role IS 'boss/worker';

CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- 3. 标准工序节点模板（全局共享，16个标准工序）
-- ============================================================
CREATE TABLE process_nodes (
    id SERIAL PRIMARY KEY,
    node_name VARCHAR(100) NOT NULL,
    node_code VARCHAR(50) UNIQUE NOT NULL,
    sort_order INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE process_nodes IS '标准工序节点模板 - 全局16个标准工序';
COMMENT ON COLUMN process_nodes.sort_order IS '排序序号';

CREATE INDEX idx_process_nodes_sort ON process_nodes(sort_order);

-- ============================================================
-- 4. 工人表（项目现场工人，无需登录）
-- ============================================================
CREATE TABLE workers (
    worker_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50),
    phone VARCHAR(20),
    daily_wage DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE workers IS '工人表 - 项目现场工人';
COMMENT ON COLUMN workers.role IS '工种：木工/泥瓦工/水电工等';
COMMENT ON COLUMN workers.status IS 'active/inactive';

CREATE INDEX idx_workers_project ON workers(project_id);

-- ============================================================
-- 5. 每日考勤表
-- ============================================================
CREATE TABLE daily_attendance (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    hours_worked DECIMAL(4, 2),
    notes TEXT,
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE daily_attendance IS '每日考勤表';
COMMENT ON COLUMN daily_attendance.status IS 'present/absent/leave/halfday';
COMMENT ON COLUMN daily_attendance.hours_worked IS '实际工作小时数';

CREATE INDEX idx_attendance_project ON daily_attendance(project_id);
CREATE INDEX idx_attendance_worker ON daily_attendance(worker_id);
CREATE INDEX idx_attendance_date ON daily_attendance(attendance_date);
CREATE UNIQUE INDEX idx_attendance_unique ON daily_attendance(worker_id, attendance_date);

-- ============================================================
-- 6. 标准材料库（26种标准材料）
-- ============================================================
CREATE TABLE material_library (
    id SERIAL PRIMARY KEY,
    material_code VARCHAR(50) UNIQUE NOT NULL,
    material_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    default_unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE material_library IS '标准材料库 - 26种标准材料';
COMMENT ON COLUMN material_library.category IS '分类：structural/plumbing/electrical/finishing';

CREATE INDEX idx_material_category ON material_library(category);

-- ============================================================
-- 7. 项目材料需求与进场记录
-- ============================================================
CREATE TABLE project_materials (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES material_library(id),
    material_name VARCHAR(100) NOT NULL,
    planned_quantity DECIMAL(10, 2),
    received_quantity DECIMAL(10, 2) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(10, 2),
    total_cost DECIMAL(12, 2),
    planned_date DATE,
    actual_date DATE,
    supplier VARCHAR(200),
    status VARCHAR(20) DEFAULT 'planned',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE project_materials IS '项目材料表 - 需求计划与进场记录';
COMMENT ON COLUMN project_materials.status IS 'planned/partial/received';

CREATE INDEX idx_project_materials_project ON project_materials(project_id);
CREATE INDEX idx_project_materials_material ON project_materials(material_id);
CREATE INDEX idx_project_materials_status ON project_materials(status);

-- ============================================================
-- 插入标准工序节点（16个）
-- ============================================================
INSERT INTO process_nodes (node_name, node_code, sort_order, description) VALUES
('地基开挖', 'N01_EXCAVATION', 1, '场地平整、基坑开挖'),
('地基浇筑', 'N02_FOUNDATION', 2, '混凝土基础浇筑'),
('主体框架', 'N03_STRUCTURE', 3, '柱梁板施工'),
('屋面封顶', 'N04_ROOF_FRAME', 4, '屋顶结构完成'),
('水电布管', 'N05_MEP_ROUGH', 5, '水电管线预埋'),
('水电隐蔽工程', 'N06_MEP_HIDDEN', 6, '⭐ 管线隐蔽前验收'),
('防水工程', 'N07_WATERPROOF', 7, '⭐ 卫生间、屋面防水'),
('砌墙隔断', 'N08_WALL_PARTITION', 8, '内墙砌筑'),
('泥瓦抹灰', 'N09_PLASTERING', 9, '墙面地面抹灰找平'),
('瓷砖铺贴', 'N10_TILING', 10, '地面墙面贴砖'),
('木工吊顶', 'N11_CEILING', 11, '吊顶龙骨、石膏板安装'),
('油漆涂刷', 'N12_PAINTING', 12, '墙面乳胶漆、木器漆'),
('门窗安装', 'N13_DOOR_WINDOW', 13, '成品门窗、玻璃安装'),
('洁具安装', 'N14_SANITARY', 14, '马桶、洗手盆、花洒安装'),
('灯具开关', 'N15_LIGHTING', 15, '灯具、开关插座安装'),
('清洁验收', 'N16_CLEANING', 16, '最终清洁、整体验收');

-- ============================================================
-- 插入标准材料库（26种）
-- ============================================================
INSERT INTO material_library (material_code, material_name, category, default_unit) VALUES
-- 结构材料 (Structural Materials)
('MAT001', '水泥', 'structural', '吨'),
('MAT002', '钢筋', 'structural', '吨'),
('MAT003', '混凝土', 'structural', '立方米'),
('MAT004', '砖块', 'structural', '块'),
('MAT005', '砂石', 'structural', '立方米'),

-- 水电材料 (Plumbing & Electrical)
('MAT006', 'PVC水管', 'plumbing', '米'),
('MAT007', 'PPR水管', 'plumbing', '米'),
('MAT008', '电线', 'electrical', '米'),
('MAT009', '电缆', 'electrical', '米'),
('MAT010', '开关插座', 'electrical', '个'),
('MAT011', '配电箱', 'electrical', '个'),
('MAT012', '水龙头', 'plumbing', '个'),
('MAT013', '角阀', 'plumbing', '个'),

-- 防水材料 (Waterproofing)
('MAT014', '防水涂料', 'waterproofing', '桶'),
('MAT015', '防水卷材', 'waterproofing', '卷'),

-- 装修材料 (Finishing Materials)
('MAT016', '瓷砖', 'finishing', '平方米'),
('MAT017', '木地板', 'finishing', '平方米'),
('MAT018', '乳胶漆', 'finishing', '桶'),
('MAT019', '腻子粉', 'finishing', '袋'),
('MAT020', '石膏板', 'finishing', '张'),
('MAT021', '木龙骨', 'finishing', '根'),

-- 门窗与洁具 (Doors, Windows & Sanitary)
('MAT022', '木门', 'doors_windows', '扇'),
('MAT023', '铝合金窗', 'doors_windows', '平方米'),
('MAT024', '马桶', 'sanitary', '个'),
('MAT025', '洗手盆', 'sanitary', '个'),
('MAT026', '花洒', 'sanitary', '套');

-- ============================================================
-- 插入测试用户
-- ============================================================
INSERT INTO users (username, password_hash, full_name, role, phone) VALUES
('admin', '$2b$10$rKYQP5Y3Zu6nQXvZxK5qS.vPjE8fFqX9nZnTVU0wLg2oc5KxLQDdq', '管理员', 'boss', '+66-123-456-789'),
('worker1', '$2b$10$X8vJ9nZxK2wQ5yP3mR4tL.vHjE8fFqX9nZnTVU0wLg2oc5KxLQAbc', '工人一', 'worker', '+66-987-654-321');

-- 密码：admin/123456, worker1/123456

-- ============================================================
-- 插入测试项目
-- ============================================================
INSERT INTO projects (project_name, location, start_date) VALUES
('泰国苏梅岛别墅项目', '泰国苏梅岛', '2024-01-01'),
('曼谷公寓翻新项目', '泰国曼谷', '2024-02-01');

-- ============================================================
-- 完成！
-- 
-- 核心设计要点：
-- 1. 主键统一用 id（除了users表用user_id，workers表用worker_id）
-- 2. 外键统一用 {table}_id 格式
-- 3. 时间字段统一用 created_at, updated_at, confirmed_at
-- 4. 状态字段统一用 status
-- 5. 工序是全局共享（process_nodes 表无 project_id）
-- 6. 材料库全局共享（material_library 表无 project_id）
-- 7. 执行记录关联项目（node_records, project_materials 有 project_id）
-- ============================================================
