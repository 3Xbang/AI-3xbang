const express = require('express');
const router = express.Router();
const pool = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticate = require('./middleware-auth');
const multer = require('multer');
const path = require('path');

// 照片上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('只允许上传jpg/png图片'));
  }
});

// ============ 认证接口 ============
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 项目接口 ============
router.get('/projects', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        COALESCE(ROUND(AVG(CASE WHEN pe.status = 'completed' THEN 100 ELSE 0 END)), 0) as progress
      FROM projects p
      LEFT JOIN process_nodes pn ON p.id = pn.project_id
      LEFT JOIN process_execution pe ON pn.id = pe.process_node_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/projects', authenticate, async (req, res) => {
  try {
    const { name, location, client_name, start_date, planned_end_date } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (name, location, client_name, start_date, planned_end_date, status) 
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [name, location, client_name, start_date, planned_end_date]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/projects/:id/summary', authenticate, async (req, res) => {
  try {
    const project = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    
    const processes = await pool.query(`
      SELECT pe.*, pn.process_code, pn.process_name, pn.sequence_number
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pn.project_id = $1
      ORDER BY pn.sequence_number
    `, [req.params.id]);
    
    const issues = processes.rows.filter(p => p.status === 'waiting_material' || p.status === 'weather_stop');
    
    const summary = {
      completed: processes.rows.filter(p => p.status === 'completed').length,
      in_progress: processes.rows.filter(p => p.status === 'in_progress').length,
      waiting_material: processes.rows.filter(p => p.status === 'waiting_material').length,
      pending: processes.rows.filter(p => p.status === 'pending').length
    };
    
    res.json({
      success: true,
      data: {
        project: project.rows[0],
        current_issues: issues,
        process_summary: summary
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 工序接口 ============
router.get('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pe.*, pn.process_code, pn.process_name, pn.sequence_number
      FROM process_nodes pn
      LEFT JOIN process_execution pe ON pn.id = pe.process_node_id
      WHERE pn.project_id = $1
      ORDER BY pn.sequence_number
    `, [req.params.projectId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const { process_node_id, assigned_workers, estimated_days, dimensions } = req.body;
    
    // 材料计算逻辑（简化版）
    const calculated_materials = calculateMaterials(dimensions);
    
    const result = await pool.query(`
      INSERT INTO process_execution 
      (project_id, process_node_id, assigned_workers, estimated_days, dimensions, calculated_materials, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [req.params.projectId, process_node_id, assigned_workers, estimated_days, JSON.stringify(dimensions), JSON.stringify(calculated_materials)]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/processes/:id', authenticate, async (req, res) => {
  try {
    const { status, actual_start_date, actual_end_date, notes } = req.body;
    const result = await pool.query(`
      UPDATE process_execution 
      SET status = COALESCE($1, status),
          actual_start_date = COALESCE($2, actual_start_date),
          actual_end_date = COALESCE($3, actual_end_date),
          notes = COALESCE($4, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [status, actual_start_date, actual_end_date, notes, req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 材料接口 ============
router.get('/projects/:projectId/materials', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM materials WHERE project_id = $1';
    const params = [req.params.projectId];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    
    // 计算库存
    const data = result.rows.map(m => ({
      ...m,
      stock: parseFloat(m.received_quantity) - parseFloat(m.used_quantity)
    }));
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/materials', authenticate, async (req, res) => {
  try {
    const { project_id, material_name, material_code, unit, purchase_quantity, unit_price, supplier, expected_arrival_date } = req.body;
    const total_cost = purchase_quantity * (unit_price || 0);
    
    const result = await pool.query(`
      INSERT INTO materials 
      (project_id, material_code, material_name, unit, purchase_quantity, unit_price, total_cost, supplier, expected_arrival_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ordered')
      RETURNING *
    `, [project_id, material_code, JSON.stringify(material_name), JSON.stringify(unit), purchase_quantity, unit_price, total_cost, supplier, expected_arrival_date]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/materials/:id/receive', authenticate, async (req, res) => {
  try {
    const { received_quantity, actual_arrival_date, notes } = req.body;
    const result = await pool.query(`
      UPDATE materials 
      SET received_quantity = $1,
          actual_arrival_date = $2,
          notes = $3,
          status = 'arrived',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [received_quantity, actual_arrival_date, notes, req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/materials/:id/use', authenticate, async (req, res) => {
  try {
    const { process_execution_id, quantity_used, usage_date } = req.body;
    
    await pool.query('BEGIN');
    
    // 记录使用
    await pool.query(
      'INSERT INTO material_usage (material_id, process_execution_id, quantity_used, usage_date) VALUES ($1, $2, $3, $4)',
      [req.params.id, process_execution_id, quantity_used, usage_date]
    );
    
    // 更新材料已用量
    const result = await pool.query(`
      UPDATE materials 
      SET used_quantity = used_quantity + $1,
          status = CASE 
            WHEN (received_quantity - used_quantity - $1) <= 0 THEN 'depleted'
            ELSE 'in_use'
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [quantity_used, req.params.id]);
    
    await pool.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 照片接口 ============
router.post('/photos/upload', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const { project_id, process_execution_id, material_id, photo_type } = req.body;
    
    const result = await pool.query(`
      INSERT INTO photos 
      (project_id, process_execution_id, material_id, photo_url, photo_type, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      project_id, 
      process_execution_id || null, 
      material_id || null, 
      `/uploads/${req.file.filename}`,
      photo_type,
      req.file.size,
      req.user.username
    ]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/photos/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM photos WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 材料计算函数 ============
function calculateMaterials(dimensions) {
  const { length, width, height, depth, area, volume } = dimensions;
  // 简化版计算，实际根据工序不同计算
  return [
    {
      material_name: { zh: '水泥', th: 'ปูนซีเมนต์' },
      quantity: (volume || length * width * (height || depth || 0.1)) * 0.35,
      unit: { zh: '吨', th: 'ตัน' }
    }
  ];
}

module.exports = router;
