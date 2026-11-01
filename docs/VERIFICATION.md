# Phase 1 verification record

## SOC publication and latest remote integration — 1 November 2026

- Created docs/SOC_ATTACK_DEMO.txt with six named demonstrations, five exact node IDs,
  vulnerable/protected prerequisites, copyable Laptop 2 commands, expected outcomes,
  connectivity checks, live SOC/map/planning flow and IP block/unblock steps.
- Fetched origin, inspected the newer `report` branch and safely merged 116f7bd/0f6acda
  into the preserved SOC checkpoint 1645d45. No conflicts, force push or main changes.
  Latest remote removals/simplifications are preserved, not silently restored.
- What-If content is unchanged throughout this request; before/after Git blob:
  54e6eb7bfcbfe5d731d712b27be61e9fac39883c. No new Simulator edits or model retraining.
- Merged `npm test`: **71 passed**, five files, **15.31s**. The count differs from the
  earlier 79 because the fetched branch intentionally removed obsolete module tests.
  `npm run typecheck` passed; `npm run build` passed (**3056 modules, 15.85s**) with
  the inherited chunk-size advisory. `ruff check backend scripts/export_openapi.py`
  passed; `git diff --check` passed. No backend/model/data files differ from the
  previously verified checkpoint; those suites were not unnecessarily repeated.
- Pending-source credential-pattern scan: **0 matches in 37 files** before checkpoint.
  Generated node password, SOC database and frontend build remain ignored. Final staged
  files are checked again before publication. Demo weak credentials are intentional,
  explicitly fictional service fixtures, not operator or infrastructure secrets.
- Browser automation remains unverified under the previously recorded origin policy.
  No new real-browser pass is claimed. Services remain on 8005/8006; reload once for
  the new build. Actual manual second-device checks were reported by the user earlier.

## Live SOC unification and incident workflow — 1 November 2026

Local `codex/live-soc`, base da2f307. No commit/push/merge. Existing working SOC files
were extended in place; unrelated UI/theme, datasets, model artifacts and engine code
were preserved.

- `python -m pytest backend/tests/test_soc.py backend/tests/test_soc_analysis.py backend/tests/test_phase5_hardening.py -q -s`
  passed **69** tests in **139.60s** before the final weak-login integration case was added.
  Final `python -m pytest backend/tests/test_soc_analysis.py -q -s`: **9 passed, 13.57s**,
  including the added case. These selected suites now comprise **70 distinct passed tests**
  (22 SOC + 9 incident analysis + 39 existing remediation guards). One inherited
  Starlette/httpx deprecation warning. Logs: ignored artifacts/soc-connected-verification.log
  and artifacts/soc-analysis-final.log. The earlier full-backend gate was 280 passed;
  the entire backend was not unnecessarily repeated for this additive UI/bridge batch.
- `npm test`: **79 passed**, five files, **7.07s**. Covers live event deduplication,
  severity/critical alerts, desktop permission behavior, directed real-neighbour coloring,
  absent-baseline creation, exact-run automatic What-If navigation, stale result removal,
  errors, history, blocking/protection and prior frontend workflows.
- `npm run typecheck` passed. `npm run build` passed, **3059 modules, 10.57s**;
  existing large-chunk advisory remains. Backend Ruff check passed; all eight SOC Python
  source/test files passed Ruff format check. Generated OpenAPI/TS were refreshed in order.
- Full frontend `format:check` reports **10 pre-existing, untouched files**:
  components/anatomy/SubstationViewer.tsx, components/hospital/HospitalViewer.tsx,
  components/Simulation.tsx, components/smartcity/SmartCityViewer.tsx,
  components/transit/TransitViewer.tsx, components/waterplant/WaterPlantViewer.tsx,
  features/digital-twins/TwinFlow.tsx, features/methodology/Methodology.tsx,
  features/overview/ActivityHeatmap.tsx, styles/index.css. They were not reformatted.
  Modified frontend files were formatted separately. `git diff --check` passed.

Actual saved-model results, not UI fixtures: `kev-signal-v1`, WTR-005 risk **10.0**,
city **35.62 → 35.62** under its selected controls; PWR-001 weak login risk **97.29**,
city **35.62 → 33.14**. Original baseline equality and exact replay through the existing
What-If endpoint were verified. The attack does not retrain the model or raise its score.
No CVE-specific patch is inferred from generic access evidence.

Production launcher readiness passed after restarting only the two verified SOC process
trees. Both 8005 and 8006 listen, and both services report startup complete. Existing
databases, profiles and blocks were retained; unrelated server processes were preserved.
Actual second-laptop probes from 172.19.245.41 were present in the earlier live evidence.
The user reports the scripts now work, but the newly added visual/notification workflow
still needs manual two-device inspection. Browser automation remains blocked by the
previous saved origin-access policy; no alternate browser/rendering bypass was attempted.
Automated React tests are not claimed as real-browser/mobile/WCAG verification.

## Phase 5 final integration — 1 November 2026

Source: `integration/phase-5`, verified base 8ea1689, backend 33ed965 and frontend 50f65e9, both preserved through Claude's a5bac82 merge. No conflict required dropping a feature. See [PHASE_5_INTEGRATION.md](PHASE_5_INTEGRATION.md) and [PHASE_5_DEMO.json](PHASE_5_DEMO.json).

- Complete backend: `.\.venv\Scripts\python.exe -m pytest backend/tests -q --tb=short` → **180 passed**, 364.05s; one upstream Starlette/httpx deprecation warning. No skipped ML-backed tests and no retraining.
- Complete frontend: `npm test` → **49 passed**, including exact run/fingerprint binding, options scoping, patch parameters/nulls, constraints, stale results, partial/full handoff with prerequisite closure, structured issues and wrong-run/fingerprint response rejection.
- `npm run typecheck`, `npm run format:check`, `npm run build`: passed. Frontend lint/style uses configured Prettier; there is no separate ESLint task. Ruff lint and formatting check passed for all 73 Python files. Exported OpenAPI and regenerated TypeScript from the merged backend.
- **24 live API probes passed**: exact plan replay, constrained replay, effort budgets, exclusions, default/explicit/target-version patch evidence, unknown/missing/stale runs, snapshot/fingerprint mismatch, duplicate actions, invalid exclusions and impossible maintenance windows. Full latest-run payload equality before/after proved baseline immutability. Deliberately creating a new simulation made old What-If and options requests return 409 `stale_baseline`; wrong fingerprints returned 409 `baseline_fingerprint_mismatch`.
- Browser actual local workflow: Live Simulation completed all seven stages (cold simulation 26.2s). Clicked HLT-001 into its filtered register, with calculated workflow risk and separate curated evidence; no API-route-not-found error. Generated 60h Fix Plan: **35.62 → 27.72**, 56h effort, 14h downtime, three steps (HLT-008/PWR-008 segmentation and HLT-007 patch). Full handoff preserved all three exact CVE IDs and produced the same index with seven changed assets. NVD fixed-version evidence was expanded and read.
- Changed maintenance inputs: plan immediately OUTDATED, comparison/transfer controls hidden. Replaced run: explicit baseline-review block. One-hour maintenance window: real HTTP 422 `constraint_violation`, with `actions[0..2]` and `exceeds_maintenance_window` explanations. Reviewed latest baseline, cleared limits and successfully recalculated 27.72. Expected validation HTTP errors are distinct from app/runtime failures.
- Actual compiled SPA on port 8000: PWR-001 access control reproduced **35.62 → 35.05**, 12h. Mobile 390×844: constrained plan with HLT-008 excluded, 2h single-action window / 4h total downtime produced **35.62 → 33.87**, 32h effort / 4h downtime. Full transfer/recalculation preserved constraints and matched 33.87. Both dev What-If and compiled mobile Fix Plan measured client width = scroll width = 375. Viewport override reset afterward. Compiled browser captured no warnings/errors.
- Local ignored visual evidence: `artifacts/screenshots/phase5-integrated-comparison.jpg`, `phase5-stale-baseline.jpg`, `phase5-constraint-error.jpg`, `phase5-whatif-mobile.jpg`, `phase5-production-comparison.jpg`, `phase5-constrained-mobile-plan.jpg`, `phase5-constrained-mobile-comparison.jpg`. Actual UI values were read; browser checks were not inferred from tests/build.
- Security/Git preflight: 526 reachable blobs and 233 current tracked/nonignored files scanned, zero credential-pattern or sensitive-file findings. Integration-only diff contains no backend, model or scenario changes beyond the preserved feature histories. Structured issues render as React text; every action POST carries the run binding. Reviewed as a local integration, without claiming a full penetration test. Only `integration/phase-5` is authorized for push; main, the Phase 3 baseline and both feature branches are preserved.

Remaining inherited limits: process-memory run/history storage, numeric version matching, fixed planning costs, no calendar/process-safety simulation, greedy non-optimality, uncalibrated relative risk, conditional-impact upper bounds and no actual remediation/verified state. See the runbook for the Phase 6 readiness assessment. No Phase 6 implementation or external deployment was performed.

## Phase 5B frontend verification — 31 October 2026

Source branch `feature/phase-5-frontend`, exact base `8ea1689b81ecd2144219d4446bd1fcb79564379e`. See [PHASE_5_FRONTEND.md](PHASE_5_FRONTEND.md) for contract coordination, scope and reproduction. Backend/ML/generated contracts were unchanged.

- Frontend `npm test`: 36 passed (26 new workflow tests plus the existing 10 boundary tests). Covered stale budgets/exclusions/baselines, in-flight changes, exclusion search/removal/validation, empty/error/retry states, single/full/subset routed handoff, unsupported actions and actual typed request keys.
- `npm run typecheck`, `npm run format:check` and `npm run build` passed. There is no separate ESLint task; Prettier is the configured source style check. Test dependencies use a jsdom version compatible with the documented Node.js 22.20 minimum. Tests/build were run on Node 24.20.0.
- Actual desktop browser: Live Simulation completed all seven stages; actual simulation 9.2s, baseline city 35.62, nine critical assets. HLT-001 opened the filtered register with calculated workflow risk and separate curated assessment, without API-route-not-found errors.
- Actual Fix Plan: searched/selected two exclusions, removed one, generated 60h plan with WTR-002 excluded. Three actions used 56h: HLT-009 patch, HLT-008 segmentation, PWR-008 segmentation. Backend projection 35.62 → 26.30. Editing the budget immediately marked it OUTDATED and hid old comparisons/transfer controls. Restoring the exact old inputs allowed their matching plan to be reviewed again.
- Full-plan handoff staged all three actions without automatic calculation. Explicit What-If calculation reproduced 26.30 (9.32 points / 26.17% reduction), seven changed assets and real service values (100% → 100% worst plausible disruption for each service; no verified recovery claimed).
- Mobile 390×844: What-If and Fix Plan document client/scroll widths both 375, with inner table overflow contained. On mobile, an 8h plan excluding WTR-002 transferred HLT-009 patch alone; explicit calculation returned 35.62 → 33.59 (2.03 points / 5.70%, 8h). Desktop viewport override was reset afterward. Audit tab captured no warning/error logs.
- Local ignored screenshots: `artifacts/screenshots/phase5b-outdated.jpg`, `phase5b-comparison-desktop.jpg`, `phase5b-whatif-mobile.jpg`, `phase5b-plan-mobile.jpg`, `phase5b-final-comparison.jpg`. The final desktop comparison was visually inspected.

Limits: full backend/model evaluation was not rerun for this frontend-only change. No unfinished hardening branch was merged. Atomic server binding, patch/fixed-version verification and maintenance constraints await the backend contract; best-effort client baseline checks do not eliminate server races. No durable saved plans or actual remediation was introduced.

## Final late-push synchronization

The user's all-branches instruction also covered new pushes discovered in the final refresh: readable Live UI `7f09433`, attack-path analysis `ce13015`, and combined/force-graph history `3983920`. [REMOTE_BRANCH_SNAPSHOT.json](REMOTE_BRANCH_SNAPSHOT.json) records the exact fetched heads. Final full backend run: **141 passed**, one existing Starlette/httpx warning. Frontend: **10 passed**, typecheck, Prettier and production build passed. The D3 graph chunk configuration was updated from the obsolete Cytoscape entry, removing the empty-chunk build warning.

The additional four browser routes (Live Simulation, Trends & Activity, Weak Points, Challenge Coverage) loaded actual data, bringing browser route coverage to fourteen. Live Simulation completed all seven steps against the actual local API: health, ML simulation, simulated activity, conditional chokepoints, supplier what-if, existing optimizer and risk brief. Latest cached-date index: **35.62**; nine critical assets; one simulated anomaly; eleven single-failure chokepoints; fourteen suppliers; projected three-action plan approximately **27.5**. The six added insight/attack-path GET endpoints returned 200. Existing ML artifacts/features/dependencies were unchanged by these late merges. Browser focus/navigation interruptions were recovered through fresh observations and direct navigation to known local routes. No browser warnings/errors were captured after the new page checks. These results supersede the smaller earlier test counts below.

## Phase 3A and latest-repository integration — 31 October 2026

See [PHASE_3_INTEGRATION.md](PHASE_3_INTEGRATION.md) for fetched SHAs, two explicit assessment contexts, actual predictions, metrics, commands and limits. All fetched branch heads are ancestors of local `integration/phase-3`; no remote push/main merge occurred. Local SQLite was explicitly selected.

- Full combined backend suite: **100 passed**, one pre-existing non-failing Starlette/httpx warning. A semantic integration defect initially mixed curated risk into the workflow-only `AssetDetail.risk`; separating the contracts fixed it. Follow-up focused tests for final model-verification metadata and contracts: **40 passed**. PowerShell setup/start syntax and both cached reference datasets also passed validation.
- Frontend API tests: **10 passed**, including context-scoped intelligence reads, unavailable=null and stale-evidence errors. Strict typecheck, Ruff lint/format, Prettier and production build were exercised. Newly merged twin files required formatting only.
- All **95** original training sources passed SHA-256 verification. Saved-model AP, ROC-AUC and precision/recall@200 metrics reproduced on **147,305** temporal holdout rows under the synchronized dependencies. The record with source/model/runtime hashes is `data/reference/ml-reevaluation.json`. Model artifacts were not retrained or replaced; bootstrap intervals and logistic metrics remain attributed to the original model card.
- Actual API simulation at **2025-01-01**: 30 assets calculated, workflow city index **35.14**, 6 critical/9 high/1 medium/14 low. The curated overlay separately produced 3 calculated/27 unavailable, mean **63.0718**; HLT-001 used actual native CVE model signal **0.07782891392707825**. Backend, frontend and proxied findings returned successful responses. No cloud database was contacted.
- Browser navigation verified all ten routes, both graph modes, risk-source selection and calculated highlighting, asset search and independent risk sorting, expanded vulnerability source SHA-256 evidence, visible workflow risk, curated factor explanations and signed tree drivers, live CVE scoring for CVE-2024-26011, model metrics/provenance, and all five twin diagrams plus an overlay control. What-If and Remediation screens loaded their actual workflow baseline; full calculation behavior is also covered by backend tests.
- A broad stylesheet rule from the fetched design hid the workflow score along with notes. A narrowly scoped override restores the score/unavailable block while preserving the redesign. Diagram readings/status/criticality are explicitly labelled static assumptions; ML risk badges are linked to real workflow calculations. Historical UI wording now acknowledges current NVD edits rather than claiming a fully point-in-time archive.
- Initial in-app browser attachment and a native Chrome app-access timeout blocked UI checks. After the user reopened the in-app browser, actual checks completed. A sidebar navigation click required keyboard activation; keyboard navigation succeeded. Browser error/warning log after the successful checks: **empty**. Default viewport document width and scroll width both **1265px**; no separate mobile viewport or full accessibility audit is claimed for this batch.
- Screenshots under ignored `artifacts/screenshots/`: `phase3-force-graph.jpg`, `phase3-overview.jpg` and `phase3-curated-intelligence.jpg`. These are actual running UI captures, not mockups.

No new later-phase engine was developed. Existing action/optimizer and deployment code was preserved by the user's explicit all-branches synchronization request. Live PostgreSQL/cloud deployment, model calibration, bootstrap-CI regeneration, logistic retraining, real-world exploit verification and infrastructure changes were not performed.

## Local Phase 2 integration — 31 October 2026

See [PHASE_2_INTEGRATION.md](PHASE_2_INTEGRATION.md) for exact integrated SHAs, API/browser observations, impact output, dependency fix and launch commands. Combined backend suite: **65 passed**, one existing deprecation warning. Frontend: **8 passed**, typecheck, Prettier and production build passed. Ruff lint/format and pip dependency compatibility passed; the reformatted foundation test file was rerun (**22 passed**). All seven browser routes, separate graph modes, real vulnerability source evidence and both actual impact demonstration commands were exercised. An obsolete running Phase 1 backend caused the register's route error; restarting the confirmed project processes resolved it. No impact API/UI or Phase 3 implementation was added. Historical verification below remains unchanged.

## Phase 2A verification — 31 October 2026

The historical Phase 1 record below is preserved. Phase 2A was verified on feature/vulnerability-assessment without edits to shared models.py, engine/ or ml/.

- Full backend suite: **42 passed**, including Phase 1 regressions and new ingestion, conservative matching, numeric version bounds, unsupported compound/platform rules, absent/unknown software, separate configuration/exposure rules, checksums, atomic failed import, snapshot staleness, idempotence, reset cascade and degraded-cache availability tests. The Phase 1 asset-detail test now expects real evidence in its unchanged fields while still requiring null/unavailable risk.
- Frontend: **8 tests passed**, strict typecheck passed, production build passed, format check passed. OpenAPI and TypeScript were regenerated from the additive feature contracts. Ruff passed. No dependencies were added.
- Offline CLI import/re-assessment succeeded. The implemented online --refresh command also succeeded against NVD, FIRST EPSS and the official CISA KEV mirror into artifacts/reference-refresh-2a/. The bundled cache was then restored with the offline CLI for reproducible verification. No network is required for default application startup or reads.
- HTTP verification on port 8001: 30 assets; three supported version matches, two candidates, six configuration weaknesses, three exposure indicators and nine reviews. Dataset report stale=false, rules_version=applicability-config-1.0.1; asset risk stayed unavailable. Repeating the assessment POST returned the same run ID and assessed_at timestamp.
- Actual compiled-browser checks: register coverage/row evidence; PWR-001 version matches with CVSS, EPSS date and KEV listing; expanded CPE/source URLs/retrieval dates/SHA-256; PWR-008 unknown-version candidates; HLT-001 outside-affected-version evidence; WTR-006 identity unassessed and patch-status unknown. Configuration findings remained separate from CVEs and risk stayed unavailable.
- All seven routes were navigated after backend restart. The captured browser log contained no errors/warnings. Desktop 1440×1000 and laptop 1366×768 rendered; mobile 390×844 had document client/scroll widths 375/375 and drawer widths 374/374. Screenshots phase2a-register.jpg, phase2a-evidence.jpg and phase2a-mobile.jpg under artifacts/screenshots were visually inspected.
- An initial attempt to bind port 8000 found an existing process. It was left untouched; verification used a separately owned server on port 8001.
- One existing non-failing Starlette/httpx test-client deprecation warning remains. No ML evaluation, asset risk, cascade, What-If or optimizer result was calculated. Cached reference coverage and authored software declarations are explicitly limited in PHASE_2A.md. A full accessibility audit, live scan and exhaustive CPE applicability validation were not performed.

Reference JSON is marked -text in .gitattributes so Git cannot change bytes covered by source checksums. Cache integrity is also checked against the staged Git blobs before commit.

---

Executed on 31 October 2026 on Windows with Python 3.12.10, Node 24.20.0 and npm 11.19.0. All assertions below distinguish executed checks from architectural capability. No later intelligence engine was exercised or claimed.

## Installation and launch

- `python -m venv .venv` and installation from backend/requirements.txt: succeeded.
- `npm install`: succeeded. Removed the redundant Cytoscape type stub, added Vitest/Prettier and resolved the type-generator's transitive minimatch advisory with a compatible override. OpenAPI generation/tests/build succeeded with the override.
- `scripts/setup.ps1`: completed successfully using backend/requirements-lock.txt and `npm ci`; 183 npm packages installed, zero npm vulnerabilities reported and idempotent scenario initialization succeeded.
- `python -m pip check`: no broken requirements.
- `scripts/start.ps1`: started the hidden FastAPI process and foreground Vite server successfully. Real browser requests used the Vite API proxy. Ctrl+C stopped the owned processes; subsequent listener inspection found neither task port still listening.
- `scripts/start.ps1 -Production`: built the frontend and started one FastAPI process on 127.0.0.1:8000. `/infrastructure` returned HTTP 200 and the browser loaded the actual compiled graph and API data from this same origin.

An early production-build attempt overlapped the still-running `npm ci`, while TypeScript's executable was temporarily absent. The attempt failed honestly and was rerun successfully after installation finished. No dependency workaround was committed for this sequencing error.

## Automated checks

`scripts/check.ps1` completed successfully after the final application changes:

- Ruff check of backend and OpenAPI exporter: passed.
- Backend pytest suite: **22 passed**. Covers health, 30 unique/context-scoped assets, filters, details, null risk, both graphs and exact edge counts, redundancy/backups, 404/422 envelopes, all three 501 future routes, invalid what-if input, seed/reset identity, dangling references, state/result invariants, aware timestamps, named backup targets, SPA deep links/API separation and database failure.
- Frontend Vitest suite: **7 passed**. Covers scenario/snapshot/AbortSignal propagation, distinct graph-mode requests, structured backend errors, non-JSON and malformed-envelope proxy errors, preservation of null unavailable risk and cancellation without fixture fallback.
- TypeScript strict typecheck: passed separately and as part of `npm run build`.
- Vite production build: passed; graph and chart dependencies emitted as separate chunks; feature routes lazy-loaded. No chunk-size warning was emitted. Compiled assets are ignored by Git and reproducible from source.
- `npm run format:check`: passed. Generated contracts and generated station paths are excluded from manual formatting.
- OpenAPI export and `npm run generate:api`: succeeded; API-boundary tests and the application compile against generated types.
- `python -m app.domain.seed`: generated the fixed source fixture. The tests compare the generated semantic JSON with the tracked fixture, seed twice without duplication and reset to identical documents.
- `node scripts/build-illustration.mjs --audit`: **audit passed**, 56 solids/items, 300 depth-order rules, zero unsupported solids, sunk pairs, clearance, terminal, depth-order, coverage, crowding or other reported failures. No pipes, moving physics, WebGL layers or fabricated readings are present.

The first pytest attempt could not create its sandbox temporary directory; it was rerun with the execution permission needed for temporary test databases. Successful results above are from the completed run. One non-failing Starlette/httpx test-client deprecation warning remains; it does not affect the API or frontend runtime.

## Actual browser smoke checks

Used the available in-app browser automation against both Vite and the compiled FastAPI-served application. Every production route was navigated and its expected heading observed:

- `/`: Command overview, actual 30 assets, three sectors and three service definitions, seven visibly marked sample labels, baseline inventory history and the original SVG.
- `/infrastructure`: Cyber Reachability loaded **30 nodes / 27 edges**. A pointer click on the rendered PWR-001 canvas node populated the inspector. Operational Dependencies loaded **30 nodes / 23 edges**; PWR-007 inspection showed its provider relationships to healthcare and water. Both modes use their own API requests.
- `/assets`: 30 API rows rendered. Sector=water plus type=gateway produced one row; an unmatched search produced a real empty state. Detail drawer displayed product/version, configuration, source, snapshot and null/unavailable risk. Sorting by criticality moved essential assets first. Global search for PWR-001 navigated to a single matching row.
- `/intelligence`: preview ranking and honest model/reference/snapshot empty states rendered.
- `/what-if`: selecting PWR-001 exposed configuration-based actions; staging MFA added one local action; removal returned the count to zero. Current/projected risk remained blank and the simulation button was observed disabled.
- `/remediation`: empty optimizer state and disabled optimization control rendered, without fabricated action reductions.
- `/methodology`: implemented/planned distinctions, provenance, separate graph meanings and risk/probability limitations rendered.

Additional graph interactions: sector filtering to water produced **10 nodes / 6 operational edges**; Enter-to-focus selected WTR-002; zoom-in and fit controls worked; keyboard-native asset selection worked; demo-color toggle retained selection and exposed its sample risk legend. Pointer panning is provided by Cytoscape; a separate drag gesture was not recorded during the smoke test.

Sector highlight buttons changed the figure's selected cabinet and accessible description; the caption count stayed based on API inventory. No animation or telemetry reading was used as evidence of functionality.

## Responsive and failure-state checks

- Desktop viewport: **1440×900**, plus final saved captures at **1440×1000**. Graph, sidebar, controls, inspector and dashboard rendered.
- Laptop viewport: **1366×768**. No document-level horizontal overflow after fixes; viewport width 1366 and document client/scroll width 1351 with the browser scrollbar.
- Mobile viewport: **390×844**. Native menu opened, selecting the register closed it, 30 rows remained visible inside a horizontally scrollable table, and the figure's text wrapped without clipping. Final client width and scroll width were both **375**, accounting for the browser scrollbar. Closed off-canvas navigation is hidden from keyboard focus.
- Initial loading state was observed while scenario APIs were pending.
- With the owned API process deliberately stopped, the UI displayed **API offline**, **Unable to load scenario data**, an HTTP proxy failure message and **Retry connection**. It did not substitute fixtures for failed inventory reads. After restarting the current backend and refreshing through development hot reload, actual inventory/service data recovered. The retry button's separate recovery gesture was not recorded; the error state and recovery were observed.
- The refreshed production browser log contained **no warnings or errors** after navigating all seven routes. Expected proxy errors during the deliberate outage and earlier obsolete wheel-sensitivity warnings are excluded from that clean-production observation; the custom sensitivity setting was removed.

The development browser briefly lost its document during a Vite restart after dependency/configuration changes. A fresh tab in the same browser loaded the ready server successfully. No browser security warning or URL policy was bypassed.

## Saved visual evidence

Local, Git-ignored QA images (all visually inspected):

- `artifacts/screenshots/overview-desktop.jpg`: final compiled command overview, full page.
- `artifacts/screenshots/infrastructure-desktop.jpg`: final compiled operational graph and selected node inspector.
- `artifacts/screenshots/overview-mobile.jpg`: final wrapped mobile figure and sector selection.

## Limits and intentionally absent checks

No physical network disconnection, full accessibility audit, load test, external feed validation, model evaluation, exploit simulation, outage calculation or remediation execution was performed. Offline compatibility is supported by same-origin compiled serving and bundled assets/system fonts; installation still needs package-registry access. Swagger's optional interactive UI uses CDN assets, while the application and raw OpenAPI do not.

No known Phase 1 functional blocker remains. The test-client deprecation warning and absence of later engines are explicitly recorded. See IMPLEMENTATION_PLAN.md for the real validation gates required before claiming those objectives complete.

## Digital twin interaction and connections

Measured: `tsc -b` clean, 7 frontend tests passed, production build succeeded. A scripted browser session against the running app (Edge via DevTools protocol) passed 19 of 19 checks: pin click selects a part, dragging pans without changing selection, wheel and +/0 keys zoom/refit, connection chips select linked parts, Links off / Cyber toggle the overlay, inspector asset button opens the detail drawer, deep links (`?view=&part=`) select a part, a cross-twin chip switches diagram, smart city pins update the inspector, and the infrastructure inspector links to the matching twin part.

Limits: touch pinch and real fullscreen were not exercised; the script drives one desktop viewport. Part-to-part connections are derived from the scenario operational and cyber graphs through TWIN_LINKS; within a single twin few parts have both ends mapped, so many parts correctly show no connection. Design-reference values on the diagrams (flow, occupancy, headway) are illustrative, not telemetry, and are labelled as such. Transit has no scored assets.

## Gridinal rebrand and navigation

Measured: `tsc -b` clean, 7 frontend tests passed, production build succeeded. In a real browser session: title reads "Command Overview | Gridinal", sidebar groups (Monitor / Assess / Act) render, clicking Digital Twins navigates and marks it active, the collapse toggle narrows the rail to 78px and shifts the page margin, the choice persists in localStorage, and the mobile drawer opens with the same grouping. Limits: no screen-reader or keyboard-only audit of the new sidebar beyond visible focus styles; supplied wordmark has rough edge noise visible only when enlarged.
## codex/innovations: backend connection (31 October 2026)

- `pytest backend/tests`: 75 passed (includes ML and workflow tests); Ruff check and format clean.
- Against Neon PostgreSQL (Singapore), with the reference cache present: health, ML status, simulation run (8.7 s, process memory about 1.05 GB afterwards), 150 action options, optimizer (1.5 s), ML overview all returned 200. Optimize before a run correctly returns 409.
- Browser: ran the simulation from the Command Overview against Neon; the run completed and the page reported "Simulated as of 2026-10-01". The console showed two HTTP 409 responses (expected: the API refuses simulation-dependent reads before a run exists) and repeated ERR_CONNECTION_REFUSED entries, probably from an initial navigation made before the server finished starting or from stopping it afterwards; this was not re-checked on a clean load.
- Frontend: typecheck, build and 7 tests pass. `format:check` reports 33 files from the digital-twins push; those files were not reformatted.
- Not verified: hosting this backend remotely, concurrent users, other pages beyond the overview.

## Hosted deployment checks (31 October 2026)

- Azure: `/api/v1/health` returned `intelligence: ready`. First simulation run took 69 s (cold data load), later runs 7.7 s; options 7.8 s; optimizer 16.6 to 17.2 s on B1. Optimize before a run returns 409 as designed.
- Vercel to Azure proxy: `/`, `/ml`, health, ML status, assets returned 200; a simulation run through the proxy returned 200 in 8.7 s (warm). The live Command Overview rendered with a computed city risk index.
- Not verified: other pages on the live site, several visitors at once, the first-run cold start through the Vercel proxy, memory headroom on B1 under load, the force-directed map with a run overlay.
- The earlier `codex/deploy` Vercel function deployment was replaced by this one.

## Challenge-gap features verification (31 October 2026)

- `pytest backend/tests`: 95 passed (20 new: telemetry, resilience, insights API, brief). Ruff check and format clean. Frontend typecheck, build, 7 tests pass; the new and edited files pass Prettier (the digital-twins files from the other push were not reformatted).
- Detector on the simulated telemetry: 0 flags on 800 clean asset-days; all four malicious authored events flagged; the benign maintenance event flagged (a documented false positive). These results validate the mechanics on simulated data only, not real-world detection performance.
- Real outputs: 11 of 30 assets are chokepoints; vendor scenarios and KEV counts computed from the product map and the cached KEV file; trend of 18 monthly points from 33.6 (2025-05) to 35.6 (2026-10), with criticals rising from 6 to 9.
- Browser (local, real API): Posture, Resilience (both tabs) and Coverage rendered with real data; running the simulation enabled the brief downloads; the Markdown brief was fetched and read: ranked assets, drivers, services, activity with urgency, vendors, chokepoints, optimizer actions labelled projected, assumptions. The only console error was a 409 from a page load before the first run.
- Not verified: the new pages on the hosted site (see deployment notes), mobile layout, accessibility audit of the new tables and charts, the brief's HTML rendering in a browser.

Hosted checks (31 October 2026): on Azure, `/activity`, `/activity/assets/PWR-002`, `/resilience/vendors`, `/resilience/chokepoints`, `/simulation/trend` (18 points) returned 200; the brief returned 409 before a run, then 200 after a run (31 s on the B1 plan, 28.7 s through the Vercel proxy); urgency became available after the run (PWR-002: risk 11.56, urgency 17.34). Through Vercel, `/posture`, `/resilience`, `/coverage` and the API endpoints returned 200 and the live Posture page loaded with no console errors. Not verified: the brief under concurrent use, mobile layout.

## Phase 5A hardening verification (31 October 2026)

- `pytest backend/tests`: 180 passed (39 new in `test_phase5_hardening.py`: run binding, duplicates, unknown assets and exclusions, parameter and precondition errors, CVE-specific patches, fixed-version and target-version evidence, constraints, overlap, immutability, budget, determinism, prerequisites, hand-off). Ruff check and format clean; `docs/openapi.json` and `frontend/src/api/schema.d.ts` regenerated.
- Real HTTP against uvicorn: missing run id (422), unknown run (404), duplicate plus unknown asset (422, two issues), unsupported CVE (422), unknown exclusion (422), valid patch with remediated/not-remediated CVEs (200), downtime limit (422), 60 h plan (200), stale run after a re-run (409).
- Reference scenario: baseline 35.62 reproduced; plan 35.62 -> 27.72, 3 steps, 56 h (was 25.90, 5 steps). Explanation in `docs/PHASE_5A.md`.
- Frontend: typecheck fails in `Remediation.tsx` and `hooks/liveSimulation.ts` because `run_id` is now required (Codex-owned, not edited). Build and frontend tests were not run on this branch.
- Not verified: behaviour against the Postgres store, concurrent runs during a planning request.


## Phase 6 final verification — 1 November 2026

Authoritative current delivery: [FINAL_DEMO_RUNBOOK.md](FINAL_DEMO_RUNBOOK.md),
[PHASE_6_MODULE_AUDIT.md](PHASE_6_MODULE_AUDIT.md), measured
[PHASE_6_DEMO.json](PHASE_6_DEMO.json) and
[PHASE_6_MODEL_EVALUATION.json](PHASE_6_MODEL_EVALUATION.json).
Branch `feature/phase-6-finalization` was created from verified
`origin/integration/phase-5` at `62dece9793b3b0a901091bbd80bd6860a6ef69b8`.
The initial working tree was clean. Fetched remote work was inspected; unrelated branch
advances were not merged into the verified base. Earlier phase records above are historical.

### Code gates

- Full backend: **190 passed**, no skips, one upstream Starlette/httpx deprecation warning.
  Final complete run took **561.59s** on this loaded Windows laptop; an earlier complete run
  of the same backend changes passed in 199.41s. New Phase 6 tests cover exact path context,
  cyber-edge-only traversal, isolation/immutability, invalid parameters, fingerprint/snapshot
  mismatch, superseded runs and missing-reference failure without a score. The existing
  39 Phase 5 hardening tests protect patch evidence, constraints and handoff.
- Full frontend: **85 passed** across three files; final rerun **16.14s**. Adds 36 tests
  across Phase 6 boundary tests and the API client case, including actual brief fetching/run
  validation, cached error/scenario guards, report mismatch, isolation/empty/retry and
  data-backed module loading/failure handling. Diagram mocks are confined to unit tests;
  the browser audit uses actual SVGs and the actual API.
- Strict TypeScript and frontend Prettier checks run over source/tests/Vite configuration.
  Ruff lint and format checks passed over backend, OpenAPI exporter and the new verifier:
  **76 Python files already formatted**. There is no separate ESLint task in this repository.
  OpenAPI was exported, TypeScript regenerated, and a fresh in-memory backend export matched
  docs/openapi.json exactly. No hand-authored generated declarations or dependency changes.
- Production build passed (2602 modules), including the new lazy Attack Paths view and the
  responsive canvas repair. The compiled application served by FastAPI was also exercised.

Verification attempt notes: a restricted-shell pytest temp directory could not be created;
that attempt did not pass. A subsequent restricted run stalled and was stopped only after
verifying its exact owned pytest process. The final complete backend run used a fresh,
validated workspace directory under ignored artifacts/ outside that restriction. A parallel
frontend/build attempt timed out one existing 5s UI test under load (84 passed, one timeout);
the serial complete reruns passed all 85 with assertions/timeouts unchanged. The last ML
wording edit required Prettier; the frontend gates were rerun after formatting. None of these
failed attempts is counted as a passing gate, and no result was replaced with a fixture.

### Real model and API evidence

- Saved-model reevaluation without fetch or retraining verified **95 source checksums** and
  **147,305 test rows**, reproducing point metrics and model hashes. Deployed AP **0.0037**,
  AUC **0.8789**, precision@200/month **0.0119**, recall@200/month **0.0532**. EPSS baseline
  AP **0.0044**, AUC **0.7290**. Original model-card AP CI [0.0023, 0.0071] and paired delta
  CI [-0.0141, 0.0017] were preserved, not recalculated. No clear AP improvement over EPSS
  is established. No model, training source, original inventory or pure engine file changed.
- **35 live API checks passed** with scripts/verify_demo.py --replace-baseline. Earlier
  no-replacement pass had 32 checks. These include all data-backed modules, actual inference,
  both graph APIs, attack consequences/isolation, plans, exclusions, budget/constraints,
  exact What-If replay, invalid isolation/patch/incompatible actions and fingerprint mismatch.
  Baseline payload was identical before/after projections. A new run with the same fingerprint
  made the old bound attack-path and plan requests return **409 stale_baseline**.
- Default October 2026 baseline **35.62**; 60h plan and replay **27.72**, three steps, **56h
  effort / 14h downtime**. Segmentation HLT-008 and PWR-008 plus the evidenced HLT-007 patch.
  Fifteen candidate paths; PWR-008 isolation leaves ten. The example path uses cyber-PWR-1-4
  and cyber-PWR-4-8, not operational edges. Conditional data-integrity service upper bounds
  remain 100%; this is not a probability or a claim of verified recovery.

### Actual browser observations

- All **14 assigned modules plus Attack Paths** opened at desktop and mobile widths; specific
  actions/source distinctions and boundary checks are enumerated in PHASE_6_MODULE_AUDIT.md.
  Desktop document client/scroll width **1265/1265**; mobile viewport **390x844**, document
  **375/375**. No document-level horizontal overflow in recorded checkpoints. Wide tables
  remain internally scrollable. This is browser viewport testing, not a physical touch device.
- Full Live -> PWR-001 register/drawer -> selected ranking -> PWR-008 attack path -> operational
  graph -> 60h Fix Plan -> exact What-If calculation reproduced 35.62 -> 27.72. The obsolete
  asset-register API-route error did not occur. The final brief stage made its actual GET.
- Attack filters/isolation/empty recovery, graph mode/sector/native inspector/fit/zoom,
  mobile menu close, curated POST/no-match search, invalid CVE scoring/valid score recovery,
  all five twins/part selectors/layers/zoom/expand, vendor view and keyboard PWR-002 activity
  inspection were exercised. Fixed-canvas clipping was found visually and repaired; actual
  fitted SVG bounds checked in all five mobile diagrams and desktop views.
- Compiled port-8000 app repeated the path -> plan -> projection flow. Editing the patch hid
  the previous comparison; unsupported CVE returned structured 422 invalid_actions without
  losing three staged actions. A 1h maintenance window returned per-action 422 constraint
  issues. Restoring valid inputs permits recalculation. Prior clean compiled navigation
  had no console warnings/errors; expected deliberate 404/422 validation responses are
  distinct from application faults. Model/API unavailable states are automated boundaries,
  not falsely claimed as forced through every real-browser module.
- Ignored screenshots visually inspected: phase6-attack-paths-desktop.jpg,
  phase6-attack-paths-mobile.jpg, phase6-projection-desktop.jpg, phase6-projection-mobile.jpg,
  phase6-final-projection.jpg, phase6-twin-desktop.jpg and repaired phase6-twin-mobile.jpg
  under artifacts/screenshots/. Browser checkpoints are in artifacts/phase6-browser-audit.json.

### Delivery review and readiness

Reviewed thin API context validation, existing run-bound POSTs, escaped structured errors,
reference provenance, generated contract coherence and absence of engine/model changes.
Credential-pattern preflight scans reachable Git history plus all tracked/nonignored working
files; no matches or sensitive tracked files were found. Databases, local environments,
reference cache, build output and transient QA evidence stay ignored. The targeted review
is not a penetration test or proof that every possible credential format is absent.

Ready for the documented local hackathon demonstration. Remaining limitations include process-local
shared latest-run state, coarse candidate-path/control evidence, numeric vendor-version matching,
uncalibrated relative risk/ML output, conditional worst-plausible service bounds, heuristic optimizer
and fixed effort/downtime assumptions. No real scanning, compromise, remediation execution,
production load/concurrency, hosted release, full accessibility audit or physical offline test is
claimed. Original objectives and all earlier implementation history remain preserved.


## Phase 7 preventive resilience verification — 1 November 2026

Branch `feature/phase-7-resilience-optimizer`, from exact Phase 6
`91f2ab55fc0b32af0b4cca2c88d6ca8bb7784b42`. Backend-only delivery, local commit;
no push or merge is authorized. Read PHASE_7_RESILIENCE_ENGINE.md for the exact architecture,
contracts, synthetic assumptions, limitations and reproducible demo command.

- **247 backend tests passed**, no skips, **354.57s**. **57 new tests**: 18 deterministic
  continuity cases, four exact optimizer cases and 35 real-model/Aurora API/boundary cases.
  Existing risk/What-If/attack/impact/ML tests remain intact. One non-failing upstream
  Starlette/httpx deprecation warning remains.
- **85 frontend tests passed**, three files, **12.01s**. No UI source was changed. The sole
  frontend diff is generated OpenAPI declarations; no test timeout/assertion was relaxed.
- Full scripts/check.ps1 exited **0**: strict TypeScript, Ruff lint/format (**85 files**),
  frontend Prettier and Vite production build (**2602 modules**, **18.55s**).
- Source-contract audit proved **34 old API paths and 113 old schemas identical** after
  regeneration. Original impact/attack/risk/pivot/remediation/simulation algorithms, original
  datasets, ML files and artifacts were compared unchanged against 91f2ab55. No package or
  dependency version changed. Raw backend OpenAPI and generated declarations are synchronized.
- **12 live HTTP checks passed**, using scripts/demo_resilience.py against an isolated
  FastAPI instance on 127.0.0.1:8001 with artifacts/phase7-api-demo.sqlite3. It did not reset
  the running app's database or in-memory run. Saved real outputs are summarized in
  PHASE_7_DEMO.json; full responses/logs stay ignored under artifacts/.
- Real 360-minute PWR-008 power-loss case: **360 -> 90 service-minutes** with prepared
  recovery; exact search of eight subsets selects recover-PWR-008, **4 planning credits /
  8h effort / 1h maintenance downtime**. These are synthetic cost/restore assumptions,
  not observed savings or verified hardware recovery.
- Fixed backup-extension plan nominal **90** service-minutes; forced backup failure
  **1080**, half stored energy **360**, additional WTR-008 hardware failure **750**.
  Cyber-only PWR-004 isolation cuts the explicitly scoped PWR-001->PWR-008 integrity
  challenge, yielding zero residual service-minutes for that scenario only.
- Existing Phase 6 results reproduced in tests AND live HTTP: **35.62** baseline,
  **27.72** original 60h risk plan/What-If, **56h** effort and **15** candidate paths.
  Latest-run payload equality confirmed new calculations and projections are immutable.
- Negative tests cover missing/unknown/stale/mismatched run/fingerprint, changed catalog,
  replacement during calculation even with identical IDs/scores, missing references (503
  without a result), invalid/duplicate/unknown actions/events/scopes, invalid patch-CVE
  attribution, unsupported edge effects/exposure, negative/nonfinite/string/boolean numeric
  values, backup exhaustion, dependency grace/recovery, cycles, capacity limits and exclusions.
  A hand-calculable synergy case proves the search does not just add standalone reductions.

Progress audit after the intentional interruption: at 04:24:43 IST, backend and frontend suites,
Ruff, typecheck and Prettier were already finished. The overall check runner was PID 30412;
its current build TypeScript worker was PID 31732 (started 04:24:42), so it was not stalled.
The build progressed to Vite rendering and finished; the runner started 04:18:05 and the log's
last update was 04:25:18, approximately **7m13s** total. No test rerun or source change was needed
for recovery. The quiet logs establish the latest completed frontend suite and counts but do
not preserve its exact final individual test name. The final backend test in source collection
order is test_workflow.py::test_cve_scoring_endpoint; all backend cases passed with no skips.

The isolated QA launcher/server were PIDs 14780/33900. They were used only for the outstanding
HTTP verification and then stopped after ownership/port checks. The original port-8000 app
and separate port-8011 teammate instance were left untouched. No UI file was modified during
this progress-audit continuation, and no already-passed test suite was repeated.

One early new API test requested unavailability on the HLT-001->HLT-007 route; the real graph
only supports control/visibility there. The API correctly returned unsupported_challenge.
The test was corrected to use the actual declared loss-of-control effect; fixed-version CVE
attribution remains an explicitly unverified user scenario assumption, not exploit evidence.
All final new/full test gates passed afterwards.

Delivery is a deterministic local prototype, not a real resilience guarantee. Exact optimality
is limited to at most 12 submitted catalog candidates and the declared service-minute objective.
Energy derating is runtime at nominal full output, not physical power/load-flow simulation.
Recovery targets, costs, topology/control assumptions, pre-incident downtime and standby
allocation limitations are documented. No UI, physical recovery, load/concurrency, hosted
release or security penetration test is claimed. Credential-pattern and scope review precedes
commit; environments/databases/cache/build output/QA logs remain ignored.


## Phase 8 interactive resilience UI — 1 November 2026

From exact Phase 7 ec1ed80174817b42886914c302a93136bc62beba, local branch
feature/phase-8-resilience-ui. No backend, API schema, original graph, dataset, model artifact,
package version, theme or landing-page change. Full modified-file inventory is FILE_MANIFEST.md.

- Full backend regression: **247 passed**, no skips, **295.18s**; one existing upstream
  Starlette/httpx deprecation warning. Ruff lint/format passed (**85 files**).
- Full frontend regression: **99 passed**, four files, **11.88s**, including **14 new** planner
  cases. Strict TypeScript, frontend Prettier and production build passed (**2607 modules,
  9.02s**). No separate ESLint task exists. The earlier 12-case planner set passed before
  adding explicit wrong-graph-type and catalog-fingerprint rejection tests.
- New tests protect exact request identity/action transfer, changed baselines, late responses,
  scenario/budget invalidation, invalid API responses, structured errors/retry, missing baseline,
  catalog failure/retry, event play/pause/scrub/replay, graph separation, simultaneous events
  and horizon-truncation semantics. Test fixtures are isolated from application data.
- Actual compiled browser: Live Simulation completed, followed by PWR-008 power-loss simulation,
  actual optimization and fresh protected replay **360 -> 90** service-minutes. Recovery selected
  **4 credits / 8h effort / 1h downtime**. The existing D3 node for PWR-008 changed red -> green
  at the API's minute-30 boundary. Native inspector/fit and Play/Pause/Next controls worked.
- Actual standby-extension alternative selected **12 credits / 16h / 2h**, nominal 90 minutes;
  half-energy stress returned **360**, extra 270. Forced standby unavailable with the recovery
  plan returned **180**, extra 90. Zero-credit optimization returned an empty plan and replay
  **360 -> 360**. No fallback constants supply these values.
- Actual replacement run cleared prior results (no replay slider remained) after baseline check.
  Asset Register drawer navigation retained PWR-008 in the planner selector. Invalid/failed API
  boundaries are automated tests, not claimed as all deliberately induced in the real browser.
- Mobile viewport **390x844**, document client/scroll width **375/375**. Controls wrap, native
  inputs and energy range keyboard controls worked. Menu opening was observed; a browser
  navigation automation issue required restoring the planner URL. No full menu/WCAG/touch-device
  audit is claimed. The final console had no errors/warnings.
- Existing scripts/demo_resilience.py against the same isolated SQLite API passed **11 HTTP
  checks** without creating its initial run (the browser created it). Phase 6/7 results stayed
  **35.62 -> 27.72**, **15** paths and **360 -> 90** continuity minutes, with baseline payload
  immutability. A later isolated replacement was intentional for the stale-result test.
- Screenshots under ignored artifacts/screenshots/: phase8-desktop.jpg and phase8-mobile.jpg
  were captured and visually inspected. No browser verification was inferred from the build.

The initial test command before continuation was not executed because automatic approval review
had hit a usage limit. The resumed authorized command executed successfully; no approval check
was bypassed. All final gates above passed. The original app/teammate API instances were not
restarted; isolated QA port 8001 uses artifacts/phase8.sqlite3. Restart an older backend from this
branch before using the new frontend with it. The runbook lists exact steps and remaining
prototype limits. New results stay projected/not_verified, and no infrastructure action occurs.

## Phase 8 HLT-001 simulation feedback fix — 1 November 2026

Reproduced HLT-001, local power loss, horizon 360 in the actual compiled planner on local
port 8001. POST /api/v1/resilience/preventive/simulate returned HTTP 200 with matching run,
baseline and catalog fingerprints. The actual outcome was one HLT-001 outage [0,360] and
zero disruption for all three services. This is an asset outage with no propagated service
loss under the current graph assumptions, not a failed request or a recovery guarantee.

Root cause: successful results were rendered only in section 3 after the intervention catalog,
more than 1400px below the viewport top during reproduction; section 1 had no completion
feedback. Brief loading feedback was easy to miss. Added adjacent pending, structured error
and API-derived success feedback, including an explanation for zero service impact. A View
simulation results control focuses and scrolls the existing comparison region into view,
without animation. Run/fingerprint guards, algorithms and API contracts are unchanged.

Verification: 15 focused planner tests passed (9.10s), strict TypeScript, focused Prettier
check and production build passed (2607 modules, 25.83s). Tests cover pending -> valid zero
service outcome with asset outage, nearby structured HTTP 422 error/retry, focus/scroll,
late-response invalidation and the existing planner journey. Initial sandbox attempt failed
before any tests ran because of EPERM on a temporary-file rename; the authorized normal-host
rerun passed. No full backend/frontend regression suite was repeated for this scoped fix.

Actual rebuilt browser: clicking Simulate failure showed HLT-001 completion at viewport
y=420..492 (height 764). View simulation results focused the comparison at y=80. Screenshot:
ignored artifacts/screenshots/phase8-hlt001-feedback.jpg. No code, server, database, branch,
merge or push outside the stated frontend feedback scope was required. Changes remain local.

## Final Resilience Planner UI clarity verification — 1 November 2026

Local branch codex/resilience-planner-clarity, based on verified Phase 8 4e777061. Includes the
previously uncommitted HLT-001 feedback fix. No merge/push, rejected cinematic branch, new
package, backend algorithm, contract, dataset or ML artifact changes.

- Focused planner/shared-module suites: 54 tests passed across 2 files, 12.71s. The 19 planner
  tests were rerun after final result/error wording changes: all passed, 8.70s. No unrelated
  full regression suites repeated. The final sidebar-order/caption adjustment was browser
  verified. Strict TypeScript, Prettier and production build passed (2607 modules, 16.79s).
- Automated boundaries cover exact requests/bindings, stale/late results, invalid API payloads,
  structured failures/retry, zero-service success, separate cyber/operational display inputs,
  evidence-only affected scope, absent standby links and unavailable-vs-zero comparisons.
- Actual compiled browser PWR-008: local power loss, horizon 360, no restoration; unprotected
  360 service-minutes. Defaults 12 credits / 24 engineering hours / 6 shutdown hours selected
  recover-PWR-008 (4/8/1) and fresh replay gave 90. Forcing PWR-010 unavailable under that
  fixed recovery plan gave 180 (extra 90). The final chart visibly shows 360 / 90 / 180.
- Actual HLT-001: same cause/horizon, 1 asset outage and 0 downstream service minutes. Its
  completion feedback, missing after/stress values and comparison remain distinct.
- D3 full operational view: 30 nodes, 23 actual edges, including 3 declared backup edges.
  17 unaffected nodes dimmed in the nominal PWR-008 scenario; affected scope showed 13 nodes /
  15 edges. The separate cyber view had 30 nodes / 27 access connections, with explicit
  non-compromise and non-causal context captions. At API minute 30 PWR-008 changed red to
  green (outage interval ended); no edge travel time was invented.
- Actual map/planner comparison: identical sorted inventories (30 stable asset IDs) and all
  23 operational edge IDs. Shared backup-edge title exposes provider/dependent, requirement
  and 30-minute grace. Map footnote now correctly directs calculation to Resilience Planner.
- Mobile 390x844: document client/scroll widths 375/375. Planner link is now third, after
  Live Simulation: y322..365 within navigation ending at y489. An initial placement beside
  Assets was partially clipped; final ordering fixes that without altering the theme.
  Menu keyboard controls and comparison focus/scroll worked. Temporary viewport reset.
- Browser consoles had no warnings/errors. Screenshots planner-final-comparison.jpg and
  planner-final-mobile.jpg under ignored artifacts/screenshots were captured and inspected.
- Credential-pattern scan passed; protected API/model/data files compared unchanged to Phase 8.

Scope limits: synthetic projections only, no kW/load-flow capacity, verified recovery or real
infrastructure actions. Causal edge IDs are aggregate evidence without per-edge transition
clocks. Cyber context is separate topology, not a compromise simulation. Stress reevaluates
one chosen plan; advanced CVE challenge authoring/scopes remain API-only. No full WCAG,
physical-device, production, concurrency or security penetration audit is claimed.
Demo and implementation notes: RESILIENCE_PLANNER_DEMO.md. Exact modified files: FILE_MANIFEST.md.

## Innovation feature-branch release audit — 1 November 2026

Authoritative target: codex/innovation-phase-7-8, fast-forwarded from remote 4e777061 to
completed 266eace; no merge commit and no main changes. Rejected ffed644 and unrelated
origin/codex/inspo-dashboard-theme (965ddaa) are absent from ancestry and their new UI
components are absent from the tree. Approved Phase 6 color tokens, Overview, entry point,
package manifests and Vite config compare identical. No reverse patch is needed for changes
never integrated. Existing backend/data/schema artifacts are preserved.

Fresh checks: 63 backend resilience tests passed in 22.08s (one inherited deprecation warning),
54 frontend focused tests passed in 10.21s, strict TypeScript/Prettier passed, production build
passed (2607 modules, 10.23s). Real HTTP demo against existing isolated port 8001 passed all
11 checks without creating a new run, including baseline immutability and Phase 6 regressions.
No unnecessary full regression or model training was repeated. See INNOVATION_RELEASE.md
for excluded UI scope, exact included commits and distinctions between stress plans.
