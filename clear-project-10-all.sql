-- 清除项目10的所有依赖关系和时间规划
-- Clear all dependencies and schedules for project 10

-- 删除所有依赖关系
DELETE FROM process_dependencies 
WHERE process_execution_id IN (
    SELECT pe.id 
    FROM process_execution pe
    JOIN process_nodes pn ON pe.process_node_id = pn.id
    WHERE pn.project_id = 10
);

-- 清除所有时间规划
UPDATE process_execution
SET 
    planned_start_date = NULL,
    planned_end_date = NULL,
    planned_duration = NULL
WHERE process_node_id IN (
    SELECT id FROM process_nodes WHERE project_id = 10
);

SELECT '✓ 已清除所有依赖关系和时间规划' as result;

-- 显示最终状态
SELECT 
    pn.process_code,
    pn.process_name->>'zh' as process_name,
    pe.status,
    pe.planned_start_date,
    pe.planned_end_date
FROM process_execution pe
JOIN process_nodes pn ON pe.process_node_id = pn.id
WHERE pn.project_id = 10
ORDER BY pn.sequence_number
LIMIT 10;
