// 把 Mira NO.1（Samui Perfect Living MASTER BOQ，6 套联排，2 层）的真实信息写入项目申请表并重新生成工序。
// 用法: node scripts/set-mira-profile.js <projectId>      （运行前请先备份数据库）
// 已经开始或有进度的工序会保留；清单里没有的项目（围墙、道路、景观、橱柜、空调、泳池）按“没有”处理，
// 以后补充后在申请表里改回来即可。
const pool = require('../src/config/db');
const S = require('../src/site-service');

const projectId = Number(process.argv[2]);
if (!projectId) { console.log('用法: node scripts/set-mira-profile.js <projectId>'); process.exit(1); }

const answers = {
  structure: 'rc_frame', floors: 2, units: 6, total_area: 478,
  roof: 'pitched', roof_insulation: false, stairs: 6, balconies: 0,
  bathrooms_by_floor: [6, 6], kitchens: 6, kitchen_floors: [1],
  floor_finish: 'tile', wall_finish: 'paint', ceiling: 'gypsum',
  cabinet: false, shower_room: false, fixed_furniture: false,
  exterior_finish: 'paint', exterior_insulation: false,
  aircon: 'none', hot_water: 'none', water_supply: 'direct', elevator: false, pool: false,
  fence: false, road: false, landscape: false, sewage: 'septic',
  foundation: 'isolated', soft_soil: false, high_water: false, masonry: 'brick', concrete_supply: 'ready'
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await S.saveProfile(client, projectId, answers, 2);
    const r = await S.applyPlan(client, projectId, answers, { legacy: null });
    await client.query('COMMIT');
    console.log('完成', JSON.stringify(r));
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('失败:', e.message, e.extra ? JSON.stringify(e.extra) : '');
    process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
})();
