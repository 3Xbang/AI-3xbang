<template>
  <view class="container">
    <view class="header">
      <text class="title">我的任务</text>
      <text class="subtitle">{{ projectName }}</text>
    </view>

    <view class="content">
      <view v-if="loading" class="loading">
        <text>加载中...</text>
      </view>

      <view v-else-if="nodeList.length === 0" class="empty">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无任务</text>
      </view>

      <view v-else class="node-list">
        <view
          v-for="node in nodeList"
          :key="node.node_id"
          :class="['node-item', node.status]"
          @click="handleNodeClick(node)"
        >
          <view class="node-header">
            <text class="node-code">{{ node.node_code }}</text>
            <view :class="['status-badge', node.status]">
              <text>{{ getStatusText(node.status) }}</text>
            </view>
          </view>
          
          <text class="node-name">{{ node.name }}</text>
          
          <view v-if="node.description" class="node-desc">
            <text>{{ node.description }}</text>
          </view>

          <view v-if="node.prev_node_name" class="prerequisite">
            <text class="prerequisite-label">前置工序：</text>
            <text class="prerequisite-value">{{ node.prev_node_name }}</text>
          </view>

          <view v-if="node.record_count > 0" class="record-info">
            <text>已打卡 {{ node.record_count }} 次</text>
            <text v-if="node.last_submit_time"> | 最后：{{ formatTime(node.last_submit_time) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="fab" @click="goToSubmit">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script>
import request from '@/utils/request.js'

export default {
  data() {
    return {
      loading: false,
      nodeList: [],
      projectId: '',
      projectName: ''
    }
  },
  onLoad() {
    this.projectId = uni.getStorageSync('current_project_id')
    this.projectName = uni.getStorageSync('current_project_name') || '项目'
    
    if (!this.projectId) {
      uni.showToast({ title: '请先选择项目', icon: 'none' })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/index/index' })
      }, 1500)
      return
    }
    
    this.loadNodes()
  },
  onShow() {
    // 每次显示页面时刷新数据
    if (this.projectId) {
      this.loadNodes()
    }
  },
  methods: {
    async loadNodes() {
      this.loading = true
      try {
        const res = await request({
          url: `/nodes/my-tasks?project_id=${this.projectId}`,
          method: 'GET'
        })
        this.nodeList = res.data || []
      } catch (err) {
        uni.showToast({ title: err.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    getStatusText(status) {
      const statusMap = {
        'locked': '🔒 锁定',
        'available': '✅ 可执行',
        'in_progress': '⏳ 进行中',
        'completed': '✓ 已完成'
      }
      return statusMap[status] || status
    },

    formatTime(timeStr) {
      if (!timeStr) return ''
      const date = new Date(timeStr)
      const now = new Date()
      const diff = now - date
      
      // 1小时内
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000)
        return `${minutes}分钟前`
      }
      
      // 24小时内
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000)
        return `${hours}小时前`
      }
      
      // 超过24小时显示日期
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${month}月${day}日`
    },

    handleNodeClick(node) {
      if (node.status === 'locked') {
        uni.showModal({
          title: '工序锁定',
          content: `需要先完成前置工序：${node.prev_node_name}`,
          showCancel: false
        })
        return
      }

      uni.showModal({
        title: node.name,
        content: `${node.description || '暂无描述'}\n\n状态：${this.getStatusText(node.status)}`,
        confirmText: '去打卡',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm && node.status !== 'locked') {
            this.goToSubmit()
          }
        }
      })
    },

    goToSubmit() {
      uni.navigateTo({
        url: '/pages/node/submit'
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 100rpx;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 30rpx 30rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 10rpx;
}

.subtitle {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
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

.node-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.node-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.node-item.locked {
  opacity: 0.6;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15rpx;
}

.node-code {
  font-size: 24rpx;
  color: #999;
  font-family: monospace;
}

.status-badge {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 500;
}

.status-badge.locked {
  background: #f0f0f0;
  color: #999;
}

.status-badge.available {
  background: #f0f9ff;
  color: #1890ff;
}

.status-badge.in_progress {
  background: #fffbe6;
  color: #faad14;
}

.status-badge.completed {
  background: #f6ffed;
  color: #52c41a;
}

.node-name {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.node-desc {
  padding: 15rpx 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  margin-bottom: 15rpx;
}

.node-desc text {
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}

.prerequisite {
  padding: 12rpx 20rpx;
  background: #fff7e6;
  border-left: 4rpx solid #faad14;
  border-radius: 4rpx;
  margin-bottom: 15rpx;
}

.prerequisite-label {
  font-size: 24rpx;
  color: #999;
}

.prerequisite-value {
  font-size: 24rpx;
  color: #faad14;
  font-weight: 500;
}

.record-info {
  display: flex;
  gap: 10rpx;
  font-size: 22rpx;
  color: #999;
  padding-top: 15rpx;
  border-top: 1rpx solid #f0f0f0;
}

.fab {
  position: fixed;
  right: 30rpx;
  bottom: 30rpx;
  width: 100rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(102, 126, 234, 0.5);
}

.fab-icon {
  font-size: 60rpx;
  color: #fff;
  font-weight: 300;
  line-height: 1;
}
</style>
