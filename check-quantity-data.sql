-- 检查场地平整工序的工程量数据
SELECT 
    pe.id,
    pn.process_code,
    pn.process_name->>'zh' as process_name,
    pe.status,
    pe.planned_quantity,
    pe.quantity_unit,
    pe.measurements
FROM process_execution pe
JOIN process_nodes pn ON pe.process_node_id = pn.id
WHERE pn.project_id = 10 
  AND pn.process_code = 'FND-01-01'
ORDER BY pe.id;
