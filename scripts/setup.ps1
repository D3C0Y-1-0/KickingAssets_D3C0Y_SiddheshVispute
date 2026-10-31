param([switch]$SQLite)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
$previousDatabaseUrl = $env:GRIDSENTINEL_DATABASE_URL
$previousDatabasePath = $env:GRIDSENTINEL_DB
try {
    if ($SQLite) {
        Remove-Item Env:GRIDSENTINEL_DATABASE_URL -ErrorAction SilentlyContinue
        $env:GRIDSENTINEL_DB = Join-Path $projectRoot 'data/gridsentinel.sqlite3'
    }
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
} finally {
    Pop-Location
    if ($SQLite) {
        $env:GRIDSENTINEL_DATABASE_URL = $previousDatabaseUrl
        $env:GRIDSENTINEL_DB = $previousDatabasePath
    }
}
