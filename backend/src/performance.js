// 班组效率评价：只决定「发不发奖励」和「给主管看什么原因」，不涉及任何扣钱。
// 对应文档：PERFORMANCE_FAIRNESS.md、PROCESS_QUOTA_SHEET.md
//
// 用法：
//   const { evaluate } = require('./performance');
//   const r = evaluate({
//     quotaPerCrewDay: 25,           // 该工序标准班组每天定额
//     difficulty: 1.0,               // 难度系数（默认 1）
//     acceptanceStatus: 'passed',    // passed | pending | failed
//     trial: false,                  // 试行期：只记录，不奖励
//     reworkQty: 0,                  // 返工的量（从合格量里扣）
//     days: [{ date, status, crewsPresent, qtyClaimed, qtyAccepted }]
//   });
//   r.tier -> reward | normal | below_target | insufficient_data | pending_quality | trial_record_only
//
// 档位阈值、最少有效天数等都是默认值，待你们确认后在 config 里改。
// 泰文提示语请当地人核对后再给工人看。

const EXCLUDED_STATUS = {
  waiting_material:    { zh: '等材料', th: 'รอวัสดุ' },
  weather_stop:        { zh: '天气停工', th: 'หยุดเพราะสภาพอากาศ' },
  waiting_predecessor: { zh: '前置工序未完成', th: 'รองานก่อนหน้าเสร็จ' },
  change_order:        { zh: '业主或设计变更', th: 'เจ้าของงานหรือแบบมีการเปลี่ยนแปลง' },
  equipment_down:      { zh: '设备故障或停水停电', th: 'เครื่องมือขัดข้องหรือไฟ/น้ำดับ' }
};

const DEFAULT_CONFIG = {
  rewardAt: 1.10,          // 指数达到这个值且质量合格 -> 奖励
  normalAt: 1.00,          // 低于这个值 -> 只提示老板，由老板去和组长沟通
  minEffectiveDays: 3,     // 有效施工天少于这个数，数据不足，不评
  claimGapPct: 0.10        // 报量与验收量差异超过 10%，提示主管复核（不直接怪工人）
};

const MESSAGES = {
  reward: {
    zh: '做得很好，产量超过目标，质量也合格。感谢大家认真干活。',
    th: 'ทำได้ดีมาก ผลงานเกินเป้าหมายและคุณภาพผ่าน ขอบคุณที่ตั้งใจทำงาน'
  },
  normal: {
    zh: '产量达到目标，请继续保持。',
    th: 'ผลงานได้ตามเป้าหมาย ขอให้รักษามาตรฐานนี้ไว้'
  },
  // 低于目标：不自动给工人发任何话，只提示老板，由老板和组长沟通
  below_target: null,
  insufficient_data: {
    zh: '有效施工天数还不够，暂时不评。',
    th: 'จำนวนวันทำงานจริงยังไม่พอ ยังไม่ประเมินผล'
  },
  pending_quality: {
    zh: '等质量验收后再评。',
    th: 'รอตรวจรับคุณภาพก่อนจึงประเมินผล'
  },
  trial_record_only: {
    zh: '现在是试行期，只记录数据，不影响奖励。',
    th: 'ช่วงทดลอง บันทึกข้อมูลอย่างเดียว ไม่มีผลต่อรางวัล'
  }
};

const round2 = n => Math.round(n * 100) / 100;

function evaluate(input, config) {
  const cfg = Object.assign({}, DEFAULT_CONFIG, config || {});
  const { quotaPerCrewDay, days } = input;
  const difficulty = input.difficulty == null ? 1 : input.difficulty;
  const rework = input.reworkQty || 0;
  const acceptance = input.acceptanceStatus || 'pending';

  if (!(quotaPerCrewDay > 0)) throw new Error('定额必须大于 0');
  if (!(difficulty > 0)) throw new Error('难度系数必须大于 0');
  if (!Array.isArray(days)) throw new Error('days 必须是数组');

  // 1. 分出有效施工天和被剔除的天
  const excluded = {};
  let effectiveDays = 0, expected = 0, accepted = 0, claimed = 0;
  days.forEach(d => {
    if (d.status === 'working') {
      if (!(d.crewsPresent > 0)) return;            // 没人上班的天不算
      effectiveDays += 1;
      expected += quotaPerCrewDay * d.crewsPresent * difficulty;
      claimed += d.qtyClaimed || 0;
      accepted += d.qtyAccepted != null ? d.qtyAccepted : (acceptance === 'passed' ? (d.qtyClaimed || 0) : 0);
    } else if (EXCLUDED_STATUS[d.status]) {
      excluded[d.status] = (excluded[d.status] || 0) + 1;
    } else {
      throw new Error(`未知的状态：${d.status}`);
    }
  });

  const actual = Math.max(0, accepted - rework);
  const index = expected > 0 ? actual / expected : 0;

  // 2. 给主管看的原因和提醒
  const reasons = [];
  Object.keys(excluded).forEach(k => {
    reasons.push({ code: 'excluded_' + k, days: excluded[k],
      zh: `${EXCLUDED_STATUS[k].zh} ${excluded[k]} 天，已从统计中剔除，不算班组责任`,
      th: `${EXCLUDED_STATUS[k].th} ${excluded[k]} วัน ไม่นำมาคิด ไม่ถือเป็นความรับผิดชอบของทีม` });
  });
  if (rework > 0) reasons.push({ code: 'rework', qty: rework,
    zh: `有返工量 ${rework}，已从合格量中扣减`, th: `มีงานแก้ไข ${rework} หักออกจากปริมาณที่ผ่านแล้ว` });
  if (difficulty !== 1) reasons.push({ code: 'difficulty', factor: difficulty,
    zh: `已按难度系数 ${difficulty} 调整目标`, th: `ปรับเป้าหมายตามค่าความยาก ${difficulty}` });
  const flags = [];
  if (claimed > 0 && Math.abs(claimed - accepted) / claimed > cfg.claimGapPct) {
    flags.push({ code: 'claim_gap',
      zh: `报量 ${round2(claimed)} 与验收量 ${round2(accepted)} 相差超过 ${cfg.claimGapPct * 100}%，请主管复核`,
      th: `ปริมาณที่แจ้ง ${round2(claimed)} ต่างจากปริมาณที่ตรวจรับ ${round2(accepted)} เกิน ${cfg.claimGapPct * 100}% ให้หัวหน้าตรวจสอบ` });
  }

  // 3. 定档
  let tier;
  if (effectiveDays < cfg.minEffectiveDays) tier = 'insufficient_data';
  else if (acceptance === 'pending') tier = 'pending_quality';
  else if (acceptance === 'failed') {
    tier = 'below_target';
    reasons.unshift({ code: 'quality_failed', zh: '质量验收未通过，需要返工后再评', th: 'ตรวจรับคุณภาพไม่ผ่าน ต้องแก้ไขก่อนจึงประเมินใหม่' });
  } else if (index >= cfg.rewardAt) tier = 'reward';
  else if (index >= cfg.normalAt) tier = 'normal';
  else tier = 'below_target';

  // 4. 试行期：只记录，不奖励；同时给出「如果不是试行期会是什么档」
  let wouldBe = null;
  if (input.trial && !['insufficient_data', 'pending_quality'].includes(tier)) {
    wouldBe = tier;
    tier = 'trial_record_only';
  }

  // 5. 低于目标时，给老板的提示（只给老板看，内容方便他去和组长沟通）
  let alert = null;
  if (tier === 'below_target') {
    const lines = [`指数 ${round2(index)}（目标 ${round2(expected)}，实际合格 ${round2(actual)}，有效施工 ${effectiveDays} 天）`];
    reasons.forEach(r => lines.push('- ' + r.zh));
    if (!reasons.length) lines.push('- 没有被剔除的停工天，也没有返工，建议向组长了解现场情况（人手、工具、技术、图纸）');
    flags.forEach(f => lines.push('- 注意：' + f.zh));
    alert = { toBoss: true, zh: lines.join('\n') };
  }

  return {
    tier, wouldBe,
    index: round2(index), expected: round2(expected), actual: round2(actual),
    effectiveDays, excludedDays: excluded,
    reasons, flags,
    message: MESSAGES[tier],   // 给工人看的话；below_target 时为 null（不自动发）
    alert                      // 给老板的提示
  };
}

module.exports = { evaluate, DEFAULT_CONFIG, EXCLUDED_STATUS, MESSAGES };
