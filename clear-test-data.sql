-- 清除测试数据，重置 FND-01-01 工序
UPDATE process_execution
SET 
    status = 'not_started',
    actual_start_date = NULL,
    actual_end_date = NULL,
    completion_percentage = 0,
    measurements = NULL,
    planned_quantity = NULL,
    quantity_unit = NULL
WHERE process_node_id IN (
    SELECT pn.id 
    FROM process_nodes pn 
    WHERE pn.project_id = 10 AND pn.process_code = 'FND-01-01'
);

SELECT '✓ 已清除测试数据，请重新填写工程量' as result;
