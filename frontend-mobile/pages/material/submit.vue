<template>
  <view class="container">
    <view class="header">
      <text class="title">材料进场</text>
    </view>

    <view class="form">
      <!-- 材料名称 -->
      <view class="form-item">
        <text class="label required">材料名称</text>
        <input
          v-model="formData.material_name"
          placeholder="如：水泥、钢筋、砂石等"
          class="input"
        />
      </view>

      <!-- 计划数量 -->
      <view class="form-item">
        <text class="label required">计划数量</text>
        <view class="quantity-row">
          <input
            v-model.number="formData.planned_quantity"
            type="digit"
            placeholder="请输入数量"
            class="input flex-1"
          />
          <input
            v-model="formData.unit"
            placeholder="单位"
            class="input unit-input"
          />
        </view>
      </view>

      <!-- 实际数量 -->
      <view class="form-item">
        <text class="label required">实际数量</text>
        <input
          v-model.number="formData.actual_quantity"
          type="digit"
          placeholder="请输入实际到货数量"
          class="input"
        />
        <text v-if="varianceInfo" :class="['variance-tip', varianceInfo.class]">
          {{ varianceInfo.text }}
        </text>
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

      <!-- 质量备注（可选） -->
      <view class="form-item">
        <text class="label">质量备注（可选，50-150字）</text>
        <textarea
          v-model="formData.quality_notes"
          placeholder="可以描述材料质量、包装情况等，非必填"
          maxlength="150"
          class="textarea"
          :show-confirm-bar="false"
        />
        <text class="char-count">{{ formData.quality_notes.length }}/150</text>
      </view>

      <!-- 提交按钮 -->
      <button class="submit-btn" @click="handleSubmit" :disabled="!canSubmit">
        {{ canSubmit ? '提交记录' : '请完成必填项' }}
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
        material_name: '',
        planned_quantity: '',
        actual_quantity: '',
        unit: '',
        quality_notes: '',
        photos: []
      },
      projectId: ''
    }
  },
  computed: {
    canSubmit() {
      return (
        this.formData.material_name &&
        this.formData.planned_quantity &&
        this.formData.actual_quantity &&
        this.formData.unit &&
        this.formData.photos.length >= 3
      )
    },
    varianceInfo() {
      if (!this.formData.planned_quantity || !this.formData.actual_quantity) {
        return null
      }
      
      const planned = parseFloat(this.formData.planned_quantity)
      const actual = parseFloat(this.formData.actual_quantity)
      
      if (isNaN(planned) || isNaN(actual) || planned === 0) {
        return null
      }
      
      const variance = ((actual - planned) / planned * 100).toFixed(2)
      const absVariance = Math.abs(variance)
      
      let text = `偏差：${variance > 0 ? '+' : ''}${variance}%`
      let className = 'normal'
      
      if (absVariance > 10) {
        text += ' ⚠️ 超过10%将自动标记异常'
        className = 'warning'
      } else if (absVariance > 5) {
        text += ' ⚠️ 偏差较大'
        className = 'caution'
      } else {
        text += ' ✓ 偏差正常'
      }
      
      return { text, class: className }
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

        // 提交材料记录
        await request({
          url: '/materials/submit',
          method: 'POST',
          data: {
            project_id: this.projectId,
            material_name: this.formData.material_name,
            planned_quantity: parseFloat(this.formData.planned_quantity),
            actual_quantity: parseFloat(this.formData.actual_quantity),
            unit: this.formData.unit,
            quality_notes: this.formData.quality_notes || null,
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
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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

.quantity-row {
  display: flex;
  gap: 20rpx;
}

.flex-1 {
  flex: 1;
}

.unit-input {
  width: 150rpx;
  flex-shrink: 0;
}

.variance-tip {
  display: block;
  margin-top: 15rpx;
  padding: 15rpx 20rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.variance-tip.normal {
  background: #f0f9ff;
  color: #1890ff;
}

.variance-tip.caution {
  background: #fffbe6;
  color: #faad14;
}

.variance-tip.warning {
  background: #fff2f0;
  color: #ff4d4f;
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
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
