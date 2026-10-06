const processService = require('../services/process.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * 获取工序库（基础数据）
 */
exports.getProcessLibrary = async (req, res, next) => {
  try {
    const { lang = 'zh' } = req.query;
    const library = await processService.getProcessLibrary(lang);
    return successResponse(res, library, '获取工序库成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 获取项目的工序节点列表
 */
exports.getProjectProcesses = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { user_id, role } = req.user;

    const processes = await processService.getProjectProcesses(projectId, user_id, role);
    return successResponse(res, processes, '获取项目工序列表成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 为项目添加工序节点
 */
exports.addProcessToProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { user_id } = req.user;
    const processData = {
      ...req.body,
      project_id: projectId,
      created_by: user_id
    };

    const process = await processService.addProcessToProject(processData);
    return successResponse(res, process, '添加工序成功', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 工序打卡（开始/完成）
 */
exports.checkInProcess = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { user_id } = req.user;
    const { action, photos } = req.body; // action: 'start' | 'complete'

    const result = await processService.checkInProcess(nodeId, user_id, action, photos);
    return successResponse(res, result, `工序${action === 'start' ? '开始' : '完成'}打卡成功`);
  } catch (error) {
    next(error);
  }
};

/**
 * 工序审核（工长审核）
 */
exports.approveProcess = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { user_id, role } = req.user;
    const { approved, comments } = req.body;

    if (role !== 'foreman' && role !== 'boss') {
      return errorResponse(res, '只有工长和管理员可以审核', 403);
    }

    const result = await processService.approveProcess(nodeId, user_id, approved, comments);
    return successResponse(res, result, `工序${approved ? '审核通过' : '审核驳回'}`);
  } catch (error) {
    next(error);
  }
};

/**
 * 更新工序状态
 */
exports.updateProcessStatus = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { status } = req.body;

    const process = await processService.updateProcessStatus(nodeId, status);
    return successResponse(res, process, '更新工序状态成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 删除工序节点
 */
exports.deleteProcess = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const { role } = req.user;

    if (role !== 'boss') {
      return errorResponse(res, '只有管理员可以删除工序', 403);
    }

    await processService.deleteProcess(nodeId);
    return successResponse(res, null, '删除工序成功');
  } catch (error) {
    next(error);
  }
};
