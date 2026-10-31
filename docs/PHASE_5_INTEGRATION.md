# Phase 5 final integration — 1 November 2026

Branch: `integration/phase-5`. Verified base: `8ea1689b81ecd2144219d4446bd1fcb79564379e` (`integration/phase-3`).

## Preserved histories and scope

- Claude backend: `33ed965ce9c705725748f14715aee79f4c902dae`.
- Codex frontend: `50f65e9c937cd2d29599f3e3f3d1910d2b7d63c1`.
- At fetch, Claude's remote head was `a5bac82fd2046af4b82bdc21989e343c313732e2`, a merge containing exactly those two feature commits. The new integration branch was created from the verified Phase 3 base and merged that combined history. The separate frontend merge correctly reported already up to date. Both named commits are verified ancestors; neither implementation was dropped and no conflict required deleting a feature.

Integration changes wire the frontend to the actual backend contract and add regression tests/documentation. Claude's engines, scoring formula, model artifacts, original inventory and two separate graphs were preserved. No model was retrained. No branch was rewritten or merged into main.

## Contract integration

Pydantic/OpenAPI is authoritative. Ran `scripts/export_openapi.py` and `npm run generate:api`; generated TypeScript was not edited manually. The remaining generated-file diff against Claude's export is the local framework's 422 response-description wording, not a shape change.

- What-If and optimizer requests send the checked simulation's `scenario_id`, `snapshot_id`, exact `run_id` and `baseline_fingerprint`. Action options supply `run_id`. Live Simulation's internal optimizer call was updated too.
- The frontend compares the fingerprint as part of baseline/result identity and retains pre/post latest-run checks to refresh other-tab changes. Backend run binding rejects unknown, superseded, mismatched and fingerprint-inconsistent requests. It never silently substitutes a new run.
- Fix Plan uses the authoritative `what_if_request`. Full transfer preserves action order, nullable patch parameters and constraints. Partial/row transfer takes the matching server actions, includes prerequisite closure in server order and explains missing/unsupported/inconsistent actions. It does not reconstruct a generic patch batch from step labels.
- What-If supports `cve_ids` and `target_version` for patch actions. It validates request shape and shows the backend's remediated/unresolved CVEs, NVD fixed versions, applicability tiers and reasons. A target version is evaluated against NVD ranges; installation/vendor compatibility is never declared verified.
- Both screens support `max_downtime_per_action_hours`, `max_total_downtime_hours`, incompatible action pairs and prerequisite rules. Input signatures include constraints and patch parameters, so changing them invalidates old projections/plans. The optimizer shows effort, downtime, rejected-candidate reasons, prerequisites and heuristic limitations.
- Shared API errors retain HTTP status, `error.code`, `details` and structured `issues` (path/code/message). The UI renders these as escaped React text, preserves staged actions and supports retry. It does not convert validation failures into successful zero-risk results.

## Actual demonstration results

As-of dataset: **2026-10-01**. Model `kev-signal-v1`, scorer `risk-index-v1`. Baseline **35.62**, nine critical assets, fingerprint `fd5c651c1885ec6b207192bf985490fb`. A repeated run produced the same fingerprint; the old run ID was still rejected as superseded.

### 60-hour plan and exact What-If replay

Three steps use **56 effort hours / 14 downtime hours**:

1. HLT-008 Hospital Operations Server: segmentation, 24h effort / 6h downtime, marginal reduction 3.68.
2. PWR-008 Dispatch Control Server: segmentation, 24h / 6h, marginal reduction 3.62.
3. HLT-007 Medical Gas Controller: patch prioritization, 8h / 2h, marginal reduction 0.60.

Plan and its exact What-If request both produce **35.62 → 27.72**, a reduction of **7.90 index points / 22.18%**. Seven asset indices change. All three worst-plausible essential-service disruption fractions remain **100%**: other initiating scenarios can still disrupt services. A lower relative index is not verified recovery or an incident-probability reduction.

The patch transfer preserves CVE-2022-0778, CVE-2023-28831 and CVE-2026-25786. The returned NVD fixed versions are V3.0.1, V3.0.3 and V4.1.6 respectively. These are reference-backed modelling boundaries, not evidence that software was installed.

### Why the earlier results changed

The earlier 60h plan ended at 25.90 because the old generic action assumed the top three CVEs were patched. The corrected engine requires documented fixes or explicit target-version evidence. WTR-002's candidates have no established fixes; its default patch now returns zero benefit with unresolved evidence. HLT-009's default patch also produces zero city-index reduction because its dominant signal remains. This frees budget for a different combination, ending at **27.72**. No score was hardcoded to reproduce the old example, and the risk formula/model were unchanged.

Other measured API cases:

- Excluding HLT-008 removes it from selected targets and records `asset_excluded`; the 60h plan ends at **27.79**.
- A 2h single-action window and 4h total downtime limit yields **33.87**, using **32 effort hours / 4 downtime hours**. Its handoff reproduces the same projection.
- A one-hour effort budget returns no steps and a null handoff.
- PWR-001 target version 7.0.15 yields **35.58**, with CVE-by-CVE resolution evidence. This tests declared-version applicability rather than asserting deployment feasibility.
- The earlier PWR-001 access-control example remains **35.62 → 35.05**, 0.57 points / 1.60%, 12h effort. This was reproduced in the compiled application served by FastAPI.

Machine-readable measured summary: [PHASE_5_DEMO.json](PHASE_5_DEMO.json). Full local responses and the exploratory harness are ignored under `artifacts/`; committed backend/frontend tests exercise the contract reproducibly.

## Verification

- Complete backend suite: **180 passed**, 364.05s, no skips; one non-failing upstream Starlette/httpx deprecation warning.
- Complete frontend suite: **49 passed**, including 13 new final-integration cases for exact run/fingerprint fields, scoped options, CVE/target preservation, nullable parameters, constraints, prerequisite closure and structured errors.
- Strict TypeScript, repository-wide frontend Prettier check, Ruff lint and Ruff formatting check passed. The frontend has no separate ESLint task. Production Vite build passed.
- **24 live API probes passed**, covering exact replay, budget/exclusions, constrained plans, default/explicit/version-targeted patches, missing/unknown/stale runs, snapshot/fingerprint mismatch, duplicate actions and invalid exclusions. Latest-run payload equality confirmed projections/optimization did not mutate the baseline. After a deliberate replacement run, old projection/options requests returned 409 `stale_baseline`; explicit re-review against the latest run reproduced 27.72.
- Actual browser: all seven Live Simulation stages completed; cold simulation 26.2s. HLT-001 opened the filtered Assets & Risk register with calculated workflow risk and separate curated evidence. Fix Plan generated/reviewed the corrected plan and fixed-version evidence; changing maintenance inputs marked it outdated. Full plan staged three exact actions, and explicit What-If calculation reproduced 27.72. A one-hour maintenance window returned real HTTP 422 `constraint_violation` with per-action issue paths; clearing it recovered. A replaced run displayed the explicit baseline-review block.
- Mobile What-If at 390×844 measured document client width = scroll width = 375. Additional compiled/mobile checks and final security/Git review are recorded in VERIFICATION.md.
- Final review: 526 reachable Git blobs plus 233 tracked/nonignored working files were scanned with no credential-pattern findings or sensitive tracked files. No new external service or infrastructure execution path was introduced. Run-bound POSTs, server validation, escaped structured errors, unchanged backend/model files and baseline immutability were reviewed. This is a targeted integration review, not a penetration-test claim.

## Launch and demonstrate

From a fresh checkout with dependencies/reference cache restored (README):

```powershell
.\scripts\setup.ps1 -SQLite
.\.venv\Scripts\python.exe scripts/evaluate_model.py --fetch
.\scripts\start.ps1 -SQLite
```

The evaluator verifies/re-evaluates committed artifacts; it does not train a model. With an already prepared checkout, only the last command is needed. Development UI: `http://127.0.0.1:5173`; API: `http://127.0.0.1:8000`. For the compiled single-process demonstration use `.\scripts\start.ps1 -Production -SQLite` and open port 8000. Stop the prior owned session before restarting on the same ports.

1. Open `/live`, start and wait for all stages. Click HLT-001 to inspect the filtered register.
2. Follow **3. Fix Plan**, use 60h with blank constraints/no exclusions and generate. Review the three selected targets, downtime, patch evidence and rejected candidates.
3. Transfer the full plan, one row or a selected subset. Required prerequisites accompany their dependent actions.
4. Review staged actions, fingerprint, patch IDs and constraints. Click **Calculate projected risk**; inspect city indices, seven affected assets and essential services.
5. Edit budget/constraints/actions to see stale-result handling. An impossible maintenance window produces structured errors without losing staged actions. A new simulation requires explicit baseline review.

## Remaining issues and Phase 6 readiness

Phase 5 is ready as a verified local baseline for defining and implementing Phase 6. No Phase 6 feature was started. It is not a production-readiness claim.

- Latest run/history remain process-memory state (100 historical IDs), lost on restart and shared by visitors to that process. Run IDs have second-level timestamp granularity; the frontend also binds fingerprints/creation identity, but durable immutable run storage and stronger identifiers remain future work.
- The fingerprint summarizes scenario/snapshot/date, model/scorer versions and output scores; it is not a signature or complete reference/configuration manifest.
- Numeric-segment version matching cannot fully interpret vendor/pre-release schemes. NVD absence of a documented fix is not proof no vendor patch exists. Curated and workflow product overlays remain distinct.
- Effort/downtime are fixed assumptions. There is no calendar, crew capacity, rollback or quantified process-safety effect of isolation. Greedy results are not proven optimal. Monitoring/response have no modelled detection/recovery benefit.
- Conditional impact is an upper bound with existing backup/recovery limits. The risk index is relative and uncalibrated, not infrastructure-compromise probability.
- No durable saved plans, real network remediation or independently verified changes. Local loopback operation has no multi-user authentication/authorization design; no external deployment was attempted.

Review scope and acceptance criteria before Phase 6. Preserve the two-graph semantics, evidence lineage, simulated/projection labels and exact run binding.
