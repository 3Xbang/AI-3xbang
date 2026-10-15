-- Comprehensive analysis of all process units
SELECT 
    pn.sequence_number as seq,
    pn.process_code,
    pn.process_name->>'zh' as name_zh,
    pn.process_name->>'th' as name_th,
    pe.quantity_unit as unit,
    CASE 
        WHEN pn.process_code LIKE 'FND%' THEN '地基工程'
        WHEN pn.process_code LIKE 'STR%' THEN '主体结构'
        WHEN pn.process_code LIKE 'MAS%' THEN '砌体工程'
        WHEN pn.process_code LIKE 'MEP%' THEN '水电工程'
        WHEN pn.process_code LIKE 'FIN%' THEN '装修工程'
        WHEN pn.process_code LIKE 'FLR%' THEN '地面工程'
        WHEN pn.process_code LIKE 'CLG%' THEN '吊顶工程'
        WHEN pn.process_code LIKE 'WAL%' THEN '墙面工程'
        WHEN pn.process_code LIKE 'DOR%' THEN '门窗工程'
        WHEN pn.process_code LIKE 'SAN%' THEN '卫浴工程'
        WHEN pn.process_code LIKE 'KIT%' THEN '厨房工程'
        WHEN pn.process_code LIKE 'N%' THEN '主要工序'
        ELSE '其他'
    END as category
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10
ORDER BY pn.sequence_number;
