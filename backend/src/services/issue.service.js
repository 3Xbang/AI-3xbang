/**
 * 异常上报服务
 */

const db = require('../config/db');

class IssueService {
  /**
   * 提交异常上报
   * @param {Object} data - 提交数据
   * @returns {Object} 创建的记录
   */
  async submitIssue(data) {
    const { 
      projectId, 
      reporterId, 
      issueTitle,
      issueDescription, 
      photos,           // 可选：照片
      voiceText,        // 可选：语音转文字
      watermarkInfo
    } = data;
    
    const result = await db.query(`
      INSERT INTO issue_reports (
        project_id, reporter_id, issue_title, issue_description,
        photos_json, voice_text, watermark_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      projectId, 
      reporterId, 
      issueTitle,
      issueDescription,
      photos && photos.length > 0 ? JSON.stringify(photos) : '[]',
      voiceText || null,
      JSON.stringify(watermarkInfo || {})
    ]);
    
    const record = result.rows[0];
    
    return {
      ...record,
      photos_json: JSON.parse(record.photos_json),
      watermark_info: JSON.parse(record.watermark_info)
    };
  }
  
  /**
   * 老板回复异常
   * @param {Number} issueId - 异常ID
   * @param {Number} bossId - 老板用户ID
   * @param {String} reply - 回复内容
   * @returns {Object} 更新后的记录
   */
  async replyIssue(issueId, bossId, reply) {
    const result = await db.query(`
      UPDATE issue_reports 
      SET boss_reply = $1, replied_by = $2, replied_at = NOW(), status = 'replied'
      WHERE id = $3
      RETURNING *
    `, [reply, bossId, issueId]);
    
    if (result.rows.length === 0) {
      const error = new Error('异常报告不存在');
      error.statusCode = 404;
      throw error;
    }
    
    const record = result.rows[0];
    
    return {
      ...record,
      photos_json: JSON.parse(record.photos_json),
      watermark_info: JSON.parse(record.watermark_info)
    };
  }
  
  /**
   * 获取异常列表
   * @param {Number} projectId - 项目ID
   * @param {String} status - 状态筛选
   * @returns {Array} 异常列表
   */
  async getIssueList(projectId, status = null) {
    let query = `
      SELECT 
        ir.*,
        u.full_name AS reporter_name,
        ub.full_name AS replier_name,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ir.report_time)) / 3600 AS hours_ago
      FROM issue_reports ir
      JOIN users u ON ir.reporter_id = u.id
      LEFT JOIN users ub ON ir.replied_by = ub.id
      WHERE ir.project_id = $1
    `;
    
    const params = [projectId];
    
    if (status) {
      query += ' AND ir.status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY ir.report_time DESC';
    
    const result = await db.query(query, params);
    
    return result.rows.map(row => ({
      ...row,
      photos_json: JSON.parse(row.photos_json),
      watermark_info: JSON.parse(row.watermark_info),
      hours_ago: parseFloat(row.hours_ago.toFixed(1))
    }));
  }
  
  /**
   * 标记异常为已解决
   * @param {Number} issueId - 异常ID
   * @returns {Object} 更新后的记录
   */
  async resolveIssue(issueId) {
    const result = await db.query(`
      UPDATE issue_reports 
      SET status = 'resolved'
      WHERE id = $1
      RETURNING *
    `, [issueId]);
    
    if (result.rows.length === 0) {
      const error = new Error('异常报告不存在');
      error.statusCode = 404;
      throw error;
    }
    
    return result.rows[0];
  }
}

module.exports = new IssueService();
