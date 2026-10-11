-- 工序总库 + 项目申请表 + 团队名册 + 现场安排 + 提前开始记录 + 通知
-- 只加不删：所有语句都是 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行。
-- 执行前请先备份数据库。

-- 1. 工序节点：记录它来自总库哪个编码、属于哪一层
ALTER TABLE process_nodes
  ADD COLUMN IF NOT EXISTS master_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS floor_no INTEGER;
CREATE INDEX IF NOT EXISTS idx_process_nodes_master ON process_nodes(project_id, master_code, floor_no);

-- 2. 依赖关系：「前置做到百分之几就可以开始」（搭接）
ALTER TABLE process_dependencies
  ADD COLUMN IF NOT EXISTS min_progress INTEGER DEFAULT 0;

-- 3. 项目申请表（客户填的答案）
CREATE TABLE IF NOT EXISTS project_profiles (
  project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  plan_generated_at TIMESTAMP
);

-- 4. 团队名册：沿用已有的 workers 表，加上「级别」和「会什么」
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS level VARCHAR(10) DEFAULT 'helper',
  ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
-- workers.project_id 目前没有外键，补一个索引已存在 (idx_workers_project)

-- 5. 工头每天的派工
CREATE TABLE IF NOT EXISTS site_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  process_execution_id INTEGER NOT NULL REFERENCES process_execution(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_site_assign_worker_day UNIQUE (worker_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_site_assign_project_date ON site_assignments(project_id, work_date);

-- 6. 条件没满足就提前开始的记录
CREATE TABLE IF NOT EXISTS process_overrides (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  process_execution_id INTEGER NOT NULL REFERENCES process_execution(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity VARCHAR(10) NOT NULL,
  unmet JSONB,
  decided_by INTEGER REFERENCES users(id),
  decided_by_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_overrides_project ON process_overrides(project_id, created_at);

-- 7. 通知
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  severity VARCHAR(10) DEFAULT 'info',
  related_type VARCHAR(30),
  related_id INTEGER,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(to_user_id, read_at, created_at);

SELECT 'plan system schema ready' AS status;
