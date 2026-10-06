const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth');
const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

// 项目列表
router.get('/projects', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建项目
router.post('/projects', authenticate, async (req, res) => {
  try {
    const { project_name, address } = req.body;
    const result = await pool.query(
      'INSERT INTO projects (project_name, address, created_by, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_name, address, req.user.user_id, 'planning']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 工序库
router.get('/processes/library', authenticate, async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../data/processes.json');
    const data = await fs.readFile(filePath, 'utf8');
    res.json({ success: true, data: JSON.parse(data) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 项目工序列表
router.get('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM process_nodes WHERE project_id = $1 ORDER BY sequence',
      [req.params.projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加工序
router.post('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const { process_code, process_name } = req.body;
    const result = await pool.query(
      'INSERT INTO process_nodes (project_id, process_code, process_name, status, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.projectId, process_code, process_name, 'pending', req.user.user_id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 工序打卡
router.post('/processes/:nodeId/checkin', authenticate, async (req, res) => {
  try {
    const { action } = req.body;
    const status = action === 'start' ? 'in_progress' : 'completed';
    const field = action === 'start' ? 'actual_start_date' : 'actual_end_date';
    
    const result = await pool.query(
      `UPDATE process_nodes SET status = $1, ${field} = CURRENT_TIMESTAMP WHERE node_id = $2 RETURNING *`,
      [status, req.params.nodeId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 工人列表
router.get('/projects/:projectId/workers', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workers WHERE project_id = $1',
      [req.params.projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加工人
router.post('/projects/:projectId/workers', authenticate, async (req, res) => {
  try {
    const { name, role, phone, daily_wage } = req.body;
    const result = await pool.query(
      'INSERT INTO workers (project_id, name, role, phone, daily_wage, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.projectId, name, role, phone, daily_wage || 0, 'active']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 考勤记录
router.get('/projects/:projectId/attendance', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT da.*, w.name FROM daily_attendance da LEFT JOIN workers w ON da.worker_id = w.worker_id WHERE da.project_id = $1',
      [req.params.projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 记录考勤
router.post('/projects/:projectId/attendance', authenticate, async (req, res) => {
  try {
    const { worker_id, date, status } = req.body;
    const result = await pool.query(
      'INSERT INTO daily_attendance (project_id, worker_id, attendance_date, status, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.projectId, worker_id, date, status, req.user.user_id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
