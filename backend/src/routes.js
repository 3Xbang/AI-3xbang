const express = require('express');
const router = express.Router();
const pool = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticate = require('./middleware-auth');
const { STANDARD_PROCESSES } = require('./process-templates');
const multer = require('multer');
const path = require('path');

// 鐓х墖涓婁紶閰嶇疆
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
    else cb(new Error('鍙厑璁镐笂浼爅pg/png鍥剧墖'));
  }
});

// ============ 璁よ瘉鎺ュ彛 ============
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '鐢ㄦ埛鍚嶆垨瀵嗙爜閿欒' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ success: false, message: '鐢ㄦ埛鍚嶆垨瀵嗙爜閿欒' });
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

// ============ 椤圭洰鎺ュ彛 ============
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
    
    // 1. 鍒涘缓椤圭洰
    const projectResult = await client.query(
      `INSERT INTO projects (name, location, client_name, start_date, planned_end_date, status) 
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [name, location, client_name, start_date, planned_end_date]
    );
    
    const project = projectResult.rows[0];
    
    // 2. 鑷姩鍒涘缓16涓爣鍑嗗伐搴忚妭鐐?    for (const template of STANDARD_PROCESSES) {
      // 鎻掑叆宸ュ簭鑺傜偣
      const nodeResult = await client.query(
        `INSERT INTO process_nodes 
         (project_id, process_code, process_name, sequence_number) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [project.id, template.code, JSON.stringify(template.name), template.sequence]
      );
      
      // 涓烘瘡涓妭鐐瑰垱寤烘墽琛岃褰?      await client.query(
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
      message: '椤圭洰鍒涘缓鎴愬姛锛屽凡鑷姩鐢熸垚16涓爣鍑嗗伐搴?
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
      ORDER BY pn.sequence_number_number
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

// ============ 宸ュ簭鎺ュ彛 ============
router.get('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pe.*, pn.process_code, pn.process_name, pn.sequence_number
      FROM process_nodes pn
      LEFT JOIN process_execution pe ON pn.id = pe.process_node_id
      WHERE pn.project_id = $1
      ORDER BY pn.sequence_number_number
    `, [req.params.projectId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/projects/:projectId/processes', authenticate, async (req, res) => {
  try {
    const { process_node_id, assigned_workers, estimated_days, dimensions } = req.body;
    
    // 鏉愭枡璁＄畻閫昏緫锛堢畝鍖栫増锛?    const calculated_materials = calculateMaterials(dimensions);
    
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

// ============ 鏉愭枡鎺ュ彛 ============
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
    
    // 璁＄畻搴撳瓨
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
    
    // 璁板綍浣跨敤
    await pool.query(
      'INSERT INTO material_usage (material_id, process_execution_id, quantity_used, usage_date) VALUES ($1, $2, $3, $4)',
      [req.params.id, process_execution_id, quantity_used, usage_date]
    );
    
    // 鏇存柊鏉愭枡宸茬敤閲?    const result = await pool.query(`
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

// ============ 鐓х墖鎺ュ彛 ============
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


// 获取项目照片列表
router.get('/projects/:projectId/photos', authenticate, async (req, res) => {
  try {
    const { photo_type } = req.query;
    let query = 'SELECT * FROM photos WHERE project_id = router.get('/photos/:id'';
    const params = [req.params.projectId];
    
    if (photo_type) {
      query += ' AND photo_type = $2';
      params.push(photo_type);
    }
    
    query += ' ORDER BY upload_time DESC';
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
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

// ============ 鏉愭枡璁＄畻鍑芥暟 ============
function calculateMaterials(dimensions) {
  const { length, width, height, depth, area, volume } = dimensions;
  // 绠€鍖栫増璁＄畻锛屽疄闄呮牴鎹伐搴忎笉鍚岃绠?  return [
    {
      material_name: { zh: '姘存偿', th: '喔涏腹喔權笅喔掂箑喔∴笝喔曕箤' },
      quantity: (volume || length * width * (height || depth || 0.1)) * 0.35,
      unit: { zh: '鍚?, th: '喔曕副喔? }
    }
  ];
}


// ============ 瀛愪换鍔℃ā鏉垮姛鑳?============
const { SUBTASK_TEMPLATES } = require('./subtask-templates');

// 鑾峰彇宸ュ簭鐨勫瓙浠诲姟妯℃澘
router.get('/process-execution/:id/subtask-templates', authenticate, async (req, res) => {
  try {
    // 鑾峰彇宸ュ簭淇℃伅
    const processResult = await pool.query(`
      SELECT pe.*, pn.process_code
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '宸ュ簭涓嶅瓨鍦? });
    }
    
    const processCode = processResult.rows[0].process_code;
    const templates = SUBTASK_TEMPLATES[processCode] || [];
    
    // 妫€鏌ュ摢浜涘瓙浠诲姟宸茬粡鍒涘缓
    const existingResult = await pool.query(`
      SELECT subtask_name FROM process_subtasks WHERE process_execution_id = $1
    `, [req.params.id]);
    
    const existingNames = existingResult.rows.map(row => {
      const name = typeof row.subtask_name === 'string' ? JSON.parse(row.subtask_name) : row.subtask_name;
      return name.zh; // 鐢ㄤ腑鏂囧悕绉板仛姣斿
    });
    
    // 鏍囪鍝簺宸插垱寤?    const templatesWithStatus = templates.map(template => ({
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

// 鎵归噺鍒涘缓瀛愪换鍔★紙浠庢ā鏉挎縺娲伙級
router.post('/process-execution/:id/subtasks/batch', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { selectedSubtasks } = req.body; // 鏁扮粍锛屽寘鍚鍒涘缓鐨勫瓙浠诲姟绱㈠紩
    
    if (!Array.isArray(selectedSubtasks) || selectedSubtasks.length === 0) {
      return res.status(400).json({ success: false, message: '璇烽€夋嫨鑷冲皯涓€涓瓙浠诲姟' });
    }
    
    // 鑾峰彇宸ュ簭淇℃伅
    const processResult = await client.query(`
      SELECT pe.*, pn.process_code, pe.planned_quantity as parent_quantity
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '宸ュ簭涓嶅瓨鍦? });
    }
    
    const processCode = processResult.rows[0].process_code;
    const parentQuantity = processResult.rows[0].parent_quantity || 100; // 鐖跺伐搴忕殑璁″垝鏁伴噺
    const templates = SUBTASK_TEMPLATES[processCode] || [];
    
    if (templates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '璇ュ伐搴忔病鏈夊瓙浠诲姟妯℃澘' });
    }
    
    const createdSubtasks = [];
    
    // 鎸夐€変腑鐨勭储寮曞垱寤哄瓙浠诲姟
    for (const index of selectedSubtasks) {
      if (index < 0 || index >= templates.length) continue;
      
      const template = templates[index];
      
      // 鏍规嵁妯℃澘鐨則ypical_percentage璁＄畻璇ュ瓙浠诲姟鐨勯璁℃暟閲?      const estimated_quantity = Math.round(parentQuantity * template.typical_percentage / 100);
      
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
      message: `鎴愬姛鍒涘缓${createdSubtasks.length}涓瓙浠诲姟`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});


// ============ 宸ョ▼閲忕鐞嗘帴鍙?============

// 鎵归噺璁剧疆椤圭洰宸ョ▼閲?router.post('/projects/:projectId/set-quantities', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { quantities } = req.body;
    
    if (!quantities || typeof quantities !== 'object') {
      return res.status(400).json({ success: false, message: '宸ョ▼閲忔暟鎹牸寮忛敊璇? });
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
      message: `鎴愬姛璁剧疆${updated.length}涓伐搴忕殑宸ョ▼閲廯,
      data: updated
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// 鑾峰彇椤圭洰宸ョ▼閲?router.get('/projects/:projectId/quantities', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pn.process_code,
        pn.process_name,
        pe.planned_quantity,
        pe.quantity_unit as unit
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
module.exports = router;


// ============ 姣忔棩杩涘害鎺ュ彛 ============

// 鑾峰彇浠婃棩浠诲姟鐪嬫澘
router.get('/projects/:projectId/daily-tasks', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 鑾峰彇鎵€鏈夎繘琛屼腑鐨勫伐搴?    const result = await pool.query(`
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
      ORDER BY pn.sequence_number_number
    `, [today, req.params.projectId]);
    
    // 鎸夌姸鎬佸垎缁?    const tasks = {
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

// 鎻愪氦姣忔棩杩涘害
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
    
    // 鑾峰彇宸ュ簭淇℃伅
    const processInfo = await pool.query(
      'SELECT total_completed, planned_quantity FROM process_execution WHERE id = $1',
      [process_execution_id]
    );
    
    if (processInfo.rows.length === 0) {
      return res.status(404).json({ success: false, message: '宸ュ簭涓嶅瓨鍦? });
    }
    
    // 璁＄畻绱瀹屾垚閲忓拰鐧惧垎姣?    const previousTotal = parseFloat(processInfo.rows[0].total_completed) || 0;
    const newTotal = previousTotal + parseFloat(quantity_completed);
    const plannedQty = parseFloat(processInfo.rows[0].planned_quantity) || 1;
    const percentage = (newTotal / plannedQty) * 100;
    
    // 鎻掑叆姣忔棩杩涘害璁板綍
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
    
    // 鏇存柊宸ュ簭鎵ц琛ㄧ殑绱鏁版嵁
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
      message: '杩涘害鏇存柊鎴愬姛'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 鑾峰彇宸ュ簭鐨勫巻鍙茶繘搴?router.get('/process-execution/:id/progress-history', authenticate, async (req, res) => {
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

// 鏇存柊宸ュ簭璁″垝鎬婚噺
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
      return res.status(404).json({ success: false, message: '宸ュ簭涓嶅瓨鍦? });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 鏇存柊椤圭洰宸ヤ汉淇℃伅
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
      return res.status(404).json({ success: false, message: '椤圭洰涓嶅瓨鍦? });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============ 宸ュ簭瀛愪换鍔℃帴鍙?============

// 鑾峰彇宸ュ簭鐨勬墍鏈夊瓙浠诲姟
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

// 鍒涘缓瀛愪换鍔?router.post('/process-execution/:id/subtasks', authenticate, async (req, res) => {
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
      message: '瀛愪换鍔″垱寤烘垚鍔?
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 鏇存柊瀛愪换鍔?router.put('/subtasks/:id', authenticate, async (req, res) => {
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
      return res.status(404).json({ success: false, message: '瀛愪换鍔′笉瀛樺湪' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 鍒犻櫎瀛愪换鍔?router.delete('/subtasks/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM process_subtasks WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '瀛愪换鍔′笉瀛樺湪' });
    }
    
    res.json({ success: true, message: '瀛愪换鍔″凡鍒犻櫎' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 鏇存柊瀛愪换鍔¤繘搴?router.post('/subtasks/:id/progress', authenticate, async (req, res) => {
  try {
    const { quantity_completed, work_status, notes, photos } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    
    // 鑾峰彇瀛愪换鍔′俊鎭?    const subtaskInfo = await pool.query(
      'SELECT * FROM process_subtasks WHERE id = $1',
      [req.params.id]
    );
    
    if (subtaskInfo.rows.length === 0) {
      return res.status(404).json({ success: false, message: '瀛愪换鍔′笉瀛樺湪' });
    }
    
    const subtask = subtaskInfo.rows[0];
    const previousTotal = parseFloat(subtask.total_completed) || 0;
    const newTotal = previousTotal + parseFloat(quantity_completed);
    const plannedQty = parseFloat(subtask.planned_quantity) || 1;
    const percentage = Math.min((newTotal / plannedQty) * 100, 100);
    
    // 鏇存柊瀛愪换鍔¤繘搴?    await pool.query(`
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
    
    // 鎻掑叆姣忔棩杩涘害璁板綍锛堝叧鑱斿瓙浠诲姟锛?    const progressResult = await pool.query(`
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
    
    // 閲嶆柊璁＄畻澶у伐搴忕殑鎬昏繘搴︼紙鎵€鏈夊瓙浠诲姟鐨勫姞鏉冨钩鍧囷級
    await recalculateProcessProgress(subtask.process_execution_id);
    
    res.json({ 
      success: true, 
      data: progressResult.rows[0],
      message: '杩涘害鏇存柊鎴愬姛'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 杈呭姪鍑芥暟锛氶噸鏂拌绠楀ぇ宸ュ簭杩涘害
async function recalculateProcessProgress(processExecutionId) {
  const subtasks = await pool.query(
    'SELECT planned_quantity, total_completed FROM process_subtasks WHERE process_execution_id = $1',
    [processExecutionId]
  );
  
  if (subtasks.rows.length === 0) {
    // 娌℃湁瀛愪换鍔★紝涓嶆洿鏂?    return;
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
