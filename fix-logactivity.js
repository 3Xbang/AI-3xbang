const fs = require('fs');

let content = fs.readFileSync('backend/src/routes.js', 'utf8');

// Fix all logActivity calls that pass strings as details parameter
const fixes = [
  // Line 151-153: create_project
  {
    old: `await logActivity(client, req.user.id, 'create_project', 'projects', project.id, 
      \`创建项目: \${name}\`);`,
    new: `await logActivity(client, req.user.id, 'create_project', 'projects', project.id, 
      { message: \`创建项目: \${name}\` });`
  },
  // Line 189: update_project
  {
    old: `await logActivity(pool, req.user.id, 'update_project', 'projects', id, \`更新项目: \${name}\`);`,
    new: `await logActivity(pool, req.user.id, 'update_project', 'projects', id, { message: \`更新项目: \${name}\` });`
  },
  // Line 398-400: update_process
  {
    old: `await logActivity(client, req.user.id, 'update_process', 'process_execution', req.params.id,
      \`更新工序状态: \${status || '未变更'}\`);`,
    new: `await logActivity(client, req.user.id, 'update_process', 'process_execution', req.params.id,
      { message: \`更新工序状态: \${status || '未变更'}\` });`
  },
  // Line 461-463: purchase_material
  {
    old: `await logActivity(client, req.user.id, 'purchase_material', 'materials', result.rows[0].id,
      \`采购材料: \${material_name.zh || material_name}\`);`,
    new: `await logActivity(client, req.user.id, 'purchase_material', 'materials', result.rows[0].id,
      { message: \`采购材料: \${material_name.zh || material_name}\` });`
  },
  // Line 506-508: receive_material
  {
    old: `await logActivity(client, req.user.id, 'receive_material', 'materials', req.params.id,
      \`确认收货: 数量\${received_quantity}\`);`,
    new: `await logActivity(client, req.user.id, 'receive_material', 'materials', req.params.id,
      { message: \`确认收货: 数量\${received_quantity}\` });`
  },
  // Line 560-562: use_material
  {
    old: `await logActivity(client, req.user.id, 'use_material', 'materials', req.params.id,
      \`使用材料: 数量\${quantity_used}\`);`,
    new: `await logActivity(client, req.user.id, 'use_material', 'materials', req.params.id,
      { message: \`使用材料: 数量\${quantity_used}\` });`
  },
  // Line 603-605: upload_photo
  {
    old: `await logActivity(client, req.user.id, 'upload_photo', 'photos', result.rows[0].id,
      \`上传照片: \${photo_type}\`);`,
    new: `await logActivity(client, req.user.id, 'upload_photo', 'photos', result.rows[0].id,
      { message: \`上传照片: \${photo_type}\` });`
  },
  // Line 1364-1366: create_user
  {
    old: `await logActivity(client, req.user.id, 'create_user', 'users', result.rows[0].id, 
      \`创建用户: \${username}\`);`,
    new: `await logActivity(client, req.user.id, 'create_user', 'users', result.rows[0].id, 
      { message: \`创建用户: \${username}\` });`
  },
  // Line 1431-1433: update_user
  {
    old: `await logActivity(client, req.user.id, 'update_user', 'users', req.params.id, 
      \`更新用户: \${result.rows[0].username}\`);`,
    new: `await logActivity(client, req.user.id, 'update_user', 'users', req.params.id, 
      { message: \`更新用户: \${result.rows[0].username}\` });`
  },
  // Line 1467-1469: delete_user
  {
    old: `await logActivity(client, req.user.id, 'delete_user', 'users', req.params.id, 
      \`删除用户: \${result.rows[0].username}\`);`,
    new: `await logActivity(client, req.user.id, 'delete_user', 'users', req.params.id, 
      { message: \`删除用户: \${result.rows[0].username}\` });`
  },
  // Line 1530-1532: assign_projects
  {
    old: `await logActivity(client, req.user.id, 'assign_projects', 'users', userId,
      \`分配 \${project_ids.length} 个项目\`);`,
    new: `await logActivity(client, req.user.id, 'assign_projects', 'users', userId,
      { message: \`分配 \${project_ids.length} 个项目\` });`
  },
  // Line 1684-1686: assign_task
  {
    old: `await logActivity(client, req.user.id, 'assign_task', 'process_execution', process_execution_id, 
      \`分配任务给用户 \${assigned_to}\`);`,
    new: `await logActivity(client, req.user.id, 'assign_task', 'process_execution', process_execution_id, 
      { message: \`分配任务给用户 \${assigned_to}\` });`
  },
  // Line 1738-1740: unassign_task
  {
    old: `await logActivity(client, req.user.id, 'unassign_task', 'process_execution', processId, 
      \`取消分配给用户 \${userId}\`);`,
    new: `await logActivity(client, req.user.id, 'unassign_task', 'process_execution', processId, 
      { message: \`取消分配给用户 \${userId}\` });`
  }
];

let fixedCount = 0;
for (const fix of fixes) {
  if (content.includes(fix.old)) {
    content = content.replace(fix.old, fix.new);
    fixedCount++;
  }
}

fs.writeFileSync('backend/src/routes.js', content, 'utf8');

console.log(`Fixed ${fixedCount} logActivity calls!`);
