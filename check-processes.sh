#!/bin/bash
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple -c "SELECT pe.id, pe.status, pn.process_code, pn.process_name FROM process_nodes pn LEFT JOIN process_execution pe ON pn.id = pe.process_node_id WHERE pn.project_id = 10 ORDER BY pn.sequence_number LIMIT 5;"
