-- Show MEP process unit
SELECT 
    pn.process_code,
    pn.process_name->>'zh' as name_zh,
    pn.process_name->>'th' as name_th,
    pe.quantity_unit,
    pe.planned_quantity,
    pe.total_completed,
    pe.completion_percentage
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10 
  AND pn.process_code = 'N05_MEP_ROUGH';
