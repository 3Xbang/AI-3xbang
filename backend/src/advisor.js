// 现场建议器：根据「实际完成度」判断现在哪些任务可以做、哪些不能做（以及为什么），
// 并根据项目团队名册（谁在、会什么）给工头建议怎么派人。最终由现场工头决定，系统只给建议。
//
// state（实际进度，不是计划）：
//   { today: 60, tasks: { 'C01@2': { status, progress, finishedDay, reachedDay } } }
//   status: not_started | in_progress | completed；progress 0..1
//   finishedDay：完成于第几个工作日；reachedDay：{ 50: 33 } 表示进度第一次达到 50% 是第 33 天
//
// 团队名册 team = { members: [{ id, name, level:'skilled'|'helper', skills:[工种...] }] }
//   skilled 技工：skills 是他能带班的工种；一个技工可以会多个工种（多能工），同一天只能在一个任务上。
//   helper  普工：skills 是他能打下手的工种，写 ['*'] 表示什么工种都能帮。
//
// opts = {
//   quantities,                  // 各任务工程量
//   team 或 crews,               // 团队名册；或 { 工种: 班组数 }（会按定额里的班组构成换算成名册）
//   allowMissingQuantity,        // true 时，没录工程量的任务按 1 个班组·天估算，而不是报错
//   assignments: { 任务: [成员id] },  // 工头已经安排的人
//   absent: [成员id],            // 今天没来的人
//   floorArea,                   // 每层面积 m²，用于判断拥挤；不填则用 profile.total_area ÷ 层数，仍没有则按 4 个工种
//   maxCrewsPerTask
// }

const { getQuota, QUOTA } = require('./process-quota');

const EPS = 1e-9;

// ---------- 工具 ----------
function buildIndex(plan) {
  const preds = new Map(), succs = new Map();
  plan.tasks.forEach(t => { preds.set(t.key, []); succs.set(t.key, []); });
  plan.deps.forEach(d => { preds.get(d.to).push(d); succs.get(d.from).push(d); });
  return { preds, succs };
}
const stateOf = (state, key) => (state.tasks && state.tasks[key]) || { status: 'not_started', progress: 0 };

// 把「每个工种几个班组」换算成名册（兼容旧用法）
function rosterFromCrews(crews) {
  const size = {};
  Object.values(QUOTA).forEach(q => {
    if (q.kind !== 'work') return;
    const s = size[q.trade] = size[q.trade] || { skilled: 0, helper: 0 };
    s.skilled = Math.max(s.skilled, q.crew.skilled);
    s.helper = Math.max(s.helper, q.crew.helper);
  });
  const members = [];
  Object.keys(crews).forEach(tr => {
    const s = size[tr] || { skilled: 1, helper: 1 };
    for (let c = 1; c <= crews[tr]; c++) {
      for (let i = 1; i <= s.skilled; i++) members.push({ id: `${tr}-${c}-S${i}`, name: `${tr}${c}组技工${i}`, level: 'skilled', skills: [tr] });
      for (let i = 1; i <= s.helper; i++) members.push({ id: `${tr}-${c}-H${i}`, name: `${tr}${c}组普工${i}`, level: 'helper', skills: [tr] });
    }
  });
  return { members };
}

// 由名册估算每个工种最多能组几个班组（多能工会在工种之间共享，所以这是上限，不会同时达到）
function crewsFromTeam(team) {
  const need = {};
  Object.values(QUOTA).forEach(q => {
    if (q.kind !== 'work') return;
    const s = need[q.trade] = need[q.trade] || { skilled: 0, helper: 0 };
    s.skilled = Math.max(s.skilled, q.crew.skilled);
    s.helper = Math.max(s.helper, q.crew.helper);
  });
  const out = {};
  Object.keys(need).forEach(tr => {
    const sk = team.members.filter(m => m.level === 'skilled' && m.skills.includes(tr)).length;
    const hp = team.members.filter(m => m.level === 'helper' && (m.skills.includes('*') || m.skills.includes(tr))).length;
    const bySk = need[tr].skilled ? Math.floor(sk / need[tr].skilled) : Infinity;
    const byHp = need[tr].helper ? Math.floor(hp / need[tr].helper) : Infinity;
    const c = Math.min(bySk, byHp);
    if (c > 0 && c !== Infinity) out[tr] = c;
  });
  return out;
}

const canLead = (m, trade) => m.level === 'skilled' && m.skills.includes(trade);
const canHelp = (m, trade) => m.level === 'helper' && (m.skills.includes('*') || m.skills.includes(trade));

// ---------- 先后关系 ----------
function depStatus(dep, state) {
  const p = stateOf(state, dep.from);
  const today = state.today;
  if (dep.type === 'SS') {
    if ((p.progress || 0) + EPS < dep.min / 100) {
      return { ok: false, reason: { type: 'ss_progress', pred: dep.from, have: p.progress || 0, need: dep.min / 100 } };
    }
    if (dep.lag > 0) {
      const reached = p.reachedDay && p.reachedDay[dep.min];
      const left = reached == null ? dep.lag : reached + 1 + dep.lag - today;
      if (left > 0) return { ok: false, reason: { type: 'lag', pred: dep.from, daysLeft: left } };
    }
    return { ok: true };
  }
  if (p.status !== 'completed') {
    return { ok: false, reason: { type: 'pred_not_finished', pred: dep.from, progress: p.progress || 0 } };
  }
  const left = p.finishedDay + 1 + dep.lag - today;
  if (left > 0) return { ok: false, reason: { type: 'lag', pred: dep.from, daysLeft: left } };
  return { ok: true };
}

function canStart(plan, state, key) {
  const { preds } = buildIndex(plan);
  if (!preds.has(key)) throw new Error('任务不存在：' + key);
  const s = stateOf(state, key);
  if (s.status === 'completed') return { allowed: false, reasons: [{ type: 'already_completed' }] };
  if (s.status === 'in_progress') return { allowed: true, reasons: [] };
  const reasons = [];
  preds.get(key).forEach(d => { const r = depStatus(d, state); if (!r.ok) reasons.push(r.reason); });
  return { allowed: reasons.length === 0, reasons };
}

function describeReason(r, label) {
  switch (r.type) {
    case 'pred_not_finished':
      return Object.assign({ zh: `等待「${label(r.pred)}」完成（目前 ${Math.round(r.progress * 100)}%）` }, r);
    case 'ss_progress':
      return Object.assign({ zh: `等待「${label(r.pred)}」做到 ${Math.round(r.need * 100)}%（目前 ${Math.round(r.have * 100)}%）` }, r);
    case 'lag':
      return Object.assign({ zh: `「${label(r.pred)}」已满足，还需再等 ${r.daysLeft} 个工作日（养护或间隔）` }, r);
    case 'already_completed':
      return Object.assign({ zh: '该任务已完成' }, r);
    default:
      return Object.assign({ zh: '未知原因' }, r);
  }
}

// ---------- 强制开始（工头想在条件没满足时提前开工） ----------
// 允许，但必须写原因、记录决定人，并通知「他的上级」和「老板」。
const HIGH_RISK_PRED = new Set(['E08', 'F05', 'D08', 'B09', 'C07']);   // 验收、试验、拆模养护类
function forceStart(plan, state, key, info) {
  const t = plan.tasks.find(x => x.key === key);
  if (!t) throw new Error('任务不存在：' + key);
  const check = canStart(plan, state, key);
  if (check.allowed) return { override: false, key };
  if (check.reasons.some(r => r.type === 'already_completed')) throw new Error('该任务已完成，不能再开始');
  if (!info || !String(info.reason || '').trim()) throw new Error('提前开始必须填写原因');
  if (!info.by || !info.by.name) throw new Error('必须记录是谁决定的');

  const byKey = new Map(plan.tasks.map(x => [x.key, x]));
  const label = k => { const x = byKey.get(k); return x.zh + (x.floor != null ? `（${x.floor}层）` : ''); };
  const unmet = check.reasons.map(r => describeReason(r, label));

  // 风险等级：养护/间隔不够、验收试验类没完成 -> 高；前置进度不到 80% -> 中；其余 -> 低
  let severity = 'low';
  check.reasons.forEach(r => {
    if (r.type === 'lag') severity = 'high';
    else if (r.type === 'pred_not_finished' || r.type === 'ss_progress') {
      const predCode = byKey.get(r.pred).code;
      const prog = r.type === 'ss_progress' ? r.have / (r.need || 1) : r.progress;
      if (HIGH_RISK_PRED.has(predCode)) severity = 'high';
      else if (prog < 0.8 && severity !== 'high') severity = 'medium';
    }
  });
  const sevZh = { high: '高（可能影响质量，如养护不够或验收未过）', medium: '中', low: '低（前置工序接近完成）' }[severity];

  return {
    override: true, key, severity,
    reason: String(info.reason).trim(), by: info.by, at: info.at || null,
    unmet,
    notify: [{ role: 'supervisor', note: '决定人的上级' }, { role: 'owner', note: '老板' }],
    message: {
      zh: `${info.by.name} 决定提前开始「${label(key)}」，前置条件还没满足。\n` +
          `原因：${String(info.reason).trim()}\n未满足：${unmet.map(u => u.zh).join('；')}\n风险：${sevZh}`
    }
  };
}

// ---------- 建议 ----------
function advise(plan, state, opts) {
  const o = Object.assign({ maxCrewsPerTask: 2, assignments: {}, absent: [], quantities: {} }, opts || {});
  const team = o.team || rosterFromCrews(o.crews || {});
  const byId = new Map(team.members.map(m => [m.id, m]));
  const T = new Map(plan.tasks.map(t => [t.key, t]));
  const { preds, succs } = buildIndex(plan);
  const label = key => { const t = T.get(key); return t.zh + (t.floor != null ? `（${t.floor}层）` : ''); };
  const quota = key => getQuota(T.get(key).code, plan.profile);

  const remaining = key => {
    const s = stateOf(state, key);
    if (s.status === 'completed') return 0;
    const q = quota(key);
    let total;
    if (q.kind === 'work') {
      const qty = o.quantities[key];
      if (qty > 0) total = qty / q.output;
      else if (o.allowMissingQuantity) total = 1;     // 工程量还没录入：先按 1 个班组·天估，页面上会标「工程量未录入」
      else throw new Error('缺少工程量：' + key);
    } else total = q.days;
    return total * (1 - (s.progress || 0));
  };
  const crewCap = {};   // 各工种理论上最多能组几个班组，用于估算剩余天数
  const capOf = tr => { if (!(tr in crewCap)) crewCap[tr] = crewsFromTeam(team)[tr] || 1; return crewCap[tr]; };
  const estDays = key => {
    const q = quota(key), r = remaining(key);
    if (r <= EPS) return 0;
    return q.kind === 'work' ? Math.max(1, Math.ceil(r / Math.min(o.maxCrewsPerTask, capOf(q.trade)))) : Math.ceil(r);
  };
  const tailMemo = new Map();
  const tail = key => {
    if (tailMemo.has(key)) return tailMemo.get(key);
    let best = 0;
    succs.get(key).forEach(d => { best = Math.max(best, d.lag + tail(d.to)); });
    const v = estDays(key) + best;
    tailMemo.set(key, v);
    return v;
  };
  const unlocks = key => succs.get(key).filter(d => {
    if (stateOf(state, d.to).status !== 'not_started') return false;
    const unmet = preds.get(d.to).filter(x => !depStatus(x, state).ok);
    return unmet.length > 0 && unmet.every(x => x.from === key);
  }).map(d => d.to).filter((k, i, a) => a.indexOf(k) === i).length;

  // 分类
  const ready = [], inProgress = [], blocked = [];
  plan.tasks.forEach(t => {
    const s = stateOf(state, t.key);
    if (s.status === 'completed') return;
    const q = quota(t.key);
    const base = { key: t.key, label: label(t.key), trade: q.trade || null, kind: q.kind, remaining: remaining(t.key), progress: s.progress || 0 };
    if (s.status === 'in_progress') { inProgress.push(Object.assign(base, { tail: tail(t.key), unlocks: unlocks(t.key) })); return; }
    const check = canStart(plan, state, t.key);
    if (check.allowed) ready.push(Object.assign(base, { tail: tail(t.key), unlocks: unlocks(t.key) }));
    else blocked.push(Object.assign(base, { reasons: check.reasons.map(r => describeReason(r, label)) }));
  });
  const score = x => x.tail * 1000 + x.unlocks * 10 + (x.progress > 0 ? 1 : 0);
  const byScore = (a, b) => score(b) - score(a) || a.key.localeCompare(b.key);
  ready.sort(byScore); inProgress.sort(byScore);

  // 谁还空着
  const absent = new Set(o.absent);
  const busy = new Set();
  Object.values(o.assignments).forEach(ids => ids.forEach(id => busy.add(id)));
  let free = team.members.filter(m => !busy.has(m.id) && !absent.has(m.id));

  const staffedCrews = key => {
    const q = quota(key), ids = o.assignments[key] || [];
    let sk = 0, hp = 0;
    ids.forEach(id => { const m = byId.get(id); if (!m) return; if (canLead(m, q.trade)) sk++; else if (canHelp(m, q.trade)) hp++; });
    let c = Infinity;
    if (q.crew.skilled > 0) c = Math.min(c, Math.floor(sk / q.crew.skilled));
    if (q.crew.helper > 0) c = Math.min(c, Math.floor(hp / q.crew.helper));
    return c === Infinity ? 0 : c;
  };

  // 按优先级给需要人的任务派人：尽量少用「会得多」的人，把多能工留给别的任务
  const flex = m => (m.skills.includes('*') ? 100 : m.skills.length);
  const idCmp = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  const pickSkilled = (trade, n) => free.filter(m => canLead(m, trade)).sort((a, b) => flex(a) - flex(b) || idCmp(a, b)).slice(0, n);
  const pickHelpers = (trade, n) => free.filter(m => canHelp(m, trade)).sort((a, b) => flex(a) - flex(b) || idCmp(a, b)).slice(0, n);
  const reasonsFor = x => {
    const r = [];
    if (x.progress > 0) r.push('已经开工，建议先做完，避免来回换');
    if (x.unlocks > 0) r.push(`做完后可以解锁 ${x.unlocks} 个任务`);
    r.push(`从它到项目结束约还有 ${x.tail} 个工作日的链条`);
    return r;
  };

  const suggestions = [], queued = [];
  inProgress.concat(ready).filter(x => x.kind === 'work').sort(byScore).forEach(x => {
    const q = quota(x.key);
    const now = staffedCrews(x.key);
    const need = Math.min(o.maxCrewsPerTask, Math.ceil(x.remaining - EPS)) - now;
    if (need <= 0) return;
    const picked = []; let crews = 0, shortage = null;
    for (let c = 0; c < need; c++) {
      const sk = pickSkilled(q.trade, q.crew.skilled);
      const hp = pickHelpers(q.trade, q.crew.helper);
      if (sk.length < q.crew.skilled || hp.length < q.crew.helper) {
        shortage = { skilled: q.crew.skilled - sk.length, helper: q.crew.helper - hp.length };
        break;
      }
      const chosen = sk.concat(hp);
      const ids = new Set(chosen.map(m => m.id));
      free = free.filter(m => !ids.has(m.id));
      picked.push(...chosen); crews++;
    }
    if (crews > 0) {
      suggestions.push({
        key: x.key, label: x.label, trade: q.trade, crews,
        members: picked.map(m => ({ id: m.id, name: m.name, level: m.level })),
        reasons: reasonsFor(x), shortage
      });
    } else if (now === 0) {
      const parts = [];
      if (shortage.skilled > 0) parts.push(`${shortage.skilled} 名${q.trade}技工`);
      if (shortage.helper > 0) parts.push(`${shortage.helper} 名普工`);
      queued.push({ key: x.key, label: x.label, trade: q.trade, shortage,
        note: `可以做，但现有空闲的人不够：还缺 ${parts.join('、')}。可从别的任务借调，或等人手空出来` });
    }
  });

  // 没活干的人：列出他们会的、还没满员的任务，方便借调
  const understaffed = inProgress.concat(ready).filter(x => x.kind === 'work')
    .filter(x => (staffedCrews(x.key) + (suggestions.find(s => s.key === x.key) || { crews: 0 }).crews) < Math.min(o.maxCrewsPerTask, Math.ceil(x.remaining - EPS)));
  const idle = free.map(m => {
    const targets = understaffed.filter(x => (m.level === 'skilled' ? canLead(m, x.trade) : canHelp(m, x.trade))).slice(0, 3).map(x => x.label);
    return { id: m.id, name: m.name, level: m.level, skills: m.skills, canBorrowTo: targets };
  });

  // 拥挤与冲突提醒
  const floors = new Set(plan.tasks.filter(t => t.floor != null).map(t => t.floor));
  const area = o.floorArea || (plan.profile && plan.profile.total_area ? plan.profile.total_area / Math.max(1, floors.size) : null);
  const limit = !area ? 4 : area < 100 ? 3 : area <= 250 ? 4 : 5;
  const DUST = new Set(['mason', 'tiler', 'carpenter']);   // 会产生粉尘、水或切割的工种
  const perFloor = {};
  const addFloor = (key, trade) => { const f = T.get(key).floor; if (f == null || !trade) return; (perFloor[f] = perFloor[f] || new Set()).add(trade); };
  inProgress.forEach(x => addFloor(x.key, x.trade));
  suggestions.forEach(s => addFloor(s.key, s.trade));
  const warnings = [];
  Object.keys(perFloor).forEach(f => {
    const trades = Array.from(perFloor[f]);
    if (trades.length > limit) {
      warnings.push({ type: 'congestion', floor: Number(f), trades, limit,
        zh: `${f} 层同时有 ${trades.length} 个工种作业（${trades.join('、')}），超过这层的建议上限 ${limit} 个，注意场地拥挤和互相干扰，由工头决定` });
    }
    if (perFloor[f].has('painter') && trades.some(t => DUST.has(t))) {
      warnings.push({ type: 'conflict', floor: Number(f), trades: ['painter'].concat(trades.filter(t => DUST.has(t))),
        zh: `${f} 层油漆和${trades.filter(t => DUST.has(t)).join('、')}同时作业：粉尘、湿作业会污染油漆面，建议错开` });
    }
  });

  return { today: state.today, ready, inProgress, blocked, suggestions, idle, queued, warnings, congestionLimit: limit };
}

module.exports = { advise, canStart, forceStart, depStatus, describeReason, rosterFromCrews, crewsFromTeam };
