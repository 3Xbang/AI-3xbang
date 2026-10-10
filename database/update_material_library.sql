-- 更新材料库表结构并添加预设数据
-- 适配现有表结构

-- 1. 先清空可能存在的旧数据
TRUNCATE TABLE material_library CASCADE;

-- 2. 检查并添加缺失的列
DO $$ 
BEGIN
    -- 添加 typical_unit_price 列（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_library' AND column_name='typical_unit_price') THEN
        ALTER TABLE material_library ADD COLUMN typical_unit_price DECIMAL(10,2);
    END IF;
    
    -- 添加 description 列（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_library' AND column_name='description') THEN
        ALTER TABLE material_library ADD COLUMN description TEXT;
    END IF;
    
    -- 添加 material_name_th 列（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_library' AND column_name='material_name_th') THEN
        ALTER TABLE material_library ADD COLUMN material_name_th VARCHAR(100);
    END IF;
    
    -- 添加 unit_th 列（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_library' AND column_name='unit_th') THEN
        ALTER TABLE material_library ADD COLUMN unit_th VARCHAR(20);
    END IF;
END $$;

-- 3. 插入10种常用建筑材料
INSERT INTO material_library 
    (material_code, material_name, material_name_th, category, default_unit, unit_th, typical_unit_price, description) 
VALUES
-- 1. 水泥
('MAT001', '水泥', 'ปูนซีเมนต์', 'concrete', '吨', 'ตัน', 4500.00, 
 '普通硅酸盐水泥，强度等级42.5 | ปูนซีเมนต์ปอร์ตแลนด์ธรรมดา กำลังอัด 42.5'),

-- 2. 钢筋
('MAT002', '钢筋', 'เหล็กเส้น', 'steel', '吨', 'ตัน', 18000.00,
 '螺纹钢筋，规格RB400 | เหล็กข้ออ้อย เกรด RB400'),

-- 3. 混凝土
('MAT003', '混凝土', 'คอนกรีต', 'concrete', '立方米', 'ลูกบาศก์เมตร', 2800.00,
 '商品混凝土C30，含运输 | คอนกรีตผสมเสร็จ C30 รวมขนส่ง'),

-- 4. 红砖
('MAT004', '红砖', 'อิฐแดง', 'brick', '块', 'ก้อน', 3.50,
 '标准红砖，尺寸240×115×53mm | อิฐแดงมาตรฐาน ขนาด 240×115×53 มม.'),

-- 5. 瓷砖
('MAT005', '瓷砖', 'กระเบื้อง', 'tile', '平方米', 'ตารางเมตร', 450.00,
 '地砖或墙砖，规格600×600mm | กระเบื้องพื้นหรือผนัง ขนาด 600×600 มม.'),

-- 6. 木材
('MAT006', '木材', 'ไม้', 'wood', '立方米', 'ลูกบาศก์เมตร', 12000.00,
 '建筑用木方，松木或杉木 | ไม้แปรรูปสำหรับก่อสร้าง ไม้สนหรือไม้สาม'),

-- 7. 防水涂料
('MAT007', '防水涂料', 'สีกันซึม', 'waterproof', '桶', 'ถัง', 1200.00,
 '聚合物防水涂料，20kg/桶 | สีกันซึมโพลิเมอร์ 20 กก./ถัง'),

-- 8. 电线
('MAT008', '电线', 'สายไฟ', 'electric', '米', 'เมตร', 25.00,
 '铜芯电线，2.5平方 | สายไฟทองแดง 2.5 ตร.มม.'),

-- 9. 水管
('MAT009', '水管', 'ท่อน้ำ', 'plumbing', '米', 'เมตร', 35.00,
 'PVC给水管，直径25mm | ท่อน้ำ PVC เส้นผ่านศูนย์กลาง 25 มม.'),

-- 10. 油漆
('MAT010', '油漆', 'สี', 'paint', '升', 'ลิตร', 180.00,
 '乳胶漆，内墙专用 | สีทาภายใน ชนิดน้ำ');

-- 4. 验证插入结果
SELECT 
    material_code,
    material_name,
    material_name_th,
    category,
    default_unit,
    unit_th,
    typical_unit_price
FROM material_library
ORDER BY material_code;
