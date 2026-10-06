const express = require('express');
const router = express.Router();
const processController = require('../controllers/process.controller');
const { authenticate } = require('../middlewares/auth');

// 获取工序库（基础数据）
router.get('/library', authenticate, processController.getProcessLibrary);

// 获取项目的工序列表
router.get('/project/:projectId', authenticate, processController.getProjectProcesses);

// 为项目添加工序
router.post('/project/:projectId', authenticate, processController.addProcessToProject);

// 工序打卡
router.post('/:nodeId/checkin', authenticate, processController.checkInProcess);

// 工序审核
router.post('/:nodeId/approve', authenticate, processController.approveProcess);

// 更新工序状态
router.put('/:nodeId/status', authenticate, processController.updateProcessStatus);

// 删除工序
router.delete('/:nodeId', authenticate, processController.deleteProcess);

module.exports = router;
