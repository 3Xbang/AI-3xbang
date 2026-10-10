# 权限系统指南 / Permission System Guide

## 概述 / Overview

本系统实现了基于角色的权限控制（RBAC），共有3种角色：
- **管理者 (Manager)**: 完全权限
- **采购者 (Purchaser)**: 材料采购、任务分配权限
- **执行者 (Executor)**: 只能查看分配给自己的任务并更新进度

This system implements Role-Based Access Control (RBAC) with 3 roles:
- **Manager**: Full permissions
- **Purchaser**: Material purchasing and task assignment permissions
- **Executor**: Can only view assigned tasks and update progress

---

## 权限矩阵 / Permission Matrix

| 功能 Feature | 管理者 Manager | 采购者 Purchaser | 执行者 Executor |
|-------------|---------------|-----------------|----------------|
| 用户管理 User Management | ✅ | ❌ | ❌ |
| 创建项目 Create Projects | ✅ | ❌ | ❌ |
| 管理项目成员 Manage Project Members | ✅ | ❌ | ❌ |
| 采购材料 Purchase Materials | ✅ | ✅ | ❌ |
| 分配任务 Assign Tasks | ✅ | ✅ | ❌ |
| 查看所有项目 View All Projects | ✅ | ✅ | ❌ |
| 查看分配的项目 View Assigned Projects | ✅ | ✅ | ✅ |
| 更新工序进度 Update Process Progress | ✅ | ✅ | ✅ |
| 上传现场照片 Upload Photos | ✅ | ✅ | ✅ |
| 查看今日任务 View Daily Tasks | ✅ | ✅ | ✅ |
| 管理子任务 Manage Subtasks | ✅ | ✅ | ✅ |

---

## 实现细节 / Implementation Details

### 1. 前端权限检查 / Frontend Permission Checks

#### PermissionManager 模块
位置：`frontend/js/permissions.js`

核心方法：
```javascript
// 角色检查
PermissionManager.isManager()
PermissionManager.isPurchaser()
PermissionManager.isExecutor()

// 功能权限检查
PermissionManager.canManageUsers()
PermissionManager.canManageProjects()
PermissionManager.canPurchaseMaterials()
PermissionManager.canAssignTasks()

// UI控制
PermissionManager.toggleElementByPermission(elementId, hasPermission)
PermissionManager.showPermissionDenied(message)
```

#### 应用示例 / Usage Examples

**隐藏按钮：**
```javascript
// 只有管理者可以看到"新建项目"按钮
const canManage = PermissionManager.canManageProjects();
if (!canManage) {
    document.getElementById('btn-add-project').style.display = 'none';
}
```

**运行时检查：**
```javascript
showProjectForm() {
    if (!PermissionManager.canManageProjects()) {
        PermissionManager.showPermissionDenied();
        return;
    }
    // 显示表单...
}
```

---

### 2. 后端权限验证 / Backend Permission Verification

#### Middleware
位置：`backend/src/middleware-permissions.js`

核心方法：
```javascript
// 检查特定权限
requirePermission('manage_users')
requirePermission('purchase_materials')
requirePermission('assign_tasks')

// 检查项目访问权限
requireProjectAccess()
```

#### API路由保护 / Protected API Routes

**用户管理：**
```javascript
router.get('/api/users', requirePermission('manage_users'), async (req, res) => {
    // 只有管理者可以访问
});
```

**材料采购：**
```javascript
router.post('/api/materials/purchase', requirePermission('purchase_materials'), async (req, res) => {
    // 管理者和采购者可以访问
});
```

**任务分配：**
```javascript
router.post('/api/tasks/assign', requirePermission('assign_tasks'), async (req, res) => {
    // 管理者和采购者可以访问
});
```

---

### 3. UI自适应 / UI Adaptation

#### 页面加载时初始化
```javascript
app.loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roleDisplay = PermissionManager.getRoleDisplayName(user.role);
    document.getElementById('user-name').textContent = `${user.full_name} (${roleDisplay})`;
    
    // 初始化页面权限
    PermissionManager.initializePagePermissions();
}
```

#### 动态渲染内容
```javascript
renderProjects(projects) {
    const canManageMembers = PermissionManager.canManageProjectMembers();
    
    container.innerHTML = projects.map(project => `
        <div class="project-card">
            <!-- 项目信息 -->
            ${canManageMembers ? `
                <button onclick="projectMembers.showMembersModal(...)">
                    👥 成员管理
                </button>
            ` : ''}
        </div>
    `).join('');
}
```

---

## 权限角色说明 / Role Descriptions

### 管理者 (Manager) - 项目经理
- 创建和管理项目
- 管理所有用户账号
- 分配用户到项目
- 采购材料
- 分配任务给执行者
- 查看所有数据和报表

### 采购者 (Purchaser) - 采购员
- 查看所有项目
- 采购和管理材料
- 分配任务给执行者
- 更新工序进度
- 不能管理用户和项目

### 执行者 (Executor) - 工人/施工员
- 只能查看分配给自己的项目
- 只能查看分配给自己的任务
- 更新工序进度
- 上传现场照片
- 不能采购材料或分配任务

---

## 权限测试场景 / Permission Testing Scenarios

### 场景1：管理者登录
1. 可以看到"用户管理"菜单
2. 项目列表显示"成员管理"按钮
3. 工序页面显示"分配任务"按钮
4. 材料页面显示"采购材料"按钮

### 场景2：采购者登录
1. 不显示"用户管理"菜单
2. 项目列表不显示"成员管理"按钮
3. 工序页面显示"分配任务"按钮 ✅
4. 材料页面显示"采购材料"按钮 ✅

### 场景3：执行者登录
1. 不显示"用户管理"菜单
2. 只显示分配给自己的项目
3. 工序页面不显示"分配任务"按钮
4. 材料页面不显示"采购材料"按钮
5. 可以更新进度和上传照片

---

## API错误处理 / API Error Handling

当用户尝试访问无权限的API时，系统返回：

```json
{
    "success": false,
    "message": "没有权限执行此操作 / No permission"
}
```

HTTP状态码：`403 Forbidden`

前端会自动显示错误提示：
- 中文：抱歉，您没有权限执行此操作
- 泰语：ขออภัย คุณไม่มีสิทธิ์ในการดำเนินการนี้

---

## 安全建议 / Security Recommendations

1. **双重验证**：前端UI控制 + 后端API验证
2. **最小权限原则**：用户只能访问必需的功能
3. **审计日志**：所有敏感操作记录在 activity_logs 表
4. **会话管理**：JWT Token 有效期控制
5. **防止枚举**：统一的错误消息，不泄露系统信息

---

## 开发者注意事项 / Developer Notes

### 添加新功能时的权限检查清单

1. ✅ 确定功能需要哪些角色访问
2. ✅ 在 PermissionManager 添加权限检查方法
3. ✅ 在 middleware-permissions.js 添加后端验证
4. ✅ 在前端页面添加UI控制
5. ✅ 在API路由添加权限中间件
6. ✅ 添加国际化翻译
7. ✅ 编写测试用例

### 常见错误

❌ **只做前端控制**
```javascript
// 不安全！用户可以通过浏览器开发工具绕过
if (user.role === 'manager') {
    showButton();
}
```

✅ **正确做法：前端+后端双重验证**
```javascript
// 前端：隐藏按钮
if (!PermissionManager.canManageUsers()) {
    button.style.display = 'none';
}

// 后端：API验证
router.post('/api/users', requirePermission('manage_users'), handler);
```

---

## 更新日志 / Changelog

### 2024-01-XX: Priority 4 完成
- ✅ 创建 PermissionManager 模块
- ✅ 统一所有页面的权限检查
- ✅ 添加角色显示在用户名旁边
- ✅ 优化按钮显示/隐藏逻辑
- ✅ 添加权限拒绝友好提示
- ✅ 中文/泰语双语支持

---

## 联系与支持 / Contact & Support

如有权限相关问题，请检查：
1. 用户角色是否正确分配
2. 浏览器控制台是否有错误
3. 后端日志是否记录权限拒绝
4. activity_logs 表查看操作历史

For permission-related issues, please check:
1. User role assignment
2. Browser console for errors
3. Backend logs for permission denials
4. activity_logs table for operation history
