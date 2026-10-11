-- Update stair process unit from m² to 步 (steps)
UPDATE process_execution pe
SET quantity_unit = '步'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code = 'STR-02-07';

-- Verify the change
SELECT 
    pn.process_code,
    pn.process_name->>'zh' as name_zh,
    pn.process_name->>'th' as name_th,
    pe.quantity_unit,
    pe.planned_quantity
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10 
  AND pn.process_code = 'STR-02-07';
