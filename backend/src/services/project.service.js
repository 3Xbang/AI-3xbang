const pool = require('../config/db');

/**
 * 根据用户角色获取项目列表
 */
exports.getProjectsByUser = async (userId, userRole, status = null) => {
  let query = `
    SELECT 
      p.*,
      u.username as creator_name,
      (SELECT COUNT(*) FROM process_nodes WHERE project_id = p.project_id) as total_processes,
      (SELECT COUNT(*) FROM process_nodes WHERE project_id = p.project_id AND status = 'completed') as completed_processes
    FROM projects p
    LEFT JOIN users u ON p.created_by = u.user_id
    WHERE 1=1
  `;
  const params = [];

  // 根据角色过滤
  if (userRole !== 'boss') {
    query += ` AND p.created_by = $${params.length + 1}`;
    params.push(userId);
  }

  // 根据状态过滤
  if (status) {
    query += ` AND p.status = $${params.length + 1}`;
    params.push(status);
  }

  query += ` ORDER BY p.created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * 获取单个项目详情
 */
exports.getProjectById = async (projectId, userId, userRole) => {
  let query = `
    SELECT 
      p.*,
      u.username as creator_name,
      (SELECT COUNT(*) FROM process_nodes WHERE project_id = p.project_id) as total_processes,
      (SELECT COUNT(*) FROM process_nodes WHERE project_id = p.project_id AND status = 'completed') as completed_processes,
      (SELECT COUNT(*) FROM workers WHERE project_id = p.project_id AND status = 'active') as active_workers
    FROM projects p
    LEFT JOIN users u ON p.created_by = u.user_id
    WHERE p.project_id = $1
  `;
  const params = [projectId];

  // 非boss只能查看自己的项目
  if (userRole !== 'boss') {
    query += ` AND p.created_by = $2`;
    params.push(userId);
  }

  const result = await pool.query(query, params);
  
  if (result.rows.length === 0) {
    throw new Error('项目不存在或无权访问');
  }

  return result.rows[0];
};

/**
 * 创建新项目
 */
exports.createProject = async (projectData) => {
  const {
    project_name,
    address,
    client_name,
    client_phone,
    area,
    budget,
    start_date,
    end_date,
    created_by
  } = projectData;

  const query = `
    INSERT INTO projects (
      project_name, address, client_name, client_phone, 
      area, budget, start_date, end_date, created_by, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'planning')
    RETURNING *
  `;

  const result = await pool.query(query, [
    project_name,
    address,
    client_name || null,
    client_phone || null,
    area || null,
    budget || null,
    start_date || null,
    end_date || null,
    created_by
  ]);

  return result.rows[0];
};

/**
 * 更新项目
 */
exports.updateProject = async (projectId, updateData, userId, userRole) => {
  // 先检查权限
  await exports.getProjectById(projectId, userId, userRole);

  const allowedFields = [
    'project_name', 'address', 'client_name', 'client_phone',
    'area', 'budget', 'start_date', 'end_date', 'status'
  ];

  const updates = [];
  const values = [];
  let paramIndex = 1;

  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(updateData[key]);
      paramIndex++;
    }
  });

  if (updates.length === 0) {
    throw new Error('没有可更新的字段');
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(projectId);

  const query = `
    UPDATE projects 
    SET ${updates.join(', ')}
    WHERE project_id = $${paramIndex}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * 删除项目
 */
exports.deleteProject = async (projectId, userId, userRole) => {
  // 检查权限
  await exports.getProjectById(projectId, userId, userRole);

  // 只有boss可以删除
  if (userRole !== 'boss') {
    throw new Error('只有管理员可以删除项目');
  }

  const query = 'DELETE FROM projects WHERE project_id = $1';
  await pool.query(query, [projectId]);
};

/**
 * 获取项目统计数据
 */
exports.getProjectStats = async (projectId, userId, userRole) => {
  // 检查权限
  await exports.getProjectById(projectId, userId, userRole);

  const query = `
    SELECT
      p.project_id,
      p.project_name,
      p.budget,
      
      -- 工序统计
      COUNT(DISTINCT pn.node_id) as total_processes,
      COUNT(DISTINCT CASE WHEN pn.status = 'completed' THEN pn.node_id END) as completed_processes,
      ROUND(
        COUNT(DISTINCT CASE WHEN pn.status = 'completed' THEN pn.node_id END)::numeric * 100 / 
        NULLIF(COUNT(DISTINCT pn.node_id), 0), 2
      ) as progress_percentage,
      
      -- 工人统计
      COUNT(DISTINCT w.worker_id) as total_workers,
      COUNT(DISTINCT CASE WHEN w.status = 'active' THEN w.worker_id END) as active_workers,
      
      -- 成本统计
      COALESCE(SUM(cs.labor_cost), 0) as total_labor_cost,
      COALESCE(SUM(cs.material_cost), 0) as total_material_cost,
      COALESCE(SUM(cs.tool_cost), 0) as total_tool_cost,
      COALESCE(SUM(cs.total_cost), 0) as total_cost
      
    FROM projects p
    LEFT JOIN process_nodes pn ON p.project_id = pn.project_id
    LEFT JOIN workers w ON p.project_id = w.project_id
    LEFT JOIN cost_summary cs ON p.project_id = cs.project_id
    WHERE p.project_id = $1
    GROUP BY p.project_id, p.project_name, p.budget
  `;

  const result = await pool.query(query, [projectId]);
  return result.rows[0];
};
