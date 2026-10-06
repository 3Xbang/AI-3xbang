/**
 * 节点打卡控制器
 */

const nodeService = require('../services/node.service');
const ResponseUtil = require('../utils/response');
const { buildPhotosJson, validatePhotoCount } = require('../utils/file');

class NodeController {
  /**
   * 提交节点打卡
   * POST /api/nodes/submit
   */
  async submitNode(req, res, next) {
    try {
      const { nodeId, watermarkInfo, workDescription, notes } = req.body;
      const files = req.files;
      
      // 1. 验证必填字段
      if (!nodeId) {
        return res.status(400).json(
          ResponseUtil.error('请选择工序节点', 400)
        );
      }
      
      // 2. 验证照片数量（至少3张）
      const photoValidation = validatePhotoCount(files, 3);
      if (!photoValidation.valid) {
        return res.status(400).json(
          ResponseUtil.error(photoValidation.message, 400)
        );
      }
      
      // 3. 构建照片 JSON
      const photos = buildPhotosJson(files);
      
      // 4. 解析水印信息
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
      
      // 5. 调用服务层
      const result = await nodeService.submitNode({
        projectId: req.user.projectId,  // 从 JWT 获取
        nodeId: parseInt(nodeId),
        submitterId: req.user.userId,
        photos,
        watermarkInfo: parsedWatermarkInfo,
        workDescription: workDescription || null,
        notes: notes || null
      });
      
      res.json(ResponseUtil.success(result, '节点打卡提交成功'));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 老板确认节点
   * PUT /api/nodes/:id/confirm
   */
  async confirmNode(req, res, next) {
    try {
      const { id } = req.params;
      const { action, rejectionReason } = req.body;
      
      // 验证 action
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json(
          ResponseUtil.error('action 必须为 approve 或 reject', 400)
        );
      }
      
      // 调用服务层
      const result = await nodeService.confirmNode(
        parseInt(id),
        req.user.userId,
        action,
        rejectionReason
      );
      
      const message = action === 'approve' ? '节点已确认通过' : '节点已驳回';
      res.json(ResponseUtil.success(result, message));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 获取待确认的节点列表（老板用）
   * GET /api/nodes/pending
   */
  async getPendingNodes(req, res, next) {
    try {
      const result = await nodeService.getPendingNodes(req.user.projectId);
      res.json(ResponseUtil.success(result));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 获取我的任务列表（工人用）
   * GET /api/nodes/my-tasks
   */
  async getMyTasks(req, res, next) {
    try {
      const result = await nodeService.getMyTasks(req.user.projectId);
      res.json(ResponseUtil.success(result));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NodeController();
