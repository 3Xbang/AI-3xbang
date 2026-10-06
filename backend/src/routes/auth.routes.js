/**
 * 认证路由
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');

// 登录（无需认证）
router.post('/login', authController.login.bind(authController));

// 登出（需认证）
router.post('/logout', authMiddleware, authController.logout.bind(authController));

// 获取当前用户信息（需认证）
router.get('/me', authMiddleware, authController.getCurrentUser.bind(authController));

module.exports = router;
