const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const { successResponse } = require('../utils/response');

// 获取工序库
exports.getProcessLibrary = async (req, res, next) => {
  try {
    const filePath = path.join(__dirname, '../../data/processes.json');
    const data = await fs.readFile(filePath, 'utf8');
    const processes = JSON.parse(data);
    return successResponse(res, processes);
  } catch (error) {
    next(error);
  }
};

// 获取项目工序列表
exports.getProjectProcesses = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query(
      'SELECT * FROM process_nodes WHERE project_id = $1 ORDER BY sequence',
      [projectId]
    );
    return successResponse(res, result.rows);
  } catch (error) {
    next(error);
  }
};

// 添加工序
exports.addProcess = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { process_code, process_name, sequence } = req.body;
    const { user_id } = req.user;
    
    const result = await pool.query(
      `INSERT INTO process_nodes (project_id, process_code, process_name, sequence, status, created_by) 
       VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING *`,
      [projectId, process_code, process_name, sequence || 0, user_id]
    );
    
    return successResponse(res, result.rows[0], '添加成功', 201);
  } catch (error) {
    next(error);
  }
};

// 工序打卡
exports.checkin = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { action } = req.body; // 'start' or 'complete'
    const { user_id } = req.user;
    
    let status, dateField;
    if (action === 'start') {
      status = 'in_progress';
      dateField = 'actual_start_date';
    } else {
      status = 'completed';
      dateField = 'actual_end_date';
    }
    
    const result = await pool.query(
      `UPDATE process_nodes SET status = $1, ${dateField} = CURRENT_TIMESTAMP, operator_id = $2 
       WHERE node_id = $3 RETURNING *`,
      [status, user_id, nodeId]
    );
    
    return successResponse(res, result.rows[0], '打卡成功');
  } catch (error) {
    next(error);
  }
};
