// 用法: node scripts/test-boq-api.js <projectId> <清单.xlsx> [apply]
// 通过真实接口预览（加 apply 则写入）清单。需在服务器上、后端运行时执行。
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const jwt = require('jsonwebtoken');
const [projectId, file, mode] = process.argv.slice(2);
const token = jwt.sign({ id: 2, username: 'admin', role: 'manager' }, process.env.JWT_SECRET);
const base = 'http://localhost:' + (process.env.PORT || 3001) + '/api';

async function post(action, extra) {
  const fd = new FormData();
  fd.append('boq', new Blob([fs.readFileSync(file)]), require('path').basename(file).replace(/[^\w.\-]/g, '_'));
  Object.keys(extra || {}).forEach(k => fd.append(k, extra[k]));
  const r = await fetch(`${base}/projects/${projectId}/boq/${action}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
  return { status: r.status, body: await r.json() };
}
(async () => {
  const p = await post('preview');
  console.log('preview', p.status, p.body.success, p.body.message || '',
    p.body.data ? `matches=${p.body.data.matches.length} unmapped=${p.body.data.unmapped.length} missing=${p.body.data.missing.length}` : '');
  if (mode === 'apply' && p.body.success) {
    const a = await post('apply', { skip: '[]' });
    console.log('apply', a.status, JSON.stringify(a.body));
  }
})().catch(e => { console.error(e); process.exit(1); });
