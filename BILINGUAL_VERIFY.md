# 双语系统验证指南

## 本地验证 ✅

已完成的修改：
1. ✅ `frontend/js/i18n.js` - 所有翻译改为双语格式
2. ✅ `frontend/js/process-enhancements.js` - BilingualTexts 定义
3. ✅ `frontend/js/material-manager-simple.js` - MaterialTexts 定义
4. ✅ `frontend/index.html` - v=19

## 服务器部署步骤

```bash
# 1. 进入项目目录
cd /home/ubuntu/construction

# 2. 拉取最新代码
git pull

# 3. 验证版本
git log -1 --oneline
# 应该看到: 8cc27d9 完整的中泰双语系统

# 4. 检查关键文件
head -20 frontend/js/i18n.js
# 应该看到: const translations = { 开头，包含双语文本

head -20 frontend/js/process-enhancements.js  
# 应该看到: const BilingualTexts = { 开头

# 5. 检查版本号
grep "v=" frontend/index.html | head -1
# 应该看到: v=19

# 6. 重启服务
sudo systemctl restart construction

# 7. 确认服务状态
sudo systemctl status construction
```

## 浏览器测试

1. **完全清除缓存：**
   - Chrome: Ctrl + Shift + Delete → 清除"缓存的图像和文件"
   - 或者打开隐身模式（Ctrl + Shift + N）

2. **验证加载的版本：**
   - 按 F12 打开开发者工具
   - 点击 Network 标签
   - 刷新页面
   - 查找 `i18n.js?v=19` - 点击查看内容
   - 应该看到 `translations = {` 开头的双语文本

3. **验证显示效果：**
   应该看到以下双语文本：
   - 导航栏：`项目管理 จัดการโครงการ`
   - 标签页：`工序进度 ความคืบหน้างาน`
   - 按钮：`保存 บันทึก`、`取消 ยกเลิก`
   - 统计：`总工序数 จำนวนงานทั้งหมด`

## 预期效果截图标记

请检查以下位置是否显示双语：

1. 顶部导航菜单
2. 项目概览页的统计卡片
3. 工序页面的所有按钮
4. 材料页面的标签
5. 表单中的按钮和标签

如果某些地方还是单语，说明那个组件可能没有使用 t() 函数或 BilingualTexts。
