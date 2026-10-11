// 工序定额：工种、标准班组、每班组每天产量。
// 对应文档：PROCESS_QUOTA_SHEET.md。数字是试行参考值，待你们按实测修改；
// 标 placeholder 的是我没有依据的占位值，只用来让排程能跑通，必须由你们填。
//
// kind: 'work'  按工程量计算：班组·天 = 工程量 ÷ output
//       'fixed' 固定天数（不占班组），如拆模、试验、验收
// 养护等待已经写在先后规则的 lag 里（process-master.js），这里的 fixed 只是「动作本身」的天数。

const Q = {};
// W(编码, 工种, 技工数, 普工数, 每班组每天产量, 单位, 把握度)
const W = (code, trade, skilled, helper, output, unit, conf, extra) => {
  Q[code] = Object.assign({ kind: 'work', trade, crew: { skilled, helper }, output, unit, conf: conf || '中' }, extra || {});
};
const F = (code, days, conf, extra) => {
  Q[code] = Object.assign({ kind: 'fixed', days, conf: conf || '中' }, extra || {});
};

// A 前期
F('A01', 1, '中');
F('A02', 3, '低', { placeholder: true });
W('A03', 'mach', 1, 1, 600, 'm²', '低', { placeholder: true });

// B 地基与基础
W('B01', 'mach', 1, 1, 150, 'm³', '中');
F('B02', 14, '低', { placeholder: true, note: '分包，按合同' });
W('B03', 'mach', 1, 2, 300, 'm²', '低');
W('B04', 'concrete', 1, 3, 20, 'm³', '中');
W('B05', 'waterproof', 1, 1, 80, 'm²', '中');
W('B06', 'rebar', 2, 2, 1.5, 't', '中');
W('B07', 'carpenter', 2, 1, 30, 'm²', '中');
W('B08', 'concrete', 2, 4, 40, 'm³', '中');
F('B09', 1, '中', { note: '拆模动作；养护等待在前置规则 lag 里' });
W('B10', 'mach', 1, 2, 120, 'm³', '低');
F('B11', 10, '低', { placeholder: true });

// C 主体结构
W('C12', 'scaffold', 2, 2, 150, 'm²', '中');
W('C01', 'rebar', 2, 1, 0.8, 't', '中');
W('C02', 'carpenter', 2, 1, 25, 'm²', '中');
W('C03', 'concrete', 2, 4, 30, 'm³', '中');
W('C04', 'carpenter', 3, 2, 60, 'm²', '中');
W('C05', 'rebar', 3, 2, 1.5, 't', '中');
W('C06', 'concrete', 2, 4, 40, 'm³', '中');
F('C07', 2, '中', { note: '拆模动作；养护等待在前置规则 lag 里' });
W('C08', 'carpenter', 2, 1, 5, '步', '低');
W('C09', 'mason', 1, 1, 1.2, 'm³', '中', { outputBy: { masonry: { brick: 1.2, aac: 2.0 } } });
W('C10', 'carpenter', 2, 1, 1.0, 'm³', '低');
W('C11', 'carpenter', 2, 1, 15, 'm', '低');
W('C13', 'carpenter', 2, 1, 8, 'm²', '低');

// D 屋面
W('D01', 'carpenter', 2, 2, 40, 'm²', '低');
W('D02', 'roof', 2, 2, 30, 'm²', '低');
W('D03', 'mason', 1, 1, 60, 'm²', '中');
W('D04', 'waterproof', 1, 1, 80, 'm²', '中');
W('D05', 'waterproof', 1, 1, 80, 'm²', '中');
W('D06', 'roof', 2, 1, 25, 'm²', '低');
W('D07', 'roof', 1, 1, 20, 'm', '低');
F('D08', 2, '中');

// E 机电
W('E01', 'electrician', 1, 1, 120, 'm²', '低');
W('E14', 'electrician', 1, 1, 60, 'm²', '低');
W('E02', 'plumber', 1, 1, 6, '点', '低');
W('E03', 'plumber', 1, 1, 40, 'm', '中');
W('E04', 'plumber', 1, 1, 30, 'm', '中');
W('E05', 'electrician', 1, 1, 150, 'm', '中');
W('E06', 'electrician', 1, 1, 100, 'm', '中');
F('E07', 1, '中');
F('E08', 1, '中');
F('E09', 2, '低', { placeholder: true });
F('E10', 2, '低', { placeholder: true });
W('E11', 'plumber', 1, 1, 1, '套', '低');
W('E12', 'installer', 2, 1, 3, '台', '中');
F('E13', 20, '低', { placeholder: true, note: '供应商安装' });

// F 装饰装修
W('F01', 'general', 0, 2, 150, 'm²', '中');
W('F02', 'mason', 1, 1, 25, 'm²', '中');
W('F03', 'mason', 1, 1, 15, 'm²', '中');
W('F04', 'waterproof', 1, 1, 60, 'm²', '中');
F('F05', 2, '中', { note: '闭水试验 48 小时；涂膜养护在前置规则 lag 里' });
W('F06', 'mason', 1, 1, 40, 'm²', '中');
W('F07', 'tiler', 1, 1, 8, 'm²', '中');
W('F08', 'tiler', 1, 1, 10, 'm²', '中');
W('F09', 'tiler', 2, 1, 6, 'm²', '低');
W('F10', 'carpenter', 1, 1, 30, 'm²', '中');
W('F11', 'carpenter', 1, 1, 35, 'm²', '中');
W('F12', 'carpenter', 1, 1, 40, 'm²', '中');
W('F13', 'mason', 1, 1, 25, 'm²', '中');
W('F14', 'painter', 1, 1, 40, 'm²', '中');
W('F15', 'painter', 1, 1, 60, 'm²', '中');
W('F16', 'painter', 1, 1, 15, 'm²', '中');
W('F17', 'carpenter', 1, 1, 15, 'm²', '中');
W('F18', 'installer', 1, 1, 3, '樘', '中');
W('F19', 'installer', 1, 1, 4, '樘', '中');
W('F20', 'installer', 1, 1, 6, '樘', '中');
W('F21', 'installer', 1, 1, 20, 'm²', '中');
W('F22', 'installer', 1, 1, 2, '樘', '中');
W('F23', 'carpenter', 1, 1, 50, 'm', '中');
W('F24', 'installer', 1, 1, 10, 'm', '低');
W('F25', 'carpenter', 2, 0, 5, 'm', '低');
W('F26', 'plumber', 1, 1, 2, '套', '中');
W('F27', 'installer', 1, 1, 1, '套', '中');
W('F28', 'carpenter', 2, 0, 4, 'm', '中');
W('F29', 'installer', 2, 0, 3, 'm', '中');
W('F30', 'electrician', 1, 1, 20, '盏', '中');
W('F31', 'electrician', 1, 1, 40, '个', '中');

// G 外立面
F('G05', 2, '低', { placeholder: true });
W('G01', 'mason', 1, 1, 20, 'm²', '低');
W('G02', 'mason', 1, 1, 30, 'm²', '低');
W('G03', 'painter', 1, 1, 50, 'm²', '低', { outputBy: { exterior_finish: { paint: 50, tile: 8, stone: 6, mixed: 20 } } });
W('G04', 'installer', 1, 1, 60, 'm', '中');

// H 室外（差异太大，先用占位天数，必须按分项合同估）
F('H01', 5, '低', { placeholder: true });
F('H02', 5, '低', { placeholder: true });
F('H03', 8, '低', { placeholder: true });
F('H04', 6, '低', { placeholder: true });
F('H05', 8, '低', { placeholder: true });
F('H06', 30, '低', { placeholder: true });

// I 验收
F('I01', 1, '中');
W('I02', 'general', 0, 3, 200, 'm²', '中');
F('I03', 1, '中');
F('I04', 3, '低', { placeholder: true });

// 取某工序的定额；有 outputBy 的按项目答案选产量
function getQuota(code, profile) {
  const q = Q[code];
  if (!q) return null;
  const r = JSON.parse(JSON.stringify(q));
  if (r.outputBy && profile) {
    Object.keys(r.outputBy).forEach(k => {
      const v = r.outputBy[k][profile[k]];
      if (v) r.output = v;
    });
  }
  return r;
}

module.exports = { QUOTA: Q, getQuota };
