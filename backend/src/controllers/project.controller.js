const projectService = require('../services/project.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * 获取项目列表
 */
exports.getProjects = async (req, res, next) => {
  try {
    const { user_id, role } = req.user;
    const { status } = req.query;

    const projects = await projectService.getProjectsByUser(user_id, role, status);
    return successResponse(res, projects, '获取项目列表成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 获取单个项目详情
 */
exports.getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.user;

    const project = await projectService.getProjectById(id, user_id, role);
    return successResponse(res, project, '获取项目详情成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 创建新项目
 */
exports.createProject = async (req, res, next) => {
  try {
    const { user_id } = req.user;
    const projectData = {
      ...req.body,
      created_by: user_id
    };

    const project = await projectService.createProject(projectData);
    return successResponse(res, project, '创建项目成功', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * 更新项目
 */
exports.updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.user;
    const updateData = req.body;

    const project = await projectService.updateProject(id, updateData, user_id, role);
    return successResponse(res, project, '更新项目成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 删除项目
 */
exports.deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.user;

    await projectService.deleteProject(id, user_id, role);
    return successResponse(res, null, '删除项目成功');
  } catch (error) {
    next(error);
  }
};

/**
 * 获取项目统计数据
 */
exports.getProjectStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.user;

    const stats = await projectService.getProjectStats(id, user_id, role);
    return successResponse(res, stats, '获取项目统计成功');
  } catch (error) {
    next(error);
  }
};
