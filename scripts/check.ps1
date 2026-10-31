$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & '.\.venv\Scripts\python.exe' -m ruff check backend scripts/export_openapi.py scripts/verify_demo.py
    if ($LASTEXITCODE -ne 0) { throw 'Python lint failed.' }
    & '.\.venv\Scripts\python.exe' -m ruff format --check backend scripts/export_openapi.py scripts/verify_demo.py
    if ($LASTEXITCODE -ne 0) { throw 'Python formatting failed.' }
    & '.\.venv\Scripts\python.exe' -m pytest backend/tests -q
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
    Push-Location frontend
    try {
        npm.cmd test
        if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
        npm.cmd run typecheck
        if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
        npm.cmd run format:check
        if ($LASTEXITCODE -ne 0) { throw 'Frontend formatting failed.' }
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend check/build failed.' }
    } finally { Pop-Location }
} finally { Pop-Location }
