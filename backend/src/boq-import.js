// 工程量清单（BOQ）导入：读取 Excel(.xlsx)，把清单行对应到总库工序并换算单位。
// 只做“读取 + 对应 + 预览”，不碰数据库；写入由调用者在用户确认后执行。
// 对应规则按清单的“章节名 + 项目名”匹配，按 Mira NO.1 (Samui Perfect Living MASTER BOQ) 写成；
// 换了格式不同的清单，对不上的项目会进入“未对应”，不会被悄悄丢弃或乱填。

const zlib = require('zlib');

// ---------- 最小 zip 读取（xlsx 就是 zip） ----------
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 Excel 文件（.xlsx）');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Excel 文件结构损坏');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    files.set(name, { method, csize, off });
    p += 46 + nlen + elen + clen;
  }
  return {
    names: () => Array.from(files.keys()),
    read(name) {
      const f = files.get(name);
      if (!f) return null;
      const lh = f.off;
      const start = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
      const raw = buf.subarray(start, start + f.csize);
      return (f.method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    }
  };
}

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function parseSheets(buf) {
  const zip = readZip(buf);
  const ssXml = zip.read('xl/sharedStrings.xml') || '';
  const strs = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const out = [];
  zip.names().filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).forEach(n => {
    const xml = zip.read(n);
    const rows = [];
    for (const r of xml.matchAll(/<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = {};
      for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const body = c[3] || '';
        let val = null;
        const v = body.match(/<v>([\s\S]*?)<\/v>/);
        if (/t="inlineStr"/.test(c[2])) val = unesc([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
        else if (v) val = /t="s"/.test(c[2]) ? strs[+v[1]] : (/t="str"/.test(c[2]) ? unesc(v[1]) : v[1]);
        if (val !== null && val !== '') cells[c[1]] = val;
      }
      if (Object.keys(cells).length) rows.push({ row: +r[1], cells });
    }
    out.push({ name: n, rows });
  });
  return out;
}

// ---------- 把表格读成 章节 + 项目行 ----------
const num = v => { if (v == null) return null; const x = Number(String(v).replace(/,/g, '')); return Number.isFinite(x) ? x : null; };
const isIntLike = v => v != null && /^\d+(\.0+)?$/.test(String(v).trim());

function readBoq(buf) {
  const sheets = parseSheets(buf);
  let best = null;
  sheets.forEach(sh => {
    const head = sh.rows.find(r => Object.values(r.cells).some(t => /^description$/i.test(String(t).trim())));
    if (!head) return;
    const col = re => Object.keys(head.cells).find(k => re.test(String(head.cells[k]).trim()));
    const descCol = col(/^description$/i), qtyCol = col(/^(quantity|qty\.?)$/i), unitCol = col(/^unit$/i);
    if (!descCol || !qtyCol || !unitCol) return;
    if (!best || sh.rows.length > best.sheet.rows.length) best = { sheet: sh, head, descCol, qtyCol, unitCol };
  });
  if (!best) throw new Error('没有找到清单表格：需要有 Description、Quantity、Unit 三列的表头');
  const { sheet, head, descCol, qtyCol, unitCol } = best;
  const itemCol = Object.keys(head.cells).sort()[0];

  const items = [];
  let section = null;
  sheet.rows.filter(r => r.row > head.row).forEach(r => {
    const desc = r.cells[descCol] ? String(r.cells[descCol]).trim() : '';
    const qty = num(r.cells[qtyCol]);
    const unit = r.cells[unitCol] ? String(r.cells[unitCol]).trim() : '';
    const itemNo = r.cells[itemCol];
    if (!desc) return;
    if (qty == null && !unit && isIntLike(itemNo)) { section = desc.replace(/\s+/g, ' '); return; }   // 章节标题行
    if (/^total/i.test(String(itemNo || ''))) return;
    items.push({ row: r.row, section: section || '', desc: desc.replace(/\s+/g, ' '), qty, unit });
  });
  return { sheetName: sheet.name, items };
}

// ---------- 对应规则 ----------
const norm = u => {
  const s = String(u || '').toLowerCase().replace(/[\s.]/g, '');
  if (['cum', 'm3', 'cumeter'].includes(s)) return 'm³';
  if (['sqm', 'm2'].includes(s)) return 'm²';
  if (['kg', 'kgs'].includes(s)) return 'kg';
  if (['m', 'meter', 'metre'].includes(s)) return 'm';
  if (['set', 'piece', 'panel', 'pc', 'pcs', 'unit', 'ea'].includes(s)) return '个';
  if (['lot', 'job', 'ls'].includes(s)) return '项';
  return s;
};

// to: 工序编码；floor: 数字=指定楼层，'split'=按各层权重分摊，null=整栋(once)工序
// conv: 单位换算；split 的权重 w: 'area'(各层地面面积) | 'wet'(各层湿区数量)
const WALL_THICKNESS_M = 0.10;   // 砌块/红砖墙厚折算 m²→m³ 的假设，导入预览里会明示
const RULES = [
  // 基础
  { sec: /foundation/i, d: /^excavation/i, to: 'B01', floor: null },
  { sec: /foundation/i, d: /^lean concrete/i, to: 'B04', floor: null },
  { sec: /foundation/i, d: /^concrete/i, to: 'B08', floor: null },
  { sec: /foundation/i, d: /^formwork/i, to: 'B07', floor: null },
  { sec: /foundation/i, d: /^(rb|db)\s*\d+/i, to: 'B06', floor: null, conv: 'kg_t' },
  // 柱墩并入基础（浇筑、模板、钢筋与基础同批）
  { sec: /(strump|stump)/i, d: /^concrete/i, to: 'B08', floor: null, note: '含柱墩' },
  { sec: /(strump|stump)/i, d: /^formwork/i, to: 'B07', floor: null, note: '含柱墩' },
  { sec: /(strump|stump)/i, d: /^(rb|db)\s*\d+/i, to: 'B06', floor: null, conv: 'kg_t', note: '含柱墩' },
  // 梁板（清单按层给，柱没有单列）
  { sec: /beam work.*ground/i, d: /^concrete/i, to: 'C06', floor: 1 },
  { sec: /beam work.*ground/i, d: /^formwork/i, to: 'C04', floor: 1 },
  { sec: /beam work.*ground/i, d: /^(rb|db)\s*\d+/i, to: 'C05', floor: 1, conv: 'kg_t' },
  { sec: /beam work.*second/i, d: /^concrete/i, to: 'C06', floor: 2 },
  { sec: /beam work.*second/i, d: /^formwork/i, to: 'C04', floor: 2 },
  { sec: /beam work.*second/i, d: /^(rb|db)\s*\d+/i, to: 'C05', floor: 2, conv: 'kg_t' },
  // 屋面
  { sec: /^roof/i, d: /(metal|matal) sheet/i, to: ['D02', 'D06'], floor: null, note: '用屋面铁皮面积代表屋面面积' },
  // 一层 / 二层建筑
  { sec: /architectural\s+first/i, d: /(lightweight|red brick|brick|block)/i, to: 'C09', floor: 1, conv: 'm2_m3' },
  { sec: /architectural\s+second/i, d: /(lightweight|red brick|brick|block)/i, to: 'C09', floor: 2, conv: 'm2_m3' },
  { sec: /architectural\s+first/i, d: /plaster/i, to: 'F02', floor: 1 },
  { sec: /architectural\s+second/i, d: /plaster/i, to: 'F02', floor: 2 },
  { sec: /architectural\s+first/i, d: /wall tile/i, to: 'F07', floor: 1 },
  { sec: /architectural\s+second/i, d: /wall tile/i, to: 'F07', floor: 2 },
  { sec: /architectural\s+first/i, d: /floor tile/i, to: 'F08', floor: 1 },
  { sec: /architectural\s+second/i, d: /floor tile/i, to: 'F08', floor: 2 },
  // 门
  { sec: /^doors/i, d: /^d\d+/i, to: ['F18', 'F19'], floor: 'split', w: 'area' },
  // 洁具
  { sec: /sanitary\s*ware/i, d: /^toilet$/i, to: 'F26', floor: 'split', w: 'bath' },
  { sec: /sanitary\s*ware/i, d: /^shower/i, to: 'F27', floor: 'split', w: 'bath', optional: true },
  // 电
  { sec: /^electrical/i, d: /load center/i, to: 'E07', floor: null },
  { sec: /^electrical/i, d: /down\s*light/i, to: 'F30', floor: 'split', w: 'area' },
  { sec: /^electrical/i, d: /^(switch|plug)/i, to: 'F31', floor: 'split', w: 'area' },
  // 排水
  { sec: /^sanitary\s*$/i, d: /septic tank/i, to: 'H01', floor: null },
  { sec: /^sanitary\s*$/i, d: /^pvc/i, to: 'E04', floor: 'split', w: 'wet' },
  // 油漆与吊顶
  { sec: /paint/i, d: /(interior painting|ceiling painting)/i, to: 'F15', floor: 'split', w: 'area' },
  { sec: /paint/i, d: /exterior painting/i, to: 'G03', floor: 'split', w: 'area' },
  { sec: /paint/i, d: /ceiling work in/i, to: ['F10', 'F11'], floor: 'split', w: 'area' }
];

const CONSUMABLE = /^(nail|wire|wire mesh)$/i;

function allocate(total, weights) {
  const sum = weights.reduce((s, x) => s + x.w, 0);
  const useEq = !(sum > 0);
  const parts = weights.map(x => ({ floor: x.floor, v: total * (useEq ? 1 / weights.length : x.w / sum) }));
  return parts;
}

// plan: generatePlan() 的结果（tasks 带 key/code/floor/unit/zh）；profile: normalizeProfile 的结果
function mapBoq(boq, plan, profile) {
  const tasksByKey = new Map(plan.tasks.map(t => [t.key, t]));
  const floors = Array.from({ length: profile.floorCount }, (_, i) => i + 1);

  // 各层地面面积（来自清单里的地砖）= 分摊用的权重
  const areaByFloor = {};
  floors.forEach(f => { areaByFloor[f] = 0; });
  boq.items.forEach(it => {
    const m = /architectural\s+(first|second|third|fourth)/i.exec(it.section);
    if (!m || !/floor tile/i.test(it.desc) || it.qty == null) return;
    const f = { first: 1, second: 2, third: 3, fourth: 4 }[m[1].toLowerCase()];
    if (areaByFloor[f] != null) areaByFloor[f] += it.qty;
  });

  const bucket = new Map();     // key -> { sources:[], notes:Set, kinds:Set, value }
  const unmapped = [], warnings = [], notInPlan = [];
  const add = (key, srcQty, src, kind, note) => {
    if (!bucket.has(key)) bucket.set(key, { value: 0, sources: [], notes: new Set(), kinds: new Set() });
    const b = bucket.get(key);
    b.value += srcQty; b.sources.push(src); b.kinds.add(kind); if (note) b.notes.add(note);
  };

  boq.items.forEach(it => {
    if (it.qty == null || it.qty === 0) {
      if (it.qty === 0) return;
      unmapped.push({ section: it.section, desc: it.desc, qty: null, unit: it.unit, reason: '清单里没有填数量' });
      return;
    }
    const rule = RULES.find(r => r.sec.test(it.section) && r.d.test(it.desc));
    if (!rule) {
      unmapped.push({ section: it.section, desc: it.desc, qty: it.qty, unit: it.unit,
        reason: CONSUMABLE.test(it.desc) ? '耗材，以后做材料采购用' : '没有对应的工序（多为材料明细或清单独有项目）' });
      return;
    }
    let q = it.qty, kind = 'direct';
    if (rule.conv === 'kg_t') {
      if (norm(it.unit) !== 'kg') warnings.push(`第 ${it.row} 行「${it.section} / ${it.desc}」单位写的是 ${it.unit}，但这是钢筋，已按公斤处理，请核对清单`);
      q = it.qty / 1000; kind = 'converted';
    } else if (rule.conv === 'm2_m3') {
      q = it.qty * WALL_THICKNESS_M; kind = 'converted';
    }
    const src = { desc: it.desc, qty: it.qty, unit: it.unit, row: it.row };
    const targets = Array.isArray(rule.to) ? rule.to : [rule.to];
    targets.forEach(code => {
      if (rule.floor === 'split') {
        const withTask = floors.filter(f => tasksByKey.has(`${code}@${f}`));
        if (!withTask.length) { if (!rule.optional) notInPlan.push({ code, desc: it.desc, qty: it.qty }); return; }
        const weights = withTask.map(f => ({
          floor: f,
          w: rule.w === 'bath' ? ((profile.floorInfo[f] && profile.floorInfo[f].bathrooms) || 0)
            : rule.w === 'wet' ? ((profile.floorInfo[f] && profile.floorInfo[f].wet) || 0) : (areaByFloor[f] || 0)
        }));
        const wname = { bath: '卫生间数量', wet: '卫生间/厨房数量', area: '地面面积' }[rule.w];
        allocate(q, weights).forEach(p => add(`${code}@${p.floor}`, p.v, src, 'split', '清单没分层，按各层' + wname + '分摊'));
      } else {
        const key = rule.floor == null ? code : `${code}@${rule.floor}`;
        if (!tasksByKey.has(key)) { if (!rule.optional) notInPlan.push({ code: key, desc: it.desc, qty: it.qty }); return; }
        add(key, q, src, kind, rule.note || (rule.conv === 'm2_m3' ? `按墙厚 ${WALL_THICKNESS_M * 100} cm 把平方米折成立方米，请核对` : null));
      }
    });
  });

  const matches = [];
  bucket.forEach((b, key) => {
    const t = tasksByKey.get(key);
    const decimals = t.unit === 't' ? 2 : (t.unit === 'm³' ? 1 : 0);
    const r = Math.round(b.value * 10 ** decimals) / 10 ** decimals;
    matches.push({
      key, code: t.code, floor: t.floor, name: t.zh, unit: t.unit, qty: r,
      kind: b.kinds.has('split') ? 'split' : (b.kinds.has('converted') ? 'converted' : 'direct'),
      notes: Array.from(b.notes), sources: b.sources
    });
  });
  matches.sort((a, b) => a.code.localeCompare(b.code) || (a.floor || 0) - (b.floor || 0));

  const matched = new Set(matches.map(m => m.key));
  const missing = plan.tasks.filter(t => !matched.has(t.key) && !/^(项)$/.test(t.unit))
    .map(t => ({ key: t.key, code: t.code, floor: t.floor, name: t.zh, unit: t.unit }));

  return { sheet: boq.sheetName, itemCount: boq.items.length, matches, unmapped, notInPlan, warnings, missing };
}

module.exports = { readBoq, mapBoq, WALL_THICKNESS_M };
