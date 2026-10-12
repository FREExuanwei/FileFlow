param([Parameter(Mandatory)][int]$OwnerPid,[Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference='Stop'
$output=[IO.Path]::GetFullPath($Destination)
$root=[IO.Path]::GetFullPath((Join-Path $PWD 'docs/phase8'))+[IO.Path]::DirectorySeparatorChar
if(-not $output.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw 'evidence path outside phase8'}
$until=[DateTime]::UtcNow.AddMinutes(15)
while([DateTime]::UtcNow -lt $until){
 if(-not(Get-Process -Id $OwnerPid -ErrorAction SilentlyContinue)){break}
 $processes=Get-CimInstance Win32_Process
 $ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add($OwnerPid)
 do{$added=$false;foreach($p in $processes){if($ids.Contains([int]$p.ParentProcessId)-and $ids.Add([int]$p.ProcessId)){$added=$true}}}while($added)
 $rows=@();foreach($id in $ids){$p=Get-Process -Id $id -ErrorAction SilentlyContinue;if($p){$rows+=@{pid=$id;name=$p.ProcessName;workingSet=$p.WorkingSet64;privateBytes=$p.PrivateMemorySize64;peakWorkingSet=$p.PeakWorkingSet64}}}
 $json=@{at=[DateTime]::UtcNow.ToString('o');owner=$OwnerPid;processes=$rows;totalWorkingSet=($rows|Measure-Object workingSet -Sum).Sum;totalPrivateBytes=($rows|Measure-Object privateBytes -Sum).Sum}|ConvertTo-Json -Depth 5 -Compress
 [IO.File]::AppendAllText($output,$json+"`n")
 Start-Sleep -Milliseconds 750
}
