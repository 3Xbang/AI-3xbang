const fs = require('fs');

let content = fs.readFileSync('backend/src/routes.js', 'utf8');

// Fix 1: Line 126 - Remove role from INSERT
const old1 = `INSERT INTO project_members (project_id, user_id, role, assigned_by) 
       VALUES ($1, $2, $3, $4)`;
const new1 = `INSERT INTO project_members (project_id, user_id, assigned_by) 
       VALUES ($1, $2, $3)`;

content = content.replace(old1, new1);

// Also fix the VALUES part (remove $3 which was role)
content = content.replace(
  '[project.id, req.user.id, req.user.role, req.user.id]',
  '[project.id, req.user.id, req.user.id]'
);

// Fix 2: Line 1522 - Same fix
const old2 = `INSERT INTO project_members (project_id, user_id, role, assigned_by) 
           VALUES ($1, $2, $3, $4)`;
const new2 = `INSERT INTO project_members (project_id, user_id, assigned_by) 
           VALUES ($1, $2, $3)`;

content = content.replace(old2, new2);

// Fix the VALUES part for second INSERT
content = content.replace(
  '[projectId, userId, userRole, req.user.id]',
  '[projectId, userId, req.user.id]'
);

fs.writeFileSync('backend/src/routes.js', content, 'utf8');
console.log('Fixed project_members INSERTs!');
