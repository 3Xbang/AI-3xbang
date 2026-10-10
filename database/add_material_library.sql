-- 添加材料库表和预设数据
-- 这个表存储系统预设的常用建筑材料模板

-- 创建材料库表
CREATE TABLE IF NOT EXISTS material_library (
    id SERIAL PRIMARY KEY,
    material_code VARCHAR(20) UNIQUE NOT NULL,
    material_name JSONB NOT NULL,  -- {"zh": "中文名", "th": "泰语名"}
    category VARCHAR(50),  -- 材料分类：concrete, steel, brick, tile, wood, waterproof, electric, plumbing, paint, other
    unit JSONB NOT NULL,  -- {"zh": "单位", "th": "หน่วย"}
    typical_unit_price DECIMAL(10,2),  -- 参考单价（泰铢）
    description JSONB,  -- 材料说明
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入10种常用建筑材料
INSERT INTO material_library (material_code, material_name, category, unit, typical_unit_price, description) VALUES
-- 1. 水泥
('MAT001', 
 '{"zh": "水泥", "th": "ปูนซีเมนต์"}', 
 'concrete',
 '{"zh": "吨", "th": "ตัน"}',
 4500.00,
 '{"zh": "普通硅酸盐水泥，强度等级42.5", "th": "ปูนซีเมนต์ปอร์ตแลนด์ธรรมดา กำลังอัด 42.5"}'),

-- 2. 钢筋
('MAT002',
 '{"zh": "钢筋", "th": "เหล็กเส้น"}',
 'steel',
 '{"zh": "吨", "th": "ตัน"}',
 18000.00,
 '{"zh": "螺纹钢筋，规格RB400", "th": "เหล็กข้ออ้อย เกรด RB400"}'),

-- 3. 混凝土
('MAT003',
 '{"zh": "混凝土", "th": "คอนกรีต"}',
 'concrete',
 '{"zh": "立方米", "th": "ลูกบาศก์เมตร"}',
 2800.00,
 '{"zh": "商品混凝土C30，含运输", "th": "คอนกรีตผสมเสร็จ C30 รวมขนส่ง"}'),

-- 4. 红砖
('MAT004',
 '{"zh": "红砖", "th": "อิฐแดง"}',
 'brick',
 '{"zh": "块", "th": "ก้อน"}',
 3.50,
 '{"zh": "标准红砖，尺寸240×115×53mm", "th": "อิฐแดงมาตรฐาน ขนาด 240×115×53 มม."}'),

-- 5. 瓷砖
('MAT005',
 '{"zh": "瓷砖", "th": "กระเบื้อง"}',
 'tile',
 '{"zh": "平方米", "th": "ตารางเมตร"}',
 450.00,
 '{"zh": "地砖或墙砖，规格600×600mm", "th": "กระเบื้องพื้นหรือผนัง ขนาด 600×600 มม."}'),

-- 6. 木材
('MAT006',
 '{"zh": "木材", "th": "ไม้"}',
 'wood',
 '{"zh": "立方米", "th": "ลูกบาศก์เมตร"}',
 12000.00,
 '{"zh": "建筑用木方，松木或杉木", "th": "ไม้แปรรูปสำหรับก่อสร้าง ไม้สนหรือไม้สาม"}'),

-- 7. 防水涂料
('MAT007',
 '{"zh": "防水涂料", "th": "สีกันซึม"}',
 'waterproof',
 '{"zh": "桶", "th": "ถัง"}',
 1200.00,
 '{"zh": "聚合物防水涂料，20kg/桶", "th": "สีกันซึมโพลิเมอร์ 20 กก./ถัง"}'),

-- 8. 电线
('MAT008',
 '{"zh": "电线", "th": "สายไฟ"}',
 'electric',
 '{"zh": "米", "th": "เมตร"}',
 25.00,
 '{"zh": "铜芯电线，2.5平方", "th": "สายไฟทองแดง 2.5 ตร.มม."}'),

-- 9. 水管
('MAT009',
 '{"zh": "水管", "th": "ท่อน้ำ"}',
 'plumbing',
 '{"zh": "米", "th": "เมตร"}',
 35.00,
 '{"zh": "PVC给水管，直径25mm", "th": "ท่อน้ำ PVC เส้นผ่านศูนย์กลาง 25 มม."}'),

-- 10. 油漆
('MAT010',
 '{"zh": "油漆", "th": "สี"}',
 'paint',
 '{"zh": "升", "th": "ลิตร"}',
 180.00,
 '{"zh": "乳胶漆，内墙专用", "th": "สีทาภายใน ชนิดน้ำ"}');

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_material_library_category ON material_library(category);
CREATE INDEX IF NOT EXISTS idx_material_library_code ON material_library(material_code);

-- 添加注释
COMMENT ON TABLE material_library IS '材料库：预设常用建筑材料模板';
COMMENT ON COLUMN material_library.material_code IS '材料编号，全局唯一';
COMMENT ON COLUMN material_library.material_name IS '材料名称（中泰双语JSONB）';
COMMENT ON COLUMN material_library.category IS '材料分类';
COMMENT ON COLUMN material_library.unit IS '计量单位（中泰双语JSONB）';
COMMENT ON COLUMN material_library.typical_unit_price IS '参考单价（泰铢），仅供参考';
COMMENT ON COLUMN material_library.description IS '材料说明（中泰双语JSONB）';
