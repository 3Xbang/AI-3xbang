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

// ============================================================
// 工序测量数据 API（新增）
// ============================================================

// 获取工序测量模板（获取该工序需要输入哪些测量字段）
router.get('/processes/:nodeCode/measurement-template', authenticate, async (req, res) => {
  try {
    // 从 processes.json 读取模板（实际应用中应该存储在数据库）
    const fs = require('fs');
    const path = require('path');
    const processesData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../data/processes.json'), 'utf8')
    );
    
    const process = processesData.processes.find(p => p.node_code === req.params.nodeCode);
    if (!process) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    res.json({ 
      success: true, 
      data: {
        node_code: process.node_code,
        name_i18n: process.name_i18n,
        base_data_schema: process.base_data_schema,
        material_quotas: process.material_quotas,
        worker_quota: process.worker_quota,
        tool_codes: process.tool_codes
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 保存工序测量数据
router.post('/projects/:projectId/processes/:processNodeId/measurements', authenticate, async (req, res) => {
  try {
    const { projectId, processNodeId } = req.params;
    const { length, width, height, area, volume, quantity, extra_data, notes } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 1. 获取或创建 process_execution 记录
      let execution = await client.query(
        'SELECT * FROM process_execution WHERE project_id = $1 AND process_node_id = $2',
        [projectId, processNodeId]
      );
      
      if (execution.rows.length === 0) {
        execution = await client.query(
          'INSERT INTO process_execution (project_id, process_node_id, status) VALUES ($1, $2, $3) RETURNING *',
          [projectId, processNodeId, 'pending']
        );
      }
      
      const executionId = execution.rows[0].id;
      
      // 2. 检查是否已有测量数据
      const existing = await client.query(
        'SELECT * FROM process_measurements WHERE process_execution_id = $1',
        [executionId]
      );
      
      let measurement;
      if (existing.rows.length > 0) {
        // 更新现有测量
        measurement = await client.query(
          `UPDATE process_measurements 
           SET length = $1, width = $2, height = $3, area = $4, volume = $5, 
               quantity = $6, extra_data = $7, notes = $8, measured_by = $9, 
               measured_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $10 
           RETURNING *`,
          [length, width, height, area, volume, quantity, extra_data, notes, 
           req.user.user_id, existing.rows[0].id]
        );
      } else {
        // 创建新测量
        measurement = await client.query(
          `INSERT INTO process_measurements 
           (process_execution_id, length, width, height, area, volume, quantity, 
            extra_data, notes, measured_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
           RETURNING *`,
          [executionId, length, width, height, area, volume, quantity, 
           extra_data, notes, req.user.user_id]
        );
      }
      
      // 3. 计算材料用量（JavaScript实现）
      const nodeCode = await client.query(
        'SELECT pn.node_code FROM process_nodes pn JOIN process_execution pe ON pn.id = pe.process_node_id WHERE pe.id = $1',
        [executionId]
      );
      
      const code = nodeCode.rows[0].node_code;
      const materials = calculateMaterialsForProcess(code, measurement.rows[0]);
      
      // 4. 保存材料计算结果
      if (materials.length > 0) {
        // 删除旧的计算结果
        await client.query(
          'DELETE FROM process_material_calculations WHERE process_measurement_id = $1',
          [measurement.rows[0].id]
        );
        
        // 插入新的计算结果
        for (const mat of materials) {
          await client.query(
            `INSERT INTO process_material_calculations 
             (process_measurement_id, material_code, material_name, calculated_quantity, 
              unit, unit_price, total_cost, calculation_formula)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [measurement.rows[0].id, mat.material_code, mat.material_name, 
             mat.calculated_quantity, mat.unit, mat.unit_price, mat.total_cost,
             mat.formula]
          );
        }
      }
      
      await client.query('COMMIT');
      res.json({ 
        success: true, 
        data: {
          measurement: measurement.rows[0],
          calculated_materials: materials
        }
      });
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

// 材料计算辅助函数
function calculateMaterialsForProcess(nodeCode, measurement) {
  const { length, width, height, area, volume, quantity } = measurement;
  const materials = [];
  
  // 计算实际体积/面积
  const actualVolume = volume || (length * width * height) || 0;
  const actualArea = area || (length * width) || (length * height) || 0;
  
  if (nodeCode === 'N01_EXCAVATION') {
    // 土方开挖：回填土（5%）
    materials.push({
      material_code: 'M002',
      material_name: '砂',
      calculated_quantity: parseFloat((actualVolume * 0.05 * 1.6).toFixed(3)),
      unit: '吨',
      unit_price: 450.00,
      total_cost: parseFloat((actualVolume * 0.05 * 1.6 * 450).toFixed(2)),
      formula: '体积 × 5% × 砂密度1.6吨/m³'
    });
  } else if (nodeCode === 'N02_FOUNDATION') {
    // 基础浇筑：水泥、砂、碎石、钢筋
    materials.push({
      material_code: 'M001',
      material_name: '水泥',
      calculated_quantity: parseFloat((actualVolume * 0.35 * 1.4 * 1.02).toFixed(3)),
      unit: '吨',
      unit_price: 3200.00,
      total_cost: parseFloat((actualVolume * 0.35 * 1.4 * 1.02 * 3200).toFixed(2)),
      formula: '体积 × 水泥定额0.35 × 密度1.4 × 损耗1.02'
    });
    materials.push({
      material_code: 'M002',
      material_name: '砂',
      calculated_quantity: parseFloat((actualVolume * 0.65 * 1.6 * 1.02).toFixed(3)),
      unit: '吨',
      unit_price: 450.00,
      total_cost: parseFloat((actualVolume * 0.65 * 1.6 * 1.02 * 450).toFixed(2)),
      formula: '体积 × 砂定额0.65 × 密度1.6 × 损耗1.02'
    });
    materials.push({
      material_code: 'M003',
      material_name: '碎石',
      calculated_quantity: parseFloat((actualVolume * 1.2 * 1.7 * 1.02).toFixed(3)),
      unit: '吨',
      unit_price: 380.00,
      total_cost: parseFloat((actualVolume * 1.2 * 1.7 * 1.02 * 380).toFixed(2)),
      formula: '体积 × 碎石定额1.2 × 密度1.7 × 损耗1.02'
    });
    materials.push({
      material_code: 'M004',
      material_name: '钢筋',
      calculated_quantity: parseFloat((actualVolume * 45 * 1.05 / 1000).toFixed(3)),
      unit: '吨',
      unit_price: 22000.00,
      total_cost: parseFloat((actualVolume * 45 * 1.05 / 1000 * 22000).toFixed(2)),
      formula: '体积 × 钢筋定额45kg/m³ × 损耗1.05 ÷ 1000'
    });
  } else if (nodeCode === 'N08_WALL_PARTITION') {
    // 砌墙：红砖、水泥
    materials.push({
      material_code: 'M005',
      material_name: '红砖',
      calculated_quantity: parseFloat((actualArea * 128 * 1.03).toFixed(3)),
      unit: '块',
      unit_price: 1.80,
      total_cost: parseFloat((actualArea * 128 * 1.03 * 1.80).toFixed(2)),
      formula: '面积 × 128块/m² × 损耗1.03'
    });
    materials.push({
      material_code: 'M001',
      material_name: '水泥',
      calculated_quantity: parseFloat((actualArea * 0.05 * 1.4 * 1.02).toFixed(3)),
      unit: '吨',
      unit_price: 3200.00,
      total_cost: parseFloat((actualArea * 0.05 * 1.4 * 1.02 * 3200).toFixed(2)),
      formula: '面积 × 水泥定额0.05 × 密度1.4 × 损耗1.02'
    });
  } else if (nodeCode === 'N07_WATERPROOF') {
    // 防水：防水涂料
    materials.push({
      material_code: 'M018',
      material_name: '防水涂料',
      calculated_quantity: parseFloat((actualArea * 2.5 * 1.05).toFixed(3)),
      unit: '千克',
      unit_price: 85.00,
      total_cost: parseFloat((actualArea * 2.5 * 1.05 * 85).toFixed(2)),
      formula: '面积 × 2.5kg/m² × 损耗1.05'
    });
  } else if (nodeCode === 'N10_TILING') {
    // 瓷砖铺贴
    materials.push({
      material_code: 'M019',
      material_name: '墙砖',
      calculated_quantity: parseFloat((actualArea * 1.05).toFixed(3)),
      unit: '平方米',
      unit_price: 350.00,
      total_cost: parseFloat((actualArea * 1.05 * 350).toFixed(2)),
      formula: '面积 × 损耗1.05'
    });
    materials.push({
      material_code: 'M020',
      material_name: '瓷砖胶',
      calculated_quantity: parseFloat((actualArea * 5 * 1.03).toFixed(3)),
      unit: '千克',
      unit_price: 12.00,
      total_cost: parseFloat((actualArea * 5 * 1.03 * 12).toFixed(2)),
      formula: '面积 × 5kg/m² × 损耗1.03'
    });
  }
  
  return materials;
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

// 获取工序测量数据
router.get('/projects/:projectId/processes/:processNodeId/measurements', authenticate, async (req, res) => {
  try {
    const { projectId, processNodeId } = req.params;
    
    // 获取测量数据
    const result = await pool.query(`
      SELECT 
        pm.*,
        pe.status as execution_status,
        u.full_name as measured_by_name
      FROM process_measurements pm
      JOIN process_execution pe ON pm.process_execution_id = pe.id
      LEFT JOIN users u ON pm.measured_by = u.user_id
      WHERE pe.project_id = $1 AND pe.process_node_id = $2
      ORDER BY pm.measured_at DESC
      LIMIT 1
    `, [projectId, processNodeId]);
    
    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }
    
    // 获取计算的材料
    const materials = await pool.query(`
      SELECT * FROM process_material_calculations 
      WHERE process_measurement_id = $1
      ORDER BY material_code
    `, [result.rows[0].id]);
    
    res.json({ 
      success: true, 
      data: {
        measurement: result.rows[0],
        calculated_materials: materials.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取工序工具需求
router.get('/processes/:processNodeId/tools', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM process_tool_requirements WHERE process_node_id = $1 ORDER BY tool_code',
      [req.params.processNodeId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取项目所有工序的测量汇总
router.get('/projects/:projectId/measurements/summary', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pn.id as process_node_id,
        pn.node_name,
        pn.node_code,
        pn.sort_order,
        pm.id as measurement_id,
        pm.length,
        pm.width,
        pm.height,
        pm.area,
        pm.volume,
        pm.quantity,
        pm.calculated_material_cost,
        pm.calculated_labor_days,
        pm.calculated_workers_needed,
        pm.measured_at,
        pe.status as execution_status,
        u.full_name as measured_by_name
      FROM process_nodes pn
      LEFT JOIN process_execution pe ON pn.id = pe.process_node_id AND pe.project_id = $1
      LEFT JOIN process_measurements pm ON pe.id = pm.process_execution_id
      LEFT JOIN users u ON pm.measured_by = u.user_id
      ORDER BY pn.sort_order
    `, [req.params.projectId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
