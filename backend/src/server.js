/**
 * 服务器启动入口
 */

require('dotenv').config();
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

// 测试数据库连接
async function testDatabaseConnection() {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ 数据库连接成功，当前时间:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ 数据库连接失败:', err.message);
    return false;
  }
}

// 启动服务器
async function startServer() {
  // 1. 测试数据库连接
  const dbConnected = await testDatabaseConnection();
  
  if (!dbConnected) {
    console.error('❌ 服务器启动失败：数据库连接失败');
    process.exit(1);
  }
  
  // 2. 启动 HTTP 服务器
  app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('🚀 极简工程项目管理系统 API 启动成功');
    console.log('========================================');
    console.log(`📡 服务器地址: http://localhost:${PORT}`);
    console.log(`🌍 环境模式: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 数据库: ${process.env.DB_NAME}`);
    console.log(`📁 上传目录: ${process.env.UPLOAD_DIR || './uploads'}`);
    console.log('========================================');
    console.log('');
    console.log('📋 核心 API 接口:');
    console.log('   POST   /api/auth/login              # 用户登录');
    console.log('   POST   /api/nodes/submit            # 提交节点打卡');
    console.log('   POST   /api/materials/submit        # 提交材料进场');
    console.log('   POST   /api/issues/submit           # 提交异常上报');
    console.log('   GET    /api/pending/all             # 获取待确认列表');
    console.log('   PUT    /api/nodes/:id/confirm       # 确认节点');
    console.log('   PUT    /api/materials/:id/confirm   # 确认材料');
    console.log('========================================');
    console.log('');
  });
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});

// 启动
startServer().catch(err => {
  console.error('❌ 服务器启动失败:', err);
  process.exit(1);
});
