-- ============================================================
-- 工序测量数据模块（MySQL版本）
-- 版本: 1.0
-- 功能: 为16个工序添加详细测量数据，支持材料计算、工时估算
-- ============================================================

-- ============================================================
-- 1. 工序执行记录表（已存在，需确认）
-- ============================================================
CREATE TABLE IF NOT EXISTS process_execution (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    process_node_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    planned_start_date DATE,
    actual_start_date DATE,
    planned_end_date DATE,
    actual_end_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (process_node_id) REFERENCES process_nodes(id),
    INDEX idx_process_execution_project (project_id),
    INDEX idx_process_execution_node (process_node_id),
    INDEX idx_process_execution_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目工序执行记录';

-- ============================================================
-- 2. 工序测量数据表（核心新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS process_measurements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    process_execution_id INT NOT NULL,
    
    -- 通用测量字段
    length DECIMAL(10, 2),              -- 长度(米)
    width DECIMAL(10, 2),               -- 宽度(米)
    height DECIMAL(10, 2),              -- 高度/深度/厚度(米)
    area DECIMAL(10, 2),                -- 面积(平方米)
    volume DECIMAL(10, 3),              -- 体积(立方米)
    quantity INT,                       -- 数量
    
    -- 扩展字段（JSON存储特殊测量）
    extra_data JSON,                    -- 如：门窗洞口、涂刷层数、坡度系数等
    
    -- 计算结果
    calculated_material_cost DECIMAL(12, 2),  -- 计算出的材料成本
    calculated_labor_days DECIMAL(8, 2),      -- 计算出的工日数
    calculated_workers_needed INT,            -- 建议工人数
    
    -- 元数据
    measured_by INT,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (process_execution_id) REFERENCES process_execution(id) ON DELETE CASCADE,
    FOREIGN KEY (measured_by) REFERENCES users(user_id),
    INDEX idx_measurements_execution (process_execution_id),
    INDEX idx_measurements_measured_by (measured_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序测量数据表';

-- ============================================================
-- 3. 工序材料计算结果表
-- ============================================================
CREATE TABLE IF NOT EXISTS process_material_calculations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    process_measurement_id INT NOT NULL,
    material_id INT,
    material_code VARCHAR(50),
    material_name VARCHAR(100) NOT NULL,
    
    -- 计算数据
    calculated_quantity DECIMAL(10, 3) NOT NULL,  -- 计算出的数量
    unit VARCHAR(20) NOT NULL,                     -- 单位
    unit_price DECIMAL(10, 2),                     -- 单价
    total_cost DECIMAL(12, 2),                     -- 小计
    loss_rate DECIMAL(5, 3) DEFAULT 0.05,         -- 损耗率
    actual_quantity DECIMAL(10, 3),                -- 实际用量（含损耗）
    
    -- 计算公式记录（便于追溯）
    calculation_formula TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (process_measurement_id) REFERENCES process_measurements(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES material_library(id),
    INDEX idx_material_calc_measurement (process_measurement_id),
    INDEX idx_material_calc_material (material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序材料用量计算结果';

-- ============================================================
-- 4. 工序工人安排表
-- ============================================================
CREATE TABLE IF NOT EXISTS process_worker_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    process_execution_id INT NOT NULL,
    worker_id INT NOT NULL,
    
    assigned_date DATE NOT NULL,
    role VARCHAR(50),                    -- 工种角色
    planned_hours DECIMAL(5, 2),         -- 计划工时
    actual_hours DECIMAL(5, 2),          -- 实际工时
    status VARCHAR(20) DEFAULT 'assigned', -- assigned/completed/absent
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (process_execution_id) REFERENCES process_execution(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE CASCADE,
    INDEX idx_worker_assign_execution (process_execution_id),
    INDEX idx_worker_assign_worker (worker_id),
    INDEX idx_worker_assign_date (assigned_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序工人分配表';

-- ============================================================
-- 5. 工序工具需求表
-- ============================================================
CREATE TABLE IF NOT EXISTS process_tool_requirements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    process_node_id INT NOT NULL,
    tool_code VARCHAR(50) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    quantity INT DEFAULT 1,
    is_required BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (process_node_id) REFERENCES process_nodes(id),
    INDEX idx_tool_req_node (process_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序标准工具需求（全局模板）';

-- ============================================================
-- 6. 插入5个重点工序的工具需求数据
-- ============================================================
INSERT INTO process_tool_requirements (process_node_id, tool_code, tool_name, quantity, is_required) VALUES
-- N01_EXCAVATION 土方开挖
((SELECT id FROM process_nodes WHERE node_code = 'N01_EXCAVATION'), 'T001', '挖掘机', 1, true),
((SELECT id FROM process_nodes WHERE node_code = 'N01_EXCAVATION'), 'T002', '手推车', 5, true),
((SELECT id FROM process_nodes WHERE node_code = 'N01_EXCAVATION'), 'T025', '铁锹', 10, true),

-- N02_FOUNDATION 基础施工
((SELECT id FROM process_nodes WHERE node_code = 'N02_FOUNDATION'), 'T003', '混凝土搅拌机', 1, true),
((SELECT id FROM process_nodes WHERE node_code = 'N02_FOUNDATION'), 'T004', '振动棒', 2, true),
((SELECT id FROM process_nodes WHERE node_code = 'N02_FOUNDATION'), 'T005', '钢筋切断机', 1, true),
((SELECT id FROM process_nodes WHERE node_code = 'N02_FOUNDATION'), 'T026', '绑扎钳', 8, true),

-- N08_WALL_PARTITION 砌墙
((SELECT id FROM process_nodes WHERE node_code = 'N08_WALL_PARTITION'), 'T013', '砌砖刀', 5, true),
((SELECT id FROM process_nodes WHERE node_code = 'N08_WALL_PARTITION'), 'T027', '水平仪', 2, true),
((SELECT id FROM process_nodes WHERE node_code = 'N08_WALL_PARTITION'), 'T028', '灰桶', 10, true),

-- N07_WATERPROOF 防水
((SELECT id FROM process_nodes WHERE node_code = 'N07_WATERPROOF'), 'T012', '防水涂刷工具', 3, true),
((SELECT id FROM process_nodes WHERE node_code = 'N07_WATERPROOF'), 'T029', '滚筒', 5, true),

-- N10_TILING 瓷砖铺贴
((SELECT id FROM process_nodes WHERE node_code = 'N10_TILING'), 'T015', '瓷砖切割机', 1, true),
((SELECT id FROM process_nodes WHERE node_code = 'N10_TILING'), 'T030', '橡胶锤', 8, true),
((SELECT id FROM process_nodes WHERE node_code = 'N10_TILING'), 'T031', '抹刀', 10, true);

-- ============================================================
-- 完成！
-- ============================================================
