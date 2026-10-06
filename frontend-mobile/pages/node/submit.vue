<template>
  <view class="container">
    <view class="header">
      <text class="title">工序打卡</text>
    </view>

    <view class="form">
      <!-- 工序选择 -->
      <view class="form-item">
        <text class="label required">选择工序</text>
        <picker mode="selector" :range="nodeList" range-key="name" @change="onNodeChange">
          <view class="picker">
            <text :class="formData.node_id ? '' : 'placeholder'">
              {{ selectedNodeName || '请选择工序' }}
            </text>
            <text class="arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 拍照上传（必填，最少3张） -->
      <view class="form-item">
        <text class="label required">现场照片（最少3张）</text>
        <photo-uploader
          :max-count="9"
          :min-count="3"
          @change="onPhotosChange"
        />
      </view>

      <!-- 工作说明（可选） -->
      <view class="form-item">
        <text class="label">工作说明（可选，50-150字）</text>
        <textarea
          v-model="formData.work_description"
          placeholder="可以简单描述一下工作情况，非必填"
          maxlength="150"
          class="textarea"
          :show-confirm-bar="false"
        />
        <text class="char-count">{{ formData.work_description.length }}/150</text>
      </view>

      <!-- 提交按钮 -->
      <button class="submit-btn" @click="handleSubmit" :disabled="!canSubmit">
        {{ canSubmit ? '提交打卡' : '请完成必填项' }}
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
      nodeList: [],
      formData: {
        node_id: '',
        work_description: '',
        photos: []
      },
      selectedNodeName: '',
      projectId: ''
    }
  },
  computed: {
    canSubmit() {
      return this.formData.node_id && this.formData.photos.length >= 3
    }
  },
  onLoad() {
    this.projectId = uni.getStorageSync('current_project_id')
    if (!this.projectId) {
      uni.showToast({ title: '请先选择项目', icon: 'none' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
      return
    }
    this.loadNodes()
  },
  methods: {
    async loadNodes() {
      try {
        uni.showLoading({ title: '加载中...' })
        const res = await request({
          url: `/nodes/project/${this.projectId}`,
          method: 'GET'
        })
        this.nodeList = res.data || []
      } catch (err) {
        uni.showToast({ title: err.message || '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    
    onNodeChange(e) {
      const index = e.detail.value
      this.formData.node_id = this.nodeList[index].node_id
      this.selectedNodeName = this.nodeList[index].name
    },
    
    onPhotosChange(photos) {
      this.formData.photos = photos
    },
    
    async handleSubmit() {
      if (!this.canSubmit) {
        uni.showToast({ title: '请完成必填项', icon: 'none' })
        return
      }

      try {
        uni.showLoading({ title: '处理照片中...', mask: true })

        // 获取水印信息
        const watermarkInfo = await this.getWatermarkInfo()
        
        // 处理照片水印
        const watermarkedPhotos = []
        for (let i = 0; i < this.formData.photos.length; i++) {
          uni.showLoading({ title: `处理照片 ${i + 1}/${this.formData.photos.length}...`, mask: true })
          const watermarkedPath = await addWatermark(this.formData.photos[i], watermarkInfo)
          watermarkedPhotos.push(watermarkedPath)
        }

        uni.showLoading({ title: '上传中...', mask: true })

        // 上传照片
        const uploadedPhotos = []
        for (let photo of watermarkedPhotos) {
          const uploadRes = await this.uploadPhoto(photo)
          uploadedPhotos.push(uploadRes)
        }

        // 提交工序记录
        await request({
          url: '/nodes/submit',
          method: 'POST',
          data: {
            project_id: this.projectId,
            node_id: this.formData.node_id,
            work_description: this.formData.work_description || null,
            photos_json: uploadedPhotos,
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
            // GPS获取失败仍然继续，但不包含坐标
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

.picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.placeholder {
  color: #999;
}

.arrow {
  color: #999;
  font-size: 24rpx;
}

.textarea {
  width: 100%;
  min-height: 150rpx;
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

.submit-btn {
  width: 100%;
  height: 90rpx;
  line-height: 90rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
