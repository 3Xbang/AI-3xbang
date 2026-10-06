# 工地管理助手 - 移动端

极简工地管理系统移动端，基于 **Uni-app** 框架开发，适配微信小程序/H5/App。

## 🎯 核心理念

> **拍照即交付，确认即流转**

- 照片为主，文字为辅
- 最少 3 张照片（工序、材料必填）
- Canvas 前端水印（GPS + 时间 + 项目 + 人员）
- 老板审批后流转

---

## 📱 已完成页面

### 1. 登录页面 (`pages/login/login.vue`)
- ✅ 用户名 + 密码登录
- ✅ 登录后自动加载项目列表
- ✅ 单项目自动选择，多项目弹窗选择
- ✅ 保存 token、用户信息、当前项目信息

### 2. 首页 (`pages/index/index.vue`)
- ✅ 用户信息卡片（姓名、角色、项目）
- ✅ 4个核心功能按钮：
  - 📸 工序打卡
  - 📦 材料进场
  - ⚠️ 问题上报
  - 📋 我的任务
- ✅ 老板专区：待审批入口 + 红点徽章

### 3. 工序打卡 (`pages/node/submit.vue`)
- ✅ 选择工序下拉框（N01-N16）
- ✅ 拍照上传组件（最少3张，最多9张）
- ✅ 工作说明输入（可选，50-150字）
- ✅ 自动添加 Canvas 水印（GPS + 时间 + 用户 + 项目）
- ✅ 提交到 `/api/nodes/submit`

### 4. 材料进场 (`pages/material/submit.vue`)
- ✅ 材料名称输入
- ✅ 计划数量 + 单位
- ✅ 实际数量 + 自动计算偏差百分比
- ✅ 偏差提示：
  - ≤5%：正常（绿色）
  - 5-10%：警告（黄色）
  - >10%：异常（红色，自动标记）
- ✅ 拍照上传（最少3张）
- ✅ 质量备注（可选，50-150字）
- ✅ 提交到 `/api/materials/submit`

### 5. 问题上报 (`pages/issue/submit.vue`)
- ✅ 问题标题（必填，100字内）
- ✅ 问题描述（必填，500字内）
- ✅ 严重程度选择：
  - 🟢 一般
  - 🟡 重要
  - 🔴 紧急
- ✅ 拍照上传（可选，最多6张）
- ✅ 提交到 `/api/issues/submit`

### 6. 我的任务 (`pages/task/list.vue`)
- ✅ 显示项目下所有工序节点（N01-N16）
- ✅ 工序状态标识：
  - 🔒 锁定（前置未完成）
  - ✅ 可执行
  - ⏳ 进行中
  - ✓ 已完成
- ✅ 显示前置工序关系
- ✅ 显示打卡次数和最后提交时间
- ✅ 悬浮按钮：快速去打卡

### 7. 待审批列表 (`pages/pending/list.vue` - 老板专用)
- ✅ Tab 切换：全部 / 工序 / 材料 / 问题
- ✅ 红点徽章显示待审批数量
- ✅ 工序卡片：
  - 查看照片网格（点击预览大图）
  - 查看工作说明
  - 【通过】/【驳回】按钮
- ✅ 材料卡片：
  - 查看计划/实际数量 + 偏差百分比
  - 查看照片
  - 查看质量备注
  - 【通过】/【驳回】按钮
- ✅ 问题卡片：
  - 查看严重程度
  - 查看描述和照片
  - 【已知晓】按钮

---

## 🧩 核心组件

### `components/photo-uploader.vue`
- 📸 拍照 + 从相册选择
- 🖼️ 照片预览和删除
- ✅ 最小/最大数量限制
- 🎨 网格布局展示

---

## 🛠️ 工具模块

### `utils/watermark.js`
```javascript
addWatermark(imagePath, watermarkInfo)
```
- Canvas 绘制水印
- 信息包含：GPS坐标、时间戳、用户名、项目名
- 压缩质量 0.9
- 返回临时文件路径

### `utils/request.js`
```javascript
request({ url, method, data, header })
```
- 封装 uni.request
- 自动添加 Authorization 头
- 统一错误处理
- baseURL: `http://localhost:3000/api`

---

## 📊 API 集成

### 已对接接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/auth/login` | POST | 用户登录 |
| `/auth/me` | GET | 获取当前用户信息 |
| `/nodes/projects` | GET | 获取项目列表 |
| `/nodes/project/:id` | GET | 获取项目下所有工序 |
| `/nodes/my-tasks` | GET | 获取我的任务列表 |
| `/nodes/submit` | POST | 提交工序打卡 |
| `/nodes/:id/confirm` | POST | 老板确认工序 |
| `/materials/submit` | POST | 提交材料进场 |
| `/materials/:id/confirm` | POST | 老板确认材料 |
| `/issues/submit` | POST | 提交问题上报 |
| `/issues/:id/acknowledge` | POST | 老板知晓问题 |
| `/pending/all` | GET | 获取所有待审批项 |
| `/upload/photo` | POST | 上传照片文件 |

---

## 🎨 UI 设计

### 配色方案
- **工序打卡**：紫色渐变 `#667eea → #764ba2`
- **材料进场**：粉红渐变 `#f093fb → #f5576c`
- **问题上报**：橙黄渐变 `#fa709a → #fee140`
- **任务列表**：紫色渐变（同工序）
- **待审批**：蓝色渐变 `#4facfe → #00f2fe`

### 统一风格
- 圆角卡片：16-20rpx
- 按钮圆角：45rpx（胶囊形）
- 阴影：`0 4rpx 20rpx rgba(0,0,0,0.08)`
- 字体大小：标题 40rpx，正文 28rpx，辅助 24rpx

---

## 📦 依赖

```json
{
  "dependencies": {
    "@dcloudio/uni-app": "^3.0.0",
    "vue": "^3.0.0"
  }
}
```

---

## 🚀 启动说明

### 开发环境

```bash
# 安装依赖
npm install

# H5 开发
npm run dev:h5

# 微信小程序开发
npm run dev:mp-weixin

# App 开发
npm run dev:app
```

### 配置修改

修改 `utils/request.js` 中的 `baseURL`：

```javascript
const baseURL = 'http://your-server-ip:3000/api'
```

---

## 🎯 核心流程

### 工人操作流程
1. 登录 → 选择项目
2. 首页点击【工序打卡】
3. 选择工序（如 N01 - 场地平整）
4. 拍照上传（最少3张，自动添加水印）
5. 可选填写工作说明
6. 提交等待老板审批

### 老板操作流程
1. 登录 → 首页看到红点徽章
2. 点击【待审批】进入列表
3. 查看工序/材料/问题的照片和信息
4. 点击【通过】或【驳回】（填写原因）
5. 审批通过后，下一工序自动解锁

---

## 📞 技术栈

- 前端：Uni-app Vue 3
- 后端：Node.js + Express + PostgreSQL
- 部署：AWS t2.micro (1G RAM)
- 目标：泰国工地 ~20 工人使用

---

**版本**: v1.0.0  
**最后更新**: 2024-10-06
