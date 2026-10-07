const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件（照片）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '施工管理系统API运行中' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器启动成功: http://localhost:${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/api`);
});

module.exports = app;
