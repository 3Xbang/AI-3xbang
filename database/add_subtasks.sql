-- 添加工序子任务表

CREATE TABLE IF NOT EXISTS process_subtasks (
    id SERIAL PRIMARY KEY,
    process_execution_id INTEGER REFERENCES process_execution(id) ON DELETE CASCADE,
    
    -- 子任务基本信息
    subtask_name JSONB NOT NULL,  -- {"zh": "1楼墙面", "th": "ชั้น1"}
    description JSONB,  -- 详细说明
    sequence_number INTEGER DEFAULT 0,  -- 排序
    
    -- 计划信息
    planned_quantity DECIMAL(10,2),  -- 计划数量
    quantity_unit VARCHAR(20),  -- 单位
    
    -- 进度信息
    total_completed DECIMAL(10,2) DEFAULT 0,  -- 累计完成
    completion_percentage DECIMAL(5,2) DEFAULT 0,  -- 完成百分比
    
    -- 状态
    status VARCHAR(30) DEFAULT 'not_started',  -- not_started/in_progress/waiting_material/weather_stop/completed
    
    -- 人员分配
    assigned_workers JSONB,  -- 分配的工人
    
    -- 时间
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_subtasks_process ON process_subtasks(process_execution_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_status ON process_subtasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_sequence ON process_subtasks(sequence_number);

-- 添加注释
COMMENT ON TABLE process_subtasks IS '工序子任务表 - 大工序的细分小项';
COMMENT ON COLUMN process_subtasks.subtask_name IS '子任务名称（中泰双语）';
COMMENT ON COLUMN process_subtasks.sequence_number IS '排序序号，用于显示顺序';
COMMENT ON COLUMN process_subtasks.status IS '子任务状态';

-- 更新每日进度表，关联子任务
ALTER TABLE daily_progress 
ADD COLUMN IF NOT EXISTS subtask_id INTEGER REFERENCES process_subtasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN daily_progress.subtask_id IS '关联的子任务ID（可选，如果按子任务更新进度）';

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_subtask_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_subtask_timestamp ON process_subtasks;
CREATE TRIGGER trigger_update_subtask_timestamp
    BEFORE UPDATE ON process_subtasks
    FOR EACH ROW
    EXECUTE FUNCTION update_subtask_timestamp();
