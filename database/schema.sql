-- 极简版施工管理系统数据库架构
-- PostgreSQL 12+

-- 用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'worker',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name JSONB NOT NULL,  -- {"zh": "xx小区", "th": "หมู่บ้านxx"}
    location JSONB,
    client_name VARCHAR(100),
    start_date DATE,
    planned_end_date DATE,
    actual_end_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 工序节点表（标准16工序）
CREATE TABLE process_nodes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    process_code VARCHAR(20) NOT NULL,  -- N01_EXCAVATION, N02_FOUNDATION...
    process_name JSONB NOT NULL,  -- {"zh": "土方开挖", "th": "ขุดดิน"}
    sequence_number INTEGER,
    planned_start_date DATE,
    planned_end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 工序执行记录表
CREATE TABLE process_execution (
    id SERIAL PRIMARY KEY,
    process_node_id INTEGER REFERENCES process_nodes(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,  -- not_started, in_progress, waiting_material, weather_stop, completed
    assigned_workers JSONB,  -- [{"name": "张三", "role": "工长"}]
    actual_start_date DATE,
    actual_end_date DATE,
    measurements JSONB,  -- {"length": 10, "width": 5, "height": 3, "unit": "m", "quantity": 150}
    notes JSONB,  -- {"zh": "进度正常", "th": "ความคืบหน้าปกติ"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 材料表
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    material_code VARCHAR(50) UNIQUE NOT NULL,
    material_name JSONB NOT NULL,  -- {"zh": "水泥", "th": "ปูนซีเมนต์"}
    unit JSONB NOT NULL,  -- {"zh": "吨", "th": "ตัน"}
    unit_price DECIMAL(10,2),
    supplier VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 材料使用记录表
CREATE TABLE material_usage (
    id SERIAL PRIMARY KEY,
    process_execution_id INTEGER REFERENCES process_execution(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES materials(id),
    usage_type VARCHAR(20) NOT NULL,  -- calculated, purchased, received, used
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20),
    purchase_date DATE,
    received_date DATE,
    used_date DATE,
    notes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 现场照片表
CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    process_execution_id INTEGER REFERENCES process_execution(id) ON DELETE CASCADE,
    photo_url VARCHAR(255) NOT NULL,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location JSONB,  -- {"lat": 13.7563, "lng": 100.5018}
    notes JSONB
);

-- 创建索引
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_process_nodes_project ON process_nodes(project_id);
CREATE INDEX idx_process_execution_node ON process_execution(process_node_id);
CREATE INDEX idx_process_execution_status ON process_execution(status);
CREATE INDEX idx_material_usage_process ON material_usage(process_execution_id);
CREATE INDEX idx_photos_process ON photos(process_execution_id);

-- 插入默认管理员用户 (password: admin123)
-- 哈希值通过bcrypt生成: await bcrypt.hash('admin123', 10)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$.iORE4XTXc3mNVadMGITYORv/LTzx9t56i6UyFumcGjsv89OEH4Xe', 'admin')
ON CONFLICT (username) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;

-- 插入标准16工序模板（供创建项目时复制）
-- 这些是参考数据，实际工序通过API创建项目时自动生成
-- N01 土方开挖 / ขุดดิน
-- N02 地基浇筑 / เทฐานราก
-- N03 主体框架 / โครงสร้างหลัก
-- N04 屋面封顶 / มุงหลังคา
-- N05 水电布管 / เดินท่อน้ำและไฟ
-- N06 水电隐蔽工程 / ตรวจงานซ่อนน้ำไฟ
-- N07 防水工程 / งานกันซึม
-- N08 砌墙隔断 / ก่อผนัง
-- N09 泥瓦抹灰 / ฉาบปูน
-- N10 瓷砖铺贴 / ปูกระเบื้อง
-- N11 木工吊顶 / ทำฝ้าเพดาน
-- N12 油漆涂刷 / ทาสี
-- N13 门窗安装 / ติดตั้งประตูหน้าต่าง
-- N14 洁具安装 / ติดตั้งสุขภัณฑ์
-- N15 灯具开关 / ติดตั้งไฟและสวิตช์
-- N16 清洁验收 / ทำความสะอาดและตรวจรับ

-- 插入常用材料（中泰双语）
INSERT INTO materials (material_code, material_name, unit, unit_price, supplier) VALUES
('MAT001', '{"zh": "水泥", "th": "ปูนซีเมนต์"}', '{"zh": "吨", "th": "ตัน"}', 350.00, '建材市场'),
('MAT002', '{"zh": "钢筋", "th": "เหล็กเส้น"}', '{"zh": "吨", "th": "ตัน"}', 4200.00, '建材市场'),
('MAT003', '{"zh": "混凝土", "th": "คอนกรีต"}', '{"zh": "立方米", "th": "ลูกบาศก์เมตร"}', 450.00, '混凝土厂'),
('MAT004', '{"zh": "红砖", "th": "อิฐแดง"}', '{"zh": "块", "th": "ก้อน"}', 0.60, '建材市场'),
('MAT005', '{"zh": "瓷砖", "th": "กระเบื้อง"}', '{"zh": "平方米", "th": "ตารางเมตร"}', 45.00, '瓷砖店'),
('MAT006', '{"zh": "木材", "th": "ไม้"}', '{"zh": "立方米", "th": "ลูกบาศก์เมตร"}', 1800.00, '木材厂'),
('MAT007', '{"zh": "防水涂料", "th": "สีกันซึม"}', '{"zh": "桶", "th": "ถัง"}', 280.00, '建材市场'),
('MAT008', '{"zh": "电线", "th": "สายไฟ"}', '{"zh": "米", "th": "เมตร"}', 5.50, '电料店'),
('MAT009', '{"zh": "水管", "th": "ท่อน้ำ"}', '{"zh": "米", "th": "เมตร"}', 12.00, '建材市场'),
('MAT010', '{"zh": "油漆", "th": "สี"}', '{"zh": "桶", "th": "ถัง"}', 180.00, '油漆店');

COMMENT ON TABLE users IS '用户表';
COMMENT ON TABLE projects IS '项目表';
COMMENT ON TABLE process_nodes IS '工序节点表';
COMMENT ON TABLE process_execution IS '工序执行记录表';
COMMENT ON TABLE materials IS '材料表';
COMMENT ON TABLE material_usage IS '材料使用记录表';
COMMENT ON TABLE photos IS '现场照片表';
