const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { authenticate } = require('../middlewares/auth');

// 项目列表（需要认证）
router.get('/', authenticate, projectController.getProjects);

// 创建项目
router.post('/', authenticate, projectController.createProject);

// 获取项目详情
router.get('/:id', authenticate, projectController.getProjectById);

// 更新项目
router.put('/:id', authenticate, projectController.updateProject);

// 删除项目
router.delete('/:id', authenticate, projectController.deleteProject);

// 获取项目统计
router.get('/:id/stats', authenticate, projectController.getProjectStats);

module.exports = router;
