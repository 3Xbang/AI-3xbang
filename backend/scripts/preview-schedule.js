// 预览排程并检查结果。运行：node scripts/preview-schedule.js（在 backend 目录）
// 注意：这里的楼层面积、工程量、班组数量都是演示用的示例，不是 Mira Villa 的真实数据，
// 目的是验证排程算法本身：先后关系有没有被遵守、班组有没有被重复安排、交叉施工是否出现。
const assert = require('assert');
const { LIB, generatePlan } = require('../src/process-master');
const { QUOTA } = require('../src/process-quota');
const { schedule, workingDayToDate } = require('../src/scheduler');

// ---- 定额覆盖检查：总库里每道工序都要有定额，单位要一致 ----
Object.keys(LIB).forEach(code => {
  assert.ok(QUOTA[code], `缺少定额：${code} ${LIB[code].zh}`);
  if (QUOTA[code].kind === 'work') {
    assert.strictEqual(QUOTA[code].unit, LIB[code].unit, `单位不一致 ${code}：定额=${QUOTA[code].unit} 总库=${LIB[code].unit}`);
  }
});
console.log(`定额覆盖检查通过：${Object.keys(LIB).length} 道工序都有定额，单位与总库一致`);

// ---- 示例工程量（按单位粗略估，仅演示用） ----
function demoQuantities(plan, floorArea) {
  const total = floorArea * plan.profile.floorCount;
  const q = {};
  plan.tasks.forEach(t => {
    const base = t.floor != null ? floorArea : total;
    const by = {
      'm²': 1.5 * base, 'm³': 0.12 * base, 't': 0.03 * base, 'm': 1.0 * base,
      '樘': Math.ceil(base / 20), '套': Math.max(1, Math.ceil(base / 60)), '盏': Math.ceil(base / 5),
      '个': Math.ceil(base / 3), '点': Math.ceil(base / 25), '台': Math.ceil(base / 50), '根': Math.ceil(base / 10), '步': 18
    };
    if (by[t.unit] != null) q[t.key] = by[t.unit];
  });
  return q;
}

const BASE_CREWS = {
  mach: 1, scaffold: 1, rebar: 2, carpenter: 3, concrete: 1, mason: 3, tiler: 2, waterproof: 1,
  plumber: 2, electrician: 2, painter: 3, installer: 2, general: 2, roof: 1
};
const CREW_SIZE = {};   // 每个工种一个班组多少人（取该工种定额里的最大值，仅用于展示）
Object.values(QUOTA).forEach(q => { if (q.kind === 'work') CREW_SIZE[q.trade] = Math.max(CREW_SIZE[q.trade] || 0, q.crew.skilled + q.crew.helper); });

// ---- 校验：先后关系、班组上限、工作量守恒 ----
function verify(plan, crews, r) {
  const byKey = new Map(r.tasks.map(o => [o.key, o]));
  plan.deps.forEach(d => {
    const a = byKey.get(d.from), b = byKey.get(d.to);
    if (d.type === 'SS') {
      let e = -1;
      for (let i = 1; i < a.prog.length; i++) if (a.prog[i] >= d.min / 100 - 1e-9) { e = i; break; }
      assert.ok(e !== -1 && b.start >= e + 1 + d.lag, `SS 违反：${d.from} -> ${d.to}`);
    } else {
      assert.ok(b.start >= a.finish + 1 + d.lag, `FS 违反：${d.from} 完成于 ${a.finish}，${d.to} 却开始于 ${b.start}（lag ${d.lag}）`);
    }
  });
  r.daily.forEach(day => Object.keys(day.assigned).forEach(tr =>
    assert.ok(day.assigned[tr] <= crews[tr], `第 ${day.day} 天 ${tr} 班组超配：${day.assigned[tr]} > ${crews[tr]}`)));
  r.tasks.forEach(o => {
    if (o.kind === 'work') assert.ok(Math.abs(o.crewDays - o.total) < 1e-6, `工作量不守恒：${o.key}`);
    assert.ok(o.start != null && o.finish >= o.start, `任务没排上：${o.key}`);
  });
}

function run(title, profile, floorArea, crews, show) {
  const plan = generatePlan(profile);
  const r = schedule(plan, { quantities: demoQuantities(plan, floorArea), crews, maxCrewsPerTask: 2 });
  verify(plan, crews, r);
  console.log(`\n=== ${title}`);
  console.log(`任务 ${plan.tasks.length} 个；总工期 ${r.finishDay} 个工作日（约 ${Math.round(r.finishDay / 6 * 10) / 10} 周，周一到周六）`);
  console.log(`同时进行的任务：最多 ${r.maxConcurrent} 个，平均 ${r.avgConcurrent.toFixed(1)} 个；` +
    `现场人数：高峰 ${r.peakHeadcount} 人，平均 ${r.avgHeadcount.toFixed(1)} 人`);
  if (show) {
    console.log('各工种使用情况（班组数 / 忙碌班组·天 / 活动期内利用率 / 排队任务·天）：');
    Object.keys(r.util).forEach(tr => {
      const u = r.util[tr];
      if (!u.busyCrewDays) return;
      console.log(`  ${tr.padEnd(11)} ${u.crews} 组  忙 ${String(Math.round(u.busyCrewDays)).padStart(4)}  利用率 ${String(Math.round(u.spanUtil * 100)).padStart(3)}%  排队 ${u.queuedTaskDays}`);
    });
    const ph = r.tasks.filter(o => o.placeholder).map(o => o.key);
    console.log('用占位天数的任务（必须由你们填真实值）：' + (ph.length ? ph.join('、') : '无'));
    const lowConf = r.tasks.filter(o => o.conf === '低' && o.kind === 'work').map(o => o.code);
    console.log('定额把握度「低」的工序：' + Array.from(new Set(lowConf)).join('、'));
    // 展示交叉施工：第 N 天的同时在做的任务
    const peak = r.daily.reduce((m, d) => d.running.length > m.running.length ? d : m, r.daily[0]);
    console.log(`并行最多的一天（第 ${peak.day} 天）同时在做：` + peak.running.join('、'));
    const t = k => { const o = r.tasks.find(x => x.key === k); return o ? `${k} ${o.start}-${o.finish}` : null; };
    console.log('交叉施工抽查（开始-完成 工作日）：' + ['C06@1', 'C01@2', 'C09@1', 'C03@2', 'F02@1', 'C09@2', 'F08@1', 'F15@1', 'F15@2', 'I02'].map(t).filter(Boolean).join('；'));
    console.log('日历示例：从 2026-11-02（周一）开工，周日休息，第 ' + r.finishDay + ' 个工作日 = ' + workingDayToDate('2026-11-02', r.finishDay));
  }
  return r;
}

const profile = { floors: 2 };
const base = run('基准：2 层，每层 150 m²，各工种班组数为示例', profile, 150, BASE_CREWS, true);

// 如果只有 1 个班组/工种：工期更长，说明人手是瓶颈
const lean = {}; Object.keys(BASE_CREWS).forEach(k => { lean[k] = 1; });
const leanR = run('对照：每个工种只有 1 个班组', profile, 150, lean, false);

// 排队最多的工种不一定是拖慢总工期的工种，所以逐个工种各加 1 个班组，看总工期真正缩短多少
const ranked = Object.keys(base.util).map(k => [k, base.util[k].queuedTaskDays]).sort((a, b) => b[1] - a[1]);
console.log('\n基准方案里排队最多的工种：' + ranked.slice(0, 3).map(x => `${x[0]}(${x[1]})`).join('、'));
const gains = Object.keys(BASE_CREWS).map(tr => {
  const c = Object.assign({}, BASE_CREWS); c[tr] += 1;
  const plan = generatePlan(profile);
  const r = schedule(plan, { quantities: demoQuantities(plan, 150), crews: c, maxCrewsPerTask: 2 });
  verify(plan, c, r);
  return [tr, base.finishDay - r.finishDay];
}).sort((a, b) => b[1] - a[1]);
console.log('各工种单独加 1 个班组后，总工期缩短的天数：' + gains.map(g => `${g[0]} ${g[1]}`).join('，'));
console.log(`人手方案对比：基准 ${base.finishDay} 天；每工种只有 1 组 ${leanR.finishDay} 天`);
assert.ok(leanR.finishDay >= base.finishDay, '班组变少，工期不应缩短');

// 其他工况只验证算法不出错
run('3 层 + 地下室 + 坡屋面 + 桩基 + 电梯 + 泳池', { floors: 3, basement: true, roof: 'pitched', foundation: 'pile', soft_soil: true, high_water: true, elevator: true, pool: true, floor_finish: 'wood', wall_finish: 'mixed', ceiling: 'aluminum_wet', exterior_insulation: true, aircon: 'central', hot_water: 'solar', water_supply: 'tank', balconies: 2, fixed_furniture: true }, 120, BASE_CREWS, false);
run('1 层最简', { floors: 1, stairs: 0, ceiling: 'none', aircon: 'none', hot_water: 'none', cabinet: false, shower_room: false, fence: false, road: false, landscape: false, roof_insulation: false }, 100, BASE_CREWS, false);
run('5 层', { floors: 5 }, 200, BASE_CREWS, false);
console.log('\n全部排程检查通过');
