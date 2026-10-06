const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'construction_user',
    password: 'Winaii2024Strong',
    database: 'construction_simple',
    multipleStatements: true
  });

  try {
    console.log('连接数据库成功...');
    
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/003_add_process_measurements.sql'), 'utf8');
    console.log('执行迁移SQL...');
    
    await connection.query(sql);
    console.log('✅ 迁移执行成功！');
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration();
