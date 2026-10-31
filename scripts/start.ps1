param([switch]$Production)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Run .\scripts\setup.ps1 first.' }
function Assert-PortAvailable([int]$PortNumber) {
    $portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $PortNumber)
    try { $portProbe.Start() }
    catch { throw "Port $PortNumber is already in use. Stop the previous GridSentinel session before starting another." }
    finally { $portProbe.Stop() }
}
Assert-PortAvailable 8000
if (-not $Production) { Assert-PortAvailable 5173 }
Push-Location $projectRoot
$backendProcess = $null
try {
    if ($Production) {
        Push-Location frontend
        try {
            npm.cmd run build
            if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
        } finally { Pop-Location }
        Write-Host 'Offline demonstration: http://127.0.0.1:8000 (Ctrl+C to stop)'
        Push-Location backend
        try { & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 } finally { Pop-Location }
    } else {
        New-Item -ItemType Directory -Force -Path artifacts | Out-Null
        $backendProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectRoot 'artifacts/backend.log') -RedirectStandardError (Join-Path $projectRoot 'artifacts/backend-error.log')
        $ready = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if ($backendProcess.HasExited) { throw 'API failed to start. Read artifacts/backend-error.log; port 8000 may already be in use.' }
            try { $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 1; if ($health.status -eq 'ok') { $ready = $true; break } } catch { Start-Sleep -Milliseconds 250 }
        }
        if (-not $ready) { throw 'API readiness timed out. Read artifacts/backend-error.log.' }
        Write-Host 'GridSentinel API ready. Frontend: http://127.0.0.1:5173 (Ctrl+C to stop)'
        Push-Location frontend
        try { npm.cmd run dev } finally { Pop-Location }
    }
} finally {
    if ($null -ne $backendProcess -and -not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id }
    Pop-Location
}
