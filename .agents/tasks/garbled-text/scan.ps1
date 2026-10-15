$utf8=New-Object System.Text.UTF8Encoding($false,$true)
$files=Get-ChildItem -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|dist|build|uploads)\\' -and $_.Name -notmatch 'lock' -and $_.FullName -notmatch 'garbled-text' -and $_.Extension -match '^\.(js|jsx|ts|tsx|vue|html|css|json|sql|sh|md|ps1|txt|env|yml|yaml|mjs|cjs)$' }
"textfiles: $($files.Count)"
foreach($f in $files){ $b=[IO.File]::ReadAllBytes($f.FullName)
 $bom=($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
 $u16=($b.Length -ge 2 -and (($b[0] -eq 0xFF -and $b[1] -eq 0xFE) -or ($b[0] -eq 0xFE -and $b[1] -eq 0xFF)))
 $valid=$true; try{$t=$utf8.GetString($b)}catch{$valid=$false; $t=[Text.Encoding]::UTF8.GetString($b)}
 $rel=$f.FullName.Substring(9)
 if($bom -or $u16 -or -not $valid){"ENC ${rel} bom=$bom u16=$u16 valid=$valid"}
 $ln=0
 foreach($l in ($t -split "`n")){ $ln++
  $m=@()
  if($l.Contains([string][char]0xFFFD)){$m+='FFFD'}
  if($l -match '[鍙銆鏄涓閿绯鐨锛鎴鐢浠姝]{2,}'){$m+='GBKmoji'}
  if($l -cmatch 'ä¸|ã€|Ã.|Â.|å[\u0080-\u00ff]|ç[\u0080-\u00ff]|æ[\u0080-\u00ff]'){$m+='latin1moji'}
  if($l -match '\?{3,}'){$m+='qqq'}
  if($l -match '[\u4e00-\u9fff]\?|\?[\u4e00-\u9fff]'){$m+='cjk?'}
  if($m.Count){ $s=$l.Trim(); if($s.Length -gt 90){$s=$s.Substring(0,90)}; "${rel}:${ln} [$($m -join ',')] $s"}
 }}
