<template>
  <view class="photo-uploader">
    <view class="title">
      <text class="label">📸 {{ title }}</text>
      <text class="required" v-if="required">（必须{{ minCount }}张以上）</text>
      <text class="optional" v-else>（可选）</text>
    </view>
    
    <!-- 照片预览列表 -->
    <view class="photo-list">
      <view 
        class="photo-item" 
        v-for="(photo, index) in photos" 
        :key="index"
      >
        <image 
          :src="photo.path" 
          mode="aspectFill" 
          class="photo-image"
          @click="previewPhoto(index)"
        ></image>
        <view class="photo-delete" @click="deletePhoto(index)">
          <text class="delete-icon">✕</text>
        </view>
      </view>
      
      <!-- 添加照片按钮 -->
      <view 
        class="photo-add" 
        v-if="photos.length < maxCount"
        @click="choosePhoto"
      >
        <text class="add-icon">📷</text>
        <text class="add-text">拍照</text>
      </view>
    </view>
    
    <!-- 提示信息 -->
    <view class="tip" v-if="showTip">
      <text class="tip-text">💡 照片会自动添加水印（时间、GPS、项目名）</text>
    </view>
    
    <!-- 隐藏的 Canvas（用于水印处理） -->
    <canvas 
      canvas-id="watermarkCanvas" 
      class="watermark-canvas"
      :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
    ></canvas>
  </view>
</template>

<script>
import { addWatermark, getCurrentLocation, formatTimestamp } from '@/utils/watermark.js';

export default {
  name: 'PhotoUploader',
  props: {
    title: {
      type: String,
      default: '拍摄照片'
    },
    required: {
      type: Boolean,
      default: true
    },
    minCount: {
      type: Number,
      default: 3
    },
    maxCount: {
      type: Number,
      default: 10
    },
    showTip: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      photos: [],
      canvasWidth: 750,
      canvasHeight: 1000
    };
  },
  methods: {
    /**
     * 选择照片（调用相机）
     */
    async choosePhoto() {
      try {
        // 1. 选择图片（优先相机）
        const res = await new Promise((resolve, reject) => {
          uni.chooseImage({
            count: this.maxCount - this.photos.length,
            sizeType: ['compressed'],
            sourceType: ['camera', 'album'],  // 优先相机
            success: resolve,
            fail: reject
          });
        });
        
        // 2. 显示加载提示
        uni.showLoading({
          title: '正在添加水印...',
          mask: true
        });
        
        // 3. 获取水印信息
        const watermarkInfo = await this.getWatermarkInfo();
        
        // 4. 为每张照片添加水印
        for (let i = 0; i < res.tempFilePaths.length; i++) {
          const originalPath = res.tempFilePaths[i];
          
          // 更新加载提示
          uni.showLoading({
            title: `处理照片 ${i + 1}/${res.tempFilePaths.length}`,
            mask: true
          });
          
          try {
            // 添加水印
            const watermarkedPath = await addWatermark(originalPath, watermarkInfo);
            
            // 添加到列表
            this.photos.push({
              path: watermarkedPath,
              watermarkInfo
            });
          } catch (err) {
            console.error('水印添加失败:', err);
            // 失败时使用原图
            this.photos.push({
              path: originalPath,
              watermarkInfo
            });
          }
        }
        
        uni.hideLoading();
        
        // 5. 通知父组件
        this.$emit('change', this.photos);
        
      } catch (err) {
        uni.hideLoading();
        console.error('选择照片失败:', err);
        uni.showToast({
          title: '选择照片失败',
          icon: 'none'
        });
      }
    },
    
    /**
     * 删除照片
     */
    deletePhoto(index) {
      uni.showModal({
        title: '确认删除',
        content: '确定要删除这张照片吗？',
        success: (res) => {
          if (res.confirm) {
            this.photos.splice(index, 1);
            this.$emit('change', this.photos);
          }
        }
      });
    },
    
    /**
     * 预览照片
     */
    previewPhoto(index) {
      const urls = this.photos.map(p => p.path);
      uni.previewImage({
        urls,
        current: index
      });
    },
    
    /**
     * 获取水印信息
     */
    async getWatermarkInfo() {
      // 1. 获取 GPS 位置
      const gps = await getCurrentLocation();
      
      // 2. 获取当前时间
      const timestamp = formatTimestamp();
      
      // 3. 从本地存储获取项目和用户信息
      const project = uni.getStorageSync('projectName') || '未知项目';
      const operator = uni.getStorageSync('userName') || '未知用户';
      
      return {
        gps,
        timestamp,
        project,
        operator
      };
    },
    
    /**
     * 验证照片数量
     */
    validate() {
      if (this.required && this.photos.length < this.minCount) {
        uni.showToast({
          title: `至少需要上传${this.minCount}张照片`,
          icon: 'none'
        });
        return false;
      }
      return true;
    },
    
    /**
     * 获取照片列表（供父组件调用）
     */
    getPhotos() {
      return this.photos;
    },
    
    /**
     * 重置（清空照片）
     */
    reset() {
      this.photos = [];
    }
  }
};
</script>

<style scoped>
.photo-uploader {
  padding: 20rpx;
}

.title {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.label {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.required {
  font-size: 24rpx;
  color: #ff4d4f;
  margin-left: 10rpx;
}

.optional {
  font-size: 24rpx;
  color: #999;
  margin-left: 10rpx;
}

.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.photo-item {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  border-radius: 10rpx;
  overflow: hidden;
}

.photo-image {
  width: 100%;
  height: 100%;
}

.photo-delete {
  position: absolute;
  top: 0;
  right: 0;
  width: 50rpx;
  height: 50rpx;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 0 0 0 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-icon {
  color: #fff;
  font-size: 32rpx;
}

.photo-add {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed #d9d9d9;
  border-radius: 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.add-icon {
  font-size: 60rpx;
  color: #999;
  margin-bottom: 10rpx;
}

.add-text {
  font-size: 24rpx;
  color: #999;
}

.tip {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #e6f7ff;
  border-radius: 10rpx;
  border-left: 4rpx solid #1890ff;
}

.tip-text {
  font-size: 24rpx;
  color: #0050b3;
  line-height: 1.6;
}

.watermark-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}
</style>
