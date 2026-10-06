/**
 * 异常上报控制器
 */

const issueService = require('../services/issue.service');
const ResponseUtil = require('../utils/response');
const { buildPhotosJson } = require('../utils/file');

class IssueController {
  /**
   * 提交异常上报
   * POST /api/issues/submit
   */
  async submitIssue(req, res, next) {
    try {
      const { issueTitle, issueDescription, voiceText, watermarkInfo } = req.body;
      const files = req.files;
      
      // 验证必填字段
      if (!issueTitle || !issueDescription) {
        return res.status(400).json(
          ResponseUtil.error('异常标题和详细说明不能为空', 400)
        );
      }
      
      // 构建照片 JSON（可选）
      const photos = files && files.length > 0 ? buildPhotosJson(files) : [];
      
      // 解析水印信息
      let parsedWatermarkInfo = {};
      if (watermarkInfo) {
        try {
          parsedWatermarkInfo = typeof watermarkInfo === 'string' 
            ? JSON.parse(watermarkInfo) 
            : watermarkInfo;
        } catch (err) {
          console.warn('水印信息解析失败:', err);
        }
      }
      
      // 调用服务层
      const result = await issueService.submitIssue({
        projectId: req.user.projectId,
        reporterId: req.user.userId,
        issueTitle,
        issueDescription,
        photos,
        voiceText: voiceText || null,
        watermarkInfo: parsedWatermarkInfo
      });
      
      res.json(ResponseUtil.success(result, '异常上报提交成功'));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 老板回复异常
   * PUT /api/issues/:id/reply
   */
  async replyIssue(req, res, next) {
    try {
      const { id } = req.params;
      const { reply } = req.body;
      
      if (!reply) {
        return res.status(400).json(
          ResponseUtil.error('回复内容不能为空', 400)
        );
      }
      
      const result = await issueService.replyIssue(
        parseInt(id),
        req.user.userId,
        reply
      );
      
      res.json(ResponseUtil.success(result, '回复成功'));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 获取异常列表
   * GET /api/issues/list
   */
  async getIssueList(req, res, next) {
    try {
      const { status } = req.query;
      
      const result = await issueService.getIssueList(
        req.user.projectId,
        status
      );
      
      res.json(ResponseUtil.success(result));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 标记异常为已解决
   * PUT /api/issues/:id/resolve
   */
  async resolveIssue(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await issueService.resolveIssue(parseInt(id));
      
      res.json(ResponseUtil.success(result, '异常已标记为已解决'));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new IssueController();
