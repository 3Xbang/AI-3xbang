<template>
  <view class="container">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-info">
        <text class="user-name">👋 {{ userName }}</text>
        <text class="user-role">{{ roleText }}</text>
      </view>
      <view class="project-info">
        <text class="project-name">📌 {{ projectName }}</text>
      </view>
    </view>
    
    <!-- 4个核心功能大按钮 -->
    <view class="function-grid">
      <!-- 节点打卡 -->
      <view class="function-item" @click="goToNodeSubmit">
        <view class="icon-wrapper" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <text class="icon">📸</text>
        </view>
        <text class="function-title">节点打卡</text>
        <text class="function-desc">工序交接点</text>
      </view>
      
      <!-- 材料进场 -->
      <view class="function-item" @click="goToMaterialSubmit">
        <view class="icon-wrapper" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <text class="icon">📦</text>
        </view>
        <text class="function-title">材料进场</text>
        <text class="function-desc">材料车到了</text>
      </view>
      
      <!-- 异常上报 -->
      <view class="function-item" @click="goToIssueSubmit">
        <view class="icon-wrapper" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
          <text class="icon">⚠️</text>
        </view>
        <text class="function-title">异常上报</text>
        <text class="function-desc">缺料/图纸问题</text>
      </view>
      
      <!-- 我的任务 -->
      <view class="function-item" @click="goToTaskList">
        <view class="icon-wrapper" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);">
          <text class="icon">📋</text>
        </view>
        <text class="function-title">我的任务</text>
        <text class="function-desc">今天该干啥</text>
      </view>
    </view>
    
    <!-- 老板专用：待确认入口 -->
    <view class="boss-section" v-if="userRole === 'boss'">
      <view class="section-title">
        <text class="title-text">👔 老板专区</text>
      </view>
      <view class="boss-card" @click="goToPendingList">
        <view class="card-left">
          <text class="card-title">待确认列表</text>
          <text class="card-desc">现场提交的节点和材料</text>
        </view>
        <view class="card-right">
          <view class="badge" v-if="pendingCount > 0">
            <text class="badge-text">{{ pendingCount }}</text>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>
    
    <!-- 快捷提示 -->
    <view class="quick-tip">
      <text class="tip-icon">💡</text>
      <text class="tip-text">拍照即交付，确认即流转</text>
    </view>
  </view>
</template>

<script>
import request from '@/utils/request.js';

export default {
  data() {
    return {
      userName: '加载中...',
      userRole: 'worker',
      projectName: '加载中...',
      pendingCount: 0
    };
  },
  computed: {
    roleText() {
      const roleMap = {
        boss: '👔 老板/管理员',
        worker: '👷 现场工人',
        pm: '📊 项目经理'
      };
      return roleMap[this.userRole] || '用户';
    }
  },
  onLoad() {
    this.checkLogin();
  },
  onShow() {
    // 每次显示页面时刷新待确认数量
    if (this.userRole === 'boss') {
      this.loadPendingCount();
    }
  },
  methods: {
    /**
     * 检查登录状态
     */
    checkLogin() {
      const token = uni.getStorageSync('token');
      if (!token) {
        // 未登录，跳转到登录页
        uni.reLaunch({
          url: '/pages/login/login'
        });
        return;
      }
      
      // 加载用户信息
      this.loadUserInfo();
    },
    
    /**
     * 加载用户信息
     */
    async loadUserInfo() {
      try {
        const res = await request.get('/auth/me');
        const user = res.data;
        
        this.userName = user.full_name || user.username;
        this.userRole = user.role;
        
        // 保存到本地存储（供水印使用）
        uni.setStorageSync('userName', this.userName);
        uni.setStorageSync('userRole', this.userRole);
        
        // 临时写死项目名（TODO: 多项目时从接口获取）
        this.projectName = '苏梅岛别墅A栋';
        uni.setStorageSync('projectName', this.projectName);
        
        // 如果是老板，加载待确认数量
        if (this.userRole === 'boss') {
          this.loadPendingCount();
        }
        
      } catch (err) {
        console.error('加载用户信息失败:', err);
        uni.showToast({
          title: '加载用户信息失败',
          icon: 'none'
        });
      }
    },
    
    /**
     * 加载待确认数量
     */
    async loadPendingCount() {
      try {
        const res = await request.get('/pending/all');
        this.pendingCount = res.data.total || 0;
      } catch (err) {
        console.error('加载待确认数量失败:', err);
      }
    },
    
    /**
     * 跳转到节点打卡
     */
    goToNodeSubmit() {
      uni.navigateTo({
        url: '/pages/node/submit'
      });
    },
    
    /**
     * 跳转到材料进场
     */
    goToMaterialSubmit() {
      uni.navigateTo({
        url: '/pages/material/submit'
      });
    },
    
    /**
     * 跳转到异常上报
     */
    goToIssueSubmit() {
      uni.navigateTo({
        url: '/pages/issue/submit'
      });
    },
    
    /**
     * 跳转到我的任务
     */
    goToTaskList() {
      uni.switchTab({
        url: '/pages/task/list'
      });
    },
    
    /**
     * 跳转到待确认列表
     */
    goToPendingList() {
      uni.navigateTo({
        url: '/pages/pending/list'
      });
    }
  }
};
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #f0f2f5 0%, #ffffff 100%);
  padding: 20rpx;
  padding-bottom: 100rpx;
}

.user-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 10rpx 30rpx rgba(102, 126, 234, 0.3);
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.user-name {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.user-role {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  padding: 10rpx 20rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20rpx;
}

.project-info {
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.2);
}

.project-name {
  font-size: 28rpx;
  color: #fff;
}

.function-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.function-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
  transition: transform 0.2s;
}

.function-item:active {
  transform: scale(0.95);
}

.icon-wrapper {
  width: 120rpx;
  height: 120rpx;
  border-radius: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.15);
}

.icon {
  font-size: 60rpx;
}

.function-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.function-desc {
  font-size: 24rpx;
  color: #999;
}

.boss-section {
  margin-bottom: 30rpx;
}

.section-title {
  margin-bottom: 20rpx;
}

.title-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.boss-card {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
  border-radius: 20rpx;
  padding: 40rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4rpx 20rpx rgba(252, 182, 159, 0.3);
}

.card-left {
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.card-desc {
  font-size: 24rpx;
  color: #666;
}

.card-right {
  display: flex;
  align-items: center;
}

.badge {
  background: #ff4d4f;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  margin-right: 20rpx;
  min-width: 40rpx;
  text-align: center;
}

.badge-text {
  font-weight: bold;
}

.arrow {
  font-size: 60rpx;
  color: #333;
}

.quick-tip {
  background: #e6f7ff;
  border-radius: 20rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  border-left: 8rpx solid #1890ff;
}

.tip-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.tip-text {
  font-size: 28rpx;
  color: #0050b3;
  font-weight: 500;
}
</style>
