/* ============================================================
   boq-engine.js — 工程算量 & 造价估算引擎
   集成于 Mira Villa 施工管理系统
   所有代码封装在 BOQ 命名空间，不污染全局
   依据: GB 50010 | GB 50011 | GB 50108 | GB 50854 | GB 50500
   ============================================================ */
(function(window) {
'use strict';

// ══════════════════════════════════════════════════════════════
// 1. 常量层 (Constants)
// ══════════════════════════════════════════════════════════════
const NORM_REFS = {
  seismic:       { icon:'📐', title:'抗震等级 & 含钢量系数',         refs:['GB 50011-2010','GB 50010-2010','16G101'],                     detail:'抗震等级影响箍筋加密区及锚固长度，综合含钢量系数据此推导。' },
  concreteGrade: { icon:'🏗️', title:'混凝土强度等级底线',            refs:['GB 50010-2010 第4.1.2条'],                                    detail:'主体结构≥C25；框架柱≥C30；挡土墙/地下室需≥C30且抗渗P6/P8。' },
  lossRate:      { icon:'📊', title:'材料损耗率定额',                  refs:['GB 50500-2013','全国统一消耗量定额'],                          detail:'钢筋损耗率≥1.5%；混凝土损耗率≥1.0%。低于此值属不合理定额。' },
  quantityCalc:  { icon:'📏', title:'工程量计算规则',                  refs:['GB 50854-2013 附录A'],                                        detail:'砼按实体体积；模板按接触面积：柱=周长×高，梁=底+两侧，墙=双面，板=底面。' },
  waterproof:    { icon:'💧', title:'防水 & 止水构造强制要求',         refs:['GB 50108-2008 第4.1.2条、第5.2条'],                           detail:'施工缝处必须设止水钢板(300mm×2mm)；对拉螺栓须加止水片@500mm设置。' },
  localPrice:    { icon:'💰', title:'本地化单价参考来源',              refs:['泰国SCG建材市场指导价','King Engineering实际项目账单'],         detail:'单价区间仅作参考，不含税费、运费及施工管理费。' },
  steelRatio:    { icon:'🔩', title:'含钢量底线（最小配筋率）',        refs:['GB 50010-2010 第8.5条','GB 50011-2010 抗震构造'],              detail:'含钢量为综合指标，涵盖主筋、箍筋、腰筋等，实际以结构施工图为准。' },
};
const SEISMIC_FACTORS = {
  '1':{ label:'一级', factor:1.15, desc:'一级抗震，综合用钢量系数×1.15' },
  '2':{ label:'二级', factor:1.05, desc:'二级抗震，综合用钢量系数×1.05' },
  '3':{ label:'三级', factor:1.00, desc:'三级抗震，系数×1.00（基准值）' },
  '4':{ label:'四级', factor:0.95, desc:'四级抗震，系数×0.95' },
};
// Universal minimum steel content for residential buildings ≤5 stories
// Standard: ACI 318 / EIT Thailand / GB50010
const STEEL_SAFETY_MIN = {
  retainingWall:   160,  // kg/m³ — ACI 318 + seismic zone requirement
  basementWall:    160,  // kg/m³
  shearWall:       140,  // kg/m³ — ρ≥0.12% vertical + 0.20% horizontal
  column:          160,  // kg/m³ — ρ≥1.0% longitudinal (ACI 318 §18.7.4)
  beam:            130,  // kg/m³ — ρ≥0.36% (ACI 318 §9.6.1)
  slab:            100,  // kg/m³ — ρ≥0.18% temperature/shrinkage (ACI 318 §24.4.3)
  foundation:      120,  // kg/m³ — conservative footing minimum
};
const STEEL_SAFETY_BY_FLOOR = {
  1: { retainingWall:120, basementWall:120, shearWall:110, column:120, beam:100, slab:80,  foundation:100 },
  2: { retainingWall:130, basementWall:130, shearWall:120, column:130, beam:110, slab:90,  foundation:110 },
  3: { retainingWall:140, basementWall:140, shearWall:130, column:140, beam:120, slab:95,  foundation:115 },
  4: { retainingWall:150, basementWall:150, shearWall:135, column:150, beam:125, slab:100, foundation:118 },
  5: { retainingWall:160, basementWall:160, shearWall:140, column:160, beam:130, slab:100, foundation:120 },
};
window._boqFloors = parseInt(localStorage.getItem('boqFloors') || '2', 10);

function boqSetFloors(n) {
  window._boqFloors = n;
  localStorage.setItem('boqFloors', n);
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById('boq-fl-' + i);
    if (btn) btn.classList.toggle('boq-fl-active', i === n);
  }
  _recalcRender();
}
window.boqSetFloors = boqSetFloors;

const SAFETY_BASELINES = {
  steelRatio: {
    retainingWall:{ min:STEEL_SAFETY_MIN.retainingWall, warn:`挡土墙含钢量<${STEEL_SAFETY_MIN.retainingWall} kg/m³，低于5层以下住宅最低标准 (ACI318/EIT) Below min for ≤5-storey residential` },
    basementWall: { min:STEEL_SAFETY_MIN.basementWall,  warn:`地下室墙含钢量<${STEEL_SAFETY_MIN.basementWall} kg/m³，低于5层以下住宅最低标准 (ACI318/EIT) Below min for ≤5-storey residential` },
    shearWall:    { min:STEEL_SAFETY_MIN.shearWall,     warn:`剪力墙含钢量<${STEEL_SAFETY_MIN.shearWall} kg/m³，低于5层以下住宅最低标准 (ACI318/EIT) Below min for ≤5-storey residential` },
    column:       { min:STEEL_SAFETY_MIN.column,        warn:`框架柱含钢量<${STEEL_SAFETY_MIN.column} kg/m³，低于5层以下住宅最低标准 (ACI318/EIT) Below min for ≤5-storey residential` },
    beam:         { min:STEEL_SAFETY_MIN.beam,          warn:`框架梁含钢量<${STEEL_SAFETY_MIN.beam} kg/m³，低于5层以下住宅最低标准 (ACI318/EIT) Below min for ≤5-storey residential` },
    slab:         { min:STEEL_SAFETY_MIN.slab,          warn:`楼板含钢量<${STEEL_SAFETY_MIN.slab} kg/m³，低于5层以下住宅最低标准 (ACI318/EIT) Below min for ≤5-storey residential` },
    foundation:   { min:STEEL_SAFETY_MIN.foundation,    warn:`基础含钢量<${STEEL_SAFETY_MIN.foundation} kg/m³，低于5层以下住宅最低标准 (ACI318/EIT) Below min for ≤5-storey residential` },
  },
  lossRate: {
    steel:   { min:1.5, warn:'钢筋损耗率<1.5%，低于定额标准（GB 50500）' },
    concrete:{ min:1.0, warn:'混凝土损耗率<1.0%，低于定额标准（GB 50500）' },
  },
};
const CONCRETE_GRADES = ['C15','C20','C25','C30','C35','C40','C45','C50'];
const CONCRETE_GRADE_VALS = Object.fromEntries(CONCRETE_GRADES.map(g=>[g,parseInt(g.slice(1))]));
const DEFAULT_SETTINGS = {
  seismicLevel:'3', concreteGrade:'C30', concreteLossRate:2, steelLossRate:2,
  concretePriceMin:2800, concretePriceMax:3500, steelPriceMin:22000, steelPriceMax:28000,
  formworkPriceMin:180, formworkPriceMax:280, currency:'฿',
};

// ── A1. 钢筋单位重量 (kg/m) ──────────────────────────────────
const REBAR_UNIT_WEIGHT = {
  6:0.222, 8:0.395, 10:0.617, 12:0.888, 14:1.208,
  16:1.578, 18:1.998, 20:2.466, 22:2.984, 25:3.853
};

// ── A2. 配筋层定义 ───────────────────────────────────────────
const REBAR_LAYER_DEFS = {
  retainingWall: [
    {key:'outerV',  label:'外侧竖向筋 Outer Vert.', inputType:'spacing', diaDefault:12, spacingDefault:200},
    {key:'outerH',  label:'外侧水平筋 Outer Horiz.', inputType:'spacing', diaDefault:10, spacingDefault:200},
    {key:'innerV',  label:'内侧竖向筋 Inner Vert.',  inputType:'spacing', diaDefault:12, spacingDefault:200},
    {key:'innerH',  label:'内侧水平筋 Inner Horiz.', inputType:'spacing', diaDefault:10, spacingDefault:200},
    {key:'tieBars', label:'拉结筋 Tie Bars',          inputType:'tie',     diaDefault:8,  spacingHDefault:600, spacingVDefault:600},
  ],
  beam: [
    {key:'topRebar',    label:'上部纵筋 Top Rebar',      inputType:'count',   diaDefault:16, countDefault:3},
    {key:'bottomRebar', label:'下部纵筋 Bottom Rebar',   inputType:'count',   diaDefault:16, countDefault:2},
    {key:'stirrups',    label:'箍筋 Stirrups',           inputType:'spacing', diaDefault:8,  spacingDefault:150},
    {key:'waistBars',   label:'腰筋(每侧) Waist/Side',   inputType:'count',   diaDefault:12, countDefault:2},
  ],
  column: [
    {key:'longitudinal',label:'纵向钢筋 Longitudinal',   inputType:'count',   diaDefault:16, countDefault:8},
    {key:'stirrups',    label:'箍筋 Stirrups',           inputType:'spacing', diaDefault:8,  spacingDefault:100},
  ],
  slab: [
    {key:'xBars',       label:'X向受力筋 X-Bars',        inputType:'spacing', diaDefault:10, spacingDefault:200},
    {key:'yBars',       label:'Y向受力筋 Y-Bars',        inputType:'spacing', diaDefault:10, spacingDefault:200},
    {key:'distribution',label:'分布筋 Distribution',     inputType:'spacing', diaDefault:8,  spacingDefault:250},
  ],
};

// Rebar preset levels — EIT Thailand / ACI 318-19 / TIS 24-2548
// 最低安全线: just meets code minimum (ρ_min)
// 标准推荐:   good practice for Thai residential (ρ ≈ 1.2-1.5×min)
// 高级保守:   coastal/seismic zone, higher safety margin (ρ ≈ 1.8-2×min)
const REBAR_PRESETS = {
  retainingWall: {
    min: [
      { key:'outerV',  name:'竖向外层筋', dia:12, spacing:200, note:'外侧@200mm' },
      { key:'outerH',  name:'水平外层筋', dia:10, spacing:200, note:'外侧@200mm' },
      { key:'innerV',  name:'竖向内层筋', dia:12, spacing:200, note:'内侧@200mm' },
      { key:'innerH',  name:'水平内层筋', dia:10, spacing:200, note:'内侧@200mm' },
      { key:'tieBars', name:'拉结筋',     dia:8,  spacingH:600, spacingV:600, note:'@600×600mm' },
    ],
    std: [
      { key:'outerV',  name:'竖向外层筋', dia:14, spacing:150, note:'外侧@150mm' },
      { key:'outerH',  name:'水平外层筋', dia:12, spacing:200, note:'外侧@200mm' },
      { key:'innerV',  name:'竖向内层筋', dia:14, spacing:150, note:'内侧@150mm' },
      { key:'innerH',  name:'水平内层筋', dia:12, spacing:200, note:'内侧@200mm' },
      { key:'tieBars', name:'拉结筋',     dia:8,  spacingH:500, spacingV:500, note:'@500×500mm' },
    ],
    high: [
      { key:'outerV',  name:'竖向外层筋', dia:16, spacing:150, note:'外侧@150mm' },
      { key:'outerH',  name:'水平外层筋', dia:12, spacing:150, note:'外侧@150mm' },
      { key:'innerV',  name:'竖向内层筋', dia:16, spacing:150, note:'内侧@150mm' },
      { key:'innerH',  name:'水平内层筋', dia:12, spacing:150, note:'内侧@150mm' },
      { key:'tieBars', name:'拉结筋',     dia:8,  spacingH:400, spacingV:400, note:'@400×400mm' },
    ],
  },
  column: {
    min: [
      { key:'longitudinal', name:'纵向钢筋', dia:14, count:4,  note:'4根' },
      { key:'stirrups',     name:'箍筋',     dia:6,  spacing:200, note:'@200mm' },
    ],
    std: [
      { key:'longitudinal', name:'纵向钢筋', dia:16, count:4,  note:'4根' },
      { key:'stirrups',     name:'箍筋',     dia:8,  spacing:150, note:'@150mm' },
    ],
    high: [
      { key:'longitudinal', name:'纵向钢筋', dia:20, count:8,  note:'8根' },
      { key:'stirrups',     name:'箍筋',     dia:8,  spacing:100, note:'@100mm加密' },
    ],
  },
  beam: {
    min: [
      { key:'topRebar',    name:'上部纵筋', dia:14, count:2,  note:'上排2根' },
      { key:'bottomRebar', name:'下部纵筋', dia:16, count:2,  note:'下排2根' },
      { key:'stirrups',    name:'箍筋',     dia:8,  spacing:200, note:'@200mm' },
    ],
    std: [
      { key:'topRebar',    name:'上部纵筋', dia:16, count:2,  note:'上排2根' },
      { key:'bottomRebar', name:'下部纵筋', dia:20, count:3,  note:'下排3根' },
      { key:'stirrups',    name:'箍筋',     dia:8,  spacing:150, note:'@150mm' },
    ],
    high: [
      { key:'topRebar',    name:'上部纵筋', dia:20, count:3,  note:'上排3根' },
      { key:'bottomRebar', name:'下部纵筋', dia:22, count:4,  note:'下排4根' },
      { key:'stirrups',    name:'箍筋',     dia:10, spacing:100, note:'@100mm' },
    ],
  },
  slab: {
    min: [
      { key:'xBars', name:'X向受力筋', dia:10, spacing:250, note:'@250mm' },
      { key:'yBars', name:'Y向受力筋', dia:10, spacing:250, note:'@250mm' },
    ],
    std: [
      { key:'xBars', name:'X向受力筋', dia:10, spacing:200, note:'@200mm' },
      { key:'yBars', name:'Y向受力筋', dia:10, spacing:200, note:'@200mm' },
    ],
    high: [
      { key:'xBars', name:'X向受力筋', dia:12, spacing:150, note:'@150mm' },
      { key:'yBars', name:'Y向受力筋', dia:12, spacing:150, note:'@150mm' },
    ],
  },
};

// ══════════════════════════════════════════════════════════════
// 2. 构件数据库 (componentDB)
// ══════════════════════════════════════════════════════════════
const COMP_DB = {
  retainingWall:{
    key:'retainingWall', name:'挡土墙 / 地下室外墙', shortName:'挡土墙',
    baseRatio:150, safetyKey:'retainingWall', formworkType:'wall',
    defaultDims:{L:10,W:0.3,H:3,qty:1}, needsWaterproof:true,
    normRef:'GB 50108-2008; GB 50010-2010',
    concreteNote:'⚠️ 必须使用抗渗混凝土P6/P8（GB 50108强制要求）',
    deriveMaterials(L,W,H,qty,cVol,fwArea,stWt){
      const wallLen=+(L*qty).toFixed(2), singleFace=fwArea/2, bolts=Math.ceil(singleFace*4), wpArea=+(singleFace+L*W*qty).toFixed(2);
      return [
        {name:'抗渗混凝土', qty:+cVol.toFixed(2), unit:'m³', critical:true,  tooltip:'P6/P8强制（GB 50108 第4.1.2条）'},
        {name:'止水钢板',   qty:wallLen,           unit:'m',  critical:true,  tooltip:'300mm×2mm，中埋（GB 50108 第5.2.1条）'},
        {name:'止水螺栓',   qty:bolts,             unit:'套', critical:true,  tooltip:'@500×500，含止水环片（GB 50108 第5.2.2条）'},
        {name:'防水卷材',   qty:wpArea,            unit:'m²', critical:false, tooltip:'≥4mm，两道设防（GB 50108 第4.3条）'},
      ];
    },
  },
  column:{
    key:'column', name:'框架柱 / 独立柱', shortName:'框架柱',
    baseRatio:110, safetyKey:'column', formworkType:'column',
    defaultDims:{L:0.5,W:0.5,H:3.5,qty:4}, needsWaterproof:false,
    normRef:'GB 50010-2010 第11章; 16G101-1',
    concreteNote:'框架柱混凝土强度等级不应低于C30（GB 50010 第11.1条）',
    deriveMaterials(L,W,H,qty,cVol,fwArea,stWt){
      return [
        {name:'商品混凝土',  qty:+cVol.toFixed(2),  unit:'m³', critical:false, tooltip:'强度≥C30（GB 50010 第11.1.1条）'},
        {name:'纵筋+箍筋',   qty:+stWt.toFixed(3),  unit:'t',  critical:false, tooltip:'主筋HRB400；箍筋加密区@100mm（16G101-1 第5章）'},
        {name:'保护层垫块',  qty:Math.ceil(fwArea*2),unit:'个', critical:false, tooltip:'@500mm设置，保护层≥25mm（GB 50010 第8.2条）'},
      ];
    },
  },
  beam:{
    key:'beam', name:'框架梁 / 连梁', shortName:'框架梁',
    baseRatio:90, safetyKey:'beam', formworkType:'beam',
    defaultDims:{L:6,W:0.3,H:0.6,qty:5}, needsWaterproof:false,
    normRef:'GB 50010-2010 第6章; 16G101-1',
    concreteNote:'梁混凝土强度≥C25（GB 50010）',
    deriveMaterials(L,W,H,qty,cVol,fwArea,stWt){
      const hasWaist=H>0.45, wTon=hasWaist?+(L*qty*2*2*0.000888).toFixed(3):0;
      const mats=[
        {name:'商品混凝土',   qty:+cVol.toFixed(2), unit:'m³', critical:false, tooltip:'强度≥C25（GB 50010 第4.1条）'},
        {name:'底筋+面筋+箍筋',qty:+stWt.toFixed(3),unit:'t',  critical:false, tooltip:'加密区箍筋@100mm（16G101-1 第6章）'},
      ];
      if(hasWaist) mats.push({name:'腰筋(H>450)',qty:wTon,unit:'t',critical:false,tooltip:'梁高>450mm须设腰筋（GB 50010 第9.2.13条）'});
      return mats;
    },
  },
  slab:{
    key:'slab', name:'楼板 / 屋面板', shortName:'楼板',
    baseRatio:80, safetyKey:'slab', formworkType:'slab',
    defaultDims:{L:6,W:6,H:0.12,qty:5}, needsWaterproof:false,
    normRef:'GB 50010-2010 第7章; 16G101-1',
    concreteNote:'楼板混凝土强度≥C25（GB 50010）',
    deriveMaterials(L,W,H,qty,cVol,fwArea,stWt){
      return [
        {name:'商品混凝土', qty:+cVol.toFixed(2),       unit:'m³', critical:false, tooltip:'强度≥C25（GB 50010 第4.1条）'},
        {name:'板底/面筋',  qty:+stWt.toFixed(3),       unit:'t',  critical:false, tooltip:'双向网片间距150~200mm（16G101-1 第7章）'},
        {name:'马凳筋',     qty:Math.ceil(fwArea*4),    unit:'个', critical:false, tooltip:'@500×500设置（16G101 施工说明）'},
      ];
    },
  },
  foundation:{
    key:'foundation', name:'独立基础 / 筏板基础', shortName:'独立基础',
    baseRatio:60, safetyKey:'foundation', formworkType:'foundation',
    defaultDims:{L:2,W:2,H:0.8,qty:8}, needsWaterproof:true,
    normRef:'GB 50010-2010 第8章; GB 50108-2008',
    concreteNote:'基础混凝土强度≥C25（GB 50010 第8.1条）',
    deriveMaterials(L,W,H,qty,cVol,fwArea,stWt){
      const bArea=L*W*qty;
      return [
        {name:'基础混凝土', qty:+cVol.toFixed(2),         unit:'m³', critical:false, tooltip:'强度≥C25（GB 50010 第8.1条）'},
        {name:'垫层砼C15',  qty:+(bArea*0.1).toFixed(3),  unit:'m³', critical:false, tooltip:'厚100mm（GB 50010 第8.2.1条）'},
        {name:'基础防水层', qty:+(bArea*1.1).toFixed(2),  unit:'m²', critical:true,  tooltip:'满铺设防（GB 50108 地下防水强制）'},
      ];
    },
  },
};
const COMP_TYPE_LIST = Object.values(COMP_DB).map(c=>({key:c.key,name:c.name}));

// ──────────────────────────────────────────────────────────────
// LOAD CALCULATION CONSTANTS
// ──────────────────────────────────────────────────────────────

// Live loads — กฎกระทรวงกำหนดมาตรฐาน พ.ศ.2557 / EIT Thailand / BS 6399-1:1996
// Note: 1 kN/m² ≈ 101.97 kg/m², Thai code traditionally uses kgf/m²
const LIVE_LOADS = {
  // ── Residential (ที่พักอาศัย) ──────────────────────────────────────
  bedroom:         { label:'ห้องนอน/ห้องนั่งเล่น Bedroom/Living',  q: 200, note:'กฎกระทรวง §4 ที่พักอาศัย' },
  kitchen:         { label:'ครัว Kitchen',                           q: 200, note:'กฎกระทรวง §4 ที่พักอาศัย' },
  corridor:        { label:'ทางเดินภายใน Corridor (internal)',       q: 300, note:'กฎกระทรวง §4 ทางเดิน' },
  stairs:          { label:'บันได Staircase',                        q: 300, note:'กฎกระทรวง §4 บันได' },
  balcony:         { label:'ระเบียง/เฉลียง Balcony/Terrace',        q: 300, note:'กฎกระทรวง §4 ระเบียง' },
  // ── Roof (หลังคา) ──────────────────────────────────────────────────
  roof_no_access:  { label:'หลังคาไม่ขึ้น Inaccessible Roof',        q:  75, note:'กฎกระทรวง §4 หลังคา' },
  roof_access:     { label:'หลังคาขึ้นได้ Accessible Roof',           q: 150, note:'กฎกระทรวง §4 หลังคาขึ้นได้' },
  roof_garden:     { label:'สวนหย่อมบนดาดฟ้า Roof Garden',           q: 300, note:'EIT guideline — garden load = balcony min' },
  // ── Special (พิเศษ) ─────────────────────────────────────────────────
  parking_private: { label:'ที่จอดรถส่วนบุคคล Private Parking',     q: 400, note:'กฎกระทรวง / BS 6399-1 §6.4 — private vehicle' },
  parking_public:  { label:'ที่จอดรถสาธารณะ Public Parking',         q: 500, note:'กฎกระทรวง / BS 6399-1 §6.4 — public garage' },
  pool_deck:       { label:'ขอบสระว่ายน้ำ Pool Deck',                q: 300, note:'EIT — pool surround, excl. water weight' },
  // pool water weight is SEPARATE: 1000 kg/m³ × depth_m (computed dynamically)
};

const LIVE_LOAD_LABELS = Object.fromEntries(
  Object.entries(LIVE_LOADS).map(([k, v]) => [k, `${v.label} (LL=${v.q} kg/m²)`])
);

const _LL_ALIAS = { residential: 'bedroom', pool_area: 'pool_deck' };
function _llEntry(useType) {
  const key = _LL_ALIAS[useType] || useType;
  return LIVE_LOADS[key] || LIVE_LOADS.bedroom;
}

// Dead Loads — physical material densities (ISO/physics constants)
const MATERIAL_DENSITY = {
  rc_concrete:    2400,  // kg/m³ — Reinforced concrete (ISO 6707-1)
  plain_concrete: 2300,  // kg/m³ — Plain concrete (ISO 6707-1)
  tiles_screed:    120,  // kg/m²  — Ceramic tiles 10mm + cement screed 40mm
  plaster_both:     54,  // kg/m²  — 15mm plaster both faces (2×27 kg/m²)
  brick_200mm:     380,  // kg/m²  — 200mm thick brick wall per m²
  waterproof:       20,  // kg/m²  — Waterproofing membrane
};

// Load Combination Factors — ACI 318-19 §5.3.1 / Thailand adopted standard
const LOAD_COMBO = {
  Uf: { D: 1.2, L: 1.6 },  // U = 1.2D + 1.6L  (factored/ultimate)
  Us: { D: 1.0, L: 1.0 },  // Service load (unfactored)
};

// ══════════════════════════════════════════════════════════════
// 3. 钢筋计算数据 (rebarCalc)
// ══════════════════════════════════════════════════════════════
const BAR_DENSITY = {6:.222,8:.395,10:.617,12:.888,14:1.208,16:1.578,18:1.998,20:2.466,22:2.984,25:3.853,28:4.834,32:6.313};
const BAR_DIAS    = [6,8,10,12,14,16,18,20,22,25,28,32];
const REBAR_TMPLS = {
  retainingWall:{ desc:'300mm厚墙，10m长，3m高，双层双向', rows:[
    {name:'竖向外层筋',dia:16,count:68, length:3.10,note:'外侧@150mm'},
    {name:'竖向内层筋',dia:16,count:68, length:3.10,note:'内侧@150mm'},
    {name:'水平外层筋',dia:12,count:16, length:10.30,note:'外侧@200mm'},
    {name:'水平内层筋',dia:12,count:16, length:10.30,note:'内侧@200mm'},
    {name:'拉结筋',    dia:8, count:147,length:0.38, note:'@500×500'},
  ]},
  column:{ desc:'500×500mm，净高3.5m，三级抗震', rows:[
    {name:'角筋',        dia:20,count:4, length:3.85,note:'4根HRB400，含锚固'},
    {name:'腹筋',        dia:16,count:4, length:3.85,note:'每侧1根'},
    {name:'加密区箍筋',  dia:8, count:14,length:1.86,note:'@100mm，上下各700mm'},
    {name:'非加密区箍筋',dia:8, count:11,length:1.86,note:'@200mm，跨中'},
  ]},
  beam:{ desc:'300×600mm，跨度6m', rows:[
    {name:'底筋(受拉)',    dia:25,count:3, length:6.60,note:'3Φ25，含锚固'},
    {name:'面筋(架立)',    dia:20,count:2, length:6.60,note:'2Φ20'},
    {name:'腰筋G2Φ12',   dia:12,count:4, length:6.60,note:'H=600>450mm强制设置'},
    {name:'加密区箍筋',   dia:8, count:18,length:1.68,note:'@100mm，两端各900mm'},
    {name:'非加密区箍筋', dia:8, count:21,length:1.68,note:'@200mm，跨中'},
  ]},
  slab:{ desc:'120mm厚，6m×6m双向板', rows:[
    {name:'X向底筋',    dia:10,count:41,length:6.25,note:'@150mm'},
    {name:'Y向底筋',    dia:10,count:41,length:6.25,note:'@150mm'},
    {name:'X向支座负筋',dia:10,count:21,length:1.50,note:'@300mm'},
    {name:'Y向支座负筋',dia:10,count:21,length:1.50,note:'@300mm'},
    {name:'马凳筋',     dia:12,count:144,length:0.25,note:'@500×500'},
  ]},
  foundation:{ desc:'2×2×0.8m独立基础', rows:[
    {name:'X向底筋',dia:16,count:14,length:2.20,note:'@150mm，含弯钩'},
    {name:'Y向底筋',dia:16,count:14,length:2.20,note:'@150mm'},
  ]},
};

// ══════════════════════════════════════════════════════════════
// 4. 图片映射 (imageMap) — 路径指向 assets/boq/
// ══════════════════════════════════════════════════════════════
const COMP_IMAGES = {
  retainingWall:[
    {file:'assets/boq/wall_01_basement_wall.png',title:'地下室外墙DWQ钢筋构造',ref:'16G101-1 第88页',note:'竖向筋/水平筋/拉结筋布置'},
    {file:'assets/boq/05_stirrup_hooks.png',     title:'封闭箍筋弯钩构造（135°）',ref:'16G101-1 第68页',note:'抗震箍筋末端必须135°'},
    {file:'assets/boq/00_cover_protection.png',  title:'混凝土保护层最小厚度',   ref:'16G101-1 第62页',note:'迎水面保护层≥40mm'},
  ],
  column:[
    {file:'assets/boq/col_01_dense_zone.png',    title:'KZ箍筋加密区范围',         ref:'16G101-1 第71页',note:'加密区=max(净高/6,截面尺寸,500mm)'},
    {file:'assets/boq/col_02_dense_table.png',   title:'抗震框架柱箍筋加密区高度选用表',ref:'16G101-1 第72页',note:'按抗震等级和净高直接查表'},
    {file:'assets/boq/col_03_stirrup_forms.png', title:'矩形箍筋复合形式',          ref:'16G101-1 第76页',note:'2×2/3×3/4×4肢箍选型'},
    {file:'assets/boq/col_04_top_rebar.png',     title:'KZ边柱角柱柱顶纵筋构造',   ref:'16G101-1 第73页',note:'柱顶锚入梁内'},
    {file:'assets/boq/05_stirrup_hooks.png',     title:'封闭箍筋弯钩构造',         ref:'16G101-1 第68页',note:'抗震区必须135°'},
    {file:'assets/boq/00_cover_protection.png',  title:'混凝土保护层最小厚度',     ref:'16G101-1 第62页',note:'柱保护层≥20mm'},
  ],
  beam:[
    {file:'assets/boq/beam_01_longitudinal.png', title:'楼层框架梁KL纵向钢筋构造', ref:'16G101-1 第90页',note:'上部纵筋在支座锚固'},
    {file:'assets/boq/beam_02_stirrup.png',      title:'梁箍筋构造',               ref:'16G101-1 第94页',note:'梁端加密区=max(1.5hb,500mm)'},
    {file:'assets/boq/beam_03_waist_bar.png',    title:'梁侧面纵向构造筋（腰筋）', ref:'16G101-1 第96页',note:'梁高hw≥450mm时强制设置'},
    {file:'assets/boq/05_stirrup_hooks.png',     title:'封闭箍筋弯钩构造',         ref:'16G101-1 第68页',note:'抗震梁必须135°'},
  ],
  slab:[
    {file:'assets/boq/slab_01_floor_rebar.png',  title:'有梁楼盖楼面板配筋构造',  ref:'16G101-1 第105页',note:'板底筋伸入支座锚固'},
    {file:'assets/boq/slab_02_single_double.png', title:'单(双)向板配筋示意',      ref:'16G101-1 第108页',note:'长边/短边≥3为单向板'},
    {file:'assets/boq/00_cover_protection.png',   title:'混凝土保护层最小厚度',    ref:'16G101-1 第62页',note:'板保护层≥15mm'},
  ],
  foundation:[
    {file:'assets/boq/00_cover_protection.png',  title:'混凝土保护层最小厚度（基础）',ref:'16G101-1 第62页',note:'有垫层≥40mm；无垫层≥70mm'},
    {file:'assets/boq/01_anchorage_length.png',  title:'受拉钢筋基本锚固长度',       ref:'16G101-1 第63页',note:'基础底板钢筋锚固查此表'},
    {file:'assets/boq/03_bar_hooks.png',          title:'纵向钢筋弯钩与机械锚固形式', ref:'16G101-1 第65页',note:'基础内钢筋端部弯钩要求'},
  ],
};
const GENERAL_IMAGES = [
  {file:'assets/boq/00_cover_protection.png', title:'保护层最小厚度',ref:'16G101-1 第62页',note:'GB 50010 第8.2条'},
  {file:'assets/boq/01_anchorage_length.png', title:'受拉钢筋基本锚固长度 lab',ref:'16G101-1 第63页',note:'GB 50010 第8.3条'},
  {file:'assets/boq/02_anchorage_seismic.png',title:'受拉钢筋锚固长度 laE',ref:'16G101-1 第64页',note:'GB 50010 第8.3条'},
  {file:'assets/boq/03_bar_hooks.png',         title:'纵向钢筋弯钩与机械锚固形式',ref:'16G101-1 第65页',note:'GB 50010 第8.3.3条'},
  {file:'assets/boq/04_splice_length.png',     title:'纵向受拉钢筋搭接长度 ll',ref:'16G101-1 第66页',note:'GB 50010 第8.4.4条'},
  {file:'assets/boq/05_stirrup_hooks.png',     title:'封闭箍筋弯钩构造（135°强制）',ref:'16G101-1 第68页',note:'GB 50010 第9.2.11条'},
];

// ══════════════════════════════════════════════════════════════
// 5. 计算引擎 (calculator)
// ══════════════════════════════════════════════════════════════
function _n(v,d=0){ const x=parseFloat(v); return isNaN(x)?d:x; }

function calcConcreteVol(L,W,H,qty){ return +(_n(L)*_n(W)*_n(H)*_n(qty)).toFixed(3); }

function calcFormworkArea(type,L,W,H,qty){
  L=_n(L);W=_n(W);H=_n(H);qty=_n(qty);
  const m={
    column:    (2*L+2*W)*H*qty,
    beam:      (W+2*H)*L*qty,
    wall:      2*L*H*qty,
    retainingWall: 2*L*H*qty,
    slab:      L*W*qty,
    foundation:2*(L+W)*H*qty,
  };
  return +(m[type]||2*(L+W)*H*qty).toFixed(3);
}

function calcBarWeight(dia,cnt,len){
  return +((BAR_DENSITY[parseInt(dia)]||0)*_n(cnt)*_n(len)).toFixed(3);
}
function calcRebarTotal(rows){
  return +((rows||[]).reduce((s,r)=>s+calcBarWeight(r.dia,r.count,r.length),0)).toFixed(3);
}

function calcSteelWeight(cVol,base,sf,loss){
  return +(_n(cVol)*_n(base)*_n(sf,1)*(1+_n(loss)/100)/1000).toFixed(4);
}
function calcEffRatio(base,sf){ return +(_n(base)*_n(sf,1)).toFixed(1); }

// ── A3. 按配筋层计算钢筋用量 ─────────────────────────────────
function calcRebarConfigLayers(comp, layerValues){
  const L=_n(comp.L), W=_n(comp.W), H=_n(comp.H);
  const results=[];
  function _uw(dia){ return REBAR_UNIT_WEIGHT[dia]||(dia*dia/162.27); }

  if(comp.type==='retainingWall'){
    const {outerV,outerH,innerV,innerH,tieBars}=layerValues;
    if(outerV){
      const count=Math.floor(L/(outerV.spacing/1000))+1, length=H+0.3;
      results.push({label:'外侧竖向筋 Outer Vert.',dia:outerV.dia,count,length,kg:count*length*_uw(outerV.dia)});
    }
    if(outerH){
      const count=Math.floor(H/(outerH.spacing/1000))+1, length=L+0.3;
      results.push({label:'外侧水平筋 Outer Horiz.',dia:outerH.dia,count,length,kg:count*length*_uw(outerH.dia)});
    }
    if(innerV){
      const count=Math.floor(L/(innerV.spacing/1000))+1, length=H+0.3;
      results.push({label:'内侧竖向筋 Inner Vert.',dia:innerV.dia,count,length,kg:count*length*_uw(innerV.dia)});
    }
    if(innerH){
      const count=Math.floor(H/(innerH.spacing/1000))+1, length=L+0.3;
      results.push({label:'内侧水平筋 Inner Horiz.',dia:innerH.dia,count,length,kg:count*length*_uw(innerH.dia)});
    }
    if(tieBars){
      const count=Math.floor(L/(tieBars.spacingH/1000))*Math.floor(H/(tieBars.spacingV/1000));
      const length=W-0.05;
      results.push({label:'拉结筋 Tie Bars',dia:tieBars.dia,count,length,kg:count*length*_uw(tieBars.dia)});
    }
  } else if(comp.type==='beam'){
    const {topRebar,bottomRebar,stirrups,waistBars}=layerValues;
    if(topRebar){
      const count=topRebar.count, length=L+0.6;
      results.push({label:'上部纵筋 Top Rebar',dia:topRebar.dia,count,length,kg:count*length*_uw(topRebar.dia)});
    }
    if(bottomRebar){
      const count=bottomRebar.count, length=L+0.6;
      results.push({label:'下部纵筋 Bottom Rebar',dia:bottomRebar.dia,count,length,kg:count*length*_uw(bottomRebar.dia)});
    }
    if(stirrups){
      const count=Math.floor(L/(stirrups.spacing/1000))+1;
      const perimeter=2*(W+H)-0.08+0.26;
      results.push({label:'箍筋 Stirrups',dia:stirrups.dia,count,length:perimeter,kg:count*perimeter*_uw(stirrups.dia)});
    }
    if(waistBars){
      const totalCount=waistBars.count*2, length=L+0.6;
      results.push({label:'腰筋(每侧) Waist/Side',dia:waistBars.dia,count:totalCount,length,kg:totalCount*length*_uw(waistBars.dia)});
    }
  } else if(comp.type==='column'){
    const {longitudinal,stirrups}=layerValues;
    if(longitudinal){
      const count=longitudinal.count, length=L+0.6;
      results.push({label:'纵向钢筋 Longitudinal',dia:longitudinal.dia,count,length,kg:count*length*_uw(longitudinal.dia)});
    }
    if(stirrups){
      const count=Math.floor(L/(stirrups.spacing/1000))+1;
      const perimeter=2*(W+H)-0.08+0.26;
      results.push({label:'箍筋 Stirrups',dia:stirrups.dia,count,length:perimeter,kg:count*perimeter*_uw(stirrups.dia)});
    }
  } else if(comp.type==='slab'){
    const {xBars,yBars,distribution}=layerValues;
    if(xBars){
      const count=Math.floor(W/(xBars.spacing/1000))+1, length=L+0.15;
      results.push({label:'X向受力筋 X-Bars',dia:xBars.dia,count,length,kg:count*length*_uw(xBars.dia)});
    }
    if(yBars){
      const count=Math.floor(L/(yBars.spacing/1000))+1, length=W+0.15;
      results.push({label:'Y向受力筋 Y-Bars',dia:yBars.dia,count,length,kg:count*length*_uw(yBars.dia)});
    }
    if(distribution){
      const count=Math.floor(W/(distribution.spacing/1000))+1, length=L+0.15;
      results.push({label:'分布筋 Distribution',dia:distribution.dia,count,length,kg:count*length*_uw(distribution.dia)});
    }
  }
  const totalKg=results.reduce((s,r)=>s+r.kg,0);
  return {results, totalKg, totalTon:totalKg/1000};
}

function calcCostRange(cVol,fwArea,stWt,s){
  const cf=1+_n(s.concreteLossRate)/100, cv=cVol*cf;
  const cMin=cv*_n(s.concretePriceMin), cMax=cv*_n(s.concretePriceMax);
  const sMin=stWt*_n(s.steelPriceMin),  sMax=stWt*_n(s.steelPriceMax);
  const fMin=fwArea*_n(s.formworkPriceMin),fMax=fwArea*_n(s.formworkPriceMax);
  return {
    concrete:{min:Math.round(cMin),max:Math.round(cMax)},
    steel:   {min:Math.round(sMin),max:Math.round(sMax)},
    formwork:{min:Math.round(fMin),max:Math.round(fMax)},
    total:   {min:Math.round(cMin+sMin+fMin),max:Math.round(cMax+sMax+fMax)},
  };
}

function validateComp(typeKey,ratio,gs){
  const w=[];
  const floors = window._boqFloors || 2;
  const minimums = STEEL_SAFETY_BY_FLOOR[floors] || STEEL_SAFETY_BY_FLOOR[2];
  const minKgM3 = minimums[typeKey] || 100;
  if (_n(ratio) < minKgM3) {
    const compName = COMP_DB[typeKey]?.shortName || typeKey;
    w.push({field:'steelRatio', message:`${compName}含钢量<${minKgM3} kg/m³，低于${floors}层住宅最低标准 (ACI318/EIT) / Below ${floors}-storey min`, level:'error'});
  }
  if(_n(gs.steelLossRate)<SAFETY_BASELINES.lossRate.steel.min)    w.push({field:'steelLoss',message:SAFETY_BASELINES.lossRate.steel.warn,level:'warning'});
  if(_n(gs.concreteLossRate)<SAFETY_BASELINES.lossRate.concrete.min) w.push({field:'concLoss',message:SAFETY_BASELINES.lossRate.concrete.warn,level:'warning'});
  const gv=CONCRETE_GRADE_VALS[gs.concreteGrade]||0;
  const isUG=(typeKey==='retainingWall'||typeKey==='foundation');
  if(isUG&&gv<30) w.push({field:'grade',message:`${COMP_DB[typeKey]?.shortName}建议C30以上且须抗渗P6/P8（GB 50108）`,level:'warning'});
  else if(!isUG&&gv<25) w.push({field:'grade',message:'主体结构混凝土强度等级不应低于C25（GB 50010 第4.1.2条）',level:'error'});
  return w;
}

function calcComp(comp,gs){
  const db=COMP_DB[comp.type]; if(!db) return{...comp,_err:'未知类型'};
  const L=_n(comp.L),W=_n(comp.W),H=_n(comp.H),qty=_n(comp.qty,1);
  const sf=_n(SEISMIC_FACTORS[gs.seismicLevel]?.factor,1);
  const cVol=calcConcreteVol(L,W,H,qty);
  const fwArea=calcFormworkArea(db.formworkType,L,W,H,qty);
  const effRatio=calcEffRatio(db.baseRatio,sf);
  let stWt=calcSteelWeight(cVol,db.baseRatio,sf,gs.steelLossRate);
  let usedDetail=false;
  if(comp.rebar && comp.rebar.calculatedKg > 0){
    stWt=+(comp.rebar.calculatedKg * qty / 1000).toFixed(4);
    usedDetail=true;
  } else if(comp.rebarRows&&comp.rebarRows.length){
    stWt=+(calcRebarTotal(comp.rebarRows)*qty/1000).toFixed(4);
    usedDetail=true;
  }
  const mats=db.deriveMaterials(L,W,H,qty,cVol,fwArea,stWt);
  const cost=calcCostRange(cVol,fwArea,stWt,gs);
  const actualRatio=cVol>0?+((stWt*1000)/cVol).toFixed(1):effRatio;
  const warns=validateComp(comp.type,actualRatio,gs);
  return{...comp,cVol,fwArea,effRatio:actualRatio,stWt,mats,cost,warns,usedDetail,hasErr:warns.some(w=>w.level==='error')};
}

// ══════════════════════════════════════════════════════════════
// 5b. 荷载计算引擎 (Load Calculation Engine)
// ══════════════════════════════════════════════════════════════

// Pure function: given a loadArea definition, returns per-m² and total load breakdown
function calcLoadArea(area) {
  const slabSelfWeight = (_n(area.slabThickMm) / 1000) * MATERIAL_DENSITY.rc_concrete; // kg/m²
  let finishDL = 0;
  if (area.finishes.tilesScreed) finishDL += MATERIAL_DENSITY.tiles_screed;
  if (area.finishes.plasterBoth) finishDL += MATERIAL_DENSITY.plaster_both;
  if (area.finishes.waterproof)  finishDL += MATERIAL_DENSITY.waterproof;
  const totalDL = slabSelfWeight + finishDL;
  const entry    = _llEntry(area.useType);
  const liveLoad = entry.q;   // kg/m² — code value
  const llNote   = entry.note;
  // Pool deck: add water weight separately
  const isPool    = ((_LL_ALIAS[area.useType] || area.useType) === 'pool_deck');
  const poolDepth = isPool ? (_n(area.poolDepthM) || 1.5) : 0;
  const waterLoad = isPool ? (1000 * poolDepth) : 0; // 1000 kg/m³ — physics constant, water density
  const totalLL   = liveLoad + waterLoad;
  const factoredLoad     = LOAD_COMBO.Uf.D * totalDL + LOAD_COMBO.Uf.L * totalLL; // 1.2D + 1.6L
  const areaM2           = _n(area.slabL) * _n(area.slabW);
  const totalFactoredKg  = factoredLoad * areaM2;
  const totalFactoredKN  = totalFactoredKg * 9.81 / 1000;
  return { slabSelfWeight, finishDL, totalDL, liveLoad, llNote, waterLoad, totalLL, isPool, poolDepth, factoredLoad, areaM2, totalFactoredKg, totalFactoredKN };
}

// ACI 318-19 §22.4.2.1 — tied column design strength
// φ = 0.65 (tied column, ACI 318-19 Table 21.2.2)
// φPn = φ × 0.80 × [0.85×f'c×(Ag-As) + fy×As]
// Demand Pu must be ≤ φPn (NOT Pn)
function calcColumnCapacity(colL_mm, colW_mm, fPrimeMPa, rebarCount, rebarDiaMm, fyMPa) {
  const phi = 0.65;  // ACI 318-19 Table 21.2.2 — tied column
  const Ag = colL_mm * colW_mm;  // mm²
  const As = rebarCount * (Math.PI / 4) * rebarDiaMm * rebarDiaMm;  // mm²
  const Pn_N   = 0.80 * (0.85 * fPrimeMPa * (Ag - As) + fyMPa * As);  // N — nominal
  const phiPn_N = phi * Pn_N;  // N — design strength (what is compared to Pu)
  const kg = phiPn_N / 9.81;
  const kN = phiPn_N / 1000;
  return { Ag, As, Pn_N, phiPn_N, kg, kN, phi };
}

function calcCompLoad(comp) {
  // Quick load estimate per component for row display
  // Source: MATERIAL_DENSITY (physics) + LIVE_LOADS (กฎกระทรวง)
  const H_m = _n(comp.H);
  let DL = 0;
  if (comp.type === 'slab' || comp.type === 'foundation') {
    DL = Math.round(2400 * H_m);  // RC slab self-weight (kg/m³ × m)
    DL += 120;  // typical finish: tiles + screed (kg/m²)
  } else if (comp.type === 'retainingWall' || comp.type === 'basementWall' || comp.type === 'shearWall') {
    DL = Math.round(2400 * _n(comp.W));  // wall cross-section (per m² wall area)
  } else if (comp.type === 'column' || comp.type === 'beam') {
    return null;  // load comes from slabs
  }
  if (DL <= 0) return null;
  const LL = 200;  // kg/m² residential default — กฎกระทรวง §4
  const design = Math.round(1.2 * DL + 1.6 * LL);  // ACI 318-19 §5.3.1
  return { DL, LL, design, standard: 'กฎกระทรวง/ACI318' };
}

// ══════════════════════════════════════════════════════════════
// 6. 状态管理 (State)
// ══════════════════════════════════════════════════════════════
const STATE = {
  global: {...DEFAULT_SETTINGS},
  components: [],
  loadAreas: [],
  _nid: 1,
  projectId: null,
  projectName: '',
  nextId(){ return this._nid++; },
};
const _STORAGE_KEY = 'boq_state_v1';

function _saveLS(){
  try{
    const proj=window.app?.currentProject;
    const key = proj?`boq_${proj.id}`:_STORAGE_KEY;
    localStorage.setItem(key,JSON.stringify({global:STATE.global,components:STATE.components,loadAreas:STATE.loadAreas,_nid:STATE._nid}));
  }catch(e){}
}

function _loadLS(){
  try{
    const proj=window.app?.currentProject;
    const key = proj?`boq_${proj.id}`:_STORAGE_KEY;
    const d=JSON.parse(localStorage.getItem(key)||'null');
    if(d){
      STATE.global={...DEFAULT_SETTINGS,...(d.global||{})};
      STATE.components=d.components||[];
      STATE.loadAreas=d.loadAreas||[];
      STATE._nid=d._nid||1;
      return true;
    }
  }catch(e){}
  return false;
}

// ══════════════════════════════════════════════════════════════
// 7. Toast & Tooltip
// ══════════════════════════════════════════════════════════════
const _shownT=new Set();
function boqToast(msg,type='info',dur=5000){
  if(_shownT.has(msg)) return; _shownT.add(msg);
  const c=document.getElementById('boq-toasts'); if(!c) return;
  const el=document.createElement('div');
  el.className=`boq-toast boq-toast-${type[0]==='e'?'e':type[0]==='w'?'w':'i'}`;
  el.innerHTML=`<span style="font-size:15px">${type==='error'?'🚫':type==='warning'?'⚠️':'ℹ️'}</span><span class="boq-t-msg"></span><button class="boq-t-close">×</button>`;
  el.querySelector('.boq-t-msg').textContent=msg;
  el.querySelector('.boq-t-close').onclick=()=>{el.remove();_shownT.delete(msg);};
  c.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('boq-tin'));
  setTimeout(()=>{el.classList.remove('boq-tin');el.classList.add('boq-tout');setTimeout(()=>{el.remove();_shownT.delete(msg);},300);},dur);
}

function _initTooltip(){
  const tip=document.getElementById('boq-tooltip'); if(!tip) return;
  document.addEventListener('mouseover',e=>{
    const t=e.target.closest('[data-boq-tip]'); if(!t) return;
    const ref=NORM_REFS[t.getAttribute('data-boq-tip')]; if(!ref) return;
    tip.innerHTML=`<div class="boq-tip-head">${ref.icon} ${ref.title}</div><div class="boq-tip-body">${ref.detail}</div><div class="boq-tip-refs">📚 ${ref.refs.join('<br>📚 ')}</div>`;
    tip.classList.add('boq-tip-on');
    const r=t.getBoundingClientRect();
    tip.style.cssText=`top:${r.bottom+window.scrollY+8}px;left:${Math.max(8,Math.min(r.left,window.innerWidth-330))}px`;
  });
  document.addEventListener('mouseout',e=>{
    if(!e.target.closest('[data-boq-tip]')) return;
    if(!e.relatedTarget?.closest('#boq-tooltip')) tip.classList.remove('boq-tip-on');
  });
  tip.addEventListener('mouseleave',()=>tip.classList.remove('boq-tip-on'));
}

// ══════════════════════════════════════════════════════════════
// 8. CRUD & Settings
// ══════════════════════════════════════════════════════════════
const _debounce=(fn,ms=280)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
const _autoSave=_debounce(_saveLS,1000);

function boqAddComp(type){
  type=type||document.getElementById('boq-add-sel')?.value||'column';
  const db=COMP_DB[type]; if(!db) return;
  const id=STATE.nextId();
  STATE.components.push({id,name:`${db.shortName}-${id}`,type,...db.defaultDims});
  _recalcRender();
}
function boqRemoveComp(id){
  STATE.components=STATE.components.filter(c=>c.id!==id); _recalcRender();
}
function boqFieldChange(id,field,val){
  const c=STATE.components.find(x=>x.id===id); if(!c) return;
  if(['L','W','H','qty'].includes(field)) c[field]=parseFloat(val)||0;
  else if(field==='type'){
    c.type=val; const db=COMP_DB[val];
    if(db){c.L=db.defaultDims.L;c.W=db.defaultDims.W;c.H=db.defaultDims.H;c.qty=db.defaultDims.qty;}
  }
  else c[field]=val;
  _recalcRender();
}
function boqGlobalChange(field,val){
  const nums=['concreteLossRate','steelLossRate','concretePriceMin','concretePriceMax','steelPriceMin','steelPriceMax','formworkPriceMin','formworkPriceMax'];
  STATE.global[field]=nums.includes(field)?(parseFloat(val)||0):val;
  _recalcRender();
}

// ══════════════════════════════════════════════════════════════
// 9. Render
// ══════════════════════════════════════════════════════════════
function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function _fmt(n){return Math.round(n||0).toLocaleString();}
function _setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

function _recalcRender(){
  const calc=STATE.components.map(c=>calcComp(c,STATE.global));
  _renderTable(calc);
  _renderSummary(calc);
  const shown=new Set();
  calc.forEach(c=>(c.warns||[]).forEach(w=>{if(w.level==='error'&&!shown.has(w.message)){boqToast(w.message,'error');shown.add(w.message);}}));
  _renderLoadAll();
  _autoSave();
}

function _renderTable(calc){
  const tbody=document.getElementById('boq-tbody');if(!tbody)return;
  if(!calc.length){
    tbody.innerHTML=`<tr><td colspan="12"><div class="boq-empty"><div class="boq-empty-icon">📋</div>暂无构件，点击上方「添加构件」</div></td></tr>`;
    return;
  }
  tbody.innerHTML=calc.map(c=>{
    const db=COMP_DB[c.type]||{}, sf=SEISMIC_FACTORS[STATE.global.seismicLevel]||SEISMIC_FACTORS['3'];
    const bl=SAFETY_BASELINES.steelRatio[c.type], ratioErr=bl&&(c.effRatio||0)<((STEEL_SAFETY_BY_FLOOR[window._boqFloors||2]||STEEL_SAFETY_BY_FLOOR[2])[c.type]||bl.min);
    const cur=STATE.global.currency;
    const cMin=_fmt(c.cost?.total?.min), cMax=_fmt(c.cost?.total?.max);
    const tags=(c.mats||[]).map(m=>`<span class="boq-tag ${m.critical?'boq-tag-crit':'boq-tag-norm'}" title="${_esc(m.tooltip)}">${m.name} <b>${m.qty}</b>${m.unit}</span>`).join('');
    const typeOpts=COMP_TYPE_LIST.map(t=>`<option value="${t.key}"${t.key===c.type?' selected':''}>${t.name}</option>`).join('');
    const loadBadge = (() => {
      const ld = calcCompLoad(c);
      if (ld) {
        return `<div class="boq-load-badges" title="荷载核算 / กฎกระทรวง+ACI318">` +
          `<span class="boq-lb boq-lb-dl">DL ${ld.DL}</span>` +
          `<span class="boq-lb boq-lb-ll">LL ${ld.LL}</span>` +
          `<span class="boq-lb boq-lb-pu">设 ${ld.design}</span>` +
          `<span class="boq-lb boq-lb-unit">kg/m²</span></div>`;
      }
      return `<div class="boq-load-badges"><span class="boq-lb boq-lb-info">荷载由楼板传来</span></div>`;
    })();
    return `<tr class="${c.hasErr?'boq-row-err':''}" id="boq-row-${c.id}">
      <td><input class="boq-ti boq-ti-name" value="${_esc(c.name)}" data-id="${c.id}" data-f="name" placeholder="构件名称"></td>
      <td><select class="boq-tsel" data-id="${c.id}" data-f="type">${typeOpts}</select></td>
      <td><input class="boq-ti boq-ti-dim" type="number" value="${c.L}" min="0" step="0.1" data-id="${c.id}" data-f="L"></td>
      <td><input class="boq-ti boq-ti-dim" type="number" value="${c.W}" min="0" step="0.01" data-id="${c.id}" data-f="W"></td>
      <td><input class="boq-ti boq-ti-dim" type="number" value="${c.H}" min="0" step="0.01" data-id="${c.id}" data-f="H"></td>
      <td><input class="boq-ti boq-ti-qty" type="number" value="${c.qty}" min="1" step="1" data-id="${c.id}" data-f="qty"></td>
      <td class="boq-tc">
        <span class="boq-ratio ${ratioErr?'boq-ratio-err':'boq-ratio-ok'}" title="${db.baseRatio}×${sf.factor}=${c.effRatio} kg/m³">${c.effRatio||'—'}</span>
        ${c.usedDetail?'<div class="boq-detail-badge">📐按明细算</div>':`<div class="boq-hint">${db.baseRatio||'—'}×${sf.factor}</div>`}
        ${c.rebar && c.rebar.calculatedKg > 0?'<div class="boq-detail-badge">📐配筋算</div>':''}
        ${loadBadge}
      </td>
      <td class="boq-tr boq-derived">${(c.cVol||0).toFixed(2)}</td>
      <td class="boq-tr boq-derived">${(c.fwArea||0).toFixed(2)}</td>
      <td class="boq-tr boq-derived">${(c.stWt||0).toFixed(3)}</td>
      <td class="boq-mat-cell">${tags}${db.concreteNote?`<div class="boq-norm-note">${db.concreteNote}</div>`:''}</td>
      <td class="boq-tc boq-op-cell">
        <div class="boq-cost-sm">${cur}${cMin}<br>~${cur}${cMax}</div>
        <button class="boq-btn-sm boq-btn-sm-purple" onclick="BOQ.toggleRebarCfg(${c.id})">🔧 配筋</button>
        <button class="boq-btn-sm boq-btn-sm-blue"  onclick="BOQ.showRebar(${c.id})">🔩 钢筋</button>
        <button class="boq-btn-sm boq-btn-sm-green" onclick="BOQ.showImgs('${c.type}')">📐 详图</button>
        <button class="boq-btn-sm boq-btn-sm-red"   onclick="BOQ.rm(${c.id})">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function _renderSummary(calc){
  const T={cv:0,fw:0,st:0,cMin:0,cMax:0,conMin:0,conMax:0,steMin:0,steMax:0,fwMin:0,fwMax:0};
  calc.forEach(c=>{
    T.cv+=c.cVol||0;T.fw+=c.fwArea||0;T.st+=c.stWt||0;
    T.cMin+=c.cost?.total?.min||0;T.cMax+=c.cost?.total?.max||0;
    T.conMin+=c.cost?.concrete?.min||0;T.conMax+=c.cost?.concrete?.max||0;
    T.steMin+=c.cost?.steel?.min||0;T.steMax+=c.cost?.steel?.max||0;
    T.fwMin+=c.cost?.formwork?.min||0;T.fwMax+=c.cost?.formwork?.max||0;
  });
  const cur=STATE.global.currency;
  _setText('boq-sum-cv', T.cv.toFixed(2));
  _setText('boq-sum-fw', T.fw.toFixed(2));
  _setText('boq-sum-st', T.st.toFixed(3));
  _setText('boq-sum-cost',`${cur}${_fmt(T.cMin)} ~ ${cur}${_fmt(T.cMax)}`);
  const bd=document.getElementById('boq-breakdown'); if(!bd) return;
  if(T.cMax<=0){bd.innerHTML='<p class="boq-bd-empty">添加构件后自动生成费用构成</p>';return;}
  const pct=v=>Math.round(v/T.cMax*100);
  bd.innerHTML=[
    {label:'🏗️ 混凝土',cls:'boq-bar-c',min:T.conMin,max:T.conMax,p:pct(T.conMax)},
    {label:'🔩 钢筋',  cls:'boq-bar-s',min:T.steMin,max:T.steMax,p:pct(T.steMax)},
    {label:'🪵 模板',  cls:'boq-bar-f',min:T.fwMin, max:T.fwMax, p:pct(T.fwMax)},
  ].map(r=>`<div class="boq-bd-row"><div class="boq-bd-lbl">${r.label}</div><div class="boq-bd-bar"><div class="boq-bd-fill ${r.cls}" style="width:${r.p}%"></div></div><div class="boq-bd-val">${cur}${_fmt(r.min)}~${cur}${_fmt(r.max)} <span class="boq-bd-pct">(${r.p}%)</span></div></div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// 9b. 荷载计算渲染 (Load Calculation Render)
// ══════════════════════════════════════════════════════════════

// Recommend rebar preset level based on design load (for slabs)
// Based on typical slab capacity ranges for Thai residential construction
// These are indicative guidance values, not structural design calculations
function recommendPresetForLoad(designLoadKgM2) {
  if (designLoadKgM2 <= 600) return { level: 'min',  label: '🟢 最低安全线 可满足此荷载' };
  if (designLoadKgM2 <= 900) return { level: 'std',  label: '🟡 标准推荐 建议此等级' };
  return                             { level: 'high', label: '🔴 高级保守 此荷载建议高配' };
}

function _buildLoadResultHTML(area, res) {
  const entry  = _llEntry(area.useType);
  const rec    = recommendPresetForLoad(res.factoredLoad);
  let s = '';

  // Header
  s += `<div style="font-weight:700;margin-bottom:6px">${_esc(area.name)}&nbsp;&nbsp;`;
  s += `${_n(area.slabL).toFixed(1)}m × ${_n(area.slabW).toFixed(1)}m = <strong>${res.areaM2.toFixed(2)} m²</strong>`;
  s += `&nbsp;|&nbsp;楼板厚度: ${_n(area.slabThickMm)}mm</div>`;
  s += `<hr style="border:none;border-top:1px solid #e2e8f0;margin:4px 0 8px">`;

  // Dead Load table
  s += `<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:6px">`;
  s += `<thead><tr style="background:#f8fafc"><th style="text-align:left;padding:3px 6px">恒荷载 Dead Load (DL)</th><th style="text-align:right;padding:3px 6px">kg/m²</th><th style="text-align:left;padding:3px 6px;color:#6b7280">来源 Source</th></tr></thead><tbody>`;
  s += `<tr><td style="padding:2px 6px">楼板自重 Slab: ${_n(area.slabThickMm)}mm × 2400 kg/m³</td><td style="text-align:right;padding:2px 6px">${res.slabSelfWeight.toFixed(0)}</td><td style="padding:2px 6px;color:#6b7280;font-size:11px">ISO 6707-1, RC密度=2400</td></tr>`;
  if (area.finishes.tilesScreed) s += `<tr><td style="padding:2px 6px">瓷砖+找平 Tiles+screed 50mm</td><td style="text-align:right;padding:2px 6px">120</td><td style="padding:2px 6px;color:#6b7280;font-size:11px">物理密度 material density</td></tr>`;
  if (area.finishes.plasterBoth) s += `<tr><td style="padding:2px 6px">双面抹灰 Plaster both faces 2×15mm</td><td style="text-align:right;padding:2px 6px">54</td><td style="padding:2px 6px;color:#6b7280;font-size:11px">物理密度 2×27 kg/m²</td></tr>`;
  if (area.finishes.waterproof)  s += `<tr><td style="padding:2px 6px">防水层 Waterproof membrane</td><td style="text-align:right;padding:2px 6px">20</td><td style="padding:2px 6px;color:#6b7280;font-size:11px">物理密度 material density</td></tr>`;
  s += `<tr style="background:#f0fdf4;font-weight:700"><td style="padding:3px 6px">DL 合计 Total</td><td style="text-align:right;padding:3px 6px">${res.totalDL.toFixed(0)}</td><td></td></tr>`;
  s += `</tbody></table>`;

  // Live Load table
  s += `<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:6px">`;
  s += `<thead><tr style="background:#f8fafc"><th style="text-align:left;padding:3px 6px">活荷载 Live Load (LL)</th><th style="text-align:right;padding:3px 6px">kg/m²</th><th style="text-align:left;padding:3px 6px;color:#6b7280">来源 Source</th></tr></thead><tbody>`;
  s += `<tr><td style="padding:2px 6px">${_esc(entry.label)}</td><td style="text-align:right;padding:2px 6px">${res.liveLoad}</td><td style="padding:2px 6px;color:#6b7280;font-size:11px">${_esc(res.llNote)}</td></tr>`;
  if (res.isPool) {
    s += `<tr><td style="padding:2px 6px">泳池水压 Pool water: ${res.poolDepth.toFixed(1)}m × 1000 kg/m³</td><td style="text-align:right;padding:2px 6px">${res.waterLoad.toFixed(0)}</td><td style="padding:2px 6px;color:#6b7280;font-size:11px">水密度=1000 kg/m³, 物理常数</td></tr>`;
    s += `<tr style="background:#fef9c3;font-weight:700"><td style="padding:3px 6px">总活荷载 Total LL</td><td style="text-align:right;padding:3px 6px">${res.totalLL.toFixed(0)}</td><td></td></tr>`;
  }
  s += `</tbody></table>`;

  // Factored load table
  s += `<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:6px">`;
  s += `<thead><tr style="background:#f8fafc"><th style="text-align:left;padding:3px 6px">设计荷载 Design Load (Factored)</th><th style="text-align:right;padding:3px 6px">kg/m²</th><th style="text-align:left;padding:3px 6px;color:#6b7280">来源 Source</th></tr></thead><tbody>`;
  s += `<tr><td style="padding:2px 6px">Pu = 1.2×DL + 1.6×LL = 1.2×${res.totalDL.toFixed(0)} + 1.6×${res.totalLL.toFixed(0)}</td><td style="text-align:right;padding:2px 6px;font-weight:700">${res.factoredLoad.toFixed(1)}</td><td style="padding:2px 6px;color:#6b7280;font-size:11px">ACI 318-19 §5.3.1</td></tr>`;
  s += `<tr style="background:#eff6ff;font-weight:700"><td style="padding:3px 6px">总重 Total (this area): ${res.factoredLoad.toFixed(1)} × ${res.areaM2.toFixed(2)} m²</td><td style="text-align:right;padding:3px 6px">${res.totalFactoredKg.toFixed(0)} kg</td><td></td></tr>`;
  s += `</tbody></table>`;

  // Rebar recommendation
  s += `<div style="margin:6px 0;padding:6px 10px;background:#f8fafc;border-left:3px solid #64748b;border-radius:0 4px 4px 0;font-size:12px">`;
  s += `建议配筋等级: <strong>${rec.label}</strong>&nbsp;(设计荷载 ${res.factoredLoad.toFixed(0)} kg/m²)`;
  s += `<br><span style="color:#6b7280;font-size:11px">注：配筋最终须由结构工程师根据跨度、支承条件等计算确定 / Final reinforcement must be determined by structural engineer.</span>`;
  s += `</div>`;

  s += `<div style="font-size:10px;color:#94a3b8;margin-bottom:6px">标准依据: กฎกระทรวง / ACI 318-19 §5.3.1 / ISO 6707-1</div>`;

  // Column capacity check (preserve existing logic)
  const columns = STATE.components.filter(c => c.type === 'column');
  if (!columns.length) {
    s += `<span class="boq-load-hint">请在构件列表中添加柱规格以查看柱承载力验证</span>`;
  } else {
    const N = columns.reduce((sum, c) => sum + (_n(c.qty) || 1), 0);
    const perColKg = res.totalFactoredKg / (N || 1);
    const col = columns[0];
    const colL_mm = _n(col.L) * 1000;
    const colW_mm = _n(col.W) * 1000;
    const fPrimeMPa = CONCRETE_GRADE_VALS[STATE.global.concreteGrade] || 30;
    let rebarCount = 8, rebarDiaMm = 16;
    if (col.rebar && col.rebar.layers) {
      const ll = col.rebar.layers.find(l => l.key === 'longitudinal');
      if (ll) { rebarCount = parseInt(ll.count) || 8; rebarDiaMm = parseInt(ll.dia) || 16; }
    }
    const fyMPa = 390; // SD40T Thailand — TIS 24-2548
    const cap = calcColumnCapacity(colL_mm, colW_mm, fPrimeMPa, rebarCount, rebarDiaMm, fyMPa);
    const ratio = perColKg > 0 ? cap.kg / perColKg : Infinity;
    const ok = cap.kg >= perColKg;
    s += `<div style="margin-top:6px;padding:8px;background:#f0f9ff;border-radius:6px;font-size:12px">`;
    s += `<strong>荷载传递 Load Path</strong> — 由 ${N} 根柱承受（均匀分配）: 每柱 ${perColKg.toFixed(0)} kg<br>`;
    s += `柱承载力验证 (ACI 318-19 §22.4.2.1): ${colL_mm}×${colW_mm}mm, ${STATE.global.concreteGrade}, ${rebarCount}-φ${rebarDiaMm}<br>`;
    s += `φPn = ${cap.kg.toFixed(0)} kg  |  验证: ${perColKg.toFixed(0)} ${ok ? '<' : '>'} ${cap.kg.toFixed(0)} `;
    s += ok ? `<span class="boq-load-ok">✓ OK</span>` : `<span class="boq-load-warn">✗ 不安全!</span>`;
    s += ` 安全系数 ${isFinite(ratio) ? ratio.toFixed(2) : '∞'}`;
    s += `</div>`;
  }
  return s;
}

function _renderLoadAreas() {
  const container = document.getElementById('boq-load-areas');
  if (!container) return;
  if (!STATE.loadAreas.length) { container.innerHTML = ''; return; }

  container.innerHTML = STATE.loadAreas.map(area => {
    const res = calcLoadArea(area);
    const useOpts = Object.keys(LIVE_LOADS).map(k =>
      `<option value="${k}"${k === area.useType ? ' selected' : ''}>${_esc(LIVE_LOAD_LABELS[k])}</option>`
    ).join('');
    const isPool = ((_LL_ALIAS[area.useType] || area.useType) === 'pool_deck');
    const poolInput = isPool ? `<div>
  <span class="boq-load-label">水深 Pool Depth (m)</span>
  <input type="number" class="boq-load-inp" value="${_n(area.poolDepthM) || 1.5}" min="0.1" max="3" step="0.1"
    oninput="BOQ.loadAreaChange(${area.id},'poolDepthM',this.value)">
  <small style="color:#6b7280;font-size:10px">水压 = ${((_n(area.poolDepthM)||1.5)*1000).toFixed(0)} kg/m² (ρ水=1000 kg/m³, 物理常数)</small>
</div>` : '';
    return `<div class="boq-load-area-card" id="boq-larea-${area.id}">
      <div class="boq-load-area-header">
        <input value="${_esc(area.name)}" class="boq-ti boq-ti-name" placeholder="\u533A\u57DF\u540D\u79F0 Area name"
          oninput="BOQ.loadAreaChange(${area.id},'name',this.value)">
        <button class="boq-btn-sm boq-btn-sm-red" onclick="BOQ.loadRemoveArea(${area.id})">\uD83D\uDDD1</button>
      </div>
      <div class="boq-load-inputs">
        <div>
          <span class="boq-load-label">\u957F L (m)</span>
          <input type="number" class="boq-load-inp" value="${_n(area.slabL)}" min="0.1" step="0.1"
            oninput="BOQ.loadAreaChange(${area.id},'slabL',this.value)">
        </div>
        <div>
          <span class="boq-load-label">\u5BBD W (m)</span>
          <input type="number" class="boq-load-inp" value="${_n(area.slabW)}" min="0.1" step="0.1"
            oninput="BOQ.loadAreaChange(${area.id},'slabW',this.value)">
        </div>
        <div>
          <span class="boq-load-label">\u677F\u539A Slab (mm)</span>
          <input type="number" class="boq-load-inp" value="${_n(area.slabThickMm)}" min="80" step="10"
            oninput="BOQ.loadAreaChange(${area.id},'slabThickMm',this.value)">
        </div>
        <div>
          <span class="boq-load-label">\u4F7F\u7528\u7C7B\u578B Use Type</span>
          <select class="boq-load-sel" onchange="BOQ.loadAreaChange(${area.id},'useType',this.value)">${useOpts}</select>
        </div>
        ${poolInput}
        <div>
          <span class="boq-load-label">\u9762\u5C42 Finishes</span>
          <div class="boq-load-checks">
            <label class="boq-load-check-item">
              <input type="checkbox" ${area.finishes.tilesScreed ? 'checked' : ''}
                onchange="BOQ.loadAreaChange(${area.id},'finishes.tilesScreed',this.checked)">
              \u74F7\u7816+\u627E\u5E73 120 kg/m\xB2
            </label>
            <label class="boq-load-check-item">
              <input type="checkbox" ${area.finishes.plasterBoth ? 'checked' : ''}
                onchange="BOQ.loadAreaChange(${area.id},'finishes.plasterBoth',this.checked)">
              \u53CC\u9762\u6284\u7070 54 kg/m\xB2
            </label>
            <label class="boq-load-check-item">
              <input type="checkbox" ${area.finishes.waterproof ? 'checked' : ''}
                onchange="BOQ.loadAreaChange(${area.id},'finishes.waterproof',this.checked)">
              \u9632\u6C34\u5C42 20 kg/m\xB2
            </label>
          </div>
        </div>
      </div>
      <div class="boq-load-result" id="boq-lresult-${area.id}">${_buildLoadResultHTML(area, res)}</div>
    </div>`;
  }).join('');
}

function _renderLoadSummary() {
  const summary = document.getElementById('boq-load-summary');
  if (!summary) return;
  if (!STATE.loadAreas.length) { summary.style.display = 'none'; return; }
  summary.style.display = '';
  const tbody = document.getElementById('boq-load-tbody');
  const tfoot = document.getElementById('boq-load-tfoot');
  if (!tbody || !tfoot) return;
  let totalArea = 0, totalKg = 0;
  tbody.innerHTML = STATE.loadAreas.map(area => {
    const res = calcLoadArea(area);
    const entry = _llEntry(area.useType);
    const rec = recommendPresetForLoad(res.factoredLoad);
    totalArea += res.areaM2;
    totalKg   += res.totalFactoredKg;
    return `<tr>
      <td>${_esc(area.name)}</td>
      <td style="font-size:11px">${_esc(entry.label)}</td>
      <td class="boq-tr">${res.areaM2.toFixed(2)}</td>
      <td class="boq-tr">${res.totalDL.toFixed(0)}</td>
      <td class="boq-tr">${res.totalLL.toFixed(0)}<br><span style="font-size:10px;color:#6b7280">${_esc(entry.note)}</span></td>
      <td class="boq-tr">${res.factoredLoad.toFixed(1)}</td>
      <td class="boq-tr">${res.totalFactoredKg.toFixed(0)}</td>
      <td style="font-size:11px">${rec.label}</td>
    </tr>`;
  }).join('');
  tfoot.innerHTML = `<tr style="font-weight:700;background:#f0fdf4">
    <td>合计 Total</td><td>—</td>
    <td class="boq-tr">${totalArea.toFixed(2)}</td>
    <td class="boq-tr">—</td><td class="boq-tr">—</td><td class="boq-tr">—</td>
    <td class="boq-tr">${totalKg.toFixed(0)}</td>
    <td>—</td>
  </tr>`;
}

function _renderLoadAll() {
  _renderLoadAreas();
  _renderLoadSummary();
}

// ══════════════════════════════════════════════════════════════
// 10. 图片 Modal
// ══════════════════════════════════════════════════════════════
let _imgList=[], _imgIdx=0;

function _openImgModal(title,imgs){
  _imgList=imgs; _imgIdx=0;
  document.getElementById('boq-img-title').textContent=title;
  document.getElementById('boq-img-tabs').innerHTML=imgs.map((img,i)=>
    `<button class="boq-mtab${i===0?' boq-mtab-a':''}" onclick="BOQ._imgTab(${i})">${i+1}. ${img.title.slice(0,16)}…</button>`).join('');
  _setImgTab(0);
  document.getElementById('boq-img-modal').classList.add('boq-open');
  document.body.style.overflow='hidden';
}
function _setImgTab(i){
  _imgIdx=i;
  document.querySelectorAll('#boq-img-tabs .boq-mtab').forEach((t,j)=>t.classList.toggle('boq-mtab-a',j===i));
  const img=_imgList[i];
  document.getElementById('boq-img-el').src=img.file;
  document.getElementById('boq-img-foot').innerHTML=`<span class="boq-mfoot-ref">📚 ${img.ref}</span>${img.note?`<span class="boq-mfoot-note">${img.note}</span>`:''}`;
}

// ══════════════════════════════════════════════════════════════
// 11. 钢筋 Modal
// ══════════════════════════════════════════════════════════════
let _rbarCompId=null, _rbarRows=[], _rbarNid=1;
const _debouncedRbarRender=_debounce(()=>_renderRebarTable(),200);

function _openRebarModal(id){
  const c=STATE.components.find(x=>x.id===id); if(!c) return;
  _rbarCompId=id; _rbarRows=(c.rebarRows||[]).map(r=>({...r}));
  _rbarNid=_rbarRows.length?Math.max(..._rbarRows.map(r=>r.id))+1:1;
  const db=COMP_DB[c.type]||{};
  document.getElementById('boq-rebar-title').textContent=`🔩 钢筋明细 — ${c.name}`;
  document.getElementById('boq-rebar-sub').textContent=`${db.name||''} | L=${c.L}m W=${c.W}m H=${c.H}m ×${c.qty}件`;
  const tmpl=REBAR_TMPLS[c.type];
  document.getElementById('boq-rebar-tmpl-desc').textContent=tmpl?`建议模板基于：${tmpl.desc}`:'';
  _renderRebarTable();
  document.getElementById('boq-rebar-modal').classList.add('boq-open');
  document.body.style.overflow='hidden';
}

function _renderRebarTable(){
  const tbody=document.getElementById('boq-rebar-tbody'); if(!tbody) return;
  const c=STATE.components.find(x=>x.id===_rbarCompId);
  if(!_rbarRows.length){
    tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">暂无明细 · 点击「加载建议配筋」或「＋ 添加」</td></tr>`;
  } else {
    tbody.innerHTML=_rbarRows.map(r=>{
      const d=BAR_DENSITY[r.dia]||0, wt=calcBarWeight(r.dia,r.count,r.length);
      const opts=BAR_DIAS.map(x=>`<option value="${x}"${x==r.dia?' selected':''}>Φ${x}</option>`).join('');
      return `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:5px 7px"><input style="width:100%;height:28px;border:1.5px solid #e2e8f0;border-radius:4px;padding:0 6px;font-size:11px" value="${_esc(r.name)}" placeholder="如：底筋、箍筋" oninput="BOQ._rbarChange(${r.id},'name',this.value)"></td>
        <td style="padding:5px 7px;text-align:center"><select style="height:28px;border:1.5px solid #e2e8f0;border-radius:4px;padding:0 4px;font-size:11px" onchange="BOQ._rbarChange(${r.id},'dia',this.value)">${opts}</select></td>
        <td style="padding:5px 7px;text-align:center;font-size:11px;color:#94a3b8">${d}</td>
        <td style="padding:5px 7px;text-align:center"><input type="number" min="1" step="1" style="width:58px;height:28px;border:1.5px solid #e2e8f0;border-radius:4px;padding:0 4px;font-size:12px;text-align:center" value="${r.count}" oninput="BOQ._rbarChange(${r.id},'count',this.value)"></td>
        <td style="padding:5px 7px;text-align:center"><input type="number" min="0" step="0.05" style="width:66px;height:28px;border:1.5px solid #e2e8f0;border-radius:4px;padding:0 4px;font-size:12px;text-align:center" value="${r.length}" oninput="BOQ._rbarChange(${r.id},'length',this.value)"></td>
        <td style="padding:5px 7px;text-align:right;font-weight:700">${wt} kg</td>
        <td style="padding:5px 7px"><input style="width:100%;height:28px;border:1.5px solid #e2e8f0;border-radius:4px;padding:0 6px;font-size:11px;color:#64748b" value="${_esc(r.note)}" placeholder="间距、位置等" oninput="BOQ._rbarChange(${r.id},'note',this.value)"></td>
        <td style="padding:5px 4px;text-align:center"><button onclick="BOQ._rbarDel(${r.id})" style="background:none;border:1px solid #fca5a5;border-radius:4px;padding:2px 7px;cursor:pointer;color:#dc2626;font-size:12px">🗑</button></td>
      </tr>`;
    }).join('');
  }
  const total=calcRebarTotal(_rbarRows);
  const qty=_n(c?.qty,1), totalTon=+((total*qty)/1000).toFixed(4);
  const vol=c?.cVol||calcConcreteVol(_n(c?.L),_n(c?.W),_n(c?.H),qty);
  const effR=vol>0?(total/(vol/qty)).toFixed(1):'—';
  const _fl = window._boqFloors || 2;
  const _flMin = STEEL_SAFETY_BY_FLOOR[_fl] || STEEL_SAFETY_BY_FLOOR[2];
  const bl = (_flMin[c?.type]) || 0;
  const rColor=effR!=='—'&&parseFloat(effR)<bl?'#dc2626':'#16a34a';
  _setText('boq-rebar-total',`${total.toFixed(2)} kg`);
  document.getElementById('boq-rebar-info').innerHTML=`折合含钢量: <b style="color:${rColor}">${effR} kg/m³</b>${bl?` (底线${bl})`:''}`;
  _setText('boq-rebar-all-lbl',`全部合计（×${qty}件）`);
  _setText('boq-rebar-all',`${totalTon} ton (${(total*qty).toFixed(1)} kg)`);
}

// ══════════════════════════════════════════════════════════════
// 11b. 配筋内联面板 (Inline Rebar Config Panel)
// ══════════════════════════════════════════════════════════════
function _buildRebarCfgLayerInputsHTML(comp){
  const defs=REBAR_LAYER_DEFS[comp.type];
  if(!defs||!defs.length) return '<p style="color:#94a3b8;font-size:12px">该构件类型暂无配筋层定义</p>';
  const savedLayers=(comp.rebar&&comp.rebar.layers)||[];
  return defs.map(def=>{
    const saved=savedLayers.find(l=>l.key===def.key)||{};
    const dia=saved.dia||def.diaDefault;
    const diaOpts=[6,8,10,12,14,16,18,20,22,25].map(d=>`<option value="${d}"${d==dia?' selected':''}>φ${d}</option>`).join('');
    if(def.inputType==='spacing'){
      const sp=saved.spacing||def.spacingDefault;
      return `<div class="boq-rcfg-row">
        <label>${def.label}</label>
        <select class="boq-rcfg-input boq-rcfg-dia" id="boq-rcfg-${comp.id}-${def.key}-dia" onchange="BOQ.rebarCfgChange(${comp.id})">${diaOpts}</select>
        <span class="boq-rcfg-sep">@</span>
        <input type="number" class="boq-rcfg-input boq-rcfg-sp" id="boq-rcfg-${comp.id}-${def.key}-spacing" value="${sp}" min="50" step="25" oninput="BOQ.rebarCfgChange(${comp.id})">
        <span class="boq-rcfg-sep">mm</span>
      </div>`;
    } else if(def.inputType==='count'){
      const cnt=saved.count!=null?saved.count:def.countDefault;
      return `<div class="boq-rcfg-row">
        <label>${def.label}</label>
        <select class="boq-rcfg-input boq-rcfg-dia" id="boq-rcfg-${comp.id}-${def.key}-dia" onchange="BOQ.rebarCfgChange(${comp.id})">${diaOpts}</select>
        <span class="boq-rcfg-sep">×</span>
        <input type="number" class="boq-rcfg-input boq-rcfg-cnt" id="boq-rcfg-${comp.id}-${def.key}-count" value="${cnt}" min="1" step="1" oninput="BOQ.rebarCfgChange(${comp.id})">
        <span class="boq-rcfg-sep">根</span>
      </div>`;
    } else { // tie
      const spH=saved.spacingH||def.spacingHDefault;
      const spV=saved.spacingV||def.spacingVDefault;
      return `<div class="boq-rcfg-row">
        <label>${def.label}</label>
        <select class="boq-rcfg-input boq-rcfg-dia" id="boq-rcfg-${comp.id}-${def.key}-dia" onchange="BOQ.rebarCfgChange(${comp.id})">${diaOpts}</select>
        <span class="boq-rcfg-sep">@</span>
        <input type="number" class="boq-rcfg-input boq-rcfg-sp" id="boq-rcfg-${comp.id}-${def.key}-spacingH" value="${spH}" min="50" step="25" oninput="BOQ.rebarCfgChange(${comp.id})">
        <span class="boq-rcfg-sep">×</span>
        <input type="number" class="boq-rcfg-input boq-rcfg-sp" id="boq-rcfg-${comp.id}-${def.key}-spacingV" value="${spV}" min="50" step="25" oninput="BOQ.rebarCfgChange(${comp.id})">
        <span class="boq-rcfg-sep">mm</span>
      </div>`;
    }
  }).join('');
}

function boqLoadPreset(compId, level) {
  const comp = STATE.components.find(c => c.id === compId);
  if (!comp) return;
  const typeMap = {
    retainingWall: 'retainingWall', basementWall: 'retainingWall',
    column: 'column', beam: 'beam',
    slab: 'slab', foundation: 'slab',
  };
  const presetKey = typeMap[comp.type];
  if (!presetKey || !REBAR_PRESETS[presetKey]) return;
  const layers = REBAR_PRESETS[presetKey][level];
  if (!layers) return;
  if (!comp.rebar) comp.rebar = {};
  comp.rebar.layers = layers.map(function(l){ return Object.assign({}, l); });
  comp.rebar.preset = level;
  // Re-render panel: close and reopen so inputs reflect new values
  const existingRow = document.getElementById('boq-rebar-cfg-' + compId);
  if (existingRow) {
    existingRow.remove();
    boqToggleRebarConfig(compId);
  }
  const labels = { min:'最低安全线', std:'标准推荐', high:'高级保守' };
  boqToast('已加载' + (labels[level] || level) + '配筋 (' + presetKey + ')', 'info');
}
window.boqLoadPreset = boqLoadPreset;

function boqToggleRebarConfig(id){
  const existingRow=document.getElementById('boq-rebar-cfg-'+id);
  if(existingRow){ existingRow.remove(); return; }
  const mainRow=document.getElementById('boq-row-'+id);
  if(!mainRow) return;
  const comp=STATE.components.find(function(x){ return x.id===id; });
  if(!comp) return;
  const activePreset = comp.rebar && comp.rebar.preset ? comp.rebar.preset : null;
  const presetLabels = { min:'🟢 最低', std:'🟡 标准', high:'🔴 高级', custom:'✏️ 自定义' };
  const activeBadge = activePreset
    ? '<span id="boq-preset-badge-'+id+'" style="font-size:11px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:2px 6px;color:#15803d;margin-left:8px">'+(presetLabels[activePreset]||activePreset)+'</span>'
    : '<span id="boq-preset-badge-'+id+'" style="font-size:11px;color:#94a3b8;margin-left:8px">未选择预设</span>';
  function btnStyle(level){
    var base='flex:1;min-height:44px;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;';
    var colors={ min:'background:#22c55e;color:#fff;', std:'background:#f59e0b;color:#fff;', high:'background:#ef4444;color:#fff;' };
    var active = activePreset===level ? 'outline:3px solid #1e40af;outline-offset:2px;' : '';
    return base+(colors[level]||'')+active;
  }
  const newRow=document.createElement('tr');
  newRow.id='boq-rebar-cfg-'+id;
  newRow.innerHTML='<td colspan="12"><div class="boq-rcfg-panel">'
    +'<div class="boq-rcfg-header">'
    +'<span>🔧 钢筋配置 Rebar Configuration — '+_esc(comp.name)+activeBadge+'</span>'
    +'<button onclick="BOQ.toggleRebarCfg('+id+')">✕ 关闭</button>'
    +'</div>'
    +'<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">'
    +'<button id="boq-preset-btn-'+id+'-min" onclick="boqLoadPreset('+id+',\'min\')" style="'+btnStyle('min')+'">'
    +'🟢 最低安全线<br><small style="font-weight:400;font-size:0.75rem;">Code Minimum</small></button>'
    +'<button id="boq-preset-btn-'+id+'-std" onclick="boqLoadPreset('+id+',\'std\')" style="'+btnStyle('std')+'">'
    +'🟡 标准推荐<br><small style="font-weight:400;font-size:0.75rem;">Standard</small></button>'
    +'<button id="boq-preset-btn-'+id+'-high" onclick="boqLoadPreset('+id+',\'high\')" style="'+btnStyle('high')+'">'
    +'🔴 高级保守<br><small style="font-weight:400;font-size:0.75rem;">Premium Safe</small></button>'
    +'</div>'
    +'<div style="font-size:0.75rem;color:#6b7280;margin-bottom:10px;">依据: EIT Thailand / ACI 318-19 / TIS 24-2548</div>'
    +'<div class="boq-rcfg-inputs">'+_buildRebarCfgLayerInputsHTML(comp)+'</div>'
    +'<div class="boq-rcfg-results" id="boq-rcfg-results-'+id+'"></div>'
    +'<div class="boq-rcfg-footer">'
    +'<div class="boq-rcfg-total" id="boq-rcfg-total-'+id+'">钢筋合计: —</div>'
    +'<button class="boq-btn-update" onclick="BOQ.applyRebarCfg('+id+')">✅ 更新主表 Update Component</button>'
    +'</div></div></td>';
  mainRow.insertAdjacentElement('afterend', newRow);
  boqRebarCfgRecalc(id);
}

function _readCfgLayerValues(id){
  const comp=STATE.components.find(x=>x.id===id);
  if(!comp) return {};
  const defs=REBAR_LAYER_DEFS[comp.type]||[];
  const layerValues={};
  defs.forEach(def=>{
    const dia=parseFloat(document.getElementById(`boq-rcfg-${id}-${def.key}-dia`)?.value)||def.diaDefault;
    if(def.inputType==='spacing'){
      const spacing=parseFloat(document.getElementById(`boq-rcfg-${id}-${def.key}-spacing`)?.value)||def.spacingDefault;
      layerValues[def.key]={dia,spacing};
    } else if(def.inputType==='count'){
      const count=parseFloat(document.getElementById(`boq-rcfg-${id}-${def.key}-count`)?.value)||def.countDefault;
      layerValues[def.key]={dia,count};
    } else {
      const spacingH=parseFloat(document.getElementById(`boq-rcfg-${id}-${def.key}-spacingH`)?.value)||def.spacingHDefault;
      const spacingV=parseFloat(document.getElementById(`boq-rcfg-${id}-${def.key}-spacingV`)?.value)||def.spacingVDefault;
      layerValues[def.key]={dia,spacingH,spacingV};
    }
  });
  return layerValues;
}

function boqRebarCfgRecalc(id){
  const comp=STATE.components.find(x=>x.id===id);
  if(!comp) return;
  const defs=REBAR_LAYER_DEFS[comp.type];
  if(!defs) return;
  const layerValues=_readCfgLayerValues(id);
  const {results,totalKg,totalTon}=calcRebarConfigLayers(comp,layerValues);
  const resEl=document.getElementById(`boq-rcfg-results-${id}`);
  if(resEl){
    resEl.innerHTML=`<table>${results.map(r=>`<tr><td>${r.label}</td><td>${r.count} × ${r.length.toFixed(2)}m × φ${r.dia}</td><td>${r.kg.toFixed(1)} kg</td></tr>`).join('')}</table>`;
  }
  const totEl=document.getElementById(`boq-rcfg-total-${id}`);
  if(totEl) totEl.textContent=`钢筋合计: ${totalKg.toFixed(0)} kg = ${totalTon.toFixed(3)} TON`;
}

function boqApplyRebarCfg(id){
  const comp=STATE.components.find(x=>x.id===id);
  if(!comp) return;
  const defs=REBAR_LAYER_DEFS[comp.type];
  if(!defs) return;
  const layerValues=_readCfgLayerValues(id);
  const {totalKg,totalTon}=calcRebarConfigLayers(comp,layerValues);
  const layers=defs.map(def=>{
    const v=layerValues[def.key]||{};
    return {key:def.key,...v};
  });
  comp.rebar={type:comp.type, layers, calculatedKg:totalKg};
  const cfgRow=document.getElementById(`boq-rebar-cfg-${id}`);
  if(cfgRow) cfgRow.remove();
  _recalcRender();
  boqToast(`✅ 钢筋配置已更新 | ${totalKg.toFixed(0)} kg = ${(totalKg/1000).toFixed(3)} TON`,'info');
}

// ══════════════════════════════════════════════════════════════
// 12. 事件绑定 (Events)
// ══════════════════════════════════════════════════════════════
function _bindEvents(){
  // 全局设置
  ['seismicLevel','concreteGrade','currency'].forEach(id=>{
    document.getElementById(id)?.addEventListener('change',e=>boqGlobalChange(id,e.target.value));
  });
  ['concreteLossRate','steelLossRate','concretePriceMin','concretePriceMax','steelPriceMin','steelPriceMax','formworkPriceMin','formworkPriceMax'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',_debounce(e=>boqGlobalChange(id,e.target.value)));
  });
  // 添加构件
  document.getElementById('boq-add-btn')?.addEventListener('click',()=>boqAddComp());
  // 表格委托
  const tbody=document.getElementById('boq-tbody');
  if(tbody){
    tbody.addEventListener('input',_debounce(e=>{const t=e.target;if(!t.dataset.id)return;boqFieldChange(+t.dataset.id,t.dataset.f,t.value);}));
    tbody.addEventListener('change',e=>{const t=e.target;if(!t.dataset.id||t.tagName!=='SELECT')return;boqFieldChange(+t.dataset.id,t.dataset.f,t.value);});
  }
  // ESC 关闭 modal
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){BOQ.hideImg();BOQ.hideRebar();}});
}

// ══════════════════════════════════════════════════════════════
// 13. 公开 API (window.BOQ)
// ══════════════════════════════════════════════════════════════
const BOQ = {
  // 初始化（首次进入BOQ视图时调用）
  onShow(){
    const proj=window.app?.currentProject;
    if(proj){
      STATE.projectId=proj.id;
      STATE.projectName=proj.name;
      _setText('boq-proj-tag',`📁 ${proj.name}`);
    }
    _loadLS();
    // 同步全局设置到 UI
    ['seismicLevel','concreteGrade','currency','concreteLossRate','steelLossRate',
     'concretePriceMin','concretePriceMax','steelPriceMin','steelPriceMax','formworkPriceMin','formworkPriceMax'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.value=STATE.global[id]??el.value;
    });
    _bindEvents();
    _initTooltip();
    // 如果空白则加示例
    if(!STATE.components.length){
      ['retainingWall','column','slab','foundation'].forEach(t=>boqAddComp(t));
    } else {
      _recalcRender();
    }
    // Init floor selector active button from localStorage
    const _fl = window._boqFloors;
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById('boq-fl-' + i);
      if (btn) btn.classList.toggle('boq-fl-active', i === _fl);
    }
  },
  // 添加/删除构件
  add(type){ boqAddComp(type); },
  rm(id){ boqRemoveComp(id); },
  // 图片 Modal
  showImgs(type){ const imgs=COMP_IMAGES[type]; if(imgs?.length) _openImgModal(COMP_DB[type]?.name||type, imgs); },
  showGeneral(){ _openImgModal('16G101-1 通用规范图', GENERAL_IMAGES); },
  hideImg(){ document.getElementById('boq-img-modal')?.classList.remove('boq-open'); document.body.style.overflow=''; },
  _imgTab(i){ _setImgTab(i); },
  // 钢筋 Modal
  showRebar(id){ _openRebarModal(id); },
  hideRebar(){ document.getElementById('boq-rebar-modal')?.classList.remove('boq-open'); document.body.style.overflow=''; },
  _rbarChange(rid,field,val){
    const r=_rbarRows.find(x=>x.id===rid); if(!r) return;
    r[field]=['dia','count','length'].includes(field)?parseFloat(val)||0:val;
    _debouncedRbarRender();
  },
  _rbarDel(rid){ _rbarRows=_rbarRows.filter(r=>r.id!==rid); _renderRebarTable(); },
  rbarAdd(){
    _rbarRows.push({id:_rbarNid++,name:'',dia:16,count:1,length:1.0,note:''});
    _renderRebarTable();
  },
  rbarLoad(){
    const c=STATE.components.find(x=>x.id===_rbarCompId); if(!c) return;
    const t=REBAR_TMPLS[c.type]; if(!t){boqToast('该构件暂无建议配筋模板','info');return;}
    if(_rbarRows.length&&!confirm('将替换当前钢筋明细，确定吗？')) return;
    _rbarRows=t.rows.map(r=>({...r,id:_rbarNid++})); _renderRebarTable();
    boqToast(`已加载建议配筋：${t.desc}`,'info');
  },
  rbarLoadPreset(level) {
      const comp = STATE.components.find(x => x.id === _rbarCompId);
      if (!comp) return;

      const typeMap = {
          retainingWall: 'retainingWall', basementWall: 'retainingWall',
          column: 'column', beam: 'beam', slab: 'slab', foundation: 'slab',
      };
      const presetKey = typeMap[comp.type];
      if (!presetKey || !REBAR_PRESETS?.[presetKey]?.[level]) {
          boqToast('该构件暂无此等级预设 / No preset for this type', 'info');
          return;
      }

      if (_rbarRows.length && !confirm('将替换当前钢筋明细，确定吗？')) return;

      const layers = REBAR_PRESETS[presetKey][level];
      const L = _n(comp.L), W = _n(comp.W), H = _n(comp.H);
      _rbarNid = _rbarNid || 1;

      _rbarRows = layers.map(layer => {
          const dia = layer.dia;
          const uw = REBAR_UNIT_WEIGHT[dia] || (dia * dia / 162.27);
          let count = layer.count || 0;
          let length = 0;

          if (layer.spacingH !== undefined) {
              // Tie bar — uses spacingH × spacingV grid
              const sh = layer.spacingH || 600;  // mm
              const sv = layer.spacingV || layer.spacingH || 600;  // mm
              count  = Math.max(1, Math.ceil(L / (sh / 1000))) * Math.max(1, Math.ceil(H / (sv / 1000)));
              length = Math.max(0.05, W - 0.05);
          } else if (layer.spacing) {
              const isVertical = layer.name.includes('竖') || layer.name.includes('Vert');
              const isHoriz    = layer.name.includes('水平') || layer.name.includes('Horiz') || layer.name.includes('水');

              if (isVertical) {
                  count = Math.ceil(L / (layer.spacing / 1000)) + 1;
                  length = H + 0.3;
              } else if (isHoriz) {
                  count = Math.ceil(H / (layer.spacing / 1000)) + 1;
                  length = L + 0.3;
              } else {
                  count = Math.ceil(L / (layer.spacing / 1000)) + 1;
                  length = W + 0.15;
              }
          } else if (layer.count) {
              count = layer.count;
              length = L + 0.6;
          }

          count  = Math.max(1, Math.round(count));
          length = Math.max(0.1, Math.round(length * 100) / 100);

          return { id: _rbarNid++, name: layer.name, dia, lineWeight: uw, count, length, note: layer.note || '' };
      });

      _renderRebarTable();

      ['min','std','high'].forEach(l => {
          const btn = document.querySelector(`.boq-preset-${l}`);
          if (btn) btn.style.opacity = l === level ? '1' : '0.55';
      });

      const labels = { min:'最低安全线', std:'标准推荐', high:'高级保守' };
      boqToast(`已加载 ${labels[level]} 配筋 (${presetKey})`, 'info');
  },
  rbarClear(){ if(!_rbarRows.length||confirm('确定清空？')){_rbarRows=[];_renderRebarTable();} },
  rbarApply(){
    const c=STATE.components.find(x=>x.id===_rbarCompId); if(!c) return;
    if(_rbarRows.length){ c.rebarRows=[..._rbarRows.map(r=>({...r}))]; boqToast('✅ 已应用钢筋明细','info'); }
    else { delete c.rebarRows; boqToast('已清空钢筋明细，恢复系数估算','info'); }
    BOQ.hideRebar(); _recalcRender();
  },
  // 配筋内联面板
  toggleRebarCfg(id){ boqToggleRebarConfig(id); },
  rebarCfgChange(id){
    var comp=STATE.components.find(function(x){ return x.id===id; });
    if(comp && comp.rebar && comp.rebar.preset && comp.rebar.preset!=='custom'){
      comp.rebar.preset='custom';
      var badge=document.getElementById('boq-preset-badge-'+id);
      if(badge){ badge.textContent='✏️ 自定义'; badge.style.color='#64748b'; badge.style.background='#f8fafc'; badge.style.borderColor='#e2e8f0'; }
      ['min','std','high'].forEach(function(l){
        var btn=document.getElementById('boq-preset-btn-'+id+'-'+l);
        if(btn) btn.style.outline='none';
      });
    }
    boqRebarCfgRecalc(id);
  },
  applyRebarCfg(id) { boqApplyRebarCfg(id); },
  // 荷载计算公开API
  loadAddArea() {
    const id = STATE.nextId();
    STATE.loadAreas.push({
      id,
      name: `\u533A\u57DF-${id}`,
      slabL: 5.0,
      slabW: 4.0,
      slabThickMm: 120,
      useType: 'bedroom',
      finishes: { tilesScreed: true, plasterBoth: true, waterproof: false },
    });
    _renderLoadAll();
    _autoSave();
  },
  loadRemoveArea(id) {
    STATE.loadAreas = STATE.loadAreas.filter(a => a.id !== id);
    _renderLoadAll();
    _autoSave();
  },
  loadAreaChange(id, field, val) {
    const area = STATE.loadAreas.find(x => x.id === id);
    if (!area) return;
    if (field.startsWith('finishes.')) {
      const key = field.slice(9);
      area.finishes[key] = (val === true || val === 'true');
    } else if (['slabL', 'slabW', 'poolDepthM'].includes(field)) {
      area[field] = parseFloat(val) || 0;
    } else if (field === 'slabThickMm') {
      area[field] = parseInt(val) || 120;
    } else {
      area[field] = val;
    }
    _renderLoadAll();
    _autoSave();
  },
};

window.BOQ = BOQ;

})(window);
