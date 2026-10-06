/**
 * 网络请求工具（封装 uni.request）
 */

// API 基础地址
// 开发环境：http://localhost:3000/api
// 生产环境：http://18.206.11.7/api
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'http://18.206.11.7/api'
  : 'http://localhost:3000/api';

// 请求拦截器
function request(options) {
  return new Promise((resolve, reject) => {
    // 从本地存储获取 token
    const token = uni.getStorageSync('token');
    
    // 发起请求
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': options.contentType || 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        // 请求成功
        if (res.statusCode === 200) {
          if (res.data.success) {
            resolve(res.data);
          } else {
            // 业务错误
            uni.showToast({
              title: res.data.message || '操作失败',
              icon: 'none',
              duration: 2000
            });
            reject(res.data);
          }
        } else if (res.statusCode === 401) {
          // 未认证，跳转到登录页
          uni.showToast({
            title: '请先登录',
            icon: 'none'
          });
          setTimeout(() => {
            uni.reLaunch({
              url: '/pages/login/login'
            });
          }, 1500);
          reject(res.data);
        } else {
          // HTTP 错误
          uni.showToast({
            title: res.data.message || `请求失败 (${res.statusCode})`,
            icon: 'none',
            duration: 2000
          });
          reject(res.data);
        }
      },
      fail: (err) => {
        // 网络错误
        uni.showToast({
          title: '网络连接失败',
          icon: 'none',
          duration: 2000
        });
        reject(err);
      }
    });
  });
}

// 文件上传（multipart/form-data）
function uploadFile(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');
    
    uni.uploadFile({
      url: BASE_URL + options.url,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const data = JSON.parse(res.data);
          if (data.success) {
            resolve(data);
          } else {
            uni.showToast({
              title: data.message || '上传失败',
              icon: 'none'
            });
            reject(data);
          }
        } else {
          uni.showToast({
            title: `上传失败 (${res.statusCode})`,
            icon: 'none'
          });
          reject(res);
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '上传失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

// 导出 API 方法
export default {
  // 暴露 baseURL（供文件上传使用）
  baseURL: BASE_URL,
  
  // GET 请求
  get(url, data) {
    return request({ url, method: 'GET', data });
  },
  
  // POST 请求
  post(url, data) {
    return request({ url, method: 'POST', data });
  },
  
  // PUT 请求
  put(url, data) {
    return request({ url, method: 'PUT', data });
  },
  
  // DELETE 请求
  delete(url, data) {
    return request({ url, method: 'DELETE', data });
  },
  
  // 文件上传
  upload(url, filePath, formData, name = 'file') {
    return uploadFile({ url, filePath, formData, name });
  },
  
  // 通用请求（用于自定义参数）
  request(options) {
    return request(options);
  }
};
