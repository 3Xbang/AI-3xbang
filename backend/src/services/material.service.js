/**
 * 材料进场服务
 * 核心业务：材料偏差自动校验、三单匹配基础
 */

const db = require('../config/db');

class MaterialService {
  /**
   * 提交材料进场记录
   * @param {Object} data - 提交数据
   * @returns {Object} 创建的记录
   */
  async submitMaterial(data) {
    const { 
      projectId, 
      materialName, 
      quantity, 
      unit,
      plannedQuantity,  // 可选：计划数量
      submitterId, 
      photos, 
      watermarkInfo,
      supplierName,     // 可选：供应商
      deliveryPerson,   // 可选：送货人
      qualityNotes,     // 可选：质量说明
      notes             // 可选：备注
    } = data;
    
    // 插入记录（触发器会自动计算 variance_percentage）
    const result = await db.query(`
      INSERT INTO material_records (
        project_id, material_name, quantity, unit, planned_quantity,
        submitter_id, photos_json, photo_count, watermark_info,
        supplier_name, delivery_person, quality_notes, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      projectId, 
      materialName, 
      quantity, 
      unit, 
      plannedQuantity || null,
      submitterId, 
      JSON.stringify(photos), 
      photos.length,
      JSON.stringify(watermarkInfo),
      supplierName || null,
      deliveryPerson || null,
      qualityNotes || null,
      notes || null
    ]);
    
    const record = result.rows[0];
    
    // 判断是否标红（偏差 > 10%）
    const needsAttention = record.variance_percentage && 
                           Math.abs(record.variance_percentage) > 10;
    
    return {
      ...record,
      photos_json: JSON.parse(record.photos_json),
      watermark_info: JSON.parse(record.watermark_info),
      needsAttention,
      warningMessage: needsAttention 
        ? `⚠️ 实际数量与计划偏差 ${record.variance_percentage.toFixed(1)}%` 
        : null
    };
  }
  
  /**
   * 老板确认材料（通过或驳回）
   * @param {Number} recordId - 记录ID
   * @param {Number} bossId - 老板用户ID
   * @param {String} action - 'approve' 或 'reject'
   * @param {String} rejectionReason - 驳回原因
   * @returns {Object} 更新后的记录
   */
  async confirmMaterial(recordId, bossId, action, rejectionReason = null) {
    // 1. 获取记录
    const recordResult = await db.query(
      'SELECT * FROM material_records WHERE id = $1',
      [recordId]
    );
    
    if (recordResult.rows.length === 0) {
      const error = new Error('材料进场记录不存在');
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
      UPDATE material_records 
      SET status = $1, confirmed_by = $2, confirmed_at = NOW(),
          rejection_reason = $3
      WHERE id = $4
      RETURNING *
    `, [newStatus, bossId, rejectionReason, recordId]);
    
    return result.rows[0];
  }
  
  /**
   * 获取待确认的材料列表（老板用）
   * @param {Number} projectId - 项目ID
   * @returns {Array} 待确认列表
   */
  async getPendingMaterials(projectId) {
    const result = await db.query(`
      SELECT 
        mr.id,
        mr.project_id,
        mr.material_name,
        mr.quantity,
        mr.unit,
        mr.planned_quantity,
        mr.variance_percentage,
        mr.submit_time,
        mr.photos_json,
        mr.photo_count,
        mr.watermark_info,
        mr.supplier_name,
        mr.delivery_person,
        mr.quality_notes,
        mr.notes,
        mr.status,
        u.full_name AS submitter_name,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - mr.submit_time)) / 3600 AS hours_ago
      FROM material_records mr
      JOIN users u ON mr.submitter_id = u.id
      WHERE mr.project_id = $1 AND mr.status = 'pending'
      ORDER BY mr.submit_time DESC
    `, [projectId]);
    
    return result.rows.map(row => ({
      ...row,
      photos_json: JSON.parse(row.photos_json),
      watermark_info: JSON.parse(row.watermark_info),
      hours_ago: parseFloat(row.hours_ago.toFixed(1)),
      needsAttention: row.variance_percentage && Math.abs(row.variance_percentage) > 10,
      warningMessage: row.variance_percentage && Math.abs(row.variance_percentage) > 10
        ? `⚠️ 实际数量与计划偏差 ${row.variance_percentage.toFixed(1)}%`
        : null
    }));
  }
  
  /**
   * 查询材料进场历史
   * @param {Number} projectId - 项目ID
   * @param {Object} filters - 过滤条件
   * @returns {Array} 历史记录
   */
  async getMaterialHistory(projectId, filters = {}) {
    const { materialName, status, startDate, endDate } = filters;
    
    let query = `
      SELECT 
        mr.*,
        u.full_name AS submitter_name,
        uc.full_name AS confirmer_name
      FROM material_records mr
      JOIN users u ON mr.submitter_id = u.id
      LEFT JOIN users uc ON mr.confirmed_by = uc.id
      WHERE mr.project_id = $1
    `;
    
    const params = [projectId];
    let paramIndex = 2;
    
    if (materialName) {
      query += ` AND mr.material_name ILIKE $${paramIndex}`;
      params.push(`%${materialName}%`);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND mr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (startDate) {
      query += ` AND mr.submit_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      query += ` AND mr.submit_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    query += ' ORDER BY mr.submit_time DESC';
    
    const result = await db.query(query, params);
    
    return result.rows.map(row => ({
      ...row,
      photos_json: JSON.parse(row.photos_json),
      watermark_info: JSON.parse(row.watermark_info)
    }));
  }
}

module.exports = new MaterialService();
