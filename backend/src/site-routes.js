// 鐜板満瀹夋帓鐩稿叧鐨勬帴鍙ｏ細椤圭洰鐢宠琛ㄣ€佺敓鎴愯鍒掋€佸洟闃熷悕鍐屻€佸嚭鍕ゃ€佺幇鍦虹湅鏉裤€佹淳宸ャ€佸紑濮嬪伐搴忋€侀€氱煡
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
  if (!r.rows.length) throw new S.HttpError(404, '宸ュ簭涓嶅瓨鍦?);
  return r.rows[0].project_id;
}
async function requireAccessToExec(client, req, execId) {
  const projectId = await execProject(client, execId);
  if (!(await checkProjectAccess(client, req.user.id, req.user.role, projectId))) throw new S.HttpError(403, '鏃犳潈璁块棶姝ら」鐩?);
  return projectId;
}
const validDate = d => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayInBangkok());
const TRADE_KEYS = Object.keys(S.TRADES);

// ---------- 鍩虹淇℃伅 ----------
router.get('/site/meta', authenticate, (req, res) => {
  res.json({ success: true, data: { trades: S.TRADES, defaults: S.DEFAULT_PROFILE } });
});

// ---------- 椤圭洰鐢宠琛?----------
router.get('/projects/:projectId/profile', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const p = await S.getProfile(pool, req.params.projectId);
  res.json({ success: true, data: { answers: p ? p.answers : {}, planGeneratedAt: p ? p.plan_generated_at : null, defaults: S.DEFAULT_PROFILE } });
}));

router.put('/projects/:projectId/profile', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req, res) => {
  const answers = req.body.answers;
  if (!answers || typeof answers !== 'object') throw new S.HttpError(400, '缂哄皯鐢宠琛ㄧ瓟妗?);
  try { await S.saveProfile(pool, req.params.projectId, answers, req.user.id); }
  catch (e) { throw new S.HttpError(400, e.message); }
  res.json({ success: true, message: '鐢宠琛ㄥ凡淇濆瓨' });
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
    await logActivity(client, req.user.id, 'apply_plan', 'project', Number(projectId), { message: `鎸夌敵璇疯〃鐢熸垚宸ュ簭锛氭柊澧?${r.added}锛岀Щ闄?${r.removed}` });
    return r;
  });
  res.json({ success: true, message: '宸ュ簭宸茬敓鎴?, data: result });
}));

// ---------- 鍥㈤槦鍚嶅唽锛堟部鐢?workers 琛級 ----------
function cleanMember(b) {
  const level = b.level === 'skilled' ? 'skilled' : 'helper';
  const name = String(b.name || '').trim();
  if (!name) throw new S.HttpError(400, '璇峰～鍐欏鍚?);
  let skills = Array.isArray(b.skills) ? b.skills : [];
  skills = skills.filter(s => s === '*' || TRADE_KEYS.includes(s));
  if (level === 'skilled' && !skills.length) throw new S.HttpError(400, '鎶€宸ヨ嚦灏戣閫変竴涓伐绉?);
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
  if (!r.rows.length) throw new S.HttpError(404, '鎴愬憳涓嶅瓨鍦?);
  res.json({ success: true });
}));

router.delete('/team/:workerId', authenticate, requirePermission('manage_projects'), wrap(async (req, res) => {
  const r = await pool.query(`UPDATE workers SET status = 'inactive' WHERE worker_id = $1 RETURNING worker_id`, [req.params.workerId]);
  if (!r.rows.length) throw new S.HttpError(404, '鎴愬憳涓嶅瓨鍦?);
  res.json({ success: true });
}));

// ---------- 鏂藉伐鐝粍锛氬彧濉彮缁勫悕銆佸ぇ宸?鏅伐浜烘暟銆佲€滃嚑涓ぇ宸ヤ細浠€涔堚€濓紱绯荤粺鑷姩鐢熸垚瀵瑰簲鐨勨€滀汉鈥濈敤浜庡嚭鍕ゅ拰娲惧伐 ----------
// 鐝粍閲屽彲閫夌殑宸ョ = 绯荤粺宸ョ娓呭崟锛坰ite-service 鐨?TRADES锛夛紝涓嶅惈鏅伐/鏉傚伐锛堟櫘宸ュ彟濉汉鏁帮級銆?
const COARSE_KEYS = TRADE_KEYS.filter(k => k !== 'general');

function cleanCrew(b) {
  const name = String(b.name || '').trim();
  if (!name) throw new S.HttpError(400, '璇峰～鍐欑彮缁勫悕绉?);
  const skilled = Math.floor(Number(b.skilled_count));
  const helper = Math.floor(Number(b.helper_count));
  if (!(skilled >= 0 && skilled <= 100) || !(helper >= 0 && helper <= 300)) throw new S.HttpError(400, '浜烘暟涓嶆纭?);
  if (skilled + helper < 1) throw new S.HttpError(400, '鐝粍鑷冲皯瑕佹湁 1 涓汉');
  const counts = {};
  const input = b.skill_counts && typeof b.skill_counts === 'object' ? b.skill_counts : {};
  COARSE_KEYS.forEach(k => {
    const n = Math.floor(Number(input[k]));
    if (n > 0) {
      if (n > skilled) throw new S.HttpError(400, '鏌愪釜宸ョ鐨勪汉鏁颁笉鑳芥瘮澶у伐鎬绘暟澶?);
      counts[k] = n;
    }
  });
  if (skilled > 0 && !Object.keys(counts).length) throw new S.HttpError(400, '璇峰～鍐欐湁鍑犱釜澶у伐浼氬共浠€涔?);
  return { name, skilled, helper, counts };
}

// 鎶娾€滃嚑涓汉浼氫粈涔堚€濆垎鍒板叿浣撴瘡涓ぇ宸ヨ韩涓婏細鎸夐『搴忚疆娴佸垎閰嶏紝鍚勯」浜烘暟鍔犺捣鏉ヤ笉瓒呰繃澶у伐鎬绘暟鏃朵簰涓嶉噸鍙狅紝瓒呰繃鏃跺氨鏄鑳藉伐
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

// 璁?workers 琛ㄩ噷杩欎釜鐝粍鐨勪汉鏁般€佸悕瀛椼€佸伐绉嶄笌鐝粍璁剧疆涓€鑷达紙澶氬嚭鏉ョ殑璁句负 inactive锛屼笉鍒犲巻鍙叉淳宸ワ級
async function syncCrewWorkers(client, projectId, crewId, c) {
  const perPerson = skillsPerPerson(c.skilled, c.counts);
  for (const level of ['skilled', 'helper']) {
    const want = level === 'skilled' ? c.skilled : c.helper;
    const label = level === 'skilled' ? '澶у伐' : '鏅伐';
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
    if (!cur.rows.length) throw new S.HttpError(404, '鐝粍涓嶅瓨鍦?);
    const pid = cur.rows[0].project_id;
    if (!(await checkProjectAccess(client, req.user.id, req.user.role, pid))) throw new S.HttpError(403, '鏃犳潈璁块棶姝ら」鐩?);
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
    if (!cur.rows.length) throw new S.HttpError(404, '鐝粍涓嶅瓨鍦?);
    if (!(await checkProjectAccess(client, req.user.id, req.user.role, cur.rows[0].project_id))) throw new S.HttpError(403, '鏃犳潈璁块棶姝ら」鐩?);
    await client.query(`UPDATE project_crews SET status = 'inactive' WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE workers SET status = 'inactive' WHERE crew_id = $1`, [req.params.id]);
  });
  res.json({ success: true });
}));

// ---------- 鍑哄嫟 ----------
router.get('/projects/:projectId/attendance', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const date = validDate(req.query.date);
  const r = await pool.query(
    `SELECT w.worker_id AS id, w.name, COALESCE(a.status, 'present') AS status
       FROM workers w LEFT JOIN daily_attendance a ON a.worker_id = w.worker_id AND a.attendance_date = $2
      WHERE w.project_id = $1 AND w.status = 'active' ORDER BY w.worker_id`, [req.params.projectId, date]);
  res.json({ success: true, data: { date, members: r.rows } });
}));

// 宸ュご鏍囪浠婂ぉ娌℃潵鐨勪汉锛屽叾浣欓粯璁ゆ潵浜?
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
      // 娌℃潵鐨勪汉锛屽綋澶╁凡缁忓畨鎺掔殑浠诲姟瑕佹挙鎺?
      await client.query('DELETE FROM site_assignments WHERE project_id = $1 AND work_date = $2 AND worker_id = ANY($3::int[])', [req.params.projectId, date, absent]);
    }
  });
  res.json({ success: true });
}));

// ---------- 鐜板満鐪嬫澘 ----------
router.get('/projects/:projectId/site-board', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const data = await S.buildBoard(pool, req.params.projectId, validDate(req.query.date));
  res.json({ success: true, data });
}));

// 棰勮宸ユ湡涓庝汉鍛橀厤缃細姣忛亾宸ュ簭瑕佸嚑涓彮缁勩€佸嚑涓ぇ宸ュ嚑涓櫘宸ャ€侀璁″嚑澶╋紱鏁翠綋棰勮瀹屽伐鏃?
router.get('/projects/:projectId/estimate', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const data = await S.buildEstimate(pool, req.params.projectId);
  res.json({ success: true, data });
}));

// 宸ュご缁欎粖澶╂淳浜猴細{ date, assignments: { 宸ュ簭id: [宸ヤ汉id] } }锛堟暣澶╄鐩栵級
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
      if (pid !== projectId) throw new S.HttpError(400, '宸ュ簭涓嶅睘浜庤繖涓」鐩?);
      for (const wid of input[execId].map(Number)) {
        if (!valid.has(wid)) throw new S.HttpError(400, `鎴愬憳 ${wid} 涓嶅湪杩欎釜椤圭洰鐨勫洟闃熼噷`);
        if (absent.has(wid)) throw new S.HttpError(400, `鎴愬憳 ${wid} 浠婂ぉ娌℃潵锛屼笉鑳藉畨鎺抈);
        if (seen.has(wid)) throw new S.HttpError(400, `鎴愬憳 ${wid} 琚畨鎺掑埌浜嗗涓换鍔★紝涓€涓汉涓€澶╁彧鑳藉湪涓€涓换鍔′笂`);
        seen.add(wid);
      }
      // 杩樻病寮€濮嬬殑銆佸墠缃病婊¤冻鐨勪换鍔★紝涓嶈兘娲句汉锛堣鍏堛€屾彁鍓嶅紑濮嬨€嶅苟鍐欏師鍥狅級
      if (L.planned && L.keyByExec.has(Number(execId))) {
        const key = L.keyByExec.get(Number(execId));
        const st = L.state.tasks[key];
        if (!st || st.status === 'not_started') {
          const check = canStart(L.plan, L.state, key);
          if (!check.allowed) {
            const label = k => { const t = L.plan.tasks.find(x => x.key === k); return t.zh + (t.floor != null ? `锛?{t.floor}灞傦級` : ''); };
            throw new S.HttpError(409, '杩欎釜浠诲姟鍓嶇疆鏉′欢杩樻病婊¤冻锛屼笉鑳芥淳浜恒€傞渶瑕佹彁鍓嶅紑濮嬬殑璇濓紝璇峰厛鐐广€屾彁鍓嶅紑濮嬨€嶅苟鍐欏師鍥?,
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

// ---------- 寮€濮嬪伐搴忥紙鏈夋妸鍏筹紱鎻愬墠寮€濮嬪繀椤诲啓鍘熷洜骞堕€氱煡锛?----------
router.post('/processes/:id/start', authenticate, wrap(async (req, res) => {
  const execId = Number(req.params.id);
  const out = await tx(async client => {
    await requireAccessToExec(client, req, execId);
    const r = await S.startProcess(client, execId, req.user, req.body.force_reason, /^\d{4}-\d{2}-\d{2}$/.test(req.body.date || '') ? req.body.date : undefined);
    if (r.started) await logActivity(client, req.user.id, r.override ? 'force_start_process' : 'start_process', 'process_execution', execId, { message: r.override ? r.override.message : '寮€濮嬪伐搴? });
    return r;
  });
  res.json({ success: true, data: out });
}));

// 杩涜涓殑浠诲姟锛氭爣璁扮己鏉愭枡 / 澶╂皵鍋滃伐 / 鎭㈠銆傝繖浜涘ぉ鍦ㄧ粺璁℃晥鐜囨椂涓嶇畻鐝粍鐨勮矗浠汇€?
router.post('/processes/:id/work-status', authenticate, wrap(async (req, res) => {
  const execId = Number(req.params.id);
  const status = req.body.status;
  if (!['in_progress', 'waiting_material', 'weather_stop'].includes(status)) throw new S.HttpError(400, '鐘舵€佷笉姝ｇ‘');
  const note = String(req.body.note || '').trim();
  if (status === 'waiting_material' && !note) throw new S.HttpError(400, '璇峰啓鏄庣己浠€涔堟潗鏂?);
  await tx(async client => {
    await requireAccessToExec(client, req, execId);
    const cur = await client.query('SELECT status FROM process_execution WHERE id = $1', [execId]);
    if (!['in_progress', 'waiting_material', 'weather_stop'].includes(cur.rows[0].status)) {
      throw new S.HttpError(409, '鍙湁杩涜涓殑浠诲姟鎵嶈兘鏍囪缂烘潗鏂欐垨澶╂皵鍋滃伐');
    }
    await client.query(
      `UPDATE process_execution SET status = $1, notes = COALESCE($2::jsonb, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [status, note ? JSON.stringify({ zh: note, th: note }) : null, execId]);
    await logActivity(client, req.user.id, 'work_status', 'process_execution', execId,
      { message: `鐘舵€佹敼涓?${status}${note ? '锛? + note : ''}` });
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

// ---------- 閫氱煡 ----------
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

// ---------- 椤圭洰鍑嗗瀹屾垚搴︼細鍓?3 姝ュ繀椤诲畬鎴愭墠鑳藉紑宸ワ紝鍚?2 姝ュ彲浠ヨ竟鍋氳竟琛?----------
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
      detail: drawCount > 0 ? `宸蹭笂浼?${drawCount} 浠藉浘绾竊 : '杩樻病鏈変笂浼犲浘绾革紙鍙互璺宠繃锛? },
    { key: 'boq', required: false, done: !!prof,
      detail: prof ? `宸叉湁鐢宠琛ㄦ暟鎹紙${a.floors || '?'} 灞傦級` : '涓婁紶 BOQ 鍙嚜鍔ㄥ～濂界敵璇疯〃锛堝彲浠ヨ烦杩囷紝鎵嬪姩濉級' },
    { key: 'profile', required: true, done: !!prof,
      detail: prof ? `${a.floors || '?'} 灞?{a.units > 1 ? `锛?{a.units} 濂梎 : ''}${a.total_area ? `锛岀害 ${a.total_area} 骞虫柟绫砢 : ''}` : '杩樻病鏈夊～鍐? },
    { key: 'team', required: true, done: team.n > 0 && team.skilled > 0,
      detail: team.n ? `${crewN} 涓彮缁勶紝澶у伐 ${team.skilled} 浜猴紝鏅伐 ${team.n - team.skilled} 浜篳 + (team.skilled ? '' : '锛堣嚦灏戣鏈?1 鍚嶅ぇ宸ワ級') : '杩樻病鏈夊綍鍏ョ彮缁? },
    { key: 'plan', required: true, done: tasks.total > 0,
      detail: tasks.total ? `宸茬敓鎴?${tasks.total} 閬撳伐搴?{prof && prof.plan_generated_at ? '锛? + prof.plan_generated_at + '锛? : ''}` : '杩樻病鏈夌敓鎴愬伐搴? },
    { key: 'accounts', required: false, done: accounts > 1,
      detail: `${accounts} 涓处鍙峰彲浠ヨ闂湰椤圭洰` }
  ];
  const missing = steps.filter(s => s.required && !s.done).map(s => s.key);
  res.json({ success: true, data: { steps, ready: missing.length === 0, missing } });
}));

// ---------- 瀵煎叆宸ョ▼閲忔竻鍗曪紙Excel锛?----------
const multer = require('multer');
const { generatePlan } = require('./process-master');
const BOQ = require('./boq-import');
const boqUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function boqMapping(projectId, file) {
  if (!file) throw new S.HttpError(400, '璇烽€夋嫨娓呭崟鏂囦欢锛?xlsx锛?);
  if (!/\.xlsx$/i.test(file.originalname || '')) throw new S.HttpError(400, '鐩墠鍙敮鎸?Excel锛?xlsx锛夋竻鍗曘€俉ord/PDF 璇峰厛鍙﹀瓨涓?Excel');
  const prof = await S.getProfile(pool, projectId);
  if (!prof) throw new S.HttpError(400, '璇峰厛濉啓骞朵繚瀛橀」鐩敵璇疯〃锛屽啀瀵煎叆娓呭崟');
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

// 纭鍚庡啓鍏ワ細鍙啓鈥滃伐搴忕殑璁″垝鏁伴噺鈥濓紝鍏朵綑鏁版嵁涓嶅姩銆俿kip: 涓嶆兂瀵煎叆鐨勫伐搴?key 鍒楄〃锛圝SON锛?
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
    await logActivity(client, req.user.id, 'import_boq', 'project', projectId, { message: `瀵煎叆宸ョ▼閲忔竻鍗曪細鍐欏叆 ${written} 閬撳伐搴忕殑璁″垝鏁伴噺` });
    return { written };
  });
  res.json({ success: true, data: out });
}));

// ============ 宸ュ簭瀹氶璁剧疆锛堜粎绠＄悊鑰咃級============
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
  if (!QUOTA[code] || QUOTA[code].kind !== 'work') throw new S.HttpError(400, '宸ュ簭缂栫爜涓嶅瓨鍦ㄦ垨涓嶆槸鎸夐噺璁＄畻鐨勫伐搴?);
  const output = Number(req.body.output);
  const skilled = Math.floor(Number(req.body.skilled));
  const helper = Math.floor(Number(req.body.helper));
  if (!(output > 0 && output < 10000)) throw new S.HttpError(400, '浜ч噺蹇呴』澶т簬 0');
  if (!(skilled >= 0 && skilled <= 20)) throw new S.HttpError(400, '澶у伐浜烘暟涓嶅');
  if (!(helper >= 0 && helper <= 20)) throw new S.HttpError(400, '鏅伐浜烘暟涓嶅');
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
  res.json({ success: true, message: '宸叉仮澶嶉粯璁ゅ€? });
}));




  const GANTT_SECTIONS={A:{zh:"鍓嶆湡鍑嗗",th:"喔囙覆喔權箑喔曕福喔掂涪喔∴竵喔侧福",color:"#64748b",light:"#f1f5f9"},B:{zh:"鍦板熀鍩虹",th:"喔囙覆喔權笎喔侧笝喔｀覆喔?,color:"#d97706",light:"#fffbeb"},C:{zh:"涓讳綋缁撴瀯",th:"喔囙覆喔權箓喔勦福喔囙釜喔｀箟喔侧竾喔弗喔编竵",color:"#3b82f6",light:"#eff6ff"},D:{zh:"灞嬮潰宸ョ▼",th:"喔囙覆喔權斧喔ム副喔囙竸喔?,color:"#22c55e",light:"#f0fdf4"},E:{zh:"鏈虹數宸ョ▼",th:"喔囙覆喔權福喔班笟喔氞笝喙夃赋-喙勦笩",color:"#a855f7",light:"#faf5ff"},F:{zh:"鍐呰淇?,th:"喔囙覆喔權笗喔佮箒喔曕箞喔囙笭喔侧涪喙冟笝",color:"#f97316",light:"#fff7ed"},G:{zh:"澶栫珛闈?,th:"喔囙覆喔權笢喔權副喔囙笭喔侧涪喔權腑喔?,color:"#06b6d4",light:"#ecfeff"},H:{zh:"瀹ゅ宸ョ▼",th:"喔囙覆喔權笭喔侧涪喔權腑喔佮腑喔侧竸喔侧福",color:"#10b981",light:"#ecfdf5"},I:{zh:"绔ｅ伐楠屾敹",th:"喔曕福喔о笀喔｀副喔氞箒喔ム赴喔箞喔囙浮喔笟",color:"#6b7280",light:"#f9fafb"}};

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



// ============ 椤圭洰鍥剧焊 ============
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

// BOQ 鑷姩璇嗗埆椤圭洰鍙傛暟 鈥?鏀寔 Excel (.xlsx) 鍜?PDF
const boqExtractUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// 浠?BOQ 鏉＄洰鍒楄〃涓瘑鍒」鐩弬鏁帮紙Excel 鍜?PDF 鍏辩敤锛?
function extractProfileFromItems(items) {
  const profile = {};
  const hints = [];

  // 妤煎眰妫€娴嬶細鑻卞紡鑻辫 Ground Floor=1灞? First Floor=2灞? Second Floor=3灞?
  // 鍚屾椂鎵弿 section 鍚嶅拰 desc 瀛楁
  const allText = items.map(x => (x.section || '') + ' ' + (x.desc || '')).join('\n');
  const floors = new Set();
  if (/ground\s*floor/i.test(allText)) floors.add(1);
  if (/first\s*floor/i.test(allText))  floors.add(2);
  if (/second\s*floor/i.test(allText)) floors.add(3);
  if (/third\s*floor/i.test(allText))  floors.add(4);
  // 缇庡紡鑻辫澶囩敤锛坒irst floor = ground floor = 1锛?
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
  if (floorCount) { profile.floors = floorCount; hints.push('妤煎眰鏁? ' + floorCount + ' 灞傦紙Ground/First/Second Floor 绔犺妭鎺ㄦ柇锛?); }

  // 鍗敓闂达細Toilet 鏁伴噺
  const toiletItem = items.find(x => /\btoilet\b/i.test(x.desc) && x.qty > 0);
  if (toiletItem) {
    if (floorCount && floorCount > 0) profile.bathrooms = Math.round(toiletItem.qty / floorCount);
    hints.push('鍗敓闂? 鍏?' + toiletItem.qty + ' 涓紙Toilet锛?);
  }

  // 鍘ㄦ埧锛欸rease trap
  const grease = items.find(x => /grease\s*trap/i.test(x.desc) && x.qty > 0);
  if (grease) { profile.kitchens = grease.qty; hints.push('鍘ㄦ埧: ' + grease.qty + ' 涓紙Grease trap锛?); }

  // 娉虫睜
  const hasPool = items.some(x => /swimming\s*pool|pool\s*pump/i.test(x.desc) || /swimming/i.test(x.section));
  if (hasPool) { profile.pool = true; hints.push('娉虫睜: 妫€娴嬪埌'); }

  // 灞嬮《绫诲瀷
  const hasPitched = items.some(x => /metal\s*sheet|matal\s*sheet|c\s*channel/i.test(x.desc) && /roof/i.test(x.section));
  const hasFlat    = items.some(x => /waterproof|polished\s*cement/i.test(x.desc) && /roof/i.test(x.section));
  if (hasPitched && hasFlat) profile.roof = 'both';
  else if (hasPitched) profile.roof = 'pitched';
  else if (hasFlat)    profile.roof = 'flat';
  if (profile.roof) hints.push('灞嬮《绫诲瀷: ' + { pitched: '鍧″眿闈?, flat: '骞冲眿闈?, both: '鍧?骞? }[profile.roof]);

  // 濂楁暟锛歋eptic tank
  const septic = items.find(x => /septic\s*tank/i.test(x.desc) && x.qty > 1);
  if (septic) { profile.units = septic.qty; hints.push('濂楁暟: ' + septic.qty + ' 濂楋紙Septic tank鎺ㄦ柇锛?); }

  return { profile, hints };
}

// 鐩存帴瀵?PDF 鍘熷鏂囨湰鍋?regex 璇嗗埆锛堟瘮瑙ｆ瀽琛ㄦ牸琛屾洿鍙潬锛?
function extractFromPdfRawText(text) {
  const profile = {};
  const hints = [];

  // 鈹€鈹€ 妤煎眰 鈹€鈹€
  // 鑻卞紡/娉板紡: Ground Floor = 喔娻副喙夃笝 1, First Floor = 喔娻副喙夃笝 2, Second Floor = 喔娻副喙夃笝 3
  // 浣嗘湰 BOQ 娣风敤: "Ground Floor" 鍜?"first floor" 閮戒唬琛ㄧ 1 灞傦紝"Second floor" = 绗?2 灞?
  // 瑙勫垯: ground/first floor 鈫?level 1; second floor 鈫?level 2; third 鈫?level 3
  const levels = new Set();
  if (/ground\s+floor/i.test(text))              levels.add(1);
  if (/\bfirst\s+floor\b/i.test(text))           levels.add(1); // 鍜?ground floor 鍚屽眰
  if (/\bsecond\s+floor\b/i.test(text))          levels.add(2);
  if (/\bthird\s+floor\b/i.test(text))           levels.add(3);
  if (/\bfourth\s+floor\b/i.test(text))          levels.add(4);
  const floorCount = levels.size || null;
  if (floorCount) { profile.floors = floorCount; hints.push('妤煎眰鏁? ' + floorCount + ' 灞傦紙Floor绔犺妭鎺ㄦ柇锛?); }

  // 鈹€鈹€ 鍗敓闂?(Toilet) 鈹€鈹€
  // 澶勭悊 "9.1 Toilet\n4 Piece" 鍜?"9.1 Toilet 4 Piece" 涓ょ鏍煎紡
  const toiletM = text.match(/\bToilet\b[^0-9\n]{0,30}\n?[^0-9\n]{0,10}(\d+)\s*(?:Piece|nos?\.?|pcs?\.?)/i);
  if (toiletM) {
    const qty = parseInt(toiletM[1]);
    if (qty > 0) {
      if (floorCount) profile.bathrooms = Math.round(qty / floorCount);
      hints.push('鍗敓闂? 鍏?' + qty + ' 涓紙Toilet锛夛紝姣忓眰绾?' + (profile.bathrooms || qty) + ' 涓?);
    }
  }

  // 鈹€鈹€ 鍘ㄦ埧 (Grease trap) 鈹€鈹€
  const greaseM = text.match(/\bGrease\s+trap\b[^0-9\n]{0,20}\n?[^0-9\n]{0,10}(\d+)/i);
  if (greaseM) {
    const qty = parseInt(greaseM[1]);
    if (qty > 0) { profile.kitchens = qty; hints.push('鍘ㄦ埧: ' + qty + ' 涓紙Grease trap锛?); }
  }

  // 鈹€鈹€ 娉虫睜 鈥斺€?娉ㄦ剰 PDF 閲屾嫾浣?"Swimmining" 鈹€鈹€
  if (/swimm?i?ni?ng\s*pool/i.test(text) || /13\s+Swimm/i.test(text)) {
    profile.pool = true;
    hints.push('娉虫睜: 妫€娴嬪埌锛圫wimming pool绔犺妭锛?);
  }

  // 鈹€鈹€ 灞嬮《绫诲瀷 鈹€鈹€
  const hasMetal = /matal?\s*sheets?/i.test(text) || (/c\s*channel/i.test(text) && /roof/i.test(text));
  const hasFlat  = /waterproof/i.test(text) && /roof/i.test(text);
  if (hasMetal && hasFlat) profile.roof = 'both';
  else if (hasMetal)       profile.roof = 'pitched';
  else if (hasFlat)        profile.roof = 'flat';
  if (profile.roof) hints.push('灞嬮《绫诲瀷: ' + { pitched: '鍧″眿闈?, flat: '骞冲眿闈?, both: '鍧?骞? }[profile.roof]);

  // 鈹€鈹€ 濂楁暟锛氫紭鍏堢敤 "TOTAL N VILLA" 鈹€鈹€
  const villaM = text.match(/TOTAL\s+(\d+)\s+VILLA/i);
  if (villaM) {
    const n = parseInt(villaM[1]);
    if (n > 1) { profile.units = n; hints.push('濂楁暟: ' + n + ' 濂楋紙TOTAL N VILLA锛?); }
    // n=1 鏄崟鐙竴濂?villa锛屼笉闇€瑕佽 units
  } else {
    // 閫€鍖栵細Septic tank 鏁伴噺 > 1 鎵嶆帹鏂濂?
    const septicM = text.match(/Septic\s+tank\b[^0-9\n]{0,20}\n?[^0-9\n]{0,10}(\d+)/i);
    if (septicM && parseInt(septicM[1]) > 1) {
      profile.units = parseInt(septicM[1]);
      hints.push('濂楁暟: ' + profile.units + ' 濂楋紙Septic tank鎺ㄦ柇锛?);
    }
  }

  return { profile, hints };
}

router.post('/projects/:projectId/boq/extract-profile', authenticate, requireProjectAccess(), requirePermission('manage_projects'), boqExtractUpload.single('boq'), wrap(async(req, res) => {
  if (!req.file) throw new S.HttpError(400, '璇蜂笂浼?BOQ 鏂囦欢锛圗xcel .xlsx 鎴?PDF锛?);
  const fname = (req.file.originalname || '').toLowerCase();
  let items = [];
  let fileDesc = '';

  if (fname.endsWith('.xlsx')) {
    // Excel 璺緞锛氫娇鐢ㄧ幇鏈?BOQ 瑙ｆ瀽鍣?
    const boq = BOQ.readBoq(req.file.buffer);
    items = boq.items;
    fileDesc = 'Excel锛? + items.length + ' 琛?;
  } else if (fname.endsWith('.pdf')) {
    // PDF 璺緞锛氱洿鎺ュ鍘熷鏂囨湰鍋?regex锛屼笉瑙ｆ瀽琛ㄦ牸琛?
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      const { profile: pdfProfile, hints: pdfHints } = extractFromPdfRawText(data.text);
      pdfHints.unshift('馃搫 PDF锛? + data.numpages + ' 椤?);
      res.json({ success: true, data: { profile: pdfProfile, hints: pdfHints, itemCount: data.numpages } });
      return;
    } catch (e) {
      throw new S.HttpError(400, 'PDF 瑙ｆ瀽澶辫触锛? + e.message);
    }
  } else {
    throw new S.HttpError(400, '鍙敮鎸?Excel锛?xlsx锛夋垨 PDF 鏂囦欢');
  }

  const { profile, hints } = extractProfileFromItems(items);
  if (fileDesc) hints.unshift('馃搫 ' + fileDesc);
  res.json({ success: true, data: { profile, hints, itemCount: items.length, fileDesc } });
}));


// 灏侀潰鐓х墖涓婁紶
const coverUpload = require('multer')({ storage: require('multer').diskStorage({
  destination: (req,file,cb) => cb(null,'uploads/'),
  filename: (req,file,cb) => cb(null,'cover_p'+req.params.projectId+'_'+Date.now()+require('path').extname(file.originalname))
}), limits:{fileSize:15*1024*1024}, fileFilter:(req,file,cb)=>cb(null,/image/i.test(file.mimetype)) });

router.post('/projects/:projectId/cover', authenticate, requireProjectAccess(), requirePermission('manage_projects'), coverUpload.single('cover'), wrap(async(req,res)=>{
  if(!req.file) throw new S.HttpError(400,'璇蜂笂浼犲浘鐗?);
  const url='/uploads/'+req.file.filename;
  await pool.query('UPDATE projects SET cover_photo=$1 WHERE id=$2',[url,req.params.projectId]);
  res.json({success:true,data:{cover_photo:url}});
}));

// ============================================================
// 閲囪喘浠锋牸鍙傝€冩暟鎹簱 Purchase Price Reference Database
// ============================================================

// CSV琛岃В鏋愶紙澶勭悊閫楀彿鍦ㄥ紩鍙峰唴鐨勬儏鍐碉級
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

// 鏇存柊浠锋牸鍩哄噯锛堟瘡娆″鍏ュ悗璋冪敤锛?
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
  if (!req.file) throw new S.HttpError(400, '璇蜂笂浼燙SV鏂囦欢');
  const text = req.file.buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new S.HttpError(400, 'CSV涓虹┖鎴栨牸寮忛敊璇?);

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
      if (/喙佮笟喔勦箓喔畖喙€喔勦福喔檤鎸栨帢鏈簗鍚婅溅|喔｀笘.*喙€喔娻箞喔瞸鏈烘/.test(nm)) category = 'Machinery';
      else if (/喔佮赋喔堗副喔斷笡喔ム抚喔亅鐧借殎|pest|喔氞福喔脆竵喔侧福|service/.test(nm)) category = 'Service';
      else if (/喔傕笝喔箞喔噟杩愯緭|transport/.test(nm)) category = 'Transport';
      else if (/喙冟笟喔曕副喔攟鍒囧壊鐗噟喔權箟喔赤涪喔瞸鑴辨ā鍓倈consumable/.test(nm)) category = 'Consumable';
      else if (/喙€喔弗喙囙竵|閽rebar/.test(nm)) category = 'Rebar';
      else if (/喔勦腑喔權竵喔｀傅喔晐娣峰嚌鍦焲concrete/.test(nm)) category = 'Concrete';
      else if (/喔涏腹喔檤water cement|喔嬥傅喙€喔∴笝喔曕箤|姘存偿|cement/.test(nm)) category = 'Cement';
      else if (/喔复喔檤鐭硘aggregate|gravel/.test(nm)) category = 'Aggregate';
      else if (/喔椸福喔侧涪|娌檤sand/.test(nm)) category = 'Aggregate';
      else if (/pvc|喔椸箞喔瓅绠?.test(nm)) category = 'PVC';
      else if (/喙佮笢喙堗笝喔炧阜喙夃笝|precast|妤兼澘/.test(nm)) category = 'Precast';
      else if (/喔复喔恷brick|鐮?.test(nm)) category = 'Block';
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

    // Parse date 鈥?handles ranges like "19-28/06/2026", "01-09/07/2026", "13/06/2026"
    let dateStr = null;
    if (purchaseDate) {
      // Extract first date from ranges like "19-28/06/2026" 鈫?"19/06/2026"
      const cleaned = purchaseDate.trim().split(/\s/)[0]; // ignore trailing spaces/text
      // Match: dd/mm/yyyy, dd-mm-yyyy, or range start "dd-dd/mm/yyyy" 鈫?take first part
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

    // Skip duplicates: same invoice + item + total
    const exists = await pool.query(
      `SELECT 1 FROM purchase_records WHERE invoice_no=$1 AND item_name_cn=$2 AND ABS(total_price - $3) < 0.01 LIMIT 1`,
      [invoiceNo||null, nameCN, totalPrice]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO purchase_records (purchase_date, invoice_no, supplier_id, supplier_name, item_id, item_name_cn, item_name_th, item_category, qty, unit, unit_price, total_price, project_id, imported_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [dateStr, invoiceNo||null, suppCache[supplierName], supplierName, itemCache[itemKey], nameCN, nameTH||null, category||null, qty, unit, unitPrice, totalPrice, req.body.project_id||null, req.user.id]);
      imported++;
      await refreshPriceBenchmark(nameCN, unit);
    }
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
  if (!mi) throw new S.HttpError(404, '鎵句笉鍒版潗鏂?);
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
  if (!supplier_name || !item_name_cn || !unit) throw new S.HttpError(400, '渚涜揣鍟嗐€佸搧鍚嶃€佸崟浣嶄负蹇呭～');

  const sr = await pool.query(`INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [supplier_name]);
  const ir = await pool.query(`INSERT INTO material_items (name_cn, name_th, category, unit) VALUES ($1,$2,$3,$4) ON CONFLICT (name_cn, unit) DO UPDATE SET name_th=COALESCE(EXCLUDED.name_th,material_items.name_th) RETURNING id`, [item_name_cn, item_name_th||null, item_category||null, unit]);

  const r = await pool.query(
    `INSERT INTO purchase_records (purchase_date, invoice_no, supplier_id, supplier_name, item_id, item_name_cn, item_name_th, item_category, qty, unit, unit_price, total_price, project_id, imported_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [purchase_date||null, invoice_no||null, sr.rows[0].id, supplier_name, ir.rows[0].id, item_name_cn, item_name_th||null, item_category||null, qty||0, unit, unit_price||0, (qty||0)*(unit_price||0), project_id||null, req.user.id]);

  await refreshPriceBenchmark(item_name_cn, unit);
  res.json({ success: true, data: r.rows[0] });
}));

// ============================================================
// AI 閲囪喘鍒嗘瀽 + 鏀舵嵁璇嗗埆 (Google Gemini)
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

// 鑷姩杞崲妯″瀷锛屽鐞?503/429 杩囪浇
async function callGemini(prompt, imagePart) {
  const tried = new Set();
  // 浠庡彲鐢ㄥ垪琛ㄩ噷灏介噺澶氭斁鍑犱釜锛屽喎闂ㄦā鍨嬪線寰€涓嶅牭
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
  throw lastErr || new Error('妯″瀷鍏ㄩ儴绻佸繖锛岃绋嶅悗鍐嶈瘯 / 喔｀赴喔氞笟 AI 喔⑧父喙堗竾 喔佮福喔膏笓喔侧弗喔竾喙冟斧喔∴箞喔椸傅喔弗喔编竾');
}

// 鈹€鈹€ 纭繚 ai_rules 鍒楀瓨鍦?鈹€鈹€
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

// 鈹€鈹€ POST /projects/:id/ai-extract-contract 鈥?涓婁紶鍚堝悓锛孉I鎻愬彇璐ｄ换鏉℃ 鈹€鈹€
const contractUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 20*1024*1024 } });

router.post('/projects/:projectId/ai-extract-contract', authenticate, requireProjectAccess(), requirePermission('manage_projects'), contractUpload.single('contract'), wrap(async (req, res) => {
  if (!req.file) throw new S.HttpError(400, '璇蜂笂浼犲悎鍚屾枃浠?);

  let contractText = '';
  const fname = (req.file.originalname||'').toLowerCase();

  if (fname.endsWith('.pdf')) {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      contractText = data.text;
    } catch(e) {
      throw new S.HttpError(400, 'PDF璇诲彇澶辫触: ' + e.message);
    }
  } else if (fname.endsWith('.docx') || fname.endsWith('.doc')) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      contractText = result.value;
    } catch(e) {
      throw new S.HttpError(400, 'DOCX璇诲彇澶辫触: ' + e.message);
    }
  } else {
    // TXT or other text format
    contractText = req.file.buffer.toString('utf8');
  }

  if (!contractText || contractText.trim().length < 100) {
    throw new S.HttpError(400, '喙勦浮喙堗釜喔侧浮喔侧福喔栢腑喙堗覆喔權箑喔權阜喙夃腑喔覆喔副喔嵿笉喔侧箘喔斷箟 / 鏃犳硶璇诲彇鍚堝悓鍐呭锛岃妫€鏌ユ枃浠舵牸寮?);
  }

  const model = getGemini();

  const prompt = `喔勦父喔撪箑喔涏箛喔權笢喔灌箟喙€喔娻傅喙堗涪喔о笂喔侧笉喔副喔嵿笉喔侧竵喙堗腑喔福喙夃覆喔?
喔勦父喔撪笗喙夃腑喔囙腑喙堗覆喔權釜喔编笉喔嵿覆喔佮箞喔釜喔｀箟喔侧竾喔權傅喙夃箒喔ム赴喔斷付喔囙競喙夃腑喔佮赋喔笝喔斷箑喔｀阜喙堗腑喔囙竸喔о覆喔∴福喔编笟喔溹复喔斷笂喔笟喔腑喔佮浮喔?

喙傕笖喔⑧箑喔夃笧喔侧赴:
1. 喔о副喔笖喔膏斧喔ム副喔?(涓绘潗) = 喔复喙堗竾喔椸傅喙堗箑喔堗箟喔侧競喔竾喙傕竸喔｀竾喔佮覆喔?(鐢叉柟) 喔曕箟喔竾喔堗副喔斷斧喔侧箒喔ム赴喔堗箞喔侧涪
2. 喔о副喔笖喔膏福喔竾/喔复喙夃笝喙€喔涏弗喔粪腑喔?(杈呮潗) = 喔复喙堗竾喔椸傅喙堗笢喔灌箟喔｀副喔氞箑喔浮喔?(涔欐柟) 喔曕箟喔竾喔堗箞喔侧涪喙€喔竾 喔箟喔侧浮喙€喔氞复喔佮笀喔侧竵喙€喔堗箟喔侧競喔竾
3. 喔勦箞喔侧笟喔｀复喔佮覆喔?喙€喔娻箞喔?喙€喔勦福喔粪箞喔竾喔堗副喔佮福 喔勦箞喔侧競喔權釜喙堗竾 喔椸傅喙堗笣喙堗覆喔⑧箖喔斷福喔编笟喔溹复喔斷笂喔笟

喔曕副喔о腑喔⑧箞喔侧竾喔о副喔笖喔膏福喔竾 (杈呮潗) 喔椸副喙堗抚喙勦笡喙冟笝喔佮覆喔｀竵喙堗腑喔福喙夃覆喔?
- 喙冟笟喔曕副喔斷箑喔弗喙囙竵, 喔ム抚喔斷箑喔娻阜喙堗腑喔? 喔權箟喔赤涪喔侧笘喔笖喙佮笟喔? 喔斷腑喔佮釜喔о箞喔侧笝 (consumable tools)
- 喙€喔娻阜喔竵, 喔曕覆喔傕箞喔侧涪, 喔溹箟喔侧箖喔?(temporary protection materials)  
- 喔曕赴喔涏腹, 喔竵喔｀腹, 喔權箟喔赤涪喔侧竵喔侧抚 (fixings & adhesives 喔赋喔福喔编笟喔囙覆喔權竵喙堗腑喔福喙夃覆喔?

喙€喔權阜喙夃腑喔覆喔副喔嵿笉喔?
---
${contractText.substring(0, 8000)}
---

喔佮福喔膏笓喔侧抚喔脆箑喔勦福喔侧赴喔箤喙佮弗喔班笗喔笟喙€喔涏箛喔?JSON:
{
  "project_name": "喔娻阜喙堗腑喙傕竸喔｀竾喔佮覆喔｀箖喔權釜喔编笉喔嵿覆",
  "owner_responsibilities": ["喔｀覆喔⑧竵喔侧福喔椸傅喙堗箑喔堗箟喔侧競喔竾喔曕箟喔竾喔堗箞喔侧涪..."],
  "contractor_responsibilities": ["喔｀覆喔⑧竵喔侧福喔椸傅喙堗笢喔灌箟喔｀副喔氞箑喔浮喔侧笗喙夃腑喔囙笀喙堗覆喔⑧箑喔竾..."],
  "auxiliary_materials": ["喔о副喔笖喔膏福喔竾喔椸傅喙堗笢喔灌箟喔｀副喔氞箑喔浮喔侧福喔编笟喔溹复喔斷笂喔笟..."],
  "rules_summary_th": "喔福喔膏笡喔佮笌喔赋喔福喔编笟喙冟笂喙夃箖喔權福喔班笟喔?(喔犩覆喔┼覆喙勦笚喔?",
  "rules_summary_cn": "鐢ㄤ簬绯荤粺鍒嗘瀽鐨勮鍒欐憳瑕侊紙涓枃锛?,
  "system_rules": "喔佮笌喔椸傅喙堗笀喔班箖喔娻箟喔佮赋喔佮副喔?AI 喙冟笝喔佮覆喔｀笗喔｀抚喔堗釜喔笟喙冟笟喙€喔福喙囙笀 喔｀赴喔氞父喔娻副喔斷箑喔堗笝喔о箞喔侧腑喔班箘喔｀笚喔掂箞喔溹腹喙夃福喔编笟喙€喔浮喔侧竸喔о福喔堗箞喔侧涪喙€喔竾"
}
喔曕腑喔?JSON 喙€喔椸箞喔侧笝喔编箟喔檂;

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
  if (!req.file) throw new S.HttpError(400,'璇蜂笂浼犲浘鐗?);

  const model = getGemini();
  const imagePart = {
    inlineData: {
      data: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype
    }
  };

  const prompt = `喔勦父喔撪箑喔涏箛喔權笢喔灌箟喔娻箞喔о涪喔箞喔侧笝喙冟笟喙€喔福喙囙笀喔佮箞喔釜喔｀箟喔侧竾喔犩覆喔┼覆喙勦笚喔?喔堗傅喔?
喔箞喔侧笝喙冟笟喙€喔福喙囙笀喙冟笝喔犩覆喔炧箒喔ム箟喔о笖喔多竾喔傕箟喔浮喔灌弗喔腑喔佮浮喔侧箑喔涏箛喔?JSON 喔斷副喔囙笝喔掂箟:
{
  "date": "喔о副喔權笚喔掂箞 (dd/mm/yyyy)",
  "invoice_no": "喙€喔ム競喔椸傅喙堗箖喔氞箑喔福喙囙笀",
  "supplier": "喔娻阜喙堗腑喔｀箟喔侧笝喔勦箟喔?喔溹腹喙夃競喔侧涪",
  "items": [
    {
      "name_th": "喔娻阜喙堗腑喔复喔權竸喙夃覆喔犩覆喔┼覆喙勦笚喔?,
      "name_cn": "喔娻阜喙堗腑喔复喔權竸喙夃覆喔犩覆喔┼覆喔堗傅喔?(喔栢箟喔侧浮喔?",
      "qty": 喔堗赋喔權抚喔權笗喔编抚喙€喔ム競,
      "unit": "喔笝喙堗抚喔?,
      "unit_price": 喔｀覆喔勦覆喔曕箞喔斧喔權箞喔о涪喔曕副喔о箑喔ム競,
      "total_price": 喔｀覆喔勦覆喔｀抚喔∴笗喔编抚喙€喔ム競
    }
  ],
  "grand_total": 喔⑧腑喔斷福喔о浮喔椸副喙夃竾喔浮喔斷笗喔编抚喙€喔ム競
}
喔曕腑喔氞箑喔涏箛喔?JSON 喙€喔椸箞喔侧笝喔编箟喔?喙勦浮喙堗笗喙夃腑喔囙浮喔掂竸喔赤腑喔樴复喔氞覆喔⑧腑喔粪箞喔檂;

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

  try {
    const data = JSON.parse(text);
    res.json({ success:true, data });
  } catch(e) {
    res.json({ success:false, message:'AI 喙勦浮喙堗釜喔侧浮喔侧福喔栢腑喙堗覆喔權箘喔斷箟', raw: text });
  }
}));

// 鈹€鈹€ POST /projects/:id/ai-analyze 鈥?AI鍏ㄩ噺鍒嗘瀽 (SSE streaming) 鈹€鈹€
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
    if (!records.length) { send('error',{message:'喙勦浮喙堗浮喔掂競喙夃腑喔∴腹喔ム箖喔氞箑喔福喙囙笀 娌℃湁鏀舵嵁鏁版嵁'}); res.end(); return; }

    send('status',{message:`喔佮赋喔ム副喔囙抚喔脆箑喔勦福喔侧赴喔箤 ${records.length} 喔｀覆喔⑧竵喔侧福 / 姝ｅ湪鍒嗘瀽 ${records.length} 鏉?..`});

    const boqRows = req.body.boq || [];
    const customRules = projR.rows[0]?.ai_rules || '';
    const prices = pbR.rows;

    const SYSTEM_RULES = `
=== 喔佮笌喔佮覆喔｀笗喔｀抚喔堗釜喔笟 / 鏍稿疄瑙勫垯 ===

喔? 喔复喙堗竾喔椸傅喙堗笢喔灌箟喔｀副喔氞箑喔浮喔?(喔澿箞喔侧涪喔佮箞喔釜喔｀箟喔侧竾) 喔曕箟喔竾喔堗箞喔侧涪喙€喔竾 喔箟喔侧浮喙€喔氞复喔佮笀喔侧竵喙€喔堗箟喔侧競喔竾 / 涔欐柟鑷礋锛屼笉搴斿悜鐢叉柟鎶ラ攢:
- 喔勦箞喔侧箑喔娻箞喔侧箑喔勦福喔粪箞喔竾喔堗副喔佮福: 喙佮笟喔勦箓喔? 喙€喔勦福喔? 喔｀笘喔氞福喔｀笚喔膏竵 / 鏈烘绉熻祦锛氭寲鏈恒€佸悐杞︺€佸崱杞? 
- 喔о副喔笖喔膏釜喔脆箟喔權箑喔涏弗喔粪腑喔? 喙冟笟喔曕副喔斷箑喔弗喙囙竵, 喔ム抚喔斷箑喔娻阜喙堗腑喔? 喔權箟喔赤涪喔侧笘喔笖喙佮笟喔? 喔斷腑喔佮釜喔о箞喔侧笝 / 娑堣€楀搧锛氬垏鍓茬墖銆佺剨鏉°€佽劚妯″墏銆侀捇澶?
- 喔氞福喔脆竵喔侧福喔佮赋喔堗副喔斷笡喔ム抚喔?喙佮浮喔ム竾 / 鐏櫕鏈嶅姟
- 喔曕箟喔權笚喔膏笝喔佮覆喔｀笖喔赤箑喔權复喔權竾喔侧笝喔阜喙堗笝喔傕腑喔囙笢喔灌箟喔｀副喔氞箑喔浮喔?/ 鍏朵粬鎵垮寘鏂硅繍钀ユ垚鏈?

喔? 喔曕福喔о笀喔堗副喔氞箖喔氞箑喔福喙囙笀喔嬥箟喔?(喔赋喔勦副喔嵿浮喔侧竵): 
- "duplicate" 喔勦阜喔?Invoice_No 喙€喔斷傅喔⑧抚喔佮副喔?+ 喔娻阜喙堗腑喔复喔權竸喙夃覆喙€喔斷傅喔⑧抚喔佮副喔?+ 喔｀覆喔勦覆喙€喔斷傅喔⑧抚喔佮副喔?鈫?喔氞副喔權笚喔多竵喔嬥箟喔?2 喔勦福喔编箟喔?喔曕箟喔竾喔曕福喔о笀喔腑喔?
- 喔栢箟喔?Invoice_No 喙€喔斷傅喔⑧抚喔佮副喔?喙佮笗喙堗笂喔粪箞喔釜喔脆笝喔勦箟喔侧笗喙堗覆喔囙竵喔编笝 = 喔涏竵喔曕复 (喙冟笟喙€喔福喙囙笀喙冟笟喙€喔斷傅喔⑧抚喔∴傅喔弗喔侧涪喔｀覆喔⑧竵喔侧福)
- 喔栢箟喔?Invoice_No 喔曕箞喔侧竾喔佮副喔?喙佮笗喙堗笅喔粪箟喔釜喔脆笝喔勦箟喔侧笂喔權复喔斷箑喔斷傅喔⑧抚喔佮副喔?= 喔涏竵喔曕复 (喔嬥阜喙夃腑喔嬥箟喔赤箖喔權竸喔｀副喙夃竾喔曕箞喔侧竾喔佮副喔?
- 喔涪喙堗覆喔曕福喔о笀喔堗副喔氞抚喙堗覆喔嬥箟喔赤箑喔炧福喔侧赴 Invoice_No 喙€喔浮喔粪腑喔權竵喔编笝喔涪喙堗覆喔囙箑喔斷傅喔⑧抚 喔曕箟喔竾喔斷腹喔椸副喙夃竾喔娻阜喙堗腑喔复喔權竸喙夃覆喙佮弗喔班福喔侧竸喔侧笖喙夃抚喔?
閲嶅鍒ゆ柇锛氱浉鍚孖nvoice鍙?+ 鐩稿悓鍝佸悕 + 鐩稿悓閲戦 = 鏁版嵁閲嶅褰曞叆銆傜浉鍚孖nvoice鍙蜂絾涓嶅悓鍝佸悕 = 姝ｅ父澶氳鍙戠エ銆?

喔? 喔｀覆喔勦覆喔溹复喔斷笡喔佮笗喔? 喔腹喔囙竵喔о箞喔侧福喔侧竸喔侧箑喔夃弗喔掂箞喔⑧浮喔侧竵喔佮抚喙堗覆 10% / 浠锋牸瓒呭潎浠?0%浠ヤ笂
${customRules ? '\n=== 喔佮笌喙€喔炧复喙堗浮喙€喔曕复喔?/ 闄勫姞瑙勫垯 ===\n' + customRules : ''}`;

    const PRICE_CONTEXT = prices.length ?
      `\n=== 喔｀覆喔勦覆喔箟喔侧竾喔复喔?/ 鍙傝€冧环鏍?===\n${prices.map(p=>`${p.item_name_cn} (${p.unit}): 喙€喔夃弗喔掂箞喔?喔?{p.avg_price}, Min 喔?{p.min_price}, Max 喔?{p.max_price}`).join('\n')}` : '';

    const BOQ_CONTEXT = boqRows.length ?
      `\n=== BOQ 喔囙笟喔涏福喔班浮喔侧笓 / 棰勭畻 (${boqRows.length} 喔｀覆喔⑧竵喔侧福) ===\n${boqRows.slice(0,60).map(b=>`${b.Description} | ${b.Category} | ${b.Quantity} ${b.Unit} | 喔?{b.Supply_Unit_Price}/unit | Total 喔?{b.Total_Amount}`).join('\n')}` : '';

    const RECORDS_TEXT = records.map(r =>
      `[${r.id}] ${r.purchase_date ? String(r.purchase_date).slice(0,10) : ''} | INV:${r.invoice_no||'-'} | ${r.supplier_name||''} | ${r.item_name_th||''} ${r.item_name_cn||''} | Qty:${r.qty} ${r.unit} | Unit:喔?{r.unit_price} | Total:喔?{r.total_price}`
    ).join('\n');

    const prompt = `${SYSTEM_RULES}${PRICE_CONTEXT}${BOQ_CONTEXT}

=== 喙冟笟喙€喔福喙囙笀喔椸副喙夃竾喔浮喔?/ 鎵€鏈夋敹鎹?(${records.length} 喔｀覆喔⑧竵喔侧福) ===
${RECORDS_TEXT}

=== 喔勦赋喔副喙堗竾 / 鎸囦护 ===
喔о复喙€喔勦福喔侧赴喔箤喔椸父喔佮福喔侧涪喔佮覆喔｀笗喔侧浮喔佮笌喔傕箟喔侧竾喔曕箟喔?喔曕腑喔氞箑喔涏箛喔?JSON array 喙€喔椸箞喔侧笝喔编箟喔?(喔箟喔侧浮喔∴傅喔傕箟喔竸喔о覆喔∴腑喔粪箞喔?:
[
  {
    "id": <id>,
    "flags": [],
    "status": "normal"|"deduct"|"duplicate"|"price_high"|"price_low",
    "boq_match": "喔娻阜喙堗腑 BOQ 喔椸傅喙堗笗喔｀竾喔福喔粪腑 null",
    "boq_confidence": 0-100,
    "reason_th": "喔福喔膏笡喔副喙夃笝喙?喔犩覆喔┼覆喙勦笚喔?,
    "reason_cn": "绠€鐭鏄庯紙涓枃锛?,
    "contract_clause": "喔浮喔侧涪喙€喔ム競喔傕箟喔釜喔编笉喔嵿覆喔椸傅喙堗箑喔佮傅喙堗涪喔о競喙夃腑喔?喙€喔娻箞喔?喔傕箟喔?5.2 (喙€喔夃笧喔侧赴喔｀覆喔⑧竵喔侧福喔椸傅喙堗浮喔?flag deduct)",
    "clause_text": "喔傕箟喔竸喔о覆喔∴箖喔權釜喔编笉喔嵿覆喔椸傅喙堗箑喔佮傅喙堗涪喔о競喙夃腑喔囙箓喔斷涪喔曕福喔?(喔勦副喔斷弗喔竵喔堗覆喔佮釜喔编笉喔嵿覆喔椸傅喙堗箒喔權笟喔∴覆 喔福喔粪腑 null 喔栢箟喔侧箘喔∴箞喔∴傅喔副喔嵿笉喔?",
    "explanation_th": "喔勦赋喔笜喔脆笟喔侧涪喙€喔涏箛喔權浮喔粪腑喔覆喔娻傅喔炧抚喙堗覆喔椸赋喙勦浮喔｀覆喔⑧竵喔侧福喔權傅喙夃笘喔多竾喙€喔涏箛喔權竸喔о覆喔∴福喔编笟喔溹复喔斷笂喔笟喔傕腑喔囙笢喔灌箟喔｀副喔氞箑喔浮喔?喔箟喔侧竾喔复喔囙釜喔编笉喔嵿覆 喔權箟喔赤箑喔傅喔⑧竾喙€喔涏箛喔權竵喔ム覆喔囙箒喔ム赴喙€喔傕箟喔侧箖喔堗竾喙堗覆喔?喙勦浮喙堗竵喔ム箞喔侧抚喔覆 喙€喔炧阜喙堗腑喙冟斧喙夃笢喔灌箟喔｀副喔氞箑喔浮喔侧箑喔傕箟喔侧箖喔堗箑喔笗喔膏笢喔ム箒喔ム赴喔⑧腑喔∴福喔编笟",
    "explanation_cn": "涓撲笟涓珛鐨勮鏄庯細姝ら」涓轰綍灞炰箼鏂硅矗浠伙紝寮曠敤鍚堝悓鏉℃锛岃姘斿瑙備笓涓氾紝甯姪涔欐柟鐞嗚В鑰岄潪鎸囪矗锛岃鍙屾柟杈炬垚鍏辫瘑"
  }
]
喔浮喔侧涪喙€喔笗喔膏釜喔赤竸喔编笉:
- contract_clause 喙佮弗喔?clause_text 喔曕箟喔竾喔∴傅喙€喔夃笧喔侧赴喔｀覆喔⑧竵喔侧福喔椸傅喙堗浮喔?"deduct" 喙冟笝 flags
- explanation 喔曕箟喔竾喔箟喔侧竾喔复喔囙釜喔编笉喔嵿覆 喙勦浮喙堗箖喔娻箞喙佮竸喙堗笟喔竵喔о箞喔侧笢喔脆笖
- 喔赋喔福喔编笟喔｀覆喔⑧竵喔侧福 normal 喙勦浮喙堗笗喙夃腑喔囙浮喔?contract_clause, clause_text, explanation
- 喔曕腑喔?JSON 喙€喔椸箞喔侧笝喔编箟喔?喔箟喔侧浮 markdown code block`;

    send('status',{message:'AI 喔佮赋喔ム副喔囙笡喔｀赴喔∴抚喔ム笢喔?.. / AI姝ｅ湪鎺ㄧ悊...'});

    const model = getGemini();
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

    send('status',{message:'喔佮赋喔ム副喔囙笡喔｀赴喔∴抚喔ム笢喔ム笢喔ム弗喔编笧喔樴箤... / 姝ｅ湪澶勭悊缁撴灉...'});

    try {
      const analysis = JSON.parse(text);
      // Attach analysis to records for frontend
      const analysisMap = {};
      analysis.forEach(a => { analysisMap[a.id] = a; });
      const enriched = records.map(r => ({ ...r, ai: analysisMap[r.id] || { flags:[], status:'normal', reason_th:'喙勦浮喙堗箘喔斷箟喔о复喙€喔勦福喔侧赴喔箤', reason_cn:'鏈垎鏋? } }));
      send('result',{ records: enriched, total: records.length, analyzed: analysis.length });
    } catch(e) {
      send('error',{ message:'喙佮涪喔?JSON 喙勦浮喙堗箘喔斷箟 / 瑙ｆ瀽澶辫触: '+text.slice(0,300) });
    }
  } catch(e) {
    send('error',{ message: e.message });
  }
  res.end();
}));

module.exports = router;

// GET /projects/:projectId/ai-rules 鈥?鑾峰彇椤圭洰AI瑙勫垯
router.get('/projects/:projectId/ai-rules', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const r = await pool.query('SELECT ai_rules FROM projects WHERE id=$1', [req.params.projectId]);
  res.json({ success: true, data: { rules: r.rows[0]?.ai_rules || '' } });
}));

// PUT /projects/:projectId/ai-rules 鈥?淇濆瓨椤圭洰AI瑙勫垯
router.put('/projects/:projectId/ai-rules', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async (req, res) => {
  const { rules } = req.body;
  // Add ai_rules column if not exists
  await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_rules TEXT');
  await pool.query('UPDATE projects SET ai_rules=$1 WHERE id=$2', [rules, req.params.projectId]);
  res.json({ success: true });
}));

// POST /projects/:projectId/ai-analyze 鈥?AI鍒嗘瀽閲囪喘鍗曟嵁 (SSE streaming)
router.post('/projects/:projectId/ai-analyze', authenticate, requireProjectAccess(), wrap(async (req, res) => {
  const projectId = req.params.projectId;

  // Set SSE headers for real-time streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Load purchase records
    const pr = await pool.query(
      `SELECT * FROM purchase_records WHERE project_id=$1 ORDER BY purchase_date ASC, id ASC`,
      [projectId]);
    const records = pr.rows;

    if (!records.length) {
      send('error', { message: '喙勦浮喙堗浮喔掂競喙夃腑喔∴腹喔ム箖喔氞箑喔福喙囙笀 娌℃湁鏀舵嵁鏁版嵁' });
      res.end(); return;
    }

    send('status', { message: `喔佮赋喔ム副喔囙抚喔脆箑喔勦福喔侧赴喔箤 ${records.length} 喔｀覆喔⑧竵喔侧福... / 姝ｅ湪鍒嗘瀽 ${records.length} 鏉¤褰?..` });

    // Load BOQ
    const boqRows = req.body.boq || [];  // BOQ passed from frontend

    // Load project AI rules
    await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_rules TEXT');
    const projR = await pool.query('SELECT ai_rules FROM projects WHERE id=$1', [projectId]);
    const customRules = projR.rows[0]?.ai_rules || '';

    // Load price benchmarks
    const pbR = await pool.query('SELECT item_name_cn, unit, avg_price, min_price, max_price FROM price_benchmarks ORDER BY sample_count DESC');
    const prices = pbR.rows;

    // Build AI prompt
    const defaultRules = `
=== 喔佮笌喔佮覆喔｀笗喔｀抚喔堗釜喔笟 / 鏍稿疄瑙勫垯 ===

喔佮笌 A 鈥?喔复喙堗竾喔椸傅喙堗笢喔灌箟喔｀副喔氞箑喔浮喔侧笗喙夃腑喔囙福喔编笟喔溹复喔斷笂喔笟喙€喔竾 (喙勦浮喙堗竸喔о福喙€喔氞复喔佮笀喔侧竵喙€喔堗箟喔侧競喔竾) / 涔欐柟锛堟壙鍖呮柟锛夎嚜璐熼」鐩紙涓嶅簲鍚戠敳鏂规姤閿€锛?
- 喔勦箞喔侧箑喔娻箞喔侧箑喔勦福喔粪箞喔竾喔堗副喔佮福: 喔｀笘喙佮笟喔勦箓喔? 喔｀笘喙€喔勦福喔? 喔｀笘喔氞福喔｀笚喔膏竵 / 鏈烘绉熻祦锛氭寲鏈恒€佸悐杞︺€佸崱杞?
- 喔о副喔笖喔膏釜喔脆箟喔權箑喔涏弗喔粪腑喔? 喙冟笟喔曕副喔斷箑喔弗喙囙竵, 喔ム抚喔斷箑喔娻阜喙堗腑喔? 喔權箟喔赤涪喔侧笘喔笖喙佮笟喔? 喔斷腑喔佮釜喔о箞喔侧笝 / 娑堣€楀搧锛氬垏鍓茬墖銆佺剨鏉°€佽劚妯″墏
- 喔氞福喔脆竵喔侧福喔佮赋喔堗副喔斷箒喔∴弗喔?/ 鐏櫕鏈嶅姟
- 喔阜喙堗笝喙?喔椸傅喙堗箑喔涏箛喔權笗喙夃笝喔椸父喔權竵喔侧福喔斷赋喙€喔權复喔權竾喔侧笝喔傕腑喔囙笢喔灌箟喔｀副喔氞箑喔浮喔?/ 鍏朵粬鎵垮寘鏂硅繍钀ユ垚鏈?

喔佮笌 B 鈥?喔曕福喔о笀喔覆喙冟笟喙€喔福喙囙笀喔嬥箟喔? 喔栢箟喔?Invoice_No 喙€喔浮喔粪腑喔權竵喔编笝喔弗喔侧涪喔｀覆喔⑧竵喔侧福 喙冟斧喙夃箒喔堗箟喔囙箑喔曕阜喔笝 / 閲嶅鍙戠エ妫€娴?

喔佮笌 C 鈥?喔｀覆喔勦覆喔溹复喔斷笡喔佮笗喔? 喔栢箟喔侧福喔侧竸喔侧釜喔灌竾喔佮抚喙堗覆喔｀覆喔勦覆喙€喔夃弗喔掂箞喔⑧浮喔侧竵喔佮抚喙堗覆 10% / 浠锋牸瓒呭潎浠?0%浠ヤ笂闇€鏍囪
`;

    const prompt = `${defaultRules}

${customRules ? '=== 喔佮笌喙€喔炧复喙堗浮喙€喔曕复喔∴競喔竾喙傕竸喔｀竾喔佮覆喔?/ 椤圭洰鑷畾涔夎鍒?===\n' + customRules : ''}

=== 喔｀覆喔勦覆喔箟喔侧竾喔复喔?/ 鍙傝€冧环鏍?===
${prices.slice(0, 20).map(p => `${p.item_name_cn} (${p.unit}): 喙€喔夃弗喔掂箞喔?鍧囦环 喔?{p.avg_price}, 喔曕箞喔赤釜喔膏笖/鏈€浣?喔?{p.min_price}, 喔腹喔囙釜喔膏笖/鏈€楂?喔?{p.max_price}`).join('\n')}

${boqRows.length ? `=== BOQ 喔囙笟喔涏福喔班浮喔侧笓 / 棰勭畻 ===
${boqRows.slice(0, 50).map(b => `${b.Description} (${b.Category}): ${b.Quantity} ${b.Unit} 脳 喔?{b.Supply_Unit_Price} = 喔?{b.Total_Amount}`).join('\n')}` : ''}

=== 喙冟笟喙€喔福喙囙笀喔椸傅喙堗笗喙夃腑喔囙抚喔脆箑喔勦福喔侧赴喔箤 / 闇€瑕佸垎鏋愮殑鏀舵嵁 ===
${records.map(r => `[${r.id}] ${r.purchase_date||''} | Invoice: ${r.invoice_no||'-'} | 喔溹腹喙夃競喔侧涪: ${r.supplier_name||''} | 喔｀覆喔⑧竵喔侧福: ${r.item_name_th||''} ${r.item_name_cn||''} | ${r.qty} ${r.unit} | 喔?{r.unit_price}/喔笝喙堗抚喔?| 喔｀抚喔? 喔?{r.total_price}`).join('\n')}

=== 喔勦赋喔副喙堗竾 / 鎸囦护 ===
喔о复喙€喔勦福喔侧赴喔箤喔椸父喔佮福喔侧涪喔佮覆喔｀競喙夃覆喔囙笗喙夃笝 喔曕腑喔氞箑喔涏箛喔?JSON array 喙€喔椸箞喔侧笝喔编箟喔?喔箟喔侧浮喔∴傅喔傕箟喔竸喔о覆喔∴腑喔粪箞喔?
[
  {
    "id": <id 喔堗覆喔佮福喔侧涪喔佮覆喔?,
    "status": "normal" | "deduct" | "duplicate" | "price_high" | "price_low",
    "flags": ["deduct", "duplicate", ...],  
    "boq_match": "喔娻阜喙堗腑喔｀覆喔⑧竵喔侧福 BOQ 喔椸傅喙堗笗喔｀竾喔佮副喔?喔福喔粪腑 null",
    "boq_confidence": 0-100,
    "reason_th": "喙€喔笗喔膏笢喔ム釜喔编箟喔權箚 喙€喔涏箛喔權笭喔侧俯喔侧箘喔椸涪",
    "reason_cn": "绠€鐭悊鐢憋紙涓枃锛?,
    "deduct_reason": "喙€喔笗喔膏笢喔ム斧喔编竵喔勦阜喔?(喔栢箟喔侧浮喔? / 鎵ｅ洖鍘熷洜锛堝鏈夛級"
  }
]
喔曕腑喔?JSON 喙€喔椸箞喔侧笝喔编箟喔?喙勦浮喙堗笗喙夃腑喔囙浮喔?markdown code block`;

    send('status', { message: '喔佮赋喔ム副喔囙釜喙堗竾喔傕箟喔浮喔灌弗喙冟斧喙?AI... / 姝ｅ湪璋冪敤AI...' });

    const client = getAIClient();
    let fullResponse = '';

    const stream = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'tngtech/deepseek-r1t2-chimera:free',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: 4000
    });

    send('status', { message: 'AI 喔佮赋喔ム副喔囙抚喔脆箑喔勦福喔侧赴喔箤... / AI姝ｅ湪鍒嗘瀽...' });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullResponse += delta;
        send('chunk', { text: delta });
      }
    }

    // Parse AI response
    try {
      const jsonStr = fullResponse.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      const results = JSON.parse(jsonStr);
      send('result', { analysis: results, total: records.length });
    } catch(e) {
      send('error', { message: 'AI 喔曕腑喔氞竵喔ム副喔氞箘喔∴箞喔栢腹喔佮福喔灌笡喙佮笟喔? ' + fullResponse.slice(0, 200) });
    }

  } catch(e) {
    send('error', { message: e.message });
  }
  res.end();
}));


// -- GET /projects/:id/deduction-agreements --
router.get('/projects/:projectId/deduction-agreements', authenticate, requireProjectAccess(), wrap(async(req,res)=>{
  const r = await pool.query('SELECT invoice_no, item_name_cn FROM deduction_agreements WHERE project_id=$1',[req.params.projectId]);
  res.json({success:true, data:r.rows});
}));

// -- POST /projects/:id/deduction-agreements --
router.post('/projects/:projectId/deduction-agreements', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async(req,res)=>{
  const {invoice_no, item_name_cn, notes} = req.body;
  await pool.query('INSERT INTO deduction_agreements (project_id, invoice_no, item_name_cn, agreed_by, notes) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (project_id,invoice_no,item_name_cn) DO UPDATE SET agreed_at=CURRENT_TIMESTAMP, agreed_by=$4, notes=$5',[req.params.projectId, invoice_no, item_name_cn, req.user.id, notes||null]);
  res.json({success:true});
}));

// -- DELETE /projects/:id/deduction-agreements --
router.delete('/projects/:projectId/deduction-agreements', authenticate, requireProjectAccess(), requirePermission('manage_projects'), wrap(async(req,res)=>{
  const {invoice_no, item_name_cn} = req.body;
  await pool.query('DELETE FROM deduction_agreements WHERE project_id=$1 AND invoice_no=$2 AND item_name_cn=$3',[req.params.projectId, invoice_no, item_name_cn]);
  res.json({success:true});
}));
module.exports = router;