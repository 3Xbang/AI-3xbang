#!/bin/bash
# 服务器文件检查脚本

echo "=========================================="
echo "检查服务器上的双语文件"
echo "=========================================="
echo ""

cd /home/ubuntu/construction

echo "1. 当前 Git 版本："
git log -1 --oneline
echo ""

echo "2. 检查 i18n.js 前20行（应该包含双语）："
head -20 frontend/js/i18n.js
echo ""

echo "3. 检查 process-enhancements.js 前20行（应该有 BilingualTexts）："
head -20 frontend/js/process-enhancements.js
echo ""

echo "4. 检查 index.html 中的版本号（应该是 v=19）："
grep -o 'i18n.js?v=[0-9]*' frontend/index.html | head -1
echo ""

echo "5. 验证 translations 对象："
grep -A 5 "const translations" frontend/js/i18n.js
echo ""

echo "6. 验证 BilingualTexts 对象："
grep -A 5 "const BilingualTexts" frontend/js/process-enhancements.js
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="
