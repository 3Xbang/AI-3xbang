const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { authenticate } = require('../middlewares/auth');

// 所有路由都需要认证
router.use(authenticate);

// 项目列表
router.get('/', projectController.getProjects);

// 创建项目
router.post('/', projectController.createProject);

// 获取项目详情
router.get('/:id', projectController.getProjectById);

// 更新项目
router.put('/:id', projectController.updateProject);

// 删除项目
router.delete('/:id', projectController.deleteProject);

// 获取项目统计
router.get('/:id/stats', projectController.getProjectStats);

module.exports = router;
