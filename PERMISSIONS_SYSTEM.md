# 三角色权限系统实施文档

## 概述
已成功实施基于三种角色的权限控制系统，分别为：管理者（甲方代表）、采购者（乙方代表）、执行者（工人）。

## 角色定义

### 1. Manager（管理者/甲方代表）
- **权限范围**：完全权限
- **可执行操作**：
  - 查看所有项目
  - 创建/更新/删除项目
  - 创建/更新/删除用户
  - 分配用户到项目
  - 采购材料
  - 分配任务
  - 更新进度
  - 上传照片

### 2. Purchaser（采购者/乙方代表）
- **权限范围**：有限管理权限
- **可执行操作**：
  - 查看分配的项目
  - 创建项目
  - 采购材料
  - 分配任务给执行者
  - 更新进度
  - 上传照片

### 3. Executor（执行者/工人）
- **权限范围**：仅执行权限
- **可执行操作**：
  - 查看分配的项目
  - 更新进度
  - 上传照片

## 技术实现

### 文件结构
```
backend/src/
├── middleware-permissions.js    # 权限中间件
├── routes.js                   # 更新后的路由（含权限检查）
└── config/db.js                # 数据库连接
```

### 数据库表

#### 1. users 表（已更新）
```sql
- role VARCHAR(20)           -- 角色：manager/purchaser/executor
- full_name VARCHAR(100)     -- 全名
```

#### 2. project_members 表（新增）
```sql
- id SERIAL PRIMARY KEY
- project_id INTEGER         -- 项目ID
- user_id INTEGER            -- 用户ID
- role VARCHAR(20)           -- 项目中的角色
- assigned_by INTEGER        -- 分配人ID
- assigned_at TIMESTAMP      -- 分配时间
```

#### 3. task_assignments 表（新增）
```sql
- id SERIAL PRIMARY KEY
- process_execution_id INTEGER  -- 工序执行ID
- assigned_to INTEGER           -- 被分配人ID
- assigned_by INTEGER           -- 分配人ID
- assigned_at TIMESTAMP         -- 分配时间
```

#### 4. activity_logs 表（新增）
```sql
- id SERIAL PRIMARY KEY
- user_id INTEGER            -- 操作用户ID
- action VARCHAR(50)         -- 操作类型
- target_type VARCHAR(50)    -- 目标类型
- target_id INTEGER          -- 目标ID
- details TEXT               -- 详情
- created_at TIMESTAMP       -- 创建时间
```

### 权限矩阵

| 权限 | Manager | Purchaser | Executor |
|------|---------|-----------|----------|
| view_all_projects | ✓ | ✗ | ✗ |
| view_assigned_projects | ✓ | ✓ | ✓ |
| create_project | ✓ | ✓ | ✗ |
| update_project | ✓ | ✗ | ✗ |
| delete_project | ✓ | ✗ | ✗ |
| purchase_material | ✓ | ✓ | ✗ |
| assign_task | ✓ | ✓ | ✗ |
| update_progress | ✓ | ✓ | ✓ |
| manage_users | ✓ | ✗ | ✗ |
| view_all_data | ✓ | ✗ | ✗ |

### 中间件函数

#### 1. `requirePermission(permission)`
检查用户是否具有特定权限。

**使用示例**：
```javascript
router.post('/projects', authenticate, requirePermission('create_project'), async (req, res) => {
  // 只有 manager 和 purchaser 可以访问
});
```

#### 2. `requireProjectAccess()`
检查用户是否有权访问特定项目。

**使用示例**：
```javascript
router.get('/projects/:projectId/processes', authenticate, requireProjectAccess(), async (req, res) => {
  // 管理者可以访问所有项目，其他角色只能访问分配给自己的项目
});
```

#### 3. `checkProjectAccess(client, userId, userRole, projectId)`
在事务中检查项目访问权限的辅助函数。

**使用示例**：
```javascript
const hasAccess = await checkProjectAccess(client, req.user.id, req.user.role, project_id);
if (!hasAccess) {
  return res.status(403).json({ success: false, message: '无权访问此项目' });
}
```

#### 4. `logActivity(client, userId, action, targetType, targetId, details)`
记录用户操作日志。

**使用示例**：
```javascript
await logActivity(client, req.user.id, 'create_project', 'projects', project.id, 
  `创建项目: ${name}`);
```

### 已更新的API路由

#### 项目相关
- `GET /api/projects` - 按角色过滤项目列表
- `POST /api/projects` - 创建项目（需要 create_project 权限）
- `GET /api/projects/:id/summary` - 项目概览（需要项目访问权限）
- `GET /api/projects/:projectId/processes` - 项目工序列表（需要项目访问权限）
- `POST /api/projects/:projectId/processes` - 分配工序任务（需要 assign_task 权限）

#### 材料相关
- `GET /api/projects/:projectId/materials` - 项目材料列表（需要项目访问权限）
- `POST /api/materials` - 采购材料（需要 purchase_material 权限 + 项目访问权限）
- `POST /api/materials/:id/receive` - 确认收货（需要项目访问权限）
- `POST /api/materials/:id/use` - 使用材料（需要项目访问权限）

#### 工序相关
- `PUT /api/processes/:id` - 更新工序状态（需要项目访问权限）

#### 照片相关
- `POST /api/photos/upload` - 上传照片（需要项目访问权限）

#### 用户管理相关
- `GET /api/users` - 获取所有用户（需要 manage_users 权限）
- `POST /api/users` - 创建用户（需要 manage_users 权限）
- `PUT /api/users/:id` - 更新用户（需要 manage_users 权限）
- `DELETE /api/users/:id` - 删除用户（需要 manage_users 权限）

#### 项目成员管理
- `GET /api/projects/:projectId/members` - 获取项目成员（需要项目访问权限）
- `POST /api/projects/:projectId/members` - 添加项目成员（需要 manage_users 权限）
- `DELETE /api/projects/:projectId/members/:userId` - 移除项目成员（需要 manage_users 权限）

#### 任务分配
- `POST /api/tasks/assign` - 分配任务（需要 assign_task 权限）
- `GET /api/tasks/my-tasks` - 获取我的任务

#### 每日任务和工程量
- `GET /api/projects/:projectId/daily-tasks` - 获取今日任务（需要项目访问权限）
- `POST /api/projects/:projectId/set-quantities` - 设置工程量（需要 assign_task 权限）
- `GET /api/projects/:projectId/quantities` - 获取工程量（需要项目访问权限）

## 部署状态

### 数据库
✅ 数据库schema已更新（add_role_permissions.sql已执行）
✅ admin用户已更新为manager角色

### 后端
✅ middleware-permissions.js已创建并上传
✅ routes.js已更新所有权限检查
✅ PM2服务已重启
✅ API服务正常运行在 http://18.206.11.7:3001

### Git
✅ 所有更改已提交 (commit: b48d696)

## 下一步工作

### 前端开发
1. **用户管理界面**
   - 创建用户表单（用户名、密码、全名、角色）
   - 用户列表展示
   - 编辑/删除用户功能

2. **项目成员管理界面**
   - 为项目分配成员
   - 查看项目成员列表
   - 移除项目成员

3. **任务分配界面**
   - 为工序分配执行者
   - 查看任务分配状态

4. **权限相关UI更新**
   - 根据用户角色显示/隐藏功能按钮
   - 采购按钮（仅manager和purchaser可见）
   - 分配任务按钮（仅manager和purchaser可见）
   - 用户管理入口（仅manager可见）

5. **i18n翻译**
   - 添加权限相关的中泰双语翻译
   - 角色名称翻译
   - 错误提示翻译

### 测试计划
1. 测试三种角色的登录
2. 测试manager的完全权限
3. 测试purchaser的采购和分配权限
4. 测试executor的只读和更新进度权限
5. 测试项目访问控制
6. 测试操作日志记录

## 注意事项

1. **初始用户创建**：需要管理员手动在数据库中创建初始10个用户，并分配角色
2. **密码安全**：所有密码使用bcrypt加密存储
3. **JWT认证**：token中包含用户ID、用户名和角色信息
4. **操作日志**：所有重要操作都会记录到activity_logs表
5. **项目访问控制**：非管理者用户只能访问分配给他们的项目

## API测试示例

### 登录
```bash
curl -X POST http://18.206.11.7/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123456"}'
```

### 获取项目列表（需要token）
```bash
curl -X GET http://18.206.11.7/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 创建项目（需要create_project权限）
```bash
curl -X POST http://18.206.11.7/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试项目",
    "location": "北京",
    "client_name": "客户A",
    "start_date": "2024-01-01",
    "planned_end_date": "2024-12-31"
  }'
```

### 采购材料（需要purchase_material权限）
```bash
curl -X POST http://18.206.11.7/api/materials \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "material_code": "MAT001",
    "material_name": {"zh": "水泥", "th": "ปูนซีเมนต์"},
    "unit": {"zh": "吨", "th": "ตัน"},
    "purchase_quantity": 10,
    "unit_price": 350,
    "supplier": "供应商A",
    "expected_arrival_date": "2024-02-01"
  }'
```
