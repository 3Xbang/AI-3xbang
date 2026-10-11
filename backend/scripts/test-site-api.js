// 端到端测试（在服务器上运行：cd backend && node scripts/test-site-api.js）
// 用一个临时项目走完整流程，结束后删掉所有测试数据。不会碰其他项目。
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');
const { generatePlan } = require('../src/process-master');

const BASE = 'http://localhost:' + (process.env.PORT || 3001) + '/api';
const MANAGER = jwt.sign({ id: 2, username: 'admin', role: 'manager' }, process.env.JWT_SECRET);
const STRANGER = jwt.sign({ id: 999999, username: 'nobody', role: 'executor' }, process.env.JWT_SECRET);
let passed = 0;

async function call(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method, headers: Object.assign({ 'Content-Type': 'application/json' }, token === null ? {} : { Authorization: 'Bearer ' + (token || MANAGER) }),
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null; try { json = await r.json(); } catch (_) { /* ignore */ }
  return { status: r.status, json };
}
const ok = (name) => { passed++; console.log('通过：' + name); };

(async () => {
  const testStart = new Date();
  let pid = null;
  try {
    // ---- 临时项目（开工日 2026-11-02，周一） ----
    const p = await pool.query(
      `INSERT INTO projects (name, location, client_name, start_date, planned_end_date, status)
       VALUES ('{"zh":"__自动测试项目__","th":"__test__"}', '{"zh":"测试","th":"test"}', 'TEST', '2026-11-02', '2027-06-30', 'active') RETURNING id`);
    pid = p.rows[0].id;

    const answers = { floors: 2, bathrooms: 2, kitchens: 1, stairs: 1, total_area: 300 };

    // ---- 申请表 ----
    let r = await call('PUT', `/projects/${pid}/profile`, { answers: { floors: 11 } });
    assert.strictEqual(r.status, 400); ok('层数超范围的申请表被拒绝');
    r = await call('PUT', `/projects/${pid}/profile`, { answers });
    assert.strictEqual(r.status, 200); ok('保存申请表');
    r = await call('GET', `/projects/${pid}/profile`);
    assert.strictEqual(r.json.data.answers.floors, 2); ok('读取申请表');

    // ---- 预览与本地引擎一致 ----
    const local = generatePlan(answers);
    r = await call('POST', `/projects/${pid}/plan/preview`, {});
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.data.summary.tasks, local.tasks.length);
    assert.strictEqual(r.json.data.summary.deps, local.deps.length);
    ok(`预览：${r.json.data.summary.tasks} 个任务，${r.json.data.summary.deps} 条先后关系，与本地引擎一致`);

    // ---- 旧工序处理：先放两个旧的固定模板工序 ----
    for (const [code, name] of [['N01_EXCAVATION', '土方开挖'], ['FND-01-01', '场地平整']]) {
      const n = await pool.query(`INSERT INTO process_nodes (project_id, process_code, process_name, sequence_number) VALUES ($1,$2,$3::jsonb,1) RETURNING id`, [pid, code, JSON.stringify({ zh: name, th: '' })]);
      await pool.query(`INSERT INTO process_execution (process_node_id, status, quantity_unit) VALUES ($1,'not_started','m²')`, [n.rows[0].id]);
    }
    r = await call('POST', `/projects/${pid}/plan/apply`, {});
    assert.strictEqual(r.status, 409); assert.strictEqual(r.json.code, 'LEGACY_CHOICE'); ok('有旧工序时必须先选择替换或保留');
    await pool.query(`UPDATE process_execution SET status='in_progress' WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id=$1 AND process_code='FND-01-01')`, [pid]);
    r = await call('POST', `/projects/${pid}/plan/apply`, { legacy: 'replace' });
    assert.strictEqual(r.status, 409); assert.strictEqual(r.json.code, 'LEGACY_TOUCHED'); ok('旧工序已开始时不能替换');
    await pool.query(`UPDATE process_execution SET status='not_started' WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id=$1)`, [pid]);

    r = await call('POST', `/projects/${pid}/plan/apply`, { legacy: 'replace' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.strictEqual(r.json.data.added, local.tasks.length);
    assert.strictEqual(r.json.data.legacyRemoved, 2);
    ok(`生成工序：新增 ${r.json.data.added}，替换掉 2 个旧工序`);

    const cnt = await pool.query(`SELECT count(*)::int AS n, count(master_code)::int AS m FROM process_nodes WHERE project_id=$1`, [pid]);
    assert.strictEqual(cnt.rows[0].n, local.tasks.length); assert.strictEqual(cnt.rows[0].m, local.tasks.length);
    const dcnt = await pool.query(`SELECT count(*)::int AS n FROM process_dependencies d JOIN process_execution pe ON pe.id=d.process_execution_id JOIN process_nodes pn ON pn.id=pe.process_node_id WHERE pn.project_id=$1`, [pid]);
    assert.strictEqual(dcnt.rows[0].n, local.deps.length);
    ok('数据库里的工序数和先后关系数与计划完全一致');

    r = await call('GET', `/projects/${pid}/processes`);
    assert.ok(r.json.data.every(x => x.master_code) && r.json.data.some(x => x.floor_no === 2)); ok('工序列表带有总库编码和楼层');

    r = await call('POST', `/projects/${pid}/plan/apply`, {});
    assert.strictEqual(r.json.data.added, 0); assert.strictEqual(r.json.data.removed, 0); ok('重复生成不会产生重复工序');

    // ---- 团队 ----
    const M = async (b) => (await call('POST', `/projects/${pid}/team`, b)).json.data.id;
    r = await call('POST', `/projects/${pid}/team`, { name: '无技能技工', level: 'skilled', skills: [] });
    assert.strictEqual(r.status, 400); ok('技工必须选至少一个工种');
    const m1 = await M({ name: '阿雄', level: 'skilled', skills: ['mason', 'tiler'] });
    const m2 = await M({ name: '阿标', level: 'skilled', skills: ['mason'] });
    const h1 = await M({ name: '小王', level: 'helper', skills: ['*'] });
    const h2 = await M({ name: '小李', level: 'helper', skills: ['*'] });
    const h3 = await M({ name: '小张', level: 'helper', skills: ['*'] });
    r = await call('GET', `/projects/${pid}/team`);
    assert.strictEqual(r.json.data.members.length, 5); assert.ok(r.json.data.crewCapacity.mason >= 1); ok('团队名册：5 人，并估算出各工种班组上限');

    // ---- 执行 id ----
    const ex = {};
    (await pool.query(`SELECT pe.id, pn.process_code FROM process_execution pe JOIN process_nodes pn ON pn.id=pe.process_node_id WHERE pn.project_id=$1`, [pid]))
      .rows.forEach(x => { ex[x.process_code] = x.id; });

    // ---- 看板（开工第一天）----
    r = await call('GET', `/projects/${pid}/site-board?date=2026-11-02`);
    assert.strictEqual(r.status, 200); assert.ok(r.json.data.planned);
    const readyKeys = r.json.data.ready.map(x => x.key).sort();
    assert.deepStrictEqual(readyKeys, ['A01', 'A02'], '第一天只有放线和临时设施可以开始，实际：' + readyKeys);
    const b01 = r.json.data.blocked.find(x => x.key === 'B01');
    assert.ok(b01 && b01.reasons[0].zh.includes('场地'), 'B01 应因场地清理未完成而被排除');
    ok('看板第一天：只有 放线、临时设施 可以开始，基坑开挖被排除并说明原因');

    // ---- 被拦住 / 提前开始 ----
    r = await call('POST', `/processes/${ex['B01']}/start`, {});
    assert.strictEqual(r.status, 409); assert.strictEqual(r.json.code, 'BLOCKED'); assert.ok(r.json.reasons.length);
    ok('前置没满足时开始被拦住，并返回原因');
    r = await call('PUT', `/processes/${ex['B01']}`, { status: 'in_progress' });
    assert.strictEqual(r.status, 409); assert.strictEqual(r.json.code, 'BLOCKED');
    const stillNot = await pool.query('SELECT status FROM process_execution WHERE id=$1', [ex['B01']]);
    assert.strictEqual(stillNot.rows[0].status, 'not_started');
    ok('旧的「开始工序」按钮路径同样被拦住，状态没有改变');
    r = await call('POST', `/processes/${ex['B01']}/start`, { force_reason: '   ' });
    assert.strictEqual(r.status, 409); ok('提前开始不写原因（只有空格）不行');
    r = await call('POST', `/processes/${ex['B01']}/start`, { force_reason: '业主要求提前交付，已和监理确认' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json)); assert.ok(r.json.data.override);
    assert.ok(['low', 'medium', 'high'].includes(r.json.data.override.severity));
    ok(`写原因后允许提前开始，风险等级：${r.json.data.override.severity}`);
    const ov = await pool.query('SELECT * FROM process_overrides WHERE project_id=$1', [pid]);
    assert.strictEqual(ov.rows.length, 1); assert.ok(ov.rows[0].reason.includes('业主')); assert.ok(ov.rows[0].decided_by_name);
    ok('提前开始已记录：原因、决定人、风险');
    r = await call('GET', `/notifications?project_id=${pid}`);
    assert.ok(r.json.data.items.length >= 1 && r.json.data.items[0].body.includes('业主要求'));
    ok('管理者收到了提前开始的通知');
    const nid = r.json.data.items[0].id;
    r = await call('POST', `/notifications/${nid}/read`, {});
    r = await call('GET', `/notifications?project_id=${pid}&unread=1`);
    assert.strictEqual(r.json.data.items.length, 0); ok('通知可以标记已读');
    r = await call('GET', `/projects/${pid}/overrides`);
    assert.strictEqual(r.json.data.length, 1); ok('提前开始记录可查询');

    // ---- 推进进度：A01 A02 在 11-02 完成 ----
    for (const c of ['A01', 'A02']) {
      r = await call('POST', `/processes/${ex[c]}/start`, {});
      assert.strictEqual(r.status, 200); assert.ok(!r.json.data.override);
      await pool.query(`UPDATE process_execution SET status='completed', completion_percentage=100, actual_end_date='2026-11-02' WHERE id=$1`, [ex[c]]);
    }
    ok('满足条件的任务正常开始，没有提前开始记录');
    r = await call('GET', `/projects/${pid}/site-board?date=2026-11-02`);
    assert.ok(!r.json.data.ready.some(x => x.key === 'A03'), '同一天完成的前置，当天不能马上开始后续');
    r = await call('GET', `/projects/${pid}/site-board?date=2026-11-03`);
    assert.ok(r.json.data.ready.some(x => x.key === 'A03')); ok('前置完成的第二天，后续任务才变成可以开始');

    // ---- 出勤与派工（11-03）----
    r = await call('PUT', `/projects/${pid}/attendance`, { date: '2026-11-03', absent: [h3] });
    assert.strictEqual(r.status, 200);
    r = await call('GET', `/projects/${pid}/site-board?date=2026-11-03`);
    assert.ok(r.json.data.absent.includes(h3)); ok('出勤：没来的人在看板上标出');
    const asg = (a) => call('PUT', `/projects/${pid}/site-assignments`, { date: '2026-11-03', assignments: a });
    r = await asg({ [ex['A03']]: [m1, h1] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json)); ok('给可以开始的任务派人');
    r = await asg({ [ex['A03']]: [m1], [ex['A02']]: [m1] });
    assert.strictEqual(r.status, 400); ok('同一个人同一天不能派到两个任务');
    r = await asg({ [ex['A03']]: [h3] });
    assert.strictEqual(r.status, 400); ok('没来的人不能被派工');
    r = await asg({ [ex['B04']]: [m2] });
    assert.strictEqual(r.status, 409); assert.strictEqual(r.json.code, 'BLOCKED'); ok('给前置没满足的任务派人被拒绝，提示要先「提前开始」');
    r = await asg({ [ex['A03']]: [m1, h1] });
    r = await call('GET', `/projects/${pid}/site-board?date=2026-11-03`);
    assert.deepStrictEqual(r.json.data.assignments[ex['A03']].sort(), [m1, h1].sort());
    const sugUsed = r.json.data.suggestions.flatMap(s => s.members.map(m => m.id));
    assert.ok(!sugUsed.includes(m1) && !sugUsed.includes(h1) && !sugUsed.includes(h3));
    ok('已派的人和没来的人不会再被建议');
    r = await call('PUT', `/projects/${pid}/attendance`, { date: '2026-11-03', absent: [h3, h1] });
    r = await call('GET', `/projects/${pid}/site-board?date=2026-11-03`);
    assert.ok(!r.json.data.assignments[ex['A03']] || !r.json.data.assignments[ex['A03']].includes(h1)); ok('标记缺勤后，他当天已有的派工被撤掉');

    // ---- 申请表变更：改成 3 层，已有进度保留 ----
    r = await call('POST', `/projects/${pid}/plan/preview`, { answers: Object.assign({}, answers, { floors: 3 }) });
    assert.ok(r.json.data.willAdd > 0); ok(`变更预览：改成 3 层，将新增 ${r.json.data.willAdd} 个任务`);
    r = await call('POST', `/projects/${pid}/plan/apply`, { answers: Object.assign({}, answers, { floors: 3 }) });
    assert.strictEqual(r.status, 200); assert.ok(r.json.data.added > 0); assert.strictEqual(r.json.data.removed, 0);
    const kept = await pool.query(`SELECT status FROM process_execution pe JOIN process_nodes pn ON pn.id=pe.process_node_id WHERE pn.project_id=$1 AND pn.process_code IN ('A01','A02')`, [pid]);
    assert.ok(kept.rows.every(x => x.status === 'completed')); ok('变更后重新生成：新增了任务，已完成的进度保留');
    r = await call('POST', `/projects/${pid}/plan/apply`, { answers: Object.assign({}, answers, { floors: 1 }) });
    assert.ok(r.json.data.removed > 0); ok(`改回 1 层：移除 ${r.json.data.removed} 个没动过的任务`);
    const dup = await pool.query(`SELECT process_code, count(*)::int AS n FROM process_nodes WHERE project_id=$1 GROUP BY process_code HAVING count(*)>1`, [pid]);
    assert.strictEqual(dup.rows.length, 0); ok('没有重复的工序编码');

    // ---- 权限 ----
    r = await call('PUT', `/projects/${pid}/profile`, { answers }, STRANGER);
    assert.strictEqual(r.status, 403); ok('没有项目权限的人不能改申请表');
    r = await call('POST', `/projects/${pid}/plan/apply`, {}, STRANGER);
    assert.strictEqual(r.status, 403); ok('没有项目权限的人不能生成工序');
    r = await call('GET', `/projects/${pid}/site-board`, null, STRANGER);
    assert.strictEqual(r.status, 403); ok('没有项目权限的人看不到看板');
    r = await call('POST', `/processes/${ex['A03']}/start`, {}, STRANGER);
    assert.strictEqual(r.status, 403); ok('没有项目权限的人不能开始工序');
    r = await call('GET', `/projects/${pid}/site-board`, null, null);
    assert.strictEqual(r.status, 401); ok('未登录访问被拒绝');

    console.log(`\n全部通过：${passed} 项`);
  } catch (e) {
    console.error('\n测试失败：', e.message);
    process.exitCode = 1;
  } finally {
    if (pid) {
      await pool.query('DELETE FROM workers WHERE project_id = $1', [pid]);     // workers 没有外键，手动删
      await pool.query('DELETE FROM projects WHERE id = $1', [pid]);              // 其余表都是级联删除
      const left = await pool.query(`SELECT (SELECT count(*) FROM projects WHERE id=$1) AS p, (SELECT count(*) FROM notifications WHERE project_id=$1) AS n, (SELECT count(*) FROM process_overrides WHERE project_id=$1) AS o`, [pid]);
      console.log('清理完成，残留：', JSON.stringify(left.rows[0]));
    }
    await pool.end();
  }
})();
