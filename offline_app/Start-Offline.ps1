$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:CUDA_VISIBLE_DEVICES = '-1'
$candidates = @()
$candidates += (Join-Path $PSScriptRoot '.venv-cpu\Scripts\python.exe')
$savedRuntime = Join-Path $PSScriptRoot 'python-path.txt'
if (Test-Path -LiteralPath $savedRuntime) { $candidates += (Get-Content -LiteralPath $savedRuntime -Raw).Trim() }
if ($env:DGRAINSIGHT_PYTHON) { $candidates += $env:DGRAINSIGHT_PYTHON }
$candidates += (Join-Path $PSScriptRoot '.venv\Scripts\python.exe')
$candidates += @(Get-Command python -All -ErrorAction SilentlyContinue | ForEach-Object Source)
if (Get-Command py -ErrorAction SilentlyContinue) {
    $candidates += @(py -0p 2>$null | ForEach-Object { if ($_ -match '([A-Za-z]:\\.*python.exe)\s*$') { $matches[1] } })
}
$registry = Join-Path $env:USERPROFILE '.conda\environments.txt'
if (Test-Path -LiteralPath $registry) {
    $candidates += @(Get-Content -LiteralPath $registry | ForEach-Object { Join-Path $_ 'python.exe' })
}
function Test-Runtime([string]$candidate) {
    if (!(Test-Path -LiteralPath $candidate -PathType Leaf)) { return $false }
    try {
        & $candidate -c 'import sys; assert sys.version_info >= (3,10); import torch, numpy' 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}
$runtime = $null
foreach ($candidate in ($candidates | Select-Object -Unique)) {
    Write-Host "Checking Python: $candidate"
    if (Test-Runtime $candidate) { $runtime = $candidate; break }
}
while (!$runtime) {
    $candidate = (Read-Host 'Python with PyTorch not found. Enter full python.exe path (blank to exit)').Trim().Trim('"')
    if (!$candidate) { exit 1 }
    if (Test-Runtime $candidate) { $runtime = $candidate } else { Write-Host 'Requires Python >=3.10, PyTorch and NumPy.' }
}
Write-Host "Using $runtime"
& $runtime -c "import torch; print('PyTorch:', torch.__version__, '| CUDA build:', torch.version.cuda)"
Set-Content -LiteralPath $savedRuntime -Value $runtime -Encoding UTF8
& $runtime -u -X faulthandler -B (Join-Path $PSScriptRoot 'offline.py')
$evaluationExit = $LASTEXITCODE
$logDirectory = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
Set-Content -LiteralPath (Join-Path $logDirectory 'last-exit.txt') -Value "$(Get-Date -Format o) Python exit code: $evaluationExit" -Encoding UTF8
if ($evaluationExit -ne 0) {
    Write-Host "Python stopped with exit code $evaluationExit. Evaluation did not complete."
}
exit $evaluationExit
