-- Phase 3B: 工序依赖关系和进度规划
-- Process Dependencies and Schedule Planning

-- 1. 工序依赖关系表
CREATE TABLE IF NOT EXISTS process_dependencies (
    id SERIAL PRIMARY KEY,
    process_execution_id INTEGER NOT NULL REFERENCES process_execution(id) ON DELETE CASCADE,
    depends_on_process_id INTEGER NOT NULL REFERENCES process_execution(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start',
    -- finish_to_start (FS): 前置工序完成后才能开始
    -- start_to_start (SS): 前置工序开始后才能开始
    -- finish_to_finish (FF): 前置工序完成后才能完成
    -- start_to_finish (SF): 前置工序开始后才能完成（少用）
    lag_days INTEGER DEFAULT 0,
    -- 滞后时间（天），正数表示延迟，负数表示提前
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_dependency CHECK (process_execution_id != depends_on_process_id),
    CONSTRAINT unique_dependency UNIQUE (process_execution_id, depends_on_process_id)
);

-- 2. 工序进度计划增强（在process_execution表中添加字段）
ALTER TABLE process_execution 
ADD COLUMN IF NOT EXISTS planned_start_date DATE,
ADD COLUMN IF NOT EXISTS planned_end_date DATE,
ADD COLUMN IF NOT EXISTS planned_duration INTEGER, -- 计划工期（天）
ADD COLUMN IF NOT EXISTS earliest_start_date DATE, -- 最早开始日期（基于依赖计算）
ADD COLUMN IF NOT EXISTS earliest_finish_date DATE, -- 最早完成日期
ADD COLUMN IF NOT EXISTS latest_start_date DATE, -- 最晚开始日期
ADD COLUMN IF NOT EXISTS latest_finish_date DATE, -- 最晚完成日期
ADD COLUMN IF NOT EXISTS total_float INTEGER, -- 总时差（天）
ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT FALSE; -- 是否在关键路径上

-- 3. 项目里程碑表
CREATE TABLE IF NOT EXISTS project_milestones (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name JSONB NOT NULL, -- { "zh": "结构封顶", "th": "โครงสร้างเสร็จ", "en": "Structure Complete" }
    description TEXT,
    target_date DATE NOT NULL,
    actual_date DATE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, achieved, missed
    related_process_id INTEGER REFERENCES process_execution(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- 4. 索引优化
CREATE INDEX IF NOT EXISTS idx_process_dependencies_process ON process_dependencies(process_execution_id);
CREATE INDEX IF NOT EXISTS idx_process_dependencies_depends ON process_dependencies(depends_on_process_id);
CREATE INDEX IF NOT EXISTS idx_process_execution_dates ON process_execution(planned_start_date, planned_end_date);
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_date ON project_milestones(target_date);

-- 5. 添加注释
COMMENT ON TABLE process_dependencies IS '工序依赖关系表';
COMMENT ON COLUMN process_dependencies.dependency_type IS '依赖类型: FS完成-开始, SS开始-开始, FF完成-完成, SF开始-完成';
COMMENT ON COLUMN process_dependencies.lag_days IS '滞后天数，正数延迟，负数提前';

COMMENT ON TABLE project_milestones IS '项目里程碑表';
COMMENT ON COLUMN project_milestones.status IS '状态: pending待完成, achieved已完成, missed已错过';

COMMENT ON COLUMN process_execution.earliest_start_date IS '最早开始日期（基于前置依赖）';
COMMENT ON COLUMN process_execution.total_float IS '总时差，关键路径上的工序时差为0';
COMMENT ON COLUMN process_execution.is_critical IS '是否在关键路径上';

-- 6. 示例数据（可选）
-- 假设项目ID=1有工序1,2,3，设置依赖关系：工序2依赖工序1完成，工序3依赖工序2完成
-- INSERT INTO process_dependencies (process_execution_id, depends_on_process_id, dependency_type, lag_days)
-- VALUES 
-- (2, 1, 'finish_to_start', 0),  -- 工序2在工序1完成后开始
-- (3, 2, 'finish_to_start', 1);  -- 工序3在工序2完成后1天开始

-- 完成
SELECT 'Phase 3B database schema created successfully!' as status;
