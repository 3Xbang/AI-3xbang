# 重置Project 10工序状态 - 手动执行指南

## 问题
SSH连接出现权限问题，无法自动执行重置命令。

## 解决方案
请手动登录服务器执行以下SQL命令：

### 方法1：直接执行SQL（推荐）
```bash
# 1. SSH登录服务器
ssh root@18.206.11.7

# 2. 执行重置命令
PGPASSWORD='Winaii2024Strong' psql -U construction_user -d construction_simple -c "UPDATE process_execution SET status = 'not_started', completion_percentage = 0, actual_start_date = NULL, actual_end_date = NULL WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id = 10);"

# 3. 验证结果
PGPASSWORD='Winaii2024Strong' psql -U construction_user -d construction_simple -c "SELECT status, COUNT(*) as count FROM process_execution WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id = 10) GROUP BY status ORDER BY status;"
```

### 方法2：使用SQL文件
```bash
# 1. 创建SQL文件
cat > /tmp/reset.sql << 'EOF'
UPDATE process_execution 
SET status = 'not_started', 
    completion_percentage = 0, 
    actual_start_date = NULL, 
    actual_end_date = NULL
WHERE process_node_id IN (
    SELECT id FROM process_nodes WHERE project_id = 10
);

SELECT status, COUNT(*) as count 
FROM process_execution 
WHERE process_node_id IN (SELECT id FROM process_nodes WHERE project_id = 10)
GROUP BY status 
ORDER BY status;
EOF

# 2. 执行SQL文件
PGPASSWORD='Winaii2024Strong' psql -U construction_user -d construction_simple -f /tmp/reset.sql
```

## 预期结果
```
UPDATE 65

 status      | count 
-------------+-------
 not_started |    65
```

所有65个工序应该都是 `not_started` 状态。

## 之后
执行完成后，刷新浏览器（Ctrl+Shift+R）即可看到新UI v2.0和全新的初始状态数据！
