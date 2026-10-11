-- Check stair unit
SELECT process_code, process_name->>'zh' as name, quantity_unit 
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10 AND pn.process_code = 'STR-02-07';
