// 16个标准工序模板（中泰双语）
const STANDARD_PROCESSES = [
    {
        code: 'N01_EXCAVATION',
        name: { zh: '土方开挖', th: 'ขุดดิน' },
        sequence: 1,
        typical_duration: 3, // 典型工期（天）
        typical_unit: 'cubic_meter' // 立方米
    },
    {
        code: 'N02_FOUNDATION',
        name: { zh: '地基浇筑', th: 'เทฐานราก' },
        sequence: 2,
        typical_duration: 5,
        typical_unit: 'cubic_meter'
    },
    {
        code: 'N03_STRUCTURE',
        name: { zh: '主体框架', th: 'โครงสร้างหลัก' },
        sequence: 3,
        typical_duration: 15,
        typical_unit: 'square_meter'
    },
    {
        code: 'N04_ROOF_FRAME',
        name: { zh: '屋面封顶', th: 'มุงหลังคา' },
        sequence: 4,
        typical_duration: 5,
        typical_unit: 'square_meter'
    },
    {
        code: 'N05_MEP_ROUGH',
        name: { zh: '水电布管', th: 'เดินท่อน้ำและไฟ' },
        sequence: 5,
        typical_duration: 7,
        typical_unit: 'point' // 点位
    },
    {
        code: 'N06_MEP_HIDDEN',
        name: { zh: '水电隐蔽工程', th: 'ตรวจงานซ่อนน้ำไฟ' },
        sequence: 6,
        typical_duration: 2,
        typical_unit: 'point'
    },
    {
        code: 'N07_WATERPROOF',
        name: { zh: '防水工程', th: 'งานกันซึม' },
        sequence: 7,
        typical_duration: 3,
        typical_unit: 'square_meter'
    },
    {
        code: 'N08_WALL_PARTITION',
        name: { zh: '砌墙隔断', th: 'ก่อผนัง' },
        sequence: 8,
        typical_duration: 7,
        typical_unit: 'square_meter'
    },
    {
        code: 'N09_PLASTERING',
        name: { zh: '泥瓦抹灰', th: 'ฉาบปูน' },
        sequence: 9,
        typical_duration: 10,
        typical_unit: 'square_meter'
    },
    {
        code: 'N10_TILING',
        name: { zh: '瓷砖铺贴', th: 'ปูกระเบื้อง' },
        sequence: 10,
        typical_duration: 8,
        typical_unit: 'square_meter'
    },
    {
        code: 'N11_CEILING',
        name: { zh: '木工吊顶', th: 'ทำฝ้าเพดาน' },
        sequence: 11,
        typical_duration: 6,
        typical_unit: 'square_meter'
    },
    {
        code: 'N12_PAINTING',
        name: { zh: '油漆涂刷', th: 'ทาสี' },
        sequence: 12,
        typical_duration: 8,
        typical_unit: 'square_meter'
    },
    {
        code: 'N13_DOOR_WINDOW',
        name: { zh: '门窗安装', th: 'ติดตั้งประตูหน้าต่าง' },
        sequence: 13,
        typical_duration: 4,
        typical_unit: 'piece' // 件
    },
    {
        code: 'N14_SANITARY',
        name: { zh: '洁具安装', th: 'ติดตั้งสุขภัณฑ์' },
        sequence: 14,
        typical_duration: 3,
        typical_unit: 'piece'
    },
    {
        code: 'N15_LIGHTING',
        name: { zh: '灯具开关', th: 'ติดตั้งไฟและสวิตช์' },
        sequence: 15,
        typical_duration: 3,
        typical_unit: 'piece'
    },
    {
        code: 'N16_CLEANING',
        name: { zh: '清洁验收', th: 'ทำความสะอาดและตรวจรับ' },
        sequence: 16,
        typical_duration: 2,
        typical_unit: 'square_meter'
    }
];

module.exports = { STANDARD_PROCESSES };
