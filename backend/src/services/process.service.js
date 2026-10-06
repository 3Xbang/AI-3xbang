const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

/**
 * 获取工序库（从JSON文件）
 */
exports.getProcessLibrary = async (lang = 'zh') => {
  const filePath = path.join(__dirname, '../../data/processes.json');
  const data = await fs.readFile(filePath, 'utf8');
  const processes = JSON.parse(data);

  // 根据语言返回对应的名称和描述
  return processes.map(process => ({
    id: process.id,
    code: process.code,
    name: process.name[lang] || process.name.zh,
    description: process.description[lang] || process.description.zh,
    category: process.category,
    phase: process.phase,
    duration_days: process.duration_days,
    workers_required: process.workers_required,
    base_labor_cost: process.base_labor_cost,
    prerequisites: process.prerequisites,
    materials: process.materials,
    tools: process.tools
  }));
};

/**
 * 获取项目的工序节点列表
 */
exports.getProjectProcesses = async (projectId, userId, userRole) => {
  // 检查项目权限
  const projectService = require('./project.service');
  await projectService.getProjectById(projectId, userId, userRole);

  const query = `
    SELECT 
      pn.*,
      u.username as operator_name
    FROM process_nodes pn
    LEFT JOIN users u ON pn.operator_id = u.user_id
    WHERE pn.project_id = $1
    ORDER BY pn.sequence, pn.created_at
  `;

  const result = await pool.query(query, [projectId]);
  return result.rows;
};

/**
 * 为项目添加工序节点
 */
exports.addProcessToProject = async (processData) => {
  const {
    project_id,
    process_code,
    process_name,
    planned_start_date,
    planned_end_date,
    sequence,
    created_by
  } = processData;

  const query = `
    INSERT INTO process_nodes (
      project_id, process_code, process_name, 
      planned_start_date, planned_end_date, sequence, 
      status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
    RETURNING *
  `;

  const result = await pool.query(query, [
    project_id,
    process_code,
    process_name,
    planned_start_date || null,
    planned_end_date || null,
    sequence || 0,
    created_by
  ]);

  return result.rows[0];
};

/**
 * 工序打卡（开始/完成）
 */
exports.checkInProcess = async (nodeId, userId, action, photos = []) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 获取当前工序节点
    const nodeQuery = 'SELECT * FROM process_nodes WHERE node_id = $1';
    const nodeResult = await client.query(nodeQuery, [nodeId]);

    if (nodeResult.rows.length === 0) {
      throw new Error('工序节点不存在');
    }

    const node = nodeResult.rows[0];
    let newStatus;
    let updateField;
    let updateValue;

    if (action === 'start') {
      if (node.status !== 'pending') {
        throw new Error('只有待开始的工序可以打卡开始');
      }
      newStatus = 'in_progress';
      updateField = 'actual_start_date';
      updateValue = new Date();
    } else if (action === 'complete') {
      if (node.status !== 'in_progress') {
        throw new Error('只有进行中的工序可以打卡完成');
      }
      newStatus = 'completed';
      updateField = 'actual_end_date';
      updateValue = new Date();
    } else {
      throw new Error('无效的打卡操作');
    }

    // 更新工序节点状态
    const updateQuery = `
      UPDATE process_nodes 
      SET status = $1, ${updateField} = $2, operator_id = $3, updated_at = CURRENT_TIMESTAMP
      WHERE node_id = $4
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [newStatus, updateValue, userId, nodeId]);

    // 记录打卡记录
    const recordQuery = `
      INSERT INTO node_records (
        node_id, operator_id, record_type, photos, record_time
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    await client.query(recordQuery, [
      nodeId,
      userId,
      action === 'start' ? 'checkin' : 'checkout',
      JSON.stringify(photos),
      updateValue
    ]);

    await client.query('COMMIT');

    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 工序审核
 */
exports.approveProcess = async (nodeId, foremanId, approved, comments) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 获取工序节点
    const nodeQuery = 'SELECT * FROM process_nodes WHERE node_id = $1';
    const nodeResult = await client.query(nodeQuery, [nodeId]);

    if (nodeResult.rows.length === 0) {
      throw new Error('工序节点不存在');
    }

    const node = nodeResult.rows[0];

    if (node.status !== 'completed') {
      throw new Error('只有已完成的工序可以审核');
    }

    const newStatus = approved ? 'approved' : 'rejected';

    // 更新工序节点
    const updateQuery = `
      UPDATE process_nodes 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE node_id = $2
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [newStatus, nodeId]);

    // 记录审核记录
    const recordQuery = `
      INSERT INTO node_records (
        node_id, operator_id, record_type, notes, record_time
      ) VALUES ($1, $2, 'approval', $3, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    await client.query(recordQuery, [
      nodeId,
      foremanId,
      JSON.stringify({ approved, comments })
    ]);

    // 如果驳回，将状态改回 in_progress
    if (!approved) {
      await client.query(
        'UPDATE process_nodes SET status = $1 WHERE node_id = $2',
        ['in_progress', nodeId]
      );
    }

    await client.query('COMMIT');

    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 更新工序状态
 */
exports.updateProcessStatus = async (nodeId, status) => {
  const validStatuses = ['pending', 'in_progress', 'completed', 'approved', 'rejected'];

  if (!validStatuses.includes(status)) {
    throw new Error('无效的状态');
  }

  const query = `
    UPDATE process_nodes 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE node_id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [status, nodeId]);

  if (result.rows.length === 0) {
    throw new Error('工序节点不存在');
  }

  return result.rows[0];
};

/**
 * 删除工序节点
 */
exports.deleteProcess = async (nodeId) => {
  const query = 'DELETE FROM process_nodes WHERE node_id = $1';
  const result = await pool.query(query, [nodeId]);

  if (result.rowCount === 0) {
    throw new Error('工序节点不存在');
  }
};
