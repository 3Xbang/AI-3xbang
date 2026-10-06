/**
 * 角色权限中间件
 */

const ResponseUtil = require('../utils/response');

/**
 * 要求用户角色为 boss（老板/管理员）
 */
function requireBoss(req, res, next) {
  if (!req.user) {
    return res.status(401).json(
      ResponseUtil.error('未认证', 401)
    );
  }
  
  if (req.user.role !== 'boss') {
    return res.status(403).json(
      ResponseUtil.error('只有老板/管理员可以执行此操作', 403)
    );
  }
  
  next();
}

/**
 * 要求用户角色为 worker（现场工人）
 */
function requireWorker(req, res, next) {
  if (!req.user) {
    return res.status(401).json(
      ResponseUtil.error('未认证', 401)
    );
  }
  
  if (req.user.role !== 'worker') {
    return res.status(403).json(
      ResponseUtil.error('只有现场工人可以执行此操作', 403)
    );
  }
  
  next();
}

/**
 * 允许 boss 或 worker（已登录用户）
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json(
      ResponseUtil.error('未认证', 401)
    );
  }
  
  next();
}

module.exports = {
  requireBoss,
  requireWorker,
  requireAuth
};
