# Phase 1 verification record

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
