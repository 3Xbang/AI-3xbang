/**
 * 统一错误处理中间件
 */

const multer = require('multer');
const ResponseUtil = require('../utils/response');

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  console.error('❌ 错误详情:', err);
  
  // Multer 文件上传错误
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json(
        ResponseUtil.error('文件过大，单个文件最大5MB', 400)
      );
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json(
        ResponseUtil.error('文件数量超限，最多10张', 400)
      );
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json(
        ResponseUtil.error('上传的文件字段不正确', 400)
      );
    }
    
    return res.status(400).json(
      ResponseUtil.error(`文件上传错误: ${err.message}`, 400)
    );
  }
  
  // 文件类型错误
  if (err.message && err.message.includes('只允许上传图片')) {
    return res.status(400).json(
      ResponseUtil.error(err.message, 400)
    );
  }
  
  // PostgreSQL 数据库错误
  if (err.code) {
    // 唯一约束冲突
    if (err.code === '23505') {
      return res.status(400).json(
        ResponseUtil.error('数据已存在，请勿重复提交', 400)
      );
    }
    
    // 外键约束冲突
    if (err.code === '23503') {
      return res.status(400).json(
        ResponseUtil.error('关联数据不存在', 400)
      );
    }
    
    // 非空约束冲突
    if (err.code === '23502') {
      return res.status(400).json(
        ResponseUtil.error('缺少必填字段', 400)
      );
    }
  }
  
  // 自定义业务错误
  if (err.statusCode) {
    return res.status(err.statusCode).json(
      ResponseUtil.error(err.message, err.statusCode)
    );
  }
  
  // 默认错误
  res.status(500).json(
    ResponseUtil.error(
      process.env.NODE_ENV === 'production' 
        ? '服务器内部错误' 
        : err.message,
      500
    )
  );
}

/**
 * 404 错误处理
 */
function notFoundHandler(req, res) {
  res.status(404).json(
    ResponseUtil.error(`未找到路由: ${req.method} ${req.path}`, 404)
  );
}

module.exports = {
  errorHandler,
  notFoundHandler
};
