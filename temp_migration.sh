#!/bin/bash
sudo -u postgres psql -d construction_simple << 'EOF'
CREATE TABLE IF NOT EXISTS workers (
    worker_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    id_number VARCHAR(50),
    phone VARCHAR(20),
    daily_wage DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    leave_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_attendance (
    attendance_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    work_hours DECIMAL(4,2) DEFAULT 8.0,
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    daily_cost DECIMAL(10,2),
    notes TEXT,
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(worker_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS cost_summary (
    summary_id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
    labor_cost DECIMAL(12,2) DEFAULT 0,
    material_cost DECIMAL(12,2) DEFAULT 0,
    tool_cost DECIMAL(12,2) DEFAULT 0,
    other_cost DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_workers_project ON workers(project_id);
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_attendance_project ON daily_attendance(project_id);
CREATE INDEX IF NOT EXISTS idx_attendance_worker ON daily_attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON daily_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_cost_summary_project ON cost_summary(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_summary_date ON cost_summary(summary_date);

SELECT 'Migration completed successfully!' AS result;
EOF
