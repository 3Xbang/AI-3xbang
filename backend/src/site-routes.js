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
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE COALESCE(pe.quantity_unit, '') <> '项')::int AS countable,
            count(*) FILTER (WHERE COALESCE(pe.quantity_unit, '') <> '项' AND pe.planned_quantity > 0)::int AS with_qty
       FROM process_nodes pn JOIN process_execution pe ON pe.process_node_id = pn.id
      WHERE pn.project_id = $1 AND pn.master_code IS NOT NULL`, [pid])).rows[0];
  const accounts = (await pool.query('SELECT count(*)::int AS n FROM project_members WHERE project_id = $1', [pid])).rows[0].n;

  const a = prof ? prof.answers : {};
  const steps = [
    { key: 'profile', required: true, done: !!prof,
      detail: prof ? `${a.floors || '?'} 层${a.units > 1 ? `，${a.units} 套` : ''}${a.total_area ? `，约 ${a.total_area} 平方米` : ''}` : '还没有填写' },
    { key: 'team', required: true, done: team.n > 0 && team.skilled > 0,
      detail: team.n ? `${crewN} 个班组，大工 ${team.skilled} 人，普工 ${team.n - team.skilled} 人` + (team.skilled ? '' : '（至少要有 1 名大工）') : '还没有录入班组' },
    { key: 'plan', required: true, done: tasks.total > 0,
      detail: tasks.total ? `已生成 ${tasks.total} 道工序${prof && prof.plan_generated_at ? '（' + prof.plan_generated_at + '）' : ''}` : '还没有生成工序' },
    { key: 'quantities', required: false, done: tasks.countable > 0 && tasks.with_qty >= tasks.countable,
      detail: tasks.total ? `${tasks.with_qty} / ${tasks.countable} 道工序已有数量（可以先开工，现场再补）` : '先生成工序' },
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




  const GANTT_SECTIONS={A:{zh:"前期准备",th:"งานเตรียมการ",color:"#64748b",light:"#f1f5f9"},B:{zh:"地基基础",th:"งานฐานราก",color:"#d97706",light:"#fffbeb"},C:{zh:"主体结构",th:"งานโครงสร้างหลัก",color:"#3b82f6",light:"#eff6ff"},D:{zh:"屋面工程",th:"งานหลังคา",color:"#22c55e",light:"#f0fdf4"},E:{zh:"机电工程",th:"งานระบบน้ำ-ไฟ",color:"#a855f7",light:"#faf5ff"},F:{zh:"内装修",th:"งานตกแต่งภายใน",color:"#f97316",light:"#fff7ed"},G:{zh:"外立面",th:"งานผนังภายนอก",color:"#06b6d4",light:"#ecfeff"},H:{zh:"室外工程",th:"งานภายนอกอาคาร",color:"#10b981",light:"#ecfdf5"},I:{zh:"竣工验收",th:"ตรวจรับและส่งมอบ",color:"#6b7280",light:"#f9fafb"}};

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
  await pool.query(
    `UPDATE daily_task_assignments SET status=$1, completion_note=$2,
       completed_at=CASE WHEN $1::text='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
       updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
    [status,completion_note||null,req.params.id]);
  res.json({success:true});
}));

router.delete('/daily-assignments/:id', authenticate, requirePermission('manage_projects'), wrap(async(req,res)=>{
  await pool.query('DELETE FROM daily_task_assignments WHERE id=$1',[req.params.id]);
  res.json({success:true});
}));


module.exports = router;
