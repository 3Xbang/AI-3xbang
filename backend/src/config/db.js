/**
 * PostgreSQL 数据库连接配置
 * 使用连接池管理数据库连接
 */

const { Pool } = require('pg');
require('dotenv').config();

// 创建连接池（适配 AWS t2.micro 1G 内存）
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'construction_simple',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 10,                      // 最大连接数（内存限制）
  idleTimeoutMillis: 30000,     // 空闲连接超时时间
  connectionTimeoutMillis: 2000 // 连接超时时间
});

// 测试数据库连接
pool.on('connect', () => {
  console.log('✅ 数据库连接成功');
});

pool.on('error', (err) => {
  console.error('❌ 数据库连接错误:', err);
  process.exit(-1);
});

module.exports = pool;
