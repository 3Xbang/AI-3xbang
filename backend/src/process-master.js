// 工序总库 + 先后规则 + 按项目申请表生成计划
// 对应文档：PROCESS_MASTER_LIBRARY.md
//
// 用法：
//   const { generatePlan } = require('./process-master');
//   const plan = generatePlan({ floors: 2, roof: 'flat', ... });
//   plan.tasks  -> [{ key:'C01@1', code:'C01', floor:1, zh, th, unit, section }]
//   plan.deps   -> [{ from:'C06@1', to:'C01@2', type:'FS', lag:7, min:0 }]
//
// 说明：养护天数、搭接比例都是常规值，待现场确认（见各规则的 lag / min）。
// 目前只支持钢筋混凝土框架结构（structure = 'rc_frame'）。

const SECTIONS = {
  A: { zh: '前期准备', th: null },
  B: { zh: '地基与基础', th: null },
  C: { zh: '主体结构', th: null },
  D: { zh: '屋面', th: null },
  E: { zh: '机电', th: null },
  F: { zh: '装饰装修', th: null },
  G: { zh: '外立面', th: null },
  H: { zh: '室外工程', th: null },
  I: { zh: '验收与交付', th: null }
};

// ---------- 前置规则写法 ----------
// scope（前置工序相对于本工序的楼层）：
//   same  同一层              below 下面一层（1 层没有则忽略）
//   first 第 1 层/唯一一条（本工序是每层任务时，只对第 1 层生效）
//   top   最高一层            all   所有楼层
//   once  前置是整栋只做一次的工序
// type: FS 前置完成后才能开始；SS 前置开始并达到 min% 后即可开始
// lag : 前置完成（或达到比例）后再等待的天数
const P = (code, scope = 'same', o = {}) => ({
  code, scope, type: o.type || 'FS', lag: o.lag || 0, min: o.min || 0
});
const SS = (code, min = 50, scope = 'same') => P(code, scope, { type: 'SS', min });

// ---------- 条件写法 ----------
// null = 必选；{k,is} {k,not} {k,in} {k,gt} {all:[]} {any:[]}
const is = (k, v) => ({ k, is: v });
const not = (k, v) => ({ k, not: v });
const inn = (k, arr) => ({ k, in: arr });
const gt = (k, n) => ({ k, gt: n });
// 按楼层判断的条件：fk 是这一层自己的信息（wet 湿区数、bathrooms、kitchens、balconies、stairs_up）
const fgt = (fk, n) => ({ fk, gt: n });
const fis = (fk, v) => ({ fk, is: v });

// ---------- 工序总库 ----------
// D(编码, 中文, 泰文, 分部, 范围 each|once, 主单位, 条件, 前置[], 现有编码[])
const LIB = {};
function D(code, zh, th, sec, scope, unit, cond, preds, legacy, floorCond) {
  LIB[code] = { code, zh, th, sec, scope, unit, cond: cond || null, preds: preds || [], legacy: legacy || [], floorCond: floorCond || null };
}

// A 前期准备
D('A01', '施工放线与定位', null, 'A', 'once', '项', null, []);
D('A02', '临时设施（围挡、工棚、临水临电）', null, 'A', 'once', '项', null, []);
D('A03', '场地清理与平整', 'ปรับระดับพื้นที่', 'A', 'once', 'm²', null, [P('A01', 'once'), P('A02', 'once')], ['FND-01-01']);

// B 地基与基础
D('B01', '基坑开挖', 'ขุดหลุมฐานราก', 'B', 'once', 'm³', null, [P('A03', 'once')], ['FND-01-02', 'N01_EXCAVATION']);
D('B02', '桩基施工与检测', null, 'B', 'once', '根', is('foundation', 'pile'), [P('B01', 'once')]);
D('B03', '地基处理（换填夯实）', 'บำบัดชั้นดิน', 'B', 'once', 'm²', is('soft_soil', true), [P('B01', 'once')], ['FND-01-03']);
D('B04', '混凝土垫层', 'ชั้นคอนกรีตรอง', 'B', 'once', 'm³', null, [P('B01', 'once'), P('B02', 'once'), P('B03', 'once')], ['FND-01-04']);
D('B05', '基础防水', 'กันซึมฐานราก', 'B', 'once', 'm²',
  { any: [is('basement', true), is('high_water', true)] }, [P('B04', 'once')], ['FND-01-05']);
D('B06', '基础钢筋绑扎', null, 'B', 'once', 't', null, [P('B04', 'once'), P('B05', 'once')]);
D('B07', '基础模板', null, 'B', 'once', 'm²', null, [P('B04', 'once')]);
D('B08', '基础混凝土浇筑', 'เทคอนกรีตฐานราก', 'B', 'once', 'm³', null, [P('B06', 'once'), P('B07', 'once')], ['FND-01-06', 'N02_FOUNDATION']);
D('B09', '基础养护与拆模', null, 'B', 'once', '项', null, [P('B08', 'once', { lag: 7 })]);
D('B10', '基坑回填', null, 'B', 'once', 'm³', null, [P('B09', 'once')]);
D('B11', '地下室结构', null, 'B', 'once', 'm³', is('basement', true), [P('B08', 'once')]);

// C 主体结构（按层）
D('C12', '脚手架搭设与拆除', null, 'C', 'each', 'm²', null, [P('B09', 'first'), P('C06', 'below')]);
D('C01', '柱钢筋绑扎', 'ผูกเหล็กเสา', 'C', 'each', 't', null,
  [P('C12'), P('B09', 'first'), P('B11', 'first'), P('C06', 'below', { lag: 7 })], ['STR-02-01']);
D('C02', '柱模板安装', 'แบบหล่อเสา', 'C', 'each', 'm²', null, [SS('C01', 50)], ['STR-02-02']);
D('C03', '柱混凝土浇筑', 'เทคอนกรีตเสา', 'C', 'each', 'm³', null, [P('C01'), P('C02')], ['STR-02-03']);
D('C04', '梁板模板安装', 'แบบหล่อคาน-พื้น', 'C', 'each', 'm²', null, [P('C03', 'same', { lag: 2 })], ['STR-02-05']);
D('C05', '梁板钢筋绑扎', 'ผูกเหล็กคาน-พื้น', 'C', 'each', 't', null, [P('C04')], ['STR-02-04']);
D('C06', '梁板混凝土浇筑', 'เทคอนกรีตคาน-พื้น', 'C', 'each', 'm³', null, [P('C05'), P('E01')], ['STR-02-06']);
D('C07', '梁板养护与拆模', null, 'C', 'each', '项', null, [P('C06', 'same', { lag: 14 })]);
D('C08', '楼梯施工', 'บันได', 'C', 'each', '步', gt('stairs', 0), [P('C04')], ['STR-02-07'], fis('stairs_up', true));
D('C09', '砖墙/砌块砌筑', 'ก่ออิฐ', 'C', 'each', 'm³', null, [P('C07')], ['MAS-03-01', 'N08_WALL_PARTITION']);
D('C10', '构造柱施工', 'เสาโครงสร้าง', 'C', 'each', 'm³', null, [SS('C09', 50)], ['MAS-03-02']);
D('C11', '圈梁与过梁', 'คานวงแหวน', 'C', 'each', 'm', null, [P('C09')], ['MAS-03-03']);
D('C13', '阳台、雨棚、挑檐', null, 'C', 'each', 'm²', gt('balconies', 0), [SS('C04', 30)], [], fgt('balconies', 0));

// D 屋面
D('D01', '屋面结构层（平屋面）', 'โครงสร้างหลังคา', 'D', 'once', 'm²', inn('roof', ['flat', 'both']), [P('C06', 'top')], ['STR-02-08', 'N04_ROOF_FRAME']);
D('D02', '屋架安装（坡屋面，钢/木）', null, 'D', 'once', 'm²', inn('roof', ['pitched', 'both']), [P('C07', 'top')]);
D('D03', '屋面找坡找平', null, 'D', 'once', 'm²', null, [P('D01', 'once'), P('D02', 'once')]);
D('D04', '屋面保温隔热', null, 'D', 'once', 'm²', is('roof_insulation', true), [P('D03', 'once')]);
D('D05', '屋面防水', 'กันซึมหลังคา', 'D', 'once', 'm²', null, [P('D03', 'once'), P('D04', 'once')], ['STR-02-09']);
D('D06', '屋面面层（瓦/地砖/涂料）', null, 'D', 'once', 'm²', null, [P('D05', 'once')]);
D('D07', '屋面排水（天沟、落水管）', null, 'D', 'once', 'm', null, [P('D06', 'once')]);
D('D08', '屋面蓄水或淋水试验', null, 'D', 'once', '项', null, [P('D05', 'once', { lag: 2 })]);

// E 机电
D('E01', '梁板内水电预埋', null, 'E', 'each', 'm²', null, [P('C04')]);
D('E14', '墙体开槽布管预埋（线管、86盒）', 'เดินท่อน้ำและไฟ', 'E', 'each', 'm²', null, [SS('C09', 50)], ['N05_MEP_ROUGH']);
D('E02', '空调管线预埋', null, 'E', 'each', '点', inn('aircon', ['split', 'central']), [SS('C09', 50)]);
D('E03', '给水管道安装', 'ติดตั้งท่อน้ำประปา', 'E', 'each', 'm', null, [P('E14')], ['MEP-06-01'], fgt('wet', 0));
D('E04', '排水管道安装', 'ติดตั้งท่อระบายน้ำ', 'E', 'each', 'm', null, [P('E14')], ['MEP-06-02'], fgt('wet', 0));
D('E05', '强电线路敷设与穿线', 'เดินสายไฟ', 'E', 'each', 'm', null, [P('E14'), P('F02')], ['MEP-06-03']);
D('E06', '弱电线路敷设', 'เดินสายสัญญาณ', 'E', 'each', 'm', null, [P('E14'), P('F02')], ['MEP-06-04']);
D('E07', '配电箱及总配电安装', null, 'E', 'once', '套', null, [P('F02', 'first')]);
D('E08', '水电隐蔽验收', 'ตรวจงานซ่อนน้ำไฟ', 'E', 'each', '项', null,
  [P('E01'), P('E14'), P('E03'), P('E04'), P('E02')], ['N06_MEP_HIDDEN']);
D('E09', '防雷与接地', null, 'E', 'once', '项', null, [P('C07', 'top')]);
D('E10', '水泵、水箱安装', null, 'E', 'once', '套', is('water_supply', 'tank'), [P('E03', 'first')]);
D('E11', '热水系统安装', null, 'E', 'each', '套', not('hot_water', 'none'), [P('E03'), P('F04')], [], fgt('wet', 0));
D('E12', '空调设备安装', null, 'E', 'each', '台', inn('aircon', ['split', 'central']), [P('E02'), P('F15'), P('F16')]);
D('E13', '电梯安装', null, 'E', 'once', '台', is('elevator', true), [P('C07', 'top')]);

// F 装饰装修（按层）
D('F01', '墙面基层处理', 'เตรียมผิวผนัง', 'F', 'each', 'm²', null, [P('C09'), P('E08')], ['FIN-01-01']);
D('F02', '内墙抹灰', 'ฉาบปูนผนังใน', 'F', 'each', 'm²', null, [P('F01')], ['FIN-01-02', 'N09_PLASTERING']);
D('F03', '天花抹灰', 'ฉาบปูนเพดาน', 'F', 'each', 'm²', null, [P('F01')], ['FIN-01-04']);
D('F04', '卫生间、厨房、阳台防水', 'กันซึมห้องน้ำ', 'F', 'each', 'm²', gt('wet_rooms', 0), [P('E04'), P('F02')], ['SAN-07-01', 'N07_WATERPROOF'], fgt('wet', 0));
D('F05', '闭水试验', null, 'F', 'each', '项', gt('wet_rooms', 0), [P('F04', 'same', { lag: 2 })], [], fgt('wet', 0));
D('F06', '地面找平层', 'ปรับระดับพื้น', 'F', 'each', 'm²', null, [P('F05'), P('F02')], ['FLR-02-01']);
D('F07', '墙砖铺贴', 'ปูกระเบื้องผนัง', 'F', 'each', 'm²', gt('wet_rooms', 0), [P('F05')], ['WAL-04-04'], fgt('wet', 0));
D('F08', '地砖铺贴', 'ปูกระเบื้องพื้น', 'F', 'each', 'm²', null, [P('F06', 'same', { lag: 3 }), P('F07')], ['FLR-02-02', 'N10_TILING']);
D('F09', '石材地面', 'ปูหินพื้น', 'F', 'each', 'm²', is('floor_finish', 'stone'), [P('F06')], ['FLR-02-04']);
D('F10', '吊顶龙骨', 'โครงเหล็กเพดาน', 'F', 'each', 'm²', not('ceiling', 'none'), [P('F02'), P('E05'), P('F03')], ['CLG-03-01', 'N11_CEILING']);
D('F11', '石膏板吊顶', 'เพดานยิปซั่ม', 'F', 'each', 'm²', inn('ceiling', ['gypsum', 'aluminum_wet']), [P('F10')], ['CLG-03-02']);
D('F12', '铝扣板吊顶（厨卫）', 'เพดานอลูมิเนียม', 'F', 'each', 'm²', is('ceiling', 'aluminum_wet'), [P('F10')], ['CLG-03-03']);
D('F13', '墙面找平', 'ปรับระดับผนัง', 'F', 'each', 'm²', null, [P('F02', 'same', { lag: 7 })], ['WAL-04-01']);
D('F14', '腻子批刮', 'โป๊วผนัง', 'F', 'each', 'm²', null, [P('F13'), P('F11'), P('F12')], ['WAL-04-02']);
D('F15', '乳胶漆涂刷', 'ทาสีน้ำ', 'F', 'each', 'm²', inn('wall_finish', ['paint', 'mixed']), [P('F14')], ['WAL-04-03', 'N12_PAINTING']);
D('F16', '墙纸粘贴', 'ติดวอลเปเปอร์', 'F', 'each', 'm²', inn('wall_finish', ['wallpaper', 'mixed']), [P('F14')], ['WAL-04-05']);
D('F17', '木地板安装', 'ปูพื้นไม้', 'F', 'each', 'm²', is('floor_finish', 'wood'), [P('F15'), P('F16')], ['FLR-02-03']);
D('F18', '门窗框安装', 'ติดตั้งวงกบ', 'F', 'each', '樘', null, [P('C09')], ['DOR-05-01', 'N13_DOOR_WINDOW']);
D('F19', '门扇安装', 'ติดตั้งบานประตู', 'F', 'each', '樘', null, [P('F15'), P('F16')], ['DOR-05-02']);
D('F20', '窗扇安装', 'ติดตั้งบานหน้าต่าง', 'F', 'each', '樘', null, [P('F18')], ['DOR-05-03']);
D('F21', '玻璃安装', 'ติดตั้งกระจก', 'F', 'each', 'm²', null, [P('F20')], ['DOR-05-04']);
D('F22', '入户门与防盗门安装', null, 'F', 'once', '樘', null, [P('F02', 'first')]);
D('F23', '踢脚线', null, 'F', 'each', 'm', null, [P('F17'), P('F08')]);
D('F24', '楼梯栏杆与扶手', null, 'F', 'each', 'm', gt('stairs', 0), [P('C08'), P('F15'), P('F16')], [], fis('stairs_up', true));
D('F25', '固定家具/衣柜', null, 'F', 'each', 'm', is('fixed_furniture', true), [P('F15'), P('F16')]);
D('F26', '卫生洁具安装', 'ติดตั้งสุขภัณฑ์', 'F', 'each', '套', gt('bathrooms_total', 0), [P('F07'), P('F08'), P('F15'), P('F16')], ['SAN-07-02', 'N14_SANITARY'], fgt('bathrooms', 0));
D('F27', '淋浴房安装', 'ติดตั้งฝักบัว', 'F', 'each', '套', is('shower_room', true), [P('F26')], ['SAN-07-03'], fgt('bathrooms', 0));
D('F28', '橱柜安装', 'ติดตั้งตู้ครัว', 'F', 'each', 'm', is('cabinet', true), [P('F08'), P('F15'), P('F16')], ['KIT-07-04'], fgt('kitchens', 0));
D('F29', '台面安装', 'ติดตั้งเคาน์เตอร์', 'F', 'each', 'm', is('cabinet', true), [P('F28')], ['KIT-07-05'], fgt('kitchens', 0));
D('F30', '灯具安装', 'ติดตั้งโคมไฟ', 'F', 'each', '盏', null, [P('F15'), P('F16'), P('E05')], ['MEP-06-05', 'N15_LIGHTING']);
D('F31', '开关插座安装', 'ติดตั้งสวิตช์ปลั๊ก', 'F', 'each', '个', null, [P('F15'), P('F16'), P('E05')], ['MEP-06-06']);

// G 外立面
D('G05', '外墙吊篮或外脚手', null, 'G', 'once', 'm²', null, [P('C07', 'first')]);
D('G01', '外墙抹灰', 'ฉาบปูนผนังนอก', 'G', 'each', 'm²', null, [P('C09'), P('F18'), P('G05', 'once')], ['FIN-01-03']);
D('G02', '外墙保温', null, 'G', 'each', 'm²', is('exterior_insulation', true), [P('G01')]);
D('G03', '外墙面层（涂料/外墙砖/石材）', null, 'G', 'each', 'm²', null, [P('G01', 'same', { lag: 7 }), P('G02')]);
D('G04', '外门窗收口与打胶', null, 'G', 'each', 'm', null, [P('G03')]);

// H 室外工程
D('H01', '化粪池与污水处理', null, 'H', 'once', '套', null, [P('B10', 'once')]);
D('H02', '室外给排水管网', null, 'H', 'once', 'm', null, [P('H01', 'once')]);
D('H03', '围墙与大门', null, 'H', 'once', 'm', is('fence', true), [P('G04', 'top')]);
D('H04', '道路与铺装', null, 'H', 'once', 'm²', is('road', true), [P('H02', 'once')]);
D('H05', '庭院景观与绿化', null, 'H', 'once', 'm²', is('landscape', true), [P('H04', 'once'), P('H02', 'once')]);
D('H06', '泳池', null, 'H', 'once', '项', is('pool', true), [P('B10', 'once')]);

// I 验收与交付
D('I01', '分层竣工检查与整改清单', null, 'I', 'each', '项', null,
  [P('F26'), P('F30'), P('F31'), P('F19'), P('F21'), P('F23'), P('G04')]);
D('I02', '竣工清洁', 'ทำความสะอาดและตรวจรับ', 'I', 'once', 'm²', null, [P('I01', 'all')], ['N16_CLEANING']);
D('I03', '竣工验收与移交', null, 'I', 'once', '项', null, [P('I02', 'once')]);
D('I04', '整改与保修登记', null, 'I', 'once', '项', null, [P('I03', 'once')]);

// ---------- 项目申请表答案（含默认值） ----------
const DEFAULT_PROFILE = {
  structure: 'rc_frame',      // rc_frame 钢筋混凝土框架（目前仅支持这个）
  floors: 2,                  // 地上层数
  attic: false,               // 阁楼/夹层，算一层
  basement: false,            // 地下室
  total_area: null,           // 总建筑面积 m²（本步骤不用）
  roof: 'flat',               // flat | pitched | both
  roof_insulation: true,
  stairs: 1,                  // 室内楼梯部数
  balconies: 0,
  bathrooms: 2,               // 每层卫生间数
  kitchens: 1,
  floor_finish: 'tile',       // tile | wood | stone（客厅、卧室）
  wall_finish: 'paint',       // paint | wallpaper | mixed
  ceiling: 'gypsum',          // none | gypsum | aluminum_wet
  cabinet: true,
  shower_room: true,
  fixed_furniture: false,
  exterior_finish: 'paint',   // paint | tile | stone | mixed（G03 内容，不影响工序有无）
  exterior_insulation: false,
  aircon: 'split',            // none | split | central
  hot_water: 'electric',      // none | electric | solar | heatpump
  elevator: false,
  water_supply: 'direct',     // direct | tank
  pool: false,
  fence: true,
  road: true,
  landscape: true,
  sewage: 'septic',           // septic | municipal
  foundation: 'isolated',     // isolated | strip | raft | pile
  soft_soil: false,
  high_water: false
};

// 每层自己的信息：哪几层有卫生间、厨房、阳台、楼梯。
// 可以在申请表里逐层填：bathrooms_by_floor、kitchen_floors、balconies_by_floor；
// 不填时的默认：每层 bathrooms 个卫生间；厨房只在 1 层；阳台放在 2 层及以上（只有 1 层时放在 1 层）；
// 楼梯：每一层（除了最高层）都有一跑楼梯通向上一层。
function floorInfoOf(p) {
  const N = p.floorCount, info = {};
  // 阳台默认平均放在 2 层及以上（只有 1 层时放在 1 层），多出来的从低层开始多放一个，总数保持不变
  const total = Math.max(0, Math.floor(Number(p.balconies) || 0));
  const eligible = N === 1 ? [1] : Array.from({ length: N - 1 }, (_, i) => i + 2);
  const base = Math.floor(total / eligible.length), extra = total % eligible.length;
  for (let f = 1; f <= N; f++) {
    const bathrooms = Array.isArray(p.bathrooms_by_floor) ? Number(p.bathrooms_by_floor[f - 1]) || 0 : Number(p.bathrooms) || 0;
    const kitchenFloors = Array.isArray(p.kitchen_floors) ? p.kitchen_floors : [1];
    const kitchens = kitchenFloors.includes(f) ? (Number(p.kitchens) || 0) : 0;
    const idx = eligible.indexOf(f);
    const balconies = Array.isArray(p.balconies_by_floor)
      ? Number(p.balconies_by_floor[f - 1]) || 0
      : (idx === -1 ? 0 : base + (idx < extra ? 1 : 0));
    info[f] = { bathrooms, kitchens, balconies, wet: bathrooms + kitchens, stairs_up: Number(p.stairs) > 0 && f < N };
  }
  return info;
}

function normalizeProfile(input) {
  const p = Object.assign({}, DEFAULT_PROFILE, input || {});
  if (p.structure !== 'rc_frame') {
    throw new Error(`暂不支持的结构形式：${p.structure}（目前仅支持 rc_frame 钢筋混凝土框架）`);
  }
  p.floors = parseInt(p.floors, 10);
  if (!(p.floors >= 1 && p.floors <= 10)) throw new Error('地上层数必须在 1 到 10 之间');
  p.floorCount = p.floors + (p.attic ? 1 : 0);
  p.floorInfo = floorInfoOf(p);
  const infos = Object.values(p.floorInfo);
  p.bathrooms_total = infos.reduce((a, x) => a + x.bathrooms, 0);
  p.wet_rooms = infos.reduce((a, x) => a + x.wet, 0);
  p.balconies = infos.reduce((a, x) => a + x.balconies, 0);
  return p;
}

// cond 里写 k 的看整个项目的答案；写 fk 的看这一层自己的信息（fi）
function evalCond(cond, p, fi) {
  if (!cond) return true;
  if (cond.all) return cond.all.every(c => evalCond(c, p, fi));
  if (cond.any) return cond.any.some(c => evalCond(c, p, fi));
  let v;
  if ('fk' in cond) {
    if (!fi) return true;                 // 整栋只做一次的工序没有楼层信息，不按楼层过滤
    v = fi[cond.fk];
  } else v = p[cond.k];
  if ('is' in cond) return v === cond.is;
  if ('not' in cond) return v !== cond.not;
  if ('in' in cond) return cond.in.includes(v);
  if ('gt' in cond) return Number(v) > cond.gt;
  throw new Error('未知条件：' + JSON.stringify(cond));
}

// ---------- 生成 ----------
function generatePlan(input) {
  const p = normalizeProfile(input);
  const N = p.floorCount;
  const allFloors = Array.from({ length: N }, (_, i) => i + 1);
  const keyOf = (code, floor) => (floor == null ? code : `${code}@${floor}`);

  const present = {};
  Object.values(LIB).forEach(d => { present[d.code] = evalCond(d.cond, p); });

  // 1. 任务（每层的工序还要通过「这一层」的条件，比如这层有没有卫生间）
  const tasks = [];
  const taskKeys = new Set();
  Object.values(LIB).forEach(d => {
    if (!present[d.code]) return;
    const floors = d.scope === 'each' ? allFloors : [null];
    floors.forEach(f => {
      if (f != null && !evalCond(d.floorCond, p, p.floorInfo[f])) return;
      const key = keyOf(d.code, f);
      taskKeys.add(key);
      tasks.push({
        key, code: d.code, floor: f, zh: d.zh, th: d.th, unit: d.unit,
        section: d.sec, legacy: d.legacy, floorLabel: f == null ? null : `${f}F`
      });
    });
  });
  const codesGenerated = new Set(tasks.map(t => t.code));

  // 2. 先后关系（前置工序不存在时，顺延到它自己的前置）
  function resolve(succ, rule, depth = 0) {
    if (depth > 20) throw new Error(`规则循环展开：${succ.code} <- ${rule.code}`);
    const def = LIB[rule.code];
    if (!def) throw new Error(`规则引用了不存在的工序：${succ.code} <- ${rule.code}`);
    let floors;
    if (def.scope === 'once') {
      if (rule.scope === 'first' && succ.floor != null && succ.floor !== 1) return [];
      floors = [null];
    } else {
      switch (rule.scope) {
        case 'same':
          if (succ.floor == null) throw new Error(`整栋工序 ${succ.code} 不能用 same 引用每层工序 ${rule.code}`);
          floors = [succ.floor]; break;
        case 'below': floors = succ.floor > 1 ? [succ.floor - 1] : []; break;
        case 'first':
          if (succ.floor != null && succ.floor !== 1) return [];
          floors = [1]; break;
        case 'top': floors = [N]; break;
        case 'all': floors = allFloors; break;
        default: throw new Error(`规则范围不适用：${succ.code} <- ${rule.code} (${rule.scope})`);
      }
    }
    const out = [];
    floors.forEach(fl => {
      if (taskKeys.has(keyOf(rule.code, fl))) {
        out.push({ from: keyOf(rule.code, fl), type: rule.type, lag: rule.lag, min: rule.min });
      } else {
        def.preds.forEach(r2 => {
          out.push(...resolve({ code: rule.code, floor: fl }, r2, depth + 1));
        });
      }
    });
    return out;
  }

  const depMap = new Map();
  tasks.forEach(t => {
    LIB[t.code].preds.forEach(rule => {
      resolve({ code: t.code, floor: t.floor }, rule).forEach(d => {
        if (!taskKeys.has(d.from)) throw new Error(`前置任务不存在：${d.from} -> ${t.key}`);
        if (d.from === t.key) return;
        const id = `${d.from}>${t.key}`;
        const old = depMap.get(id);
        if (!old || d.lag > old.lag) depMap.set(id, { from: d.from, to: t.key, type: d.type, lag: d.lag, min: d.min });
      });
    });
  });
  const deps = Array.from(depMap.values());

  return { profile: p, tasks, deps, excluded: Object.keys(LIB).filter(c => !codesGenerated.has(c)) };
}

// 检查：无环，并返回拓扑分层（level 越小越先做）
function analyze(plan) {
  const indeg = new Map(plan.tasks.map(t => [t.key, 0]));
  const out = new Map(plan.tasks.map(t => [t.key, []]));
  plan.deps.forEach(d => { indeg.set(d.to, indeg.get(d.to) + 1); out.get(d.from).push(d.to); });
  const level = new Map();
  let queue = plan.tasks.filter(t => indeg.get(t.key) === 0).map(t => t.key);
  queue.forEach(k => level.set(k, 0));
  let visited = 0;
  while (queue.length) {
    const k = queue.shift();
    visited++;
    out.get(k).forEach(n => {
      level.set(n, Math.max(level.get(n) || 0, level.get(k) + 1));
      indeg.set(n, indeg.get(n) - 1);
      if (indeg.get(n) === 0) queue.push(n);
    });
  }
  const hasCycle = visited !== plan.tasks.length;
  const maxLevel = Math.max(...level.values());
  return { hasCycle, level, maxLevel, starts: plan.tasks.filter(t => !plan.deps.some(d => d.to === t.key)).map(t => t.key) };
}

module.exports = { LIB, SECTIONS, DEFAULT_PROFILE, generatePlan, analyze, normalizeProfile };
