/**
 * Express 应用配置
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error');

// 创建 Express 应用
const app = express();

// ============================================================
// 1. 基础中间件
// ============================================================

// CORS 跨域配置
const allowedOrigins = [
  'http://localhost:5173',      // 本地开发
  'http://localhost:3000',      // 本地开发
  'http://18.206.11.7',         // AWS 服务器 IP
  'https://winaii.com',         // 生产环境
  'https://www.winaii.com',     // 生产环境（www）
  'http://winaii.com',          // 生产环境（HTTP）
  'http://www.winaii.com',      // 生产环境（www HTTP）
];

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有 origin 的请求（如 Postman、curl）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 解析 JSON 请求体
app.use(express.json({ limit: '10mb' }));

// 解析 URL 编码请求体
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（上传的照片）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// 2. 请求日志（简单版）
// ============================================================

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// ============================================================
// 3. API 路由
// ============================================================

app.use('/api', routes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: '极简工程项目管理系统 API',
    version: '1.0.0',
    docs: '/api/health'
  });
});

// ============================================================
// 4. 错误处理
// ============================================================

// 404 处理
app.use(notFoundHandler);

// 统一错误处理
app.use(errorHandler);

module.exports = app;
