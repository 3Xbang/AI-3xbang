// 工作日历：把日期换算成「项目第几个工作日」。默认周日休息，可传入节假日。
// 日期一律用 'YYYY-MM-DD' 字符串，避免时区把日期算错一天。

const DAY = 24 * 3600 * 1000;

function parseISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('日期格式必须是 YYYY-MM-DD：' + iso);
  return new Date(iso + 'T00:00:00Z');
}
const toISO = d => d.toISOString().slice(0, 10);

// 泰国时间（UTC+7）的「今天」
function todayInBangkok() {
  return toISO(new Date(Date.now() + 7 * 3600 * 1000));
}

function isWorkingDay(iso, offWeekdays = [0], holidays = []) {
  const d = parseISO(iso);
  return !offWeekdays.includes(d.getUTCDay()) && !holidays.includes(iso);
}

// 从开工日（含）到 dateISO（含）一共有几个工作日。dateISO 不是工作日时，返回上一个工作日的序号。
// dateISO 早于开工日返回 0。
function workingDayIndex(startISO, dateISO, offWeekdays = [0], holidays = []) {
  const start = parseISO(startISO), end = parseISO(dateISO);
  if (end < start) return 0;
  let n = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
    const iso = toISO(new Date(t));
    if (isWorkingDay(iso, offWeekdays, holidays)) n++;
  }
  return n;
}

module.exports = { parseISO, toISO, todayInBangkok, isWorkingDay, workingDayIndex };
