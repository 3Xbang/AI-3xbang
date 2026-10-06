# Windows PowerShell 脚本 - 自动部署前端到 AWS
# 使用方法：在 PowerShell 中运行 .\deploy-frontend.ps1

$SERVER_IP = "18.206.11.7"
$SSH_KEY = "D:\下载\3xbang.pem"
$SSH_USER = "ubuntu"
$REMOTE_PATH = "/var/www/winaii.com/"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  部署前端到 winaii.com" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 1. 进入前端目录
Write-Host "[1/4] 进入前端目录..." -ForegroundColor Yellow
Set-Location "E:\3XBANG\frontend-mobile"

# 2. 安装依赖（如果 node_modules 不存在）
if (-not (Test-Path "node_modules")) {
    Write-Host "[2/4] 安装依赖..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "[2/4] 依赖已存在，跳过安装" -ForegroundColor Green
}

# 3. 构建生产版本
Write-Host "[3/4] 构建生产版本..." -ForegroundColor Yellow
npm run build:h5

# 4. 上传到服务器
Write-Host "[4/4] 上传到服务器..." -ForegroundColor Yellow
Set-Location "dist\build\h5"

# 使用 scp 上传
scp -i $SSH_KEY -r * "${SSH_USER}@${SERVER_IP}:${REMOTE_PATH}"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "  ✅ 部署成功！" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "访问地址：" -ForegroundColor Cyan
    Write-Host "  http://${SERVER_IP}" -ForegroundColor White
    Write-Host "  http://winaii.com (DNS 生效后)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Red
    Write-Host "  ❌ 部署失败！" -ForegroundColor Red
    Write-Host "================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查：" -ForegroundColor Yellow
    Write-Host "  1. 密钥文件路径是否正确" -ForegroundColor White
    Write-Host "  2. 服务器 IP 是否正确" -ForegroundColor White
    Write-Host "  3. 网络连接是否正常" -ForegroundColor White
}

# 回到项目根目录
Set-Location "E:\3XBANG"
