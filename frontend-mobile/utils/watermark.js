/**
 * Canvas 水印工具
 * 核心功能：为照片添加防篡改水印（时间、GPS、项目名、操作人）
 */

/**
 * 为图片添加水印
 * @param {String} imagePath - 图片临时路径
 * @param {Object} watermarkInfo - 水印信息
 * @returns {Promise<String>} 处理后的图片临时路径
 */
export function addWatermark(imagePath, watermarkInfo) {
  return new Promise((resolve, reject) => {
    // 1. 获取图片信息
    uni.getImageInfo({
      src: imagePath,
      success: (imgInfo) => {
        const width = imgInfo.width;
        const height = imgInfo.height;
        
        // 2. 创建 Canvas 上下文
        const ctx = uni.createCanvasContext('watermarkCanvas');
        
        // 3. 绘制原图
        ctx.drawImage(imagePath, 0, 0, width, height);
        
        // 4. 绘制半透明黑色遮罩（底部80px）
        ctx.setFillStyle('rgba(0, 0, 0, 0.5)');
        ctx.fillRect(0, height - 80, width, 80);
        
        // 5. 设置字体样式
        ctx.setFillStyle('#ffffff');
        ctx.setTextAlign('left');
        
        // 6. 绘制水印文字
        const { timestamp, gps, project, operator } = watermarkInfo;
        
        // 第一行：GPS 坐标
        ctx.setFontSize(14);
        if (gps) {
          ctx.fillText(
            `📍 ${gps.lat.toFixed(4)}°N, ${gps.lng.toFixed(4)}°E`,
            10,
            height - 60
          );
        }
        
        // 第二行：时间戳
        ctx.fillText(`🕐 ${timestamp}`, 10, height - 40);
        
        // 第三行：项目名 | 操作人
        ctx.fillText(`📌 ${project} | ${operator}`, 10, height - 20);
        
        // 7. 绘制到 Canvas
        ctx.draw(false, () => {
          // 8. 导出图片
          setTimeout(() => {
            uni.canvasToTempFilePath({
              canvasId: 'watermarkCanvas',
              success: (res) => {
                resolve(res.tempFilePath);
              },
              fail: (err) => {
                console.error('Canvas 导出失败:', err);
                reject(err);
              }
            });
          }, 500);  // 延迟确保绘制完成
        });
      },
      fail: (err) => {
        console.error('获取图片信息失败:', err);
        reject(err);
      }
    });
  });
}

/**
 * 获取当前位置（GPS）
 * @returns {Promise<Object>} { lat, lng }
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',  // 国测局坐标系（适用于中国地区）
      success: (res) => {
        resolve({
          lat: res.latitude,
          lng: res.longitude
        });
      },
      fail: (err) => {
        console.error('获取位置失败:', err);
        // 返回默认位置（避免阻塞流程）
        uni.showToast({
          title: 'GPS 获取失败，使用默认位置',
          icon: 'none'
        });
        resolve({
          lat: 0,
          lng: 0
        });
      }
    });
  });
}

/**
 * 格式化时间戳
 * @param {Date} date - 日期对象
 * @returns {String} 格式化后的时间字符串
 */
export function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 批量为多张照片添加水印
 * @param {Array} imagePaths - 图片路径数组
 * @param {Object} watermarkInfo - 水印信息
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Array>} 处理后的图片路径数组
 */
export async function addWatermarkBatch(imagePaths, watermarkInfo, onProgress) {
  const results = [];
  const total = imagePaths.length;
  
  for (let i = 0; i < total; i++) {
    try {
      const watermarkedPath = await addWatermark(imagePaths[i], watermarkInfo);
      results.push(watermarkedPath);
      
      // 进度回调
      if (onProgress) {
        onProgress(i + 1, total);
      }
    } catch (err) {
      console.error(`第 ${i + 1} 张照片水印添加失败:`, err);
      // 失败时使用原图
      results.push(imagePaths[i]);
    }
  }
  
  return results;
}
