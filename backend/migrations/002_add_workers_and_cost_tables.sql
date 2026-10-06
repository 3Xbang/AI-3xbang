-- Migration: Add workers, daily_attendance, and cost_summary tables
-- Date: 2026-10-06

-- Workers table (员工信息)
CREATE TABLE IF NOT EXISTS workers (
    worker_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 工种: carpenter, electrician, plumber, mason, painter, etc.
    id_number VARCHAR(50), -- 身份证号
    phone VARCHAR(20),
    daily_wage DECIMAL(10,2) NOT NULL DEFAULT 0, -- 日薪
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, left
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    leave_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily attendance (考勤记录)
CREATE TABLE IF NOT EXISTS daily_attendance (
    attendance_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- present, absent, half-day, overtime, leave
    work_hours DECIMAL(4,2) DEFAULT 8.0, -- 工时
    overtime_hours DECIMAL(4,2) DEFAULT 0, -- 加班时数
    daily_cost DECIMAL(10,2), -- 当日成本 (calculated)
    notes TEXT,
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(worker_id, attendance_date)
);

-- Cost summary (成本汇总表)
CREATE TABLE IF NOT EXISTS cost_summary (
    summary_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
    labor_cost DECIMAL(12,2) DEFAULT 0, -- 人工成本
    material_cost DECIMAL(12,2) DEFAULT 0, -- 材料成本
    tool_cost DECIMAL(12,2) DEFAULT 0, -- 工具成本
    other_cost DECIMAL(12,2) DEFAULT 0, -- 其他成本
    total_cost DECIMAL(12,2) DEFAULT 0, -- 总成本
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, summary_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workers_project ON workers(project_id);
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_attendance_project ON daily_attendance(project_id);
CREATE INDEX IF NOT EXISTS idx_attendance_worker ON daily_attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON daily_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_cost_summary_project ON cost_summary(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_summary_date ON cost_summary(summary_date);

-- Add comments
COMMENT ON TABLE workers IS '工人信息表';
COMMENT ON TABLE daily_attendance IS '每日考勤记录';
COMMENT ON TABLE cost_summary IS '项目成本汇总表';
