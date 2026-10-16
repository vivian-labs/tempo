param(
 [Parameter(Mandatory=$true)][int]$RootProcessId,
 [Parameter(Mandatory=$true)][string]$Label,
 [int]$Seconds=10,
 [string]$OutputFile='test-results/process-measurement.json'
)
$ErrorActionPreference='Stop'
function Sample-ProcessTree {
 $inventory=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId
 $ids=[System.Collections.Generic.HashSet[int]]::new()
 [void]$ids.Add($RootProcessId)
 do{$added=$false;foreach($process in $inventory){if($ids.Contains([int]$process.ParentProcessId) -and $ids.Add([int]$process.ProcessId)){$added=$true}}}while($added)
 $processes=@(foreach($id in $ids){Get-Process -Id $id -ErrorAction SilentlyContinue})
 [pscustomobject]@{
  cpuSeconds=($processes|Measure-Object CPU -Sum).Sum
  workingSetBytes=($processes|Measure-Object WorkingSet64 -Sum).Sum
  privateBytes=($processes|Measure-Object PrivateMemorySize64 -Sum).Sum
  processes=@($processes|ForEach-Object{@{id=$_.Id;name=$_.ProcessName}})
 }
}
$initial=Sample-ProcessTree
$watch=[Diagnostics.Stopwatch]::StartNew()
Start-Sleep -Seconds $Seconds
$final=Sample-ProcessTree
$elapsed=$watch.Elapsed.TotalSeconds
$measurement=@{
 label=$Label;elapsedSeconds=$elapsed
 cpuSecondsDelta=$final.cpuSeconds-$initial.cpuSeconds
 cpuPercentOneCore=100*($final.cpuSeconds-$initial.cpuSeconds)/$elapsed
 workingSetBytes=$final.workingSetBytes;privateBytes=$final.privateBytes
 initialProcessCount=$initial.processes.Count;processes=$final.processes
 caveats=@('Summed working sets count shared pages more than once.','Private bytes are committed virtual memory, not private resident memory.','Short sample on one Windows machine; not an energy, GPU, or universal performance benchmark.')
}
$parent=Split-Path -Parent $OutputFile
if($parent){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
$measurement|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $OutputFile
$measurement|Select-Object label,elapsedSeconds,cpuPercentOneCore,workingSetBytes,privateBytes,initialProcessCount|ConvertTo-Json
