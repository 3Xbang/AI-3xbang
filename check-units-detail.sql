-- Check actual units in database
SELECT 
    pn.process_code,
    pn.process_name->>'zh' as name_zh,
    pe.quantity_unit as db_unit,
    CASE 
        WHEN pe.quantity_unit = 'm²' THEN '✓ 平方米'
        WHEN pe.quantity_unit = 'm³' THEN '✓ 立方米'
        WHEN pe.quantity_unit = 'm' THEN '✓ 米'
        WHEN pe.quantity_unit = '根' THEN '✓ 根'
        WHEN pe.quantity_unit = '樘' THEN '✓ 樘'
        WHEN pe.quantity_unit = '套' THEN '✓ 套'
        WHEN pe.quantity_unit = '盏' THEN '✓ 盏'
        WHEN pe.quantity_unit = '个' THEN '✓ 个'
        WHEN pe.quantity_unit IS NULL THEN '❌ NULL'
        ELSE '⚠️ ' || pe.quantity_unit
    END as unit_status
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10
ORDER BY pn.sequence_number;
