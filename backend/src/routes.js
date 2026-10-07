const express = require('express');
const router = express.Router();
const pool = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticate = require('./middleware-auth');
const { STANDARD_PROCESSES } = require('./process-templates');
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
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { name, location, client_name, start_date, planned_end_date } = req.body;
    
    // 1. 创建项目
    const projectResult = await client.query(
      `INSERT INTO projects (name, location, client_name, start_date, planned_end_date, status) 
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [name, location, client_name, start_date, planned_end_date]
    );
    
    const project = projectResult.rows[0];
    
    // 2. 自动创建16个标准工序节点
    for (const template of STANDARD_PROCESSES) {
      // 插入工序节点
      const nodeResult = await client.query(
        `INSERT INTO process_nodes 
         (project_id, process_code, process_name, sequence_number) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [project.id, template.code, JSON.stringify(template.name), template.sequence]
      );
      
      // 为每个节点创建执行记录
      await client.query(
        `INSERT INTO process_execution 
         (process_node_id, status, quantity_unit) 
         VALUES ($1, 'not_started', $2)`,
        [nodeResult.rows[0].id, template.typical_unit]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      data: project,
      message: '项目创建成功，已自动生成16个标准工序'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
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


// ============ 每日进度接口 ============

// 获取今日任务看板
router.get('/projects/:projectId/daily-tasks', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 获取所有进行中的工序
    const result = await pool.query(`
      SELECT 
        pe.*,
        pn.process_code,
        pn.process_name,
        pn.sequence_number,
        dp.quantity_completed as today_completed,
        dp.work_status as today_status
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      LEFT JOIN daily_progress dp ON pe.id = dp.process_execution_id AND dp.date = $1
      WHERE pn.project_id = $2
      ORDER BY pn.sequence_number
    `, [today, req.params.projectId]);
    
    // 按状态分组
    const tasks = {
      in_progress: [],
      waiting_material: [],
      weather_stop: [],
      completed: [],
      not_started: []
    };
    
    result.rows.forEach(row => {
      const status = row.status || 'not_started';
      if (tasks[status]) {
        tasks[status].push(row);
      }
    });
    
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 提交每日进度
router.post('/daily-progress', authenticate, async (req, res) => {
  try {
    const {
      process_execution_id,
      quantity_completed,
      unit,
      work_status,
      notes,
      photos,
      material_used
    } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    
    // 获取工序信息
    const processInfo = await pool.query(
      'SELECT total_completed, planned_quantity FROM process_execution WHERE id = $1',
      [process_execution_id]
    );
    
    if (processInfo.rows.length === 0) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    // 计算累计完成量和百分比
    const previousTotal = parseFloat(processInfo.rows[0].total_completed) || 0;
    const newTotal = previousTotal + parseFloat(quantity_completed);
    const plannedQty = parseFloat(processInfo.rows[0].planned_quantity) || 1;
    const percentage = (newTotal / plannedQty) * 100;
    
    // 插入每日进度记录
    const progressResult = await pool.query(`
      INSERT INTO daily_progress 
      (process_execution_id, date, quantity_completed, unit, total_completed, 
       total_planned, completion_percentage, work_status, notes, photos, 
       material_used, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      process_execution_id,
      today,
      quantity_completed,
      unit,
      newTotal,
      plannedQty,
      percentage,
      work_status,
      notes ? JSON.stringify(notes) : null,
      photos ? JSON.stringify(photos) : null,
      material_used ? JSON.stringify(material_used) : null,
      req.user.id
    ]);
    
    // 更新工序执行表的累计数据
    await pool.query(`
      UPDATE process_execution 
      SET total_completed = $1, 
          completion_percentage = $2,
          status = CASE 
            WHEN $2 >= 100 THEN 'completed'
            WHEN $2 > 0 THEN 'in_progress'
            ELSE status
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newTotal, percentage, process_execution_id]);
    
    res.json({ 
      success: true, 
      data: progressResult.rows[0],
      message: '进度更新成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取工序的历史进度
router.get('/process-execution/:id/progress-history', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM daily_progress 
      WHERE process_execution_id = $1 
      ORDER BY date DESC
      LIMIT 30
    `, [req.params.id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新工序计划总量
router.put('/process-execution/:id/plan', authenticate, async (req, res) => {
  try {
    const { planned_quantity, quantity_unit } = req.body;
    
    const result = await pool.query(`
      UPDATE process_execution 
      SET planned_quantity = $1, 
          quantity_unit = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [planned_quantity, quantity_unit, req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新项目工人信息
router.put('/projects/:id/workers', authenticate, async (req, res) => {
  try {
    const { total_workers, worker_skills } = req.body;
    
    const result = await pool.query(`
      UPDATE projects 
      SET total_workers = $1,
          worker_skills = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [total_workers, worker_skills ? JSON.stringify(worker_skills) : null, req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============ 工序子任务接口 ============

// 获取工序的所有子任务
router.get('/process-execution/:id/subtasks', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM process_subtasks 
      WHERE process_execution_id = $1 
      ORDER BY sequence_number, id
    `, [req.params.id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建子任务
router.post('/process-execution/:id/subtasks', authenticate, async (req, res) => {
  try {
    const {
      subtask_name,
      description,
      planned_quantity,
      quantity_unit,
      sequence_number,
      assigned_workers,
      planned_start_date,
      planned_end_date
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO process_subtasks 
      (process_execution_id, subtask_name, description, planned_quantity, 
       quantity_unit, sequence_number, assigned_workers, planned_start_date, 
       planned_end_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      req.params.id,
      JSON.stringify(subtask_name),
      description ? JSON.stringify(description) : null,
      planned_quantity,
      quantity_unit,
      sequence_number || 0,
      assigned_workers ? JSON.stringify(assigned_workers) : null,
      planned_start_date,
      planned_end_date,
      req.user.id
    ]);
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      message: '子任务创建成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新子任务
router.put('/subtasks/:id', authenticate, async (req, res) => {
  try {
    const {
      subtask_name,
      description,
      planned_quantity,
      quantity_unit,
      status,
      assigned_workers
    } = req.body;
    
    const result = await pool.query(`
      UPDATE process_subtasks 
      SET subtask_name = COALESCE($1, subtask_name),
          description = COALESCE($2, description),
          planned_quantity = COALESCE($3, planned_quantity),
          quantity_unit = COALESCE($4, quantity_unit),
          status = COALESCE($5, status),
          assigned_workers = COALESCE($6, assigned_workers),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [
      subtask_name ? JSON.stringify(subtask_name) : null,
      description ? JSON.stringify(description) : null,
      planned_quantity,
      quantity_unit,
      status,
      assigned_workers ? JSON.stringify(assigned_workers) : null,
      req.params.id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '子任务不存在' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除子任务
router.delete('/subtasks/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM process_subtasks WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '子任务不存在' });
    }
    
    res.json({ success: true, message: '子任务已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新子任务进度
router.post('/subtasks/:id/progress', authenticate, async (req, res) => {
  try {
    const { quantity_completed, work_status, notes, photos } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    
    // 获取子任务信息
    const subtaskInfo = await pool.query(
      'SELECT * FROM process_subtasks WHERE id = $1',
      [req.params.id]
    );
    
    if (subtaskInfo.rows.length === 0) {
      return res.status(404).json({ success: false, message: '子任务不存在' });
    }
    
    const subtask = subtaskInfo.rows[0];
    const previousTotal = parseFloat(subtask.total_completed) || 0;
    const newTotal = previousTotal + parseFloat(quantity_completed);
    const plannedQty = parseFloat(subtask.planned_quantity) || 1;
    const percentage = Math.min((newTotal / plannedQty) * 100, 100);
    
    // 更新子任务进度
    await pool.query(`
      UPDATE process_subtasks 
      SET total_completed = $1,
          completion_percentage = $2,
          status = CASE 
            WHEN $2 >= 100 THEN 'completed'
            WHEN $2 > 0 THEN 'in_progress'
            ELSE status
          END,
          actual_start_date = COALESCE(actual_start_date, CURRENT_DATE),
          actual_end_date = CASE WHEN $2 >= 100 THEN CURRENT_DATE ELSE actual_end_date END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newTotal, percentage, req.params.id]);
    
    // 插入每日进度记录（关联子任务）
    const progressResult = await pool.query(`
      INSERT INTO daily_progress 
      (process_execution_id, subtask_id, date, quantity_completed, unit, 
       total_completed, total_planned, completion_percentage, work_status, 
       notes, photos, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      subtask.process_execution_id,
      req.params.id,
      today,
      quantity_completed,
      subtask.quantity_unit,
      newTotal,
      plannedQty,
      percentage,
      work_status || 'normal',
      notes ? JSON.stringify(notes) : null,
      photos ? JSON.stringify(photos) : null,
      req.user.id
    ]);
    
    // 重新计算大工序的总进度（所有子任务的加权平均）
    await recalculateProcessProgress(subtask.process_execution_id);
    
    res.json({ 
      success: true, 
      data: progressResult.rows[0],
      message: '进度更新成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 辅助函数：重新计算大工序进度
async function recalculateProcessProgress(processExecutionId) {
  const subtasks = await pool.query(
    'SELECT planned_quantity, total_completed FROM process_subtasks WHERE process_execution_id = $1',
    [processExecutionId]
  );
  
  if (subtasks.rows.length === 0) {
    // 没有子任务，不更新
    return;
  }
  
  let totalPlanned = 0;
  let totalCompleted = 0;
  
  subtasks.rows.forEach(st => {
    const planned = parseFloat(st.planned_quantity) || 0;
    const completed = parseFloat(st.total_completed) || 0;
    totalPlanned += planned;
    totalCompleted += completed;
  });
  
  const percentage = totalPlanned > 0 ? (totalCompleted / totalPlanned) * 100 : 0;
  
  await pool.query(`
    UPDATE process_execution 
    SET total_completed = $1,
        planned_quantity = $2,
        completion_percentage = $3,
        status = CASE 
          WHEN $3 >= 100 THEN 'completed'
          WHEN $3 > 0 THEN 'in_progress'
          ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `, [totalCompleted, totalPlanned, percentage, processExecutionId]);
}
