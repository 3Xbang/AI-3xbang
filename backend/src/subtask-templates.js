// 每个工序的标准子任务模板（中泰双语）
const SUBTASK_TEMPLATES = {
    'N01_EXCAVATION': [
        {
            name: { zh: '场地清理', th: 'เคลียร์พื้นที่' },
            description: { zh: '清除杂草、垃圾', th: 'เก็บวัชพืชและขยะ' },
            typical_percentage: 10,
            unit: 'sqm'
        },
        {
            name: { zh: '测量放线', th: 'วัดและกำหนดแนว' },
            description: { zh: '确定开挖范围', th: 'กำหนดขอบเขตการขุด' },
            typical_percentage: 10,
            unit: 'sqm'
        },
        {
            name: { zh: '土方开挖', th: 'ขุดดิน' },
            description: { zh: '按设计深度开挖', th: 'ขุดตามความลึกที่กำหนด' },
            typical_percentage: 70,
            unit: 'cbm'
        },
        {
            name: { zh: '基坑验收', th: 'ตรวจรับหลุมฐานราก' },
            description: { zh: '检查尺寸和平整度', th: 'ตรวจสอบขนาดและความเรียบ' },
            typical_percentage: 10,
            unit: 'item'
        }
    ],
    
    'N02_FOUNDATION': [
        {
            name: { zh: '垫层浇筑', th: 'เทคอนกรีตรองพื้น' },
            description: { zh: '素混凝土垫层', th: 'คอนกรีตรองพื้น' },
            typical_percentage: 15,
            unit: 'cbm'
        },
        {
            name: { zh: '模板安装', th: 'ติดแบบหล่อ' },
            description: { zh: '基础模板支护', th: 'ติดแบบหล่อฐานราก' },
            typical_percentage: 20,
            unit: 'sqm'
        },
        {
            name: { zh: '钢筋绑扎', th: 'มัดเหล็กเสริม' },
            description: { zh: '按图纸绑扎钢筋', th: 'มัดเหล็กตามแบบ' },
            typical_percentage: 25,
            unit: 'item'
        },
        {
            name: { zh: '混凝土浇筑', th: 'เทคอนกรีต' },
            description: { zh: '浇筑并振捣', th: 'เทและตอกคอนกรีต' },
            typical_percentage: 30,
            unit: 'cbm'
        },
        {
            name: { zh: '养护', th: 'บ่มคอนกรีต' },
            description: { zh: '洒水养护', th: 'รดน้ำบ่ม' },
            typical_percentage: 10,
            unit: 'item'
        }
    ],
    
    'N03_STRUCTURE': [
        {
            name: { zh: '柱模板', th: 'แบบหล่อเสา' },
            description: { zh: '安装柱子模板', th: 'ติดแบบหล่อเสา' },
            typical_percentage: 20,
            unit: 'item'
        },
        {
            name: { zh: '柱钢筋', th: 'เหล็กเสา' },
            description: { zh: '绑扎柱子钢筋', th: 'มัดเหล็กเสา' },
            typical_percentage: 15,
            unit: 'item'
        },
        {
            name: { zh: '柱浇筑', th: 'เทเสา' },
            description: { zh: '浇筑柱子混凝土', th: 'เทคอนกรีตเสา' },
            typical_percentage: 15,
            unit: 'cbm'
        },
        {
            name: { zh: '梁板模板', th: 'แบบหล่อคานและพื้น' },
            description: { zh: '安装梁板模板', th: 'ติดแบบหล่อคานและพื้น' },
            typical_percentage: 20,
            unit: 'sqm'
        },
        {
            name: { zh: '梁板钢筋', th: 'เหล็กคานและพื้น' },
            description: { zh: '绑扎梁板钢筋', th: 'มัดเหล็กคานและพื้น' },
            typical_percentage: 15,
            unit: 'item'
        },
        {
            name: { zh: '梁板浇筑', th: 'เทคานและพื้น' },
            description: { zh: '浇筑梁板混凝土', th: 'เทคอนกรีตคานและพื้น' },
            typical_percentage: 15,
            unit: 'cbm'
        }
    ],
    
    'N04_ROOF_FRAME': [
        {
            name: { zh: '屋架安装', th: 'ติดตั้งโครงหลังคา' },
            description: { zh: '钢结构屋架', th: 'โครงเหล็กหลังคา' },
            typical_percentage: 40,
            unit: 'item'
        },
        {
            name: { zh: '屋面板', th: 'แผ่นหลังคา' },
            description: { zh: '铺设屋面板', th: 'ปูแผ่นหลังคา' },
            typical_percentage: 40,
            unit: 'sqm'
        },
        {
            name: { zh: '防水层', th: 'ชั้นกันซึม' },
            description: { zh: '屋面防水', th: 'กันซึมหลังคา' },
            typical_percentage: 20,
            unit: 'sqm'
        }
    ],
    
    'N05_MEP_ROUGH': [
        {
            name: { zh: '给水管', th: 'ท่อประปา' },
            description: { zh: '布置给水管道', th: 'เดินท่อประปา' },
            typical_percentage: 30,
            unit: 'point'
        },
        {
            name: { zh: '排水管', th: 'ท่อระบายน้ำ' },
            description: { zh: '布置排水管道', th: 'เดินท่อระบายน้ำ' },
            typical_percentage: 30,
            unit: 'point'
        },
        {
            name: { zh: '强电线管', th: 'ท่อไฟแรง' },
            description: { zh: '布置电线管', th: 'เดินท่อไฟ' },
            typical_percentage: 25,
            unit: 'point'
        },
        {
            name: { zh: '弱电线管', th: 'ท่อไฟอ่อน' },
            description: { zh: '布置网络线管', th: 'เดินท่อเน็ต' },
            typical_percentage: 15,
            unit: 'point'
        }
    ],
    
    'N06_MEP_HIDDEN': [
        {
            name: { zh: '水管打压', th: 'ทดสอบแรงดันท่อน้ำ' },
            description: { zh: '水压测试', th: 'ทดสอบความดันน้ำ' },
            typical_percentage: 40,
            unit: 'item'
        },
        {
            name: { zh: '电路测试', th: 'ทดสอบวงจรไฟ' },
            description: { zh: '绝缘测试', th: 'ทดสอบฉนวน' },
            typical_percentage: 40,
            unit: 'item'
        },
        {
            name: { zh: '隐蔽验收', th: 'ตรวจรับงานซ่อน' },
            description: { zh: '业主验收', th: 'เจ้าของตรวจรับ' },
            typical_percentage: 20,
            unit: 'item'
        }
    ],
    
    'N07_WATERPROOF': [
        {
            name: { zh: '基层处理', th: 'เตรียมพื้นผิว' },
            description: { zh: '清理找平', th: 'ทำความสะอาดและปรับระดับ' },
            typical_percentage: 20,
            unit: 'sqm'
        },
        {
            name: { zh: '防水涂刷', th: 'ทากันซึม' },
            description: { zh: '涂刷防水层', th: 'ทาชั้นกันซึม' },
            typical_percentage: 50,
            unit: 'sqm'
        },
        {
            name: { zh: '闭水试验', th: 'ทดสอบกันน้ำ' },
            description: { zh: '48小时闭水', th: 'ทดสอบ 48 ชั่วโมง' },
            typical_percentage: 30,
            unit: 'item'
        }
    ],
    
    'N08_WALL_PARTITION': [
        {
            name: { zh: '放线定位', th: 'วางแนวผนัง' },
            description: { zh: '确定墙体位置', th: 'กำหนดตำแหน่งผนัง' },
            typical_percentage: 10,
            unit: 'item'
        },
        {
            name: { zh: '砌筑墙体', th: 'ก่อผนัง' },
            description: { zh: '砌砖或砌块', th: 'ก่ออิฐหรือบล็อก' },
            typical_percentage: 70,
            unit: 'sqm'
        },
        {
            name: { zh: '构造柱', th: 'เสาโครงสร้าง' },
            description: { zh: '浇筑构造柱', th: 'เทเสาโครงสร้าง' },
            typical_percentage: 20,
            unit: 'item'
        }
    ],
    
    'N09_PLASTERING': [
        {
            name: { zh: '墙面抹灰', th: 'ฉาบปูนผนัง' },
            description: { zh: '内外墙抹灰', th: 'ฉาบปูนผนังใน-นอก' },
            typical_percentage: 70,
            unit: 'sqm'
        },
        {
            name: { zh: '地面找平', th: 'ปรับระดับพื้น' },
            description: { zh: '水泥砂浆找平', th: 'ปูนซีเมนต์ปรับระดับ' },
            typical_percentage: 30,
            unit: 'sqm'
        }
    ],
    
    'N10_TILING': [
        {
            name: { zh: '地面铺贴', th: 'ปูกระเบื้องพื้น' },
            description: { zh: '地砖铺贴', th: 'ปูกระเบื้องพื้น' },
            typical_percentage: 50,
            unit: 'sqm'
        },
        {
            name: { zh: '墙面铺贴', th: 'ปูกระเบื้องผนัง' },
            description: { zh: '墙砖铺贴', th: 'ปูกระเบื้องผนัง' },
            typical_percentage: 40,
            unit: 'sqm'
        },
        {
            name: { zh: '美缝处理', th: 'ยาแนว' },
            description: { zh: '勾缝美化', th: 'ยาแนวกระเบื้อง' },
            typical_percentage: 10,
            unit: 'sqm'
        }
    ],
    
    'N11_CEILING': [
        {
            name: { zh: '龙骨安装', th: 'ติดโครงฝ้า' },
            description: { zh: '轻钢龙骨', th: 'โครงเหล็กฝ้า' },
            typical_percentage: 40,
            unit: 'sqm'
        },
        {
            name: { zh: '石膏板', th: 'แผ่นยิปซั่ม' },
            description: { zh: '安装石膏板', th: 'ติดแผ่นยิปซั่ม' },
            typical_percentage: 40,
            unit: 'sqm'
        },
        {
            name: { zh: '批灰打磨', th: 'โป๊วและขัดเรียบ' },
            description: { zh: '接缝处理', th: 'แต่งรอยต่อ' },
            typical_percentage: 20,
            unit: 'sqm'
        }
    ],
    
    'N12_PAINTING': [
        {
            name: { zh: '墙面批灰', th: 'โป๊วผนัง' },
            description: { zh: '腻子找平', th: 'โป๊วปรับระดับ' },
            typical_percentage: 30,
            unit: 'sqm'
        },
        {
            name: { zh: '打磨', th: 'ขัดกระดาษทราย' },
            description: { zh: '砂纸打磨', th: 'ขัดผิวเรียบ' },
            typical_percentage: 20,
            unit: 'sqm'
        },
        {
            name: { zh: '底漆', th: 'สีรองพื้น' },
            description: { zh: '涂刷底漆', th: 'ทาสีรองพื้น' },
            typical_percentage: 20,
            unit: 'sqm'
        },
        {
            name: { zh: '面漆', th: 'สีทับหน้า' },
            description: { zh: '涂刷面漆两遍', th: 'ทาสีทับหน้า 2 ชั้น' },
            typical_percentage: 30,
            unit: 'sqm'
        }
    ],
    
    'N13_DOOR_WINDOW': [
        {
            name: { zh: '门框安装', th: 'ติดวงกบประตู' },
            description: { zh: '固定门框', th: 'ติดตั้งวงกบ' },
            typical_percentage: 30,
            unit: 'item'
        },
        {
            name: { zh: '门扇安装', th: 'ติดบานประตู' },
            description: { zh: '安装门扇五金', th: 'ติดบานและอุปกรณ์' },
            typical_percentage: 30,
            unit: 'item'
        },
        {
            name: { zh: '窗户安装', th: 'ติดหน้าต่าง' },
            description: { zh: '窗框窗扇', th: 'ติดวงกบและบาน' },
            typical_percentage: 30,
            unit: 'item'
        },
        {
            name: { zh: '打胶收口', th: 'ยาซิลิโคน' },
            description: { zh: '密封胶处理', th: 'ซิลิโคนกันน้ำ' },
            typical_percentage: 10,
            unit: 'item'
        }
    ],
    
    'N14_SANITARY': [
        {
            name: { zh: '马桶安装', th: 'ติดตั้งสุขภัณฑ์' },
            description: { zh: '坐便器安装', th: 'ติดตั้งโถส้วม' },
            typical_percentage: 30,
            unit: 'item'
        },
        {
            name: { zh: '洗手盆', th: 'อ่างล้างหน้า' },
            description: { zh: '洗面盆安装', th: 'ติดตั้งอ่างล้างหน้า' },
            typical_percentage: 25,
            unit: 'item'
        },
        {
            name: { zh: '淋浴设备', th: 'ฝักบัว' },
            description: { zh: '花洒龙头', th: 'ติดตั้งฝักบัว' },
            typical_percentage: 25,
            unit: 'item'
        },
        {
            name: { zh: '龙头五金', th: 'ก๊อกน้ำ' },
            description: { zh: '水龙头安装', th: 'ติดตั้งก๊อกน้ำ' },
            typical_percentage: 20,
            unit: 'item'
        }
    ],
    
    'N15_LIGHTING': [
        {
            name: { zh: '灯具安装', th: 'ติดตั้งโคมไฟ' },
            description: { zh: '各类灯具', th: 'โคมไฟทุกชนิด' },
            typical_percentage: 50,
            unit: 'item'
        },
        {
            name: { zh: '开关面板', th: 'สวิตช์' },
            description: { zh: '安装开关插座', th: 'ติดตั้งสวิตช์และเต้าเสียบ' },
            typical_percentage: 40,
            unit: 'item'
        },
        {
            name: { zh: '电路调试', th: 'ทดสอบวงจร' },
            description: { zh: '通电测试', th: 'ทดสอบไฟฟ้า' },
            typical_percentage: 10,
            unit: 'item'
        }
    ],
    
    'N16_CLEANING': [
        {
            name: { zh: '开荒保洁', th: 'ทำความสะอาดครั้งแรก' },
            description: { zh: '全面清洁', th: 'ทำความสะอาดทั่วไป' },
            typical_percentage: 60,
            unit: 'sqm'
        },
        {
            name: { zh: '验收整改', th: 'ตรวจและแก้ไข' },
            description: { zh: '检查并修补', th: 'ตรวจสอบและซ่อม' },
            typical_percentage: 30,
            unit: 'item'
        },
        {
            name: { zh: '交付验收', th: 'ส่งมอบงาน' },
            description: { zh: '业主验收', th: 'เจ้าของตรวจรับ' },
            typical_percentage: 10,
            unit: 'item'
        }
    ]
};

module.exports = { SUBTASK_TEMPLATES };
