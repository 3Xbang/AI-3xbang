-- 重置项目10 (mira NO.1) 的工序状态
-- Reset process status for project 10

-- 重置所有工序状态为未开始
UPDATE process_execution
SET 
    status = 'not_started',
    completion_percentage = 0,
    actual_start_date = NULL,
    actual_end_date = NULL,
    measurements = NULL,
    planned_quantity = NULL,
    quantity_unit = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE process_node_id IN (
    SELECT id FROM process_nodes WHERE project_id = 10
);

-- 显示重置后的工序状态
SELECT 
    pe.id,
    pn.process_code,
    pn.process_name->>'zh' as process_name,
    pe.status,
    pe.completion_percentage,
    pe.planned_start_date,
    pe.planned_end_date
FROM process_execution pe
JOIN process_nodes pn ON pe.process_node_id = pn.id
WHERE pn.project_id = 10
ORDER BY pn.sequence_number;

SELECT '✓ 项目 10 (mira NO.1) 的工序状态已重置' as result;
