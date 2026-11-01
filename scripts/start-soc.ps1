param([int]$Port = 8005, [int]$TargetPort = 8006, [switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv/Scripts/python.exe'
if ($Port -eq $TargetPort -or $Port -lt 1024 -or $Port -gt 65535 -or $TargetPort -lt 1024 -or $TargetPort -gt 65535) { throw 'Use two distinct ports between 1024 and 65535.' }
foreach ($portNumber in @($Port,$TargetPort)) {
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any,$portNumber)
    try { $probe.Start() } finally { $probe.Stop() }
}
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Prepare the project virtual environment first.' }
Push-Location $projectRoot
$apiProcess = $null
$targetProcess = $null
$priorEnv = @{}
$keys = @('GRIDSENTINEL_SOC_DB','GRIDSENTINEL_SOC_TARGET_PORT','GRIDSENTINEL_DB','GRIDSENTINEL_DATABASE_URL','GRIDSENTINEL_NODE_PASSWORD','GRIDSENTINEL_WARM_START')
foreach ($key in $keys) { $priorEnv[$key] = [Environment]::GetEnvironmentVariable($key,'Process') }
try {
    if (-not $NoBuild) {
        Push-Location frontend
        try { npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed.' } } finally { Pop-Location }
    }
    if (-not (Test-Path -LiteralPath 'frontend/dist/index.html')) { throw 'Build the frontend first.' }
    New-Item -ItemType Directory -Force -Path artifacts | Out-Null
    $env:GRIDSENTINEL_SOC_DB = Join-Path $projectRoot 'artifacts/soc-live.sqlite3'
    $env:GRIDSENTINEL_SOC_TARGET_PORT = "$TargetPort"
    $env:GRIDSENTINEL_DB = Join-Path $projectRoot 'artifacts/soc-infrastructure.sqlite3'
    Remove-Item Env:GRIDSENTINEL_DATABASE_URL -ErrorAction SilentlyContinue
    $env:GRIDSENTINEL_WARM_START = '0'
    $passwordPath = Join-Path $projectRoot 'artifacts/soc-node-password.txt'
    if (-not (Test-Path -LiteralPath $passwordPath)) {
        $randomBytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
        [Convert]::ToBase64String($randomBytes) | Set-Content -LiteralPath $passwordPath
    }
    $env:GRIDSENTINEL_NODE_PASSWORD = (Get-Content -LiteralPath $passwordPath -Raw).Trim()
    $targetProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','app.soc_targets:app_factory','--factory','--host','0.0.0.0','--port',"$TargetPort",'--no-proxy-headers','--limit-concurrency','12','--backlog','32') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'artifacts/soc-target.log') -RedirectStandardError (Join-Path $projectRoot 'artifacts/soc-target-error.log')
    $apiProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','app.main:app','--host','0.0.0.0','--port',"$Port",'--no-proxy-headers') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'artifacts/soc-api.log') -RedirectStandardError (Join-Path $projectRoot 'artifacts/soc-api-error.log')
    @{ launcher=$PID; api=$apiProcess.Id; targets=$targetProcess.Id; port=$Port; targetPort=$TargetPort } | ConvertTo-Json | Set-Content artifacts/soc-processes.json
    $ready = $false
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        if ($apiProcess.HasExited -or $targetProcess.HasExited) { throw 'SOC startup failed; inspect artifacts/soc-*-error.log.' }
        try {
            $a=Invoke-RestMethod "http://127.0.0.1:$Port/api/v1/health" -TimeoutSec 1
            $b=Invoke-RestMethod "http://127.0.0.1:$TargetPort/health" -TimeoutSec 1
            if ($a.status -eq 'ok' -and $b.status -eq 'ok') { $ready=$true; break }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw 'Readiness timeout.' }
    Write-Host "Operator console: http://127.0.0.1:$Port/ (open locally; enter dashboard, then open operator session)"
    Write-Host "Second laptop: use SERVER-PRIVATE-IP on port $TargetPort with scripts/soc-demo.ps1. Private LAN only; no internet forwarding."
    Write-Host 'Allow only the second laptop source IP through your Private-profile firewall if required. No firewall rules are changed automatically.'
    Write-Host 'New target stores default protected. Saved profiles persist: review Node Services before testing. No host shell is exposed.'
    Write-Host 'Ctrl+C stops only these two owned processes. Logs and controls persist in artifacts/soc-live.sqlite3.'
    while (-not $apiProcess.HasExited -and -not $targetProcess.HasExited) { Start-Sleep -Seconds 1 }
} finally {
    # Windows venv Python may create a redirector child: stop only each owned process tree.
    foreach ($owned in @($apiProcess,$targetProcess)) { if ($null -ne $owned -and -not $owned.HasExited) { & taskkill.exe /PID $owned.Id /T /F 2>$null | Out-Null } }
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key,$priorEnv[$key],'Process') }
    Pop-Location
}
