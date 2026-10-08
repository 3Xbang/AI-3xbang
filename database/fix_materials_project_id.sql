-- 修复材料表：添加 project_id 字段
-- 日期: 2024-01-15
-- 原因: 材料应该按项目管理，而不是全局共享

ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id);

COMMENT ON COLUMN materials.project_id IS '关联的项目ID';
