/**
 * 材料进场控制器
 */

const materialService = require('../services/material.service');
const ResponseUtil = require('../utils/response');
const { buildPhotosJson, validatePhotoCount } = require('../utils/file');

class MaterialController {
  /**
   * 提交材料进场
   * POST /api/materials/submit
   */
  async submitMaterial(req, res, next) {
    try {
      const { 
        materialName, 
        quantity, 
        unit,
        plannedQuantity,
        watermarkInfo,
        supplierName,
        deliveryPerson,
        qualityNotes,
        notes
      } = req.body;
      const files = req.files;
      
      // 1. 验证必填字段
      if (!materialName || !quantity || !unit) {
        return res.status(400).json(
          ResponseUtil.error('材料名称、数量、单位不能为空', 400)
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
      const result = await materialService.submitMaterial({
        projectId: req.user.projectId,
        materialName,
        quantity: parseFloat(quantity),
        unit,
        plannedQuantity: plannedQuantity ? parseFloat(plannedQuantity) : null,
        submitterId: req.user.userId,
        photos,
        watermarkInfo: parsedWatermarkInfo,
        supplierName: supplierName || null,
        deliveryPerson: deliveryPerson || null,
        qualityNotes: qualityNotes || null,
        notes: notes || null
      });
      
      res.json(ResponseUtil.success(result, '材料进场提交成功'));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 老板确认材料
   * PUT /api/materials/:id/confirm
   */
  async confirmMaterial(req, res, next) {
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
      const result = await materialService.confirmMaterial(
        parseInt(id),
        req.user.userId,
        action,
        rejectionReason
      );
      
      const message = action === 'approve' ? '材料已确认通过' : '材料已驳回';
      res.json(ResponseUtil.success(result, message));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 获取待确认的材料列表（老板用）
   * GET /api/materials/pending
   */
  async getPendingMaterials(req, res, next) {
    try {
      const result = await materialService.getPendingMaterials(req.user.projectId);
      res.json(ResponseUtil.success(result));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 查询材料进场历史
   * GET /api/materials/history
   */
  async getMaterialHistory(req, res, next) {
    try {
      const { materialName, status, startDate, endDate } = req.query;
      
      const result = await materialService.getMaterialHistory(
        req.user.projectId,
        { materialName, status, startDate, endDate }
      );
      
      res.json(ResponseUtil.success(result));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MaterialController();
