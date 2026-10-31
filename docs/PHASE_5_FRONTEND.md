# Phase 5B: What-If and Remediation frontend

Branch `feature/phase-5-frontend` starts at `origin/integration/phase-3`, commit `8ea1689b81ecd2144219d4446bd1fcb79564379e`. All remote branches were fetched first; the working tree was clean. Claude's `feature/phase-5-hardening` was not published at that fetch and was not merged. No backend, ML, risk formula, optimizer, dataset or generated schema was modified.

## Existing functionality and delivered improvements

The baseline already implements actual action options, What-If calculation and greedy effort-budget optimization. Patch, segmentation and access control have modelled effects; monitoring and incident-response planning are recommendation-only. This phase improves the frontend workflow around those engines.

- **Stale results:** changing budget/exclusions/observed baseline marks the plan OUTDATED and hides comparison/transfer controls. Recalculate Plan uses the new inputs. What-If likewise hides outdated comparisons after action or baseline changes. Each asynchronous response retains its submitted input identity, protecting against input edits during calculation. Returning to exactly the original inputs may reuse their matching result; it is not relabelled as a result for different inputs.
- **Exclusions:** search scenario inventory, multi-select assets, view/remove selected IDs and send them in the existing optimizer request. Unknown IDs block submission. A response recommending an excluded target is blocked. Separate recommendation-only entries are also filtered.
- **Handoff:** each supported step, selected subset or full supported plan can be sent to What-If. Router state carries the actions and original baseline; navigation stages rather than calculates/executes them. Unsupported actions, unknown assets, duplicate actions, malformed state and selections over 40 produce explanations; unsupported actions are never silently omitted. An old transferred baseline requires explicit review and Use latest baseline.
- **Comparison:** backend indices, arithmetic absolute/relative reduction, affected asset deltas, conditional service impact, applied actions and effort are visible. Zero-baseline relative change is unavailable. Services are joined by stable ID, and all changed assets are displayed. Action-options failures have retry. No separate risk formula is implemented in React.
- **Demonstration:** workflow links connect Live Simulation → Assets & Risk → Fix Plan → What-If comparison. Live asset links filter the register by ID. Existing theme/navigation and backend behavior are preserved. Patch feasibility, full-isolation assumptions and projected/not-verified status remain explicit.

## Baseline safety and current API

`features/actions/useActionWorkflow.ts` checks latest-run state on focus and every 15 seconds while an action page is open. It reads `/simulation/latest` before and after options/calculation calls, updates the shared query cache, and compares scenario/snapshot, run ID, creation timestamp and as-of date. Calculation responses must echo the same run/context. Input signatures bind results to the submitted budget/exclusions/actions.

**Client checks are best-effort, not atomic server binding.** The current request schemas cannot send a run ID; another client can replace process-global state between requests. Claude must enforce binding server-side. No invented fields were added to requests or generated contracts:

- WhatIfRequest: `scenario_id`, `snapshot_id`, `actions[{asset_id,action_type}]`.
- OptimizeRequest: `scenario_id`, `snapshot_id`, `effort_budget_hours`, `excluded_asset_ids`.
- Responses already include `run_id`, projected/not-verified state and calculation values.

`PlanHandoff` with `kind: gridsentinel-plan-v1` is frontend router state, not a backend contract.

## Contract coordination required from Claude

These exact names are **proposals for coordination, not implemented HTTP fields**. Review Claude's actual OpenAPI when published, use the agreed names, export Pydantic OpenAPI and regenerate TypeScript. Do not hand-edit generated types or cast away incompatibilities.

1. **Atomic baseline:** required request `run_id` for What-If/optimize and run-scoped options; 409 on missing/replaced/incompatible baseline; echo `run_id`, `scenario_id`, `snapshot_id`. Immutable run lookup or a stronger version token is preferable because existing IDs have second-level granularity. Integration point: `useActionWorkflow.ts`.
2. **Patch verification:** authoritative patch-option/component/product ID, selected `cve_ids` and `fixed_version` or a stable patch-option ID; available fixed versions, source evidence, applicability/verification state and reasons for unavailable choices. Action wire shape and eligibility remain backend-owned. Until integration, generic three-CVE patch batches remain explicitly unverified.
3. **Maintenance constraints:** typed request/response `constraints`, potentially `maintenance_window_hours`, `max_disruption_fraction` and `protected_service_ids`, with units, bounds and feasibility reasons. These are absent from today's API, so no fictitious constraint selectors were added. Include every agreed constraint in the plan input signature when wiring it.
4. **Validation/lineage:** reject duplicate actions and unknown/excluded IDs; preserve structured `error.details`. Return generation timestamp, model/scoring/impact/catalog versions and reference hashes, plus unsupported-action/infeasibility reasons. Keep optimized-step effort separate from recommendation-only effort.

No unfinished backend branch was merged to anticipate these fields.

## Measured verification (2026-10-31)

- `npm test`: **36 passed** in two files, including 26 new interaction/contract tests. Tests use isolated numerical fixtures with central API mocks; production calls real APIs. Coverage includes budget/exclusion invalidation, inventory search/removal, invalid/empty inputs, excluded-target protection, loading/errors/retry, empty plans, in-flight edits, single/full/subset routed handoff, unsupported actions/state, stale-handoff review, all affected assets, changed/in-flight baselines and wrong-run responses.
- `npm run typecheck`, `npm run format:check` and `npm run build`: passed. Prettier is the repository's configured style check; there is no separate ESLint task. Backend/model evaluation was not rerun for this frontend-only change.
- Actual local browser flow: all seven Live Simulation stages completed, simulation 9.2s, city 35.62 with nine critical assets. Clicking HLT-001 opened its filtered register with real calculated workflow and separate curated evidence. No API-route-not-found error appeared.
- Fix Plan: selected PWR-001 and WTR-002, removed PWR-001, then generated a 60-hour plan excluding WTR-002. Three actions used 56h, projecting **35.62 → 26.30**, **9.32 points / 26.17%**. WTR-002 was not a recommended target. Budget edit to 8 immediately marked the result outdated and hid comparison/transfer controls.
- Full-plan transfer staged three actions without calculating automatically. Explicit What-If calculation returned the same **35.62 → 26.30**, seven changed assets and backend service values. All three service worst-case disruptions remained 100%; the UI does not portray index reduction as verified recovery.
- At **390×844**, What-If and Fix Plan both measured document client width = scroll width = **375**. Mobile planning accepted an 8h budget with WTR-002 excluded; the row action transferred HLT-009 patch prioritization alone and allowed explicit recalculation. Tables scroll inside panels and comparison cards stack.

Local ignored screenshots: `artifacts/screenshots/phase5b-outdated.jpg`, `phase5b-comparison-desktop.jpg`, `phase5b-whatif-mobile.jpg`, `phase5b-plan-mobile.jpg`. Browser checks are actual UI interactions, separate from automated DOM tests and build results. See VERIFICATION.md for any final observations.

## Demonstrate

1. Launch the existing local setup with `.\scripts\start.ps1 -SQLite`. For a fresh checkout, follow README setup and restore the ignored reference cache with `.\.venv\Scripts\python.exe scripts/evaluate_model.py --fetch`.
2. Open `http://127.0.0.1:5173/live`, start the simulation and wait for completion.
3. Click HLT-001 to inspect the register; choose **3. Fix Plan**.
4. Enter 60h, optionally exclude WTR-002, and generate. Edit inputs to inspect outdated behavior and recalculate.
5. Send a single row, selected subset or full supported plan to What-If. Review staged actions and baseline, then click **Calculate projected risk**.
6. Inspect city/asset/service comparisons and assumptions. Editing staged actions invalidates the comparison until recalculated. Nothing changes real infrastructure.

## Safely integrate both Phase 5 branches later

Use a new integration branch; preserve main and both feature branches:

```powershell
git fetch origin
git switch -c integration/phase-5 origin/integration/phase-3
git merge --no-ff origin/feature/phase-5-frontend
# Only after Claude publishes and the contract is reviewed:
git merge --no-ff origin/feature/phase-5-hardening
```

Coordinate shared contract/document conflicts and preserve both implementations. Export OpenAPI using `python scripts/export_openapi.py`; from frontend run `npm run generate:api`. Adapt the action helper, patch/constraint controls and tests to the actual contract. Run backend tests, frontend tests/typecheck/style/build and real desktop/mobile handoff on a common run. Push only the new integration branch after verification. These are instructions, not merges executed by this task.

## Remaining limits

Atomic server run binding, patch verification, maintenance constraints and backend validation await Claude's work. No durable saved plans/scenarios, approvals, actual remediation or independent verification were added. Browser history may retain handoff actions but calculation results are not durable. Existing ML, relative-index and conditional-impact limitations remain; no calibrated infrastructure-compromise probability or new optimizer is claimed.
