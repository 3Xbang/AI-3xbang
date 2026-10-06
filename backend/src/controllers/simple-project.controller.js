const pool = require('../config/db');
const { successResponse } = require('../utils/response');

// 获取项目列表
exports.getProjects = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    return successResponse(res, result.rows);
  } catch (error) {
    next(error);
  }
};

// 创建项目
exports.createProject = async (req, res, next) => {
  try {
    const { project_name, address, client_name, budget } = req.body;
    const { user_id } = req.user;
    
    const result = await pool.query(
      `INSERT INTO projects (project_name, address, client_name, budget, created_by, status) 
       VALUES ($1, $2, $3, $4, $5, 'planning') RETURNING *`,
      [project_name, address, client_name, budget, user_id]
    );
    
    return successResponse(res, result.rows[0], '创建成功', 201);
  } catch (error) {
    next(error);
  }
};

// 获取项目详情
exports.getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    return successResponse(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// 更新项目
exports.updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { project_name, address, status } = req.body;
    
    const result = await pool.query(
      `UPDATE projects SET project_name = $1, address = $2, status = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE project_id = $4 RETURNING *`,
      [project_name, address, status, id]
    );
    
    return successResponse(res, result.rows[0], '更新成功');
  } catch (error) {
    next(error);
  }
};
