# Phase 1 file manifest

## Phase 5 final integration

Both feature histories are preserved. The exact integration-only file list relative to the clean a5bac82/cb7920a merge is [PHASE_5_INTEGRATION_FILES.txt](PHASE_5_INTEGRATION_FILES.txt). New `ActionControls.tsx` supplies contract-backed constraint/patch editors, fixed-version evidence and structured errors. Existing action helpers/screens, API client, Live Simulation hook and tests were adapted to the authoritative merged API; OpenAPI/TypeScript were regenerated. Documentation records results, limits and launch. No backend/ML/dataset file was modified by integration wiring beyond the imported feature histories.

## Phase 5B frontend

Created: `docs/PHASE_5_FRONTEND.md`, `frontend/src/features/actions/workflow.ts`, `frontend/src/features/actions/useActionWorkflow.ts`, `frontend/src/features/actions/WorkflowUI.tsx`, `frontend/src/features/actions/workflow.css`, `frontend/tests/workflow.test.tsx`.

Modified: `frontend/src/features/remediation/Remediation.tsx`, `frontend/src/features/whatif/WhatIf.tsx`, `frontend/src/features/assets/Assets.tsx`, `frontend/src/features/live/LiveSimulation.tsx`, `frontend/package.json`, `frontend/package-lock.json`, `docs/HANDOFF.md`, `docs/FILE_MANIFEST.md`, `docs/VERIFICATION.md`. Test dependencies add jsdom and Testing Library. No backend, ML, risk/optimizer algorithms or generated schema edits. See PHASE_5_FRONTEND.md for contract boundaries.

## Phase 3A and repository synchronization

The exact final change inventory relative to the Phase 2 integration is [PHASE_3_FILES.txt](PHASE_3_FILES.txt). Imported branch histories and module responsibilities are recorded in [PHASE_3_INTEGRATION.md](PHASE_3_INTEGRATION.md). New coordinator-owned modules: `api/intelligence.py`, `schemas/intelligence.py`, `services/intelligence.py`, `services/model_signal.py`, `tests/test_intelligence.py`, `CuratedIntelligence.tsx`, `RiskEvidence.tsx`, `intelligence.css`, `scripts/evaluate_model.py`, `scripts/build_inference_inputs.py`, the attributed `risk-v1`/`risk-inference.json` inputs and `ml-reevaluation.json` record. Existing vulnerability modules and impact tests were preserved. Shared impact schemas/Protocol and original Aurora fixture were not rewritten. Optional PostgreSQL SQL compatibility, SQLite launch switches, generated contracts, UI integration, tests and documentation were coordinated locally. The 34 imported twin/design files received project formatting without behavioral changes.

## Local Phase 2 integration additions

The Phase 2A file list is retained below. Claude's `95160bc` adds these ten unchanged files:

```text
backend/app/engine/impact/README.md
backend/app/engine/impact/__init__.py
backend/app/engine/impact/cascade.py
backend/app/engine/impact/engine.py
backend/app/engine/impact/graph.py
backend/app/engine/impact/models.py
backend/app/engine/impact/policy.py
backend/app/engine/impact/service.py
backend/tests/impact_support.py
backend/tests/test_conditional_impact.py
```

Integration creates `scripts/demo_impact.py` and `docs/PHASE_2_INTEGRATION.md`; modifies `backend/requirements.txt`, `backend/requirements-lock.txt`, `backend/tests/test_foundation.py` (format only), `README.md`, `docs/ARCHITECTURE.md`, `docs/HANDOFF.md`, `docs/VERIFICATION.md`, and this manifest. No shared schemas, API contracts, engine implementations or frontend source files were modified during integration.

The workspace contained no existing application files. All 72 files below were created for Phase 1; no unrelated user files were modified. Generated contracts and illustration geometry are identified by their file headers.

```text
.gitattributes
.gitignore
AGENTS.md
README.md
backend/app/__init__.py
backend/app/api/__init__.py
backend/app/api/routes.py
backend/app/db/__init__.py
backend/app/db/store.py
backend/app/domain/__init__.py
backend/app/domain/seed.py
backend/app/engine/README.md
backend/app/engine/contracts.py
backend/app/main.py
backend/app/schemas/__init__.py
backend/app/schemas/models.py
backend/app/services/__init__.py
backend/app/services/inventory.py
backend/ml/README.md
backend/pyproject.toml
backend/requirements-lock.txt
backend/requirements.txt
backend/tests/conftest.py
backend/tests/test_foundation.py
data/reference/README.md
data/scenarios/aurora-city.json
docs/API_CONTRACT.md
docs/ARCHITECTURE.md
docs/DOMAIN_MODELS.md
docs/FILE_MANIFEST.md
docs/HANDOFF.md
docs/IMPLEMENTATION_PLAN.md
docs/PROJECT_SPEC.md
docs/THIRD_PARTY_NOTICES.md
docs/VERIFICATION.md
docs/openapi.json
frontend/.prettierignore
frontend/.prettierrc.json
frontend/index.html
frontend/package-lock.json
frontend/package.json
frontend/public/favicon.svg
frontend/src/api/client.ts
frontend/src/api/schema.d.ts
frontend/src/app/App.tsx
frontend/src/components/AssetDrawer.tsx
frontend/src/components/ErrorBoundary.tsx
frontend/src/components/illustration/Station.tsx
frontend/src/components/illustration/station-art.ts
frontend/src/components/illustration/station.css
frontend/src/components/ui.tsx
frontend/src/design/tokens.css
frontend/src/features/assets/Assets.tsx
frontend/src/features/infrastructure/Infrastructure.tsx
frontend/src/features/intelligence/Intelligence.tsx
frontend/src/features/methodology/Methodology.tsx
frontend/src/features/overview/Overview.tsx
frontend/src/features/remediation/Remediation.tsx
frontend/src/features/whatif/WhatIf.tsx
frontend/src/fixtures/previews.ts
frontend/src/hooks/queries.ts
frontend/src/main.tsx
frontend/src/styles/index.css
frontend/tests/api.test.ts
frontend/tsconfig.json
frontend/vite.config.ts
scripts/build-illustration.mjs
scripts/check.ps1
scripts/export_openapi.py
scripts/setup.ps1
scripts/start.ps1
skills-lock.json
```

Local-only generated state is excluded: .venv/, frontend/node_modules/, frontend/dist/, SQLite database files, Python/test caches, .review/, artifacts/ and the installed .agents/skills/anatomy/ tooling. skills-lock.json records the reviewed upstream skill fingerprint; the application ships generated SVG paths rather than a third-party example app.

## Digital twin interaction and connections

Created: frontend/src/components/twin/ (useStageView.ts, HotspotTwin.tsx, TwinInspector.tsx, FlowOverlay.tsx, TwinNav.tsx, twin.css), frontend/src/data/twinParts.ts, frontend/src/hooks/twinConnections.ts.
Modified: the five twin viewers (WaterPlantViewer, HospitalViewer, TransitViewer, SubstationViewer, SmartCityViewer), features/digital-twins/DigitalTwins.tsx, features/infrastructure/Infrastructure.tsx. Water, hospital and transit are now thin wrappers over HotspotTwin. station-art.ts and the generated art modules were not touched.

## Gridinal rebrand and navigation

Created: frontend/src/assets/brand/gridinal-mark.png and gridinal-wordmark.png (cropped, resized copies of the supplied logos), frontend/public/favicon.png.
Modified: frontend/src/app/App.tsx (grouped, collapsible sidebar; visible name now Gridinal), frontend/src/styles/index.css (sidebar block replaced), frontend/index.html, ErrorBoundary.tsx, ui.tsx, Methodology.tsx (name only). Backend, docs and the generated station-art.ts header comment still say GridSentinel.
## Hosting additions (codex/innovations)
## Phase 2A additions and modifications

Phase 1 entries above remain historical. The following 40 paths were added or modified for the vulnerability assessment branch; engine/ML files and shared models.py were not changed.

```text
.gitattributes
README.md
backend/app/api/routes.py
backend/app/api/vulnerability.py
backend/app/db/vulnerability_store.py
backend/app/main.py
backend/app/schemas/vulnerability.py
backend/app/services/vulnerability_cli.py
backend/app/services/vulnerability_ingestion.py
backend/app/services/vulnerability_matching.py
backend/tests/test_foundation.py
backend/tests/test_vulnerability.py
backend/tests/test_vulnerability_persistence.py
data/reference/README.md
data/reference/vulnerability-v1/epss.json
data/reference/vulnerability-v1/kev.json
data/reference/vulnerability-v1/nvd-41773.json
data/reference/vulnerability-v1/nvd-42013.json
data/reference/vulnerability-v1/sources.json
data/scenarios/aurora-software-evidence.json
docs/API_CONTRACT.md
docs/ARCHITECTURE.md
docs/DOMAIN_MODELS.md
docs/FILE_MANIFEST.md
docs/HANDOFF.md
docs/IMPLEMENTATION_PLAN.md
docs/PHASE_2A.md
docs/PROJECT_SPEC.md
docs/VERIFICATION.md
docs/openapi.json
frontend/src/api/client.ts
frontend/src/api/schema.d.ts
frontend/src/components/AssetDrawer.tsx
frontend/src/features/assets/Assets.tsx
frontend/src/features/assets/VulnerabilityEvidence.tsx
frontend/src/features/assets/vulnerability.css
frontend/src/features/intelligence/Intelligence.tsx
frontend/src/features/methodology/Methodology.tsx
frontend/src/hooks/vulnerability.ts
frontend/tests/api.test.ts
```

## Phase 5A hardening

```
backend/app/services/remediation.py
backend/tests/test_phase5_hardening.py
docs/PHASE_5A.md
backend/app/api/insights.py
backend/app/api/workflow.py
backend/app/main.py
backend/app/schemas/models.py
backend/app/schemas/simulation.py
backend/app/services/simulation.py
backend/ml/inference.py
backend/ml/matching.py
backend/tests/test_workflow.py
docs/openapi.json
frontend/src/api/schema.d.ts
```
