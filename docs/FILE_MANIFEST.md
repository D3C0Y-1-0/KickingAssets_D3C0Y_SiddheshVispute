# Phase 1 file manifest

## SOC publication / fetched remote update

Created `docs/SOC_ATTACK_DEMO.txt` and `docs/SOC_REMOTE_SYNC_FILES.txt`. The latter records
the exact 24 source/test paths changed or removed by the fetched report branch relative
to preserved SOC checkpoint 1645d45. README and HANDOFF/VERIFICATION/FILE_MANIFEST record
this release. `frontend/src/features/whatif/WhatIf.tsx` was not changed by synchronization;
its pre-request contents were preserved. All remote UI changes are upstream work, not
a new redesign. Earlier SOC source-file lists below remain applicable.

## Local live SOC and incident integration

Exact created source/doc files relative to da2f307:

- backend/app/api/soc.py
- backend/app/schemas/soc.py
- backend/app/services/soc.py
- backend/app/services/soc_analysis.py
- backend/app/services/soc_gateway.py
- backend/app/soc_targets.py
- backend/tests/test_soc.py
- backend/tests/test_soc_analysis.py
- frontend/src/features/soc/IncidentAnalysis.tsx
- frontend/src/features/soc/Soc.tsx
- frontend/src/features/soc/SocAlert.tsx
- frontend/src/features/soc/evidence.ts
- frontend/src/features/soc/provider.tsx
- frontend/src/features/soc/soc.css
- frontend/tests/soc.test.tsx
- scripts/soc-demo.ps1
- scripts/start-soc.ps1
- docs/LIVE_SOC.md
- docs/SOC_ATTACK_DEMO.txt

Modified source/derived/doc files:

- backend/app/main.py
- frontend/src/api/client.ts
- frontend/src/api/schema.d.ts (generated)
- frontend/src/app/App.tsx
- frontend/src/features/infrastructure/Infrastructure.tsx
- frontend/src/features/whatif/WhatIf.tsx
- frontend/src/main.tsx
- frontend/tests/phase6.test.tsx
- frontend/tests/workflow.test.tsx
- README.md
- docs/ARCHITECTURE.md
- docs/API_CONTRACT.md
- docs/DOMAIN_MODELS.md
- docs/IMPLEMENTATION_PLAN.md
- docs/HANDOFF.md
- docs/VERIFICATION.md
- docs/FILE_MANIFEST.md
- docs/openapi.json (generated)

SOC databases, node password, process metadata, logs and build output remain ignored.
No engine, shared domain/simulation schema, dataset, model artifact, dependency manifest,
approved global theme or teammate branch was modified. No commit/push/merge.

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


## Phase 6 finalization

Exact created/modified files in this readiness batch (historical inventories above are retained):

```text
README.md
backend/app/api/workflow.py
backend/app/schemas/attack_paths.py
backend/tests/test_attack_path.py
backend/tests/test_phase6_readiness.py
docs/API_CONTRACT.md
docs/ARCHITECTURE.md
docs/DOMAIN_MODELS.md
docs/FILE_MANIFEST.md
docs/FINAL_DEMO_RUNBOOK.md
docs/HANDOFF.md
docs/IMPLEMENTATION_PLAN.md
docs/PHASE_6_DEMO.json
docs/PHASE_6_MODEL_EVALUATION.json
docs/PHASE_6_MODULE_AUDIT.md
docs/VERIFICATION.md
docs/openapi.json
frontend/src/api/client.ts
frontend/src/api/schema.d.ts
frontend/src/app/App.tsx
frontend/src/components/AssetDrawer.tsx
frontend/src/components/DiagramViewport.tsx
frontend/src/components/TwinRadar.tsx
frontend/src/components/anatomy/SubstationViewer.tsx
frontend/src/components/hospital/HospitalViewer.tsx
frontend/src/components/smartcity/SmartCityViewer.tsx
frontend/src/components/transit/TransitViewer.tsx
frontend/src/components/waterplant/WaterPlantViewer.tsx
frontend/src/features/attack-paths/AttackPaths.tsx
frontend/src/features/attack-paths/attack-paths.css
frontend/src/features/coverage/Coverage.tsx
frontend/src/features/digital-twins/DigitalTwins.tsx
frontend/src/features/infrastructure/Infrastructure.tsx
frontend/src/features/intelligence/CuratedIntelligence.tsx
frontend/src/features/intelligence/Intelligence.tsx
frontend/src/features/methodology/Methodology.tsx
frontend/src/features/ml/MlLab.tsx
frontend/src/features/posture/Posture.tsx
frontend/src/hooks/liveSimulation.ts
frontend/src/hooks/queries.ts
frontend/src/hooks/twinRisk.ts
frontend/src/styles/index.css
frontend/tests/api.test.ts
frontend/tests/phase6.test.tsx
scripts/check.ps1
scripts/verify_demo.py
```


## Phase 7 preventive resilience optimizer

Exact created/modified files in this backend-focused batch; frontend change is generated contract declarations only.

```text
README.md
backend/app/api/preventive.py
backend/app/engine/preventive_failure.py
backend/app/engine/preventive_optimizer.py
backend/app/main.py
backend/app/schemas/preventive.py
backend/app/services/preventive.py
backend/tests/test_preventive_api.py
backend/tests/test_preventive_failure.py
backend/tests/test_preventive_optimizer.py
docs/API_CONTRACT.md
docs/ARCHITECTURE.md
docs/DOMAIN_MODELS.md
docs/FILE_MANIFEST.md
docs/HANDOFF.md
docs/IMPLEMENTATION_PLAN.md
docs/PHASE_7_DEMO.json
docs/PHASE_7_RESILIENCE_ENGINE.md
docs/VERIFICATION.md
docs/openapi.json
frontend/src/api/schema.d.ts
scripts/check.ps1
scripts/demo_resilience.py
```


## Phase 8 interactive resilience UI

Exact modified/created files:

```text
README.md
docs/ARCHITECTURE.md
docs/FILE_MANIFEST.md
docs/HANDOFF.md
docs/PHASE_8_RESILIENCE_UI.md
docs/VERIFICATION.md
frontend/src/api/client.ts
frontend/src/app/App.tsx
frontend/src/components/AssetDrawer.tsx
frontend/src/features/actions/WorkflowUI.tsx
frontend/src/features/infrastructure/Infrastructure.tsx
frontend/src/features/planner/Planner.tsx
frontend/src/features/planner/Replay.tsx
frontend/src/features/planner/model.ts
frontend/src/features/planner/planner.css
frontend/src/features/planner/queries.ts
frontend/tests/planner.test.tsx
```

## Phase 8 simulation-feedback follow-up

Exact modified files (no backend, schema, algorithm or theme changes):

```text
docs/FILE_MANIFEST.md
docs/HANDOFF.md
docs/VERIFICATION.md
frontend/src/features/planner/Planner.tsx
frontend/src/features/planner/planner.css
frontend/tests/planner.test.tsx
```

## Final Resilience Planner clarity pass

Exact modified/created files, including preserved local feedback fix:

```text
docs/FILE_MANIFEST.md
docs/HANDOFF.md
docs/RESILIENCE_PLANNER_DEMO.md
docs/VERIFICATION.md
frontend/src/app/App.tsx
frontend/src/features/infrastructure/ForceGraph.tsx
frontend/src/features/infrastructure/Infrastructure.tsx
frontend/src/features/planner/model.ts
frontend/src/features/planner/planner.css
frontend/src/features/planner/Planner.tsx
frontend/src/features/planner/Replay.tsx
frontend/src/styles/index.css
frontend/tests/planner.test.tsx
```

## Innovation release exclusion audit

Documentation-only release commit; completed functionality stays exactly at 266eace:

```text
docs/FILE_MANIFEST.md
docs/HANDOFF.md
docs/INNOVATION_RELEASE.md
docs/VERIFICATION.md
```
