// 现场建议器的检查。运行：node scripts/test-advisor.js（在 backend 目录）
// 一、逐日一致性：先用排程模拟出完整施工过程，再在每天开始时取「实际完成度」交给建议器，
//     检查它的判断和模拟里实际发生的事一致（两套独立写的依赖判断互相印证）。
// 二、强制开始、团队名册（多能工与借调）、拥挤与粉尘冲突提醒。
// 工程量、班组数、人员都是演示用的示例，不是 Mira Villa 的真实数据。
const assert = require('assert');
const { generatePlan } = require('../src/process-master');
const { schedule } = require('../src/scheduler');
const { advise, canStart, forceStart, rosterFromCrews, crewsFromTeam } = require('../src/advisor');

const CREWS = { mach: 1, scaffold: 1, rebar: 2, carpenter: 3, concrete: 1, mason: 3, tiler: 2, waterproof: 1, plumber: 2, electrician: 2, painter: 3, installer: 2, general: 2, roof: 1 };
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('通过：' + name); };

function demoQuantities(plan, floorArea) {
  const total = floorArea * plan.profile.floorCount, q = {};
  plan.tasks.forEach(x => {
    const base = x.floor != null ? floorArea : total;
    const by = { 'm²': 1.5 * base, 'm³': 0.12 * base, 't': 0.03 * base, 'm': base, '樘': Math.ceil(base / 20), '套': Math.max(1, Math.ceil(base / 60)),
      '盏': Math.ceil(base / 5), '个': Math.ceil(base / 3), '点': Math.ceil(base / 25), '台': Math.ceil(base / 50), '根': Math.ceil(base / 10), '步': 18 };
    if (by[x.unit] != null) q[x.key] = by[x.unit];
  });
  return q;
}

// 把模拟结果还原成「第 d 天开始时」的实际进度
function stateAt(plan, r, d) {
  const mins = Array.from(new Set(plan.deps.filter(x => x.type === 'SS').map(x => x.min)));
  const tasks = {};
  const reached = o => { const m = {}; mins.forEach(k => { for (let e = 1; e <= d - 1; e++) if (o.prog[e] >= k / 100 - 1e-9) { m[k] = e; break; } }); return m; };
  r.tasks.forEach(o => {
    if (o.finish != null && o.finish <= d - 1) tasks[o.key] = { status: 'completed', progress: 1, finishedDay: o.finish, reachedDay: reached(o) };
    else if (o.start != null && o.start <= d - 1) tasks[o.key] = { status: 'in_progress', progress: o.prog[d - 1], reachedDay: reached(o) };
  });
  return { today: d, tasks };
}

// ================= 一、逐日一致性 =================
function consistency(profile, floorArea) {
  const plan = generatePlan(profile);
  const quantities = demoQuantities(plan, floorArea);
  const r = schedule(plan, { quantities, crews: CREWS, maxCrewsPerTask: 2 });
  const total = rosterFromCrews(CREWS).members.length;
  for (let d = 1; d <= r.finishDay; d++) {
    const state = stateAt(plan, r, d);
    const adv = advise(plan, state, { quantities, crews: CREWS });
    const readyKeys = new Set(adv.ready.map(x => x.key));
    const progKeys = new Set(adv.inProgress.map(x => x.key));
    const blockedKeys = new Set(adv.blocked.map(x => x.key));
    r.tasks.forEach(o => {
      if (o.start === d) { assert.ok(readyKeys.has(o.key), `第 ${d} 天 ${o.key} 在模拟中开工，建议器没有列为可开始`); assert.ok(!blockedKeys.has(o.key)); }
      if (o.start != null && o.start < d && o.finish >= d) assert.ok(progKeys.has(o.key), `第 ${d} 天 ${o.key} 正在做，没有列入进行中`);
      if (o.finish != null && o.finish < d) assert.ok(!readyKeys.has(o.key) && !progKeys.has(o.key) && !blockedKeys.has(o.key));
    });
    adv.blocked.forEach(b => assert.ok(b.reasons.length > 0, `${b.key} 被排除却没有原因`));
    // 同一个人一天只能派一个任务，且人数不超过名册
    const ids = adv.suggestions.flatMap(s => s.members.map(m => m.id));
    assert.strictEqual(new Set(ids).size, ids.length, '同一个人被建议去了两个任务');
    assert.ok(ids.length <= total);
  }
  return { plan, r, quantities, days: r.finishDay };
}

const base = consistency({ floors: 2 }, 150);
console.log(`逐日一致性通过：2 层工程 ${base.days} 天，建议器与模拟的依赖判断完全吻合`);
const c2 = consistency({ floors: 3, basement: true, roof: 'pitched', foundation: 'pile', elevator: true, wall_finish: 'mixed', ceiling: 'aluminum_wet' }, 120);
console.log(`逐日一致性通过：复杂工况 ${c2.days} 天`);

// ================= 二、强制开始 =================
t('被排除的任务可以强制开始，但必须写原因，并通知上级和老板', () => {
  const day = 60;
  const state = stateAt(base.plan, base.r, day);
  const adv = advise(base.plan, state, { quantities: base.quantities, crews: CREWS });
  const target = adv.blocked[0];
  assert.throws(() => forceStart(base.plan, state, target.key, { by: { name: '工头阿明' } }), /必须填写原因/);
  assert.throws(() => forceStart(base.plan, state, target.key, { reason: '赶工' }), /是谁决定/);
  const r = forceStart(base.plan, state, target.key, { reason: '业主要求提前交付，已和监理确认', by: { name: '工头阿明', id: 7 }, at: '2026-12-01' });
  assert.strictEqual(r.override, true);
  assert.deepStrictEqual(r.notify.map(x => x.role), ['supervisor', 'owner']);
  assert.ok(r.unmet.length > 0 && r.message.zh.includes('业主要求提前交付'));
  assert.ok(['low', 'medium', 'high'].includes(r.severity));
});

t('可以正常开始的任务不需要强制，不产生通知', () => {
  const state = stateAt(base.plan, base.r, 60);
  const adv = advise(base.plan, state, { quantities: base.quantities, crews: CREWS });
  if (adv.ready.length) assert.strictEqual(forceStart(base.plan, state, adv.ready[0].key, {}).override, false);
});

t('养护或间隔没到就提前开始 -> 风险等级为高', () => {
  const plan = base.plan, r = base.r;
  // 找一天：某个任务只因为 lag（等养护）而不能开始
  let found = null;
  for (let d = 1; d <= r.finishDay && !found; d++) {
    const state = stateAt(plan, r, d);
    const adv = advise(plan, state, { quantities: base.quantities, crews: CREWS });
    const b = adv.blocked.find(x => x.reasons.length === 1 && x.reasons[0].type === 'lag');
    if (b) found = { state, key: b.key };
  }
  assert.ok(found, '示例里应当存在只差养护天数的任务');
  const res = forceStart(plan, found.state, found.key, { reason: '测试', by: { name: '工头' } });
  assert.strictEqual(res.severity, 'high');
});

// ================= 三、团队名册：多能工与借调 =================
// 用一个小的假计划，只放两个互不依赖的任务：内墙抹灰（瓦工）和地砖铺贴（贴砖工）
const mini = (tasks) => ({
  profile: generatePlan({ floors: 2 }).profile,
  tasks: tasks.map(([key, code, floor, zh, unit]) => ({ key, code, floor, zh, unit })),
  deps: []
});
const miniPlan = mini([['F02@1', 'F02', 1, '内墙抹灰', 'm²'], ['F08@1', 'F08', 1, '地砖铺贴', 'm²']]);
const miniQty = { 'F02@1': 250, 'F08@1': 100 };
const emptyState = { today: 1, tasks: {} };
const M = (id, name, level, skills) => ({ id, name, level, skills });

t('一个人同时会两个工种时，同一天只能派到一个任务上', () => {
  const team = { members: [M('a', '阿雄', 'skilled', ['mason', 'tiler']), M('h1', '小王', 'helper', ['*'])] };
  const adv = advise(miniPlan, emptyState, { quantities: miniQty, team });
  const used = adv.suggestions.flatMap(s => s.members.map(m => m.id));
  assert.strictEqual(used.filter(x => x === 'a').length, 1, '多能工被重复安排');
  assert.strictEqual(adv.suggestions.length, 1);
  assert.strictEqual(adv.queued.length, 1, '另一个任务应该因缺技工而排队');
  assert.ok(adv.queued[0].note.includes('技工'));
});

t('再来一个只会贴砖的技工 -> 两个任务都有人，多能工留给优先级更高的', () => {
  const team = { members: [M('a', '阿雄', 'skilled', ['mason', 'tiler']), M('b', '阿标', 'skilled', ['tiler']),
    M('h1', '小王', 'helper', ['*']), M('h2', '小李', 'helper', ['*'])] };
  const adv = advise(miniPlan, emptyState, { quantities: miniQty, team });
  assert.strictEqual(adv.suggestions.length, 2);
  const tile = adv.suggestions.find(s => s.key === 'F08@1');
  assert.ok(tile.members.some(m => m.id === 'b'), '贴砖应优先用只会贴砖的人，把多能工留给抹灰');
  const plaster = adv.suggestions.find(s => s.key === 'F02@1');
  assert.ok(plaster.members.some(m => m.id === 'a'));
});

t('工头已经安排的人，不会再被建议去别处；没来的人也不会被安排', () => {
  const team = { members: [M('a', '阿雄', 'skilled', ['mason']), M('b', '阿标', 'skilled', ['mason']), M('h1', '小王', 'helper', ['*']), M('h2', '小李', 'helper', ['*'])] };
  const adv = advise(miniPlan, emptyState, { quantities: miniQty, team, assignments: { 'F02@1': ['a', 'h1'] }, absent: ['b'] });
  const used = adv.suggestions.flatMap(s => s.members.map(m => m.id));
  assert.ok(!used.includes('a') && !used.includes('h1') && !used.includes('b'));
});

t('空闲的人会列出可以借调去哪里', () => {
  const team = { members: [M('a', '阿雄', 'skilled', ['mason']), M('h1', '小王', 'helper', ['*']), M('h2', '小李', 'helper', ['*']), M('h3', '小张', 'helper', ['*'])] };
  const adv = advise(miniPlan, emptyState, { quantities: miniQty, team });
  const extraHelper = adv.idle.find(x => x.level === 'helper');
  assert.ok(extraHelper, '应当有空闲的普工');
  assert.ok(extraHelper.canBorrowTo.length > 0, '空闲普工应当有可借调的任务');
});

t('由名册估算各工种最多能组几个班组（多能工是共享的，所以是上限）', () => {
  const team = { members: [M('a', 'A', 'skilled', ['mason']), M('b', 'B', 'skilled', ['mason']), M('h1', 'h', 'helper', ['*']), M('h2', 'h', 'helper', ['*'])] };
  const c = crewsFromTeam(team);
  assert.strictEqual(c.mason, 2);
});

// ================= 四、拥挤与粉尘冲突 =================
const crowdPlan = mini([['F02@1', 'F02', 1, '内墙抹灰', 'm²'], ['F08@1', 'F08', 1, '地砖铺贴', 'm²'], ['F10@1', 'F10', 1, '吊顶龙骨', 'm²'],
  ['F15@1', 'F15', 1, '乳胶漆涂刷', 'm²'], ['F30@1', 'F30', 1, '灯具安装', '盏']]);
const crowdQty = { 'F02@1': 200, 'F08@1': 100, 'F10@1': 100, 'F15@1': 200, 'F30@1': 40 };
const crowdState = { today: 1, tasks: Object.fromEntries(Object.keys(crowdQty).map(k => [k, { status: 'in_progress', progress: 0.1 }])) };

t('小户型（每层 80 m²）：5 个工种同层 -> 超过上限 3，提醒拥挤', () => {
  const adv = advise(crowdPlan, crowdState, { quantities: crowdQty, crews: { mason: 1, tiler: 1, carpenter: 1, painter: 1, electrician: 1 }, floorArea: 80 });
  assert.strictEqual(adv.congestionLimit, 3);
  assert.ok(adv.warnings.some(w => w.type === 'congestion'));
});

t('大户型（每层 300 m²）：5 个工种同层 -> 上限 5，不提醒拥挤', () => {
  const adv = advise(crowdPlan, crowdState, { quantities: crowdQty, crews: { mason: 1, tiler: 1, carpenter: 1, painter: 1, electrician: 1 }, floorArea: 300 });
  assert.strictEqual(adv.congestionLimit, 5);
  assert.ok(!adv.warnings.some(w => w.type === 'congestion'));
});

t('油漆和抹灰、贴砖、木工同层作业 -> 无论多大都提醒粉尘冲突', () => {
  const adv = advise(crowdPlan, crowdState, { quantities: crowdQty, crews: { mason: 1, tiler: 1, carpenter: 1, painter: 1, electrician: 1 }, floorArea: 300 });
  const w = adv.warnings.find(x => x.type === 'conflict');
  assert.ok(w && w.trades.includes('painter'));
});

t('面积未知时按 4 个工种作为上限', () => {
  const adv = advise(crowdPlan, crowdState, { quantities: crowdQty, crews: { mason: 1, tiler: 1, carpenter: 1, painter: 1, electrician: 1 } });
  assert.strictEqual(adv.congestionLimit, 4);
});

// ================= 展示一个中途时点，供人审阅 =================
let day = 1, best = -1;
for (let d = 1; d <= base.r.finishDay; d++) {
  const a = advise(base.plan, stateAt(base.plan, base.r, d), { quantities: base.quantities, crews: CREWS });
  if (a.ready.length > best) { best = a.ready.length; day = d; }
}
const state = stateAt(base.plan, base.r, day);
const adv = advise(base.plan, state, { quantities: base.quantities, crews: CREWS, floorArea: 150 });
console.log(`\n=== 第 ${day} 天开始时的建议（示例数据）`);
console.log(`进行中 ${adv.inProgress.length} 个；可以开始 ${adv.ready.length} 个；现在不能开始 ${adv.blocked.length} 个`);
console.log('建议派人：');
adv.suggestions.slice(0, 5).forEach(s => console.log(`  ${s.label} ← ${s.members.map(m => m.name).join('、')}（${s.crews} 组）【${s.reasons[0]}】`));
console.log('空闲的人（含可借调去处）：' + adv.idle.slice(0, 4).map(x => `${x.name}${x.canBorrowTo.length ? '→' + x.canBorrowTo[0] : '（暂无合适任务）'}`).join('；') + ` 等 ${adv.idle.length} 人`);
console.log('提醒：' + (adv.warnings.length ? adv.warnings.map(w => w.zh).join(' / ') : '无'));
const sample = adv.blocked[0];
const f = forceStart(base.plan, state, sample.key, { reason: '业主要求提前交付，已和监理确认', by: { name: '工头阿明' } });
console.log(`\n工头想提前开始被排除的「${sample.label}」，系统记录并通知（上级、老板）：\n${f.message.zh}`);

console.log(`\n全部检查通过（${n} 项单项检查 + 逐日一致性）`);
