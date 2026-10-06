const express = require('express');
const router = express.Router();
const processController = require('../controllers/process.controller');
const { authenticate } = require('../middlewares/auth');

// 所有路由都需要认证
router.use(authenticate);

// 获取工序库（基础数据）
router.get('/library', processController.getProcessLibrary);

// 获取项目的工序列表
router.get('/project/:projectId', processController.getProjectProcesses);

// 为项目添加工序
router.post('/project/:projectId', processController.addProcessToProject);

// 工序打卡
router.post('/:nodeId/checkin', processController.checkInProcess);

// 工序审核
router.post('/:nodeId/approve', processController.approveProcess);

// 更新工序状态
router.put('/:nodeId/status', processController.updateProcessStatus);

// 删除工序
router.delete('/:nodeId', processController.deleteProcess);

module.exports = router;
