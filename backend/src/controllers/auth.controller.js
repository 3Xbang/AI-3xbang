/**
 * 认证控制器
 */

const authService = require('../services/auth.service');
const ResponseUtil = require('../utils/response');

class AuthController {
  /**
   * 用户登录
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      
      // 验证必填字段
      if (!username || !password) {
        return res.status(400).json(
          ResponseUtil.error('用户名和密码不能为空', 400)
        );
      }
      
      // 调用服务层
      const result = await authService.login(username, password);
      
      res.json(ResponseUtil.success(result, '登录成功'));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 获取当前用户信息
   * GET /api/auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      const user = await authService.getCurrentUser(req.user.userId);
      res.json(ResponseUtil.success(user));
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * 用户登出
   * POST /api/auth/logout
   */
  async logout(req, res) {
    // JWT 是无状态的，登出只需前端删除 token
    res.json(ResponseUtil.success(null, '登出成功'));
  }
}

module.exports = new AuthController();
