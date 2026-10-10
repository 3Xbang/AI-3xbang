-- Mira Villa 工序模板库
-- 基于中国建筑施工规范

-- 创建工序模板表
CREATE TABLE IF NOT EXISTS process_templates (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,           -- 'foundation', 'structure', 'masonry', 'finishing', 'flooring', 'ceiling', 'wall', 'door', 'mep', 'sanitary'
    code VARCHAR(20) UNIQUE NOT NULL,        -- 工序代码 如 FND-01-01
    name_zh VARCHAR(200) NOT NULL,           -- 中文名称
    name_th VARCHAR(200) NOT NULL,           -- 泰文名称
    name_en VARCHAR(200),                    -- 英文名称（可选）
    default_unit VARCHAR(20) NOT NULL,       -- 默认单位: sqm, cbm, meter, item, set, ton
    quality_points TEXT,                     -- 质量要点（JSON格式）
    display_order INT NOT NULL,              -- 显示顺序
    is_active BOOLEAN DEFAULT true,          -- 是否启用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_process_templates_category ON process_templates(category);
CREATE INDEX idx_process_templates_code ON process_templates(code);
CREATE INDEX idx_process_templates_active ON process_templates(is_active);

-- 插入工序数据

-- ==================== 一、建筑工程 ====================

-- 1.1 地基与基础工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('foundation', 'FND-01-01', '场地平整', 'ปรับระดับพื้นที่', 'Site Leveling', 'sqm', '["地面平整度误差≤30mm", "排水坡度符合设计要求", "清除表土及杂物"]', 1),
('foundation', 'FND-01-02', '基坑开挖', 'ขุดหลุมฐานราก', 'Excavation', 'cbm', '["开挖深度符合设计", "边坡稳定", "基底承载力检测"]', 2),
('foundation', 'FND-01-03', '地基处理', 'บำบัดชั้นดิน', 'Foundation Treatment', 'sqm', '["换填材料符合要求", "分层夯实", "压实系数≥0.94"]', 3),
('foundation', 'FND-01-04', '混凝土垫层', 'ชั้นคอนกรีตรอง', 'Concrete Padding', 'cbm', '["厚度不小于100mm", "表面平整", "强度达到C15"]', 4),
('foundation', 'FND-01-05', '基础防水', 'กันซึมฐานราก', 'Foundation Waterproofing', 'sqm', '["防水材料符合标准", "搭接宽度≥100mm", "闭水试验24小时"]', 5),
('foundation', 'FND-01-06', '基础混凝土浇筑', 'เทคอนกรีตฐานราก', 'Foundation Concrete', 'cbm', '["钢筋保护层厚度≥40mm", "混凝土连续浇筑", "养护时间≥7天"]', 6);

-- 1.2 主体结构工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('structure', 'STR-02-01', '柱钢筋绑扎', 'ผูกเหล็กเสา', 'Column Rebar', 'ton', '["箍筋间距符合设计", "主筋搭接长度满足要求", "保护层厚度≥25mm"]', 11),
('structure', 'STR-02-02', '柱模板安装', 'แบบหล่อเสา', 'Column Formwork', 'sqm', '["垂直度偏差≤5mm", "模板接缝严密", "支撑牢固"]', 12),
('structure', 'STR-02-03', '柱混凝土浇筑', 'เทคอนกรีตเสา', 'Column Concrete', 'cbm', '["分层浇筑，每层≤500mm", "振捣密实", "强度等级符合设计"]', 13),
('structure', 'STR-02-04', '梁板钢筋绑扎', 'ผูกเหล็กคาน-พื้น', 'Beam/Slab Rebar', 'ton', '["钢筋间距准确", "绑扎牢固", "垫块位置正确"]', 14),
('structure', 'STR-02-05', '梁板模板安装', 'แบบหล่อคาน-พื้น', 'Beam/Slab Formwork', 'sqm', '["标高准确", "起拱高度正确", "支撑系统稳固"]', 15),
('structure', 'STR-02-06', '梁板混凝土浇筑', 'เทคอนกรีตคาน-พื้น', 'Beam/Slab Concrete', 'cbm', '["楼板厚度偏差±10mm", "表面平整度≤8mm/2m", "养护时间≥14天"]', 16),
('structure', 'STR-02-07', '楼梯施工', 'บันได', 'Staircase', 'sqm', '["踏步高度一致", "防滑处理", "栏杆牢固"]', 17),
('structure', 'STR-02-08', '屋面结构层', 'โครงสร้างหลังคา', 'Roof Structure', 'sqm', '["坡度符合设计", "找平层厚度均匀"]', 18),
('structure', 'STR-02-09', '屋面防水层', 'กันซึมหลังคา', 'Roof Waterproofing', 'sqm', '["防水等级符合设计", "淋水试验24小时", "泛水高度≥250mm"]', 19);

-- 1.3 砌体工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('masonry', 'MAS-03-01', '砖墙砌筑', 'ก่ออิฐ', 'Brick Wall', 'cbm', '["砂浆饱满度≥80%", "垂直度≤5mm/层", "砖块提前浇水湿润"]', 21),
('masonry', 'MAS-03-02', '构造柱施工', 'เสาโครงสร้าง', 'Structural Column', 'cbm', '["与墙体马牙槎连接", "钢筋锚固长度足够"]', 22),
('masonry', 'MAS-03-03', '圈梁施工', 'คานวงแหวน', 'Ring Beam', 'meter', '["连续闭合", "与构造柱整体浇筑"]', 23);

-- ==================== 二、装修工程 ====================

-- 2.1 抹灰工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('finishing', 'FIN-01-01', '墙面基层处理', 'เตรียมผิวผนัง', 'Wall Surface Prep', 'sqm', '["清除浮灰、油污", "洒水湿润", "挂网加强"]', 31),
('finishing', 'FIN-01-02', '内墙抹灰', 'ฉาบปูนผนังใน', 'Interior Plastering', 'sqm', '["分层抹灰，每层≤7mm", "阴阳角方正", "表面平整度≤4mm/2m"]', 32),
('finishing', 'FIN-01-03', '外墙抹灰', 'ฉาบปูนผนังนอก', 'Exterior Plastering', 'sqm', '["分格缝设置", "滴水线制作", "防开裂网铺设"]', 33),
('finishing', 'FIN-01-04', '天花抹灰', 'ฉาบปูนเพดาน', 'Ceiling Plastering', 'sqm', '["平整度≤5mm/2m", "阴角顺直"]', 34);

-- 2.2 地面工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('flooring', 'FLR-02-01', '地面找平层', 'ปรับระดับพื้น', 'Floor Leveling', 'sqm', '["表面平整度≤4mm/2m", "坡向正确", "养护时间≥7天"]', 41),
('flooring', 'FLR-02-02', '地砖铺贴', 'ปูกระเบื้องพื้น', 'Floor Tiles', 'sqm', '["表面平整度≤2mm/2m", "接缝平直度≤2mm/2m", "空鼓率≤5%", "勾缝密实"]', 42),
('flooring', 'FLR-02-03', '木地板安装', 'ปูพื้นไม้', 'Wood Flooring', 'sqm', '["防潮层铺设", "伸缩缝预留", "踩踏无异响"]', 43),
('flooring', 'FLR-02-04', '石材地面', 'ปูหินพื้น', 'Stone Flooring', 'sqm', '["石材六面防护", "缝隙宽度一致", "表面研磨抛光"]', 44);

-- 2.3 吊顶工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('ceiling', 'CLG-03-01', '轻钢龙骨骨架', 'โครงเหล็กเพดาน', 'Steel Frame', 'sqm', '["吊杆间距≤1200mm", "起拱高度1/200跨度", "龙骨平整度≤3mm/2m"]', 51),
('ceiling', 'CLG-03-02', '石膏板吊顶', 'เพดานยิปซั่ม', 'Gypsum Ceiling', 'sqm', '["板缝处理", "螺钉间距≤200mm", "表面平整度≤3mm/2m"]', 52),
('ceiling', 'CLG-03-03', '铝扣板吊顶', 'เพดานอลูมิเนียม', 'Aluminum Ceiling', 'sqm', '["板面平整", "接缝严密", "灯具位置准确"]', 53);

-- 2.4 墙面装饰工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('wall', 'WAL-04-01', '墙面找平', 'ปรับระดับผนัง', 'Wall Leveling', 'sqm', '["基层处理", "误差控制"]', 61),
('wall', 'WAL-04-02', '腻子批刮', 'โป๊วผนัง', 'Putty', 'sqm', '["分遍批刮≥2遍", "每遍干燥后打磨", "表面平整度≤3mm/2m"]', 62),
('wall', 'WAL-04-03', '乳胶漆涂刷', 'ทาสีน้ำ', 'Latex Paint', 'sqm', '["涂刷均匀≥2遍", "无流坠、刷痕", "色泽一致"]', 63),
('wall', 'WAL-04-04', '墙砖铺贴', 'ปูกระเบื้องผนัง', 'Wall Tiles', 'sqm', '["垂直度≤2mm/2m", "接缝平直度≤2mm/2m", "空鼓率≤5%", "阳角碰角处理"]', 64),
('wall', 'WAL-04-05', '墙纸粘贴', 'ติดวอลเปเปอร์', 'Wallpaper', 'sqm', '["基层平整干燥", "拼花准确", "无气泡、翘边"]', 65);

-- 2.5 门窗工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('door', 'DOR-05-01', '门窗框安装', 'ติดตั้งวงกบ', 'Frame Installation', 'set', '["垂直度≤2mm/m", "对角线差≤3mm", "锚固牢固"]', 71),
('door', 'DOR-05-02', '门扇安装', 'ติดตั้งบานประตู', 'Door Leaf', 'item', '["开启灵活", "缝隙均匀", "五金安装牢固"]', 72),
('door', 'DOR-05-03', '窗扇安装', 'ติดตั้งบานหน้าต่าง', 'Window Sash', 'item', '["开关顺畅", "密封良好", "排水孔畅通"]', 73),
('door', 'DOR-05-04', '玻璃安装', 'ติดตั้งกระจก', 'Glass Installation', 'sqm', '["密封胶施打完整", "玻璃固定牢固", "无划伤、污染"]', 74);

-- 2.6 水电安装工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('mep', 'MEP-06-01', '给水管道安装', 'ติดตั้งท่อน้ำประปา', 'Water Supply', 'meter', '["试压24小时无渗漏", "管道固定牢固", "保温层完整"]', 81),
('mep', 'MEP-06-02', '排水管道安装', 'ติดตั้งท่อระบายน้ำ', 'Drainage', 'meter', '["坡度符合要求", "通水试验顺畅", "存水弯安装正确"]', 82),
('mep', 'MEP-06-03', '强电线路敷设', 'เดินสายไฟ', 'Power Wiring', 'meter', '["线管保护", "接线盒安装规范", "绝缘电阻≥0.5MΩ"]', 83),
('mep', 'MEP-06-04', '弱电线路敷设', 'เดินสายสัญญาณ', 'Low Voltage', 'meter', '["与强电间距≥300mm", "线缆标识清晰"]', 84),
('mep', 'MEP-06-05', '灯具安装', 'ติดตั้งโคมไฟ', 'Lighting', 'set', '["安装牢固", "接线正确", "开关控制对应"]', 85),
('mep', 'MEP-06-06', '开关插座安装', 'ติดตั้งสวิตช์ปลั๊ก', 'Outlets & Switches', 'item', '["高度一致", "安装牢固", "通电测试正常"]', 86);

-- 2.7 卫浴厨房工程
INSERT INTO process_templates (category, code, name_zh, name_th, name_en, default_unit, quality_points, display_order) VALUES
('sanitary', 'SAN-07-01', '卫生间防水', 'กันซึมห้องน้ำ', 'Bathroom Waterproofing', 'sqm', '["墙面防水高度≥1800mm", "闭水试验48小时", "涂刷厚度符合要求"]', 91),
('sanitary', 'SAN-07-02', '卫生洁具安装', 'ติดตั้งสุขภัณฑ์', 'Sanitary Ware', 'set', '["安装牢固", "排水顺畅", "密封良好"]', 92),
('sanitary', 'SAN-07-03', '淋浴房安装', 'ติดตั้งฝักบัว', 'Shower Room', 'set', '["玻璃固定牢固", "密封良好", "排水正常"]', 93),
('sanitary', 'KIT-07-04', '橱柜安装', 'ติดตั้งตู้ครัว', 'Kitchen Cabinet', 'meter', '["水平度≤2mm/m", "柜门开关灵活", "台面拼接严密"]', 94),
('sanitary', 'KIT-07-05', '台面安装', 'ติดตั้งเคาน์เตอร์', 'Countertop', 'meter', '["拼缝≤0.5mm", "水槽开孔准确", "挡水条安装"]', 95);

-- 创建工序分类说明表
CREATE TABLE IF NOT EXISTS process_categories (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    name_zh VARCHAR(100) NOT NULL,
    name_th VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    parent_category VARCHAR(50),           -- 父分类：'construction' 或 'finishing'
    description_zh TEXT,
    description_th TEXT,
    display_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入分类数据
INSERT INTO process_categories (category_code, name_zh, name_th, name_en, parent_category, display_order) VALUES
('construction', '建筑工程', 'งานก่อสร้าง', 'Construction Works', NULL, 1),
('foundation', '地基与基础', 'ฐานรากและฐาน', 'Foundation', 'construction', 2),
('structure', '主体结构', 'โครงสร้างหลัก', 'Main Structure', 'construction', 3),
('masonry', '砌体工程', 'งานก่ออิฐ', 'Masonry', 'construction', 4),
('finishing', '装修工程', 'งานตกแต่ง', 'Finishing Works', NULL, 10),
('finishing_plaster', '抹灰工程', 'งานฉาบปูน', 'Plastering', 'finishing', 11),
('flooring', '地面工程', 'งานพื้น', 'Flooring', 'finishing', 12),
('ceiling', '吊顶工程', 'งานเพดาน', 'Ceiling', 'finishing', 13),
('wall', '墙面装饰', 'งานผนัง', 'Wall Finishing', 'finishing', 14),
('door', '门窗工程', 'งานประตูหน้าต่าง', 'Doors & Windows', 'finishing', 15),
('mep', '水电安装', 'งานระบบสาธารณูปโภค', 'MEP', 'finishing', 16),
('sanitary', '卫浴厨房', 'งานห้องน้ำครัว', 'Sanitary & Kitchen', 'finishing', 17);

COMMENT ON TABLE process_templates IS '工序模板库 - 基于中国建筑施工规范';
COMMENT ON TABLE process_categories IS '工序分类表';
