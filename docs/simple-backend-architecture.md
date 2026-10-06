# 极简工程管理系统 - 后端架构设计

## 📁 后端目录结构（极简版）

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js              # PostgreSQL 连接配置
│   │   ├── jwt.js             # JWT 配置
│   │   └── upload.js          # Multer 上传配置
│   │
│   ├── middlewares/
│   │   ├── auth.js            # JWT 认证中间件
│   │   ├── role.js            # 角色校验中间件（boss/worker）
│   │   └── error.js           # 统一错误处理
│   │
│   ├── services/
│   │   ├── node.service.js    # 节点打卡业务逻辑
│   │   ├── material.service.js # 材料进场业务逻辑
│   │   ├── issue.service.js   # 异常上报业务逻辑
│   │   └── timeline.service.js # 时间轴业务逻辑
│   │
│   ├── routes/
│   │   ├── auth.routes.js     # 登录/登出
│   │   ├── node.routes.js     # 节点打卡相关
│   │   ├── material.routes.js # 材料进场相关
│   │   ├── issue.routes.js    # 异常上报相关
│   │   └── timeline.routes.js # 进度看板相关
│   │
│   ├── utils/
│   │   ├── response.js        # 统一响应格式
│   │   └── file.js            # 文件工具函数
│   │
│   ├── app.js                 # Express 应用配置
│   └── server.js              # 服务器启动入口
│
├── uploads/                   # 文件上传目录
│   ├── nodes/                 # 节点打卡照片
│   ├── materials/             # 材料进场照片
│   └── issues/                # 异常上报照片
│
├── .env                       # 环境变量
├── package.json
└── README.md
```

## 🚀 技术栈

- **运行时**: Node.js 18+ LTS
- **框架**: Express.js 4.x（轻量级）
- **数据库**: PostgreSQL 15+ (使用 pg 原生驱动)
- **文件上传**: Multer (接收多文件)
- **认证**: JWT (jsonwebtoken)
- **密码加密**: bcrypt
- **环境变量**: dotenv

## 📝 核心 API 设计（极简 RESTful）

### 1. 认证相关
```
POST   /api/auth/login        # 登录（返回JWT）
POST   /api/auth/logout       # 登出
GET    /api/auth/me           # 获取当前用户信息
```

### 2. 节点打卡
```
POST   /api/nodes/submit      # 提交节点打卡（带照片）
GET    /api/nodes/pending     # 获取待确认的节点列表（老板用）
PUT    /api/nodes/:id/confirm # 确认通过节点（老板用）
PUT    /api/nodes/:id/reject  # 驳回节点（老板用）
GET    /api/nodes/my-tasks    # 获取我的任务列表（工人用）
```

### 3. 材料进场
```
POST   /api/materials/submit  # 提交材料进场（带照片）
GET    /api/materials/pending # 获取待确认的材料列表（老板用）
PUT    /api/materials/:id/confirm # 确认通过材料（老板用）
PUT    /api/materials/:id/reject  # 驳回材料（老板用）
GET    /api/materials/list    # 查询材料进场历史
```

### 4. 异常上报
```
POST   /api/issues/submit     # 提交异常上报（带照片）
GET    /api/issues/list       # 获取异常列表（老板用）
PUT    /api/issues/:id/reply  # 回复异常（老板用）
```

### 5. 进度看板
```
GET    /api/timeline/:projectId # 获取项目进度时间轴
GET    /api/pending/all       # 获取所有待确认项（节点+材料）
GET    /api/stats/:projectId  # 获取项目统计数据
```

### 6. 文件上传
```
POST   /api/upload/photos     # 批量上传照片（最多10张）
```

## 🔐 认证与权限设计

### JWT Token 结构
```javascript
{
  userId: 1,
  username: 'zhangsan',
  role: 'worker',  // 'boss' 或 'worker'
  projectId: 1
}
```

### 权限中间件
```javascript
// 验证 JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token无效' });
  }
};

// 验证角色
const requireBoss = (req, res, next) => {
  if (req.user.role !== 'boss') {
    return res.status(403).json({ error: '只有老板可以操作' });
  }
  next();
};
```

## 📸 照片上传处理（Multer 配置）

### 配置示例
```javascript
const multer = require('multer');
const path = require('path');

// 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || 'nodes'; // nodes | materials | issues
    const uploadPath = path.join(__dirname, `../../uploads/${type}`);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 文件过滤
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件（jpg, png, webp）'));
  }
};

// Multer 实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 单文件最大 5MB
    files: 10                    // 最多 10 个文件
  }
});

module.exports = upload;
```

## 🔄 核心业务逻辑

### 1. 节点打卡提交逻辑

```javascript
// services/node.service.js

async function submitNode(data) {
  const { projectId, nodeId, submitterId, photos, watermarkInfo, notes } = data;
  
  // 1. 校验照片数量
  if (!photos || photos.length < 3) {
    throw new Error('至少需要上传3张照片');
  }
  
  // 2. 检查前置节点是否已确认
  const checkResult = await db.query(
    'SELECT * FROM check_node_submittable($1, $2)',
    [projectId, nodeId]
  );
  
  if (!checkResult.rows[0].can_submit) {
    throw new Error(
      `无法提交：${checkResult.rows[0].reason}。` +
      `前置节点"${checkResult.rows[0].prev_node_name}"尚未确认。`
    );
  }
  
  // 3. 构建照片 JSON
  const photosJson = photos.map(p => ({
    url: p.path.replace(/\\/g, '/'),  // 转换路径格式
    type: p.fieldname,
    size: p.size,
    originalName: p.originalname
  }));
  
  // 4. 插入节点打卡记录
  const result = await db.query(`
    INSERT INTO node_records (
      project_id, node_id, submitter_id, 
      photos_json, photo_count, watermark_info, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    projectId, 
    nodeId, 
    submitterId, 
    JSON.stringify(photosJson), 
    photos.length,
    JSON.stringify(watermarkInfo),
    notes
  ]);
  
  // 5. 返回创建的记录
  return result.rows[0];
}
```

### 2. 老板确认节点逻辑

```javascript
// services/node.service.js

async function confirmNode(recordId, bossId, action) {
  // action: 'approve' | 'reject'
  
  // 1. 获取记录
  const record = await db.query(
    'SELECT * FROM node_records WHERE id = $1',
    [recordId]
  );
  
  if (!record.rows[0]) {
    throw new Error('记录不存在');
  }
  
  if (record.rows[0].status !== 'pending') {
    throw new Error('该记录已处理，无法重复操作');
  }
  
  // 2. 更新状态
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  
  const result = await db.query(`
    UPDATE node_records 
    SET status = $1, confirmed_by = $2, confirmed_at = NOW()
    WHERE id = $3
    RETURNING *
  `, [newStatus, bossId, recordId]);
  
  return result.rows[0];
}
```

### 3. 材料偏差自动校验

```javascript
// services/material.service.js

async function submitMaterial(data) {
  const { 
    projectId, materialName, quantity, unit, 
    plannedQuantity, submitterId, photos, watermarkInfo 
  } = data;
  
  // 1. 校验照片数量
  if (!photos || photos.length < 3) {
    throw new Error('至少需要上传3张照片');
  }
  
  // 2. 构建照片 JSON
  const photosJson = photos.map(p => ({
    url: p.path.replace(/\\/g, '/'),
    type: p.fieldname
  }));
  
  // 3. 插入记录（触发器会自动计算 variance_percentage）
  const result = await db.query(`
    INSERT INTO material_records (
      project_id, material_name, quantity, unit, planned_quantity,
      submitter_id, photos_json, photo_count, watermark_info
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    projectId, materialName, quantity, unit, plannedQuantity,
    submitterId, JSON.stringify(photosJson), photos.length,
    JSON.stringify(watermarkInfo)
  ]);
  
  const record = result.rows[0];
  
  // 4. 判断是否标红（偏差>10%）
  if (record.variance_percentage && Math.abs(record.variance_percentage) > 10) {
    record.needsAttention = true;
    record.warningMessage = `⚠️ 实际数量与计划偏差 ${record.variance_percentage.toFixed(1)}%`;
  }
  
  return record;
}
```

## 📊 统一响应格式

```javascript
// utils/response.js

class ResponseUtil {
  static success(data, message = '操作成功') {
    return {
      success: true,
      code: 200,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }
  
  static error(message = '操作失败', code = 400, errors = null) {
    return {
      success: false,
      code,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }
}

// 使用示例
res.json(ResponseUtil.success(result));
res.status(400).json(ResponseUtil.error('照片数量不足'));
```

## 🚨 错误处理中间件

```javascript
// middlewares/error.js

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Multer 文件上传错误
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: '文件过大，单个文件最大5MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: '文件数量超限，最多10张'
      });
    }
  }
  
  // 数据库错误
  if (err.code === '23505') {  // PostgreSQL unique violation
    return res.status(400).json({
      error: '数据已存在，请勿重复提交'
    });
  }
  
  // 通用错误
  res.status(500).json({
    error: err.message || '服务器内部错误'
  });
};

module.exports = errorHandler;
```

## ⚡ 性能优化（AWS t2.micro 1G 内存）

### 1. 数据库连接池配置
```javascript
// config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,           // 最大连接数（t2.micro 限制）
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

### 2. Node.js 启动参数
```bash
node --max-old-space-size=768 src/server.js
```

### 3. 文件上传优化
```javascript
// ✅ 正确做法：前端 Canvas 加水印后上传
// ❌ 错误做法：后端使用 sharp/jimp 处理图片（耗内存）

// 后端只负责接收和保存文件
app.post('/api/upload/photos', upload.array('photos', 10), (req, res) => {
  const files = req.files.map(f => ({
    url: `/uploads/${f.filename}`,
    size: f.size
  }));
  
  res.json({ success: true, files });
});
```

## 🔧 环境变量配置

```env
# .env 文件示例

# 服务器
NODE_ENV=production
PORT=3000

# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_NAME=construction_simple
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# 文件上传
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880  # 5MB
MAX_FILES=10
```

## 📋 API 请求示例

### 1. 提交节点打卡
```javascript
// POST /api/nodes/submit
// Content-Type: multipart/form-data

const formData = new FormData();
formData.append('projectId', 1);
formData.append('nodeId', 6);  // 水电隐蔽工程
formData.append('photos', file1);  // 3张照片
formData.append('photos', file2);
formData.append('photos', file3);
formData.append('watermarkInfo', JSON.stringify({
  gps: { lat: 9.5353, lng: 100.0633 },
  timestamp: '2024-01-15 16:30:00',
  project: '苏梅岛别墅A栋',
  operator: '张三'
}));
formData.append('notes', '水电管线已全部检查，无异常');

// 响应示例
{
  "success": true,
  "code": 200,
  "message": "节点打卡提交成功",
  "data": {
    "id": 15,
    "project_id": 1,
    "node_id": 6,
    "submitter_id": 2,
    "photos_json": [...],
    "photo_count": 3,
    "status": "pending",
    "submit_time": "2024-01-15T08:30:00.000Z"
  }
}
```

### 2. 老板确认节点
```javascript
// PUT /api/nodes/15/confirm
// Content-Type: application/json

{
  "action": "approve"  // 或 "reject"
}

// 响应示例
{
  "success": true,
  "code": 200,
  "message": "节点已确认通过",
  "data": {
    "id": 15,
    "status": "approved",
    "confirmed_by": 1,
    "confirmed_at": "2024-01-15T09:00:00.000Z"
  }
}
```

### 3. 获取待确认列表
```javascript
// GET /api/pending/all

// 响应示例
{
  "success": true,
  "code": 200,
  "data": {
    "nodes": [
      {
        "id": 15,
        "type": "node",
        "title": "水电隐蔽工程",
        "submitter_name": "张三",
        "photos_json": [...],
        "photo_count": 3,
        "hours_ago": 2.5
      }
    ],
    "materials": [
      {
        "id": 8,
        "type": "material",
        "title": "水泥 50吨",
        "submitter_name": "李四",
        "photos_json": [...],
        "photo_count": 3,
        "variance_percentage": 11.1,
        "needsAttention": true,
        "hours_ago": 1.2
      }
    ],
    "total": 2
  }
}
```

## 🎯 核心特性总结

### ✅ 做到的
1. **极简 API**：只有 15 个核心接口
2. **照片为王**：所有记录必须带照片（JSONB存储）
3. **自动卡点**：前置节点未确认，后续节点无法提交
4. **偏差预警**：材料数量偏差>10%自动标红
5. **统一格式**：所有响应使用相同的JSON结构
6. **角色分离**：boss 和 worker 权限清晰

### ❌ 不做的
1. **不处理图片**：所有水印在前端完成
2. **不复杂审批**：只有"待确认"和"已确认"两个状态
3. **不多余字段**：表结构只保留必要字段
4. **不过度封装**：使用 pg 原生驱动，不用 ORM

---

## 🚀 下一步：继续 Step 2

当你回复 **"继续 Step 2"** 后，我将输出：
1. Express 完整代码（app.js, server.js）
2. 核心 API 路由实现（node.routes.js, material.routes.js）
3. 业务逻辑 Service 层（node.service.js, material.service.js）
4. 中间件实现（auth.js, role.js, error.js）
5. Multer 文件上传配置

所有代码将包含详细的中文注释和错误处理。

---

**当前进度**: ✅ Step 1 完成 | ⏳ Step 2 待命
