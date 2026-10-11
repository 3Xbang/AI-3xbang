#!/bin/bash
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'process_execution' AND column_name ~ '(quantity|measurement|dimension)' ORDER BY ordinal_position;"
