const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');

const projectCtrl = require('../controllers/simple-project.controller');
const processCtrl = require('../controllers/simple-process.controller');
const workerCtrl = require('../controllers/simple-worker.controller');

// ========== 项目管理 ==========
router.get('/projects', authenticate, projectCtrl.getProjects);
router.post('/projects', authenticate, projectCtrl.createProject);
router.get('/projects/:id', authenticate, projectCtrl.getProjectById);
router.put('/projects/:id', authenticate, projectCtrl.updateProject);

// ========== 工序管理 ==========
router.get('/processes/library', authenticate, processCtrl.getProcessLibrary);
router.get('/projects/:projectId/processes', authenticate, processCtrl.getProjectProcesses);
router.post('/projects/:projectId/processes', authenticate, processCtrl.addProcess);
router.post('/processes/:nodeId/checkin', authenticate, processCtrl.checkin);

// ========== 工人管理 ==========
router.get('/projects/:projectId/workers', authenticate, workerCtrl.getWorkers);
router.post('/projects/:projectId/workers', authenticate, workerCtrl.addWorker);

// ========== 考勤管理 ==========
router.get('/projects/:projectId/attendance', authenticate, workerCtrl.getAttendance);
router.post('/projects/:projectId/attendance', authenticate, workerCtrl.recordAttendance);

module.exports = router;
