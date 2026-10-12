param([int]$Seconds=12)
$ErrorActionPreference='Stop'
$installedExe=Join-Path $env:LOCALAPPDATA 'Programs/FileFlow/fileflow-desktop.exe'
$receiptPath=Join-Path $PSScriptRoot '../docs/phase6/final-validation/normal-start-network.json'
$oldDebug=$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
Remove-Item Env:/WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
$app=Start-Process -FilePath $installedExe -WindowStyle Hidden -PassThru
$rows=@();$kinds=@();$samples=0;$windowSeen=$false
$clock=[System.Diagnostics.Stopwatch]::StartNew()
try {
  while($clock.Elapsed.TotalSeconds -lt $Seconds){
    $all=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name
    $ids=@([int]$app.Id)
    for($depth=0;$depth -lt 4;$depth++){
      foreach($proc in $all){if([int]$proc.ParentProcessId -in $ids -and [int]$proc.ProcessId -notin $ids){$ids+=[int]$proc.ProcessId;$kinds+=$proc.Name}}
    }
    foreach($line in (& netstat.exe -ano -p tcp)){
      if($line -match '^\s*TCP\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s*$' -and [int]$Matches[4] -in $ids){
        $remote=$Matches[2];$connectionPid=[int]$Matches[4];$connectionState=$Matches[3]
        $isLocal=[regex]::IsMatch($remote,'^(127\.|\[::1\]:|0\.0\.0\.0:|\[::\]:)')
        $rows+=[ordered]@{sample=$samples;pid=$connectionPid;remote=$remote;state=$connectionState;isLocal=$isLocal}
      }
    }
    $app.Refresh();if($app.MainWindowHandle -ne 0){$windowSeen=$true}
    $samples++;Start-Sleep -Milliseconds 250
  }
}finally{
  [void]$app.CloseMainWindow();[void]$app.WaitForExit(6000)
  if($null -ne $oldDebug){$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$oldDebug}
}
$root=Join-Path $env:LOCALAPPDATA 'FileFlow.Desktop'
$receipt=[ordered]@{
  time=(Get-Date).ToUniversalTime().ToString('o');pid=$app.Id;samples=$samples;elapsedSeconds=$clock.Elapsed.TotalSeconds
  debugPortEnabled=$false;windowSeen=$windowSeen;closed=$app.HasExited;processKinds=@($kinds | Sort-Object -Unique)
  tcpObservations=$rows;externalTcpObserved=@($rows | Where-Object {-not $_.isLocal}).Count
  profileRoot=$root;profileAcl=(Get-Acl -LiteralPath $root).Sddl
  claim='Bounded normal cold-start TCP table sampling, not packet capture or proof of absent uploads. Short-lived connections, UDP, encrypted payloads and OS/runtime diagnostics may be missed. Physical network disconnection not performed.'
}
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receiptPath -Encoding utf8
$receipt | ConvertTo-Json -Depth 6 | Out-Null
Write-Output "Normal startup: samples=$samples window=$windowSeen closed=$($app.HasExited) TCP records=$($rows.Count) non-loopback=$($receipt.externalTcpObserved). Full details saved in $receiptPath."
if(@($rows | Where-Object {$_.pid -le 0 -or [string]::IsNullOrEmpty($_.state)}).Count -gt 0){throw 'TCP evidence has invalid process/state fields'}
if(-not $windowSeen -or -not $app.HasExited -or $samples -lt 3){throw 'Startup observation incomplete'}
