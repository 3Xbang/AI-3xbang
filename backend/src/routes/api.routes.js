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

// 项目详情
router.get('/projects/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建项目
router.post('/projects', authenticate, async (req, res) => {
  try {
    const { project_name, location } = req.body;
    const result = await pool.query(
      'INSERT INTO projects (project_name, location, start_date, status) VALUES ($1, $2, CURRENT_DATE, $3) RETURNING *',
      [project_name, location, 'active']
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

// 项目工序列表 - 使用别名映射字段名
router.get('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id as node_id, node_name as process_name, node_code as process_code, sort_order, description, NULL as status, NULL as actual_start_date, NULL as actual_end_date FROM process_nodes ORDER BY sort_order'
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

// 材料库列表
router.get('/materials/library', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM material_library ORDER BY category, material_code');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 项目材料列表
router.get('/projects/:projectId/materials', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM project_materials WHERE project_id = $1 ORDER BY created_at DESC', [req.params.projectId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加材料需求
router.post('/projects/:projectId/materials', authenticate, async (req, res) => {
  try {
    const { material_id, material_name, planned_quantity, unit, unit_price, planned_date, supplier, notes } = req.body;
    const total_cost = planned_quantity * (unit_price || 0);
    
    const result = await pool.query(
      `INSERT INTO project_materials (project_id, material_id, material_name, planned_quantity, unit, unit_price, total_cost, planned_date, supplier, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'planned') RETURNING *`,
      [req.params.projectId, material_id, material_name, planned_quantity, unit, unit_price, total_cost, planned_date, supplier, notes]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 材料到货登记
router.post('/materials/:materialId/receive', authenticate, async (req, res) => {
  try {
    const { quantity, receive_date, notes } = req.body;
    
    // 获取当前材料信息
    const material = await pool.query('SELECT * FROM project_materials WHERE id = $1', [req.params.materialId]);
    if (material.rows.length === 0) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    const mat = material.rows[0];
    const newReceived = parseFloat(mat.received_quantity || 0) + parseFloat(quantity);
    const newStatus = newReceived >= mat.planned_quantity ? 'received' : 'partial';
    
    const result = await pool.query(
      `UPDATE project_materials 
       SET received_quantity = $1, actual_date = $2, status = $3, notes = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 RETURNING *`,
      [newReceived, receive_date, newStatus, notes, req.params.materialId]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除材料
router.delete('/materials/:materialId', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM project_materials WHERE id = $1', [req.params.materialId]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
