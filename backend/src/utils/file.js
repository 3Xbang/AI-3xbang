/**
 * 文件处理工具
 */

const path = require('path');

/**
 * 构建照片 JSON 数组
 * @param {Array} files - Multer 上传的文件数组
 * @returns {Array} 照片 JSON 数组
 */
function buildPhotosJson(files) {
  if (!files || !Array.isArray(files)) {
    return [];
  }
  
  return files.map(file => ({
    url: `/uploads/${file.filename}`,  // 相对路径，前端拼接域名
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date().toISOString()
  }));
}

/**
 * 验证照片数量
 * @param {Array} files - 文件数组
 * @param {Number} minCount - 最少照片数量
 * @returns {Object} { valid, message }
 */
function validatePhotoCount(files, minCount = 3) {
  if (!files || !Array.isArray(files)) {
    return {
      valid: false,
      message: '未上传照片'
    };
  }
  
  if (files.length < minCount) {
    return {
      valid: false,
      message: `至少需要上传${minCount}张照片，当前只有${files.length}张`
    };
  }
  
  return {
    valid: true,
    message: '照片数量验证通过'
  };
}

module.exports = {
  buildPhotosJson,
  validatePhotoCount
};
