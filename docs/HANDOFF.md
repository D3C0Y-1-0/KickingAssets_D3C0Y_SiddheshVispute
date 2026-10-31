# Phase 1 handoff

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
