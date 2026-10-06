/**
 * 节点打卡路由
 */

const express = require('express');
const router = express.Router();
const nodeController = require('../controllers/node.controller');
const authMiddleware = require('../middlewares/auth');
const { requireBoss, requireAuth } = require('../middlewares/role');
const upload = require('../config/upload');

// 提交节点打卡（工人用，需上传照片）
router.post(
  '/submit',
  authMiddleware,
  requireAuth,
  upload.array('photos', 10),  // 接收最多10张照片
  nodeController.submitNode.bind(nodeController)
);

// 获取我的任务列表（工人用）
router.get(
  '/my-tasks',
  authMiddleware,
  requireAuth,
  nodeController.getMyTasks.bind(nodeController)
);

// 获取待确认的节点列表（老板用）
router.get(
  '/pending',
  authMiddleware,
  requireBoss,
  nodeController.getPendingNodes.bind(nodeController)
);

// 确认节点（老板用）
router.put(
  '/:id/confirm',
  authMiddleware,
  requireBoss,
  nodeController.confirmNode.bind(nodeController)
);

module.exports = router;
