-- 添加每日进度跟踪表

CREATE TABLE IF NOT EXISTS daily_progress (
    id SERIAL PRIMARY KEY,
    process_execution_id INTEGER REFERENCES process_execution(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- 进度信息
    quantity_completed DECIMAL(10,2),  -- 今日完成量
    unit VARCHAR(20),  -- 单位（平米/米/个/吨）
    
    -- 累计进度
    total_completed DECIMAL(10,2),  -- 截止今日累计完成
    total_planned DECIMAL(10,2),  -- 计划总量
    completion_percentage DECIMAL(5,2),  -- 完成百分比
    
    -- 状态
    work_status VARCHAR(30),  -- normal/waiting_material/weather_stop/problem
    notes JSONB,  -- 备注（中泰双语）
    
    -- 照片
    photos JSONB,  -- 现场照片数组
    
    -- 材料消耗（可选）
    material_used JSONB,  -- {"cement": 2.5, "sand": 5}
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- 更新 process_execution 表，添加计划总量字段
ALTER TABLE process_execution 
ADD COLUMN IF NOT EXISTS planned_quantity DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS quantity_unit VARCHAR(20),
ADD COLUMN IF NOT EXISTS total_completed DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_percentage DECIMAL(5,2) DEFAULT 0;

-- 更新 projects 表，添加工人信息
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS total_workers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worker_skills JSONB;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_daily_progress_date ON daily_progress(date);
CREATE INDEX IF NOT EXISTS idx_daily_progress_process ON daily_progress(process_execution_id);
CREATE INDEX IF NOT EXISTS idx_daily_progress_status ON daily_progress(work_status);

-- 插入示例数据注释
COMMENT ON TABLE daily_progress IS '每日工作进度记录表';
COMMENT ON COLUMN daily_progress.quantity_completed IS '今日完成数量';
COMMENT ON COLUMN daily_progress.total_completed IS '累计完成数量';
COMMENT ON COLUMN daily_progress.work_status IS '工作状态：normal正常/waiting_material等材料/weather_stop天气停工/problem其他问题';
COMMENT ON COLUMN process_execution.planned_quantity IS '工序计划总量';
COMMENT ON COLUMN process_execution.quantity_unit IS '数量单位';
COMMENT ON COLUMN projects.worker_skills IS '工人技能分布 JSON格式';
