const pool = require('../config/db');
const { successResponse } = require('../utils/response');

// 获取工人列表
exports.getWorkers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const result = await pool.query(
      'SELECT * FROM workers WHERE project_id = $1 ORDER BY join_date DESC',
      [projectId]
    );
    return successResponse(res, result.rows);
  } catch (error) {
    next(error);
  }
};

// 添加工人
exports.addWorker = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, role, phone, daily_wage } = req.body;
    
    const result = await pool.query(
      `INSERT INTO workers (project_id, name, role, phone, daily_wage, status) 
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [projectId, name, role, phone, daily_wage || 0]
    );
    
    return successResponse(res, result.rows[0], '添加成功', 201);
  } catch (error) {
    next(error);
  }
};

// 获取考勤记录
exports.getAttendance = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { date } = req.query;
    
    let query = `
      SELECT da.*, w.name as worker_name, w.role as worker_role, w.daily_wage
      FROM daily_attendance da
      LEFT JOIN workers w ON da.worker_id = w.worker_id
      WHERE da.project_id = $1
    `;
    const params = [projectId];
    
    if (date) {
      query += ' AND da.attendance_date = $2';
      params.push(date);
    }
    
    query += ' ORDER BY da.attendance_date DESC, w.name';
    
    const result = await pool.query(query, params);
    return successResponse(res, result.rows);
  } catch (error) {
    next(error);
  }
};

// 记录考勤
exports.recordAttendance = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { worker_id, date, status, work_hours } = req.body;
    const { user_id } = req.user;
    
    // 获取工人日薪
    const workerResult = await pool.query(
      'SELECT daily_wage FROM workers WHERE worker_id = $1',
      [worker_id]
    );
    
    if (workerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '工人不存在' });
    }
    
    const dailyWage = parseFloat(workerResult.rows[0].daily_wage);
    let dailyCost = 0;
    
    if (status === 'present') {
      dailyCost = dailyWage;
    } else if (status === 'half-day') {
      dailyCost = dailyWage * 0.5;
    }
    
    const result = await pool.query(
      `INSERT INTO daily_attendance (project_id, worker_id, attendance_date, status, work_hours, daily_cost, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (worker_id, attendance_date) 
       DO UPDATE SET status = $4, work_hours = $5, daily_cost = $6
       RETURNING *`,
      [projectId, worker_id, date, status, work_hours || 8, dailyCost, user_id]
    );
    
    return successResponse(res, result.rows[0], '考勤记录成功');
  } catch (error) {
    next(error);
  }
};
