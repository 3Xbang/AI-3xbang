# 子任务功能测试清单
## Subtasks Feature Testing Checklist

## ✅ 部署状态
- [x] 前端文件已部署到 /var/www/construction/
- [x] 后端API已重启并运行正常
- [x] 数据库表 process_subtasks 已创建
- [x] API路由已添加到 routes.js

## 🧪 手动测试步骤

### 1. 登录系统
```
URL: http://18.206.11.7
用户名: admin
密码: admin123
```

### 2. 选择项目
- 在今日任务页面选择一个项目
- 应该能看到该项目的工序任务

### 3. 测试查看子任务
- 找到任意一个工序任务卡片
- 点击 **"查看子任务"** 按钮（灰色）
- 应该弹出子任务管理窗口
- 如果是新工序，应显示"暂无子任务"

### 4. 测试添加子任务
在子任务窗口中：
- 点击 **"+ 添加子任务"** 按钮
- 填写表单：
  - 中文名称: "东侧基础挖掘"
  - 泰文名称: "ขุดฐานรากด้านตะวันออก"
  - 描述（可选）: "深度2米，长度10米"
  - 预计数量: 200
  - 单位: 立方米 (cbm)
- 点击保存
- 应该看到新子任务出现在列表中

### 5. 测试更新子任务进度
- 找到刚创建的子任务
- 点击 **"更新进度"** 按钮
- 填写实际完成数量: 50
- 添加备注: "今天完成东侧一半"
- 点击保存
- 应该看到：
  - 子任务进度变为 25% (50/200)
  - 进度条显示蓝色
  - 状态变为"进行中"

### 6. 测试继续更新进度
- 再次点击 **"更新进度"**
- 将实际完成数量改为 200
- 点击保存
- 应该看到：
  - 子任务进度变为 100%
  - 进度条变为绿色
  - 状态变为"已完成"

### 7. 测试标记完成按钮
- 添加第二个子任务 "西侧基础挖掘" 150立方米
- 不更新进度，直接点击 **"标记完成"** 按钮
- 确认操作
- 应该看到：
  - 该子任务立即变为100%完成
  - actual_quantity 自动设置为 estimated_quantity

### 8. 测试父工序进度汇总
- 关闭子任务窗口
- 返回今日任务列表
- 检查该工序的总进度
- 应该自动更新为所有子任务的平均完成度

### 9. 测试中泰语言切换
- 点击页面右上角的语言切换按钮
- 切换到泰语 (ไทย)
- 所有界面文字应变为泰语
- 子任务名称应显示泰语版本
- 切换回中文，应显示中文版本

## 📊 预期结果

### API响应示例

#### 获取子任务列表
```json
GET /api/subtasks/:processExecutionId
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "process_execution_id": 1,
      "name": {"zh": "东侧基础挖掘", "th": "ขุดฐานรากด้านตะวันออก"},
      "description": {"zh": "深度2米", "th": "ลึก 2 เมตร"},
      "estimated_quantity": 200,
      "actual_quantity": 50,
      "unit": "cbm",
      "completion_percentage": 25,
      "status": "in_progress"
    }
  ]
}
```

#### 创建子任务
```json
POST /api/subtasks
Body: {
  "process_execution_id": 1,
  "name": {"zh": "东侧基础", "th": "ฐานรากตะวันออก"},
  "estimated_quantity": 200,
  "unit": "cbm"
}
Response: {
  "success": true,
  "message": "子任务创建成功",
  "data": { "id": 1, ... }
}
```

#### 更新子任务
```json
PUT /api/subtasks/:id
Body: {
  "actual_quantity": 50,
  "notes": {"zh": "今天完成一半"}
}
Response: {
  "success": true,
  "message": "子任务更新成功"
}
```

## 🐛 常见问题排查

### 问题1: 点击"查看子任务"没反应
- 检查浏览器控制台是否有JS错误
- 检查API调用是否成功 (F12 -> Network)
- 确认process_execution_id是否正确

### 问题2: 无法创建子任务
- 检查表单是否填写完整
- 检查API返回的错误信息
- 确认数据库连接正常

### 问题3: 进度不更新
- 检查父工序的 actual_quantity 是否正确
- 确认子任务的 estimated_quantity 不为0
- 查看后端日志: `pm2 logs construction-api`

### 问题4: 中泰语显示不正确
- 确认JSONB字段格式正确
- 检查i18n.js是否正确加载
- 清除浏览器缓存重试

## 🔍 调试命令

### 查看数据库中的子任务
```sql
SELECT 
  id,
  process_execution_id,
  name,
  estimated_quantity,
  actual_quantity,
  completion_percentage,
  status
FROM process_subtasks
ORDER BY created_at DESC
LIMIT 10;
```

### 查看API日志
```bash
ssh -i "C:\Users\ASUS\.ssh\3xbang.pem" ec2-user@18.206.11.7
pm2 logs construction-api --lines 50
```

### 测试API端点
```bash
# 健康检查
curl http://18.206.11.7/api/health

# 登录获取token
curl -X POST http://18.206.11.7/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 获取子任务（需要token）
curl http://18.206.11.7/api/subtasks/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## ✅ 测试完成标志
- [ ] 能成功登录系统
- [ ] 能查看工序的子任务列表
- [ ] 能成功添加新子任务
- [ ] 能更新子任务进度
- [ ] 能标记子任务完成
- [ ] 父工序进度正确汇总
- [ ] 中泰语言切换正常
- [ ] 所有操作都有成功提示

---

## 🎉 功能完成
如果以上所有测试都通过，说明子任务功能已成功实现并部署！

**下一步建议**:
1. 测试多个子任务的进度汇总
2. 测试删除子任务（如需要）
3. 添加更多单位类型
4. 优化UI体验
5. 添加子任务排序功能
