# Phase 1 verification record

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
