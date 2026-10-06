<template>
  <view class="container">
    <view class="header">
      <text class="title">待审批</text>
      <view class="tabs">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          :class="['tab-item', currentTab === tab.value ? 'active' : '']"
          @click="switchTab(tab.value)"
        >
          <text>{{ tab.label }}</text>
          <text v-if="tab.count > 0" class="badge">{{ tab.count }}</text>
        </view>
      </view>
    </view>

    <view class="content">
      <view v-if="loading" class="loading">
        <text>加载中...</text>
      </view>

      <view v-else-if="currentList.length === 0" class="empty">
        <text class="empty-icon">✅</text>
        <text class="empty-text">暂无待审批项</text>
      </view>

      <view v-else class="list">
        <!-- 工序打卡 -->
        <view
          v-for="item in nodeList"
          v-show="currentTab === 'all' || currentTab === 'node'"
          :key="'node-' + item.record_id"
          class="card node-card"
        >
          <view class="card-header">
            <text class="card-type">🏗️ 工序打卡</text>
            <text class="card-time">{{ formatTime(item.submit_time) }}</text>
          </view>

          <view class="card-body">
            <text class="card-title">{{ item.node_name }}</text>
            <text class="card-user">提交人：{{ item.submitted_by_name }}</text>
            
            <view v-if="item.work_description" class="card-desc">
              <text>{{ item.work_description }}</text>
            </view>

            <view class="photo-grid">
              <image
                v-for="(photo, index) in parsePhotos(item.photos_json)"
                :key="index"
                :src="photo"
                class="photo-item"
                mode="aspectFill"
                @click="previewPhotos(parsePhotos(item.photos_json), index)"
              />
            </view>
          </view>

          <view class="card-actions">
            <button class="action-btn reject" @click="handleReject(item, 'node')">
              驳回
            </button>
            <button class="action-btn approve" @click="handleApprove(item, 'node')">
              通过
            </button>
          </view>
        </view>

        <!-- 材料进场 -->
        <view
          v-for="item in materialList"
          v-show="currentTab === 'all' || currentTab === 'material'"
          :key="'material-' + item.record_id"
          class="card material-card"
        >
          <view class="card-header">
            <text class="card-type">📦 材料进场</text>
            <text class="card-time">{{ formatTime(item.submit_time) }}</text>
          </view>

          <view class="card-body">
            <text class="card-title">{{ item.material_name }}</text>
            <text class="card-user">提交人：{{ item.submitted_by_name }}</text>
            
            <view class="quantity-info">
              <view class="quantity-row">
                <text class="quantity-label">计划数量：</text>
                <text>{{ item.planned_quantity }} {{ item.unit }}</text>
              </view>
              <view class="quantity-row">
                <text class="quantity-label">实际数量：</text>
                <text>{{ item.actual_quantity }} {{ item.unit }}</text>
              </view>
              <view class="quantity-row" v-if="item.variance_percentage">
                <text class="quantity-label">偏差：</text>
                <text :class="getVarianceClass(item.variance_percentage)">
                  {{ item.variance_percentage > 0 ? '+' : '' }}{{ item.variance_percentage }}%
                </text>
              </view>
            </view>

            <view v-if="item.quality_notes" class="card-desc">
              <text>{{ item.quality_notes }}</text>
            </view>

            <view class="photo-grid">
              <image
                v-for="(photo, index) in parsePhotos(item.photos_json)"
                :key="index"
                :src="photo"
                class="photo-item"
                mode="aspectFill"
                @click="previewPhotos(parsePhotos(item.photos_json), index)"
              />
            </view>
          </view>

          <view class="card-actions">
            <button class="action-btn reject" @click="handleReject(item, 'material')">
              驳回
            </button>
            <button class="action-btn approve" @click="handleApprove(item, 'material')">
              通过
            </button>
          </view>
        </view>

        <!-- 问题上报 -->
        <view
          v-for="item in issueList"
          v-show="currentTab === 'all' || currentTab === 'issue'"
          :key="'issue-' + item.report_id"
          class="card issue-card"
        >
          <view class="card-header">
            <text class="card-type">⚠️ 问题上报</text>
            <view :class="['severity-badge', item.severity]">
              {{ getSeverityText(item.severity) }}
            </view>
            <text class="card-time">{{ formatTime(item.reported_at) }}</text>
          </view>

          <view class="card-body">
            <text class="card-title">{{ item.title }}</text>
            <text class="card-user">上报人：{{ item.reported_by_name }}</text>
            
            <view class="card-desc">
              <text>{{ item.description }}</text>
            </view>

            <view v-if="item.photos_json" class="photo-grid">
              <image
                v-for="(photo, index) in parsePhotos(item.photos_json)"
                :key="index"
                :src="photo"
                class="photo-item"
                mode="aspectFill"
                @click="previewPhotos(parsePhotos(item.photos_json), index)"
              />
            </view>
          </view>

          <view class="card-actions">
            <button class="action-btn approve" @click="handleAcknowledge(item)">
              已知晓
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import request from '@/utils/request.js'

export default {
  data() {
    return {
      loading: false,
      currentTab: 'all',
      tabs: [
        { value: 'all', label: '全部', count: 0 },
        { value: 'node', label: '工序', count: 0 },
        { value: 'material', label: '材料', count: 0 },
        { value: 'issue', label: '问题', count: 0 }
      ],
      nodeList: [],
      materialList: [],
      issueList: []
    }
  },
  computed: {
    currentList() {
      if (this.currentTab === 'all') {
        return [...this.nodeList, ...this.materialList, ...this.issueList]
      } else if (this.currentTab === 'node') {
        return this.nodeList
      } else if (this.currentTab === 'material') {
        return this.materialList
      } else {
        return this.issueList
      }
    }
  },
  onLoad() {
    const role = uni.getStorageSync('user_role')
    if (role !== 'boss') {
      uni.showModal({
        title: '权限不足',
        content: '只有老板可以审批',
        showCancel: false,
        success: () => {
          uni.switchTab({ url: '/pages/index/index' })
        }
      })
      return
    }
    this.loadPending()
  },
  onShow() {
    this.loadPending()
  },
  methods: {
    async loadPending() {
      this.loading = true
      try {
        const res = await request({
          url: '/pending/all',
          method: 'GET'
        })
        
        this.nodeList = res.data.nodes || []
        this.materialList = res.data.materials || []
        this.issueList = res.data.issues || []
        
        // 更新计数
        this.tabs[0].count = this.nodeList.length + this.materialList.length + this.issueList.length
        this.tabs[1].count = this.nodeList.length
        this.tabs[2].count = this.materialList.length
        this.tabs[3].count = this.issueList.length
        
      } catch (err) {
        uni.showToast({ title: err.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    switchTab(tab) {
      this.currentTab = tab
    },

    parsePhotos(photosJson) {
      if (!photosJson) return []
      if (typeof photosJson === 'string') {
        try {
          return JSON.parse(photosJson)
        } catch {
          return []
        }
      }
      return photosJson
    },

    previewPhotos(photos, current) {
      uni.previewImage({
        urls: photos,
        current: current
      })
    },

    formatTime(timeStr) {
      if (!timeStr) return ''
      const date = new Date(timeStr)
      const month = date.getMonth() + 1
      const day = date.getDate()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${month}月${day}日 ${hours}:${minutes}`
    },

    getSeverityText(severity) {
      const map = { low: '一般', medium: '重要', high: '紧急' }
      return map[severity] || severity
    },

    getVarianceClass(variance) {
      const abs = Math.abs(variance)
      if (abs > 10) return 'variance-high'
      if (abs > 5) return 'variance-medium'
      return 'variance-normal'
    },

    async handleApprove(item, type) {
      const url = type === 'node' 
        ? `/nodes/${item.record_id}/confirm`
        : `/materials/${item.record_id}/confirm`

      try {
        await request({
          url,
          method: 'POST',
          data: { status: 'approved' }
        })

        uni.showToast({ title: '已通过', icon: 'success' })
        this.loadPending()
      } catch (err) {
        uni.showToast({ title: err.message || '操作失败', icon: 'none' })
      }
    },

    handleReject(item, type) {
      uni.showModal({
        title: '驳回原因',
        editable: true,
        placeholderText: '请输入驳回原因',
        success: async (res) => {
          if (res.confirm) {
            const url = type === 'node'
              ? `/nodes/${item.record_id}/confirm`
              : `/materials/${item.record_id}/confirm`

            try {
              await request({
                url,
                method: 'POST',
                data: {
                  status: 'rejected',
                  notes: res.content || '未通过审核'
                }
              })

              uni.showToast({ title: '已驳回', icon: 'success' })
              this.loadPending()
            } catch (err) {
              uni.showToast({ title: err.message || '操作失败', icon: 'none' })
            }
          }
        }
      })
    },

    async handleAcknowledge(item) {
      try {
        await request({
          url: `/issues/${item.report_id}/acknowledge`,
          method: 'POST'
        })

        uni.showToast({ title: '已知晓', icon: 'success' })
        this.loadPending()
      } catch (err) {
        uni.showToast({ title: err.message || '操作失败', icon: 'none' })
      }
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
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  padding: 40rpx 0 0;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  padding: 0 30rpx 20rpx;
}

.tabs {
  display: flex;
  padding: 0 30rpx;
}

.tab-item {
  position: relative;
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 28rpx;
  border-bottom: 4rpx solid transparent;
}

.tab-item.active {
  color: #fff;
  font-weight: bold;
  border-bottom-color: #fff;
}

.badge {
  position: absolute;
  top: 10rpx;
  right: 20rpx;
  background: #ff4d4f;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 8rpx;
  border-radius: 10rpx;
  min-width: 30rpx;
  text-align: center;
}

.content {
  padding: 30rpx;
}

.loading, .empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
  color: #999;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 15rpx;
  padding: 25rpx 30rpx;
  background: #fafafa;
  border-bottom: 1rpx solid #f0f0f0;
}

.card-type {
  font-size: 26rpx;
  font-weight: 500;
  color: #333;
}

.card-time {
  margin-left: auto;
  font-size: 22rpx;
  color: #999;
}

.severity-badge {
  padding: 6rpx 16rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.severity-badge.low {
  background: #f0f9ff;
  color: #52c41a;
}

.severity-badge.medium {
  background: #fffbe6;
  color: #faad14;
}

.severity-badge.high {
  background: #fff2f0;
  color: #ff4d4f;
}

.card-body {
  padding: 30rpx;
}

.card-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 15rpx;
}

.card-user {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 20rpx;
}

.card-desc {
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}

.card-desc text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}

.quantity-info {
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
}

.quantity-row {
  display: flex;
  font-size: 26rpx;
  line-height: 2;
}

.quantity-label {
  color: #999;
  min-width: 150rpx;
}

.variance-normal {
  color: #52c41a;
}

.variance-medium {
  color: #faad14;
}

.variance-high {
  color: #ff4d4f;
  font-weight: bold;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15rpx;
}

.photo-item {
  width: 100%;
  height: 200rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
}

.card-actions {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 30rpx;
  border-top: 1rpx solid #f0f0f0;
}

.action-btn {
  flex: 1;
  height: 70rpx;
  line-height: 70rpx;
  border-radius: 35rpx;
  font-size: 28rpx;
  font-weight: 500;
  border: none;
}

.action-btn.reject {
  background: #fff;
  color: #ff4d4f;
  border: 2rpx solid #ff4d4f;
}

.action-btn.approve {
  background: linear-gradient(135deg, #52c41a 0%, #95de64 100%);
  color: #fff;
}
</style>
