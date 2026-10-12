-- 老板每日指派任务表（幂等）
CREATE TABLE IF NOT EXISTS daily_task_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  process_execution_id INTEGER REFERENCES process_execution(id) ON DELETE SET NULL,
  custom_title VARCHAR(200),
  custom_description TEXT,
  reference_photos JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'assigned',
  assigned_by INTEGER REFERENCES users(id),
  completion_note TEXT,
  actual_photos JSONB DEFAULT '[]'::jsonb,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dta_project_date ON daily_task_assignments(project_id, work_date);
SELECT 'daily_task_assignments ready' AS status;
