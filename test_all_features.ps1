# 测试系统所有功能
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开始测试极简版施工管理系统所有功能" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://18.206.11.7:3001/api"
$token = ""

# 测试 1: 登录
Write-Host "【测试 1】用户登录..." -ForegroundColor Yellow
try {
    $loginBody = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    
    if ($response.success) {
        $token = $response.data.token
        Write-Host "✅ 登录成功！Token: $($token.Substring(0,20))..." -ForegroundColor Green
    } else {
        Write-Host "❌ 登录失败: $($response.message)" -ForegroundColor Red
        exit
    }
} catch {
    Write-Host "❌ 登录请求失败: $_" -ForegroundColor Red
    exit
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 测试 2: 获取项目列表
Write-Host "`n【测试 2】获取项目列表..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/projects" -Method Get -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 获取成功！共 $($response.data.Count) 个项目" -ForegroundColor Green
        if ($response.data.Count -gt 0) {
            $projectId = $response.data[0].id
            Write-Host "   第一个项目 ID: $projectId" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ 获取项目列表失败: $_" -ForegroundColor Red
}

# 测试 3: 创建新项目（如果没有项目）
if ($response.data.Count -eq 0) {
    Write-Host "`n【测试 3】创建新项目..." -ForegroundColor Yellow
    try {
        $projectBody = @{
            name = @{
                zh = "测试别墅项目"
                th = "โครงการทดสอบวิลล่า"
            } | ConvertTo-Json
            location = @{
                zh = "曼谷"
                th = "กรุงเทพ"
            } | ConvertTo-Json
            client_name = "Test Client"
            start_date = "2024-01-15"
            planned_end_date = "2024-06-15"
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$baseUrl/projects" -Method Post -Body $projectBody -Headers $headers
        
        if ($response.success) {
            $projectId = $response.data.id
            Write-Host "✅ 项目创建成功！ID: $projectId" -ForegroundColor Green
            Write-Host "   $($response.message)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ 创建项目失败: $_" -ForegroundColor Red
    }
}

# 测试 4: 获取工序列表
Write-Host "`n【测试 4】获取工序列表..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/processes" -Method Get -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 获取成功！共 $($response.data.Count) 个工序" -ForegroundColor Green
        
        # 显示前3个工序
        Write-Host "   前3个工序:" -ForegroundColor Gray
        $response.data[0..2] | ForEach-Object {
            $name = ($_.process_name | ConvertFrom-Json).zh
            Write-Host "   - $($_.process_code): $name (状态: $($_.status))" -ForegroundColor Gray
        }
        
        $processId = $response.data[0].id
    }
} catch {
    Write-Host "❌ 获取工序列表失败: $_" -ForegroundColor Red
}

# 测试 5: 设置工程量
Write-Host "`n【测试 5】设置工程量..." -ForegroundColor Yellow
try {
    $quantityBody = @{
        quantities = @{
            "N01_EXCAVATION" = 100
            "N02_FOUNDATION" = 300
            "N03_STRUCTURE" = 500
        }
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/set-quantities" -Method Post -Body $quantityBody -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 工程量设置成功！" -ForegroundColor Green
        Write-Host "   $($response.message)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ 设置工程量失败: $_" -ForegroundColor Red
}

# 测试 6: 获取工程量
Write-Host "`n【测试 6】获取工程量..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/quantities" -Method Get -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 获取成功！" -ForegroundColor Green
        $response.data[0..2] | ForEach-Object {
            $name = ($_.process_name | ConvertFrom-Json).zh
            Write-Host "   - $name: $($_.planned_quantity) $($_.unit)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ 获取工程量失败: $_" -ForegroundColor Red
}

# 测试 7: 更新工序状态
Write-Host "`n【测试 7】开始工序（not_started -> in_progress）..." -ForegroundColor Yellow
try {
    $statusBody = @{
        status = "in_progress"
        actual_start_date = "2024-01-15"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/processes/$processId" -Method Put -Body $statusBody -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 工序状态更新成功！" -ForegroundColor Green
        Write-Host "   状态: $($response.data.status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ 更新工序状态失败: $_" -ForegroundColor Red
}

# 测试 8: 获取子任务模板
Write-Host "`n【测试 8】获取子任务模板..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/process-execution/$processId/subtask-templates" -Method Get -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 获取成功！共 $($response.data.templates.Count) 个子任务模板" -ForegroundColor Green
        Write-Host "   工序代码: $($response.data.process_code)" -ForegroundColor Gray
        $response.data.templates[0..2] | ForEach-Object {
            $name = $_.name.zh
            Write-Host "   - $name ($($_.typical_percentage)%)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ 获取子任务模板失败: $_" -ForegroundColor Red
}

# 测试 9: 批量创建子任务
Write-Host "`n【测试 9】批量创建子任务..." -ForegroundColor Yellow
try {
    $subtaskBody = @{
        selectedSubtasks = @(0, 1, 2)
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/process-execution/$processId/subtasks/batch" -Method Post -Body $subtaskBody -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 子任务创建成功！" -ForegroundColor Green
        Write-Host "   $($response.message)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ 创建子任务失败: $_" -ForegroundColor Red
}

# 测试 10: 获取子任务列表
Write-Host "`n【测试 10】获取子任务列表..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/process-execution/$processId/subtasks" -Method Get -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ 获取成功！共 $($response.data.Count) 个子任务" -ForegroundColor Green
        $response.data | ForEach-Object {
            $name = ($_.subtask_name | ConvertFrom-Json).zh
            Write-Host "   - $name: $($_.planned_quantity) $($_.quantity_unit) (状态: $($_.status))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ 获取子任务列表失败: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
