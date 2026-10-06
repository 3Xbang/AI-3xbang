/**
 * 异常上报路由
 */

const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issue.controller');
const authMiddleware = require('../middlewares/auth');
const { requireBoss, requireAuth } = require('../middlewares/role');
const upload = require('../config/upload');

// 提交异常上报（工人用，照片可选）
router.post(
  '/submit',
  authMiddleware,
  requireAuth,
  upload.array('photos', 10),
  issueController.submitIssue.bind(issueController)
);

// 获取异常列表
router.get(
  '/list',
  authMiddleware,
  requireAuth,
  issueController.getIssueList.bind(issueController)
);

// 老板回复异常
router.put(
  '/:id/reply',
  authMiddleware,
  requireBoss,
  issueController.replyIssue.bind(issueController)
);

// 标记异常为已解决
router.put(
  '/:id/resolve',
  authMiddleware,
  requireBoss,
  issueController.resolveIssue.bind(issueController)
);

module.exports = router;
