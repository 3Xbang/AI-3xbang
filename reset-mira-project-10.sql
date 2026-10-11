-- 🔄 重置 Mira Villa 项目10的所有数据
-- Reset all data for Mira Villa Project 10
-- PostgreSQL - Final Correct Version

BEGIN;

-- 1. 重置工序执行状态（通过process_nodes关联）
UPDATE process_execution 
SET 
    status = 'not_started',
    completion_percentage = 0,
    actual_start_date = NULL,
    actual_end_date = NULL,
    measurements = NULL,
    notes = NULL
WHERE process_node_id IN (
    SELECT id FROM process_nodes WHERE project_id = 10
);

-- 2. 清空子任务
DELETE FROM process_subtasks 
WHERE process_execution_id IN (
    SELECT pe.id 
    FROM process_execution pe
    JOIN process_nodes pn ON pe.process_node_id = pn.id
    WHERE pn.project_id = 10
);

-- 3. 清空任务分配
DELETE FROM task_assignments 
WHERE process_execution_id IN (
    SELECT pe.id 
    FROM process_execution pe
    JOIN process_nodes pn ON pe.process_node_id = pn.id
    WHERE pn.project_id = 10
);

-- 4. 清空材料使用记录
DELETE FROM material_usage 
WHERE process_execution_id IN (
    SELECT pe.id 
    FROM process_execution pe
    JOIN process_nodes pn ON pe.process_node_id = pn.id
    WHERE pn.project_id = 10
);

-- 5. 清空项目材料
DELETE FROM project_materials WHERE project_id = 10;

-- 6. 清空材料记录
DELETE FROM materials WHERE project_id = 10;

-- 7. 清空照片
DELETE FROM photos 
WHERE process_execution_id IN (
    SELECT pe.id 
    FROM process_execution pe
    JOIN process_nodes pn ON pe.process_node_id = pn.id
    WHERE pn.project_id = 10
);

-- 8. 清空活动日志
DELETE FROM activity_logs WHERE project_id = 10;

-- 9. 清空每日进度
DELETE FROM daily_progress WHERE project_id = 10;

-- 10. 清空每日考勤
DELETE FROM daily_attendance WHERE project_id = 10;

-- 11. 清空成本汇总
DELETE FROM cost_summary WHERE project_id = 10;

-- 12. 重置项目状态
UPDATE projects 
SET 
    status = 'not_started'
WHERE id = 10;

COMMIT;

-- 📊 显示重置结果
\echo '✅ Project 10 has been reset successfully!'
\echo ''
\echo '📋 Statistics:'

SELECT 
    '🏗️  Total processes: ' || COUNT(*)::text AS info
FROM process_nodes 
WHERE project_id = 10;

SELECT 
    '📊  Execution records: ' || COUNT(*)::text AS info
FROM process_execution pe
JOIN process_nodes pn ON pe.process_node_id = pn.id
WHERE pn.project_id = 10;

SELECT 
    '✅  Not started: ' || COUNT(*)::text AS info
FROM process_execution pe
JOIN process_nodes pn ON pe.process_node_id = pn.id
WHERE pn.project_id = 10 AND pe.status = 'not_started';
