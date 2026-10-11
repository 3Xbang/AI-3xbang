-- Check process_nodes table structure
\d process_nodes;

-- Show MEP processes
SELECT * FROM process_nodes WHERE project_id = 10 AND process_code LIKE 'N%5%' LIMIT 3;
