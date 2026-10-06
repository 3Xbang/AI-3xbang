# Windows PowerShell 脚本 - 快速连接到 AWS 服务器
# 使用方法：在 PowerShell 中运行 .\ssh-connect.ps1

$SERVER_IP = "18.206.11.7"
$SSH_KEY = "D:\下载\3xbang.pem"
$SSH_USER = "ubuntu"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  连接到 winaii.com 服务器" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "服务器 IP: $SERVER_IP" -ForegroundColor Green
Write-Host "用户名: $SSH_USER" -ForegroundColor Green
Write-Host ""
Write-Host "正在连接..." -ForegroundColor Yellow
Write-Host ""

ssh -i $SSH_KEY "${SSH_USER}@${SERVER_IP}"
