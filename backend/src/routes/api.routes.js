const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const api = require('../controllers/api.controller');

// 项目
router.get('/projects', authenticate, api.getProjects);
router.post('/projects', authenticate, api.createProject);

// 工序
router.get('/processes/library', authenticate, api.getProcessLibrary);
router.get('/projects/:projectId/processes', authenticate, api.getProjectProcesses);
router.post('/projects/:projectId/processes', authenticate, api.addProcess);
router.post('/processes/:nodeId/checkin', authenticate, api.processCheckin);

// 工人
router.get('/projects/:projectId/workers', authenticate, api.getWorkers);
router.post('/projects/:projectId/workers', authenticate, api.addWorker);

// 考勤
router.get('/projects/:projectId/attendance', authenticate, api.getAttendance);
router.post('/projects/:projectId/attendance', authenticate, api.recordAttendance);

module.exports = router;
