/**
 * 认证服务
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const jwtConfig = require('../config/jwt');

class AuthService {
  /**
   * 用户登录
   * @param {String} username - 用户名
   * @param {String} password - 密码
   * @returns {Object} { token, user }
   */
  async login(username, password) {
    // 查询用户
    const result = await db.query(
      'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      const error = new Error('用户名或密码错误');
      error.statusCode = 401;
      throw error;
    }
    
    const user = result.rows[0];
    
    // 检查用户是否激活
    if (!user.is_active) {
      const error = new Error('用户账户已被禁用');
      error.statusCode = 403;
      throw error;
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      const error = new Error('用户名或密码错误');
      error.statusCode = 401;
      throw error;
    }
    
    // 生成 JWT Token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        projectId: 1  // TODO: 多项目时从用户-项目关联表获取
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
    
    // 返回 token 和用户信息（不包含密码）
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    };
  }
  
  /**
   * 获取当前用户信息
   * @param {Number} userId - 用户ID
   * @returns {Object} 用户信息
   */
  async getCurrentUser(userId) {
    const result = await db.query(
      'SELECT id, username, full_name, role, phone, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      const error = new Error('用户不存在');
      error.statusCode = 404;
      throw error;
    }
    
    return result.rows[0];
  }
}

module.exports = new AuthService();
