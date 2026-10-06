# 极简工程项目管理系统 - 后端 API

## 快速开始

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置环境变量
复制 `.env.example` 为 `.env`，并修改配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=construction_simple
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your-super-secret-key-change-this
```

### 3. 初始化数据库
```bash
# 连接 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE construction_simple;

# 执行建表脚本
\c construction_simple
\i ../docs/simple-database-schema.sql
```

### 4. 启动服务器
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 启动。

## API 接口文档

### 认证相关

#### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "boss",
  "password": "Admin@123"
}

响应：
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": {
      "id": 1,
      "username": "boss",
      "fullName": "老板",
      "role": "boss"
    }
  }
}
```

#### 获取当前用户信息
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 节点打卡

#### 提交节点打卡
```http
POST /api/nodes/submit
Authorization: Bearer <token>
Content-Type: multipart/form-data

参数：
- nodeId: 6 (工序节点ID)
- photos: [file1, file2, file3] (至少3张照片)
- watermarkInfo: {"gps": {...}, "timestamp": "..."} (水印信息JSON)
- workDescription: "主卧水电管线安装完成" (可选，工作说明)
- notes: "备注" (可选)
```

#### 获取我的任务列表
```http
GET /api/nodes/my-tasks
Authorization: Bearer <token>
```

#### 获取待确认的节点列表（老板用）
```http
GET /api/nodes/pending
Authorization: Bearer <token>
```

#### 确认节点（老板用）
```http
PUT /api/nodes/:id/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "approve",  // 或 "reject"
  "rejectionReason": "照片不清晰" // action为reject时必填
}
```

### 材料进场

#### 提交材料进场
```http
POST /api/materials/submit
Authorization: Bearer <token>
Content-Type: multipart/form-data

参数：
- materialName: "水泥"
- quantity: 50
- unit: "吨"
- plannedQuantity: 45 (可选，计划数量)
- photos: [file1, file2, file3] (至少3张照片)
- watermarkInfo: {...} (水印信息JSON)
- supplierName: "苏梅建材公司" (可选)
- deliveryPerson: "阿明" (可选)
- qualityNotes: "水泥袋完好无破损" (可选)
```

#### 获取待确认的材料列表（老板用）
```http
GET /api/materials/pending
Authorization: Bearer <token>
```

#### 确认材料（老板用）
```http
PUT /api/materials/:id/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "approve",  // 或 "reject"
  "rejectionReason": "数量不符" // action为reject时必填
}
```

### 异常上报

#### 提交异常上报
```http
POST /api/issues/submit
Authorization: Bearer <token>
Content-Type: multipart/form-data

参数：
- issueTitle: "钢筋数量不足"
- issueDescription: "今天需要12mm钢筋300kg，但仓库只剩150kg"
- photos: [file1, file2] (可选)
- voiceText: "语音转文字内容" (可选)
```

#### 获取异常列表
```http
GET /api/issues/list?status=pending
Authorization: Bearer <token>
```

#### 老板回复异常
```http
PUT /api/issues/:id/reply
Authorization: Bearer <token>
Content-Type: application/json

{
  "reply": "已联系供应商，明天上午送到"
}
```

### 待确认列表（汇总）

#### 获取所有待确认项
```http
GET /api/pending/all
Authorization: Bearer <token>

响应：
{
  "success": true,
  "data": {
    "nodes": [...],      // 待确认的节点
    "materials": [...],  // 待确认的材料
    "all": [...],        // 全部待确认项（合并+排序）
    "total": 5,
    "nodeCount": 2,
    "materialCount": 3
  }
}
```

## 测试账户

### 老板账户
```
用户名: boss
密码: Admin@123
角色: boss
```

### 工人账户
```
用户名: zhangsan
密码: Worker@123
角色: worker

用户名: lisi
密码: Worker@123
角色: worker
```

## 项目结构

```
backend/
├── src/
│   ├── config/          # 配置文件
│   ├── middlewares/     # 中间件
│   ├── services/        # 业务逻辑层
│   ├── controllers/     # 控制器层
│   ├── routes/          # 路由定义
│   ├── utils/           # 工具函数
│   ├── app.js           # Express 应用
│   └── server.js        # 启动入口
├── uploads/             # 文件上传目录
├── .env                 # 环境变量
├── package.json
└── README.md
```

## 核心特性

✅ **极简 API**：只有 15 个核心接口  
✅ **照片为王**：所有记录必须带照片（JSONB存储）  
✅ **自动卡点**：前置节点未确认，后续节点无法提交  
✅ **偏差预警**：材料数量偏差>10%自动标红  
✅ **统一格式**：所有响应使用相同的JSON结构  
✅ **角色分离**：boss 和 worker 权限清晰  

## 性能优化

- 连接池最大连接数：10（适配 AWS t2.micro 1G 内存）
- Node.js 启动参数：`--max-old-space-size=768`
- 严禁后端处理图片（所有水印在前端完成）
- JSONB 字段存储照片元数据

## 故障排查

### 数据库连接失败
```bash
# 检查 PostgreSQL 服务状态
sudo systemctl status postgresql

# 检查数据库是否存在
psql -U postgres -l

# 测试连接
psql -U postgres -d construction_simple
```

### 文件上传失败
```bash
# 检查上传目录权限
ls -la uploads/

# 创建上传目录
mkdir -p uploads/{nodes,materials,issues}
```

### 端口被占用
```bash
# 查看端口占用
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或者修改 .env 中的 PORT 配置
```

## 开发建议

1. 使用 `npm run dev` 开发时，nodemon 会自动重启
2. 查看日志：所有请求都会打印到控制台
3. 测试 API：使用 Postman 或 curl
4. 前端联调：确保 CORS 配置正确

---

**当前版本**: v1.0.0  
**最后更新**: 2024-01-15
