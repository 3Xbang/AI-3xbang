-- Check all processes and their units
SELECT 
    pn.process_code,
    pn.process_name->>'zh' as name_zh,
    pn.process_name->>'th' as name_th,
    pe.quantity_unit,
    pe.planned_quantity
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10
ORDER BY pn.sequence_number;
