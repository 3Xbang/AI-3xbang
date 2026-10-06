# Windows PowerShell 脚本 - 自动部署后端到 AWS
# 使用方法：在 PowerShell 中运行 .\deploy-backend.ps1

$SERVER_IP = "18.206.11.7"
$SSH_KEY = "D:\下载\3xbang.pem"
$SSH_USER = "ubuntu"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  部署后端到 winaii.com" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 1. 进入后端目录
Write-Host "[1/4] 进入后端目录..." -ForegroundColor Yellow
Set-Location "E:\3XBANG\backend"

# 2. 打包后端（排除 node_modules）
Write-Host "[2/4] 打包后端代码..." -ForegroundColor Yellow
if (Test-Path "backend.tar.gz") {
    Remove-Item "backend.tar.gz"
}

# 使用 tar 命令（Windows 10 1803+ 自带）
tar -czf backend.tar.gz --exclude=node_modules *

# 3. 上传到服务器
Write-Host "[3/4] 上传到服务器..." -ForegroundColor Yellow
scp -i $SSH_KEY backend.tar.gz "${SSH_USER}@${SERVER_IP}:~/backend/"

# 4. 在服务器上解压并重启
Write-Host "[4/4] 解压并重启服务..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${SSH_USER}@${SERVER_IP}" @"
cd ~/backend
tar -xzf backend.tar.gz
npm install --production
pm2 restart construction-api
pm2 status
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "  ✅ 部署成功！" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "后端已重启，API 地址：" -ForegroundColor Cyan
    Write-Host "  http://${SERVER_IP}/api" -ForegroundColor White
    Write-Host "  http://winaii.com/api (DNS 生效后)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Red
    Write-Host "  ❌ 部署失败！" -ForegroundColor Red
    Write-Host "================================" -ForegroundColor Red
    Write-Host ""
}

# 清理临时文件
Remove-Item "backend.tar.gz" -ErrorAction SilentlyContinue

# 回到项目根目录
Set-Location "E:\3XBANG"
