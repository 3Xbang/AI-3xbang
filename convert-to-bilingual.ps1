# 转换所有t()调用为硬编码双语文本
$bilingualMap = Get-Content "bilingual-map.json" -Raw | ConvertFrom-Json

# 扁平化映射为简单的key-value对
$flatMap = @{}

function Flatten-Object {
    param($obj, $prefix = "")
    
    foreach ($prop in $obj.PSObject.Properties) {
        $key = if ($prefix) { "$prefix.$($prop.Name)" } else { $prop.Name }
        
        if ($prop.Value -is [PSCustomObject]) {
            Flatten-Object $prop.Value $key
        } else {
            $flatMap[$key] = $prop.Value
        }
    }
}

Flatten-Object $bilingualMap

Write-Host "映射条目数: $($flatMap.Count)"
Write-Host "前10个映射:"
$flatMap.GetEnumerator() | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $($_.Key) => $($_.Value)"
}

# 获取所有需要处理的JS文件
$jsFiles = Get-ChildItem -Path "frontend\js" -Filter "*.js" -File

Write-Host "`n找到 $($jsFiles.Count) 个JS文件"

foreach ($file in $jsFiles) {
    Write-Host "`n处理: $($file.Name)"
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    $replacements = 0
    
    # 匹配所有 t('xxx') 和 t("xxx") 以及 i18n.t('xxx') 和 i18n.t("xxx")
    $patterns = @(
        'i18n\.t\([''"]([^''"]+)[''"]\)',
        '\bt\([''"]([^''"]+)[''"]\)'
    )
    
    foreach ($pattern in $patterns) {
        $matches = [regex]::Matches($content, $pattern)
        Write-Host "  找到 $($matches.Count) 个匹配 (模式: $pattern)"
        
        foreach ($match in $matches) {
            $fullMatch = $match.Value
            $key = $match.Groups[1].Value
            
            if ($flatMap.ContainsKey($key)) {
                $bilingualText = $flatMap[$key]
                # 转义引号
                $bilingualText = $bilingualText.Replace('"', '\"')
                $replacement = """$bilingualText"""
                $content = $content.Replace($fullMatch, $replacement)
                $replacements++
                Write-Host "    替换: $key => $bilingualText"
            } else {
                Write-Host "    警告: 未找到映射 - $key" -ForegroundColor Yellow
            }
        }
    }
    
    if ($content -ne $originalContent) {
        # 保存修改后的文件
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "  完成: $replacements 处替换" -ForegroundColor Green
    } else {
        Write-Host "  无需修改" -ForegroundColor Gray
    }
}

Write-Host "`n转换完成！"
