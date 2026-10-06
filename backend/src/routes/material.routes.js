/**
 * 材料进场路由
 */

const express = require('express');
const router = express.Router();
const materialController = require('../controllers/material.controller');
const authMiddleware = require('../middlewares/auth');
const { requireBoss, requireAuth } = require('../middlewares/role');
const upload = require('../config/upload');

// 提交材料进场（工人用，需上传照片）
router.post(
  '/submit',
  authMiddleware,
  requireAuth,
  upload.array('photos', 10),
  materialController.submitMaterial.bind(materialController)
);

// 获取待确认的材料列表（老板用）
router.get(
  '/pending',
  authMiddleware,
  requireBoss,
  materialController.getPendingMaterials.bind(materialController)
);

// 确认材料（老板用）
router.put(
  '/:id/confirm',
  authMiddleware,
  requireBoss,
  materialController.confirmMaterial.bind(materialController)
);

// 查询材料进场历史
router.get(
  '/history',
  authMiddleware,
  requireAuth,
  materialController.getMaterialHistory.bind(materialController)
);

module.exports = router;
