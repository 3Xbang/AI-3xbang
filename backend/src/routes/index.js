/**
 * 路由汇总
 */

const express = require('express');
const router = express.Router();

// 导入各模块路由
const authRoutes = require('./auth.routes');
const simpleApiRoutes = require('./simple-api.routes');
const nodeRoutes = require('./node.routes');
const materialRoutes = require('./material.routes');
const issueRoutes = require('./issue.routes');
const pendingRoutes = require('./pending.routes');

// 挂载路由
router.use('/auth', authRoutes);
router.use('/', simpleApiRoutes); // 新的简化API
router.use('/nodes', nodeRoutes);
router.use('/materials', materialRoutes);
router.use('/issues', issueRoutes);
router.use('/pending', pendingRoutes);

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
