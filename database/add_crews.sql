-- 施工班组：只记班组名、大工人数及会的工种、普工人数。具体的人由系统自动生成（用于出勤和派工）。幂等。
CREATE TABLE IF NOT EXISTS project_crews (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  skilled_count INTEGER NOT NULL DEFAULT 0,
  helper_count INTEGER NOT NULL DEFAULT 0,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(10) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_crews_project ON project_crews(project_id);
ALTER TABLE workers ADD COLUMN IF NOT EXISTS crew_id INTEGER REFERENCES project_crews(id) ON DELETE SET NULL;
SELECT 'crews schema ready' AS status;
