const workerService = require('../services/worker.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * 获取项目的工人列表
 */
exports.getWorkers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status } = req.query;
    const { user_id, role } = req.user;

    const workers = await workerService.getWorkersByProject(projectId, user_id, role, status);
    return successResponse(res, workers, '获取工人列表成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 添加工人
 */
exports.addWorker = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const workerData = {
      ...req.body,
      project_id: projectId
    };

    const worker = await workerService.addWorker(workerData);
    return successResponse(res, worker, '添加工人成功', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 更新工人信息
 */
exports.updateWorker = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const updateData = req.body;

    const worker = await workerService.updateWorker(workerId, updateData);
    return successResponse(res, worker, '更新工人信息成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 删除工人
 */
exports.deleteWorker = async (req, res, next) => {
  try {
    const { workerId } = req.params;
    const { role } = req.user;

    if (role !== 'boss') {
      return errorResponse(res, '只有管理员可以删除工人', 403);
    }

    await workerService.deleteWorker(workerId);
    return successResponse(res, null, '删除工人成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 获取考勤记录
 */
exports.getAttendance = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { start_date, end_date, worker_id } = req.query;
    const { user_id, role } = req.user;

    const attendance = await workerService.getAttendance(
      projectId, 
      user_id, 
      role, 
      start_date, 
      end_date, 
      worker_id
    );
    return successResponse(res, attendance, '获取考勤记录成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 记录考勤
 */
exports.recordAttendance = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { user_id } = req.user;
    const attendanceData = {
      ...req.body,
      project_id: projectId,
      created_by: user_id
    };

    const record = await workerService.recordAttendance(attendanceData);
    return successResponse(res, record, '考勤记录成功', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 批量记录考勤
 */
exports.batchRecordAttendance = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { user_id } = req.user;
    const { date, attendance_list } = req.body;

    if (!Array.isArray(attendance_list) || attendance_list.length === 0) {
      return errorResponse(res, '考勤列表不能为空', 400);
    }

    const records = await workerService.batchRecordAttendance(
      projectId, 
      date, 
      attendance_list, 
      user_id
    );
    return successResponse(res, records, '批量考勤记录成功', 201);
  } catch (error) {
    next(error);
  }
};
