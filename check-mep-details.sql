-- Check process_execution structure
\d process_execution;

-- Show MEP process details
SELECT 
    pn.process_code,
    pn.process_name->>'zh' as name_zh,
    pn.process_name->>'th' as name_th,
    pe.unit,
    pe.quantity
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10 
  AND pn.process_code = 'N05_MEP_ROUGH';
