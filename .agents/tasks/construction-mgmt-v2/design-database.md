# 数据库设计文档 - Construction Management System v2

**版本**: 2.1  
**创建日期**: 2024-01-15

---

## 1. 设计策略

### 1.1 表分类

**保留不变**（复用现有）:
- `users` - 用户表
- `projects` - 项目表

**扩展**（添加新字段）:
- `process_nodes` - 工序节点表（从16个扩展到31个，添加计算相关字段）
- `node_records` - 工序打卡记录表（添加base_data, calculated_*字段）
- `material_records` - 材料进场记录表（添加material_code关联）

**新增**（全新创建）:
- `material_library` - 材料库（50种材料）
- `tool_library` - 工具库（30种工具）
- `workers` - 工人花名册
- `daily_attendance` - 每日签到记录
- `cost_summary` - 成本汇总（物化视图）

---

## 2. 扩展现有表

### 2.1 process_nodes扩展

**添加新字段**:
```sql
ALTER TABLE process_nodes
  ADD COLUMN IF NOT EXISTS name_i18n JSONB,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB,
  ADD COLUMN IF NOT EXISTS base_data_schema JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS worker_quota JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS material_quotas JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tool_codes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_days INTEGER DEFAULT 1;

COMMENT ON COLUMN process_nodes.name_i18n IS '工序名称（三语言）：{"zh": "地基开挖", "th": "ขุดฐานราก", "en": "Foundation Excavation"}';
COMMENT ON COLUMN process_nodes.base_data_schema IS '基础数据模式：{"length": {"type": "number", "unit": "m", "label_zh": "长度", "required": true, "min": 0.1, "max": 1000}}';
COMMENT ON COLUMN process_nodes.worker_quota IS '人工定额：{"unit": "m3", "labor_per_unit": 0.5, "min_workers": 3, "max_workers": 15, "productivity": 30}';
COMMENT ON COLUMN process_nodes.material_quotas IS '材料定额：{"M001": {"quantity_per_unit": 0.3, "unit": "m3", "result_unit": "t", "loss_rate": 0.03}}';
COMMENT ON COLUMN process_nodes.tool_codes IS '所需工具代码数组：["T001", "T002"]';
COMMENT ON COLUMN process_nodes.estimated_days IS '预估工期（天）';

-- 添加约束
ALTER TABLE process_nodes
  ADD CONSTRAINT check_name_i18n_complete 
    CHECK (
      name_i18n IS NULL OR (
        name_i18n ? 'zh' AND name_i18n ? 'th' AND name_i18n ? 'en' AND
        LENGTH(name_i18n->>'zh') > 0 AND
        LENGTH(name_i18n->>'th') > 0 AND
        LENGTH(name_i18n->>'en') > 0
      )
    );

-- 迁移现有数据
UPDATE process_nodes 
SET name_i18n = jsonb_build_object(
  'zh', node_name,
  'th', node_name,  -- 待翻译
  'en', node_name   -- 待翻译
)
WHERE name_i18n IS NULL;
```

**扩展至31个工序**（从现有16个扩展）:
```sql
-- 插入新增的15个工序（P017-P031）
INSERT INTO process_nodes (node_name, node_code, name_i18n, prev_node_id, sort_order, estimated_days) VALUES
('墙面打磨', 'P017', '{"zh": "墙面打磨", "th": "ขัดผนัง", "en": "Wall Sanding"}', 16, 17, 2),
('墙面批灰', 'P018', '{"zh": "墙面批灰", "th": "โป๊วผนัง", "en": "Wall Plastering"}', 17, 18, 3),
('地面找平', 'P019', '{"zh": "地面找平", "th": "ปรับระดับพื้น", "en": "Floor Leveling"}', 18, 19, 2),
('厨卫防水', 'P020', '{"zh": "厨卫防水", "th": "กันซึมห้องน้ำครัว", "en": "Kitchen/Bath Waterproofing"}', 19, 20, 2),
('厨卫贴砖', 'P021', '{"zh": "厨卫贴砖", "th": "ปูกระเบื้องห้องน้ำครัว", "en": "Kitchen/Bath Tiling"}', 20, 21, 3),
('客厅贴砖', 'P022', '{"zh": "客厅贴砖", "th": "ปูกระเบื้องห้องนั่งเล่น", "en": "Living Room Tiling"}', 21, 22, 2),
('卧室地板', 'P023', '{"zh": "卧室地板", "th": "พื้นไม้ห้องนอน", "en": "Bedroom Flooring"}', 22, 23, 2),
('踢脚线安装', 'P024', '{"zh": "踢脚线安装", "th": "ติดบัวพื้น", "en": "Baseboard Installation"}', 23, 24, 1),
('橱柜安装', 'P025', '{"zh": "橱柜安装", "th": "ติดตั้งตู้ครัว", "en": "Cabinet Installation"}', 24, 25, 2),
('卫浴五金', 'P026', '{"zh": "卫浴五金", "th": "อุปกรณ์ห้องน้ำ", "en": "Bathroom Fixtures"}', 25, 26, 1),
('窗帘轨道', 'P027', '{"zh": "窗帘轨道", "th": "รางม่าน", "en": "Curtain Rails"}', 26, 27, 1),
('家具进场', 'P028', '{"zh": "家具进场", "th": "ติดตั้งเฟอร์นิเจอร์", "en": "Furniture Installation"}', 27, 28, 1),
('电器安装', 'P029', '{"zh": "电器安装", "th": "ติดตั้งเครื่องใช้ไฟฟ้า", "en": "Appliance Installation"}', 28, 29, 1),
('保洁收尾', 'P030', '{"zh": "保洁收尾", "th": "ทำความสะอาดขั้นสุดท้าย", "en": "Final Cleaning"}', 29, 30, 2),
('竣工验收', 'P031', '{"zh": "竣工验收", "th": "ตรวจรับมอบงาน", "en": "Final Acceptance"}', 30, 31, 1);

-- 更新prev_node_id链接（将新工序链接到第16个工序）
UPDATE process_nodes SET prev_node_id = 16 WHERE node_code = 'P017';
```

### 2.2 node_records扩展

```sql
ALTER TABLE node_records
  ADD COLUMN IF NOT EXISTS base_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS calculated_workers JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS calculated_materials JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS calculated_tools JSONB DEFAULT '{}';

COMMENT ON COLUMN node_records.base_data IS '基础数据（用户输入）：{"length": 50, "width": 30, "depth": 2, "area": 1500, "volume": 3000}';
COMMENT ON COLUMN node_records.calculated_workers IS '计算的工人需求：{"count": 5, "formula": "...", "breakdown": "...", "total_work_days": 1500}';
COMMENT ON COLUMN node_records.calculated_materials IS '计算的材料需求：{"M001": {"quantity": 900, "unit": "吨", "formula": "..."}}';
COMMENT ON COLUMN node_records.calculated_tools IS '计算的工具需求：{"T001": {"name_zh": "挖掘机", "quantity": 1}}';

-- 为现有记录设置默认值
UPDATE node_records 
SET 
  base_data = '{}',
  calculated_workers = '{"count": 0}',
  calculated_materials = '{}',
  calculated_tools = '{}'
WHERE base_data IS NULL;
```

### 2.3 material_records扩展

```sql
ALTER TABLE material_records
  ADD COLUMN IF NOT EXISTS material_code VARCHAR(10);

-- 添加外键（在创建material_library表后）
-- ALTER TABLE material_records
--   ADD CONSTRAINT fk_material_code 
--     FOREIGN KEY (material_code) 
--     REFERENCES material_library(material_code);

COMMENT ON COLUMN material_records.material_code IS '材料代码（关联material_library），如 M001';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_material_records_code ON material_records(material_code);
```

---

## 3. 新增表

### 3.1 material_library（材料库）

```sql
CREATE TABLE material_library (
    id SERIAL PRIMARY KEY,
    material_code VARCHAR(10) UNIQUE NOT NULL,
    name_i18n JSONB NOT NULL,
    category_i18n JSONB NOT NULL,
    unit_i18n JSONB NOT NULL,
    unit_price DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'THB',
    density DECIMAL(6, 3),
    notes_i18n JSONB,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_material_name_i18n CHECK (
        name_i18n ? 'zh' AND name_i18n ? 'th' AND name_i18n ? 'en' AND
        LENGTH(name_i18n->>'zh') > 0 AND
        LENGTH(name_i18n->>'th') > 0 AND
        LENGTH(name_i18n->>'en') > 0
    ),
    CONSTRAINT check_material_unit_i18n CHECK (
        unit_i18n ? 'zh' AND unit_i18n ? 'th' AND unit_i18n ? 'en'
    ),
    CONSTRAINT check_material_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_material_library_code ON material_library(material_code);
CREATE INDEX idx_material_library_sort ON material_library(sort_order);
CREATE INDEX idx_material_library_category ON material_library((category_i18n->>'zh'));

COMMENT ON TABLE material_library IS '材料库 - 50种常用建筑材料';
COMMENT ON COLUMN material_library.material_code IS '材料代码：M001-M050';
COMMENT ON COLUMN material_library.name_i18n IS '材料名称（三语言）：{"zh": "水泥", "th": "ปูนซีเมนต์", "en": "Cement"}';
COMMENT ON COLUMN material_library.category_i18n IS '材料分类（三语言）：{"zh": "水泥砂浆", "th": "...", "en": "Cement & Mortar"}';
COMMENT ON COLUMN material_library.unit_i18n IS '单位（三语言）：{"zh": "吨", "th": "ตัน", "en": "ton"}';
COMMENT ON COLUMN material_library.unit_price IS '单价（泰铢）';
COMMENT ON COLUMN material_library.density IS '密度（吨/立方米），用于体积-重量换算';
```

### 3.2 tool_library（工具库）

```sql
CREATE TABLE tool_library (
    id SERIAL PRIMARY KEY,
    tool_code VARCHAR(10) UNIQUE NOT NULL,
    name_i18n JSONB NOT NULL,
    category_i18n JSONB NOT NULL,
    unit_i18n JSONB NOT NULL,
    daily_rent DECIMAL(8, 2) DEFAULT 0,
    notes_i18n JSONB,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_tool_name_i18n CHECK (
        name_i18n ? 'zh' AND name_i18n ? 'th' AND name_i18n ? 'en' AND
        LENGTH(name_i18n->>'zh') > 0 AND
        LENGTH(name_i18n->>'th') > 0 AND
        LENGTH(name_i18n->>'en') > 0
    ),
    CONSTRAINT check_tool_rent CHECK (daily_rent >= 0)
);

CREATE INDEX idx_tool_library_code ON tool_library(tool_code);
CREATE INDEX idx_tool_library_sort ON tool_library(sort_order);

COMMENT ON TABLE tool_library IS '工具库 - 30种常用建筑工具设备';
COMMENT ON COLUMN tool_library.tool_code IS '工具代码：T001-T030';
COMMENT ON COLUMN tool_library.daily_rent IS '日租金（泰铢）';
```

### 3.3 workers（工人花名册）

```sql
CREATE TABLE workers (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role_i18n JSONB,
    daily_wage DECIMAL(8, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'THB',
    hire_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_worker_status CHECK (status IN ('active', 'inactive', 'resigned')),
    CONSTRAINT check_worker_wage CHECK (daily_wage > 0)
);

CREATE INDEX idx_workers_project ON workers(project_id);
CREATE INDEX idx_workers_user ON workers(user_id);
CREATE INDEX idx_workers_status ON workers(project_id, status);

COMMENT ON TABLE workers IS '工人花名册 - 项目工人管理';
COMMENT ON COLUMN workers.user_id IS '关联users表（如果工人有系统账号）';
COMMENT ON COLUMN workers.daily_wage IS '日工资（泰铢）';
COMMENT ON COLUMN workers.role_i18n IS '工种（三语言）：{"zh": "瓦工", "th": "ช่างก่อ", "en": "Mason"}';
```

### 3.4 daily_attendance（每日签到）

```sql
CREATE TABLE daily_attendance (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    gps_location JSONB,
    status VARCHAR(20) DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_attendance_status CHECK (status IN ('present', 'absent', 'leave', 'half_day')),
    CONSTRAINT unique_worker_date UNIQUE(worker_id, attendance_date)
);

CREATE INDEX idx_attendance_project_date ON daily_attendance(project_id, attendance_date);
CREATE INDEX idx_attendance_worker ON daily_attendance(worker_id);
CREATE INDEX idx_attendance_date ON daily_attendance(attendance_date);
CREATE INDEX idx_attendance_status ON daily_attendance(project_id, status);

COMMENT ON TABLE daily_attendance IS '每日签到记录';
COMMENT ON COLUMN daily_attendance.gps_location IS 'GPS位置：{"lat": 9.5353, "lng": 100.0633}';
COMMENT ON COLUMN daily_attendance.status IS '状态：present(出勤), absent(缺勤), leave(请假), half_day(半天)';
```

### 3.5 cost_summary（成本汇总视图）

```sql
CREATE MATERIALIZED VIEW cost_summary AS
SELECT 
    p.id AS project_id,
    p.project_name,
    'THB' AS currency,
    
    -- 材料计划成本（从已审批的工序计算结果中汇总）
    (SELECT COALESCE(SUM(
        (mat_data->>'quantity')::decimal * ml.unit_price
    ), 0)
    FROM node_records nr
    CROSS JOIN LATERAL jsonb_each(nr.calculated_materials) AS mat(mat_key, mat_data)
    LEFT JOIN material_library ml ON ml.material_code = mat.mat_key
    WHERE nr.project_id = p.id AND nr.status = 'approved'
    ) AS planned_material_cost,
    
    -- 材料实际成本（从材料进场记录汇总）
    (SELECT COALESCE(SUM(mr.quantity * ml.unit_price), 0)
    FROM material_records mr
    LEFT JOIN material_library ml ON ml.material_code = mr.material_code
    WHERE mr.project_id = p.id AND mr.status = 'approved'
    ) AS actual_material_cost,
    
    -- 人工计划成本（从已审批的工序计算结果中汇总）
    (SELECT COALESCE(SUM(
        (nr.calculated_workers->>'count')::decimal * 
        COALESCE((SELECT AVG(daily_wage) FROM workers WHERE project_id = p.id), 500) *
        pn.estimated_days
    ), 0)
    FROM node_records nr
    JOIN process_nodes pn ON pn.id = nr.node_id
    WHERE nr.project_id = p.id AND nr.status = 'approved'
    ) AS planned_labor_cost,
    
    -- 人工实际成本（从考勤记录汇总）
    (SELECT COALESCE(SUM(w.daily_wage), 0)
    FROM daily_attendance da
    JOIN workers w ON w.id = da.worker_id
    WHERE da.project_id = p.id AND da.status = 'present'
    ) AS actual_labor_cost,
    
    NOW() AS refreshed_at
FROM projects p;

CREATE UNIQUE INDEX idx_cost_summary_project ON cost_summary(project_id);

COMMENT ON MATERIALIZED VIEW cost_summary IS '成本汇总 - 定期刷新（每小时）';

-- 刷新函数
CREATE OR REPLACE FUNCTION refresh_cost_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY cost_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_cost_summary IS '刷新成本汇总视图';
```

---

## 4. 触发器

### 4.1 材料偏差自动计算

```sql
CREATE OR REPLACE FUNCTION trigger_calc_variance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.planned_quantity IS NOT NULL AND NEW.planned_quantity > 0 THEN
        NEW.variance_percentage := ROUND(
            ((NEW.quantity - NEW.planned_quantity) / NEW.planned_quantity * 100)::NUMERIC, 
            2
        );
    ELSE
        NEW.variance_percentage := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calc_variance_before_insert
BEFORE INSERT OR UPDATE ON material_records
FOR EACH ROW
EXECUTE FUNCTION trigger_calc_variance();

COMMENT ON FUNCTION trigger_calc_variance IS '自动计算材料偏差百分比';
```

---

## 5. 视图

### 5.1 待确认列表视图

```sql
CREATE OR REPLACE VIEW pending_confirmations AS
-- 工序打卡待确认
SELECT 
    'process' AS type,
    nr.id,
    nr.project_id,
    p.project_name,
    pn.name_i18n,
    u.full_name AS submitter_name,
    nr.submit_time,
    nr.photos_json,
    nr.photo_count,
    nr.status,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - nr.submit_time)) / 3600 AS hours_ago
FROM node_records nr
JOIN projects p ON nr.project_id = p.id
JOIN process_nodes pn ON nr.node_id = pn.id
JOIN users u ON nr.submitter_id = u.id
WHERE nr.status = 'pending'

UNION ALL

-- 材料进场待确认
SELECT 
    'material' AS type,
    mr.id,
    mr.project_id,
    p.project_name,
    jsonb_build_object('zh', mr.material_name, 'th', mr.material_name, 'en', mr.material_name) AS name_i18n,
    u.full_name AS submitter_name,
    mr.submit_time,
    mr.photos_json,
    mr.photo_count,
    mr.status,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - mr.submit_time)) / 3600 AS hours_ago
FROM material_records mr
JOIN projects p ON mr.project_id = p.id
JOIN users u ON mr.submitter_id = u.id
WHERE mr.status = 'pending'

ORDER BY submit_time DESC;

COMMENT ON VIEW pending_confirmations IS '待确认列表视图 - 汇总工序打卡和材料进场的待确认记录';
```

### 5.2 项目进度视图

```sql
CREATE OR REPLACE VIEW project_progress AS
SELECT 
    p.id AS project_id,
    p.project_name,
    pn.id AS node_id,
    pn.node_code,
    pn.name_i18n,
    pn.sort_order,
    pn.prev_node_id,
    pn.estimated_days,
    COALESCE(nr.status, 'locked') AS node_status,
    nr.id AS record_id,
    nr.base_data,
    nr.calculated_workers,
    nr.calculated_materials,
    nr.calculated_tools,
    nr.submitter_id,
    u.full_name AS submitter_name,
    nr.submit_time,
    nr.confirmed_at,
    nr.photo_count
FROM projects p
CROSS JOIN process_nodes pn
LEFT JOIN node_records nr ON p.id = nr.project_id AND pn.id = nr.node_id
LEFT JOIN users u ON nr.submitter_id = u.id
ORDER BY p.id, pn.sort_order;

COMMENT ON VIEW project_progress IS '项目进度视图 - 展示所有工序的当前状态';
```

---

## 6. 数据迁移脚本

### 6.1 备份现有数据

```sql
-- 备份表
CREATE TABLE process_nodes_backup_20240115 AS SELECT * FROM process_nodes;
CREATE TABLE node_records_backup_20240115 AS SELECT * FROM node_records;
CREATE TABLE material_records_backup_20240115 AS SELECT * FROM material_records;
```

### 6.2 执行扩展（按顺序）

```sql
-- 1. 扩展process_nodes表
ALTER TABLE process_nodes ADD COLUMN IF NOT EXISTS name_i18n JSONB;
-- ... 其他字段

-- 2. 更新现有16个工序数据（需手动填充name_i18n等字段）
UPDATE process_nodes SET name_i18n = jsonb_build_object(
  'zh', node_name,
  'th', node_name,
  'en', node_name
) WHERE name_i18n IS NULL;

-- 3. 插入新增的15个工序（P017-P031）
INSERT INTO process_nodes (...) VALUES (...);

-- 4. 扩展node_records表
ALTER TABLE node_records ADD COLUMN IF NOT EXISTS base_data JSONB DEFAULT '{}';
-- ... 其他字段

-- 5. 扩展material_records表
ALTER TABLE material_records ADD COLUMN IF NOT EXISTS material_code VARCHAR(10);

-- 6. 创建新表
CREATE TABLE material_library (...);
CREATE TABLE tool_library (...);
CREATE TABLE workers (...);
CREATE TABLE daily_attendance (...);

-- 7. 创建物化视图
CREATE MATERIALIZED VIEW cost_summary AS SELECT ...;

-- 8. 创建触发器和视图
CREATE TRIGGER calc_variance_before_insert ...;
CREATE OR REPLACE VIEW pending_confirmations AS ...;
CREATE OR REPLACE VIEW project_progress AS ...;
```

### 6.3 数据完整性检查

```sql
-- 检查工序数量
SELECT COUNT(*) FROM process_nodes;  -- 应该 = 31

-- 检查工序名称三语言完整性
SELECT node_code, name_i18n 
FROM process_nodes 
WHERE NOT (name_i18n ? 'zh' AND name_i18n ? 'th' AND name_i18n ? 'en');
-- 应该返回0行

-- 检查工序链完整性（除首个外都有prev_node_id）
SELECT node_code, prev_node_id 
FROM process_nodes 
WHERE sort_order > 1 AND prev_node_id IS NULL;
-- 应该返回0行

-- 检查材料库数量
SELECT COUNT(*) FROM material_library;  -- 应该 = 50

-- 检查工具库数量
SELECT COUNT(*) FROM tool_library;  -- 应该 = 30
```

---

## 7. 索引优化

```sql
-- process_nodes索引
CREATE INDEX IF NOT EXISTS idx_process_nodes_code ON process_nodes(node_code);
CREATE INDEX IF NOT EXISTS idx_process_nodes_prev ON process_nodes(prev_node_id);
CREATE INDEX IF NOT EXISTS idx_process_nodes_sort ON process_nodes(sort_order);

-- node_records索引
CREATE INDEX IF NOT EXISTS idx_node_records_project ON node_records(project_id);
CREATE INDEX IF NOT EXISTS idx_node_records_node ON node_records(node_id);
CREATE INDEX IF NOT EXISTS idx_node_records_status ON node_records(status);
CREATE INDEX IF NOT EXISTS idx_node_records_project_status ON node_records(project_id, status);
CREATE INDEX IF NOT EXISTS idx_node_records_submitter ON node_records(submitter_id);

-- material_records索引
CREATE INDEX IF NOT EXISTS idx_material_records_project ON material_records(project_id);
CREATE INDEX IF NOT EXISTS idx_material_records_code ON material_records(material_code);
CREATE INDEX IF NOT EXISTS idx_material_records_status ON material_records(status);
CREATE INDEX IF NOT EXISTS idx_material_records_project_status ON material_records(project_id, status);

-- workers索引
CREATE INDEX IF NOT EXISTS idx_workers_project_status ON workers(project_id, status);

-- daily_attendance索引
CREATE INDEX IF NOT EXISTS idx_attendance_project_date ON daily_attendance(project_id, attendance_date);
```

---

## 8. 完整SQL脚本

完整可执行的SQL脚本位于：
- `e:\3XBANG\.worktrees\construction-v2\docs\v2-database-schema.sql`

执行顺序：
```bash
# 1. 连接数据库
psql -U postgres -d construction_simple

# 2. 执行备份
\i backup.sql

# 3. 执行迁移脚本
\i v2-database-schema.sql

# 4. 验证数据完整性
\i verify.sql

# 5. 导入基础数据（31个工序、50种材料、30种工具）
\i import_base_data.sql
```

---

**文档结束**
