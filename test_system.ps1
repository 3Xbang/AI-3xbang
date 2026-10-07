# 系统功能测试脚本
$baseUrl = "http://18.206.11.7"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "极简版施工管理系统 - 功能测试" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 1. 测试前端页面
Write-Host "[1/5] 测试前端页面..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ 前端页面访问正常" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ 前端页面访问失败: $_" -ForegroundColor Red
}

# 2. 测试健康检查
Write-Host "[2/5] 测试API健康检查..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health"
    if ($health.status -eq "ok") {
        Write-Host "  ✓ API运行正常: $($health.message)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ 健康检查失败: $_" -ForegroundColor Red
}

# 3. 测试登录
Write-Host "[3/5] 测试用户登录..." -ForegroundColor Yellow
try {
    $loginBody = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        $global:token = $loginResponse.data.token
        Write-Host "  ✓ 登录成功 - 用户: $($loginResponse.data.user.username)" -ForegroundColor Green
        Write-Host "  ✓ Token获取成功" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ 登录失败: $_" -ForegroundColor Red
    $global:token = $null
}

# 4. 测试获取项目列表
Write-Host "[4/5] 测试获取项目列表..." -ForegroundColor Yellow
if ($global:token) {
    try {
        $headers = @{
            Authorization = "Bearer $global:token"
        }
        
        $projects = Invoke-RestMethod -Uri "$baseUrl/api/projects" -Headers $headers
        
        if ($projects.success) {
            Write-Host "  ✓ 项目列表获取成功 - 共 $($projects.data.Count) 个项目" -ForegroundColor Green
            if ($projects.data.Count -eq 0) {
                Write-Host "  ℹ 提示: 当前没有项目数据，请在前端创建" -ForegroundColor Cyan
            }
        }
    } catch {
        Write-Host "  ✗ 获取项目列表失败: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  ⊘ 跳过（未登录）" -ForegroundColor Gray
}

# 5. 测试中泰双语访问
Write-Host "[5/5] 测试中泰双语支持..." -ForegroundColor Yellow
try {
    $frontendContent = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing
    
    if ($frontendContent.Content -match 'i18n\.js' -and $frontendContent.Content -match 'data-i18n') {
        Write-Host "  ✓ 双语支持已配置" -ForegroundColor Green
        
        # 检查是否包含泰语字符
        if ($frontendContent.Content -match 'ไทย') {
            Write-Host "  ✓ 泰语语言包已加载" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  ✗ 双语支持检查失败" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址: $baseUrl" -ForegroundColor White
Write-Host "默认账号: admin / admin123" -ForegroundColor White
Write-Host ""
Write-Host "下一步操作:" -ForegroundColor Yellow
Write-Host "  1. 在浏览器中打开 $baseUrl" -ForegroundColor White
Write-Host "  2. 使用 admin/admin123 登录" -ForegroundColor White
Write-Host "  3. 创建第一个项目" -ForegroundColor White
Write-Host "  4. 配置16个标准工序" -ForegroundColor White
Write-Host "  5. 添加材料和照片" -ForegroundColor White
Write-Host ""
