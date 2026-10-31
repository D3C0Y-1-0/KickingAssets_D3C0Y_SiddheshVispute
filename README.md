# GridSentinel

**Local Phase 2 integration:** [Runbook and measured results](docs/PHASE_2_INTEGRATION.md). Branch `integration/phase-2` combines vulnerability assessment with Claude's Python-only conditional impact engine. The register exposes vulnerability evidence; impact calculations currently run from the command line. No ML, risk scoring, What-If calculation or optimizer is enabled.

**See the blast radius before the incident.**

Critical infrastructure cybersecurity risk intelligence for D3COY PS03. This repository implements the **Phase 1 foundation and Phase 2A vulnerability assessment**: a polished shell, deterministic fictional city, typed APIs, independent graphs and real cached NVD/CVSS, EPSS and KEV evidence. It does not calculate asset risk, infer exploit success, monitor live systems or change infrastructure.

Read [docs/PHASE_2A.md](docs/PHASE_2A.md) for offline/online ingestion, supported matching, APIs, provenance and coverage limits. Four assets have separately declared simulated Apache components; no CVE is inferred from fictional baseline product names. Shared risk/impact schemas and engine files are unchanged.

## Run on Windows PowerShell

Requirements: Python 3.12+, Node.js 22.20+ (Node 24 recommended), npm and PowerShell. No API keys, external database, Docker or cloud account are needed. Initial dependency installation needs internet access; the built demonstration runs locally without internet access.

From the repository root:

```powershell
.\scripts\setup.ps1
.\scripts\start.ps1
```

Open http://127.0.0.1:5173. The development script starts FastAPI on port 8000 in a hidden process and Vite in the foreground. Ctrl+C stops the owned backend process. If a required port is occupied, stop your previous GridSentinel session before starting another.

For the offline demonstration, one FastAPI process serves the compiled application and its APIs:

```powershell
.\scripts\start.ps1 -Production
```

Open http://127.0.0.1:8000. Build dependencies must already be installed. The UI uses local system fonts and bundled assets. Swagger documentation is at `/docs` (its Swagger UI assets use a CDN); the application itself and `/openapi.json` do not need that CDN.

If your PowerShell execution policy prevents a local script, run that script with a process-only policy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

## Run the two processes separately

First terminal, repository root:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Second terminal, repository root:

```powershell
Set-Location frontend
npm run dev
```

Vite proxies `/api` to FastAPI. Production uses the same origin, so permissive CORS is unnecessary. `VITE_API_BASE_URL` is an optional build-time override; the default is `/api/v1`. `GRIDSENTINEL_DB` optionally changes the SQLite file; by default it is `data/gridsentinel.sqlite3` relative to the repository, independent of the working directory. No absolute developer paths are embedded in application code.

## Scenario and reset

Aurora City contains 30 stable asset IDs: PWR-001…010, WTR-001…010 and HLT-001…010. It has 27 cyber reachability edges, 23 operational dependency edges and three essential services. Infrastructure, controls and software installations are scenario assumptions. Phase 2A adds real cached CVE references and reproducible applicability/configuration findings. No model scores or incident records are seeded.

The fixed source fixture is `data/scenarios/aurora-city.json`. Startup seeds an absent scenario once and preserves existing records. Reset only the named Aurora scenario with:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m app.db.store --reset
```

To deliberately regenerate the fixture after editing its authoring module, run `python -m app.domain.seed` with the virtual environment from `backend/`, review the JSON diff, then reset. Do not change stable IDs casually.

## Verification

From the repository root:

```powershell
.\scripts\check.ps1
```

This runs Ruff, backend tests, frontend API-boundary tests, strict TypeScript checking and the production build. Individual commands:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend scripts/export_openapi.py
Set-Location frontend
npm test
npm run typecheck
npm run build
```

See `docs/VERIFICATION.md` for the actual browser checks and results, including viewport dimensions and failure recovery. Browser checks were performed against the running application; they are not implied by a build.

## Contracts and continuation

Pydantic is the source of truth. After a coordinated schema change:

```powershell
.\.venv\Scripts\python.exe scripts/export_openapi.py
Set-Location frontend
npm run generate:api
npm run typecheck
```

`frontend/src/api/schema.d.ts` is generated; never hand-edit it. The generated types include schemas reachable through exposed API contracts; all domain types also remain defined in Python and documented in `docs/DOMAIN_MODELS.md`.

- `docs/PROJECT_SPEC.md`: official seven objectives, scope and product vision.
- `docs/ARCHITECTURE.md`: layers, two graphs, ownership and future engine boundaries.
- `docs/DOMAIN_MODELS.md`: model meanings, IDs, provenance, availability and state semantics.
- `docs/API_CONTRACT.md`: working endpoints, examples, errors and future 501 contracts.
- `docs/IMPLEMENTATION_PLAN.md`: phase order, dependencies and validation gates.
- `docs/HANDOFF.md`: extension points, commands, responsibilities and next work.
- `docs/FILE_MANIFEST.md`: exact application and documentation files created.
- `AGENTS.md`: collaboration and schema-change conventions.

The overview's City Risk Index, seven priority labels and category chart are isolated **illustrative frontend fixtures**, visibly marked as previews. The asset register shows **Not assessed**. Future engine endpoints return HTTP 501; staging actions in What-If is local and temporary. See `docs/THIRD_PARTY_NOTICES.md` for the Anatomy design reference, local skill installation and illustration regeneration.
