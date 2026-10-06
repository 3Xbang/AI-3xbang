/**
 * 节点打卡服务
 * 核心业务：工序流转控制、前置节点校验
 */

const db = require('../config/db');

class NodeService {
  /**
   * 提交节点打卡
   * @param {Object} data - 提交数据
   * @returns {Object} 创建的记录
   */
  async submitNode(data) {
    const { 
      projectId, 
      nodeId, 
      submitterId, 
      photos, 
      watermarkInfo,
      workDescription,  // 可选：工作说明
      notes             // 可选：备注
    } = data;
    
    // 1. 检查前置节点是否已确认
    const checkResult = await db.query(
      'SELECT * FROM check_node_submittable($1, $2)',
      [projectId, nodeId]
    );
    
    const canSubmit = checkResult.rows[0];
    
    if (!canSubmit.can_submit) {
      const error = new Error(
        `无法提交：${canSubmit.reason}。前置节点"${canSubmit.prev_node_name}"尚未确认通过。`
      );
      error.statusCode = 400;
      throw error;
    }
    
    // 2. 插入节点打卡记录
    const result = await db.query(`
      INSERT INTO node_records (
        project_id, node_id, submitter_id, 
        photos_json, photo_count, watermark_info,
        work_description, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      projectId, 
      nodeId, 
      submitterId, 
      JSON.stringify(photos), 
      photos.length,
      JSON.stringify(watermarkInfo),
      workDescription || null,
      notes || null
    ]);
    
    const record = result.rows[0];
    
    // 3. 关联节点名称（方便前端显示）
    const nodeInfo = await db.query(
      'SELECT node_name, node_code FROM process_nodes WHERE id = $1',
      [nodeId]
    );
    
    return {
      ...record,
      node_name: nodeInfo.rows[0]?.node_name,
      node_code: nodeInfo.rows[0]?.node_code,
      photos_json: JSON.parse(record.photos_json),
      watermark_info: JSON.parse(record.watermark_info)
    };
  }
  
  /**
   * 老板确认节点（通过或驳回）
   * @param {Number} recordId - 记录ID
   * @param {Number} bossId - 老板用户ID
   * @param {String} action - 'approve' 或 'reject'
   * @param {String} rejectionReason - 驳回原因（action为reject时必填）
   * @returns {Object} 更新后的记录
   */
  async confirmNode(recordId, bossId, action, rejectionReason = null) {
    // 1. 获取记录
    const recordResult = await db.query(
      'SELECT * FROM node_records WHERE id = $1',
      [recordId]
    );
    
    if (recordResult.rows.length === 0) {
      const error = new Error('节点打卡记录不存在');
      error.statusCode = 404;
      throw error;
    }
    
    const record = recordResult.rows[0];
    
    if (record.status !== 'pending') {
      const error = new Error('该记录已处理，无法重复操作');
      error.statusCode = 400;
      throw error;
    }
    
    // 2. 驳回时必须填写原因
    if (action === 'reject' && !rejectionReason) {
      const error = new Error('驳回时必须填写驳回原因');
      error.statusCode = 400;
      throw error;
    }
    
    // 3. 更新状态
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    const result = await db.query(`
      UPDATE node_records 
      SET status = $1, confirmed_by = $2, confirmed_at = NOW(),
          rejection_reason = $3
      WHERE id = $4
      RETURNING *
    `, [newStatus, bossId, rejectionReason, recordId]);
    
    return result.rows[0];
  }
  
  /**
   * 获取待确认的节点列表（老板用）
   * @param {Number} projectId - 项目ID
   * @returns {Array} 待确认列表
   */
  async getPendingNodes(projectId) {
    const result = await db.query(`
      SELECT 
        nr.id,
        nr.project_id,
        nr.submit_time,
        nr.photos_json,
        nr.photo_count,
        nr.watermark_info,
        nr.work_description,
        nr.notes,
        nr.status,
        pn.node_name,
        pn.node_code,
        u.full_name AS submitter_name,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - nr.submit_time)) / 3600 AS hours_ago
      FROM node_records nr
      JOIN process_nodes pn ON nr.node_id = pn.id
      JOIN users u ON nr.submitter_id = u.id
      WHERE nr.project_id = $1 AND nr.status = 'pending'
      ORDER BY nr.submit_time DESC
    `, [projectId]);
    
    return result.rows.map(row => ({
      ...row,
      photos_json: JSON.parse(row.photos_json),
      watermark_info: JSON.parse(row.watermark_info),
      hours_ago: parseFloat(row.hours_ago.toFixed(1))
    }));
  }
  
  /**
   * 获取我的任务列表（工人用）
   * @param {Number} projectId - 项目ID
   * @returns {Array} 任务列表
   */
  async getMyTasks(projectId) {
    const result = await db.query(`
      SELECT 
        pn.id AS node_id,
        pn.node_name,
        pn.node_code,
        pn.sort_order,
        pn.description,
        COALESCE(nr.status, 'locked') AS node_status,
        nr.id AS record_id,
        nr.submit_time,
        nr.confirmed_at
      FROM process_nodes pn
      LEFT JOIN node_records nr ON pn.id = nr.node_id 
        AND nr.project_id = $1
        AND nr.status IN ('pending', 'approved')
      ORDER BY pn.sort_order
    `, [projectId]);
    
    return result.rows;
  }
}

module.exports = new NodeService();
