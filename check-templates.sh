#!/bin/bash
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple -c "SELECT category, code, name_zh, display_order FROM process_templates ORDER BY display_order LIMIT 50;"
