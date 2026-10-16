const express = require('express');
const router = express.Router();
const pool = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticate = require('./middleware-auth');
const { requirePermission, requireProjectAccess, checkProjectAccess, logActivity } = require('./middleware-permissions');
const { STANDARD_PROCESSES } = require('./process-templates');
const SiteService = require('./site-service');
const multer = require('multer');
const path = require('path');

// ��Ƭ�ϴ�����
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
    else cb(new Error('ֻ�����ϴ�jpg/pngͼƬ'));
  }
});

// ============ ��֤�ӿ� ============
// Design drawing upload config — PDF/JPG/PNG, up to 20 MB
const drawingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = require('path').extname(file.originalname);
    const safe = `drawing_${Date.now()}_${Math.random().toString(36).slice(7)}${ext}`;
    cb(null, safe);
  }
});
const drawingUpload = multer({
  storage: drawingStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) cb(null, true);
    else cb(new Error('只支持 PDF / JPG / PNG 格式'));
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '�û������������' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ success: false, message: '�û������������' });
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

// ============ ��Ŀ�ӿ� ============
router.get('/projects', authenticate, async (req, res) => {
  try {
    let query;
    const params = [];
    // BOQ-weighted progress: matches the Gantt formula
    // For each section, avg completion, weighted by A:2,B:8,C:20,D:5,E:9,F:40,G:9,H:5,I:2
    const progressSubquery = `
      COALESCE((
        SELECT ROUND(SUM(sec_avg * sec_weight) / 100.0)
        FROM (
          SELECT
            LEFT(pn2.master_code, 1) AS sec,
            AVG(CASE WHEN pe2.status = 'completed' THEN 100
                     ELSE COALESCE(pe2.completion_percentage, 0) END) AS sec_avg,
            CASE LEFT(pn2.master_code, 1)
              WHEN 'A' THEN 2 WHEN 'B' THEN 8 WHEN 'C' THEN 20 WHEN 'D' THEN 5
              WHEN 'E' THEN 9 WHEN 'F' THEN 40 WHEN 'G' THEN 9 WHEN 'H' THEN 5
              WHEN 'I' THEN 2 ELSE 0 END AS sec_weight
          FROM process_nodes pn2
          JOIN process_execution pe2 ON pe2.process_node_id = pn2.id
          WHERE pn2.project_id = p.id
            AND pn2.master_code IS NOT NULL
            AND LEFT(pn2.master_code, 1) IN ('A','B','C','D','E','F','G','H','I')
          GROUP BY LEFT(pn2.master_code, 1)
        ) sec_data
      ), 0)`;

    if (req.user.role === 'manager') {
      query = `SELECT p.*, ${progressSubquery} AS progress
               FROM projects p ORDER BY p.created_at DESC`;
    } else {
      query = `SELECT p.*, ${progressSubquery} AS progress
               FROM projects p
               INNER JOIN project_members pm ON p.id = pm.project_id
               WHERE pm.user_id = $1
               ORDER BY p.created_at DESC`;
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
    
    // 1. ������Ŀ
    const projectResult = await client.query(
      `INSERT INTO projects (name, location, client_name, start_date, planned_end_date, status) 
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [name, location, client_name, start_date, planned_end_date]
    );
    
    const project = projectResult.rows[0];
    
    // 2. �Զ�������������Ϊ��Ŀ��Ա
    await client.query(
      `INSERT INTO project_members (project_id, user_id, assigned_by) 
       VALUES ($1, $2, $3)`,
      [project.id, req.user.id, req.user.id]
    );
    
    // 3. �Զ��ӹ���ģ��ⴴ����׼���򣨰�ʩ��˳��
    const templatesResult = await client.query(`
      SELECT id, code, name_zh, name_th, default_unit, display_order
      FROM process_templates
      WHERE is_active = true
      ORDER BY display_order
    `);
    
    for (const template of templatesResult.rows) {
      // ���빤��ڵ�
      const nodeResult = await client.query(
        `INSERT INTO process_nodes 
         (project_id, process_code, process_name, sequence_number) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          project.id, 
          template.code, 
          JSON.stringify({ zh: template.name_zh, th: template.name_th }),
          template.display_order
        ]
      );
      
      // Ϊÿ���ڵ㴴��ִ�м�¼
      await client.query(
        `INSERT INTO process_execution 
         (process_node_id, status, quantity_unit) 
         VALUES ($1, 'not_started', $2)`,
        [nodeResult.rows[0].id, template.default_unit]
      );
    }
    
    // 4. ��¼���־
    await logActivity(client, req.user.id, 'create_project', 'projects', project.id, 
      { message: JSON.stringify(name) });
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      data: project,
      message: `��Ŀ�����ɹ������Զ�����${templatesResult.rows.length}����׼����`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ������Ŀ��Ϣ
router.put('/projects/:id', authenticate, requirePermission('manage_projects'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, client_name, start_date, planned_end_date, status } = req.body;
    
    const result = await pool.query(
      `UPDATE projects 
       SET name = $1, location = $2, client_name = $3, 
           start_date = $4, planned_end_date = $5, status = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, location, client_name, start_date, planned_end_date, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '��Ŀ������' });
    }
    
    await logActivity(pool, req.user.id, 'update_project', 'projects', id, { message: `������Ŀ: ${name}` });
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      message: '��Ŀ���³ɹ�'
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ɾ����Ŀ
router.delete('/projects/:id', authenticate, requirePermission('manage_projects'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // �����Ŀ�Ƿ����
    const projectCheck = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (projectCheck.rows.length === 0) {
      throw new Error('��Ŀ������');
    }
    
    const project = projectCheck.rows[0];
    
    // ��ȡ���й���ִ��ID
    const processExecutions = await client.query(
      `SELECT pe.id FROM process_execution pe
       JOIN process_nodes pn ON pe.process_node_id = pn.id
       WHERE pn.project_id = $1`,
      [id]
    );
    
    // ɾ������������ݣ�����ɾ����
    for (const pe of processExecutions.rows) {
      // ɾ��ÿ�ս���
      await client.query('DELETE FROM daily_progress WHERE process_execution_id = $1', [pe.id]);
      
      // ɾ����������ȣ������ subtask_progress ����
      const subtaskCheck = await client.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'subtask_progress'`
      );
      
      if (subtaskCheck.rows.length > 0) {
        const subtasks = await client.query('SELECT id FROM process_subtasks WHERE process_execution_id = $1', [pe.id]);
        for (const subtask of subtasks.rows) {
          await client.query('DELETE FROM subtask_progress WHERE subtask_id = $1', [subtask.id]);
        }
      }
      
      // ɾ��������
      await client.query('DELETE FROM process_subtasks WHERE process_execution_id = $1', [pe.id]);
      
      // ɾ������������ϵ
      await client.query('DELETE FROM process_dependencies WHERE process_execution_id = $1 OR depends_on_process_id = $1', [pe.id]);
    }
    
    // ɾ������ִ�м�¼
    await client.query(
      `DELETE FROM process_execution WHERE process_node_id IN (
        SELECT id FROM process_nodes WHERE project_id = $1
      )`,
      [id]
    );
    
    // ɾ������ڵ�
    await client.query('DELETE FROM process_nodes WHERE project_id = $1', [id]);
    
    // ɾ�����ϼ�¼
    await client.query('DELETE FROM materials WHERE project_id = $1', [id]);
    
    // ɾ����Ƭ
    
    // ɾ����̱�
    await client.query('DELETE FROM project_milestones WHERE project_id = $1', [id]);
    
    // ɾ����Ŀ��Ա
    await client.query('DELETE FROM project_members WHERE project_id = $1', [id]);
    
    // ɾ����Ŀ
    await client.query('DELETE FROM projects WHERE id = $1', [id]);
    
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true,
      message: '��Ŀɾ���ɹ�'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete project error:', error);
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

// ============ ����ӿ� ============
router.get('/projects/:projectId/processes', authenticate, requireProjectAccess(), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pe.*, pn.process_code, pn.process_name, pn.sequence_number, pn.master_code, pn.floor_no
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
    
    // ���ϼ����߼����򻯰棩
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
    
    // �����Ŀ����Ȩ��
    const processCheck = await client.query(
      'SELECT pn.project_id FROM process_nodes pn JOIN process_execution pe ON pn.id = pe.process_node_id WHERE pe.id = $1',
      [req.params.id]
    );
    
    if (processCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    const projectId = processCheck.rows[0].project_id;
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, projectId);
    
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
    }
    
    const { 
      status, 
      actual_start_date, 
      actual_end_date, 
      notes, 
      completion_percentage,
      measurements,
      planned_quantity,
      quantity_unit,
      planned_start_date,
      planned_end_date,
      planned_duration
    } = req.body;
    
    // �ӡ�δ��ʼ���ĳɡ������С�ʱ�������ܿ����ɵĹ�����ǰ��������
    // û����ͷ��� 409 ��ԭ�򣻴��� force_reason ��������ǰ��ʼ������¼��֪ͨ�ϼ����ϰ�
    if (status === 'in_progress') {
      await SiteService.startProcess(client, Number(req.params.id), req.user, req.body.force_reason);
    }
    
    const result = await client.query(`
      UPDATE process_execution 
      SET status = COALESCE($1, status),
          actual_start_date = COALESCE($2, actual_start_date),
          actual_end_date = COALESCE($3, actual_end_date),
          notes = COALESCE($4, notes),
          completion_percentage = COALESCE($5, completion_percentage),
          measurements = COALESCE($6, measurements),
          planned_quantity = COALESCE($7, planned_quantity),
          quantity_unit = COALESCE($8, quantity_unit),
          planned_start_date = COALESCE($9, planned_start_date),
          planned_end_date = COALESCE($10, planned_end_date),
          planned_duration = COALESCE($11, planned_duration),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `, [
      status, 
      actual_start_date, 
      actual_end_date, 
      notes, 
      completion_percentage,
      measurements,
      planned_quantity,
      quantity_unit,
      planned_start_date,
      planned_end_date,
      planned_duration,
      req.params.id
    ]);
    
    await logActivity(client, req.user.id, 'update_process', 'process_execution', req.params.id,
      { message: `���¹���: ${status ? '״̬=' + status : ''}${planned_quantity ? ' ������=' + planned_quantity : ''}` });
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    // ǰ������û����ʱ����ԭ���״̬��ԭ�����أ�ҳ��ݴ��ù�ͷ��д��ǰ��ʼ��ԭ��
    if (error instanceof SiteService.HttpError) {
      return res.status(error.status).json(Object.assign({ success: false, message: error.message }, error.extra));
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ============ ���Ͻӿ� ============
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
    
    // ������
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
    
    // �����Ŀ����Ȩ��
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
    }
    
    const total_cost = purchase_quantity * (unit_price || 0);
    
    const result = await client.query(`
      INSERT INTO materials 
      (project_id, material_code, material_name, unit, purchase_quantity, unit_price, total_cost, supplier, expected_arrival_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ordered')
      RETURNING *
    `, [project_id, material_code, JSON.stringify(material_name), JSON.stringify(unit), purchase_quantity, unit_price, total_cost, supplier, expected_arrival_date]);
    
    await logActivity(client, req.user.id, 'purchase_material', 'materials', result.rows[0].id,
      `�ɹ�����: ${material_name.zh || material_name}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/materials/:id/receive', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // ������������ĿȨ��
    const materialCheck = await client.query('SELECT project_id FROM materials WHERE id = $1', [req.params.id]);
    if (materialCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '���ϲ�����' });
    }
    
    const projectId = materialCheck.rows[0].project_id;
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, projectId);
    
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
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
      `ȷ���ջ�: ����${received_quantity}`);
    
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
    
    // ������������ĿȨ��
    const materialCheck = await client.query('SELECT project_id FROM materials WHERE id = $1', [req.params.id]);
    if (materialCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '���ϲ�����' });
    }
    
    const projectId = materialCheck.rows[0].project_id;
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, projectId);
    
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
    }
    
    const { process_execution_id, quantity_used, usage_date } = req.body;
    
    // ��¼ʹ��
    await client.query(
      'INSERT INTO material_usage (material_id, process_execution_id, quantity_used, usage_date) VALUES ($1, $2, $3, $4)',
      [req.params.id, process_execution_id, quantity_used, usage_date]
    );
    
    // ���²���������
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
      `ʹ�ò���: ����${quantity_used}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ============ ��Ƭ�ӿ� ============
router.post('/photos/upload', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const { project_id, process_execution_id, material_id } = req.body;
    const photo_type = req.body.photo_type || 'other';
    if (!req.file) {
      return res.status(400).json({ success: false, message: '��ѡ����Ƭ' });
    }

    // �����Ŀ����Ȩ��
    const hasAccess = await checkProjectAccess(pool, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
    }

    // Duplicate check: same file size from same user in last 30 seconds
    const dupCheck = await pool.query(
      `SELECT id FROM photos WHERE project_id=$1 AND uploaded_by=$2 AND file_size=$3
       AND upload_time > NOW() - INTERVAL '30 seconds' LIMIT 1`,
      [project_id, req.user.username, req.file.size]
    );
    if (dupCheck.rows.length) {
      return res.status(409).json({ success: false, message: '照片已上传 / รูปนี้เพิ่งอัปโหลดไปแล้ว' });
    }

    const photo_category = req.body.photo_category || 'general';
    const work_item_name = req.body.work_item_name || null;
    const report_date_val = req.body.report_date || null;

    const result = await pool.query(`
      INSERT INTO photos
      (project_id, process_execution_id, material_id, photo_url, photo_type, file_size, uploaded_by, reason, uploader_name, photo_category, work_item_name, report_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      project_id,
      process_execution_id || null,
      material_id || null,
      `/uploads/${req.file.filename}`,
      photo_type,
      req.file.size,
      req.user.username,
      req.body.reason || null,
      req.user.full_name || req.user.username,
      photo_category,
      work_item_name,
      report_date_val
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/photos/project/:projectId', authenticate, async (req, res) => {
  try {
    const hasAccess = await checkProjectAccess(pool, req.user.id, req.user.role, req.params.projectId);
    if (!hasAccess) return res.status(403).json({ success: false, message: 'No access' });
    const date = req.query.date || new Date(Date.now()+7*3600000).toISOString().slice(0,10);
    const result = await pool.query(
      `SELECT *, report_date::text AS report_date
       FROM photos 
       WHERE project_id = $1 AND (report_date = $2 OR (report_date IS NULL AND upload_time::date = $2::date))
       ORDER BY photo_category, upload_time ASC`,
      [req.params.projectId, date]
    );
    const datesR = await pool.query(
      `SELECT DISTINCT COALESCE(report_date, upload_time::date)::text AS d FROM photos WHERE project_id=$1 ORDER BY d DESC LIMIT 30`,
      [req.params.projectId]
    );
    res.json({ success: true, data: result.rows, dates: datesR.rows.map(r=>r.d) });
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

// PUT /photos/:id — edit reason (admin: any photo; others: own only)
router.put('/photos/:id', authenticate, async (req, res) => {
  try {
    const r = await pool.query('SELECT uploaded_by, project_id FROM photos WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, message: 'Photo not found' });
    const p = r.rows[0];
    const isManager = req.user.role === 'manager';
    if (!isManager && p.uploaded_by !== req.user.username) {
      return res.status(403).json({ success: false, message: '只能编辑自己上传的照片 / ลบได้เฉพาะรูปของตัวเอง' });
    }
    const { reason } = req.body;
    await pool.query('UPDATE photos SET reason=$1 WHERE id=$2', [reason || '', req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /photos/:id — admin: any photo; others: own only
router.delete('/photos/:id', authenticate, async (req, res) => {
  try {
    const r = await pool.query('SELECT uploaded_by, project_id FROM photos WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, message: 'Photo not found' });
    const p = r.rows[0];
    const isManager = req.user.role === 'manager';
    if (!isManager && p.uploaded_by !== req.user.username) {
      return res.status(403).json({ success: false, message: '只能删除自己上传的照片 / ลบได้เฉพาะรูปของตัวเอง' });
    }
    await pool.query('DELETE FROM photos WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ��ȡ���Ͽ��б�
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

// ��ȡ�������Ͽ����
router.get('/material-library/:code', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM material_library WHERE material_code = $1',
      [req.params.code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '���ϲ�����' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ���ϼ��㺯�� ============
function calculateMaterials(dimensions) {
  const { length, width, height, depth, area, volume } = dimensions;
  // �򻯰���㣬ʵ�ʸ��ݹ���ͬ����
  return [
    {
      material_name: { zh: 'ˮ��', th: '??????????' },
      quantity: (volume || length * width * (height || depth || 0.1)) * 0.35,
      unit: { zh: '��', th: '???' }
    }
  ];
}


// ============ ������ģ�幦�� ============
const { SUBTASK_TEMPLATES } = require('./subtask-templates');

// ��ȡ�����������ģ��
router.get('/process-execution/:id/subtask-templates', authenticate, async (req, res) => {
  try {
    // ��ȡ������Ϣ
    const processResult = await pool.query(`
      SELECT pe.*, pn.process_code
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    const processCode = processResult.rows[0].process_code;
    const templates = SUBTASK_TEMPLATES[processCode] || [];
    
    // �����Щ�������Ѿ�����
    const existingResult = await pool.query(`
      SELECT subtask_name FROM process_subtasks WHERE process_execution_id = $1
    `, [req.params.id]);
    
    const existingNames = existingResult.rows.map(row => {
      const name = typeof row.subtask_name === 'string' ? JSON.parse(row.subtask_name) : row.subtask_name;
      return name.zh; // �������������ȶ�
    });
    
    // �����Щ�Ѵ���
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

// �������������񣨴�ģ�弤�
router.post('/process-execution/:id/subtasks/batch', authenticate, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { selectedSubtasks } = req.body; // ���飬����Ҫ����������������
    
    if (!Array.isArray(selectedSubtasks) || selectedSubtasks.length === 0) {
      return res.status(400).json({ success: false, message: '��ѡ������һ��������' });
    }
    
    // ��ȡ������Ϣ
    const processResult = await client.query(`
      SELECT pe.*, pn.process_code, pe.planned_quantity as parent_quantity
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    const processCode = processResult.rows[0].process_code;
    const parentQuantity = processResult.rows[0].parent_quantity || 100; // ������ļƻ�����
    const templates = SUBTASK_TEMPLATES[processCode] || [];
    
    if (templates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '�ù���û��������ģ��' });
    }
    
    const createdSubtasks = [];
    
    // ��ѡ�е���������������
    for (const index of selectedSubtasks) {
      if (index < 0 || index >= templates.length) continue;
      
      const template = templates[index];
      
      // ����ģ���typical_percentage������������Ԥ������
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
      message: `�ɹ�����${createdSubtasks.length}��������`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});


// ============ �����������ӿ� ============

// ����������Ŀ������
router.post('/projects/:projectId/set-quantities', authenticate, requireProjectAccess(), requirePermission('assign_task'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { quantities } = req.body;
    
    if (!quantities || typeof quantities !== 'object') {
      return res.status(400).json({ success: false, message: '���������ݸ�ʽ����' });
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
      message: `�ɹ�����${updated.length}������Ĺ�����`,
      data: updated
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ��ȡ��Ŀ������
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


// ============ ÿ�ս��Ƚӿ� ============

// ��ȡ�������񿴰�
router.get('/projects/:projectId/daily-tasks', authenticate, requireProjectAccess(), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // ��ȡ���н����еĹ���
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
    
    // ��״̬����
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

// �ύÿ�ս���
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
    
    // ��̩��ʱ������ڣ��������� UTC������ 7 ��ǰ�����ǰһ�죩
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split('T')[0];
    
    // ��ȡ������Ϣ
    const processInfo = await pool.query(
      `SELECT pe.status, pe.total_completed, pe.planned_quantity, pn.master_code
         FROM process_execution pe JOIN process_nodes pn ON pn.id = pe.process_node_id WHERE pe.id = $1`,
      [process_execution_id]
    );
    
    if (processInfo.rows.length === 0) {
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    // �ܿ����ɵĹ�������ȡ���ʼ������ʼʱ����ǰ�������������ܿ���¼�����ƹ�
    if (processInfo.rows[0].master_code && processInfo.rows[0].status === 'not_started') {
      return res.status(409).json({ success: false, message: '�������û��ʼ�����ȵ㡸��ʼ���ټ�¼����' });
    }
    
    // ��������û¼��ʱ���������㲻���ٷֱȣ���ǰ�ᵱ�� 1 ���㣬¼���κ���������ɼ��ٸ��ٷֵ�
    if (!(parseFloat(processInfo.rows[0].planned_quantity) > 0)) {
      return res.status(400).json({ success: false, message: '�������Ĺ�������û¼�룬�޷���������¼���ȡ�����¼�빤����������á����ٷֱȡ���¼' });
    }
    
    // �����ۼ�������Ͱٷֱ�
    const previousTotal = parseFloat(processInfo.rows[0].total_completed) || 0;
    const newTotal = previousTotal + parseFloat(quantity_completed);
    const plannedQty = parseFloat(processInfo.rows[0].planned_quantity);
    const percentage = Math.min(100, (newTotal / plannedQty) * 100);
    
    // ����ÿ�ս��ȼ�¼
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
    
    // ���¹���ִ�б����ۼ�����
    await pool.query(`
      UPDATE process_execution 
      SET total_completed = $1::numeric, 
          completion_percentage = $2::numeric,
          status = CASE 
            WHEN $2::numeric >= 100 THEN 'completed'
            WHEN $2::numeric > 0 AND status = 'not_started' THEN 'in_progress'
            ELSE status
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newTotal, percentage, process_execution_id]);
    
    res.json({ 
      success: true, 
      data: progressResult.rows[0],
      message: '���ȸ��³ɹ�'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ��ȡ�������ʷ����
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

// ���¹���ƻ�����
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
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ������Ŀ������Ϣ
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
      return res.status(404).json({ success: false, message: '��Ŀ������' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============ ����������ӿ� ============

// ��ȡ���������������
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

// ����������
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
      message: '�����񴴽��ɹ�'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ����������
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
      return res.status(404).json({ success: false, message: '�����񲻴���' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ɾ��������
router.delete('/subtasks/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM process_subtasks WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '�����񲻴���' });
    }
    
    res.json({ success: true, message: '��������ɾ��' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// �������������
router.post('/subtasks/:id/progress', authenticate, async (req, res) => {
  try {
    const { quantity_completed, work_status, notes, photos } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    
    // ��ȡ��������Ϣ
    const subtaskInfo = await pool.query(
      'SELECT * FROM process_subtasks WHERE id = $1',
      [req.params.id]
    );
    
    if (subtaskInfo.rows.length === 0) {
      return res.status(404).json({ success: false, message: '�����񲻴���' });
    }
    
    const subtask = subtaskInfo.rows[0];
    const previousTotal = parseFloat(subtask.total_completed) || 0;
    const newTotal = previousTotal + parseFloat(quantity_completed);
    const plannedQty = parseFloat(subtask.planned_quantity) || 1;
    const percentage = Math.min((newTotal / plannedQty) * 100, 100);
    
    // �������������
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
    
    // ����ÿ�ս��ȼ�¼������������
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
    
    // ���¼��������ܽ��ȣ�����������ļ�Ȩƽ����
    await recalculateProcessProgress(subtask.process_execution_id);
    
    res.json({ 
      success: true, 
      data: progressResult.rows[0],
      message: '���ȸ��³ɹ�'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// �������������¼���������
async function recalculateProcessProgress(processExecutionId) {
  const subtasks = await pool.query(
    'SELECT planned_quantity, total_completed FROM process_subtasks WHERE process_execution_id = $1',
    [processExecutionId]
  );
  
  if (subtasks.rows.length === 0) {
    // û�������񣬲�����
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


// ============ �û������ӿ� ============

// ��ȡ�����û����������ߣ�
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

// �����û����������ߣ�
router.post('/users', authenticate, requirePermission('manage_users'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { username, password, full_name, role } = req.body;
    
    // ��֤��ɫ
    if (!['manager', 'purchaser', 'executor'].includes(role)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '��Ч�Ľ�ɫ' });
    }
    
    // ����û����Ƿ��Ѵ���
    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '�û����Ѵ���' });
    }
    
    // ��������
    const password_hash = await bcrypt.hash(password, 10);
    
    // �����û�
    const result = await client.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role, created_at',
      [username, password_hash, full_name, role]
    );
    
    // ��¼��־
    await logActivity(client, req.user.id, 'create_user', 'users', result.rows[0].id, 
      `�����û�: ${username}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: '�û������ɹ�' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// �����û����������ߣ�
router.put('/users/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { full_name, role, password } = req.body;
    
    // �����޸��Լ��Ľ�ɫ
    if (req.params.id == req.user.id && role && role !== req.user.role) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '�����޸��Լ��Ľ�ɫ' });
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
      return res.status(400).json({ success: false, message: 'û��Ҫ���µ��ֶ�' });
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
      return res.status(404).json({ success: false, message: '�û�������' });
    }
    
    // ��¼��־
    await logActivity(client, req.user.id, 'update_user', 'users', req.params.id, 
      `�����û�: ${result.rows[0].username}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: '�û����³ɹ�' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ɾ���û����������ߣ�
router.delete('/users/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // ����ɾ���Լ�
    if (req.params.id == req.user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: '����ɾ���Լ�' });
    }
    
    const result = await client.query(
      'DELETE FROM users WHERE id = $1 RETURNING username',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '�û�������' });
    }
    
    // ��¼��־
    await logActivity(client, req.user.id, 'delete_user', 'users', req.params.id, 
      `ɾ���û�: ${result.rows[0].username}`);
    
    await client.query('COMMIT');
    res.json({ success: true, message: '�û�ɾ���ɹ�' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ��ȡ�û��ѷ������Ŀ
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

// ���������û�����Ŀ
router.post('/users/:userId/assign-projects', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { project_ids } = req.body;
    const userId = Number(req.params.userId);

    // ��ɾ�����û���������Ŀ����
    await pool.query('DELETE FROM project_members WHERE user_id = $1', [userId]);

    // �����µķ���
    if (Array.isArray(project_ids) && project_ids.length > 0) {
      for (const projectId of project_ids) {
        await pool.query(
          'INSERT INTO project_members (project_id, user_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [Number(projectId), userId, req.user.id]
        );
      }
    }

    res.json({ success: true, message: `����ɹ����� ${(project_ids||[]).length} ����Ŀ` });
  } catch (error) {
    console.error('assign-projects error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ��Ŀ��Ա�����ӿ� ============

// ��ȡ��Ŀ��Ա�б�
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

// ������Ŀ��Ա���������ߣ�
router.post('/projects/:projectId/members', authenticate, requirePermission('manage_users'), async (req, res) => {
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
    
    // ��¼��־
    await logActivity(req.user.id, 'assign_project_member', 'project', req.params.projectId, 
      { user_id, notes }, req.ip);
    
    res.json({ success: true, data: result.rows[0], message: '��Ա���ӳɹ�' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// �Ƴ���Ŀ��Ա���������ߣ�
router.delete('/projects/:projectId/members/:userId', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.projectId, req.params.userId]
    );
    
    // ��¼��־
    await logActivity(req.user.id, 'remove_project_member', 'project', req.params.projectId, 
      { user_id: req.params.userId }, req.ip);
    
    res.json({ success: true, message: '��Ա�Ƴ��ɹ�' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ �������ӿ� ============

// ���������ִ���ߣ��ɹ��߻�����ߣ�
router.post('/tasks/assign', authenticate, requirePermission('assign_task'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { process_execution_id, assigned_to } = req.body;
    
    // ��ȡ����������Ŀ
    const processCheck = await client.query(`
      SELECT pn.project_id 
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [process_execution_id]);
    
    if (processCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    const project_id = processCheck.rows[0].project_id;
    
    // ���Ȩ��
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
    }
    
    // ��鱻�������Ƿ�����Ŀ��Ա����ִ����
    const memberCheck = await client.query(
      `SELECT role FROM project_members 
       WHERE project_id = $1 AND user_id = $2 AND role = 'executor'`,
      [project_id, assigned_to]
    );
    
    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: '�������˲��Ǵ���Ŀ��ִ����' 
      });
    }
    
    // ����Ƿ��Ѿ�����
    const existingCheck = await client.query(
      'SELECT 1 FROM task_assignments WHERE process_execution_id = $1 AND assigned_to = $2',
      [process_execution_id, assigned_to]
    );
    
    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: '��ִ�����ѱ����������' 
      });
    }
    
    const result = await client.query(
      `INSERT INTO task_assignments 
       (process_execution_id, assigned_to, assigned_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [process_execution_id, assigned_to, req.user.id]
    );
    
    // ��¼��־
    await logActivity(client, req.user.id, 'assign_task', 'process_execution', process_execution_id, 
      `����������û� ${assigned_to}`);
    
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: '�������ɹ�' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ȡ���������
router.delete('/tasks/assign/:processId/:userId', authenticate, requirePermission('assign_task'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { processId, userId } = req.params;
    
    // ��ȡ����������Ŀ
    const processCheck = await client.query(`
      SELECT pn.project_id 
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [processId]);
    
    if (processCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    const project_id = processCheck.rows[0].project_id;
    
    // ���Ȩ��
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
    }
    
    const result = await client.query(
      'DELETE FROM task_assignments WHERE process_execution_id = $1 AND assigned_to = $2 RETURNING *',
      [processId, userId]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '������䲻����' });
    }
    
    // ��¼��־
    await logActivity(client, req.user.id, 'unassign_task', 'process_execution', processId, 
      `ȡ��������û� ${userId}`);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'ȡ������ɹ�' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ��ȡ�������������б�
router.get('/process-execution/:id/assignments', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    // ��ȡ����������Ŀ
    const processCheck = await client.query(`
      SELECT pn.project_id 
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1
    `, [req.params.id]);
    
    if (processCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: '���򲻴���' });
    }
    
    const project_id = processCheck.rows[0].project_id;
    
    // ���Ȩ��
    const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: '��Ȩ���ʴ���Ŀ' });
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

// ��ȡ�ҵ������б�
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

// ============ 设计图接口 ============

// GET /projects/:projectId/drawings — list drawings
router.get('/projects/:projectId/drawings', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const hasAccess = await checkProjectAccess(pool, req.user.id, req.user.role, projectId);
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权访问该项目' });
    const result = await pool.query(
      'SELECT * FROM design_drawings WHERE project_id = $1 ORDER BY sort_order, upload_time DESC',
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /projects/:projectId/drawings — upload a drawing file
router.post('/projects/:projectId/drawings', authenticate, requireProjectAccess(), drawingUpload.single('drawing'), async (req, res) => {
  try {
    const { execFile } = require('child_process');
    const fs = require('fs');
    const { projectId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: '请选择文件' });
    const hasAccess = await checkProjectAccess(pool, req.user.id, req.user.role, projectId);
    if (!hasAccess) return res.status(403).json({ success: false, message: '无权访问该项目' });

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const isPdf = fileExt === '.pdf';

    if (isPdf) {
      // Split PDF into pages using pdftoppm
      const pdfPath = req.file.path; // full path to uploaded PDF
      const outputPrefix = pdfPath.replace('.pdf', '_page').replace(/[^a-zA-Z0-9_\/]/g, '_');

      // Run pdftoppm: converts PDF to PNG images at 150dpi
      await new Promise((resolve, reject) => {
        execFile('pdftoppm', ['-r', '150', '-png', pdfPath, outputPrefix], (err) => {
          if (err) reject(err); else resolve();
        });
      });

      // Find all generated page files (pdftoppm names them prefix-1.png, prefix-2.png etc.)
      const uploadDir = path.dirname(pdfPath);
      const prefixBase = path.basename(outputPrefix);
      const pageFiles = fs.readdirSync(uploadDir)
        .filter(f => f.startsWith(prefixBase) && f.endsWith('.png'))
        .sort();

      if (pageFiles.length === 0) {
        return res.status(500).json({ success: false, message: 'PDF conversion failed — no pages generated' });
      }

      const totalPages = pageFiles.length;
      const baseName = path.basename(req.file.originalname, '.pdf');
      const baseDesc = req.body.description || '';

      const insertedRecords = [];
      for (let i = 0; i < pageFiles.length; i++) {
        const pageFile = pageFiles[i];
        const pageNum = i + 1;
        const fileUrl = '/uploads/' + pageFile;
        const fileName = `${baseName} — Page ${pageNum}`;
        const description = totalPages > 1
          ? (baseDesc ? `${baseDesc} · Page ${pageNum}/${totalPages}` : `Page ${pageNum} / ${totalPages}`)
          : (baseDesc || '');
        const fileSize = fs.statSync(path.join(uploadDir, pageFile)).size;

        const r = await pool.query(
          `INSERT INTO design_drawings (project_id, file_name, file_url, file_type, file_size, description, uploaded_by, sort_order)
           VALUES ($1, $2, $3, 'image', $4, $5, $6, $7) RETURNING *`,
          [projectId, fileName, fileUrl, fileSize, description, req.user.id, i]
        );
        insertedRecords.push(r.rows[0]);
      }

      // Delete original PDF (no longer needed)
      fs.unlink(pdfPath, () => {});

      return res.json({ success: true, data: insertedRecords, pages: totalPages });
    } else {
      // Image upload — unchanged behavior
      const result = await pool.query(
        `INSERT INTO design_drawings (project_id, file_name, file_url, file_type, file_size, description, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [projectId, req.file.originalname, `/uploads/${req.file.filename}`,
         'image', req.file.size, req.body.description || '', req.user.id]
      );
      return res.json({ success: true, data: result.rows[0] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /drawings/:id — delete a drawing (manager or uploader)
router.delete('/drawings/:id', authenticate, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM design_drawings WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, message: '设计图不存在' });
    const drawing = r.rows[0];
    const isManager = req.user.role === 'manager';
    if (!isManager && drawing.uploaded_by !== req.user.id) {
      return res.status(403).json({ success: false, message: '只能删除自己上传的图纸' });
    }
    await pool.query('DELETE FROM design_drawings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /drawings/:id/annotations — load annotations for a drawing
router.get('/drawings/:id/annotations', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM drawing_annotations WHERE drawing_id = $1 ORDER BY page_no',
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /drawings/:id/annotations — save (upsert) annotations for a drawing page
router.put('/drawings/:id/annotations', authenticate, async (req, res) => {
  try {
    const { page_no = 1, objects } = req.body;
    const result = await pool.query(
      `INSERT INTO drawing_annotations (drawing_id, page_no, objects, annotated_by, annotated_by_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (drawing_id, page_no) DO UPDATE SET
         objects = EXCLUDED.objects,
         annotated_by = EXCLUDED.annotated_by,
         annotated_by_name = EXCLUDED.annotated_by_name,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.params.id, page_no, JSON.stringify(objects || []),
       req.user.id, req.user.full_name || req.user.username]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

// ============ ����ģ��ӿ� ============

// ��ȡ���й���ģ��
router.get('/process-templates', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = `
      SELECT 
        pt.id,
        pt.code,
        pt.category,
        jsonb_build_object('zh', pt.name_zh, 'th', pt.name_th) as name,
        pt.default_unit as quantity_unit,
        pt.quality_points,
        pt.display_order,
        pt.is_active,
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

// ��ȡ�������
router.get('/process-templates/categories', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        category_code,
        jsonb_build_object('zh', name_zh, 'th', name_th) as name,
        parent_category,
        display_order
      FROM process_categories 
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

// �������ӹ�����Ŀ
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
          (project_id, process_code, process_name, sequence_number)
          VALUES ($1, $2, $3::jsonb, $4)
          RETURNING id
        `, [
          projectId,
          template.code,
          JSON.stringify({ zh: template.name_zh, th: template.name_th }),
          template.display_order || 0
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
      message: `�ɹ����� ${addedProcesses.length} ������`,
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

// ���ӵ���������Ŀ����ģ����Զ��壩
router.post('/projects/:projectId/processes/single', authenticate, requirePermission('manage_projects'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const { templateId, customProcess } = req.body;
    
    await client.query('BEGIN');
    
    let processCode, processName, processUnit, displayOrder;
    
    if (templateId) {
      // ��ģ������
      const templateResult = await client.query(
        'SELECT * FROM process_templates WHERE id = $1',
        [templateId]
      );
      
      if (templateResult.rows.length === 0) {
        throw new Error('����ģ�岻����');
      }
      
      const template = templateResult.rows[0];
      processCode = template.code;
      processName = { zh: template.name_zh, th: template.name_th };
      processUnit = template.default_unit;
      displayOrder = template.display_order;
    } else if (customProcess) {
      // �Զ��幤��
      const { code, name, unit } = customProcess;
      
      if (!code || !name || !name.th) {
        throw new Error('������Ϣ������');
      }
      
      processCode = code;
      processName = { zh: name.zh || name.th, th: name.th };
      processUnit = unit || 'm2';
      displayOrder = 999; // �Զ��幤�����ں���
    } else {
      throw new Error('���ṩ����ģ��ID���Զ��幤����Ϣ');
    }
    
    // ��鹤���Ƿ��Ѵ���
    const existingCheck = await client.query(
      'SELECT id FROM process_nodes WHERE project_id = $1 AND process_code = $2',
      [projectId, processCode]
    );
    
    if (existingCheck.rows.length > 0) {
      throw new Error('�ù����Ѵ�������Ŀ��');
    }
    
    // ��������ڵ�
    const nodeResult = await client.query(`
      INSERT INTO process_nodes 
      (project_id, process_code, process_name, sequence_number)
      VALUES ($1, $2, $3::jsonb, $4)
      RETURNING id
    `, [projectId, processCode, JSON.stringify(processName), displayOrder || 0]);
    
    const nodeId = nodeResult.rows[0].id;
    
    // ��������ִ�м�¼
    await client.query(`
      INSERT INTO process_execution 
      (process_node_id, status, quantity_unit)
      VALUES ($1, 'not_started', $2)
    `, [nodeId, processUnit]);
    
    await logActivity(client, req.user.id, 'add_process', 'project', projectId, { code: processCode });
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: '�������ӳɹ�',
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

// ɾ����Ŀ����
router.delete('/projects/:projectId/processes/:processExecutionId', authenticate, requirePermission('manage_projects'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, processExecutionId } = req.params;
    
    await client.query('BEGIN');
    
    // ��ȡ������Ϣ
    const processInfo = await client.query(`
      SELECT pe.id, pe.process_node_id, pn.process_code, pn.process_name
      FROM process_execution pe
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pe.id = $1 AND pn.project_id = $2
    `, [processExecutionId, projectId]);
    
    if (processInfo.rows.length === 0) {
      throw new Error('���򲻴��ڻ����ڸ���Ŀ');
    }
    
    const process = processInfo.rows[0];
    
    // ��鹤��״̬������ɵĹ�������ɾ��
    const statusCheck = await client.query(
      'SELECT status FROM process_execution WHERE id = $1',
      [processExecutionId]
    );
    
    if (statusCheck.rows[0].status === 'completed') {
      throw new Error('����ɵĹ�����ɾ��');
    }
    
    // ɾ����ص�ÿ�ս��ȼ�¼
    await client.query(
      'DELETE FROM daily_progress WHERE process_execution_id = $1',
      [processExecutionId]
    );
    
    // ɾ����ص������񼰽���
    const subtasksResult = await client.query(
      'SELECT id FROM subtasks WHERE process_execution_id = $1',
      [processExecutionId]
    );
    
    for (const subtask of subtasksResult.rows) {
      await client.query('DELETE FROM subtask_progress WHERE subtask_id = $1', [subtask.id]);
    }
    
    await client.query('DELETE FROM subtasks WHERE process_execution_id = $1', [processExecutionId]);
    
    // ɾ������ִ�м�¼
    await client.query('DELETE FROM process_execution WHERE id = $1', [processExecutionId]);
    
    // ɾ������ڵ�
    await client.query('DELETE FROM process_nodes WHERE id = $1', [process.process_node_id]);
    
    await logActivity(client, req.user.id, 'delete_process', 'project', projectId, { 
      code: process.process_code,
      name: process.process_name 
    });
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: '����ɾ���ɹ�'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete process error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ============ Phase 3B: ����������ϵ���� ============

// ��ȡ�����������ϵ
router.get('/processes/:processExecutionId/dependencies', authenticate, async (req, res) => {
  try {
    const { processExecutionId } = req.params;
    
    // ��ȡ�ù��������Ĺ���ǰ�ã�
    const predecessors = await pool.query(`
      SELECT pd.*, 
             pe.id as depends_on_id,
             pn.process_code as depends_on_code,
             pn.process_name as depends_on_name,
             pe.status as depends_on_status
      FROM process_dependencies pd
      JOIN process_execution pe ON pd.depends_on_process_id = pe.id
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pd.process_execution_id = $1
      ORDER BY pd.id
    `, [processExecutionId]);
    
    // ��ȡ�����ù���Ĺ��򣨺��ã�
    const successors = await pool.query(`
      SELECT pd.*, 
             pe.id as successor_id,
             pn.process_code as successor_code,
             pn.process_name as successor_name,
             pe.status as successor_status
      FROM process_dependencies pd
      JOIN process_execution pe ON pd.process_execution_id = pe.id
      JOIN process_nodes pn ON pe.process_node_id = pn.id
      WHERE pd.depends_on_process_id = $1
      ORDER BY pd.id
    `, [processExecutionId]);
    
    res.json({
      success: true,
      data: {
        predecessors: predecessors.rows,
        successors: successors.rows
      }
    });
  } catch (error) {
    console.error('Get dependencies error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ��ȡ��Ŀ���й����������ϵ
router.get('/projects/:projectId/dependencies', authenticate, requireProjectAccess(), async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await pool.query(`
      SELECT pd.*, 
             pe1.id as from_process_id,
             pn1.process_code as from_code,
             pn1.process_name as from_name,
             pe2.id as to_process_id,
             pn2.process_code as to_code,
             pn2.process_name as to_name
      FROM process_dependencies pd
      JOIN process_execution pe1 ON pd.depends_on_process_id = pe1.id
      JOIN process_nodes pn1 ON pe1.process_node_id = pn1.id
      JOIN process_execution pe2 ON pd.process_execution_id = pe2.id
      JOIN process_nodes pn2 ON pe2.process_node_id = pn2.id
      WHERE pn1.project_id = $1
      ORDER BY pd.id
    `, [projectId]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get project dependencies error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ���ӹ���������ϵ
router.post('/processes/:processExecutionId/dependencies', authenticate, requirePermission('manage_projects'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { processExecutionId } = req.params;
    const { dependsOnProcessId, dependencyType, lagDays } = req.body;
    
    await client.query('BEGIN');
    
    // ��֤�������򶼴���������ͬһ��Ŀ
    const processCheck = await client.query(`
      SELECT p1.project_id as project1, p2.project_id as project2
      FROM process_execution pe1
      JOIN process_nodes p1 ON pe1.process_node_id = p1.id
      CROSS JOIN process_execution pe2
      JOIN process_nodes p2 ON pe2.process_node_id = p2.id
      WHERE pe1.id = $1 AND pe2.id = $2
    `, [processExecutionId, dependsOnProcessId]);
    
    if (processCheck.rows.length === 0) {
      throw new Error('���򲻴���');
    }
    
    if (processCheck.rows[0].project1 !== processCheck.rows[0].project2) {
      throw new Error('ֻ����ͬһ��Ŀ�ڽ���������ϵ');
    }
    
    // ����Ƿ���γ�ѭ������
    const circularCheck = await checkCircularDependency(client, processExecutionId, dependsOnProcessId);
    if (circularCheck) {
      throw new Error('��������ѭ������');
    }
    
    // ����������ϵ
    const result = await client.query(`
      INSERT INTO process_dependencies 
      (process_execution_id, depends_on_process_id, dependency_type, lag_days)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [processExecutionId, dependsOnProcessId, dependencyType || 'finish_to_start', lagDays || 0]);
    
    await logActivity(client, req.user.id, 'add_dependency', 'process', processExecutionId, {
      depends_on: dependsOnProcessId,
      type: dependencyType
    });
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: '������ϵ���ӳɹ�',
      data: result.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add dependency error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ɾ������������ϵ
router.delete('/dependencies/:dependencyId', authenticate, requirePermission('manage_projects'), async (req, res) => {
  try {
    const { dependencyId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM process_dependencies WHERE id = $1 RETURNING *',
      [dependencyId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('������ϵ������');
    }
    
    await logActivity(pool, req.user.id, 'delete_dependency', 'process', result.rows[0].process_execution_id);
    
    res.json({
      success: true,
      message: '������ϵɾ���ɹ�'
    });
  } catch (error) {
    console.error('Delete dependency error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ���¹���ƻ����ں͹���
router.put('/processes/:processExecutionId/schedule', authenticate, requirePermission('manage_projects'), async (req, res) => {
  try {
    const { processExecutionId } = req.params;
    const { plannedStartDate, plannedEndDate, plannedDuration } = req.body;
    
    const result = await pool.query(`
      UPDATE process_execution 
      SET planned_start_date = $1,
          planned_end_date = $2,
          planned_duration = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [plannedStartDate, plannedEndDate, plannedDuration, processExecutionId]);
    
    if (result.rows.length === 0) {
      throw new Error('���򲻴���');
    }
    
    res.json({
      success: true,
      message: '�ƻ����³ɹ�',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ���ѭ�������ĸ�������
async function checkCircularDependency(client, processId, dependsOnId, visited = new Set()) {
  if (processId === dependsOnId) {
    return true; // ֱ���γ�ѭ��
  }
  
  if (visited.has(dependsOnId)) {
    return false; // �Ѽ���
  }
  
  visited.add(dependsOnId);
  
  // ��ȡdependsOnId������ǰ������
  const result = await client.query(
    'SELECT depends_on_process_id FROM process_dependencies WHERE process_execution_id = $1',
    [dependsOnId]
  );
  
  for (const row of result.rows) {
    if (await checkCircularDependency(client, processId, row.depends_on_process_id, visited)) {
      return true;
    }
  }
  
  return false;
}


// ============ �ֳ����ţ���Ŀ��������Ŷӡ����塢�ɹ���֪ͨ ============
router.use(require('./site-routes'));
