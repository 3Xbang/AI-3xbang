<template>
  <view class="container">
    <view class="login-box">
      <view class="logo">
        <text class="logo-icon">🏗️</text>
        <text class="logo-text">工地管理助手</text>
      </view>
      
      <view class="form">
        <view class="form-item">
          <text class="label">👤 用户名</text>
          <input 
            class="input" 
            v-model="username" 
            placeholder="请输入用户名"
            placeholder-style="color: #ccc;"
          />
        </view>
        
        <view class="form-item">
          <text class="label">🔒 密码</text>
          <input 
            class="input" 
            v-model="password" 
            type="password"
            placeholder="请输入密码"
            placeholder-style="color: #ccc;"
          />
        </view>
        
        <button class="login-btn" @click="handleLogin" :loading="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </view>
      
      <view class="tips">
        <text class="tip-title">测试账号：</text>
        <text class="tip-item">老板：boss / Admin@123</text>
        <text class="tip-item">工人：zhangsan / Worker@123</text>
      </view>
    </view>
    
    <!-- 项目选择弹窗 -->
    <view v-if="showProjectPicker" class="modal-mask" @click="showProjectPicker = false">
      <view class="modal-content" @click.stop>
        <view class="modal-title">选择项目</view>
        <view class="project-list">
          <view 
            v-for="(project, index) in projects" 
            :key="project.project_id"
            class="project-item"
            @click="selectProject(index)"
          >
            <text class="project-name">{{ project.name }}</text>
            <text class="project-location">{{ project.location || '未设置地址' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import request from '@/utils/request.js';

export default {
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      projects: [],
      selectedProjectIndex: -1,
      showProjectPicker: false
    };
  },
  methods: {
    async handleLogin() {
      // 验证输入
      if (!this.username || !this.password) {
        uni.showToast({
          title: '请输入用户名和密码',
          icon: 'none'
        });
        return;
      }
      
      this.loading = true;
      
      try {
        const res = await request({
          url: '/auth/login',
          method: 'POST',
          data: {
            username: this.username,
            password: this.password
          }
        });
        
        // 保存 token
        uni.setStorageSync('token', res.data.token);
        
        // 保存用户信息
        const user = res.data.user;
        uni.setStorageSync('user_id', user.user_id);
        uni.setStorageSync('user_info', user);
        uni.setStorageSync('user_role', user.role);
        
        // 登录成功，加载项目列表
        await this.loadProjects();
        
      } catch (err) {
        uni.showToast({
          title: err.message || '登录失败',
          icon: 'none'
        });
        this.loading = false;
      }
    },
    
    async loadProjects() {
      try {
        const res = await request({
          url: '/nodes/projects',
          method: 'GET'
        });
        
        this.projects = res.data || [];
        
        if (this.projects.length === 0) {
          uni.showModal({
            title: '提示',
            content: '当前没有可用项目，请联系管理员',
            showCancel: false,
            success: () => {
              this.loading = false;
            }
          });
          return;
        }
        
        if (this.projects.length === 1) {
          // 只有一个项目，直接选择
          this.selectProject(0);
        } else {
          // 多个项目，让用户选择
          this.loading = false;
          this.showProjectPicker = true;
        }
        
      } catch (err) {
        uni.showToast({
          title: '加载项目失败',
          icon: 'none'
        });
        this.loading = false;
      }
    },
    
    selectProject(index) {
      this.selectedProjectIndex = index;
      const project = this.projects[index];
      
      // 保存当前项目信息
      uni.setStorageSync('current_project_id', project.project_id);
      uni.setStorageSync('current_project_name', project.name);
      
      // 登录成功提示
      uni.showToast({
        title: '登录成功',
        icon: 'success'
      });
      
      // 跳转到首页
      setTimeout(() => {
        uni.reLaunch({
          url: '/pages/index/index'
        });
      }, 1500);
    },
    
    onProjectChange(e) {
      const index = e.detail.value;
      this.selectProject(index);
    }
  }
};
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.login-box {
  width: 100%;
  background: #fff;
  border-radius: 30rpx;
  padding: 60rpx 40rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
}

.logo {
  text-align: center;
  margin-bottom: 60rpx;
}

.logo-icon {
  font-size: 100rpx;
  display: block;
  margin-bottom: 20rpx;
}

.logo-text {
  font-size: 44rpx;
  font-weight: bold;
  color: #333;
}

.form {
  margin-bottom: 40rpx;
}

.form-item {
  margin-bottom: 40rpx;
}

.label {
  font-size: 28rpx;
  color: #666;
  display: block;
  margin-bottom: 16rpx;
}

.input {
  width: 100%;
  height: 90rpx;
  background: #f5f5f5;
  border-radius: 15rpx;
  padding: 0 30rpx;
  font-size: 32rpx;
  box-sizing: border-box;
}

.login-btn {
  width: 100%;
  height: 90rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 15rpx;
  border: none;
  margin-top: 40rpx;
}

.login-btn:active {
  opacity: 0.8;
}

.tips {
  background: #f0f2f5;
  border-radius: 15rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
}

.tip-title {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  margin-bottom: 16rpx;
}

.tip-item {
  font-size: 24rpx;
  color: #666;
  line-height: 1.8;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  width: 600rpx;
  max-height: 70vh;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 30rpx;
}

.project-list {
  max-height: 50vh;
  overflow-y: auto;
}

.project-item {
  padding: 30rpx;
  background: #f5f5f5;
  border-radius: 15rpx;
  margin-bottom: 20rpx;
}

.project-item:active {
  background: #e0e0e0;
}

.project-name {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.project-location {
  display: block;
  font-size: 24rpx;
  color: #999;
}
</style>
