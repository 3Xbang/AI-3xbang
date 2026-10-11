// 用法: node scripts/test-boq-import.js <清单.xlsx>
// 只读取并打印对应结果，不连数据库。
const fs = require('fs');
const { generatePlan } = require('../src/process-master');
const { readBoq, mapBoq } = require('../src/boq-import');

const file = process.argv[2];
if (!file) { console.log('用法: node scripts/test-boq-import.js <清单.xlsx>'); process.exit(1); }
const answers = {
  floors: 2, units: 6, total_area: 478, roof: 'pitched', roof_insulation: false, stairs: 6,
  bathrooms_by_floor: [6, 6], kitchens: 6, kitchen_floors: [1], cabinet: false, shower_room: false,
  aircon: 'none', hot_water: 'none', pool: false, ceiling: 'gypsum'
};
const plan = generatePlan(answers);
const boq = readBoq(fs.readFileSync(file));
const r = mapBoq(boq, plan, plan.profile);
console.log(`表: ${r.sheet}  清单行: ${r.itemCount}  对应工序: ${r.matches.length}  未对应: ${r.unmapped.length}  计划里没有: ${r.notInPlan.length}  缺数量: ${r.missing.length}`);
console.log('\n--- 对应 ---');
r.matches.forEach(m => console.log(`${m.key.padEnd(8)} ${m.name}  ${m.qty} ${m.unit}  [${m.kind}] ${m.notes.join('; ')}`));
console.log('\n--- 未对应 ---');
r.unmapped.forEach(u => console.log(`${u.section} / ${u.desc}  ${u.qty ?? ''} ${u.unit}  -> ${u.reason}`));
console.log('\n--- 计划里没有 ---');
r.notInPlan.forEach(u => console.log(JSON.stringify(u)));
console.log('\n--- 警告 ---');
r.warnings.forEach(w => console.log(w));
console.log('\n--- 缺数量(前40) ---');
r.missing.slice(0, 40).forEach(m => console.log(`${m.key} ${m.name} (${m.unit})`));
