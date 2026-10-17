#!/bin/bash
# Clear all design drawings and PNG files for project 24

echo "=== Clearing DB records ==="
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple << 'SQL'
DELETE FROM drawing_annotations WHERE drawing_id IN (SELECT id FROM design_drawings WHERE project_id=24);
DELETE FROM design_drawings WHERE project_id=24;
SELECT 'Remaining drawings for project 24: ' || COUNT(*) FROM design_drawings WHERE project_id=24;
SQL

echo "=== Removing PNG files ==="
COUNT=$(ls /home/ec2-user/AI-3xbang/backend/uploads/drawing_* 2>/dev/null | wc -l)
echo "Found $COUNT files to delete"
rm -f /home/ec2-user/AI-3xbang/backend/uploads/drawing_*
AFTER=$(ls /home/ec2-user/AI-3xbang/backend/uploads/drawing_* 2>/dev/null | wc -l)
echo "Remaining after delete: $AFTER"

echo "=== Done. Ready for fresh upload ==="
