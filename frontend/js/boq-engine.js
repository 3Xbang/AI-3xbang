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
const SAFETY_BASELINES = {
  steelRatio: {
    retainingWall:{ min:130, warn:'挡土墙含钢量<130 kg/m³，低于安全底线（GB 50010）' },
    column:       { min:100, warn:'框架柱含钢量<100 kg/m³，低于安全底线（GB 50010 第11章）' },
    beam:         { min:80,  warn:'框架梁含钢量<80 kg/m³，低于安全底线（GB 50010 第6章）' },
    slab:         { min:70,  warn:'楼板含钢量<70 kg/m³，低于安全底线（GB 50010 第7章）' },
    foundation:   { min:50,  warn:'基础含钢量<50 kg/m³，低于安全底线（GB 50010 第8章）' },
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
  const bl=SAFETY_BASELINES.steelRatio[typeKey];
  if(bl&&_n(ratio)<bl.min) w.push({field:'steelRatio',message:bl.warn,level:'error'});
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
// 6. 状态管理 (State)
// ══════════════════════════════════════════════════════════════
const STATE = {
  global: {...DEFAULT_SETTINGS},
  components: [],
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
    localStorage.setItem(key,JSON.stringify({global:STATE.global,components:STATE.components,_nid:STATE._nid}));
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
    const bl=SAFETY_BASELINES.steelRatio[c.type], ratioErr=bl&&(c.effRatio||0)<bl.min;
    const cur=STATE.global.currency;
    const cMin=_fmt(c.cost?.total?.min), cMax=_fmt(c.cost?.total?.max);
    const tags=(c.mats||[]).map(m=>`<span class="boq-tag ${m.critical?'boq-tag-crit':'boq-tag-norm'}" title="${_esc(m.tooltip)}">${m.name} <b>${m.qty}</b>${m.unit}</span>`).join('');
    const typeOpts=COMP_TYPE_LIST.map(t=>`<option value="${t.key}"${t.key===c.type?' selected':''}>${t.name}</option>`).join('');
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
  const bl=SAFETY_BASELINES.steelRatio[c?.type]?.min||0;
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

function boqToggleRebarConfig(id){
  const existingRow=document.getElementById(`boq-rebar-cfg-${id}`);
  if(existingRow){ existingRow.remove(); return; }
  const mainRow=document.getElementById(`boq-row-${id}`);
  if(!mainRow) return;
  const comp=STATE.components.find(x=>x.id===id);
  if(!comp) return;
  const newRow=document.createElement('tr');
  newRow.id=`boq-rebar-cfg-${id}`;
  newRow.innerHTML=`<td colspan="12"><div class="boq-rcfg-panel">
    <div class="boq-rcfg-header">
      <span>🔧 钢筋配置 Rebar Configuration — ${_esc(comp.name)}</span>
      <button onclick="BOQ.toggleRebarCfg(${id})">✕ 关闭</button>
    </div>
    <div class="boq-rcfg-inputs">${_buildRebarCfgLayerInputsHTML(comp)}</div>
    <div class="boq-rcfg-results" id="boq-rcfg-results-${id}"></div>
    <div class="boq-rcfg-footer">
      <div class="boq-rcfg-total" id="boq-rcfg-total-${id}">钢筋合计: —</div>
      <button class="boq-btn-update" onclick="BOQ.applyRebarCfg(${id})">✅ 更新主表 Update Component</button>
    </div>
  </div></td>`;
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
  rbarClear(){ if(!_rbarRows.length||confirm('确定清空？')){_rbarRows=[];_renderRebarTable();} },
  rbarApply(){
    const c=STATE.components.find(x=>x.id===_rbarCompId); if(!c) return;
    if(_rbarRows.length){ c.rebarRows=[..._rbarRows.map(r=>({...r}))]; boqToast('✅ 已应用钢筋明细','info'); }
    else { delete c.rebarRows; boqToast('已清空钢筋明细，恢复系数估算','info'); }
    BOQ.hideRebar(); _recalcRender();
  },
  // 配筋内联面板
  toggleRebarCfg(id){ boqToggleRebarConfig(id); },
  rebarCfgChange(id){ boqRebarCfgRecalc(id); },
  applyRebarCfg(id) { boqApplyRebarCfg(id); },
};

window.BOQ = BOQ;

})(window);
