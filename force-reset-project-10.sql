-- Force reset all processes in Project 10 to not_started status
UPDATE process_execution 
SET 
    status = 'not_started', 
    completion_percentage = 0, 
    actual_start_date = NULL, 
    actual_end_date = NULL
WHERE process_node_id IN (
    SELECT id FROM process_nodes WHERE project_id = 10
);

-- Show result count
SELECT COUNT(*) as total_processes FROM process_execution 
WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id = 10);
