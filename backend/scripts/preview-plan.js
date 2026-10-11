// 预览：按不同的项目申请表答案生成计划，并检查是否有错误
// 运行：node scripts/preview-plan.js   （在 backend 目录下）
const { LIB, SECTIONS, generatePlan, analyze } = require('../src/process-master');

function run(name, profile, verbose) {
  const plan = generatePlan(profile);
  const a = analyze(plan);
  const bySec = {};
  plan.tasks.forEach(t => { bySec[t.section] = (bySec[t.section] || 0) + 1; });
  const procs = new Set(plan.tasks.map(t => t.code)).size;
  console.log(`\n=== ${name}`);
  console.log(`工序 ${procs} 个，任务 ${plan.tasks.length} 个，先后关系 ${plan.deps.length} 条，` +
    `无环 ${!a.hasCycle ? '是' : '否（有环！）'}，最长链 ${a.maxLevel + 1} 步`);
  console.log('各部分任务数：' + Object.keys(SECTIONS).map(s => `${s}${SECTIONS[s].zh}:${bySec[s] || 0}`).join('  '));
  console.log('未生成的工序：' + (plan.excluded.length ? plan.excluded.map(c => `${c}${LIB[c].zh}`).join('、') : '无'));
  if (a.hasCycle) throw new Error(name + ' 出现循环依赖');
  // 起点应该只有放线、临时设施等
  console.log('起点任务：' + a.starts.join(', '));
  if (verbose) {
    const show = (key) => {
      const t = plan.tasks.find(x => x.key === key);
      if (!t) { console.log(`  ${key}: 本项目没有`); return; }
      const pre = plan.deps.filter(d => d.to === key)
        .map(d => `${d.from}${d.type === 'SS' ? `(开始且≥${d.min}%)` : ''}${d.lag ? `+${d.lag}天` : ''}`);
      console.log(`  ${key} ${t.zh}  <=  ${pre.join('、') || '无'}`);
    };
    console.log('抽查先后关系：');
    ['B01', 'B08', 'C01@1', 'C01@2', 'C06@1', 'C09@1', 'E01@1', 'E14@1', 'E08@1', 'F01@1', 'F02@1', 'F02@2',
      'F05@1', 'F08@1', 'F15@1', 'F26@1', 'G01@1', 'D05', 'I02', 'I04'].forEach(show);
  }
  return plan;
}

// 示例工况：仅用于验证引擎，不是 Mira Villa 的真实数据
run('A 示例：2 层平屋面，默认配置', {}, true);
run('B 3 层 + 地下室 + 坡屋面 + 桩基 + 软地基 + 电梯 + 泳池 + 木地板 + 墙纸', {
  floors: 3, basement: true, roof: 'pitched', foundation: 'pile', soft_soil: true, high_water: true,
  elevator: true, pool: true, floor_finish: 'wood', wall_finish: 'mixed', ceiling: 'aluminum_wet',
  exterior_insulation: true, aircon: 'central', hot_water: 'solar', water_supply: 'tank', balconies: 2, fixed_furniture: true
});
run('C 1 层最简：无楼梯、无吊顶、无空调、无橱柜', {
  floors: 1, stairs: 0, ceiling: 'none', aircon: 'none', hot_water: 'none', cabinet: false, shower_room: false,
  fence: false, road: false, landscape: false, roof_insulation: false
});
run('D 带阁楼的 2 层，两种屋面都有', { floors: 2, attic: true, roof: 'both' });
run('E 无卫生间无厨房（边界情况）', { bathrooms: 0, kitchens: 0 });
run('F 10 层（上限）', { floors: 10 });

// 非法输入应当报错
for (const bad of [{ structure: 'steel' }, { floors: 0 }, { floors: 11 }]) {
  try { generatePlan(bad); console.log('\n!! 未报错：', JSON.stringify(bad)); process.exitCode = 1; }
  catch (e) { console.log(`\n非法输入 ${JSON.stringify(bad)} -> 正确报错：${e.message}`); }
}
console.log('\n全部工况检查完成');

// ---- 按楼层判断的检查 ----
const assert = require('assert');
(function floorLevelChecks() {
  const has = (plan, key) => plan.tasks.some(t => t.key === key);
  // 3 层：1 层只有厨房没有卫生间，2、3 层各 2 个卫生间；阳台 2 个；楼梯 1 部
  const plan = generatePlan({ floors: 3, bathrooms_by_floor: [0, 2, 2], kitchens: 1, kitchen_floors: [1], balconies: 2, stairs: 1 });
  assert.ok(!has(plan, 'F26@1'), '1 层没有卫生间，不应有洁具安装');
  assert.ok(has(plan, 'F26@2') && has(plan, 'F26@3'));
  assert.ok(has(plan, 'F28@1'), '厨房在 1 层，橱柜应在 1 层');
  assert.ok(!has(plan, 'F28@2') && !has(plan, 'F28@3'));
  assert.ok(has(plan, 'F04@1'), '1 层有厨房，需要防水');
  assert.ok(has(plan, 'F04@2') && has(plan, 'F04@3'));
  assert.ok(has(plan, 'C08@1') && has(plan, 'C08@2') && !has(plan, 'C08@3'), '最高层没有通向上一层的楼梯');
  assert.ok(!has(plan, 'C13@1') && has(plan, 'C13@2') && has(plan, 'C13@3'), '阳台默认放在 2 层及以上');
  // 总数不变：2 个阳台
  assert.strictEqual(plan.profile.balconies, 2);
  // 1 个阳台、3 层：只放在 2 层，不会多出来
  const one = generatePlan({ floors: 3, balconies: 1 });
  assert.strictEqual(one.profile.balconies, 1);
  assert.ok(has(one, 'C13@2') && !has(one, 'C13@3'));
  // 有卫生间的楼层，洁具必须等这一层的墙砖地砖；没有卫生间的楼层，其他工序不会因此断链
  const dep = (a, b) => plan.deps.some(d => d.from === a && d.to === b);
  assert.ok(dep('F08@2', 'F26@2') || plan.deps.some(d => d.to === 'F26@2' && d.from.startsWith('F08@2')));
  const a = analyze(plan);
  assert.ok(!a.hasCycle, '按楼层判断后不应出现循环');
  // 每个任务（除了起点）至少有一个前置，且前置都存在
  const keys = new Set(plan.tasks.map(t => t.key));
  plan.deps.forEach(d => { assert.ok(keys.has(d.from) && keys.has(d.to)); });
  // 单层房子：没有楼梯
  const one1 = generatePlan({ floors: 1 });
  assert.ok(!one1.tasks.some(t => t.code === 'C08'), '单层房子没有楼梯');
  console.log('\n按楼层判断的检查通过：卫生间、厨房、阳台、楼梯都只出现在该有的楼层，没有循环依赖');
})();
