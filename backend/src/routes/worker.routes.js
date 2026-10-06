const express = require('express');
const router = express.Router();
const workerController = require('../controllers/worker.controller');
const { authenticate } = require('../middlewares/auth');

// 工人管理
router.get('/project/:projectId', authenticate, workerController.getWorkers);
router.post('/project/:projectId', authenticate, workerController.addWorker);
router.put('/:workerId', authenticate, workerController.updateWorker);
router.delete('/:workerId', authenticate, workerController.deleteWorker);

// 考勤管理
router.get('/project/:projectId/attendance', authenticate, workerController.getAttendance);
router.post('/project/:projectId/attendance', authenticate, workerController.recordAttendance);
router.post('/project/:projectId/attendance/batch', authenticate, workerController.batchRecordAttendance);

module.exports = router;
