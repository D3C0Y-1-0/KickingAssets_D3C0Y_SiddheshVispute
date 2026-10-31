$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path '.venv/Scripts/python.exe')) {
        python -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Python virtual environment creation failed.' }
    }
    & '.\.venv\Scripts\python.exe' -m pip install -r backend/requirements-lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
    Push-Location frontend
    try {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    } finally { Pop-Location }
    Push-Location backend
    try {
        & '..\.venv\Scripts\python.exe' -m app.db.store
        if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
    } finally { Pop-Location }
    Write-Host 'GridSentinel ready. Run .\scripts\start.ps1'
} finally { Pop-Location }
