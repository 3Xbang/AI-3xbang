-- ============================================================
-- 极简工程项目管理系统 - PostgreSQL 数据库设计
-- 核心理念：反形式主义，只管控关键节点
-- 版本: 1.0
-- 设计原则：
--   1. 极简表结构（5张核心表）
--   2. 照片为中心（JSONB数组存储）
--   3. 状态机卡点（前置节点锁定逻辑）
--   4. 零填表负担（拍照即交付）
-- ============================================================

-- ============================================================
-- 1. 项目表 (极简)
-- ============================================================

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    start_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE projects IS '项目表 - 只存核心信息';
COMMENT ON COLUMN projects.status IS '项目状态: active(进行中), paused(暂停), completed(已完工)';

-- 插入示例项目
INSERT INTO projects (project_name, location, start_date) VALUES
('苏梅岛别墅A栋', '泰国苏梅岛', '2024-01-01');

-- ============================================================
-- 2. 用户表 (极简，只分老板和工人)
-- ============================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS '用户表 - 只分两类角色';
COMMENT ON COLUMN users.role IS '角色: boss(老板/管理员), worker(现场工人)';

-- 插入示例用户（密码: Admin@123 和 Worker@123）
INSERT INTO users (username, password_hash, full_name, role, phone) VALUES
('boss', '$2b$10$rKYQP5Y3Zu6nQXvZxK5qS.vPjE8fFqX9nZnTVU0wLg2oc5KxLQDdq', '老板', 'boss', '+66-123-456-789'),
('zhangsan', '$2b$10$X8vJ9nZxK2wQ5yP3mR4tL.vHjE8fFqX9nZnTVU0wLg2oc5KxLQAbc', '张三', 'worker', '+66-987-654-321'),
('lisi', '$2b$10$Y9wK0oAyL3xR6zQ4nS5uM.wIkF9gGrY0oAoUVX1xMh3pd6LyMRBcd', '李四', 'worker', '+66-987-654-322');

CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- 3. 标准工序节点模板表
-- ============================================================

CREATE TABLE process_nodes (
    id SERIAL PRIMARY KEY,
    node_name VARCHAR(100) NOT NULL,
    node_code VARCHAR(50) UNIQUE NOT NULL,
    prev_node_id INTEGER REFERENCES process_nodes(id),
    sort_order INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE process_nodes IS '标准工序节点模板 - 定义工序流转顺序';
COMMENT ON COLUMN process_nodes.prev_node_id IS '前置节点ID - 实现工序卡点逻辑（NULL表示首个节点）';
COMMENT ON COLUMN process_nodes.sort_order IS '排序序号，用于时间轴展示';

-- 插入标准工序节点（泰国别墅典型流程）
INSERT INTO process_nodes (node_name, node_code, prev_node_id, sort_order, description) VALUES
-- 第一阶段：地基工程
('地基开挖', 'N01_EXCAVATION', NULL, 1, '场地平整、基坑开挖，需拍摄开挖深度、边坡、土质照片'),
('地基浇筑', 'N02_FOUNDATION', 1, 2, '混凝土基础浇筑，需拍摄钢筋绑扎、混凝土浇筑、养护照片'),

-- 第二阶段：主体结构
('主体框架', 'N03_STRUCTURE', 2, 3, '柱梁板施工，需拍摄模板、钢筋、混凝土照片'),
('屋面封顶', 'N04_ROOF_FRAME', 3, 4, '屋顶结构完成，需拍摄屋架、封板照片'),

-- 第三阶段：水电安装
('水电布管', 'N05_MEP_ROUGH', 4, 5, '水电管线预埋，需拍摄布管路径、开槽、穿线照片'),
('水电隐蔽工程', 'N06_MEP_HIDDEN', 5, 6, '⭐ 关键节点：管线隐蔽前验收，需拍摄管线走向、接头、测试照片'),

-- 第四阶段：防水与砌墙
('防水工程', 'N07_WATERPROOF', 6, 7, '⭐ 关键节点：卫生间、屋面防水，需拍摄防水涂刷、闭水试验照片'),
('砌墙隔断', 'N08_WALL_PARTITION', 7, 8, '内墙砌筑，需拍摄砌体、门窗洞口照片'),

-- 第五阶段：装修装饰
('泥瓦抹灰', 'N09_PLASTERING', 8, 9, '墙面地面抹灰找平，需拍摄抹灰厚度、平整度照片'),
('瓷砖铺贴', 'N10_TILING', 9, 10, '地面墙面贴砖，需拍摄铺贴效果、勾缝照片'),
('木工吊顶', 'N11_CEILING', 10, 11, '吊顶龙骨、石膏板安装，需拍摄龙骨、封板照片'),
('油漆涂刷', 'N12_PAINTING', 11, 12, '墙面乳胶漆、木器漆，需拍摄底漆、面漆效果照片'),

-- 第六阶段：安装收尾
('门窗安装', 'N13_DOOR_WINDOW', 12, 13, '成品门窗、玻璃安装，需拍摄安装效果、密封照片'),
('洁具安装', 'N14_SANITARY', 13, 14, '马桶、洗手盆、花洒安装，需拍摄安装效果、测试照片'),
('灯具开关', 'N15_LIGHTING', 14, 15, '灯具、开关插座安装，需拍摄安装效果、通电测试照片'),
('清洁验收', 'N16_CLEANING', 15, 16, '最终清洁、整体验收，需拍摄各房间全景照片');

CREATE INDEX idx_process_nodes_prev ON process_nodes(prev_node_id);
CREATE INDEX idx_process_nodes_sort ON process_nodes(sort_order);

-- ============================================================
-- 4. 节点打卡记录表（核心表）
-- ============================================================

CREATE TABLE node_records (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES process_nodes(id),
    
    -- 提交信息
    submitter_id INTEGER NOT NULL REFERENCES users(id),
    submit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 照片存储（JSONB数组，核心字段）
    photos_json JSONB NOT NULL,
    photo_count INTEGER NOT NULL CHECK (photo_count >= 3),
    
    -- 水印元数据
    watermark_info JSONB DEFAULT '{}',
    
    -- 状态与确认
    status VARCHAR(20) DEFAULT 'pending',
    confirmed_by INTEGER REFERENCES users(id),
    confirmed_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- 工作说明（可选，简短描述）
    work_description TEXT,
    
    -- 备注（可选）
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE node_records IS '节点打卡记录表 - 工序交接的核心凭证';
COMMENT ON COLUMN node_records.photos_json IS 'JSON数组，至少3张照片: [{"url": "/uploads/...", "type": "panorama"}, ...]';
COMMENT ON COLUMN node_records.photo_count IS '照片数量，前端和后端都要校验 >= 3';
COMMENT ON COLUMN node_records.watermark_info IS 'JSON对象: {"gps": {"lat": 9.5, "lng": 100.0}, "timestamp": "2024-01-15 16:30", "project": "项目A", "operator": "张三"}';
COMMENT ON COLUMN node_records.status IS '状态: pending(待确认), approved(已确认), rejected(已驳回)';
COMMENT ON COLUMN node_records.work_description IS '工作说明（可选）：简短描述本次施工内容，如"主卧卫生间水管安装完成"';
COMMENT ON COLUMN node_records.rejection_reason IS '驳回原因，老板点击【驳回】时填写';

CREATE INDEX idx_node_records_project ON node_records(project_id);
CREATE INDEX idx_node_records_node ON node_records(node_id);
CREATE INDEX idx_node_records_status ON node_records(status);
CREATE INDEX idx_node_records_submitter ON node_records(submitter_id);
CREATE INDEX idx_node_records_confirmed_at ON node_records(confirmed_at);

-- ============================================================
-- 5. 材料进场记录表
-- ============================================================

CREATE TABLE material_records (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 材料信息
    material_name VARCHAR(100) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    planned_quantity DECIMAL(10, 2),
    variance_percentage DECIMAL(5, 2),
    
    -- 提交信息
    submitter_id INTEGER NOT NULL REFERENCES users(id),
    submit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 照片存储（JSONB数组，核心字段）
    photos_json JSONB NOT NULL,
    photo_count INTEGER NOT NULL CHECK (photo_count >= 3),
    
    -- 水印元数据
    watermark_info JSONB DEFAULT '{}',
    
    -- 状态与确认
    status VARCHAR(20) DEFAULT 'pending',
    confirmed_by INTEGER REFERENCES users(id),
    confirmed_at TIMESTAMP,
    rejection_reason TEXT,
    
    -- 供应商信息（可选）
    supplier_name VARCHAR(200),
    delivery_person VARCHAR(100),
    
    -- 备注说明（可选）
    notes TEXT,
    quality_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE material_records IS '材料进场记录表 - 材料数量与质量的核心凭证';
COMMENT ON COLUMN material_records.quantity IS '实际到货数量';
COMMENT ON COLUMN material_records.planned_quantity IS '计划采购数量（可选，用于偏差对比）';
COMMENT ON COLUMN material_records.variance_percentage IS '偏差百分比: (实际-计划)/计划 * 100，自动计算';
COMMENT ON COLUMN material_records.photos_json IS 'JSON数组，至少3张: [{"url": "/uploads/...", "type": "delivery_note"}, {"type": "material_closeup"}, {"type": "storage"}]';
COMMENT ON COLUMN material_records.quality_notes IS '质量说明（可选）：如"水泥袋完好无破损，生产日期2024-01"';
COMMENT ON COLUMN material_records.status IS '状态: pending(待确认), approved(已确认), rejected(已驳回)';

CREATE INDEX idx_material_records_project ON material_records(project_id);
CREATE INDEX idx_material_records_status ON material_records(status);
CREATE INDEX idx_material_records_material ON material_records(material_name);
CREATE INDEX idx_material_records_submitter ON material_records(submitter_id);

-- ============================================================
-- 6. 异常上报表
-- ============================================================

CREATE TABLE issue_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 上报信息
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    report_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 异常描述
    issue_title VARCHAR(200) NOT NULL,
    issue_description TEXT NOT NULL,
    
    -- 照片与语音（可选）
    photos_json JSONB DEFAULT '[]',
    voice_text TEXT,
    
    -- 水印元数据
    watermark_info JSONB DEFAULT '{}',
    
    -- 状态与回复
    status VARCHAR(20) DEFAULT 'pending',
    boss_reply TEXT,
    replied_by INTEGER REFERENCES users(id),
    replied_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE issue_reports IS '异常上报表 - 现场问题的快速通道';
COMMENT ON COLUMN issue_reports.issue_title IS '异常标题，如：钢筋数量不足、图纸尺寸有误';
COMMENT ON COLUMN issue_reports.voice_text IS '语音转文字内容（前端调用语音识别API）';
COMMENT ON COLUMN issue_reports.photos_json IS 'JSON数组，可选照片: [{"url": "/uploads/...", "desc": "缺料现场"}]';
COMMENT ON COLUMN issue_reports.status IS '状态: pending(待处理), replied(已回复), resolved(已解决)';

CREATE INDEX idx_issue_reports_project ON issue_reports(project_id);
CREATE INDEX idx_issue_reports_status ON issue_reports(status);
CREATE INDEX idx_issue_reports_reporter ON issue_reports(reporter_id);
CREATE INDEX idx_issue_reports_report_time ON issue_reports(report_time);

-- ============================================================
-- 7. 触发器：自动计算材料偏差百分比
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_variance_percentage()
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

CREATE TRIGGER trigger_calculate_variance
BEFORE INSERT OR UPDATE ON material_records
FOR EACH ROW
EXECUTE FUNCTION calculate_variance_percentage();

COMMENT ON FUNCTION calculate_variance_percentage IS '自动计算材料偏差百分比';

-- ============================================================
-- 8. 视图：待确认列表（老板最常用）
-- ============================================================

CREATE OR REPLACE VIEW pending_confirmations AS
SELECT 
    'node' AS type,
    nr.id,
    nr.project_id,
    p.project_name,
    pn.node_name AS title,
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

SELECT 
    'material' AS type,
    mr.id,
    mr.project_id,
    p.project_name,
    CONCAT(mr.material_name, ' ', mr.quantity, mr.unit) AS title,
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

COMMENT ON VIEW pending_confirmations IS '待确认列表视图 - 汇总节点打卡和材料进场的待确认记录';

-- ============================================================
-- 9. 视图：项目进度时间轴
-- ============================================================

CREATE OR REPLACE VIEW project_timeline AS
SELECT 
    p.id AS project_id,
    p.project_name,
    pn.id AS node_id,
    pn.node_name,
    pn.node_code,
    pn.sort_order,
    pn.prev_node_id,
    COALESCE(nr.status, 'locked') AS node_status,
    nr.id AS record_id,
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

COMMENT ON VIEW project_timeline IS '项目进度时间轴视图 - 展示所有节点的当前状态';

-- ============================================================
-- 10. 函数：检查节点是否可提交（前置节点校验）
-- ============================================================

CREATE OR REPLACE FUNCTION check_node_submittable(
    p_project_id INTEGER,
    p_node_id INTEGER
) RETURNS TABLE(
    can_submit BOOLEAN,
    reason TEXT,
    prev_node_name VARCHAR(100),
    prev_node_status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH node_info AS (
        SELECT 
            pn.node_name,
            pn.prev_node_id
        FROM process_nodes pn
        WHERE pn.id = p_node_id
    ),
    prev_record AS (
        SELECT 
            nr.status,
            pn.node_name AS prev_name
        FROM node_info ni
        LEFT JOIN process_nodes pn ON ni.prev_node_id = pn.id
        LEFT JOIN node_records nr ON nr.project_id = p_project_id 
            AND nr.node_id = ni.prev_node_id
            AND nr.status = 'approved'
    )
    SELECT 
        CASE 
            WHEN (SELECT prev_node_id FROM node_info) IS NULL THEN TRUE  -- 首个节点，无前置
            WHEN (SELECT status FROM prev_record) = 'approved' THEN TRUE  -- 前置节点已确认
            ELSE FALSE  -- 前置节点未确认
        END AS can_submit,
        CASE 
            WHEN (SELECT prev_node_id FROM node_info) IS NULL THEN '首个节点，可以提交'
            WHEN (SELECT status FROM prev_record) = 'approved' THEN '前置节点已确认，可以提交'
            ELSE '前置节点未确认，无法提交'
        END AS reason,
        (SELECT prev_name FROM prev_record) AS prev_node_name,
        (SELECT status FROM prev_record) AS prev_node_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_node_submittable IS '检查节点是否可提交 - 验证前置节点是否已确认';

-- 示例调用：
-- SELECT * FROM check_node_submittable(1, 6);  -- 检查项目1的节点6（水电隐蔽工程）是否可提交

-- ============================================================
-- 11. 示例数据：模拟一些打卡记录
-- ============================================================

-- 项目1的"地基开挖"节点已提交并确认
INSERT INTO node_records (project_id, node_id, submitter_id, photos_json, photo_count, watermark_info, status, confirmed_by, confirmed_at) VALUES
(1, 1, 2, '[
    {"url": "/uploads/2024-01-01/excavation_panorama.jpg", "type": "panorama"},
    {"url": "/uploads/2024-01-01/excavation_depth.jpg", "type": "detail"},
    {"url": "/uploads/2024-01-01/excavation_soil.jpg", "type": "detail"}
]'::JSONB, 3, '{
    "gps": {"lat": 9.5353, "lng": 100.0633},
    "timestamp": "2024-01-01 08:30:00",
    "project": "苏梅岛别墅A栋",
    "operator": "张三"
}'::JSONB, 'approved', 1, '2024-01-01 10:00:00');

-- 项目1的"地基浇筑"节点已提交并确认
INSERT INTO node_records (project_id, node_id, submitter_id, photos_json, photo_count, watermark_info, status, confirmed_by, confirmed_at) VALUES
(1, 2, 2, '[
    {"url": "/uploads/2024-01-05/foundation_rebar.jpg", "type": "rebar"},
    {"url": "/uploads/2024-01-05/foundation_concrete.jpg", "type": "concrete"},
    {"url": "/uploads/2024-01-05/foundation_curing.jpg", "type": "curing"}
]'::JSONB, 3, '{
    "gps": {"lat": 9.5353, "lng": 100.0633},
    "timestamp": "2024-01-05 14:20:00",
    "project": "苏梅岛别墅A栋",
    "operator": "张三"
}'::JSONB, 'approved', 1, '2024-01-05 16:00:00');

-- 项目1的"主体框架"节点已提交，待老板确认（带工作说明）
INSERT INTO node_records (project_id, node_id, submitter_id, photos_json, photo_count, watermark_info, work_description, status) VALUES
(1, 3, 3, '[
    {"url": "/uploads/2024-01-10/structure_column.jpg", "type": "column"},
    {"url": "/uploads/2024-01-10/structure_beam.jpg", "type": "beam"},
    {"url": "/uploads/2024-01-10/structure_slab.jpg", "type": "slab"}
]'::JSONB, 3, '{
    "gps": {"lat": 9.5353, "lng": 100.0633},
    "timestamp": "2024-01-10 16:45:00",
    "project": "苏梅岛别墅A栋",
    "operator": "李四"
}'::JSONB, '一层柱梁板全部完成，混凝土已养护3天', 'pending');

-- 项目1的材料进场记录：水泥50吨（计划45吨，偏差+11%，带质量说明）
INSERT INTO material_records (project_id, material_name, quantity, unit, planned_quantity, submitter_id, photos_json, photo_count, watermark_info, supplier_name, delivery_person, quality_notes, status) VALUES
(1, '水泥', 50.00, '吨', 45.00, 2, '[
    {"url": "/uploads/2024-01-02/cement_delivery_note.jpg", "type": "delivery_note"},
    {"url": "/uploads/2024-01-02/cement_closeup.jpg", "type": "material_closeup"},
    {"url": "/uploads/2024-01-02/cement_storage.jpg", "type": "storage"}
]'::JSONB, 3, '{
    "gps": {"lat": 9.5353, "lng": 100.0633},
    "timestamp": "2024-01-02 09:15:00",
    "project": "苏梅岛别墅A栋",
    "operator": "张三"
}'::JSONB, '苏梅建材公司', '送货司机：阿明', '水泥袋完好无破损，生产日期2024-01-05，厂家：泰国水泥公司', 'pending');

-- 异常上报：钢筋数量不足
INSERT INTO issue_reports (project_id, reporter_id, issue_title, issue_description, photos_json, watermark_info, status) VALUES
(1, 3, '钢筋数量不足', '今天需要用12mm钢筋300kg，但仓库只剩150kg，急需补货', '[
    {"url": "/uploads/2024-01-11/rebar_shortage.jpg", "desc": "仓库现有钢筋"}
]'::JSONB, '{
    "gps": {"lat": 9.5353, "lng": 100.0633},
    "timestamp": "2024-01-11 10:30:00",
    "project": "苏梅岛别墅A栋",
    "operator": "李四"
}'::JSONB, 'pending');

-- ============================================================
-- 12. 查询示例
-- ============================================================

-- 查询待确认列表（老板最常用）
-- SELECT * FROM pending_confirmations;

-- 查询项目进度时间轴
-- SELECT * FROM project_timeline WHERE project_id = 1;

-- 检查"水电隐蔽工程"节点是否可提交
-- SELECT * FROM check_node_submittable(1, 6);

-- 查询所有标红的材料记录（偏差>10%）
-- SELECT * FROM material_records 
-- WHERE ABS(variance_percentage) > 10 
-- ORDER BY submit_time DESC;

-- 查询某个节点的所有打卡记录（包含历史）
-- SELECT 
--     nr.*,
--     pn.node_name,
--     u.full_name AS submitter_name,
--     uc.full_name AS confirmer_name
-- FROM node_records nr
-- JOIN process_nodes pn ON nr.node_id = pn.id
-- JOIN users u ON nr.submitter_id = u.id
-- LEFT JOIN users uc ON nr.confirmed_by = uc.id
-- WHERE nr.project_id = 1 AND nr.node_id = 3
-- ORDER BY nr.submit_time DESC;

-- ============================================================
-- 完成！数据库设计说明：
-- 
-- 1. 核心设计思路：
--    - 照片为王：JSONB数组存储多张照片URL
--    - 状态机卡点：prev_node_id 实现工序流转控制
--    - 极简操作：最少3张照片即可提交
--
-- 2. 关键功能：
--    - check_node_submittable() 函数：检查前置节点是否已确认
--    - pending_confirmations 视图：汇总待确认列表
--    - project_timeline 视图：展示项目进度
--
-- 3. 性能优化：
--    - 为常用查询字段添加索引（project_id, status, submit_time）
--    - 使用视图简化前端查询
--    - JSONB 字段存储非结构化照片数据
--
-- 4. 扩展性：
--    - 可轻松添加更多工序节点（只需插入 process_nodes）
--    - 可添加更多材料类型（material_name 不限制枚举）
--    - 可扩展水印信息（watermark_info JSONB 灵活存储）
-- ============================================================
