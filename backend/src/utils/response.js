/**
 * 统一响应格式工具
 */

class ResponseUtil {
  /**
   * 成功响应
   */
  static success(data = null, message = '操作成功', code = 200) {
    return {
      success: true,
      code,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 错误响应
   */
  static error(message = '操作失败', code = 400, errors = null) {
    return {
      success: false,
      code,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 分页响应
   */
  static paginated(data, total, page, pageSize) {
    return {
      success: true,
      code: 200,
      message: '查询成功',
      data: {
        items: data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ResponseUtil;
