-- 对齐 3 个单位不一致的工序（前端字段决定主计量）
-- FND-01-03 地基处理：按面积 m²
-- FND-01-04 混凝土垫层：面积 x 厚度 = 体积 m³
-- STR-02-06 梁板混凝土浇筑：体积 m³
UPDATE process_execution pe SET quantity_unit = 'm²'
FROM process_nodes pn WHERE pe.process_node_id = pn.id AND pn.process_code = 'FND-01-03';

UPDATE process_execution pe SET quantity_unit = 'm³'
FROM process_nodes pn WHERE pe.process_node_id = pn.id AND pn.process_code IN ('FND-01-04', 'STR-02-06');

SELECT pn.project_id, pn.process_code, pe.quantity_unit
FROM process_nodes pn JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.process_code IN ('FND-01-03', 'FND-01-04', 'STR-02-06')
ORDER BY pn.project_id, pn.process_code;
