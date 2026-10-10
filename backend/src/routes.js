const express = require('express');
const router = express.Router();
const pool = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticate = require('./middleware-auth');
const { requirePermission, requireProjectAccess, checkProjectAccess, logActivity } = require('./middleware-permissions');
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
    let query;
    const params = [];
    
    // 管理者可以看到所有项目
    if (req.user.role === 'manager') {
      query = `
        SELECT p.*,
          COALESCE(ROUND(AVG(CASE WHEN pe.status = 'completed' THEN 100 ELSE 0 END)), 0) as progress
        FROM projects p
        LEFT JOIN process_nodes pn ON p.id = pn.project_id
        LEFT JOIN process_execution pe ON pn.id = pe.process_node_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
    } else {
      // 采购者和执行者只能看到分配给自己的项目
      query = `
        SELECT p.*,
          COALESCE(ROUND(AVG(CASE WHEN pe.status = 'completed' THEN 100 ELSE 0 END)), 0) as progress
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN process_nodes pn ON p.id = pn.project_id
        LEFT JOIN process_execution pe ON pn.id = pe.process_node_id
        WHERE pm.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
      params.push(req.user.id);
    }
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/projects', authenticate, requirePermission('create_project'), async (req, res) => {
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
    
    // 2. 自动将创建者添加为项目成员
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role, assigned_by) 
       VALUES ($1, $2, $3, $4)`,
      [project.id, req.user.id, req.user.role, req.user.id]
    );
    
    // 3. 自动创建16个标准工序节点
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
    
    // 4. 记录活动日志
    await logActivity(client, req.user.id, 'create_project', 'projects', project.id, 
      `创建项目: ${name}`);
    
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

router.get('/projects/:id/summary', authenticate, requireProjectAccess(), async (req, res) => {
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
router.get('/projects/:projectId/processes', authenticate, requireProjectAccess(), async (req, res) => {
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

router.post('/projects/:projectId/processes', authenticate, requireProjectAccess(), requirePermission('assign_task'), async (req, res) => {
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 检查项目访问权限
    const processCheck = await client.query(
      'SELECT pn.project_id FROM process_nodes pn JOIN process_execution pe ON pn.id = pe.process_node_id WHERE pe.id = $1',
      [req.params.id]
    );
    
    if (processCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    const projectId = processCheck.rows[0].project_id;
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, projectId);
    
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    const { status, actual_start_date, actual_end_date, notes } = req.body;
    const result = await client.query(`
      UPDATE process_execution 
      SET status = COALESCE($1, status),
          actual_start_date = COALESCE($2, actual_start_date),
          actual_end_date = COALESCE($3, actual_end_date),
          notes = COALESCE($4, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [status, actual_start_date, actual_end_date, notes, req.params.id]);
    
    await logActivity(client, req.user.id, 'update_process', 'process_execution', req.params.id,
      `更新工序状态: ${status || '未变更'}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ============ 材料接口 ============
router.get('/projects/:projectId/materials', authenticate, requireProjectAccess(), async (req, res) => {
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

router.post('/materials', authenticate, requirePermission('purchase_material'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { project_id, material_name, material_code, unit, purchase_quantity, unit_price, supplier, expected_arrival_date } = req.body;
    
    // 检查项目访问权限
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    const total_cost = purchase_quantity * (unit_price || 0);
    
    const result = await client.query(`
      INSERT INTO materials 
      (project_id, material_code, material_name, unit, purchase_quantity, unit_price, total_cost, supplier, expected_arrival_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ordered')
      RETURNING *
    `, [project_id, material_code, JSON.stringify(material_name), JSON.stringify(unit), purchase_quantity, unit_price, total_cost, supplier, expected_arrival_date]);
    
    await logActivity(client, req.user.id, 'purchase_material', 'materials', result.rows[0].id,
      `采购材料: ${material_name.zh || material_name}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

router.post('/materials/:id/receive', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 检查材料所属项目权限
    const materialCheck = await client.query('SELECT project_id FROM materials WHERE id = $1', [req.params.id]);
    if (materialCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    const projectId = materialCheck.rows[0].project_id;
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, projectId);
    
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    const { received_quantity, actual_arrival_date, notes } = req.body;
    const result = await client.query(`
      UPDATE materials 
      SET received_quantity = $1,
          actual_arrival_date = $2,
          notes = $3,
          status = 'arrived',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [received_quantity, actual_arrival_date, notes, req.params.id]);
    
    await logActivity(client, req.user.id, 'receive_material', 'materials', req.params.id,
      `确认收货: 数量${received_quantity}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

router.post('/materials/:id/use', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 检查材料所属项目权限
    const materialCheck = await client.query('SELECT project_id FROM materials WHERE id = $1', [req.params.id]);
    if (materialCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    const projectId = materialCheck.rows[0].project_id;
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, projectId);
    
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    const { process_execution_id, quantity_used, usage_date } = req.body;
    
    // 记录使用
    await client.query(
      'INSERT INTO material_usage (material_id, process_execution_id, quantity_used, usage_date) VALUES ($1, $2, $3, $4)',
      [req.params.id, process_execution_id, quantity_used, usage_date]
    );
    
    // 更新材料已用量
    const result = await client.query(`
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
    
    await logActivity(client, req.user.id, 'use_material', 'materials', req.params.id,
      `使用材料: 数量${quantity_used}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ============ 照片接口 ============
router.post('/photos/upload', authenticate, upload.single('photo'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { project_id, process_execution_id, material_id, photo_type } = req.body;
    
    // 检查项目访问权限
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    const result = await client.query(`
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
    
    await logActivity(client, req.user.id, 'upload_photo', 'photos', result.rows[0].id,
      `上传照片: ${photo_type}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
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

// ============ 材料库接口 ============
// 获取材料库列表
router.get('/material-library', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM material_library';
    const params = [];
    
    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY material_code';
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取单个材料库材料
router.get('/material-library/:code', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM material_library WHERE material_code = $1',
      [req.params.code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
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


// ============ 子任务模板功能 ============
const { SUBTASK_TEMPLATES } = require('./subtask-templates');

// 获取工序的子任务模板
router.get('/process-execution/:id/subtask-templates', authenticate, async (req, res) => {
  try {
    // 获取工序信息
    const processResult = await pool.query(`
      SELECT pe.*, pn.process_code
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    const processCode = processResult.rows[0].process_code;
    const templates = SUBTASK_TEMPLATES[processCode] || [];
    
    // 检查哪些子任务已经创建
    const existingResult = await pool.query(`
      SELECT subtask_name FROM process_subtasks WHERE process_execution_id = $1
    `, [req.params.id]);
    
    const existingNames = existingResult.rows.map(row => {
      const name = typeof row.subtask_name === 'string' ? JSON.parse(row.subtask_name) : row.subtask_name;
      return name.zh; // 用中文名称做比对
    });
    
    // 标记哪些已创建
    const templatesWithStatus = templates.map(template => ({
      ...template,
      isCreated: existingNames.includes(template.name.zh)
    }));
    
    res.json({ 
      success: true, 
      data: {
        process_code: processCode,
        templates: templatesWithStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量创建子任务（从模板激活）
router.post('/process-execution/:id/subtasks/batch', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { selectedSubtasks } = req.body; // 数组，包含要创建的子任务索引
    
    if (!Array.isArray(selectedSubtasks) || selectedSubtasks.length === 0) {
      return res.status(400).json({ success: false, message: '请选择至少一个子任务' });
    }
    
    // 获取工序信息
    const processResult = await client.query(`
      SELECT pe.*, pn.process_code, pe.planned_quantity as parent_quantity
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    const processCode = processResult.rows[0].process_code;
    const parentQuantity = processResult.rows[0].parent_quantity || 100; // 父工序的计划数量
    const templates = SUBTASK_TEMPLATES[processCode] || [];
    
    if (templates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '该工序没有子任务模板' });
    }
    
    const createdSubtasks = [];
    
    // 按选中的索引创建子任务
    for (const index of selectedSubtasks) {
      if (index < 0 || index >= templates.length) continue;
      
      const template = templates[index];
      
      // 根据模板的typical_percentage计算该子任务的预计数量
      const estimated_quantity = Math.round(parentQuantity * template.typical_percentage / 100);
      
      const result = await client.query(`
        INSERT INTO process_subtasks 
        (process_execution_id, subtask_name, description, planned_quantity, 
         quantity_unit, sequence_number, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, 'not_started', $7)
        RETURNING *
      `, [
        req.params.id,
        JSON.stringify(template.name),
        template.description ? JSON.stringify(template.description) : null,
        estimated_quantity,
        template.unit,
        index,
        req.user.id
      ]);
      
      createdSubtasks.push(result.rows[0]);
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      data: createdSubtasks,
      message: `成功创建${createdSubtasks.length}个子任务`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});


// ============ 工程量管理接口 ============

// 批量设置项目工程量
router.post('/projects/:projectId/set-quantities', authenticate, requireProjectAccess(), requirePermission('assign_task'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { quantities } = req.body;
    
    if (!quantities || typeof quantities !== 'object') {
      return res.status(400).json({ success: false, message: '工程量数据格式错误' });
    }
    
    const updated = [];
    
    for (const [processCode, quantity] of Object.entries(quantities)) {
      const result = await client.query(`
        UPDATE process_execution pe
        SET planned_quantity = $1,
            updated_at = CURRENT_TIMESTAMP
        FROM process_nodes pn
        WHERE pe.process_node_id = pn.id
          AND pn.project_id = $2
          AND pn.process_code = $3
        RETURNING pe.id, pe.planned_quantity, pn.process_code
      `, [quantity, req.params.projectId, processCode]);
      
      if (result.rows.length > 0) {
        updated.push(result.rows[0]);
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: `成功设置${updated.length}个工序的工程量`,
      data: updated
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 获取项目工程量
router.get('/projects/:projectId/quantities', authenticate, requireProjectAccess(), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pn.process_code,
        pn.process_name,
        pe.planned_quantity,
        pn.typical_unit as unit
      FROM process_nodes pn
      LEFT JOIN process_execution pe ON pn.id = pe.process_node_id
      WHERE pn.project_id = $1
      ORDER BY pn.sequence
    `, [req.params.projectId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;


// ============ 每日进度接口 ============

// 获取今日任务看板
router.get('/projects/:projectId/daily-tasks', authenticate, requireProjectAccess(), async (req, res) => {
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


// ============ 用户管理接口 ============

// 获取所有用户（仅管理者）
router.get('/users', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u.full_name, 
        u.role, 
        u.created_at,
        COUNT(DISTINCT pm.project_id) as project_count
      FROM users u
      LEFT JOIN project_members pm ON u.id = pm.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建用户（仅管理者）
router.post('/users', authenticate, requirePermission('manage_users'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { username, password, full_name, role } = req.body;
    
    // 验证角色
    if (!['manager', 'purchaser', 'executor'].includes(role)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '无效的角色' });
    }
    
    // 检查用户名是否已存在
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }
    
    // 加密密码
    const password_hash = await bcrypt.hash(password, 10);
    
    // 创建用户
    const result = await client.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role, created_at',
      [username, password_hash, full_name, role]
    );
    
    // 记录日志
    await logActivity(client, req.user.id, 'create_user', 'users', result.rows[0].id, 
      `创建用户: ${username}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: '用户创建成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 更新用户（仅管理者）
router.put('/users/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { full_name, role, password } = req.body;
    
    // 不能修改自己的角色
    if (req.params.id == req.user.id && role && role !== req.user.role) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '不能修改自己的角色' });
    }
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (full_name) {
      updates.push(`full_name = $${paramIndex++}`);
      params.push(full_name);
    }
    
    if (role && ['manager', 'purchaser', 'executor'].includes(role)) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(password_hash);
    }
    
    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }
    
    params.push(req.params.id);
    
    const result = await client.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramIndex} 
       RETURNING id, username, full_name, role`,
      params
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 记录日志
    await logActivity(client, req.user.id, 'update_user', 'users', req.params.id, 
      `更新用户: ${result.rows[0].username}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: '用户更新成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 删除用户（仅管理者）
router.delete('/users/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 不能删除自己
    if (req.params.id == req.user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '不能删除自己' });
    }
    
    const result = await client.query(
      'DELETE FROM users WHERE id = $1 RETURNING username',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 记录日志
    await logActivity(client, req.user.id, 'delete_user', 'users', req.params.id, 
      `删除用户: ${result.rows[0].username}`);
    
    await client.query('COMMIT');
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 获取用户已分配的项目
router.get('/users/:userId/projects', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.location
      FROM projects p
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $1
      ORDER BY p.name
    `, [req.params.userId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量分配用户到项目
router.post('/users/:userId/assign-projects', authenticate, requirePermission('manage_users'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { project_ids } = req.body;
    const userId = req.params.userId;
    
    // 先删除该用户的所有项目分配
    await client.query('DELETE FROM project_members WHERE user_id = $1', [userId]);
    
    // 重新分配选中的项目
    if (project_ids && project_ids.length > 0) {
      for (const projectId of project_ids) {
        // 获取用户角色
        const userResult = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        const userRole = userResult.rows[0].role;
        
        await client.query(
          `INSERT INTO project_members (project_id, user_id, role, assigned_by) 
           VALUES ($1, $2, $3, $4)`,
          [projectId, userId, userRole, req.user.id]
        );
      }
    }
    
    // 记录日志
    await logActivity(client, req.user.id, 'assign_projects', 'users', userId,
      `分配 ${project_ids.length} 个项目`);
    
    await client.query('COMMIT');
    res.json({ success: true, message: '项目分配成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ============ 项目成员管理接口 ============

// 获取项目成员列表
router.get('/projects/:projectId/members', authenticate, requireProjectAccess(), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pm.id,
        pm.project_id,
        pm.user_id,
        u.username,
        u.full_name,
        u.role,
        pm.assigned_at,
        pm.notes,
        assigner.full_name as assigned_by_name
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN users assigner ON pm.assigned_by = assigner.id
      WHERE pm.project_id = $1
      ORDER BY u.role, u.full_name
    `, [req.params.projectId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加项目成员（仅管理者）
router.post('/projects/:projectId/members', authenticate, requirePermission('users', 'assign'), async (req, res) => {
  try {
    const { user_id, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO project_members (project_id, user_id, assigned_by, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO UPDATE 
       SET notes = EXCLUDED.notes, assigned_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.params.projectId, user_id, req.user.id, notes]
    );
    
    // 记录日志
    await logActivity(req.user.id, 'assign_project_member', 'project', req.params.projectId, 
      { user_id, notes }, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: '成员添加成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 移除项目成员（仅管理者）
router.delete('/projects/:projectId/members/:userId', authenticate, requirePermission('users', 'assign'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.projectId, req.params.userId]
    );
    
    // 记录日志
    await logActivity(req.user.id, 'remove_project_member', 'project', req.params.projectId, 
      { user_id: req.params.userId }, req.ip);
    
    res.json({ success: true, message: '成员移除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ 任务分配接口 ============

// 分配任务给执行者（采购者或管理者）
router.post('/tasks/assign', authenticate, requirePermission('assign_task'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { process_execution_id, assigned_to } = req.body;
    
    // 获取工序所属项目
    const processCheck = await client.query(`
      SELECT pn.project_id 
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [process_execution_id]);
    
    if (processCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    const project_id = processCheck.rows[0].project_id;
    
    // 检查权限
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    // 检查被分配人是否是项目成员且是执行者
    const memberCheck = await client.query(
      `SELECT role FROM project_members 
       WHERE project_id = $1 AND user_id = $2 AND role = 'executor'`,
      [project_id, assigned_to]
    );
    
    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: '被分配人不是此项目的执行者' 
      });
    }
    
    // 检查是否已经分配
    const existingCheck = await client.query(
      'SELECT 1 FROM task_assignments WHERE process_execution_id = $1 AND assigned_to = $2',
      [process_execution_id, assigned_to]
    );
    
    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: '该执行者已被分配此任务' 
      });
    }
    
    const result = await client.query(
      `INSERT INTO task_assignments 
       (process_execution_id, assigned_to, assigned_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [process_execution_id, assigned_to, req.user.id]
    );
    
    // 记录日志
    await logActivity(client, req.user.id, 'assign_task', 'process_execution', process_execution_id, 
      `分配任务给用户 ${assigned_to}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: '任务分配成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 取消任务分配
router.delete('/tasks/assign/:processId/:userId', authenticate, requirePermission('assign_task'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { processId, userId } = req.params;
    
    // 获取工序所属项目
    const processCheck = await client.query(`
      SELECT pn.project_id 
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [processId]);
    
    if (processCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    const project_id = processCheck.rows[0].project_id;
    
    // 检查权限
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    const result = await client.query(
      'DELETE FROM task_assignments WHERE process_execution_id = $1 AND assigned_to = $2 RETURNING *',
      [processId, userId]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '任务分配不存在' });
    }
    
    // 记录日志
    await logActivity(client, req.user.id, 'unassign_task', 'process_execution', processId, 
      `取消分配给用户 ${userId}`);
    
    await client.query('COMMIT');
    res.json({ success: true, message: '取消分配成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 获取工序的任务分配列表
router.get('/process-execution/:id/assignments', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    // 获取工序所属项目
    const processCheck = await client.query(`
      SELECT pn.project_id 
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    const project_id = processCheck.rows[0].project_id;
    
    // 检查权限
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: '无权访问此项目' });
    }
    
    const result = await client.query(`
      SELECT 
        ta.*,
        u.username,
        u.full_name,
        assigner.username as assigned_by_username,
        assigner.full_name as assigned_by_name
      FROM task_assignments ta
      JOIN users u ON ta.assigned_to = u.id
      JOIN users assigner ON ta.assigned_by = assigner.id
      WHERE ta.process_execution_id = $1
      ORDER BY ta.assigned_at DESC
    `, [req.params.id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 获取我的任务列表
router.get('/tasks/my-tasks', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ta.*,
        pe.status as process_status,
        pe.completion_percentage,
        pn.process_code,
        pn.process_name,
        p.id as project_id,
        p.name as project_name,
        assigner.full_name as assigned_by_name
      FROM task_assignments ta
      JOIN process_execution pe ON ta.process_execution_id = pe.id
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      JOIN projects p ON pn.project_id = p.id
      JOIN users assigner ON ta.assigned_by = assigner.id
      WHERE ta.assigned_to = $1
      ORDER BY ta.assigned_at DESC
    `, [req.user.id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

// ============ 工序模板接口 ============

// 获取所有工序模板
router.get('/process-templates', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = `
      SELECT pt.*, 
             pc.name_zh as category_name_zh,
             pc.name_th as category_name_th
      FROM process_templates pt
      LEFT JOIN process_categories pc ON pt.category = pc.category_code
      WHERE pt.is_active = true
    `;
    const params = [];
    
    if (category) {
      query += ' AND pt.category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY pt.display_order';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get process templates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取工序分类
router.get('/process-templates/categories', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM process_categories 
      ORDER BY display_order
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get process categories error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量添加工序到项目
router.post('/projects/:projectId/processes/batch', authenticate, requirePermission('manage_projects'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const { templateIds } = req.body;
    
    await client.query('BEGIN');
    
    const addedProcesses = [];
    
    if (templateIds && templateIds.length > 0) {
      for (const templateId of templateIds) {
        const templateResult = await client.query(
          'SELECT * FROM process_templates WHERE id = $1',
          [templateId]
        );
        
        if (templateResult.rows.length === 0) continue;
        
        const template = templateResult.rows[0];
        
        const nodeResult = await client.query(`
          INSERT INTO process_nodes 
          (project_id, process_code, process_name, parent_id, display_order)
          VALUES ($1, $2, $3::jsonb, NULL, $4)
          RETURNING id
        `, [
          projectId,
          template.code,
          JSON.stringify({ zh: template.name_zh, th: template.name_th }),
          template.display_order
        ]);
        
        const nodeId = nodeResult.rows[0].id;
        
        await client.query(`
          INSERT INTO process_execution 
          (process_node_id, status, quantity_unit)
          VALUES ($1, 'not_started', $2)
        `, [nodeId, template.default_unit]);
        
        addedProcesses.push({
          nodeId,
          code: template.code,
          name: { zh: template.name_zh, th: template.name_th }
        });
      }
    }
    
    await logActivity(client, req.user.id, 'add_project_processes', 'project', projectId, { count: addedProcesses.length });
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `成功添加 ${addedProcesses.length} 个工序`,
      data: addedProcesses
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch add processes error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 添加单个工序到项目（从模板或自定义）
router.post('/projects/:projectId/processes/single', authenticate, requirePermission('manage_projects'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const { templateId, customProcess } = req.body;
    
    await client.query('BEGIN');
    
    let processCode, processName, processUnit, displayOrder;
    
    if (templateId) {
      // 从模板添加
      const templateResult = await client.query(
        'SELECT * FROM process_templates WHERE id = $1',
        [templateId]
      );
      
      if (templateResult.rows.length === 0) {
        throw new Error('工序模板不存在');
      }
      
      const template = templateResult.rows[0];
      processCode = template.code;
      processName = { zh: template.name_zh, th: template.name_th };
      processUnit = template.default_unit;
      displayOrder = template.display_order;
    } else if (customProcess) {
      // 自定义工序
      const { code, name, unit } = customProcess;
      
      if (!code || !name || !name.th) {
        throw new Error('工序信息不完整');
      }
      
      processCode = code;
      processName = { zh: name.zh || name.th, th: name.th };
      processUnit = unit || 'm²';
      displayOrder = 999; // 自定义工序排在后面
    } else {
      throw new Error('请提供工序模板ID或自定义工序信息');
    }
    
    // 检查工序是否已存在
    const existingCheck = await client.query(
      'SELECT id FROM process_nodes WHERE project_id = $1 AND process_code = $2',
      [projectId, processCode]
    );
    
    if (existingCheck.rows.length > 0) {
      throw new Error('该工序已存在于项目中');
    }
    
    // 创建工序节点
    const nodeResult = await client.query(`
      INSERT INTO process_nodes 
      (project_id, process_code, process_name, parent_id, display_order)
      VALUES ($1, $2, $3::jsonb, NULL, $4)
      RETURNING id
    `, [projectId, processCode, JSON.stringify(processName), displayOrder]);
    
    const nodeId = nodeResult.rows[0].id;
    
    // 创建工序执行记录
    await client.query(`
      INSERT INTO process_execution 
      (process_node_id, status, quantity_unit)
      VALUES ($1, 'not_started', $2)
    `, [nodeId, processUnit]);
    
    await logActivity(client, req.user.id, 'add_process', 'project', projectId, { code: processCode });
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: '工序添加成功',
      data: { nodeId, code: processCode, name: processName }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add single process error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 删除项目工序
router.delete('/projects/:projectId/processes/:processExecutionId', authenticate, requirePermission('manage_projects'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, processExecutionId } = req.params;
    
    await client.query('BEGIN');
    
    // 获取工序信息
    const processInfo = await client.query(`
      SELECT pe.id, pe.process_node_id, pn.process_code, pn.process_name
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1 AND pn.project_id = $2
    `, [processExecutionId, projectId]);
    
    if (processInfo.rows.length === 0) {
      throw new Error('工序不存在或不属于该项目');
    }
    
    const process = processInfo.rows[0];
    
    // 检查工序状态，已完成的工序不允许删除
    const statusCheck = await client.query(
      'SELECT status FROM process_execution WHERE id = $1',
      [processExecutionId]
    );
    
    if (statusCheck.rows[0].status === 'completed') {
      throw new Error('已完成的工序不能删除');
    }
    
    // 删除相关的每日进度记录
    await client.query(
      'DELETE FROM daily_progress WHERE process_execution_id = $1',
      [processExecutionId]
    );
    
    // 删除相关的子任务及进度
    const subtasksResult = await client.query(
      'SELECT id FROM subtasks WHERE process_execution_id = $1',
      [processExecutionId]
    );
    
    for (const subtask of subtasksResult.rows) {
      await client.query('DELETE FROM subtask_progress WHERE subtask_id = $1', [subtask.id]);
    }
    
    await client.query('DELETE FROM subtasks WHERE process_execution_id = $1', [processExecutionId]);
    
    // 删除工序执行记录
    await client.query('DELETE FROM process_execution WHERE id = $1', [processExecutionId]);
    
    // 删除工序节点
    await client.query('DELETE FROM process_nodes WHERE id = $1', [process.process_node_id]);
    
    await logActivity(client, req.user.id, 'delete_process', 'project', projectId, { 
      code: process.process_code,
      name: process.process_name 
    });
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: '工序删除成功'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete process error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});
