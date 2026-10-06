/**
 * 待确认列表路由（汇总）
 */

const express = require('express');
const router = express.Router();
const pendingController = require('../controllers/pending.controller');
const authMiddleware = require('../middlewares/auth');
const { requireBoss } = require('../middlewares/role');

// 获取所有待确认项（节点 + 材料）
router.get(
  '/all',
  authMiddleware,
  requireBoss,
  pendingController.getAllPending.bind(pendingController)
);

module.exports = router;
