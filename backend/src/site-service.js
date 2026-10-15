// 现场安排的服务层：项目申请表 → 生成计划 → 写入工序表；现场看板；提前开始的把关与通知。
// 数据库里已有的工序表 (process_nodes / process_execution / process_dependencies) 继续沿用，
// 由总库生成的工序用 master_code 和 floor_no 标记。

const { LIB, DEFAULT_PROFILE, generatePlan, normalizeProfile, analyze, SECTIONS } = require('./process-master');
const { advise, canStart, forceStart, describeReason } = require('./advisor');
const { workingDayIndex, todayInBangkok } = require('./work-calendar');

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || {}; }
}

// 工种名称（泰文请当地人核对）
const TRADES = {
  mach: { zh: '机械', th: 'เครื่องจักร' },
  scaffold: { zh: '架子工', th: 'ช่างนั่งร้าน' },
  rebar: { zh: '钢筋工', th: 'ช่างเหล็ก' },
  carpenter: { zh: '木工', th: 'ช่างไม้' },
  concrete: { zh: '混凝土工', th: 'ช่างคอนกรีต' },
  mason: { zh: '瓦工/抹灰', th: 'ช่างปูน' },
  tiler: { zh: '贴砖工', th: 'ช่างปูกระเบื้อง' },
  waterproof: { zh: '防水工', th: 'ช่างกันซึม' },
  plumber: { zh: '水工', th: 'ช่างประปา' },
  electrician: { zh: '电工', th: 'ช่างไฟฟ้า' },
  painter: { zh: '油漆工', th: 'ช่างทาสี' },
  installer: { zh: '安装工', th: 'ช่างติดตั้ง' },
  general: { zh: '普工/杂工', th: 'คนงานทั่วไป' },
  roof: { zh: '屋面工', th: 'ช่างหลังคา' },
  ceiling: { zh: '吊顶工', th: 'ช่างฝ้าเพดาน' },
  aluminum: { zh: '铝门窗/玻璃工', th: 'ช่างอลูมิเนียมและกระจก' },
  aircon: { zh: '空调工', th: 'ช่างแอร์' },
  welder: { zh: '焊工/铁工', th: 'ช่างเชื่อม' },
  pool: { zh: '泳池工', th: 'ช่างสระว่ายน้ำ' },
  landscape: { zh: '园林工', th: 'ช่างจัดสวน' }
};

const DEP_FROM_DB = { finish_to_start: 'FS', start_to_start: 'SS' };
const DEP_TO_DB = { FS: 'finish_to_start', SS: 'start_to_start' };

const keyOfRow = r => (r.floor_no != null ? `${r.master_code}@${r.floor_no}` : r.master_code);
const isTouched = r => r.status !== 'not_started' || Number(r.completion_percentage || 0) > 0;

// ================= 项目申请表 =================
async function getProfile(client, projectId) {
  const r = await client.query(
    `SELECT answers, to_char(plan_generated_at, 'YYYY-MM-DD HH24:MI') AS plan_generated_at
       FROM project_profiles WHERE project_id = $1`, [projectId]);
  return r.rows[0] || null;
}

async function saveProfile(client, projectId, answers, userId) {
  generatePlan(answers);       // 先试生成一次，答案不合法（比如层数超范围）就在这里报错，不落库
  await client.query(
    `INSERT INTO project_profiles (project_id, answers, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (project_id) DO UPDATE SET answers = EXCLUDED.answers, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
    [projectId, JSON.stringify(answers), userId]);
}

// ================= 生成计划：预览与应用 =================
async function existingNodes(client, projectId) {
  const r = await client.query(
    `SELECT pn.id AS node_id, pn.process_code, pn.master_code, pn.floor_no, pe.id AS exec_id, pe.status, pe.completion_percentage
       FROM process_nodes pn LEFT JOIN process_execution pe ON pe.process_node_id = pn.id
      WHERE pn.project_id = $1`, [projectId]);
  return r.rows;
}

async function previewPlan(client, projectId, answers) {
  const plan = generatePlan(answers);
  const a = analyze(plan);
  const rows = await existingNodes(client, projectId);
  const legacy = rows.filter(r => !r.master_code);
  const gen = rows.filter(r => r.master_code);
  const have = new Set(gen.map(keyOfRow));
  const want = new Set(plan.tasks.map(t => t.key));
  const bySection = {};
  plan.tasks.forEach(t => { bySection[t.section] = (bySection[t.section] || 0) + 1; });
  return {
    summary: {
      processes: new Set(plan.tasks.map(t => t.code)).size, tasks: plan.tasks.length, deps: plan.deps.length,
      floors: plan.profile.floorCount, longestChain: a.maxLevel + 1
    },
    bySection: Object.keys(SECTIONS).map(s => ({ section: s, zh: SECTIONS[s].zh, tasks: bySection[s] || 0 })),
    excluded: plan.excluded.map(c => ({ code: c, zh: LIB[c].zh })),
    existing: { legacy: legacy.length, legacyTouched: legacy.filter(isTouched).length, generated: gen.length },
    willAdd: plan.tasks.filter(t => !have.has(t.key)).length,
    willRemove: gen.filter(r => !want.has(keyOfRow(r)) && !isTouched(r)).length,
    willKeepStarted: gen.filter(r => !want.has(keyOfRow(r)) && isTouched(r)).map(keyOfRow),
    tasks: plan.tasks.map(t => ({ key: t.key, code: t.code, floor: t.floor, zh: t.zh, unit: t.unit, section: t.section }))
  };
}

// 调用者负责事务。legacy: 'replace' 删除旧的（未开始的）固定模板工序；'keep' 保留。
async function applyPlan(client, projectId, answers, opts) {
  const o = Object.assign({ legacy: null }, opts || {});
  const plan = generatePlan(answers);
  const a = analyze(plan);
  const rows = await existingNodes(client, projectId);
  const legacy = rows.filter(r => !r.master_code);
  const gen = rows.filter(r => r.master_code);

  let legacyRemoved = 0;
  if (legacy.length) {
    if (!o.legacy) throw new HttpError(409, '这个项目里已有旧的固定工序，请选择替换或保留', { code: 'LEGACY_CHOICE', legacy: legacy.length });
    if (o.legacy === 'replace') {
      const touched = legacy.filter(isTouched);
      if (touched.length) {
        throw new HttpError(409, `有 ${touched.length} 个旧工序已经开始或有进度，不能替换。请选择保留，或先处理这些工序`,
          { code: 'LEGACY_TOUCHED', codes: touched.map(r => r.process_code) });
      }
      await client.query('DELETE FROM process_nodes WHERE id = ANY($1::int[])', [legacy.map(r => r.node_id)]);
      legacyRemoved = legacy.length;
    }
  }

  // 已经由总库生成过的：保留还在计划里的，删掉不在计划里且没动过的，动过的保留并提示
  const want = new Map(plan.tasks.map(t => [t.key, t]));
  const haveByKey = new Map(gen.map(r => [keyOfRow(r), r]));
  const toRemove = gen.filter(r => !want.has(keyOfRow(r)) && !isTouched(r));
  const keptStarted = gen.filter(r => !want.has(keyOfRow(r)) && isTouched(r)).map(keyOfRow);
  if (toRemove.length) await client.query('DELETE FROM process_nodes WHERE id = ANY($1::int[])', [toRemove.map(r => r.node_id)]);

  // 新增：按先后层级排序，序号就是大致的施工顺序
  const order = plan.tasks.slice().sort((x, y) =>
    (a.level.get(x.key) - a.level.get(y.key)) || ((x.floor || 0) - (y.floor || 0)) || x.code.localeCompare(y.code));
  const seq = new Map(order.map((t, i) => [t.key, i + 1]));
  const execByKey = new Map();
  gen.forEach(r => { if (want.has(keyOfRow(r))) execByKey.set(keyOfRow(r), r.exec_id); });

  let added = 0;
  for (const t of order) {
    if (haveByKey.has(t.key)) {
      await client.query('UPDATE process_nodes SET sequence_number = $1 WHERE id = $2', [seq.get(t.key), haveByKey.get(t.key).node_id]);
      continue;
    }
    const nameZh = t.zh + (t.floor != null ? ` · ${t.floor}层` : '');
    const nameTh = t.th ? t.th + (t.floor != null ? ` · Floor ${t.floor}` : '') : '';
    const n = await client.query(
      `INSERT INTO process_nodes (project_id, process_code, process_name, sequence_number, master_code, floor_no)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6) RETURNING id`,
      [projectId, t.key, JSON.stringify({ zh: nameZh, th: nameTh }), seq.get(t.key), t.code, t.floor]);
    const e = await client.query(
      `INSERT INTO process_execution (process_node_id, status, quantity_unit) VALUES ($1, 'not_started', $2) RETURNING id`,
      [n.rows[0].id, t.unit]);
    execByKey.set(t.key, e.rows[0].id);
    added++;
  }

  // 重建这些工序之间的先后关系
  const ids = Array.from(execByKey.values());
  await client.query('DELETE FROM process_dependencies WHERE process_execution_id = ANY($1::int[]) AND depends_on_process_id = ANY($1::int[])', [ids]);
  for (const d of plan.deps) {
    await client.query(
      `INSERT INTO process_dependencies (process_execution_id, depends_on_process_id, dependency_type, lag_days, min_progress)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (process_execution_id, depends_on_process_id) DO NOTHING`,
      [execByKey.get(d.to), execByKey.get(d.from), DEP_TO_DB[d.type], d.lag, d.min]);
  }

  await client.query(
    `INSERT INTO project_profiles (project_id, answers, plan_generated_at) VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (project_id) DO UPDATE SET plan_generated_at = CURRENT_TIMESTAMP`,
    [projectId, JSON.stringify(answers)]);

  return { added, removed: toRemove.length, legacyRemoved, keptStarted, deps: plan.deps.length, tasks: plan.tasks.length };
}

// ================= 读取现状：计划 + 实际进度 =================
async function loadPlanState(client, projectId, dateISO) {
  const proj = await client.query(`SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start_iso FROM projects WHERE id = $1`, [projectId]);
  if (!proj.rows.length) throw new HttpError(404, '项目不存在');
  const prof = await getProfile(client, projectId);
  const rows = (await client.query(
    `SELECT pn.id AS node_id, pn.process_code, pn.process_name, pn.master_code, pn.floor_no,
            pe.id AS exec_id, pe.status, pe.completion_percentage, pe.planned_quantity, pe.quantity_unit,
            to_char(pe.actual_start_date, 'YYYY-MM-DD') AS start_iso, to_char(pe.actual_end_date, 'YYYY-MM-DD') AS end_iso
       FROM process_nodes pn JOIN process_execution pe ON pe.process_node_id = pn.id
      WHERE pn.project_id = $1 AND pn.master_code IS NOT NULL`, [projectId])).rows;
  if (!rows.length) return { planned: false };

  const profile = normalizeProfile(prof ? prof.answers : {});
  const today = dateISO || todayInBangkok();
  let startISO = proj.rows[0].start_iso;
  if (!startISO) startISO = rows.map(r => r.start_iso).filter(Boolean).sort()[0] || today;
  const todayIdx = Math.max(1, workingDayIndex(startISO, today));

  const tasks = rows.map(r => {
    const lib = LIB[r.master_code];
    return { key: keyOfRow(r), code: r.master_code, floor: r.floor_no, zh: lib ? lib.zh : r.process_code, th: lib ? lib.th : null, unit: lib ? lib.unit : r.quantity_unit, section: lib ? lib.sec : null };
  });
  const keyByExec = new Map(rows.map(r => [r.exec_id, keyOfRow(r)]));
  const execByKey = new Map(rows.map(r => [keyOfRow(r), r.exec_id]));
  const ids = rows.map(r => r.exec_id);
  const dr = (await client.query(
    `SELECT process_execution_id AS to_id, depends_on_process_id AS from_id, dependency_type, lag_days, min_progress
       FROM process_dependencies WHERE process_execution_id = ANY($1::int[]) AND depends_on_process_id = ANY($1::int[])`, [ids])).rows;
  const deps = dr.map(d => ({
    from: keyByExec.get(d.from_id), to: keyByExec.get(d.to_id),
    type: DEP_FROM_DB[d.dependency_type] || 'FS', lag: d.lag_days || 0, min: d.min_progress || 0
  }));
  const plan = { profile, tasks, deps };

  // 实际进度
  const needHistory = deps.some(d => d.type === 'SS' && d.lag > 0);
  let history = new Map();
  if (needHistory) {
    const h = await client.query(
      `SELECT process_execution_id AS id, to_char(date, 'YYYY-MM-DD') AS d, completion_percentage AS pct
         FROM daily_progress WHERE process_execution_id = ANY($1::int[]) ORDER BY date`, [ids]);
    h.rows.forEach(x => { (history.get(x.id) || history.set(x.id, []).get(x.id)).push(x); });
  }
  const mins = Array.from(new Set(deps.filter(d => d.type === 'SS').map(d => d.min)));
  const stateTasks = {}, quantities = {};
  rows.forEach(r => {
    const key = keyOfRow(r);
    if (Number(r.planned_quantity) > 0) quantities[key] = Number(r.planned_quantity);
    const pct = Math.min(100, Math.max(0, Number(r.completion_percentage) || 0));
    if (r.status === 'not_started') return;
    if (r.status === 'completed') {
      stateTasks[key] = { status: 'completed', progress: 1, finishedDay: r.end_iso ? workingDayIndex(startISO, r.end_iso) : todayIdx - 1 };
    } else {
      stateTasks[key] = { status: 'in_progress', progress: pct / 100, workStatus: r.status };
    }
    if (needHistory && history.has(r.exec_id)) {
      const reachedDay = {};
      mins.forEach(m => {
        const hit = history.get(r.exec_id).find(x => Number(x.pct) >= m);
        if (hit) reachedDay[m] = workingDayIndex(startISO, hit.d);
      });
      stateTasks[key].reachedDay = reachedDay;
    }
  });

  return { planned: true, plan, rows, keyByExec, execByKey, quantities, state: { today: todayIdx, tasks: stateTasks }, startISO, todayISO: today, answers: prof ? prof.answers : {} };
}

const labelOf = (plan, key) => {
  const t = plan.tasks.find(x => x.key === key);
  return t.zh + (t.floor != null ? `（${t.floor}层）` : '');
};

// ================= 现场看板 =================
async function buildBoard(client, projectId, dateISO) {
  const L = await loadPlanState(client, projectId, dateISO);
  if (!L.planned) return { planned: false };

  const members = (await client.query(
    `SELECT worker_id, name, level, skills, role FROM workers WHERE project_id = $1 AND status = 'active' ORDER BY worker_id`, [projectId])).rows
    .map(w => {
      const level = w.level === 'skilled' ? 'skilled' : 'helper';
      let skills = Array.isArray(w.skills) ? w.skills : [];
      if (level === 'helper' && !skills.length) skills = ['*'];
      return { id: w.worker_id, name: w.name, level, skills, role: w.role };
    });
  const absentRows = (await client.query(
    `SELECT worker_id FROM daily_attendance WHERE project_id = $1 AND attendance_date = $2 AND status <> 'present'`,
    [projectId, L.todayISO])).rows;
  const absent = absentRows.map(r => r.worker_id);
  const asg = (await client.query(
    `SELECT process_execution_id AS exec_id, worker_id FROM site_assignments WHERE project_id = $1 AND work_date = $2`,
    [projectId, L.todayISO])).rows;
  const assignments = {};
  asg.forEach(a => { const k = L.keyByExec.get(a.exec_id); if (k) (assignments[k] = assignments[k] || []).push(a.worker_id); });

  const floors = new Set(L.plan.tasks.filter(t => t.floor != null).map(t => t.floor));
  const floorArea = Number(L.answers.floor_area) || (Number(L.answers.total_area) ? Number(L.answers.total_area) / Math.max(1, floors.size) : null);

  const adv = advise(L.plan, L.state, {
    quantities: L.quantities, team: { members }, assignments, absent, floorArea, allowMissingQuantity: true
  });

  const rowByKey = new Map(L.rows.map(r => [keyOfRow(r), r]));
  const nameByKey = new Map(L.rows.map(r => [keyOfRow(r), r.process_name]));
  const decorate = x => {
    const r = rowByKey.get(x.key);
    return Object.assign({}, x, {
      execId: L.execByKey.get(x.key), name: nameByKey.get(x.key), code: r.master_code, floor: r.floor_no,
      quantityMissing: x.kind === 'work' && !(L.quantities[x.key] > 0),
      unit: r.quantity_unit, plannedQuantity: Number(r.planned_quantity) > 0 ? Number(r.planned_quantity) : null,
      workStatus: r.status          // not_started | in_progress | waiting_material | weather_stop | completed
    });
  };
  const sug = adv.suggestions.map(s => Object.assign({}, s, { execId: L.execByKey.get(s.key), name: nameByKey.get(s.key) }));

  return {
    planned: true, date: L.todayISO, workingDay: L.state.today, projectStart: L.startISO,
    ready: adv.ready.map(decorate), inProgress: adv.inProgress.map(decorate), blocked: adv.blocked.map(decorate),
    suggestions: sug, idle: adv.idle, queued: adv.queued.map(q => Object.assign({}, q, { execId: L.execByKey.get(q.key) })),
    absentNames: members.filter(m => absent.includes(m.id)).map(m => m.name),
    warnings: adv.warnings, congestionLimit: adv.congestionLimit,
    team: members, absent,
    assignments: Object.fromEntries(Object.keys(assignments).map(k => [L.execByKey.get(k), assignments[k]])),
    counts: { total: L.plan.tasks.length, completed: Object.values(L.state.tasks).filter(t => t.status === 'completed').length }
  };
}

// ================= 预计工期与人员配置 =================
// 按“当前团队 + 已有工程量”排一遍计划：每道工序要几个班组、每班几个大工几个普工、预计几天、哪天开始哪天完成。
// 缺工程量的工序按 2 天估算，团队里没有的工种按 1 个标准班组估算，结果里都会标出来（assumed），不会假装是准的。
const { schedule, workingDayToDate } = require('./scheduler');
const { getQuota } = require('./process-quota');
const { crewsFromTeam } = require('./advisor');

async function loadMembers(client, projectId) {
  const rows = (await client.query(
    `SELECT worker_id, name, level, skills FROM workers WHERE project_id = $1 AND status = 'active' ORDER BY worker_id`, [projectId])).rows;
  return rows.map(w => {
    const level = w.level === 'skilled' ? 'skilled' : 'helper';
    let skills = Array.isArray(w.skills) ? w.skills : [];
    if (level === 'helper' && !skills.length) skills = ['*'];
    return { id: w.worker_id, name: w.name, level, skills };
  });
}

async function buildEstimate(client, projectId) {
  const L = await loadPlanState(client, projectId);
  if (!L.planned) return { planned: false };
  const members = await loadMembers(client, projectId);
  const crews = crewsFromTeam({ members });
  const maxCrews = 2;
  const res = schedule(L.plan, { quantities: L.quantities, crews, lenient: true, defaultDays: 2, maxCrewsPerTask: maxCrews, state: L.state, now: L.state.today });
  const byKey = new Map(res.tasks.map(o => [o.key, o]));
  const startISO = L.startISO;
  const dateOf = d => (d ? workingDayToDate(startISO, d) : null);
  const skilledOf = tr => members.filter(m => m.level === 'skilled' && m.skills.includes(tr)).length;
  const helperOf = tr => members.filter(m => m.level === 'helper' && (m.skills.includes('*') || m.skills.includes(tr))).length;

  const tasks = L.plan.tasks.map(t => {
    const q = getQuota(t.code, L.plan.profile);
    const o = byKey.get(t.key);
    const out = {
      key: t.key, execId: L.execByKey.get(t.key), code: t.code, floor: t.floor, name: t.zh, th: t.th,
      kind: q.kind, status: (L.state.tasks[t.key] || {}).status || 'not_started',
      startDay: ((L.state.tasks[t.key] || {}).status ? null : o.start), finishDay: o.finish,
      startDate: ((L.state.tasks[t.key] || {}).status ? null : dateOf(o.start)), finishDate: dateOf(o.finish),
      assumedQty: !!o.assumedQty, placeholder: !!q.placeholder
    };
    if (q.kind === 'work') {
      const sk = skilledOf(q.trade), hp = helperOf(q.trade);
      const bySk = q.crew.skilled ? Math.floor(sk / q.crew.skilled) : Infinity;
      const byHp = q.crew.helper ? Math.floor(hp / q.crew.helper) : Infinity;
      const can = Math.min(bySk, byHp);
      const avail = can === Infinity ? 0 : can;
      const use = Math.max(1, Math.min(maxCrews, avail));
      const qty = L.quantities[t.key];
      const workload = qty > 0 ? qty / q.output : null;     // 班组·天
      Object.assign(out, {
        trade: q.trade, tradeName: (TRADES[q.trade] || {}).zh || q.trade, crewStd: { skilled: q.crew.skilled, helper: q.crew.helper },
        crewsUsed: use, people: { skilled: use * q.crew.skilled, helper: use * q.crew.helper },
        crewsAvailable: avail, shortage: avail < 1,
        shortageText: avail >= 1 ? null : (q.crew.skilled && sk < q.crew.skilled
          ? `团队里会「${(TRADES[q.trade] || {}).zh || q.trade}」的大工不够（需要 ${q.crew.skilled} 个，现有 ${sk} 个）`
          : `普工不够（每班需要 ${q.crew.helper} 个，现有 ${hp} 个）`),
        qty: qty > 0 ? qty : null, unit: q.unit, output: q.output,
        workloadCrewDays: workload,
        estDays: workload ? Math.max(1, Math.ceil(workload / use - 1e-9)) : null
      });
    } else {
      out.estDays = q.days;
    }
    return out;
  });

  const proj = (await client.query(`SELECT to_char(planned_end_date, 'YYYY-MM-DD') AS e FROM projects WHERE id = $1`, [projectId])).rows[0];
  const finishDate = dateOf(res.finishDay);
  const byTrade = Object.keys(res.util).map(tr => ({
    trade: tr, name: (TRADES[tr] || {}).zh || tr, crews: res.util[tr].crews, assumed: res.assumedCrews.includes(tr),
    busyCrewDays: Math.round(res.util[tr].busyCrewDays * 10) / 10, firstDay: res.util[tr].firstDay, lastDay: res.util[tr].lastDay,
    firstDate: dateOf(res.util[tr].firstDay), lastDate: dateOf(res.util[tr].lastDay),
    std: tasks.filter(x => x.trade === tr).reduce((s, x) => ({ skilled: Math.max(s.skilled, x.crewStd.skilled), helper: Math.max(s.helper, x.crewStd.helper) }), { skilled: 0, helper: 0 })
  })).filter(x => x.busyCrewDays > 0).sort((a, b) => b.busyCrewDays - a.busyCrewDays);

  return {
    planned: true, startDate: startISO, today: L.state.today, remainingDays: Math.max(0, res.finishDay - L.state.today + 1),
    doneCount: Object.values(L.state.tasks).filter(x => x.status === 'completed').length, totalCount: L.plan.tasks.length,
    finishDay: res.finishDay, finishDate, plannedEnd: proj ? proj.e : null,
    lateDays: proj && proj.e && finishDate ? Math.round((new Date(finishDate) - new Date(proj.e)) / 86400000) : null,
    peakHeadcount: res.peakHeadcount, avgHeadcount: Math.round(res.avgHeadcount),
    assumed: {
      missingQty: tasks.filter(t => t.assumedQty).length,
      missingCrewTrades: res.assumedCrews.map(tr => (TRADES[tr] || {}).zh || tr),
      noTeam: members.length === 0
    },
    byTrade, tasks
  };
}

// ================= 开始工序：把关 + 提前开始的记录与通知 =================
async function userName(client, userId) {
  const r = await client.query('SELECT username, full_name FROM users WHERE id = $1', [userId]);
  return r.rows.length ? (r.rows[0].full_name || r.rows[0].username) : '未知用户';
}

async function notifyManagers(client, projectId, actorId, title, body, severity, relatedType, relatedId) {
  const m = await client.query(`SELECT id FROM users WHERE role = 'manager'`);
  let ids = m.rows.map(r => r.id).filter(id => id !== actorId);
  if (!ids.length) ids = m.rows.map(r => r.id);     // 只有操作人自己是管理者时，也给他留一条记录
  for (const id of ids) {
    await client.query(
      `INSERT INTO notifications (project_id, to_user_id, title, body, severity, related_type, related_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [projectId, id, title, body, severity, relatedType, relatedId]);
  }
  return ids;
}

// 返回 { started, override }。调用者负责事务。
async function startProcess(client, execId, user, forceReason, dateISO) {
  const r = await client.query(
    `SELECT pe.id, pe.status, pn.project_id, pn.master_code, pn.floor_no
       FROM process_execution pe JOIN process_nodes pn ON pn.id = pe.process_node_id WHERE pe.id = $1`, [execId]);
  if (!r.rows.length) throw new HttpError(404, '工序不存在');
  const row = r.rows[0];
  if (row.status !== 'not_started') return { started: false, status: row.status };

  let override = null;
  if (row.master_code) {                                    // 只对总库生成的工序把关；旧的固定模板工序保持原样
    const L = await loadPlanState(client, row.project_id, dateISO);
    const key = keyOfRow(row);
    const check = canStart(L.plan, L.state, key);
    if (!check.allowed) {
      const label = k => labelOf(L.plan, k);
      if (!String(forceReason || '').trim()) {
        throw new HttpError(409, '前置条件还没满足，现在不能开始', {
          code: 'BLOCKED', task: labelOf(L.plan, key),
          reasons: check.reasons.map(x => describeReason(x, label))
        });
      }
      const by = { id: user.id, name: await userName(client, user.id) };
      const f = forceStart(L.plan, L.state, key, { reason: forceReason, by, at: L.todayISO });
      await client.query(
        `INSERT INTO process_overrides (project_id, process_execution_id, reason, severity, unmet, decided_by, decided_by_name)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [row.project_id, execId, f.reason, f.severity, JSON.stringify(f.unmet), user.id, by.name]);
      const notified = await notifyManagers(client, row.project_id, user.id,
        `提前开始：${labelOf(L.plan, key)}（风险${{ high: '高', medium: '中', low: '低' }[f.severity]}）`,
        f.message.zh, f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warning' : 'info', 'process_execution', execId);
      override = { severity: f.severity, notified: notified.length, message: f.message.zh };
    }
  }
  await client.query(
    `UPDATE process_execution SET status = 'in_progress', actual_start_date = COALESCE(actual_start_date, CURRENT_DATE), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [execId]);
  return { started: true, override };
}

module.exports = {
  HttpError, TRADES, DEFAULT_PROFILE,
  getProfile, saveProfile, previewPlan, applyPlan, loadPlanState, buildBoard, buildEstimate, startProcess, notifyManagers, userName
};
