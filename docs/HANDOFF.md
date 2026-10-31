# Phase 1 handoff

**Current: Phase 7 backend feature branch.** Read [PHASE_7_RESILIENCE_ENGINE.md](PHASE_7_RESILIENCE_ENGINE.md) and the latest VERIFICATION.md entry. New continuity simulation/catalog/exact optimizer/stress APIs are additive to Phase 6 `91f2ab55`; original algorithms, datasets, model artifacts, UI and old API behavior are preserved. TypeScript changes are generated declarations only. The demo helper calls real local APIs and checks Phase 6 golden results. Existing running processes must be restarted to load new routes. No push or merge is authorized for this batch; future UI work should consume the documented actual contract rather than assume scores or probabilities.

**Current: Phase 6 finalization.** Read [FINAL_DEMO_RUNBOOK.md](FINAL_DEMO_RUNBOOK.md), [PHASE_6_MODULE_AUDIT.md](PHASE_6_MODULE_AUDIT.md) and the latest VERIFICATION.md entry. Branch `feature/phase-6-finalization` starts at verified Phase 5 `62dece9793b3b0a901091bbd80bd6860a6ef69b8`. All 14 modules plus additive Attack Paths were audited; the existing path/impact/scoring/model algorithms and original objectives were preserved. The new API wrapper is `schemas/attack_paths.py`; generated OpenAPI/TypeScript are synchronized. No main or teammate branch was modified. Historical absence claims below apply only to their named phase.

**Latest: Phase 5 final integration.** `integration/phase-5` preserves backend 33ed965, frontend 50f65e9 and their a5bac82 combined history, then adds verified contract wiring. Read [PHASE_5_INTEGRATION.md](PHASE_5_INTEGRATION.md) for exact API behavior, corrected results, launch, tests and Phase 6 readiness/limits. Earlier Phase 5B proposals and historical phase records below are superseded by the integrated actual contract. Do not retrain or push to main as part of this delivery.

**Phase 5B frontend:** `feature/phase-5-frontend` adds stale-result handling, searchable exclusions and typed Fix Plan → What-If handoff to the verified integration baseline. Read [PHASE_5_FRONTEND.md](PHASE_5_FRONTEND.md) for checks, demonstration and pending backend contract coordination. Claude's unfinished branch was not merged; generated contracts/engines remain unchanged.

**Latest:** local `integration/phase-3` contains all fetched remote branch heads plus the curated Phase 3A pipeline. Read [PHASE_3_INTEGRATION.md](PHASE_3_INTEGRATION.md) before extending. Workflow and curated-overlay scores have different software assumptions and formulas; never substitute one for the other. SQLite launch is explicit via `-SQLite`. All 95 training-source checksums and saved-model metrics were reproduced; the model remains experimental and uncalibrated. Do not retrain or push to main as part of this completed batch. Historical records below are retained.

**Latest local integration:** `integration/phase-2` combines Phase 2A `5b4d82f` and Phase 2B `95160bc` from baseline `4acfd7e`. See [PHASE_2_INTEGRATION.md](PHASE_2_INTEGRATION.md) for compatibility review, measured checks, launch instructions and the actual impact demo command. NetworkX is now locked. Vulnerabilities are visible in the register; conditional impact is Python-only. No ML branch, impact API/UI, risk scoring, What-If calculations or optimizer was added. Existing historical records below remain unchanged.

**Latest: Phase 2A** is implemented on feature/vulnerability-assessment. Read [PHASE_2A.md](PHASE_2A.md) for contracts, source data, CLI, limits and Claude integration boundaries. Checks are appended to VERIFICATION.md. The Phase 1 record below is retained as history. Shared models.py, engine/ML files, base assets and graphs are unchanged. Coordinate the small router/bootstrap and generated-artifact integration points when merging the impact branch; do not replace either feature.

## Implemented

- React/TypeScript strict/Vite application with semantic Mission-Control Noir tokens, responsive sidebar/topbar, visible fictional-sample status, API health, global inventory search and stable routes for all seven required screens.
- Command Overview with API asset/sector/service counts, seven isolated sample risk labels, a sample category chart, an actual baseline inventory record and an original 56-solid isometric control station. Sector focus changes the cabinet highlight; no technical readings are invented.
- Cytoscape graph from the API, independent cyber and operational modes, separate edge schemas/tables, sector filters, pointer and keyboard-accessible selection, inspector, search-to-focus, zoom/pan, fit and optional demo risk colors with a dedicated legend.
- Searchable, filterable and sortable API-backed inventory; native modal asset details with fictional product/version, security configuration, criticality, exposure, provenance and honest vulnerability/risk absence.
- Risk Intelligence preview/empty states; temporary local What-If staging based on configuration; explicit disabled simulation; Remediation layout without fabricated action ranks or reductions; Methodology page explaining provenance, assumptions and implementation status.
- FastAPI/Pydantic v2, a validated deterministic Aurora fixture, idempotent SQLite seed, explicit scenario reset CLI, read-only APIs, structured errors and compiled SPA serving with deep-link/API isolation.
- All requested domain schemas, future pure Protocol interfaces, safe unavailable fields, timezone-aware timestamps, state/version/provenance conventions, OpenAPI export and generated TypeScript types.
- Windows setup/start/check scripts, frontend tests, backend tests, formatting, locks and engineering documentation. The original official seven objectives and expected solution are preserved in PROJECT_SPEC.md.

The exact file inventory is FILE_MANIFEST.md. No pre-existing application files were overwritten; the workspace was empty before Phase 1. The Anatomy skill was installed as local agent tooling, not application source; its license notice and reproduction instructions are retained.

## Not implemented

No CVE feed importer, applicability engine, vulnerability assessment, ML training/inference, historical KEV model, composite scorer, exploit-success/propagation model, operational cascade calculator, AI explanation generator, calculated what-if result, greedy optimizer, live advisory stream or infrastructure mutation exists. The corresponding modules are reserved and their routes return explicit HTTP 501. Empty evidence is not evidence of safety.

Official objectives O2–O7 require the later engines described in IMPLEMENTATION_PLAN.md. O1 and the graph portions of O5 are working simulated foundations, not universal real-infrastructure support. The dashboard is a working presentation/integration foundation and does not yet provide predictive intelligence.

## Source and integration boundaries

Backend contracts: `backend/app/schemas/models.py`. Future pure interfaces: `backend/app/engine/contracts.py`. Database boundary: db/store.py. Read orchestration: services/inventory.py. HTTP routes: api/routes.py. Startup/error/static composition: main.py.

Scenario source: data/scenarios/aurora-city.json. Authoring generator: domain/seed.py. Do not change stable IDs, graph directions, requirement targets or timestamps to fit a model. Seed products and versions are fictional and cannot be used as real CVE applicability proof. Current SQLite schema version is 1; future evidence/results tables need reviewed migrations.

Frontend integration: api/client.ts → hooks/queries.ts → feature components. Server data is cached by scenario/snapshot/mode/asset; no feature fetches directly. Add an API method and hook before wiring an engine screen. Regenerate schema.d.ts instead of redefining Python contracts in JSX.

Preview removal point: frontend/src/fixtures/previews.ts. Replace demo scores only once real query results exist and tests exercise missing/partial data. Preserve sample labels on scenario assumptions even after a real algorithm operates on them. The actionCatalog is a non-executing staging aid; later backend action definitions must include provenance and validated eligibility/costs.

`components/illustration` is replaceable and independent of Cytoscape. Static SVG geometry is precomputed; ordinary builds do not need Anatomy installed. `scripts/build-illustration.mjs --audit` regenerates the art using the project-local skill; it currently passes the geometry audit with 56 solids, 300 ordering rules and no unsupported/interpenetrating/depth-order failures.

## Commands and measured verification

See VERIFICATION.md for exact outcomes, browser interactions and limits. Core commands actually used:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m pytest backend/tests -q --tb=short
.\.venv\Scripts\python.exe -m ruff check backend scripts/export_openapi.py
.\.venv\Scripts\python.exe scripts/export_openapi.py
Set-Location frontend
npm install
npm run generate:api
npm test
npm run typecheck
npm run build
npm run format:check
```

22 backend tests and seven frontend API-boundary tests pass. TypeScript/build and Ruff pass. The resolved dependency tree was audited with zero reported npm vulnerabilities. A single non-failing Starlette/httpx test-client deprecation warning remains; it is not an application runtime failure. The initial pytest attempt was blocked by the managed Windows temporary-directory sandbox and was rerun successfully with the necessary execution permission.

Setup uses committed dependency locks for clean reproduction. From repository root, `.\scripts\setup.ps1`, `.\scripts\start.ps1` and `.\scripts\start.ps1 -Production` are the supported entry points. Do not run multiple copies on the same ports. Reset from backend/ with `..\.venv\Scripts\python.exe -m app.db.store --reset`.

## Next Codex implementation phase

Read the official objective mapping and Phase 2 gate. Take bounded ownership of reference ingestion, evidence persistence/migration, applicability contracts, and corresponding inventory/intelligence API integration. Work from attributed real reference fixtures with deterministic offline caching. Keep candidate versus confirmed applicability explicit. Coordinate additions to shared schemas and regenerate OpenAPI/TypeScript before integrating the UI.

Do not start scoring by mapping preview numbers into backend fields. Do not match fictional Aurora product strings to real CVEs as if confirmed. For a real feed demonstration, introduce clearly identified reference-backed product fixtures through a reviewed scenario change.

## Next Claude implementation phase

After explicit ownership assignment, take an isolated ML prioritization/evaluation module (Phase 3) or conditional graph/impact module (Phase 4). Read engine Protocols and DOMAIN_MODELS first. Do not alter shared schemas, routes, seed IDs or frontend files independently. Return pure typed outputs with versions, source context, assumptions and tests against the agreed interfaces.

ML work requires temporal leakage controls and measured evaluation against baselines. Impact work requires effect-specific semantics, redundancy, named conditional backups, activation delays and finite duration. Neither module may interpret connectivity as successful compromise or a descendant count as a service outage.

## Integration protocol for both agents

Agree the exact file list and schema owner before concurrent work. Keep the user's and other agent's diffs intact. Integrate one engine through service orchestration, tests, explicit availability states and generated contracts. Run the complete appropriate checks, repeat relevant browser smoke tests, update objective status honestly and record the actual commands/results here. See AGENTS.md for restrictions.

## Backend connected to PostgreSQL (branch codex/innovations, local only, not pushed)

- Base: `origin/feature/real-data-link` at 598c898 (integrated workflow, real-data link, digital twins, lime theme). Source branches are unchanged.
- Added on top: the PostgreSQL-capable repository (`backend/app/db/store.py`, SQLite stays the default; `GRIDSENTINEL_DATABASE_URL` selects Neon), gzip and security-header middleware, and the ML runtime dependencies (pandas, numpy, pyarrow, xgboost, scikit-learn, networkx, psycopg) in `requirements.txt` and the lock.
- The simulation result is held in `app.state.simulation` (one process). Run a single worker; this app cannot be hosted as stateless serverless without moving that state out of process.
- The reference data cache (`data/reference/cache`, about 231 MB, git-ignored) must be present at runtime for ML scoring.

## Hosting (31 October 2026)

- Frontend: https://gridsentinel-phi.vercel.app (Vercel project `gridsentinel`, static build of `frontend/`). `vercel.json` proxies `/api/*` to the Azure backend and falls back to `index.html`.
- Backend: Azure App Service (Linux, B1, Python 3.12) `gridsentinel-api-72420` in Malaysia West, resource group `gridsentinel-rg`. One uvicorn worker, because the latest simulation lives in process memory (`app.state.simulation`), so every visitor shares one simulation state.
- Database: Neon PostgreSQL 17, Singapore (`GRIDSENTINEL_DATABASE_URL` is an App Service setting; never commit it).
- Package: a zip with the app, the ML code and models, the Linux wheels in `.python_packages` (CPU `xgboost-cpu`), and the reduced reference data (KEV, EPSS snapshots, derived parquet; raw NVD files are not needed). Oryx build is disabled. Startup command: `cd backend && PYTHONPATH=/home/site/wwwroot/.python_packages/lib/site-packages python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`. Do not put an unquoted `*` in the command: the shell expands it.
- Azure Container Registry Tasks are blocked on the Azure for Students subscription, so container builds are not available.
- Not on this branch: the read-only `/api/v1/impact` and `/models/kev-signal` endpoints exist only on `codex/deploy`. This branch's own workflow endpoints supersede them.

## Challenge-gap features (codex/innovations)

Plan and status: `docs/PLAN_CHALLENGE_GAPS.md`. All additive; `risk-index-v1` and existing contracts are unchanged.

- **Simulated network activity** (`engine/telemetry.py`, `services/insights.py`, `GET /api/v1/activity`, `/activity/assets/{id}`): seeded daily telemetry per asset plus authored events (`data/scenarios/aurora-telemetry-events.json`), a robust z-score detector (28-day median/MAD baseline, z >= 3.5) and a criticality-scaled noisy-OR city activity index. Everything is labelled `simulation`. Urgency = risk x (1 + 0.5 x anomaly) appears only after a simulation run (otherwise null).
- **Resilience** (`engine/resilience.py`, `GET /api/v1/resilience/chokepoints`, `/vendors`): single-asset-loss chokepoints and assumed vendor-compromise scenarios, both through the conditional impact engine (joint analysis for vendors); vendor concentration (HHI) per service; CISA KEV counts as context.
- **Posture trend** (`GET /api/v1/simulation/trend`): served from `data/derived/posture-trend.json`, built by `python -m app.services.trend_build --months 18` (needs the reference cache). Absent file returns `status: unavailable`. It shows the public vulnerability landscape moving against fixed assumed assets.
- **Risk brief** (`GET /api/v1/reports/brief?format=json|md|html`): from the latest simulation plus the companion reports and a 40 h optimizer plan; 409 without a run. Download links are on the Command Overview after a run.
- **Pages:** Posture & Activity (`/posture`), Resilience (`/resilience`), PS03 Coverage (`/coverage`).
- New contract file: `app/schemas/insights.py`; router `app/api/insights.py` registered in `main.py`.
- Known limits: telemetry is simulated and the detector is exercised on its own authored events; the benign maintenance window is flagged on purpose; chokepoint and vendor figures assume no operator recovery (upper bound); no calibrated likelihood, no new sectors, no modelled monitoring or recovery benefit.

Hosted: the new endpoints and pages are live on https://gridsentinel-phi.vercel.app (Vercel proxies `/api` to the Azure backend). The Azure update was incremental: `az webapp deploy --type zip --clean false` with only `backend/app`, `data/scenarios/aurora-telemetry-events.json` and `data/derived/posture-trend.json`. A full package rebuild is only needed when dependencies or the reference data change.
