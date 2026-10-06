<template>
  <view class="container">
    <view class="header">
      <text class="title">问题上报</text>
    </view>

    <view class="form">
      <!-- 问题标题 -->
      <view class="form-item">
        <text class="label required">问题标题</text>
        <input
          v-model="formData.title"
          placeholder="简短描述问题"
          maxlength="100"
          class="input"
        />
      </view>

      <!-- 问题描述 -->
      <view class="form-item">
        <text class="label required">问题描述</text>
        <textarea
          v-model="formData.description"
          placeholder="详细描述遇到的问题"
          maxlength="500"
          class="textarea"
          :show-confirm-bar="false"
        />
        <text class="char-count">{{ formData.description.length }}/500</text>
      </view>

      <!-- 严重程度 -->
      <view class="form-item">
        <text class="label required">严重程度</text>
        <view class="severity-list">
          <view
            v-for="item in severityOptions"
            :key="item.value"
            :class="['severity-item', formData.severity === item.value ? 'active' : '', item.value]"
            @click="formData.severity = item.value"
          >
            <text class="severity-icon">{{ item.icon }}</text>
            <text class="severity-text">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 拍照上传（可选） -->
      <view class="form-item">
        <text class="label">问题照片（可选）</text>
        <photo-uploader
          :max-count="6"
          :min-count="0"
          @change="onPhotosChange"
        />
      </view>

      <!-- 提交按钮 -->
      <button class="submit-btn" @click="handleSubmit" :disabled="!canSubmit">
        {{ canSubmit ? '提交上报' : '请完成必填项' }}
      </button>
    </view>
  </view>
</template>

<script>
import PhotoUploader from '@/components/photo-uploader.vue'
import { addWatermark } from '@/utils/watermark.js'
import request from '@/utils/request.js'

export default {
  components: {
    PhotoUploader
  },
  data() {
    return {
      formData: {
        title: '',
        description: '',
        severity: 'medium',
        photos: []
      },
      severityOptions: [
        { value: 'low', label: '一般', icon: '🟢' },
        { value: 'medium', label: '重要', icon: '🟡' },
        { value: 'high', label: '紧急', icon: '🔴' }
      ],
      projectId: ''
    }
  },
  computed: {
    canSubmit() {
      return this.formData.title && this.formData.description && this.formData.severity
    }
  },
  onLoad() {
    this.projectId = uni.getStorageSync('current_project_id')
    if (!this.projectId) {
      uni.showToast({ title: '请先选择项目', icon: 'none' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    }
  },
  methods: {
    onPhotosChange(photos) {
      this.formData.photos = photos
    },
    
    async handleSubmit() {
      if (!this.canSubmit) {
        uni.showToast({ title: '请完成必填项', icon: 'none' })
        return
      }

      try {
        let uploadedPhotos = []
        let watermarkInfo = null

        // 如果有照片，处理水印和上传
        if (this.formData.photos.length > 0) {
          uni.showLoading({ title: '处理照片中...', mask: true })

          // 获取水印信息
          watermarkInfo = await this.getWatermarkInfo()
          
          // 处理照片水印
          const watermarkedPhotos = []
          for (let i = 0; i < this.formData.photos.length; i++) {
            uni.showLoading({ title: `处理照片 ${i + 1}/${this.formData.photos.length}...`, mask: true })
            const watermarkedPath = await addWatermark(this.formData.photos[i], watermarkInfo)
            watermarkedPhotos.push(watermarkedPath)
          }

          uni.showLoading({ title: '上传中...', mask: true })

          // 上传照片
          for (let photo of watermarkedPhotos) {
            const uploadRes = await this.uploadPhoto(photo)
            uploadedPhotos.push(uploadRes)
          }
        } else {
          uni.showLoading({ title: '提交中...', mask: true })
        }

        // 提交问题记录
        await request({
          url: '/issues/submit',
          method: 'POST',
          data: {
            project_id: this.projectId,
            title: this.formData.title,
            description: this.formData.description,
            severity: this.formData.severity,
            photos_json: uploadedPhotos.length > 0 ? uploadedPhotos : null,
            watermark_info: watermarkInfo
          }
        })

        uni.hideLoading()
        uni.showToast({ title: '提交成功', icon: 'success' })
        
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)

      } catch (err) {
        uni.hideLoading()
        uni.showModal({
          title: '提交失败',
          content: err.message || '请稍后重试',
          showCancel: false
        })
      }
    },

    async getWatermarkInfo() {
      return new Promise((resolve, reject) => {
        uni.getLocation({
          type: 'gcj02',
          success: (res) => {
            const userInfo = uni.getStorageSync('user_info') || {}
            const projectName = uni.getStorageSync('current_project_name') || '项目'
            
            resolve({
              latitude: res.latitude,
              longitude: res.longitude,
              timestamp: new Date().toISOString(),
              user_name: userInfo.username || '未知',
              project_name: projectName
            })
          },
          fail: (err) => {
            const userInfo = uni.getStorageSync('user_info') || {}
            const projectName = uni.getStorageSync('current_project_name') || '项目'
            
            resolve({
              latitude: null,
              longitude: null,
              timestamp: new Date().toISOString(),
              user_name: userInfo.username || '未知',
              project_name: projectName
            })
          }
        })
      })
    },

    uploadPhoto(photoPath) {
      return new Promise((resolve, reject) => {
        const token = uni.getStorageSync('token')
        
        uni.uploadFile({
          url: request.baseURL + '/upload/photo',
          filePath: photoPath,
          name: 'photo',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: (res) => {
            if (res.statusCode === 200) {
              const data = JSON.parse(res.data)
              if (data.success) {
                resolve(data.data)
              } else {
                reject(new Error(data.message || '上传失败'))
              }
            } else {
              reject(new Error('上传失败'))
            }
          },
          fail: (err) => {
            reject(err)
          }
        })
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  padding: 40rpx 30rpx 30rpx;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.form {
  padding: 30rpx;
}

.form-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 20rpx;
  font-weight: 500;
}

.required::before {
  content: '*';
  color: #ff4d4f;
  margin-right: 8rpx;
}

.input {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.textarea {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 28rpx;
  line-height: 1.6;
  box-sizing: border-box;
}

.char-count {
  display: block;
  text-align: right;
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
}

.severity-list {
  display: flex;
  gap: 20rpx;
}

.severity-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 25rpx 15rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  border: 3rpx solid transparent;
  transition: all 0.3s;
}

.severity-item.active {
  background: #fff;
  border-color: currentColor;
}

.severity-item.low {
  color: #52c41a;
}

.severity-item.medium {
  color: #faad14;
}

.severity-item.high {
  color: #ff4d4f;
}

.severity-icon {
  font-size: 48rpx;
  margin-bottom: 10rpx;
}

.severity-text {
  font-size: 24rpx;
  font-weight: 500;
}

.submit-btn {
  width: 100%;
  height: 90rpx;
  line-height: 90rpx;
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #fff;
  border: none;
  border-radius: 45rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
}

.submit-btn[disabled] {
  background: #ccc;
  color: #999;
}
</style>
