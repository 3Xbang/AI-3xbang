-- 重置 Mira NO.1 项目的工序状态
-- Reset process status for Mira NO.1 project

-- 查找 Mira 项目
SELECT id, name->>'zh' as name_zh FROM projects WHERE name->>'zh' LIKE '%Mira%';

-- 重置所有工序状态为未开始，清空完成百分比
UPDATE process_execution
SET 
    status = 'not_started',
    completion_percentage = 0,
    actual_start_date = NULL,
    actual_end_date = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE project_id IN (SELECT id FROM projects WHERE name->>'zh' LIKE '%Mira%');

-- 显示重置后的工序状态
SELECT 
    pe.id,
    pn.process_code,
    pe.status,
    pe.completion_percentage,
    pe.planned_quantity,
    pe.quantity_unit
FROM process_execution pe
LEFT JOIN process_nodes pn ON pe.process_node_id = pn.id
WHERE pe.project_id IN (SELECT id FROM projects WHERE name->>'zh' LIKE '%Mira%')
ORDER BY pe.id;

SELECT '✓ Mira 项目工序状态已重置为未开始' as result;
