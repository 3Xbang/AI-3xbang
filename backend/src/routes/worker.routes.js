const express = require('express');
const router = express.Router();
const workerController = require('../controllers/worker.controller');
const { authenticate } = require('../middlewares/auth');

// 所有路由都需要认证
router.use(authenticate);

// 工人管理
router.get('/project/:projectId', workerController.getWorkers);
router.post('/project/:projectId', workerController.addWorker);
router.put('/:workerId', workerController.updateWorker);
router.delete('/:workerId', workerController.deleteWorker);

// 考勤管理
router.get('/project/:projectId/attendance', workerController.getAttendance);
router.post('/project/:projectId/attendance', workerController.recordAttendance);
router.post('/project/:projectId/attendance/batch', workerController.batchRecordAttendance);

module.exports = router;
