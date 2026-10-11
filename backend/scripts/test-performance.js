// 效率评价的检查。运行：node scripts/test-performance.js（在 backend 目录）
const assert = require('assert');
const { evaluate } = require('../src/performance');

const work = (qty, crews = 1) => ({ status: 'working', crewsPresent: crews, qtyClaimed: qty, qtyAccepted: qty });
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('通过：' + name); };

t('超过目标且质量合格 -> 奖励', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days: [work(28), work(28), work(28), work(28)] });
  assert.strictEqual(r.tier, 'reward'); assert.strictEqual(r.index, 1.12);
});

t('刚好达标 -> 正常', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days: [work(25), work(25), work(25)] });
  assert.strictEqual(r.tier, 'normal'); assert.strictEqual(r.index, 1);
});

t('偏低 -> 本次不奖励（不是扣钱）', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days: [work(18), work(20), work(19)] });
  assert.strictEqual(r.tier, 'below_target'); assert.ok(r.index < 1);
  assert.strictEqual(r.message, null);               // 不自动对工人说任何话
  assert.ok(r.alert && r.alert.toBoss && r.alert.zh.includes('指数'));   // 只提示老板
});

t('略低于目标（0.95）也提示老板', () => {
  const r = evaluate({ quotaPerCrewDay: 20, acceptanceStatus: 'passed', days: [work(19), work(19), work(19)] });
  assert.strictEqual(r.tier, 'below_target'); assert.strictEqual(r.index, 0.95);
  assert.ok(r.alert);
});

t('达标或更好时不产生老板提示', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days: [work(25), work(25), work(25)] });
  assert.strictEqual(r.alert, null);
});

t('提示老板的内容里带着被剔除的天数，方便和组长沟通', () => {
  const days = [work(18), work(18), work(18), { status: 'waiting_material' }];
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days });
  assert.ok(r.alert.zh.includes('等材料 1 天'));
});

t('试行期不产生老板提示', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', trial: true, days: [work(10), work(10), work(10)] });
  assert.strictEqual(r.tier, 'trial_record_only'); assert.strictEqual(r.wouldBe, 'below_target'); assert.strictEqual(r.alert, null);
});

t('等材料、停雨的天被剔除，不拖累指数', () => {
  const days = [work(25), work(25), work(25), { status: 'waiting_material' }, { status: 'waiting_material' }, { status: 'weather_stop' }];
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days });
  assert.strictEqual(r.tier, 'normal'); assert.strictEqual(r.effectiveDays, 3);
  assert.strictEqual(r.excludedDays.waiting_material, 2);
  assert.ok(r.reasons.some(x => x.code === 'excluded_waiting_material'));
});

t('有效天数不够 -> 不评', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days: [work(10), work(10), { status: 'weather_stop' }] });
  assert.strictEqual(r.tier, 'insufficient_data');
});

t('质量验收未出结果 -> 先不评', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'pending', days: [work(30), work(30), work(30)] });
  assert.strictEqual(r.tier, 'pending_quality');
});

t('质量验收未通过 -> 不奖励，即使产量很高', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'failed', days: [work(40), work(40), work(40)] });
  assert.strictEqual(r.tier, 'below_target'); assert.strictEqual(r.reasons[0].code, 'quality_failed');
});

t('试行期：只记录，同时给出若正式评会是什么档', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', trial: true, days: [work(30), work(30), work(30)] });
  assert.strictEqual(r.tier, 'trial_record_only'); assert.strictEqual(r.wouldBe, 'reward');
});

t('难度系数 0.8 会降低目标，同样产量在困难条件下评价更高', () => {
  const days = [work(23), work(23), work(23)];
  const hard = evaluate({ quotaPerCrewDay: 25, difficulty: 0.8, acceptanceStatus: 'passed', days });
  const easy = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days });
  assert.strictEqual(hard.tier, 'reward');         // 23 / 20 = 1.15
  assert.strictEqual(easy.tier, 'below_target');   // 23 / 25 = 0.92，低于 1 提示老板
});

t('返工量从合格量里扣', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', reworkQty: 15, days: [work(25), work(25), work(25)] });
  assert.strictEqual(r.actual, 60); assert.strictEqual(r.tier, 'below_target');
});

t('报量与验收量差距大 -> 提示主管复核', () => {
  const days = [1, 2, 3].map(() => ({ status: 'working', crewsPresent: 1, qtyClaimed: 30, qtyAccepted: 22 }));
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days });
  assert.ok(r.flags.some(f => f.code === 'claim_gap'));
});

t('多个班组：目标按到场班组数放大', () => {
  const r = evaluate({ quotaPerCrewDay: 25, acceptanceStatus: 'passed', days: [work(50, 2), work(50, 2), work(50, 2)] });
  assert.strictEqual(r.tier, 'normal'); assert.strictEqual(r.expected, 150);
});

t('非法输入要报错', () => {
  assert.throws(() => evaluate({ quotaPerCrewDay: 0, days: [] }));
  assert.throws(() => evaluate({ quotaPerCrewDay: 25, days: [{ status: 'lazy' }] }));
});

console.log(`\n共 ${n} 项全部通过`);
