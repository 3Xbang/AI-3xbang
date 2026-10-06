# 极简工程项目管理系统

## 🌐 在线访问

**网址**: [winaii.com](http://winaii.com) (即将启用) | [http://18.206.11.7](http://18.206.11.7) (当前可用)

**测试账号**：
- 用户名：`admin`
- 密码：`123456`

## 📱 支持所有终端

本系统是**响应式 Web 应用**，无需下载 APP，使用浏览器即可访问：

- ✅ **PC 电脑** - Chrome、Edge、Firefox、Safari
- ✅ **平板** - iPad、Android 平板
- ✅ **手机** - iPhone、Android 手机

一个网址，所有设备通用！

## 🎯 核心功能

**"拍照即交付，确认即流转"** - 废除繁琐报表，只管控关键节点

### 现场人员（4个功能）
1. **📸 节点打卡** - 完成工序拍3张照片即可
2. **📦 材料进场** - 材料到货拍照登记
3. **⚠️ 异常上报** - 发现问题立即拍照上报
4. **📋 我的任务** - 查看今天该做什么

### 管理人员（3个功能）
1. **✅ 待确认列表** - 查看照片，一键确认/驳回
2. **📊 项目进度** - 时间轴查看整体进度
3. **⚠️ 异常处理** - 实时接收现场问题

## 🏗️ 技术架构

### 前端
- **技术栈**: HTML5 + CSS3 + JavaScript
- **特点**: 响应式设计，适配所有屏幕尺寸
- **功能**: 拍照上传、Canvas 水印、实时通知

### 后端
- **技术栈**: Node.js + Express + PostgreSQL
- **API**: RESTful 设计，JWT 认证
- **部署**: AWS EC2 (Amazon Linux 2023)

### 服务器
- **平台**: AWS EC2 t2.micro
- **IP**: 18.206.11.7
- **域名**: winaii.com
- **Web 服务**: Nginx 反向代理
- **进程管理**: PM2

## 📂 项目结构

```
AI-3xbang/
├── backend/               # Node.js 后端
│   ├── src/
│   │   ├── controllers/  # 控制器
│   │   ├── services/     # 业务逻辑
│   │   ├── routes/       # 路由
│   │   ├── middlewares/  # 中间件
│   │   └── config/       # 配置文件
│   └── package.json
│
├── frontend-web/         # Web 前端
│   └── index.html        # 登录页面
│
├── docs/                 # 文档
│   ├── simple-database-schema.sql
│   └── simple-backend-architecture.md
│
└── README.md
```

## 🚀 快速开始

### 访问系统
1. 打开浏览器访问: http://18.206.11.7
2. 输入用户名: `admin`
3. 输入密码: `123456`
4. 点击登录

### API 端点
- `POST /api/auth/login` - 用户登录
- `POST /api/nodes/submit` - 提交节点打卡
- `POST /api/materials/submit` - 提交材料进场
- `POST /api/issues/submit` - 提交异常上报
- `GET /api/pending/all` - 获取待确认列表
- `PUT /api/nodes/:id/confirm` - 确认节点
- `PUT /api/materials/:id/confirm` - 确认材料

## 📖 详细文档

- [项目概述](./SIMPLE_PROJECT_OVERVIEW.md) - 系统设计理念和功能说明
- [数据库设计](./docs/simple-database-schema.sql) - 数据库表结构
- [后端架构](./docs/simple-backend-architecture.md) - API 设计文档

## 🔐 安全说明

- ✅ JWT Token 认证
- ✅ 密码 bcrypt 加密
- ✅ SQL 注入防护
- ✅ 文件上传类型限制
- ⏳ HTTPS (域名 SSL 证书配置中)

## 📝 开发计划

- [x] 后端 API 开发
- [x] 数据库设计
- [x] 用户认证系统
- [x] 服务器部署
- [x] 登录页面
- [ ] 主界面开发
- [ ] 节点打卡功能
- [ ] 材料进场功能
- [ ] 异常上报功能
- [ ] 待确认列表
- [ ] 进度看板
- [ ] 照片水印处理
- [ ] HTTPS 配置

## 💡 设计理念

**反形式主义** - 让现场工人像发朋友圈一样简单，让老板像刷抖音一样高效

传统系统的问题：
- ❌ 复杂表格，现场工人不会填
- ❌ 层层审批，效率低下
- ❌ 数据造假，系统成摆设

我们的解决方案：
- ✅ 拍照即提交，30秒完成
- ✅ 一键确认，立即流转
- ✅ 照片+GPS+时间戳，无法造假

## 📞 联系方式

- **项目**: 极简工程项目管理系统
- **网址**: winaii.com
- **GitHub**: https://github.com/3Xbang/AI-3xbang

---

**© 2024 Winaii.com - 极简工程项目管理系统**
