// 排程：在先后关系 + 工种班组数量限制下，逐个工作日排出每个任务的开始/完成，
// 以及每天每个工种用了几个班组、多少人、哪些任务在排队等班组。
// 时间单位是「工作日」序号（第 1 天、第 2 天……），日历日期由 workingDayToDate 换算。
//
// 用法：
//   const r = schedule(plan, { quantities, crews: { rebar: 2, carpenter: 3, ... }, maxCrewsPerTask: 2 });

const { getQuota } = require('./process-quota');

const EPS = 1e-9;

function schedule(plan, opts) {
  const { quantities } = opts;
  const crews = Object.assign({}, opts.crews);               // 复制一份，宽松模式下会补默认班组
  const assumedCrews = new Set();
  const maxCrews = opts.maxCrewsPerTask || 2;
  const maxDays = opts.maxDays || 1500;

  // ---- 1. 建任务 ----
  const T = new Map();
  plan.tasks.forEach(t => {
    const q = getQuota(t.code, plan.profile);
    if (!q) throw new Error('缺少定额：' + t.code);
    const o = {
      key: t.key, code: t.code, floor: t.floor, zh: t.zh, kind: q.kind, trade: q.trade || null,
      placeholder: !!q.placeholder, conf: q.conf, crewSize: 0,
      start: null, finish: null, prog: [0], queued: 0, crewDays: 0
    };
    if (q.kind === 'work') {
      const qty = quantities[t.key];
      if (!(crews[q.trade] > 0)) {
        if (!opts.lenient) throw new Error('没有配置该工种的班组：' + q.trade + '（' + t.key + '）');
        crews[q.trade] = 1; assumedCrews.add(q.trade);        // 宽松模式：团队里没有这个工种，先按 1 个标准班组估算
      }
      if (!(qty > 0)) {
        if (!opts.lenient) throw new Error('缺少工程量：' + t.key);
        o.kind = 'fixed'; o.assumedQty = true; o.total = opts.defaultDays || 2;   // 宽松模式：没有工程量，先按固定天数估算
      } else {
        o.qty = qty; o.total = qty / q.output; o.crewSize = q.crew.skilled + q.crew.helper;
      }
    } else {
      o.total = q.days;
    }
    o.remaining = o.total;
    T.set(t.key, o);
  });
  const preds = new Map(), succs = new Map();
  plan.tasks.forEach(t => { preds.set(t.key, []); succs.set(t.key, []); });
  plan.deps.forEach(d => { preds.get(d.to).push(d); succs.get(d.from).push(d); });

  // ---- 2. 优先级：到项目结束的最长路径（估算天数），越长越先排 ----
  const est = o => o.kind === 'work' ? Math.max(1, Math.ceil(o.total / Math.min(maxCrews, crews[o.trade]))) : o.total;
  const tailMemo = new Map();
  const tail = key => {
    if (tailMemo.has(key)) return tailMemo.get(key);
    const o = T.get(key);
    let best = 0;
    succs.get(key).forEach(d => { best = Math.max(best, d.lag + tail(d.to)); });
    const v = est(o) + best;
    tailMemo.set(key, v);
    return v;
  };
  T.forEach((o, k) => { o.tail = tail(k); });

  // ---- 3. 逐日模拟 ----
  const reachedDay = (p, min) => {                       // 前置进度第一次达到 min% 的那一天
    for (let e = 1; e < p.prog.length; e++) if (p.prog[e] >= min / 100 - EPS) return e;
    return -1;
  };
  const depsOk = (o, day) => preds.get(o.key).every(d => {
    const p = T.get(d.from);
    if (d.type === 'SS') { const e = reachedDay(p, d.min); return e !== -1 && day >= e + 1 + d.lag; }
    return p.finish != null && day >= p.finish + 1 + d.lag;
  });

  // 已有实际进度时（opts.state + opts.now）：已完成的直接记为完成，进行中的只排剩余部分，从第 now 天开始往后排
  const daily = [];
  let done = 0, day = 0;
  if (opts.state && opts.now > 1) {
    day = opts.now - 1;
    T.forEach(o => {
      const st = opts.state.tasks && opts.state.tasks[o.key];
      if (!st || st.status === 'not_started') return;
      if (st.status === 'completed') {
        o.finish = st.finishedDay || day; o.start = o.finish; o.remaining = 0; o.prog = new Array(opts.now).fill(1); o.prog[0] = 0; done++;
      } else {
        const p = Math.min(0.999, Math.max(0, st.progress || 0));
        o.start = day; o.remaining = o.total * (1 - p); o.prog = new Array(opts.now).fill(p); o.prog[0] = 0;
      }
    });
  }
  while (done < T.size) {
    day++;
    if (day > maxDays) throw new Error('排程超过天数上限，可能存在死锁');
    const avail = Object.assign({}, crews);
    const rec = { day, assigned: {}, headcount: 0, running: [] };

    const eligible = [];
    T.forEach(o => {
      if (o.finish != null) return;
      if (o.start == null && !depsOk(o, day)) return;
      eligible.push(o);
    });

    // 需要班组的任务：按优先级分配
    eligible.filter(o => o.kind === 'work')
      .sort((a, b) => (b.tail - a.tail) || ((b.start != null) - (a.start != null)) || (a.floor - b.floor) || a.key.localeCompare(b.key))
      .forEach(o => {
        const want = Math.min(maxCrews, Math.ceil(o.remaining - EPS));
        const give = Math.min(want, avail[o.trade]);
        if (give <= 0) { o.queued++; return; }
        avail[o.trade] -= give;
        const w = Math.min(give, o.remaining);
        if (o.start == null) o.start = day;
        o.remaining -= w; o.crewDays += w;
        rec.assigned[o.trade] = (rec.assigned[o.trade] || 0) + give;
        rec.headcount += give * o.crewSize;
        rec.running.push(o.key);
        if (o.remaining <= EPS) { o.finish = day; done++; }
      });

    // 固定天数的任务：不占班组，按日历推进
    eligible.filter(o => o.kind === 'fixed').forEach(o => {
      if (o.start == null) o.start = day;
      o.remaining -= 1;
      rec.running.push(o.key);
      if (o.remaining <= EPS) { o.finish = day; done++; }
    });

    T.forEach(o => {
      o.prog[day] = o.finish != null ? 1 : (o.start != null ? 1 - o.remaining / o.total : 0);
    });
    daily.push(rec);
  }

  // ---- 4. 汇总 ----
  const finishDay = day;
  const tasks = Array.from(T.values());
  const trades = Object.keys(crews);
  const util = {};
  trades.forEach(tr => {
    let busy = 0, first = null, last = null, queued = 0;
    daily.forEach(r => {
      if (r.assigned[tr]) { busy += r.assigned[tr]; if (first == null) first = r.day; last = r.day; }
    });
    tasks.forEach(o => { if (o.trade === tr) queued += o.queued; });
    const span = first == null ? 0 : last - first + 1;
    util[tr] = {
      crews: crews[tr], busyCrewDays: busy, firstDay: first, lastDay: last, queuedTaskDays: queued,
      spanUtil: span ? busy / (span * crews[tr]) : 0
    };
  });
  const headcounts = daily.map(r => r.headcount);
  return {
    finishDay, tasks, daily, util, assumedCrews: Array.from(assumedCrews), crewsUsed: crews,
    peakHeadcount: Math.max(...headcounts),
    avgHeadcount: headcounts.reduce((a, b) => a + b, 0) / headcounts.length,
    maxConcurrent: Math.max(...daily.map(r => r.running.length)),
    avgConcurrent: daily.reduce((a, r) => a + r.running.length, 0) / daily.length
  };
}

// 工作日序号 -> 日历日期。offWeekdays: 休息的星期几（0=周日）；holidays: 'YYYY-MM-DD' 数组
function workingDayToDate(startDate, dayNo, offWeekdays = [0], holidays = []) {
  const hs = new Set(holidays);
  const d = new Date(startDate + 'T00:00:00Z');
  let n = 0;
  for (;;) {
    const iso = d.toISOString().slice(0, 10);
    if (!offWeekdays.includes(d.getUTCDay()) && !hs.has(iso)) { n++; if (n === dayNo) return iso; }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

module.exports = { schedule, workingDayToDate };
