// 现场安排相关的接口：项目申请表、生成计划、团队名册、出勤、现场看板、派工、开始工序、通知
const express = require('express');
const router = express.Router();
const pool = require('./config/db');
const authenticate = require('./middleware-auth');
const { requirePermission, requireProjectAccess, checkProjectAccess, logActivity } = require('./middleware-permissions');
const S = require('./site-service');
const { canStart } = require('./advisor');
const { describeReason, crewsFromTeam } = require('./advisor');
const { todayInBangkok } = require('./work-calendar');

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (!(e instanceof S.HttpError)) console.error('site-routes error:', e);
    res.status(e.status || 500).json(Object.assign({ success: false, message: e.message }, e.extra || {}));
  }
};

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  } finally { client.release(); }
}

async function execProject(client, execId) {
  const r = await client.query(
    'SELECT pn.project_id FROM process_execution pe JOIN process_nodes pn ON pn.id = pe.process_node_id WHERE pe.id = $1', [execId]);
  if (!r.rows.length) throw new S.HttpError(404, '工序不存在');
  return r.rows[0].project_id;
}
async function requireAccessToExec(client, req, execId) {
  const projectId = await execProject(client, execId);
  if (!(await checkProjectAccess(client, req.user.id, req.user.role, projectId))) throw new S.HttpError(403, '无权访问此项目');
  return projectId;
}
const validDate = d => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayInBangkok());
const TRADE_KEYS = Object.keys(S.TRADES);

// ---------- 基础信息 ----------
router.get('/site/meta', authenticate, (req, res) => {
  res.json({ success: true, data: { trades: S.TRADES, defaults: S.DEFAULT_PROFILE } });
});

// ---------- 项目申请表 ----------
router.get('/projects/:projectId/profile', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const p = await S.getProfile(pool, req.params.projectId);
  res.json({ success: true, data: { answers: p ? p.answers : {}, planGeneratedAt: p ? p.plan_generated_at : null, defaults: S.DEFAULT_PROFILE } });
}));

router.put('/projects/:projectId/profile', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req, res) => {
  const answers = req.body.answers;
  if (!answers || typeof answers !== 'object') throw new S.HttpError(400, '缺少申请表答案');
  try { await S.saveProfile(pool, req.params.projectId, answers, req.user.id); }
  catch (e) { throw new S.HttpError(400, e.message); }
  res.json({ success: true, message: '申请表已保存' });
}));

router.post('/projects/:projectId/plan/preview', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req, res) => {
  let answers = req.body.answers;
  if (!answers) { const p = await S.getProfile(pool, req.params.projectId); answers = p ? p.answers : {}; }
  let data;
  try { data = await S.previewPlan(pool, req.params.projectId, answers); }
  catch (e) { throw new S.HttpError(400, e.message); }
  res.json({ success: true, data });
}));

router.post('/projects/:projectId/plan/apply', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req, res) => {
  const projectId = req.params.projectId;
  const p = await S.getProfile(pool, projectId);
  const answers = req.body.answers || (p ? p.answers : {});
  const result = await tx(async client => {
    await S.saveProfile(client, projectId, answers, req.user.id);
    let r;
    try { r = await S.applyPlan(client, projectId, answers, { legacy: req.body.legacy || null }); }
    catch (e) { if (e instanceof S.HttpError) throw e; throw new S.HttpError(400, e.message); }
    await logActivity(client, req.user.id, 'apply_plan', 'project', Number(projectId), { message: `按申请表生成工序：新增 ${r.added}，移除 ${r.removed}` });
    return r;
  });
  res.json({ success: true, message: '工序已生成', data: result });
}));

// ---------- 团队名册（沿用 workers 表） ----------
function cleanMember(b) {
  const level = b.level === 'skilled' ? 'skilled' : 'helper';
  const name = String(b.name || '').trim();
  if (!name) throw new S.HttpError(400, '请填写姓名');
  let skills = Array.isArray(b.skills) ? b.skills : [];
  skills = skills.filter(s => s === '*' || TRADE_KEYS.includes(s));
  if (level === 'skilled' && !skills.length) throw new S.HttpError(400, '技工至少要选一个工种');
  if (level === 'skilled' && skills.includes('*')) skills = skills.filter(s => s !== '*');
  if (level === 'helper' && !skills.length) skills = ['*'];
  return { name, level, skills, phone: b.phone || null, role: b.role || null, daily_wage: Number(b.daily_wage) || 0 };
}

router.get('/projects/:projectId/team', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT worker_id AS id, name, level, skills, role, phone, daily_wage FROM workers WHERE project_id = $1 AND status = 'active' ORDER BY worker_id`,
    [req.params.projectId]);
  const members = r.rows.map(w => ({ id: w.id, name: w.name, level: w.level === 'skilled' ? 'skilled' : 'helper',
    skills: Array.isArray(w.skills) && w.skills.length ? w.skills : (w.level === 'skilled' ? [] : ['*']), role: w.role, phone: w.phone, daily_wage: w.daily_wage }));
  res.json({ success: true, data: { members, crewCapacity: crewsFromTeam({ members }) } });
}));

router.post('/projects/:projectId/team', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req, res) => {
  const m = cleanMember(req.body);
  const r = await pool.query(
    `INSERT INTO workers (project_id, name, role, phone, daily_wage, level, skills) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING worker_id AS id`,
    [req.params.projectId, m.name, m.role, m.phone, m.daily_wage, m.level, JSON.stringify(m.skills)]);
  res.json({ success: true, data: { id: r.rows[0].id } });
}));

router.put('/team/:workerId', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  const m = cleanMember(req.body);
  const r = await pool.query(
    `UPDATE workers SET name = $1, role = $2, phone = $3, daily_wage = $4, level = $5, skills = $6::jsonb WHERE worker_id = $7 RETURNING worker_id`,
    [m.name, m.role, m.phone, m.daily_wage, m.level, JSON.stringify(m.skills), req.params.workerId]);
  if (!r.rows.length) throw new S.HttpError(404, '成员不存在');
  res.json({ success: true });
}));

router.delete('/team/:workerId', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  const r = await pool.query(`UPDATE workers SET status = 'inactive' WHERE worker_id = $1 RETURNING worker_id`, [req.params.workerId]);
  if (!r.rows.length) throw new S.HttpError(404, '成员不存在');
  res.json({ success: true });
}));

// ---------- 施工班组：只填班组名、大工/普工人数、“几个大工会什么”；系统自动生成对应的“人”用于出勤和派工 ----------
// 班组里可选的工种 = 系统工种清单（site-service 的 TRADES），不含普工/杂工（普工另填人数）。
const COARSE_KEYS = TRADE_KEYS.filter(k => k !== 'general');

function cleanCrew(b) {
  const name = String(b.name || '').trim();
  if (!name) throw new S.HttpError(400, '请填写班组名称');
  const skilled = Math.floor(Number(b.skilled_count));
  const helper = Math.floor(Number(b.helper_count));
  if (!(skilled >= 0 && skilled <= 100) || !(helper >= 0 && helper <= 300)) throw new S.HttpError(400, '人数不正确');
  if (skilled + helper < 1) throw new S.HttpError(400, '班组至少要有 1 个人');
  const counts = {};
  const input = b.skill_counts && typeof b.skill_counts === 'object' ? b.skill_counts : {};
  COARSE_KEYS.forEach(k => {
    const n = Math.floor(Number(input[k]));
    if (n > 0) {
      if (n > skilled) throw new S.HttpError(400, '某个工种的人数不能比大工总数多');
      counts[k] = n;
    }
  });
  if (skilled > 0 && !Object.keys(counts).length) throw new S.HttpError(400, '请填写有几个大工会干什么');
  return { name, skilled, helper, counts };
}

// 把“几个人会什么”分到具体每个大工身上：按顺序轮流分配，各项人数加起来不超过大工总数时互不重叠，超过时就是多能工
function skillsPerPerson(total, counts) {
  const people = Array.from({ length: total }, () => new Set());
  let p = 0;
  COARSE_KEYS.forEach(k => {
    const n = counts[k] || 0;
    for (let i = 0; i < n; i++) people[(p + i) % total].add(k);
    p = (p + n) % Math.max(total, 1);
  });
  return people.map(s => Array.from(s));
}

// 让 workers 表里这个班组的人数、名字、工种与班组设置一致（多出来的设为 inactive，不删历史派工）
async function syncCrewWorkers(client, projectId, crewId, c) {
  const perPerson = skillsPerPerson(c.skilled, c.counts);
  for (const level of ['skilled', 'helper']) {
    const want = level === 'skilled' ? c.skilled : c.helper;
    const label = level === 'skilled' ? '大工' : '普工';
    const have = (await client.query(
      `SELECT worker_id FROM workers WHERE crew_id = $1 AND level = $2 AND status = 'active' ORDER BY worker_id`, [crewId, level])).rows;
    if (have.length > want) {
      await client.query(`UPDATE workers SET status = 'inactive' WHERE worker_id = ANY($1::int[])`, [have.slice(want).map(r => r.worker_id)]);
    }
    for (let i = 0; i < want; i++) {
      const nm = `${c.name} ${label}${i + 1}`;
      const skills = JSON.stringify(level === 'skilled' ? perPerson[i] : ['*']);
      if (i < have.length) {
        await client.query('UPDATE workers SET name = $1, skills = $2::jsonb WHERE worker_id = $3', [nm, skills, have[i].worker_id]);
      } else {
        await client.query(
          `INSERT INTO workers (project_id, name, daily_wage, level, skills, crew_id) VALUES ($1, $2, 0, $3, $4::jsonb, $5)`,
          [projectId, nm, level, skills, crewId]);
      }
    }
  }
}

router.get('/projects/:projectId/crews', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT id, name, skilled_count, helper_count, skills AS skill_counts FROM project_crews WHERE project_id = $1 AND status = 'active' ORDER BY id`, [req.params.projectId]);
  const crews = r.rows;
  const tot = crews.reduce((s, c) => ({ skilled: s.skilled + c.skilled_count, helper: s.helper + c.helper_count }), { skilled: 0, helper: 0 });
  res.json({ success: true, data: { crews, total: tot } });
}));

router.post('/projects/:projectId/crews', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req, res) => {
  const c = cleanCrew(req.body);
  const id = await tx(async client => {
    const r = await client.query(
      `INSERT INTO project_crews (project_id, name, skilled_count, helper_count, skills) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [req.params.projectId, c.name, c.skilled, c.helper, JSON.stringify(c.counts)]);
    await syncCrewWorkers(client, Number(req.params.projectId), r.rows[0].id, c);
    return r.rows[0].id;
  });
  res.json({ success: true, data: { id } });
}));

router.put('/crews/:id', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  const c = cleanCrew(req.body);
  await tx(async client => {
    const cur = await client.query(`SELECT project_id FROM project_crews WHERE id = $1 AND status = 'active'`, [req.params.id]);
    if (!cur.rows.length) throw new S.HttpError(404, '班组不存在');
    const pid = cur.rows[0].project_id;
    if (!(await checkProjectAccess(client, req.user.id, req.user.role, pid))) throw new S.HttpError(403, '无权访问此项目');
    await client.query(
      `UPDATE project_crews SET name = $1, skilled_count = $2, helper_count = $3, skills = $4::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
      [c.name, c.skilled, c.helper, JSON.stringify(c.counts), req.params.id]);
    await syncCrewWorkers(client, pid, Number(req.params.id), c);
  });
  res.json({ success: true });
}));

router.delete('/crews/:id', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  await tx(async client => {
    const cur = await client.query(`SELECT project_id FROM project_crews WHERE id = $1 AND status = 'active'`, [req.params.id]);
    if (!cur.rows.length) throw new S.HttpError(404, '班组不存在');
    if (!(await checkProjectAccess(client, req.user.id, req.user.role, cur.rows[0].project_id))) throw new S.HttpError(403, '无权访问此项目');
    await client.query(`UPDATE project_crews SET status = 'inactive' WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE workers SET status = 'inactive' WHERE crew_id = $1`, [req.params.id]);
  });
  res.json({ success: true });
}));

// ---------- 出勤 ----------
router.get('/projects/:projectId/attendance', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const date = validDate(req.query.date);
  const r = await pool.query(
    `SELECT w.worker_id AS id, w.name, COALESCE(a.status, 'present') AS status
       FROM workers w LEFT JOIN daily_attendance a ON a.worker_id = w.worker_id AND a.attendance_date = $2
      WHERE w.project_id = $1 AND w.status = 'active' ORDER BY w.worker_id`, [req.params.projectId, date]);
  res.json({ success: true, data: { date, members: r.rows } });
}));

// 工头标记今天没来的人，其余默认来了
router.put('/projects/:projectId/attendance', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const date = validDate(req.body.date);
  const absent = (req.body.absent || []).map(Number);
  await tx(async client => {
    const w = await client.query(`SELECT worker_id FROM workers WHERE project_id = $1 AND status = 'active'`, [req.params.projectId]);
    for (const row of w.rows) {
      const st = absent.includes(row.worker_id) ? 'absent' : 'present';
      await client.query(
        `INSERT INTO daily_attendance (project_id, worker_id, attendance_date, status, created_by) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (worker_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, created_by = EXCLUDED.created_by`,
        [req.params.projectId, row.worker_id, date, st, req.user.id]);
    }
    if (absent.length) {
      // 没来的人，当天已经安排的任务要撤掉
      await client.query('DELETE FROM site_assignments WHERE project_id = $1 AND work_date = $2 AND worker_id = ANY($3::int[])', [req.params.projectId, date, absent]);
    }
  });
  res.json({ success: true });
}));

// ---------- 现场看板 ----------
router.get('/projects/:projectId/site-board', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const data = await S.buildBoard(pool, req.params.projectId, validDate(req.query.date));
  res.json({ success: true, data });
}));

// 预计工期与人员配置：每道工序要几个班组、几个大工几个普工、预计几天；整体预计完工日
router.get('/projects/:projectId/estimate', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const data = await S.buildEstimate(pool, req.params.projectId);
  res.json({ success: true, data });
}));

// 工头给今天派人：{ date, assignments: { 工序id: [工人id] } }（整天覆盖）
router.put('/projects/:projectId/site-assignments', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const projectId = Number(req.params.projectId);
  const date = validDate(req.body.date);
  const input = req.body.assignments || {};
  await tx(async client => {
    const L = await S.loadPlanState(client, projectId, date);
    const w = await client.query(`SELECT worker_id FROM workers WHERE project_id = $1 AND status = 'active'`, [projectId]);
    const valid = new Set(w.rows.map(r => r.worker_id));
    const ab = await client.query(`SELECT worker_id FROM daily_attendance WHERE project_id = $1 AND attendance_date = $2 AND status <> 'present'`, [projectId, date]);
    const absent = new Set(ab.rows.map(r => r.worker_id));
    const seen = new Set();
    for (const execId of Object.keys(input)) {
      const pid = await execProject(client, Number(execId));
      if (pid !== projectId) throw new S.HttpError(400, '工序不属于这个项目');
      for (const wid of input[execId].map(Number)) {
        if (!valid.has(wid)) throw new S.HttpError(400, `成员 ${wid} 不在这个项目的团队里`);
        if (absent.has(wid)) throw new S.HttpError(400, `成员 ${wid} 今天没来，不能安排`);
        if (seen.has(wid)) throw new S.HttpError(400, `成员 ${wid} 被安排到了多个任务，一个人一天只能在一个任务上`);
        seen.add(wid);
      }
      // 还没开始的、前置没满足的任务，不能派人（要先「提前开始」并写原因）
      if (L.planned && L.keyByExec.has(Number(execId))) {
        const key = L.keyByExec.get(Number(execId));
        const st = L.state.tasks[key];
        if (!st || st.status === 'not_started') {
          const check = canStart(L.plan, L.state, key);
          if (!check.allowed) {
            const label = k => { const t = L.plan.tasks.find(x => x.key === k); return t.zh + (t.floor != null ? `（${t.floor}层）` : ''); };
            throw new S.HttpError(409, '这个任务前置条件还没满足，不能派人。需要提前开始的话，请先点「提前开始」并写原因',
              { code: 'BLOCKED', reasons: check.reasons.map(r => describeReason(r, label)) });
          }
        }
      }
    }
    await client.query('DELETE FROM site_assignments WHERE project_id = $1 AND work_date = $2', [projectId, date]);
    for (const execId of Object.keys(input)) {
      for (const wid of input[execId].map(Number)) {
        await client.query(
          `INSERT INTO site_assignments (project_id, process_execution_id, worker_id, work_date, created_by) VALUES ($1, $2, $3, $4, $5)`,
          [projectId, Number(execId), wid, date, req.user.id]);
      }
    }
  });
  res.json({ success: true });
}));

// ---------- 开始工序（有把关；提前开始必须写原因并通知） ----------
router.post('/processes/:id/start', authenticate, wrap(async (req, res) => {
  const execId = Number(req.params.id);
  const out = await tx(async client => {
    await requireAccessToExec(client, req, execId);
    const r = await S.startProcess(client, execId, req.user, req.body.force_reason, /^\d{4}-\d{2}-\d{2}$/.test(req.body.date || '') ? req.body.date : undefined);
    if (r.started) await logActivity(client, req.user.id, r.override ? 'force_start_process' : 'start_process', 'process_execution', execId, { message: r.override ? r.override.message : '开始工序' });
    return r;
  });
  res.json({ success: true, data: out });
}));

// 进行中的任务：标记缺材料 / 天气停工 / 恢复。这些天在统计效率时不算班组的责任。
router.post('/processes/:id/work-status', authenticate, wrap(async (req, res) => {
  const execId = Number(req.params.id);
  const status = req.body.status;
  if (!['in_progress', 'waiting_material', 'weather_stop'].includes(status)) throw new S.HttpError(400, '状态不正确');
  const note = String(req.body.note || '').trim();
  if (status === 'waiting_material' && !note) throw new S.HttpError(400, '请写明缺什么材料');
  await tx(async client => {
    await requireAccessToExec(client, req, execId);
    const cur = await client.query('SELECT status FROM process_execution WHERE id = $1', [execId]);
    if (!['in_progress', 'waiting_material', 'weather_stop'].includes(cur.rows[0].status)) {
      throw new S.HttpError(409, '只有进行中的任务才能标记缺材料或天气停工');
    }
    await client.query(
      `UPDATE process_execution SET status = $1, notes = COALESCE($2::jsonb, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [status, note ? JSON.stringify({ zh: note, th: note }) : null, execId]);
    await logActivity(client, req.user.id, 'work_status', 'process_execution', execId,
      { message: `状态改为 ${status}${note ? '：' + note : ''}` });
  });
  res.json({ success: true });
}));

router.get('/projects/:projectId/overrides', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT o.id, o.severity, o.reason, o.unmet, o.decided_by_name, to_char(o.created_at, 'YYYY-MM-DD HH24:MI') AS created_at, pn.process_name
       FROM process_overrides o JOIN process_execution pe ON pe.id = o.process_execution_id JOIN process_nodes pn ON pn.id = pe.process_node_id
      WHERE o.project_id = $1 ORDER BY o.created_at DESC LIMIT 100`, [req.params.projectId]);
  res.json({ success: true, data: r.rows });
}));

// ---------- 通知 ----------
router.get('/notifications', authenticate, wrap(async (req, res) => {
  const params = [req.user.id];
  let where = 'to_user_id = $1';
  if (req.query.project_id) { params.push(Number(req.query.project_id)); where += ` AND project_id = $${params.length}`; }
  if (req.query.unread === '1') where += ' AND read_at IS NULL';
  const r = await pool.query(
    `SELECT id, project_id, title, body, severity, related_type, related_id, read_at IS NOT NULL AS is_read,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
       FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT 100`, params);
  const unread = await pool.query('SELECT count(*)::int AS n FROM notifications WHERE to_user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ success: true, data: { items: r.rows, unread: unread.rows[0].n } });
}));

router.post('/notifications/read-all', authenticate, wrap(async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE to_user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ success: true });
}));

router.post('/notifications/:id/read', authenticate, wrap(async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND to_user_id = $2', [req.params.id, req.user.id]);
  res.json({ success: true });
}));

// ---------- 项目准备完成度：前 3 步必须完成才能开工，后 2 步可以边做边补 ----------
router.get('/projects/:projectId/readiness', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const pid = Number(req.params.projectId);
  const prof = await S.getProfile(pool, pid);
  const team = (await pool.query(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE level = 'skilled')::int AS skilled FROM workers WHERE project_id = $1 AND status = 'active'`, [pid])).rows[0];
  const crewN = (await pool.query(`SELECT count(*)::int AS n FROM project_crews WHERE project_id = $1 AND status = 'active'`, [pid])).rows[0].n;
  const tasks = (await pool.query(
    `SELECT count(*)::int AS total FROM process_nodes pn JOIN process_execution pe ON pe.process_node_id = pn.id
      WHERE pn.project_id = $1 AND pn.master_code IS NOT NULL`, [pid])).rows[0];
  const accounts = (await pool.query('SELECT count(*)::int AS n FROM project_members WHERE project_id = $1', [pid])).rows[0].n;
  const drawCount = (await pool.query('SELECT count(*)::int AS n FROM project_drawings WHERE project_id = $1', [pid])).rows[0].n;

  const a = prof ? prof.answers : {};
  const steps = [
    { key: 'drawings', required: false, done: drawCount > 0,
      detail: drawCount > 0 ? `已上传 ${drawCount} 份图纸` : '还没有上传图纸（可以跳过）' },
    { key: 'boq', required: false, done: !!prof,
      detail: prof ? `已有申请表数据（${a.floors || '?'} 层）` : '上传 BOQ 可自动填好申请表（可以跳过，手动填）' },
    { key: 'profile', required: true, done: !!prof,
      detail: prof ? `${a.floors || '?'} 层${a.units > 1 ? `，${a.units} 套` : ''}${a.total_area ? `，约 ${a.total_area} 平方米` : ''}` : '还没有填写' },
    { key: 'team', required: true, done: team.n > 0 && team.skilled > 0,
      detail: team.n ? `${crewN} 个班组，大工 ${team.skilled} 人，普工 ${team.n - team.skilled} 人` + (team.skilled ? '' : '（至少要有 1 名大工）') : '还没有录入班组' },
    { key: 'plan', required: true, done: tasks.total > 0,
      detail: tasks.total ? `已生成 ${tasks.total} 道工序${prof && prof.plan_generated_at ? '（' + prof.plan_generated_at + '）' : ''}` : '还没有生成工序' },
    { key: 'accounts', required: false, done: accounts > 1,
      detail: `${accounts} 个账号可以访问本项目` }
  ];
  const missing = steps.filter(s => s.required && !s.done).map(s => s.key);
  res.json({ success: true, data: { steps, ready: missing.length === 0, missing } });
}));

// ---------- 导入工程量清单（Excel） ----------
const multer = require('multer');
const { generatePlan } = require('./process-master');
const BOQ = require('./boq-import');
const boqUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function boqMapping(projectId, file) {
  if (!file) throw new S.HttpError(400, '请选择清单文件（.xlsx）');
  if (!/\.xlsx$/i.test(file.originalname || '')) throw new S.HttpError(400, '目前只支持 Excel（.xlsx）清单。Word/PDF 请先另存为 Excel');
  const prof = await S.getProfile(pool, projectId);
  if (!prof) throw new S.HttpError(400, '请先填写并保存项目申请表，再导入清单');
  const plan = generatePlan(prof.answers);
  let boq;
  try { boq = BOQ.readBoq(file.buffer); } catch (e) { throw new S.HttpError(400, e.message); }
  return { plan, result: BOQ.mapBoq(boq, plan, plan.profile) };
}

router.post('/projects/:projectId/boq/preview', authenticate, requireProjectAccess(), requirePermission('manage_projects'), boqUpload.single('boq'), wrap(async (req, res) => {
  const { result } = await boqMapping(req.params.projectId, req.file);
  const cur = await pool.query(
    `SELECT pn.master_code, pn.floor_no, pe.planned_quantity FROM process_nodes pn JOIN process_execution pe ON pe.process_node_id = pn.id
      WHERE pn.project_id = $1 AND pn.master_code IS NOT NULL AND pe.planned_quantity > 0`, [req.params.projectId]);
  const have = new Map(cur.rows.map(r => [r.floor_no != null ? `${r.master_code}@${r.floor_no}` : r.master_code, Number(r.planned_quantity)]));
  result.matches.forEach(m => { if (have.has(m.key)) m.existing = have.get(m.key); });
  res.json({ success: true, data: result });
}));

// 确认后写入：只写“工序的计划数量”，其余数据不动。skip: 不想导入的工序 key 列表（JSON）
router.post('/projects/:projectId/boq/apply', authenticate, requireProjectAccess(), requirePermission('manage_projects'), boqUpload.single('boq'), wrap(async (req, res) => {
  const projectId = Number(req.params.projectId);
  const { result } = await boqMapping(projectId, req.file);
  let skip = [];
  try { skip = JSON.parse(req.body.skip || '[]'); } catch (_) { skip = []; }
  const skipSet = new Set(skip);
  const out = await tx(async client => {
    let written = 0;
    for (const m of result.matches) {
      if (skipSet.has(m.key)) continue;
      const r = await client.query(
        `UPDATE process_execution pe SET planned_quantity = $1, quantity_unit = COALESCE(pe.quantity_unit, $2), updated_at = CURRENT_TIMESTAMP
           FROM process_nodes pn
          WHERE pn.id = pe.process_node_id AND pn.project_id = $3 AND pn.master_code = $4 AND pn.floor_no IS NOT DISTINCT FROM $5`,
        [m.qty, m.unit, projectId, m.code, m.floor]);
      written += r.rowCount;
    }
    await logActivity(client, req.user.id, 'import_boq', 'project', projectId, { message: `导入工程量清单：写入 ${written} 道工序的计划数量` });
    return { written };
  });
  res.json({ success: true, data: out });
}));

// ============ 工序定额设置（仅管理者）============
const { QUOTA } = require('./process-quota');
const { LIB } = require('./process-master');

router.get('/quotas', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  const overrides = (await pool.query('SELECT process_code, output, skilled_count, helper_count FROM quota_overrides')).rows;
  const ovMap = Object.fromEntries(overrides.map(r => [r.process_code, r]));
  const list = Object.keys(QUOTA)
    .filter(code => QUOTA[code].kind === 'work')
    .map(code => {
      const q = QUOTA[code];
      const ov = ovMap[code];
      const def = LIB[code] || {};
      return {
        code,
        name: def.zh || code,
        unit: q.unit,
        output: ov ? Number(ov.output) : q.output,
        skilled: ov ? ov.skilled_count : q.crew.skilled,
        helper: ov ? ov.helper_count : q.crew.helper,
        isOverridden: !!ov,
        defaultOutput: q.output,
        defaultSkilled: q.crew.skilled,
        defaultHelper: q.crew.helper
      };
    });
  res.json({ success: true, data: list });
}));

router.put('/quotas/:code', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  const code = req.params.code;
  if (!QUOTA[code] || QUOTA[code].kind !== 'work') throw new S.HttpError(400, '工序编码不存在或不是按量计算的工序');
  const output = Number(req.body.output);
  const skilled = Math.floor(Number(req.body.skilled));
  const helper = Math.floor(Number(req.body.helper));
  if (!(output > 0 && output < 10000)) throw new S.HttpError(400, '产量必须大于 0');
  if (!(skilled >= 0 && skilled <= 20)) throw new S.HttpError(400, '大工人数不对');
  if (!(helper >= 0 && helper <= 20)) throw new S.HttpError(400, '普工人数不对');
  await pool.query(
    `INSERT INTO quota_overrides (process_code, output, skilled_count, helper_count, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (process_code) DO UPDATE SET output = EXCLUDED.output, skilled_count = EXCLUDED.skilled_count,
       helper_count = EXCLUDED.helper_count, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
    [code, output, skilled, helper, req.user.id]);
  res.json({ success: true });
}));

router.delete('/quotas/:code', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  await pool.query('DELETE FROM quota_overrides WHERE process_code = $1', [req.params.code]);
  res.json({ success: true, message: '已恢复默认值' });
}));




  const GANTT_SECTIONS={A:{zh:"前期准备",th:"Preliminary Works",color:"#64748b",light:"#f1f5f9"},B:{zh:"地基基础",th:"Foundation Works",color:"#d97706",light:"#fffbeb"},C:{zh:"主体结构",th:"Structural Work",color:"#3b82f6",light:"#eff6ff"},D:{zh:"屋面工程",th:"Roofing",color:"#22c55e",light:"#f0fdf4"},E:{zh:"机电工程",th:"MEP Works",color:"#a855f7",light:"#faf5ff"},F:{zh:"内装修",th:"Interior Finishing",color:"#f97316",light:"#fff7ed"},G:{zh:"外立面",th:"External Facade",color:"#06b6d4",light:"#ecfeff"},H:{zh:"室外工程",th:"External Works",color:"#10b981",light:"#ecfdf5"},I:{zh:"竣工验收",th:"Completion & Handover",color:"#6b7280",light:"#f9fafb"}};

router.get('/projects/:projectId/gantt',authenticate,requireProjectAccess(),wrap(async(req,res)=>{
  const pid=req.params.projectId;
  const p=(await pool.query(`SELECT to_char(start_date,'YYYY-MM-DD') AS s,to_char(planned_end_date,'YYYY-MM-DD') AS e FROM projects WHERE id=$1`,[pid])).rows[0]||{};
  const rows=(await pool.query(`SELECT pn.master_code AS code,pn.floor_no AS floor,pe.status,pe.completion_percentage AS pct,to_char(pe.actual_start_date,'YYYY-MM-DD') AS astart,to_char(pe.actual_end_date,'YYYY-MM-DD') AS aend FROM process_nodes pn JOIN process_execution pe ON pe.process_node_id=pn.id WHERE pn.project_id=$1 AND pn.master_code IS NOT NULL ORDER BY pn.sequence_number`,[pid])).rows;
  const est=await S.buildEstimate(pool,pid).catch(()=>null);
  const em={};if(est&&est.tasks)est.tasks.forEach(t=>{em[t.key]=t;});
  const secs={};
  rows.forEach(r=>{
    const sec=r.code.charAt(0);if(!GANTT_SECTIONS[sec])return;
    const key=r.floor!=null?`${r.code}@${r.floor}`:r.code;
    const e=em[key]||{};
    if(!secs[sec])secs[sec]={...GANTT_SECTIONS[sec],sec,tasks:[],doneCount:0,totalCount:0,inProgressCount:0};
    const s=secs[sec];s.totalCount++;
    if(r.status==='completed')s.doneCount++;
    if(r.status==='in_progress')s.inProgressCount++;
    s.tasks.push({key,code:r.code,floor:r.floor,name:(LIB[r.code]||{}).zh||r.code,status:r.status,pct:Number(r.pct)||0,startDate:r.astart||e.startDate||null,endDate:r.aend||e.finishDate||null,execId:e.execId||null});
  });
  const BOQ_WEIGHTS={A:2,B:8,C:20,D:5,E:9,F:40,G:9,H:5,I:2};
  const list=Object.values(secs).map(s=>{
    const dd=s.tasks.flatMap(t=>[t.startDate,t.endDate]).filter(Boolean).sort();
    const pct=s.tasks.length?Math.round(s.tasks.reduce((sum,t)=>sum+(t.status==='completed'?100:t.pct),0)/s.tasks.length):0;
    return{...s,startDate:dd[0]||null,endDate:dd[dd.length-1]||null,pct,weight:BOQ_WEIGHTS[s.sec]||0};
  });
  const overallPct=Math.round(list.reduce((sum,s)=>sum+s.pct*(BOQ_WEIGHTS[s.sec]||0),0)/100);
  res.json({success:true,data:{projectStart:p.s,plannedEnd:p.e,estimatedEnd:est?est.finishDate:null,overallPct,sections:list}});
}));


// ===== Daily Task Assignments =====
const multerDTA = require('multer');
const dta_upload = multerDTA({ storage: multerDTA.diskStorage({
  destination: (req,file,cb)=>cb(null,'uploads/'),
  filename: (req,file,cb)=>cb(null,Date.now()+'_'+Math.random().toString(36).slice(7)+require('path').extname(file.originalname))
}), limits:{fileSize:10*1024*1024}, fileFilter:(req,file,cb)=>cb(null,/image/i.test(file.mimetype)) });

router.get('/projects/:projectId/daily-assignments', authenticate, requireProjectAccess(), wrap(async(req,res)=>{
  const date = req.query.date || todayInBangkok();
  const rows = (await pool.query(
    `SELECT dta.*, to_char(dta.work_date,'YYYY-MM-DD') AS work_date_str,
            pe.status AS proc_status, pe.completion_percentage,
            pn.process_code, pn.process_name, pn.master_code, pn.floor_no
       FROM daily_task_assignments dta
       LEFT JOIN process_execution pe ON pe.id = dta.process_execution_id
       LEFT JOIN process_nodes pn ON pn.id = pe.process_node_id
      WHERE dta.project_id=$1 AND dta.work_date=$2
      ORDER BY dta.sort_order, dta.id`, [req.params.projectId, date])).rows;
  res.json({success:true,data:rows});
}));

router.post('/projects/:projectId/daily-assignments', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async(req,res)=>{
  const {work_date, process_execution_id, custom_title, custom_description, sort_order} = req.body;
  if(!work_date) throw new S.HttpError(400,'date required');
  if(!process_execution_id && !custom_title) throw new S.HttpError(400,'process or title required');
  const r=await pool.query(
    `INSERT INTO daily_task_assignments (project_id,work_date,process_execution_id,custom_title,custom_description,sort_order,assigned_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.params.projectId,work_date,process_execution_id||null,custom_title||null,custom_description||null,sort_order||0,req.user.id]);
  res.json({success:true,data:{id:r.rows[0].id}});
}));

router.post('/daily-assignments/:id/photos', authenticate, requirePermission('manage_projects'), dta_upload.array('photos',10), wrap(async(req,res)=>{
  const cur=(await pool.query('SELECT reference_photos, project_id FROM daily_task_assignments WHERE id=$1',[req.params.id])).rows[0];
  if(!cur) throw new S.HttpError(404,'not found');
  if(!(await checkProjectAccess(pool,req.user.id,req.user.role,cur.project_id))) throw new S.HttpError(403,'forbidden');
  const ex=Array.isArray(cur.reference_photos)?cur.reference_photos:[];
  const added=(req.files||[]).map(f=>({url:'/uploads/'+f.filename,caption:''}));
  const all=[...ex,...added];
  await pool.query('UPDATE daily_task_assignments SET reference_photos=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',[JSON.stringify(all),req.params.id]);
  res.json({success:true,data:{photos:all}});
}));

router.put('/daily-assignments/:id', authenticate, wrap(async(req,res)=>{
  const cur=(await pool.query('SELECT project_id FROM daily_task_assignments WHERE id=$1',[req.params.id])).rows[0];
  if(!cur) throw new S.HttpError(404,'not found');
  if(!(await checkProjectAccess(pool,req.user.id,req.user.role,cur.project_id))) throw new S.HttpError(403,'forbidden');
  const {status,completion_note}=req.body;
  if(!['assigned','in_progress','completed'].includes(status)) throw new S.HttpError(400,'invalid status');
  const ts=status==='completed'?'CURRENT_TIMESTAMP':'NULL';
  await pool.query('UPDATE daily_task_assignments SET status=$1::text, completion_note=$2, completed_at='+ts+', updated_at=CURRENT_TIMESTAMP WHERE id=$3::int',[status,completion_note||null,Number(req.params.id)]);;
  res.json({success:true});
}));

router.delete('/daily-assignments/:id', authenticate, requirePermission('manage_projects'), wrap(async(req,res)=>{
  await pool.query('DELETE FROM daily_task_assignments WHERE id=$1',[req.params.id]);
  res.json({success:true});
}));



// ============ 项目图纸 ============
const drawUpload = require('multer')({ storage: require('multer').diskStorage({
  destination:(req,file,cb)=>cb(null,'uploads/'),
  filename:(req,file,cb)=>cb(null,'draw_'+Date.now()+'_'+Math.random().toString(36).slice(7)+require('path').extname(file.originalname))
}), limits:{fileSize:50*1024*1024} });

router.get('/projects/:projectId/drawings', authenticate, requireProjectAccess(), wrap(async(req,res)=>{
  const rows=(await pool.query('SELECT * FROM project_drawings WHERE project_id=$1 ORDER BY created_at DESC',[req.params.projectId])).rows;
  res.json({success:true,data:rows});
}));

router.post('/projects/:projectId/drawings', authenticate, requireProjectAccess(), requirePermission('manage_projects'), drawUpload.array('files',20), wrap(async(req,res)=>{
  const pid=req.params.projectId;
  const desc=req.body.description||'';
  const saved=[];
  for(const file of (req.files||[])){
    const r=await pool.query('INSERT INTO project_drawings(project_id,file_name,file_url,file_type,file_size,description,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [pid,file.originalname,'/uploads/'+file.filename,file.mimetype.includes('pdf')?'pdf':'image',file.size,desc,req.user.id]);
    saved.push({id:r.rows[0].id,file_name:file.originalname,file_url:'/uploads/'+file.filename});
  }
  res.json({success:true,data:saved});
}));

router.delete('/drawings/:id', authenticate, requirePermission('manage_projects'), wrap(async(req,res)=>{
  await pool.query('DELETE FROM project_drawings WHERE id=$1',[req.params.id]);
  res.json({success:true});
}));

// BOQ 自动识别项目参数 — 支持 Excel (.xlsx) 和 PDF
const boqExtractUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// 从 BOQ 条目列表中识别项目参数（Excel 和 PDF 共用）
function extractProfileFromItems(items) {
  const profile = {};
  const hints = [];

  // 楼层检测：英式英语 Ground Floor=1层, First Floor=2层, Second Floor=3层
  // 同时扫描 section 名和 desc 字段
  const allText = items.map(x => (x.section || '') + ' ' + (x.desc || '')).join('\n');
  const floors = new Set();
  if (/ground\s*floor/i.test(allText)) floors.add(1);
  if (/first\s*floor/i.test(allText))  floors.add(2);
  if (/second\s*floor/i.test(allText)) floors.add(3);
  if (/third\s*floor/i.test(allText))  floors.add(4);
  // 美式英语备用（first floor = ground floor = 1）
  if (floors.size === 0) {
    const floorSecs = items.map(x => x.section).filter(Boolean);
    floorSecs.forEach(s => {
      if (/first.*floor|ground.*floor|beam.*ground/i.test(s)) floors.add(1);
      if (/second.*floor/i.test(s)) floors.add(2);
      if (/third.*floor/i.test(s)) floors.add(3);
      if (/fourth.*floor/i.test(s)) floors.add(4);
    });
  }
  const floorCount = [...floors].length || null;
  if (floorCount) { profile.floors = floorCount; hints.push('楼层数: ' + floorCount + ' 层（Ground/First/Second Floor 章节推断）'); }

  // 卫生间：Toilet 数量
  const toiletItem = items.find(x => /\btoilet\b/i.test(x.desc) && x.qty > 0);
  if (toiletItem) {
    if (floorCount && floorCount > 0) profile.bathrooms = Math.round(toiletItem.qty / floorCount);
    hints.push('卫生间: 共 ' + toiletItem.qty + ' 个（Toilet）');
  }

  // 厨房：Grease trap
  const grease = items.find(x => /grease\s*trap/i.test(x.desc) && x.qty > 0);
  if (grease) { profile.kitchens = grease.qty; hints.push('厨房: ' + grease.qty + ' 个（Grease trap）'); }

  // 泳池
  const hasPool = items.some(x => /swimming\s*pool|pool\s*pump/i.test(x.desc) || /swimming/i.test(x.section));
  if (hasPool) { profile.pool = true; hints.push('泳池: 检测到'); }

  // 屋顶类型
  const hasPitched = items.some(x => /metal\s*sheet|matal\s*sheet|c\s*channel/i.test(x.desc) && /roof/i.test(x.section));
  const hasFlat    = items.some(x => /waterproof|polished\s*cement/i.test(x.desc) && /roof/i.test(x.section));
  if (hasPitched && hasFlat) profile.roof = 'both';
  else if (hasPitched) profile.roof = 'pitched';
  else if (hasFlat)    profile.roof = 'flat';
  if (profile.roof) hints.push('屋顶类型: ' + { pitched: '坡屋面', flat: '平屋面', both: '坡+平' }[profile.roof]);

  // 套数：Septic tank
  const septic = items.find(x => /septic\s*tank/i.test(x.desc) && x.qty > 1);
  if (septic) { profile.units = septic.qty; hints.push('套数: ' + septic.qty + ' 套（Septic tank推断）'); }

  return { profile, hints };
}

// 直接对 PDF 原始文本做 regex 识别（比解析表格行更可靠）
function extractFromPdfRawText(text) {
  const profile = {};
  const hints = [];

  // ── 楼层 ──
  // 英式/泰式: Ground Floor = ชั้น 1, First Floor = ชั้น 2, Second Floor = ชั้น 3
  // 但本 BOQ 混用: "Ground Floor" 和 "first floor" 都代表第 1 层，"Second floor" = 第 2 层
  // 规则: ground/first floor → level 1; second floor → level 2; third → level 3
  const levels = new Set();
  if (/ground\s+floor/i.test(text))              levels.add(1);
  if (/\bfirst\s+floor\b/i.test(text))           levels.add(1); // 和 ground floor 同层
  if (/\bsecond\s+floor\b/i.test(text))          levels.add(2);
  if (/\bthird\s+floor\b/i.test(text))           levels.add(3);
  if (/\bfourth\s+floor\b/i.test(text))          levels.add(4);
  const floorCount = levels.size || null;
  if (floorCount) { profile.floors = floorCount; hints.push('楼层数: ' + floorCount + ' 层（Floor章节推断）'); }

  // ── 卫生间 (Toilet) ──
  // 处理 "9.1 Toilet\n4 Piece" 和 "9.1 Toilet 4 Piece" 两种格式
  const toiletM = text.match(/\bToilet\b[^0-9\n]{0,30}\n?[^0-9\n]{0,10}(\d+)\s*(?:Piece|nos?\.?|pcs?\.?)/i);
  if (toiletM) {
    const qty = parseInt(toiletM[1]);
    if (qty > 0) {
      if (floorCount) profile.bathrooms = Math.round(qty / floorCount);
      hints.push('卫生间: 共 ' + qty + ' 个（Toilet），每层约 ' + (profile.bathrooms || qty) + ' 个');
    }
  }

  // ── 厨房 (Grease trap) ──
  const greaseM = text.match(/\bGrease\s+trap\b[^0-9\n]{0,20}\n?[^0-9\n]{0,10}(\d+)/i);
  if (greaseM) {
    const qty = parseInt(greaseM[1]);
    if (qty > 0) { profile.kitchens = qty; hints.push('厨房: ' + qty + ' 个（Grease trap）'); }
  }

  // ── 泳池 —— 注意 PDF 里拼作 "Swimmining" ──
  if (/swimm?i?ni?ng\s*pool/i.test(text) || /13\s+Swimm/i.test(text)) {
    profile.pool = true;
    hints.push('泳池: 检测到（Swimming pool章节）');
  }

  // ── 屋顶类型 ──
  const hasMetal = /matal?\s*sheets?/i.test(text) || (/c\s*channel/i.test(text) && /roof/i.test(text));
  const hasFlat  = /waterproof/i.test(text) && /roof/i.test(text);
  if (hasMetal && hasFlat) profile.roof = 'both';
  else if (hasMetal)       profile.roof = 'pitched';
  else if (hasFlat)        profile.roof = 'flat';
  if (profile.roof) hints.push('屋顶类型: ' + { pitched: '坡屋面', flat: '平屋面', both: '坡+平' }[profile.roof]);

  // ── 套数：优先用 "TOTAL N VILLA" ──
  const villaM = text.match(/TOTAL\s+(\d+)\s+VILLA/i);
  if (villaM) {
    const n = parseInt(villaM[1]);
    if (n > 1) { profile.units = n; hints.push('套数: ' + n + ' 套（TOTAL N VILLA）'); }
    // n=1 是单独一套 villa，不需要设 units
  } else {
    // 退化：Septic tank 数量 > 1 才推断多套
    const septicM = text.match(/Septic\s+tank\b[^0-9\n]{0,20}\n?[^0-9\n]{0,10}(\d+)/i);
    if (septicM && parseInt(septicM[1]) > 1) {
      profile.units = parseInt(septicM[1]);
      hints.push('套数: ' + profile.units + ' 套（Septic tank推断）');
    }
  }

  return { profile, hints };
}

router.post('/projects/:projectId/boq/extract-profile', authenticate, requireProjectAccess(), requirePermission('manage_projects'), boqExtractUpload.single('boq'), wrap(async(req, res) => {
  if (!req.file) throw new S.HttpError(400, '请上传 BOQ 文件（Excel .xlsx 或 PDF）');
  const fname = (req.file.originalname || '').toLowerCase();
  let items = [];
  let fileDesc = '';

  if (fname.endsWith('.xlsx')) {
    // Excel 路径：使用现有 BOQ 解析器
    const boq = BOQ.readBoq(req.file.buffer);
    items = boq.items;
    fileDesc = 'Excel，' + items.length + ' 行';
  } else if (fname.endsWith('.pdf')) {
    // PDF 路径：直接对原始文本做 regex，不解析表格行
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      const { profile: pdfProfile, hints: pdfHints } = extractFromPdfRawText(data.text);
      pdfHints.unshift('📄 PDF，' + data.numpages + ' 页');
      res.json({ success: true, data: { profile: pdfProfile, hints: pdfHints, itemCount: data.numpages } });
      return;
    } catch (e) {
      throw new S.HttpError(400, 'PDF 解析失败：' + e.message);
    }
  } else {
    throw new S.HttpError(400, '只支持 Excel（.xlsx）或 PDF 文件');
  }

  const { profile, hints } = extractProfileFromItems(items);
  if (fileDesc) hints.unshift('📄 ' + fileDesc);
  res.json({ success: true, data: { profile, hints, itemCount: items.length, fileDesc } });
}));


// 封面照片上传
const coverUpload = require('multer')({ storage: require('multer').diskStorage({
  destination: (req,file,cb) => cb(null,'uploads/'),
  filename: (req,file,cb) => cb(null,'cover_p'+req.params.projectId+'_'+Date.now()+require('path').extname(file.originalname))
}), limits:{fileSize:15*1024*1024}, fileFilter:(req,file,cb)=>cb(null,/image/i.test(file.mimetype)) });

router.post('/projects/:projectId/cover', authenticate, requireProjectAccess(), requirePermission('manage_projects'), coverUpload.single('cover'), wrap(async(req,res)=>{
  if(!req.file) throw new S.HttpError(400,'请上传图片');
  const url='/uploads/'+req.file.filename;
  await pool.query('UPDATE projects SET cover_photo=$1 WHERE id=$2',[url,req.params.projectId]);
  res.json({success:true,data:{cover_photo:url}});
}));

// ============================================================
// 采购价格参考数据库 Purchase Price Reference Database
// ============================================================

// CSV行解析（处理逗号在引号内的情况）
function parseCSVLine(line) {
  const res = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  res.push(cur.trim());
  return res;
}

// 更新价格基准（每次导入后调用）
async function refreshPriceBenchmark(itemNameCn, unit) {
  const r = await pool.query(
    `SELECT AVG(unit_price) avg, MIN(unit_price) mn, MAX(unit_price) mx, COUNT(*) cnt,
            (SELECT unit_price FROM purchase_records WHERE item_name_cn=$1 AND unit=$2 ORDER BY purchase_date DESC, id DESC LIMIT 1) last_price,
            (SELECT purchase_date FROM purchase_records WHERE item_name_cn=$1 AND unit=$2 ORDER BY purchase_date DESC, id DESC LIMIT 1) last_date
     FROM purchase_records WHERE item_name_cn=$1 AND unit=$2 AND unit_price > 0`,
    [itemNameCn, unit]);
  const d = r.rows[0];
  await pool.query(
    `INSERT INTO price_benchmarks (item_name_cn, unit, avg_price, min_price, max_price, sample_count, last_price, last_purchase_date, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)
     ON CONFLICT (item_name_cn, unit) DO UPDATE SET
       avg_price=EXCLUDED.avg_price, min_price=EXCLUDED.min_price, max_price=EXCLUDED.max_price,
       sample_count=EXCLUDED.sample_count, last_price=EXCLUDED.last_price,
       last_purchase_date=EXCLUDED.last_purchase_date, updated_at=CURRENT_TIMESTAMP`,
    [itemNameCn, unit, d.avg, d.mn, d.mx, d.cnt, d.last_price, d.last_date]);
}

// POST /purchase-records/import-csv
const csvUploadMW = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10*1024*1024 } });
router.post('/purchase-records/import-csv', authenticate, requirePermission('purchase_material'), csvUploadMW.single('csv'), wrap(async (req, res) => {
  if (!req.file) throw new S.HttpError(400, '请上传CSV文件');
  const text = req.file.buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new S.HttpError(400, 'CSV为空或格式错误');

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g,'').trim());
  const col = h => headers.indexOf(h);

  let imported = 0, suppNew = 0, itemNew = 0;
  const suppCache = {}, itemCache = {};

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g,'').trim());
    if (vals.every(v => !v)) continue;

    const get = idx => (idx >= 0 ? vals[idx] : '') || '';
    const purchaseDate = get(col('Date')) || null;
    const invoiceNo    = get(col('Invoice_No'));
    const supplierName = get(col('Supplier'));
    // Support both column name variants
    const nameTH  = get(col('Item_Name_TH')) || get(col('Item_TH'));
    const nameCN  = get(col('Item_Name_CN')) || get(col('Item_CN'));
    const qty     = parseFloat(get(col('Qty'))) || 0;
    const unit    = get(col('Unit'));
    const unitPrice  = parseFloat(get(col('Unit_Price'))) || 0;
    const totalPrice = parseFloat(get(col('Total_Price'))) || 0;
    // Auto-detect category if not present
    let category = get(col('Item_Category'));
    if (!category) {
      const nm = (nameCN + nameTH).toLowerCase();
      if (/แบคโฮ|เครน|挖掘机|吊车|รถ.*เช่า|机械/.test(nm)) category = 'Machinery';
      else if (/กำจัดปลวก|白蚁|pest|บริการ|service/.test(nm)) category = 'Service';
      else if (/ขนส่ง|运输|transport/.test(nm)) category = 'Transport';
      else if (/ใบตัด|切割片|น้ำยา|脱模剂|consumable/.test(nm)) category = 'Consumable';
      else if (/เหล็ก|钢|rebar/.test(nm)) category = 'Rebar';
      else if (/คอนกรีต|混凝土|concrete/.test(nm)) category = 'Concrete';
      else if (/ปูน|water cement|ซีเมนต์|水泥|cement/.test(nm)) category = 'Cement';
      else if (/หิน|石|aggregate|gravel/.test(nm)) category = 'Aggregate';
      else if (/ทราย|沙|sand/.test(nm)) category = 'Aggregate';
      else if (/pvc|ท่อ|管/.test(nm)) category = 'PVC';
      else if (/แผ่นพื้น|precast|楼板/.test(nm)) category = 'Precast';
      else if (/อิฐ|brick|砖/.test(nm)) category = 'Block';
      else category = 'Misc';
    }

    if (!supplierName || !nameCN) continue;

    // Upsert supplier
    if (!suppCache[supplierName]) {
      const sr = await pool.query(
        `INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [supplierName]);
      suppCache[supplierName] = sr.rows[0].id;
      if (sr.rowCount === 1 && sr.rows[0].id) suppNew++;
    }

    // Upsert material item
    const itemKey = nameCN + '|' + unit;
    if (!itemCache[itemKey]) {
      const ir = await pool.query(
        `INSERT INTO material_items (name_cn, name_th, category, unit) VALUES ($1,$2,$3,$4)
         ON CONFLICT (name_cn, unit) DO UPDATE SET name_th=COALESCE(EXCLUDED.name_th,material_items.name_th), category=COALESCE(EXCLUDED.category,material_items.category)
         RETURNING id`,
        [nameCN, nameTH||null, category||null, unit]);
      itemCache[itemKey] = ir.rows[0].id;
      if (ir.rowCount === 1) itemNew++;
    }

    // Parse date — handles ranges like "19-28/06/2026", "01-09/07/2026", "13/06/2026"
    let dateStr = null;
    if (purchaseDate) {
      // Extract first date from ranges like "19-28/06/2026" → "19/06/2026"
      const cleaned = purchaseDate.trim().split(/\s/)[0]; // ignore trailing spaces/text
      // Match: dd/mm/yyyy, dd-mm-yyyy, or range start "dd-dd/mm/yyyy" → take first part
      const rangeM = cleaned.match(/^(\d{1,2})[-\/]\d{0,2}[\/\-](\d{1,2})[\/\-](\d{4})/);
      const simpleM = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (rangeM) {
        dateStr = `${rangeM[3]}-${rangeM[2].padStart(2,'0')}-${rangeM[1].padStart(2,'0')}`;
      } else if (simpleM) {
        dateStr = `${simpleM[3]}-${simpleM[2].padStart(2,'0')}-${simpleM[1].padStart(2,'0')}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
        dateStr = cleaned.slice(0,10);
      }
    }

    // No dedup filter — all real purchase data gets imported as-is; AI analysis flags anomalies later
    await pool.query(
        `INSERT INTO purchase_records (purchase_date, invoice_no, supplier_id, supplier_name, item_id, item_name_cn, item_name_th, item_category, qty, unit, unit_price, total_price, project_id, imported_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [dateStr, invoiceNo||null, suppCache[supplierName], supplierName, itemCache[itemKey], nameCN, nameTH||null, category||null, qty, unit, unitPrice, totalPrice, req.body.project_id||null, req.user.id]);
    imported++;
    await refreshPriceBenchmark(nameCN, unit);
  }
  res.json({ success: true, data: { imported, suppliers_created: suppNew, items_created: itemNew } });
}));

// GET /suppliers
router.get('/suppliers', authenticate, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT s.*, COUNT(pr.id) purchase_count, COALESCE(SUM(pr.total_price),0) total_spend
     FROM suppliers s LEFT JOIN purchase_records pr ON pr.supplier_id=s.id
     GROUP BY s.id ORDER BY total_spend DESC`);
  res.json({ success: true, data: r.rows });
}));

// GET /material-items
router.get('/material-items', authenticate, wrap(async (req, res) => {
  let where = 'WHERE 1=1'; const params = [];
  if (req.query.category) { where += ` AND mi.category=$${params.length+1}`; params.push(req.query.category); }
  if (req.query.q) { where += ` AND (mi.name_cn ILIKE $${params.length+1} OR mi.name_th ILIKE $${params.length+1})`; params.push('%'+req.query.q+'%'); }
  const r = await pool.query(
    `SELECT mi.*, pb.avg_price, pb.min_price, pb.max_price, pb.sample_count, pb.last_price, pb.last_purchase_date
     FROM material_items mi LEFT JOIN price_benchmarks pb ON pb.item_name_cn=mi.name_cn AND pb.unit=mi.unit
     ${where} ORDER BY pb.sample_count DESC NULLS LAST, mi.name_cn`, params);
  res.json({ success: true, data: r.rows });
}));

// GET /material-items/:id/price-history
router.get('/material-items/:id/price-history', authenticate, wrap(async (req, res) => {
  const mi = (await pool.query('SELECT * FROM material_items WHERE id=$1', [req.params.id])).rows[0];
  if (!mi) throw new S.HttpError(404, '找不到材料');
  const r = await pool.query(
    `SELECT pr.*, s.name supplier_nm FROM purchase_records pr
     LEFT JOIN suppliers s ON s.id=pr.supplier_id
     WHERE pr.item_name_cn=$1 AND pr.unit=$2 ORDER BY pr.purchase_date DESC, pr.id DESC`,
    [mi.name_cn, mi.unit]);
  res.json({ success: true, data: { item: mi, records: r.rows } });
}));

// GET /price-benchmarks
router.get('/price-benchmarks', authenticate, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT pb.*, mi.name_th, mi.category FROM price_benchmarks pb
     LEFT JOIN material_items mi ON mi.name_cn=pb.item_name_cn AND mi.unit=pb.unit
     ORDER BY pb.sample_count DESC, pb.item_name_cn`);
  res.json({ success: true, data: r.rows });
}));

// GET /purchase-records
router.get('/purchase-records', authenticate, wrap(async (req, res) => {
  const params = [];
  let where = 'WHERE 1=1';
  if (req.query.supplier) { where += ` AND pr.supplier_name ILIKE $${params.length+1}`; params.push('%'+req.query.supplier+'%'); }
  if (req.query.category) { where += ` AND pr.item_category=$${params.length+1}`; params.push(req.query.category); }
  if (req.query.invoice)  { where += ` AND pr.invoice_no=$${params.length+1}`; params.push(req.query.invoice); }
  if (req.query.project_id) { where += ` AND pr.project_id=$${params.length+1}`; params.push(req.query.project_id); }
  const limit = Math.min(200, parseInt(req.query.limit)||100);
  const offset = parseInt(req.query.offset)||0;
  const r = await pool.query(
    `SELECT pr.* FROM purchase_records pr ${where} ORDER BY pr.purchase_date DESC NULLS LAST, pr.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
    [...params, limit, offset]);
  const cnt = (await pool.query(`SELECT COUNT(*) n FROM purchase_records pr ${where}`, params)).rows[0].n;
  res.json({ success: true, data: r.rows, total: parseInt(cnt) });
}));

// POST /purchase-records (single manual record)
router.post('/purchase-records', authenticate, requirePermission('purchase_material'), wrap(async (req, res) => {
  const { invoice_no, supplier_name, item_name_cn, item_name_th, item_category, qty, unit, unit_price, purchase_date, project_id } = req.body;
  if (!supplier_name || !item_name_cn || !unit) throw new S.HttpError(400, '供货商、品名、单位为必填');

  const sr = await pool.query(`INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [supplier_name]);
  const ir = await pool.query(`INSERT INTO material_items (name_cn, name_th, category, unit) VALUES ($1,$2,$3,$4) ON CONFLICT (name_cn, unit) DO UPDATE SET name_th=COALESCE(EXCLUDED.name_th,material_items.name_th) RETURNING id`, [item_name_cn, item_name_th||null, item_category||null, unit]);

  const r = await pool.query(
    `INSERT INTO purchase_records (purchase_date, invoice_no, supplier_id, supplier_name, item_id, item_name_cn, item_name_th, item_category, qty, unit, unit_price, total_price, project_id, imported_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [purchase_date||null, invoice_no||null, sr.rows[0].id, supplier_name, ir.rows[0].id, item_name_cn, item_name_th||null, item_category||null, qty||0, unit, unit_price||0, (qty||0)*(unit_price||0), project_id||null, req.user.id]);

  await refreshPriceBenchmark(item_name_cn, unit);
  res.json({ success: true, data: r.rows[0] });
}));

// PUT /purchase-records/:id — edit a single record
router.put('/purchase-records/:id', authenticate, requirePermission('purchase_material'), wrap(async (req, res) => {
  const { id } = req.params;
  const { invoice_no, supplier_name, item_name_cn, item_name_th, qty, unit, unit_price, total_price, purchase_date } = req.body;
  const totalCalc = total_price != null ? total_price : (qty||0) * (unit_price||0);
  await pool.query(
    `UPDATE purchase_records SET
       invoice_no=$1, supplier_name=$2, item_name_cn=$3, item_name_th=$4,
       qty=$5, unit=$6, unit_price=$7, total_price=$8, purchase_date=$9
     WHERE id=$10`,
    [invoice_no||null, supplier_name, item_name_cn, item_name_th||null,
     qty||0, unit, unit_price||0, totalCalc, purchase_date||null, id]);
  if (item_name_cn && unit) await refreshPriceBenchmark(item_name_cn, unit);
  res.json({ success: true });
}));

// DELETE /purchase-records/:id — delete a single record
router.delete('/purchase-records/:id', authenticate, requirePermission('purchase_material'), wrap(async (req, res) => {
  await pool.query('DELETE FROM purchase_records WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// ============================================================
// AI 采购分析 + 收据识别 (Google Gemini)
// ============================================================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multerAI = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 20*1024*1024 } });

function getGemini(modelOverride) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = modelOverride || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  return genAI.getGenerativeModel({ model });
}

// 自动轮换模型，处理 503/429 过载
async function callGemini(prompt, imagePart) {
  const tried = new Set();
  // 从可用列表里尽量多放几个，冷门模型往往不堵
  const queue = [
    process.env.GEMINI_MODEL || 'gemini-flash-latest',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-pro-latest',
    'gemini-3.1-flash-lite',
    'gemini-omni-1.1-flash',
    'gemini-3-flash-preview',
  ];
  let lastErr;
  for (const m of queue) {
    if (tried.has(m)) continue;
    tried.add(m);
    try {
      const mdl = getGemini(m);
      const parts = imagePart ? [prompt, imagePart] : [prompt];
      const result = await mdl.generateContent(parts);
      return result.response.text();
    } catch(e) {
      lastErr = e;
      if (e.status === 503 || e.status === 429 ||
          (e.message||'').includes('no longer available') ||
          (e.message||'').includes('high demand') ||
          (e.message||'').includes('new users')) continue;
      throw e;
    }
  }
  throw lastErr || new Error('模型全部繁忙，请稍后再试 / ระบบ AI ยุ่ง กรุณาลองใหม่ทีหลัง');
}

// ── Free AI via OpenRouter — for process analysis (Gemma 4, free) ──
async function callFreeAI(prompt) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');
  // Priority: Gemma 4 (best Thai support, free) → DeepSeek fallback
  const models = [
    process.env.PROCESS_AI_MODEL || 'google/gemma-4-26b-a4b:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-2-27b-it:free',
    'deepseek/deepseek-chat:free',
    'qwen/qwen-2.5-72b-instruct:free',
  ];
  let lastErr;
  for (const model of models) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://winaii.com',
          'X-Title': 'Mira Villa Construction'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1200,
          temperature: 0.1
        })
      });
      if (!resp.ok) { const t = await resp.text(); lastErr = new Error(`${model}: HTTP ${resp.status} ${t.slice(0,100)}`); continue; }
      const j = await resp.json();
      const text = (j.choices?.[0]?.message?.content || '').trim();
      if (text) return text;
      lastErr = new Error(`${model}: empty response`);
    } catch(e) { lastErr = e; }
  }
  throw lastErr || new Error('All free AI models failed');
}

// ── 确保 ai_rules 列存在 ──
async function ensureAiRulesCol() {
  await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_rules TEXT');
}

// GET /projects/:id/ai-rules
router.get('/projects/:projectId/ai-rules', authenticate, requireProjectAccess(), wrap(async (req,res)=>{
  await ensureAiRulesCol();
  const r = await pool.query('SELECT ai_rules FROM projects WHERE id=$1',[req.params.projectId]);
  res.json({ success:true, data:{ rules: r.rows[0]?.ai_rules||'' } });
}));

// PUT /projects/:id/ai-rules
router.put('/projects/:projectId/ai-rules', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req,res)=>{
  await ensureAiRulesCol();
  await pool.query('UPDATE projects SET ai_rules=$1 WHERE id=$2',[req.body.rules||'',req.params.projectId]);
  res.json({ success:true });
}));

// ── POST /projects/:id/ai-extract-contract — 上传合同，AI提取责任条款 ──
const contractUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 20*1024*1024 } });

router.post('/projects/:projectId/ai-extract-contract', authenticate, requireProjectAccess(), requirePermission('manage_projects'), contractUpload.single('contract'), wrap(async (req, res) => {
  if (!req.file) throw new S.HttpError(400, '请上传合同文件');

  let contractText = '';
  const fname = (req.file.originalname||'').toLowerCase();

  if (fname.endsWith('.pdf')) {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      contractText = data.text;
    } catch(e) {
      throw new S.HttpError(400, 'PDF读取失败: ' + e.message);
    }
  } else if (fname.endsWith('.docx') || fname.endsWith('.doc')) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      contractText = result.value;
    } catch(e) {
      throw new S.HttpError(400, 'DOCX读取失败: ' + e.message);
    }
  } else {
    // TXT or other text format
    contractText = req.file.buffer.toString('utf8');
  }

  if (!contractText || contractText.trim().length < 100) {
    throw new S.HttpError(400, 'ไม่สามารถอ่านเนื้อหาสัญญาได้ / 无法读取合同内容，请检查文件格式');
  }

  const model = getGemini();

  const prompt = `คุณเป็นผู้เชี่ยวชาญสัญญาก่อสร้าง
คุณต้องอ่านสัญญาก่อสร้างนี้และดึงข้อกำหนดเรื่องความรับผิดชอบออกมา

โดยเฉพาะ:
1. วัสดุหลัก (主材) = สิ่งที่เจ้าของโครงการ (甲方) ต้องจัดหาและจ่าย
2. วัสดุรอง/สิ้นเปลือง (辅材) = สิ่งที่ผู้รับเหมา (乙方) ต้องจ่ายเอง ห้ามเบิกจากเจ้าของ
3. ค่าบริการ เช่น เครื่องจักร ค่าขนส่ง ที่ฝ่ายใดรับผิดชอบ

ตัวอย่างวัสดุรอง (辅材) ทั่วไปในการก่อสร้าง:
- ใบตัดเหล็ก, ลวดเชื่อม, น้ำยาถอดแบบ, ดอกสว่าน (consumable tools)
- เชือก, ตาข่าย, ผ้าใบ (temporary protection materials)  
- ตะปู, สกรู, น้ำยากาว (fixings & adhesives สำหรับงานก่อสร้าง)

เนื้อหาสัญญา:
---
${contractText.substring(0, 8000)}
---

กรุณาวิเคราะห์และตอบเป็น JSON:
{
  "project_name": "ชื่อโครงการในสัญญา",
  "owner_responsibilities": ["รายการที่เจ้าของต้องจ่าย..."],
  "contractor_responsibilities": ["รายการที่ผู้รับเหมาต้องจ่ายเอง..."],
  "auxiliary_materials": ["วัสดุรองที่ผู้รับเหมารับผิดชอบ..."],
  "rules_summary_th": "สรุปกฎสำหรับใช้ในระบบ (ภาษาไทย)",
  "rules_summary_cn": "用于系统分析的规则摘要（中文）",
  "system_rules": "กฎที่จะใช้กำกับ AI ในการตรวจสอบใบเสร็จ ระบุชัดเจนว่าอะไรที่ผู้รับเหมาควรจ่ายเอง"
}
ตอบ JSON เท่านั้น`;

  const text = await callGemini(prompt);
  const cleaned = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

  try {
    const extracted = JSON.parse(cleaned);
    res.json({ success: true, data: extracted, contract_length: contractText.length });
  } catch(e) {
    res.json({ success: true, data: { rules_summary_cn: cleaned, system_rules: cleaned }, raw: true });
  }
}));
router.post('/ai/ocr-receipt', authenticate, multerAI.single('image'), wrap(async (req,res)=>{
  if (!req.file) throw new S.HttpError(400,'请上传图片');

  const model = getGemini();
  const imagePart = {
    inlineData: {
      data: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype
    }
  };

  const prompt = `คุณเป็นผู้ช่วยอ่านใบเสร็จก่อสร้างภาษาไทย/จีน
อ่านใบเสร็จในภาพแล้วดึงข้อมูลออกมาเป็น JSON ดังนี้:
{
  "date": "วันที่ (dd/mm/yyyy)",
  "invoice_no": "เลขที่ใบเสร็จ",
  "supplier": "ชื่อร้านค้า/ผู้ขาย",
  "items": [
    {
      "name_th": "ชื่อสินค้าภาษาไทย",
      "name_cn": "ชื่อสินค้าภาษาจีน (ถ้ามี)",
      "qty": จำนวนตัวเลข,
      "unit": "หน่วย",
      "unit_price": ราคาต่อหน่วยตัวเลข,
      "total_price": ราคารวมตัวเลข
    }
  ],
  "grand_total": ยอดรวมทั้งหมดตัวเลข
}
ตอบเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบายอื่น`;

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

  try {
    const data = JSON.parse(text);
    res.json({ success:true, data });
  } catch(e) {
    res.json({ success:false, message:'AI ไม่สามารถอ่านได้', raw: text });
  }
}));

// ── POST /projects/:id/ai-analyze — AI全量分析 (SSE streaming) ──
router.post('/projects/:projectId/ai-analyze', authenticate, requireProjectAccess(), wrap(async (req,res)=>{
  // SSE headers
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.setHeader('Access-Control-Allow-Origin','*');
  const send = (ev,d) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`);

  try {
    const pid = req.params.projectId;
    await ensureAiRulesCol();

    const [prR, projR, pbR] = await Promise.all([
      pool.query('SELECT * FROM purchase_records WHERE project_id=$1 ORDER BY purchase_date ASC, id ASC',[pid]),
      pool.query('SELECT ai_rules FROM projects WHERE id=$1',[pid]),
      pool.query('SELECT item_name_cn, unit, avg_price, min_price, max_price FROM price_benchmarks ORDER BY sample_count DESC LIMIT 30')
    ]);

    const records = prR.rows;
    if (!records.length) { send('error',{message:'ไม่มีข้อมูลใบเสร็จ 没有收据数据'}); res.end(); return; }

    send('status',{message:`กำลังวิเคราะห์ ${records.length} รายการ / 正在分析 ${records.length} 条...`});

    const boqRows = req.body.boq || [];
    const customRules = projR.rows[0]?.ai_rules || '';
    const prices = pbR.rows;

    const SYSTEM_RULES = `
=== กฎการตรวจสอบ / 核实规则 ===

ก. สิ่งที่ผู้รับเหมา (ฝ่ายก่อสร้าง) ต้องจ่ายเอง ห้ามเบิกจากเจ้าของ / 乙方自负，不应向甲方报销:
- ค่าเช่าเครื่องจักร: แบคโฮ, เครน, รถบรรทุก / 机械租赁：挖机、吊车、卡车  
- วัสดุสิ้นเปลือง: ใบตัดเหล็ก, ลวดเชื่อม, น้ำยาถอดแบบ, ดอกสว่าน / 消耗品：切割片、焊条、脱模剂、钻头
- บริการกำจัดปลวก/แมลง / 灭虫服务
- ต้นทุนการดำเนินงานอื่นของผู้รับเหมา / 其他承包方运营成本

ข. ตรวจจับใบเสร็จซ้ำ (สำคัญมาก): 
- "duplicate" คือ Invoice_No เดียวกัน + ชื่อสินค้าเดียวกัน + ราคาเดียวกัน → บันทึกซ้ำ 2 ครั้ง ต้องตรวจสอบ
- ถ้า Invoice_No เดียวกัน แต่ชื่อสินค้าต่างกัน = ปกติ (ใบเสร็จใบเดียวมีหลายรายการ)
- ถ้า Invoice_No ต่างกัน แต่ซื้อสินค้าชนิดเดียวกัน = ปกติ (ซื้อซ้ำในครั้งต่างกัน)
- อย่าตรวจจับว่าซ้ำเพราะ Invoice_No เหมือนกันอย่างเดียว ต้องดูทั้งชื่อสินค้าและราคาด้วย
重复判断：相同Invoice号 + 相同品名 + 相同金额 = 数据重复录入。相同Invoice号但不同品名 = 正常多行发票。

ค. ราคาผิดปกติ: สูงกว่าราคาเฉลี่ยมากกว่า 10% / 价格超均价10%以上
${customRules ? '\n=== กฎเพิ่มเติม / 附加规则 ===\n' + customRules : ''}`;

    const PRICE_CONTEXT = prices.length ?
      `\n=== ราคาอ้างอิง / 参考价格 ===\n${prices.map(p=>`${p.item_name_cn} (${p.unit}): เฉลี่ย ฿${p.avg_price}, Min ฿${p.min_price}, Max ฿${p.max_price}`).join('\n')}` : '';

    const BOQ_CONTEXT = boqRows.length ?
      `\n=== BOQ งบประมาณ / 预算 (${boqRows.length} รายการ) ===\n${boqRows.slice(0,60).map(b=>`${b.Description} | ${b.Category} | ${b.Quantity} ${b.Unit} | ฿${b.Supply_Unit_Price}/unit | Total ฿${b.Total_Amount}`).join('\n')}` : '';

    const RECORDS_TEXT = records.map(r =>
      `[${r.id}] ${r.purchase_date ? String(r.purchase_date).slice(0,10) : ''} | INV:${r.invoice_no||'-'} | ${r.supplier_name||''} | ${r.item_name_th||''} ${r.item_name_cn||''} | Qty:${r.qty} ${r.unit} | Unit:฿${r.unit_price} | Total:฿${r.total_price}`
    ).join('\n');

    const prompt = `${SYSTEM_RULES}${PRICE_CONTEXT}${BOQ_CONTEXT}

=== ใบเสร็จทั้งหมด / 所有收据 (${records.length} รายการ) ===
${RECORDS_TEXT}

=== คำสั่ง / 指令 ===
วิเคราะห์ทุกรายการตามกฎข้างต้น ตอบเป็น JSON array ดังนี้ (ห้ามมีข้อความอื่น):
[
  {
    "id": <id>,
    "flags": [],   // เช่น ["deduct","duplicate","price_high"]
    "status": "normal"|"deduct"|"duplicate"|"price_high"|"price_low",
    "boq_match": "ชื่อ BOQ ที่ตรงหรือ null",
    "boq_confidence": 0-100,
    "reason_th": "สรุปสั้นๆ ภาษาไทย",
    "reason_cn": "简短说明（中文）"
  }
]
ตอบ JSON array เท่านั้น`;

    send('status',{message:'AI กำลังประมวลผล... / AI正在推理...'});

    const model = getGemini();
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

    send('status',{message:'กำลังประมวลผลผลลัพธ์... / 正在处理结果...'});

    try {
      const analysis = JSON.parse(text);
      // Attach analysis to records for frontend
      const analysisMap = {};
      analysis.forEach(a => { analysisMap[a.id] = a; });
      const enriched = records.map(r => ({ ...r, ai: analysisMap[r.id] || { flags:[], status:'normal', reason_th:'ไม่ได้วิเคราะห์', reason_cn:'未分析' } }));
      send('result',{ records: enriched, total: records.length, analyzed: analysis.length });
    } catch(e) {
      send('error',{ message:'แยก JSON ไม่ได้ / 解析失败: '+text.slice(0,300) });
    }
  } catch(e) {
    send('error',{ message: e.message });
  }
  res.end();
}));


// ============ Daily Site Report — 施工日报 ============
const DSR_MACHINERY = ['Back hole','Tractor','Mobile Crane','Truck 6 wheel','Truck 10 wheel','Pump','Road roller','Vibrator','Halb','Bar bending','Bar cuting'];
const DSR_WORKERS   = ['Engineer','Foreman','Survey','Carpenter','Bender','Welder','Masonry','Electrician','Mechanic','Air conditioned'];

// GET — load today's report (or blank)
router.get('/projects/:projectId/daily-report', authenticate, requireProjectAccess(), wrap(async(req,res)=>{
  const date = req.query.date || new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  const r = await pool.query(
    'SELECT * FROM daily_site_reports WHERE project_id=$1 AND report_date=$2',
    [req.params.projectId, date]);
  res.json({success:true, data:r.rows[0]||null, config:{machinery:DSR_MACHINERY, workers:DSR_WORKERS}});
}));

// PUT — save / upsert report
router.put('/projects/:projectId/daily-report', authenticate, requireProjectAccess(), wrap(async(req,res)=>{
  const {report_date,week_no,report_no,machinery,workers,performance,problems,weather_am,weather_pm,remark,foreman_signed} = req.body;
  const date = report_date || new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  await pool.query(`
    INSERT INTO daily_site_reports
      (project_id,report_date,week_no,report_no,machinery,workers,performance,problems,weather_am,weather_pm,remark,foreman_signed,submitted_by,updated_at)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP)
    ON CONFLICT (project_id,report_date) DO UPDATE SET
      week_no=EXCLUDED.week_no, report_no=EXCLUDED.report_no,
      machinery=EXCLUDED.machinery, workers=EXCLUDED.workers, performance=EXCLUDED.performance,
      problems=EXCLUDED.problems, weather_am=EXCLUDED.weather_am, weather_pm=EXCLUDED.weather_pm,
      remark=EXCLUDED.remark, foreman_signed=EXCLUDED.foreman_signed,
      submitted_by=EXCLUDED.submitted_by, updated_at=CURRENT_TIMESTAMP`,
    [req.params.projectId,date,week_no||null,report_no||null,
     JSON.stringify(machinery||{}),JSON.stringify(workers||{}),JSON.stringify(performance||[]),
     problems||'',weather_am||'clear',weather_pm||'clear',remark||'',foreman_signed||false,req.user.id]);
  res.json({success:true});
}));

// GET list — last 30 reports
router.get('/projects/:projectId/daily-reports', authenticate, requireProjectAccess(), wrap(async(req,res)=>{
  const r = await pool.query(
    'SELECT id,report_date::text,foreman_signed,weather_am,weather_pm FROM daily_site_reports WHERE project_id=$1 ORDER BY report_date DESC LIMIT 30',
    [req.params.projectId]);
  res.json({success:true, data:r.rows});
}));
// POST /projects/:id/ai-process-update — map daily report work items to processes (FREE AI)
router.post('/projects/:projectId/ai-process-update', authenticate, requireProjectAccess(), wrap(async(req,res)=>{
  const projectId = req.params.projectId;
  const { performance, report_date } = req.body;
  const items = (performance||[]).filter(p => (p.work||'').trim());
  if (!items.length) return res.json({success:true, updates:[], message:'No work items'});

  // Get active processes
  const { LIB } = require('./process-master');
  const procs = (await pool.query(`
    SELECT pe.id exec_id, pn.process_name, pn.master_code, pn.floor_no,
           pe.completion_percentage, pe.status, pe.planned_quantity, pe.quantity_unit
    FROM process_nodes pn JOIN process_execution pe ON pe.process_node_id=pn.id
    WHERE pn.project_id=$1 AND pe.status IN ('not_started','in_progress')
    ORDER BY pn.sequence_number LIMIT 60
  `, [projectId])).rows;
  if (!procs.length) return res.json({success:true, updates:[], message:'No active processes'});

  const procList = procs.map(p => {
    const lib = LIB[p.master_code]||{};
    const nameZh = lib.zh || p.master_code;
    const nameEn = lib.th || '';
    return `ID:${p.exec_id} | ${nameZh} ${nameEn}${p.floor_no?' F'+p.floor_no:''} | ${Math.round(p.completion_percentage||0)}% done | unit:${p.quantity_unit||'?'} planned:${p.planned_quantity||'?'}`;
  }).join('\n');

  const workList = items.map((p,i)=>`${i+1}. "${p.work||''}" unit:${p.unit||'?'} today:${p.today||0} total:${p.total||0}`).join('\n');

  const prompt = `You are a construction progress tracker. Workers may write in Thai, Chinese, or English.

ACTIVE PROCESSES:
${procList}

TODAY'S WORK (worker input):
${workList}

Match each work item to a process. Return ONLY a JSON array:
[{"exec_id":<number>,"item_index":<1-based>,"progress_delta":<percent points to ADD>,"confidence":<0.0-1.0>,"reason":"brief English explanation"}]

Rules: only include matches with confidence>0.55, estimate progress_delta from today's quantity vs planned, return [] if no matches, NO other text.`;

  let text;
  try { text = await callFreeAI(prompt); }
  catch(e) { return res.json({success:false, message:'AI: '+e.message, updates:[]}); }

  let aiResult = [];
  try {
    const m = text.match(/\[[\s\S]*\]/);
    aiResult = m ? JSON.parse(m[0]) : [];
  } catch(e) { return res.json({success:false, message:'Parse error', raw:text.slice(0,300), updates:[]}); }

  const applied = [];
  for (const upd of aiResult) {
    if (!upd.exec_id || isNaN(Number(upd.exec_id)) || (upd.confidence||0) < 0.55) continue;
    const proc = procs.find(p=>Number(p.exec_id)===Number(upd.exec_id));
    if (!proc) continue;
    const newPct = Math.min(100, Math.max(0, (proc.completion_percentage||0)+(upd.progress_delta||0)));
    const newStatus = newPct>=100 ? 'completed' : 'in_progress';
    await pool.query(
      'UPDATE process_execution SET completion_percentage=$1,status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3',
      [newPct, newStatus, upd.exec_id]
    );
    applied.push({exec_id:upd.exec_id, old_pct:Math.round(proc.completion_percentage||0), new_pct:Math.round(newPct), confidence:upd.confidence, reason:upd.reason});
  }
  res.json({success:true, updates:applied, analyzed:aiResult.length, model_tried:'gemma-4'});
}));

module.exports = router;
