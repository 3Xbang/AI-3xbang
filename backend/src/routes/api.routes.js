const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth');
const pool = require('../config/db');

// ============================================================
// 项目管理 API
// ============================================================

// 获取所有项目
router.get('/projects', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取项目详情
router.get('/projects/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [req.params.id]
    );
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
    const { project_name, location, start_date } = req.body;
    const result = await pool.query(
      'INSERT INTO projects (project_name, location, start_date, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_name, location, start_date || new Date(), 'active']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 工序管理 API
// ============================================================

// 获取所有标准工序
router.get('/processes', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM process_nodes ORDER BY sort_order'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取项目工序列表（标准工序 + 项目执行状态）
router.get('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pn.id,
        pn.node_name,
        pn.node_code,
        pn.sort_order,
        pn.description,
        pe.status,
        pe.actual_start_date,
        pe.actual_end_date
      FROM process_nodes pn
      LEFT JOIN process_execution pe ON pn.id = pe.process_node_id AND pe.project_id = $1
      ORDER BY pn.sort_order
    `, [req.params.projectId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 工序打卡
router.post('/projects/:projectId/processes/:processId/checkin', authenticate, async (req, res) => {
  try {
    const { projectId, processId } = req.params;
    const { action } = req.body; // start 或 complete
    
    // 检查是否已有记录
    const existing = await pool.query(
      'SELECT * FROM process_execution WHERE project_id = $1 AND process_node_id = $2',
      [projectId, processId]
    );
    
    if (existing.rows.length === 0) {
      // 创建新记录
      const result = await pool.query(
        'INSERT INTO process_execution (project_id, process_node_id, status, actual_start_date) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
        [projectId, processId, 'in_progress']
      );
      return res.json({ success: true, data: result.rows[0] });
    } else {
      // 更新现有记录
      let status = action === 'complete' ? 'completed' : 'in_progress';
      let updateField = action === 'complete' ? 'actual_end_date = CURRENT_TIMESTAMP' : '';
      
      const result = await pool.query(
        `UPDATE process_execution SET status = $1 ${updateField ? ', ' + updateField : ''} WHERE project_id = $2 AND process_node_id = $3 RETURNING *`,
        [status, projectId, processId]
      );
      return res.json({ success: true, data: result.rows[0] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 材料管理 API
// ============================================================

// 获取材料库
router.get('/materials/library', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM material_library ORDER BY category, material_code'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取项目材料列表
router.get('/projects/:projectId/materials', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM project_materials WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加项目材料需求
router.post('/projects/:projectId/materials', authenticate, async (req, res) => {
  try {
    const { material_id, material_name, planned_quantity, unit, unit_price, planned_date, supplier, notes } = req.body;
    const total_cost = planned_quantity * (unit_price || 0);
    
    const result = await pool.query(
      `INSERT INTO project_materials 
       (project_id, material_id, material_name, planned_quantity, unit, unit_price, total_cost, planned_date, supplier, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'planned') 
       RETURNING *`,
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
    const material = await pool.query(
      'SELECT * FROM project_materials WHERE id = $1',
      [req.params.materialId]
    );
    
    if (material.rows.length === 0) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    const mat = material.rows[0];
    const newReceived = parseFloat(mat.received_quantity || 0) + parseFloat(quantity);
    const newStatus = newReceived >= mat.planned_quantity ? 'received' : 'partial';
    
    const result = await pool.query(
      `UPDATE project_materials 
       SET received_quantity = $1, actual_date = $2, status = $3, notes = $4, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING *`,
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

// ============================================================
// 工人管理 API
// ============================================================

// 获取项目工人列表
router.get('/projects/:projectId/workers', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM workers WHERE project_id = $1 ORDER BY created_at DESC',
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

// 更新工人信息
router.put('/workers/:workerId', authenticate, async (req, res) => {
  try {
    const { name, role, phone, daily_wage, status } = req.body;
    
    const result = await pool.query(
      'UPDATE workers SET name = $1, role = $2, phone = $3, daily_wage = $4, status = $5 WHERE worker_id = $6 RETURNING *',
      [name, role, phone, daily_wage, status, req.params.workerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '工人不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除工人
router.delete('/workers/:workerId', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM workers WHERE worker_id = $1', [req.params.workerId]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 考勤管理 API
// ============================================================

// 获取项目考勤记录
router.get('/projects/:projectId/attendance', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    
    let query = `
      SELECT 
        da.*,
        w.name as worker_name,
        w.role as worker_role,
        w.daily_wage
      FROM daily_attendance da
      JOIN workers w ON da.worker_id = w.worker_id
      WHERE da.project_id = $1
    `;
    
    const params = [req.params.projectId];
    
    if (date) {
      query += ' AND da.attendance_date = $2';
      params.push(date);
    }
    
    query += ' ORDER BY da.attendance_date DESC, w.name';
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 记录考勤
router.post('/projects/:projectId/attendance', authenticate, async (req, res) => {
  try {
    const { worker_id, attendance_date, status, hours_worked, notes } = req.body;
    
    // 检查是否已有当天记录
    const existing = await pool.query(
      'SELECT * FROM daily_attendance WHERE worker_id = $1 AND attendance_date = $2',
      [worker_id, attendance_date]
    );
    
    if (existing.rows.length > 0) {
      // 更新现有记录
      const result = await pool.query(
        'UPDATE daily_attendance SET status = $1, hours_worked = $2, notes = $3 WHERE id = $4 RETURNING *',
        [status, hours_worked, notes, existing.rows[0].id]
      );
      return res.json({ success: true, data: result.rows[0] });
    } else {
      // 创建新记录
      const result = await pool.query(
        'INSERT INTO daily_attendance (project_id, worker_id, attendance_date, status, hours_worked, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [req.params.projectId, worker_id, attendance_date, status, hours_worked, notes, req.user.user_id]
      );
      return res.json({ success: true, data: result.rows[0] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量记录考勤
router.post('/projects/:projectId/attendance/batch', authenticate, async (req, res) => {
  try {
    const { attendance_date, records } = req.body; // records: [{worker_id, status, hours_worked}]
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const record of records) {
        const { worker_id, status, hours_worked, notes } = record;
        
        // 检查是否已有记录
        const existing = await client.query(
          'SELECT * FROM daily_attendance WHERE worker_id = $1 AND attendance_date = $2',
          [worker_id, attendance_date]
        );
        
        if (existing.rows.length > 0) {
          // 更新
          const result = await client.query(
            'UPDATE daily_attendance SET status = $1, hours_worked = $2, notes = $3 WHERE id = $4 RETURNING *',
            [status, hours_worked, notes, existing.rows[0].id]
          );
          results.push(result.rows[0]);
        } else {
          // 插入
          const result = await client.query(
            'INSERT INTO daily_attendance (project_id, worker_id, attendance_date, status, hours_worked, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [req.params.projectId, worker_id, attendance_date, status, hours_worked, notes, req.user.user_id]
          );
          results.push(result.rows[0]);
        }
      }
      
      await client.query('COMMIT');
      res.json({ success: true, data: results });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
