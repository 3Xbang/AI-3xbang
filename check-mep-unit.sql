SELECT process_code, name_zh, name_th, unit, quantity 
FROM process_nodes 
WHERE project_id = 10 
  AND (name_zh LIKE '%布管%' OR name_zh LIKE '%水电%' OR process_code LIKE '%MEP%')
ORDER BY process_code;
