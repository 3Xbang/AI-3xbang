/**
 * JWT 认证中间件
 */

const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const ResponseUtil = require('../utils/response');

/**
 * 验证 JWT Token
 */
function authMiddleware(req, res, next) {
  // 从 Authorization 头获取 token
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(
      ResponseUtil.error('未提供认证令牌，请先登录', 401)
    );
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // 验证 token
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    // 将用户信息挂载到 req 对象
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      projectId: decoded.projectId
    };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json(
        ResponseUtil.error('认证令牌已过期，请重新登录', 401)
      );
    }
    
    return res.status(401).json(
      ResponseUtil.error('认证令牌无效', 401)
    );
  }
}

module.exports = authMiddleware;
