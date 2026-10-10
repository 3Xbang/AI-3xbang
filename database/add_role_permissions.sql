-- 添加三角色权限系统
-- 角色：manager（管理者/甲方代表）、purchaser（采购者/乙方代表）、executor（执行者/工人）

-- 1. 更新用户表，添加角色和全名字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'executor';
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);

-- 更新现有 admin 用户为 manager 角色
UPDATE users SET role = 'manager', full_name = '系统管理员' WHERE username = 'admin';

-- 添加角色检查约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('manager', 'purchaser', 'executor'));

-- 2. 创建项目成员表
CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INT REFERENCES users(id),  -- 谁分配的
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,  -- 备注：负责哪些工序等
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 3. 创建任务分配表（记录谁给谁分配了任务）
CREATE TABLE IF NOT EXISTS task_assignments (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    process_execution_id INT NOT NULL REFERENCES process_execution(id) ON DELETE CASCADE,
    assigned_to INT NOT NULL REFERENCES users(id),  -- 分配给谁（执行者）
    assigned_by INT NOT NULL REFERENCES users(id),  -- 谁分配的（采购者或管理者）
    notes JSONB,  -- 备注（中泰双语）
    status VARCHAR(20) DEFAULT 'pending',  -- pending, in_progress, completed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_process ON task_assignments(process_execution_id);

-- 4. 添加操作日志表（记录重要操作）
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,  -- create_project, assign_task, purchase_material, update_progress, etc.
    target_type VARCHAR(50),  -- project, process, material, user
    target_id INT,
    details JSONB,  -- 详细信息
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- 5. 添加注释
COMMENT ON TABLE project_members IS '项目成员表：记录哪些用户可以访问哪些项目';
COMMENT ON COLUMN project_members.assigned_by IS '分配人：由管理者分配';
COMMENT ON TABLE task_assignments IS '任务分配表：采购者或管理者分配任务给执行者';
COMMENT ON TABLE activity_logs IS '操作日志表：记录重要操作，用于审计';
COMMENT ON COLUMN users.role IS '用户角色：manager（管理者）、purchaser（采购者）、executor（执行者）';

-- 6. 为管理员自动添加到所有现有项目
INSERT INTO project_members (project_id, user_id, assigned_by)
SELECT id, (SELECT id FROM users WHERE role = 'manager' LIMIT 1), (SELECT id FROM users WHERE role = 'manager' LIMIT 1)
FROM projects
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 7. 查看结果
SELECT 
    u.username, 
    u.full_name, 
    u.role,
    COUNT(DISTINCT pm.project_id) as project_count
FROM users u
LEFT JOIN project_members pm ON u.id = pm.user_id
GROUP BY u.id, u.username, u.full_name, u.role
ORDER BY u.id;
