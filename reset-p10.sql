UPDATE process_execution SET status = 'not_started', completion_percentage = 0, actual_start_date = NULL, actual_end_date = NULL WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id = 10);
SELECT COUNT(*) as reset_count FROM process_execution WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id = 10) AND status = 'not_started';
