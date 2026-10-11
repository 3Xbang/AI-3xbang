-- Update all process units based on construction standards
-- 更新所有工序的计量单位

-- ============================================
-- 地基工程 Foundation (FND)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FND-01-01'); -- 场地平整 (already has m²)

UPDATE process_execution pe
SET quantity_unit = 'm³'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FND-01-02', 'N01_EXCAVATION'); -- 基坑开挖, 土方开挖

UPDATE process_execution pe
SET quantity_unit = 'm³'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FND-01-03'); -- 地基处理

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FND-01-04'); -- 混凝土垫层

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FND-01-05'); -- 基础防水

UPDATE process_execution pe
SET quantity_unit = 'm³'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FND-01-06', 'N02_FOUNDATION'); -- 基础混凝土浇筑, 地基浇筑

-- ============================================
-- 主体结构 Structure (STR, N03, N04)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = '根'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('STR-02-01', 'STR-02-02', 'STR-02-03'); -- 柱钢筋/模板/混凝土

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('STR-02-04', 'STR-02-05', 'STR-02-06'); -- 梁板钢筋/模板/混凝土

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('STR-02-07'); -- 楼梯施工

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('STR-02-08', 'STR-02-09', 'N04_ROOF_FRAME'); -- 屋面结构层/防水层/封顶

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('N03_STRUCTURE'); -- 主体框架

-- ============================================
-- 砌体工程 Masonry (MAS, N08)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('MAS-03-01', 'N08_WALL_PARTITION'); -- 砖墙砌筑, 砌墙隔断

UPDATE process_execution pe
SET quantity_unit = '根'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('MAS-03-02'); -- 构造柱施工

UPDATE process_execution pe
SET quantity_unit = 'm'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('MAS-03-03'); -- 圈梁施工

-- ============================================
-- 水电工程 MEP (N05, N06, MEP-06)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('N05_MEP_ROUGH', 'N06_MEP_HIDDEN'); -- 水电布管, 水电隐蔽工程

UPDATE process_execution pe
SET quantity_unit = 'm'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('MEP-06-01', 'MEP-06-02'); -- 给水/排水管道安装

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('MEP-06-03', 'MEP-06-04'); -- 强电/弱电线路敷设

UPDATE process_execution pe
SET quantity_unit = '盏'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('MEP-06-05', 'N15_LIGHTING'); -- 灯具安装, 灯具开关

UPDATE process_execution pe
SET quantity_unit = '个'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('MEP-06-06'); -- 开关插座安装

-- ============================================
-- 防水工程 Waterproofing (N07, SAN-07-01)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('N07_WATERPROOF', 'SAN-07-01'); -- 防水工程, 卫生间防水

-- ============================================
-- 装修工程 Finishing (FIN, N09)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FIN-01-01', 'FIN-01-02', 'FIN-01-03', 'FIN-01-04', 'N09_PLASTERING'); 
  -- 墙面基层处理, 内墙抹灰, 外墙抹灰, 天花抹灰, 泥瓦抹灰

-- ============================================
-- 地面工程 Flooring (FLR, N10)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('FLR-02-01', 'FLR-02-02', 'FLR-02-03', 'FLR-02-04', 'N10_TILING'); 
  -- 地面找平层, 地砖铺贴, 木地板安装, 石材地面, 瓷砖铺贴

-- ============================================
-- 吊顶工程 Ceiling (CLG, N11)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('CLG-03-01', 'CLG-03-02', 'CLG-03-03', 'N11_CEILING'); 
  -- 轻钢龙骨骨架, 石膏板吊顶, 铝扣板吊顶, 木工吊顶

-- ============================================
-- 墙面工程 Wall Finishing (WAL, N12)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('WAL-04-01', 'WAL-04-02', 'WAL-04-03', 'WAL-04-04', 'WAL-04-05', 'N12_PAINTING'); 
  -- 墙面找平, 腻子批刮, 乳胶漆涂刷, 墙砖铺贴, 墙纸粘贴, 油漆涂刷

-- ============================================
-- 门窗工程 Door & Window (DOR, N13)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = '樘'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('DOR-05-01', 'DOR-05-02', 'DOR-05-03', 'N13_DOOR_WINDOW'); 
  -- 门窗框安装, 门扇安装, 窗扇安装, 门窗安装

UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('DOR-05-04'); -- 玻璃安装

-- ============================================
-- 卫生间工程 Sanitary (SAN, N14)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = '套'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('SAN-07-02', 'SAN-07-03', 'N14_SANITARY'); 
  -- 卫生洁具安装, 淋浴房安装, 洁具安装

-- ============================================
-- 厨房工程 Kitchen (KIT)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('KIT-07-04', 'KIT-07-05'); 
  -- 橱柜安装, 台面安装

-- ============================================
-- 验收工程 Acceptance (N16)
-- ============================================
UPDATE process_execution pe
SET quantity_unit = 'm²'
FROM process_nodes pn
WHERE pe.process_node_id = pn.id 
  AND pn.project_id = 10 
  AND pn.process_code IN ('N16_CLEANING'); 
  -- 清洁验收

-- Show results
SELECT 
    pn.process_code,
    pn.process_name->>'zh' as name_zh,
    pe.quantity_unit as unit,
    CASE 
        WHEN pe.quantity_unit IS NULL THEN '❌ 缺失'
        ELSE '✓'
    END as status
FROM process_nodes pn
LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
WHERE pn.project_id = 10
ORDER BY pn.sequence_number;
