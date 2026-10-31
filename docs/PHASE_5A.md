# Phase 5A: What-If and remediation hardening

Branch `feature/phase-5-hardening`, from `integration/phase-3` at 8ea1689. Backend only. Projections
are simulated estimates from the same model; nothing is patched, changed or verified.

## What changed

| Area | Before | Now |
|---|---|---|
| Baseline | What-If and optimize used whichever run was latest; only scenario/snapshot were checked | Every request names `run_id`; stale, unknown and mismatched baselines are rejected |
| Validation | Duplicates accepted, unknown excluded assets ignored, inapplicable actions skipped with a note | All problems rejected together with structured `issues` |
| Patching | Top 3 CVEs assumed fixed | A CVE is remediated only where NVD documents a fixed version, or a declared `target_version` falls outside its affected ranges |
| Constraints | None | Downtime per window, total downtime, incompatible pairs, prerequisites |
| Overlap | Joint recompute only | Joint recompute plus per-action standalone and marginal reduction, and an `overlap_adjustment` |
| Optimizer | Greedy, silent about what it skipped | Same greedy; every unselected action has a reason code; deterministic tie-break; hand-off request |

Unchanged: scoring formula, ML signal, conditional impact engine, the two graphs, the baseline run
object, the action catalog and the greedy algorithm.

## Baseline binding

`POST /actions/what-if` and `POST /actions/optimize` require `scenario_id`, `snapshot_id`, `run_id`;
`baseline_fingerprint` is optional. `GET /actions/options?run_id=` is optional.

`SimulationRun.fingerprint` is a SHA-256 prefix over scenario, snapshot, as-of date, model and
scoring versions, city score and every asset score. Identical inputs give an identical
fingerprint even though the run id (a timestamp) differs.

| Condition | HTTP | `error.code` |
|---|---|---|
| No simulation yet | 409 | `conflict` (unchanged) |
| `run_id` omitted / bad shape | 422 | `validation_error` |
| `run_id` never existed in this session | 404 | `baseline_not_found` |
| `run_id` superseded by a later run | 409 | `stale_baseline` (message says whether the new run's results are identical) |
| scenario/snapshot differ from the run | 409 | `baseline_mismatch` |
| `baseline_fingerprint` differs | 409 | `baseline_fingerprint_mismatch` |
| Recomputed baseline no longer matches the stored index | 409 | `baseline_inconsistent` |

Run history is kept in memory for the session (last 100 ids). It is not persisted across restarts,
so after a restart every earlier run id is `baseline_not_found`.

## Error shape

Remediation errors extend the existing envelope with an optional `issues` list. `details` still
holds `"<path>: <message>"` strings, so existing consumers keep working. Framework validation
errors keep the old shape (no `issues`).

```json
{
  "error": {
    "code": "invalid_actions",
    "message": "2 problem(s) in the request.",
    "details": ["actions[1]: patch_prioritization on HLT-007 is already staged at actions[0]. ..."],
    "issues": [
      {"path": "actions[1]", "code": "duplicate_action", "message": "..."},
      {"path": "actions[2].asset_id", "code": "unknown_asset", "message": "No asset XXX-1 in this scenario."}
    ]
  }
}
```

Issue codes: `duplicate_action`, `unknown_asset`, `parameter_not_applicable`,
`action_not_applicable`, `cve_not_applicable`, `duplicate_cve`, `invalid_target_version`,
`duplicate_exclusion`, `invalid_constraint`, `prerequisite_cycle`, `unsatisfiable_constraints`,
`exceeds_maintenance_window`, `exceeds_downtime_budget`, `incompatible_actions`,
`missing_prerequisite`. Top-level codes for 422: `invalid_actions`, `invalid_request`,
`constraint_violation`.

Invalid is not the same as zero benefit. A valid action with no modelled reduction returns 200 with
`outcome: "no_modelled_reduction"` (or `recommendation_only`, `increases_modelled_risk`) and a note.

## Request contract

```json
{
  "scenario_id": "aurora-city",
  "snapshot_id": "aurora-baseline-v1",
  "run_id": "run-20261031-174648-202610",
  "baseline_fingerprint": "fd5c651c1885ec6b207192bf985490fb",
  "actions": [
    {"asset_id": "HLT-007", "action_type": "patch_prioritization",
     "cve_ids": ["CVE-2022-0778"]},
    {"asset_id": "PWR-001", "action_type": "patch_prioritization", "target_version": "7.0.15"},
    {"asset_id": "HLT-008", "action_type": "network_segmentation"}
  ],
  "constraints": {
    "max_downtime_per_action_hours": 6,
    "max_total_downtime_hours": 10,
    "incompatible": [{"first": "network_segmentation", "second": "access_control"}],
    "prerequisites": [{"action": "network_segmentation", "requires": "incident_response_plan"}]
  }
}
```

`cve_ids` and `target_version` apply only to `patch_prioritization`. Constraints are optional and
apply per asset (incompatible, prerequisites) or to the whole set (downtime). Prerequisite order
within one request is not modelled; presence is checked. `OptimizeRequest` takes the same
`constraints` plus `effort_budget_hours` and `excluded_asset_ids` (unknown or repeated ids are
rejected).

## Patch model

For each CVE the asset's evidence lists, the NVD affected range containing the assumed version is
read from the same table that produced the candidates.

* **Documented fix:** the range has a `lessThan` bound. `fixed_in` is that bound (highest bound if
  several ranges contain the version). The CVE is modelled as remediated by a patch that brings the
  asset to that version or later.
* **No documented fix:** only an inclusive upper bound, an open range, or an unevaluable range
  (`version_unknown`). Status `fix_version_not_documented`; the CVE stays in the score.
* **`target_version`:** must parse and be newer than the assumed version. The product is re-matched
  at that version. CVEs whose ranges now exclude it are `remediated`; still inside a range
  `not_resolved_by_target_version`; ranges that cannot decide `applicability_unestablished`.
* **Scope:** `cve_ids` names the CVEs; omitted means the default batch: up to 3 highest-priority
  CVEs (KEV-listed first, then ML rank) that have a documented fix. Higher-priority CVEs without
  one are listed in `patch.not_remediated`.
* Effort: 8 h for up to 3 named CVEs, +2 h each beyond; one `target_version` upgrade is 8 h.

`AppliedAction.patch` and `PlanStep.patch` carry `scope`, `target_version`, `remediated[]` and
`not_remediated[]`, each with `cve_id`, `status`, `applicability`, `fixed_in`, `reason`.

## Operational model (assumptions, not site estimates)

| Action | Effort h | Downtime h |
|---|---|---|
| patch_prioritization | 8 | 2 |
| network_segmentation | 24 | 6 |
| access_control | 12 | 1 |
| enhanced_monitoring | 40 | 0 |
| incident_response_plan | 16 | 0 |

`ActionDefinition.downtime_hours` is new. The per-action window is the longest single window
available; there is no calendar. Trade-offs reported: downtime and the existing
`operational_disruption` text. Process impact of isolating a controller is not modelled.

## Responses

`WhatIfResult` adds `baseline_fingerprint`, `summary` (current/projected index and category counts,
`overlap_adjustment`), `constraint_report`, and per action `outcome`, `downtime_hours`,
`standalone_city_reduction`, `marginal_city_reduction`, `patch`. Marginal reductions follow request
order and sum to `city_reduction`; `overlap_adjustment` = sum of standalone minus joint.

`RemediationPlan` adds `baseline_fingerprint`, `optimality: "greedy_heuristic"`,
`used_downtime_hours`, `rejected[]`, `limitations[]`, and `what_if_request` (null when no steps).
`rejected[].reason_code`: `asset_excluded`, `not_applicable`, `no_modelled_reduction`,
`increases_modelled_risk`, `exceeds_effort_budget`, `exceeds_maintenance_window`,
`exceeds_downtime_budget`, `incompatible_with_selected`, `prerequisite_not_applicable`.
`PlanStep` adds `kind` (`selected` | `prerequisite`), `prerequisite_for`, `downtime_hours`,
`reduction_per_effort_hour`, `patch`.

**Plan to What-If hand-off:** POST `plan.what_if_request` unchanged to `/actions/what-if`. It carries
the run binding, every step (prerequisites included) with the exact remediated `cve_ids`, and the
constraints. The projection reproduces `ending_city_index` (tested). It is only valid while the run
is current.

## Optimizer

Greedy: each round, for every feasible (asset, action) candidate, apply it (with any missing
prerequisites) on top of what is already chosen, recompute the full score, and take the best
reduction per effort hour. Overlapping benefits are therefore counted once. Ties break on larger
absolute reduction, then asset id, then action name (the previous code broke ties toward the larger
asset id). A candidate is feasible only if it is applicable, compatible with what is chosen, fits the
window, the downtime budget and the effort budget. Zero-benefit candidates are never selected and are
listed in `rejected`.

Limits (also returned in `limitations`): not proven optimal; a bundle of prerequisites is chosen as
one unit; one action per type per asset and one patch batch per asset; the optimizer only uses
documented fixes, so it never proposes a `target_version` upgrade (use What-If for those); effort
and downtime are fixed assumptions; no scheduling.

## Reference scenario (60 h budget)

| | Before (8ea1689) | After |
|---|---|---|
| Baseline city index | 35.62 | 35.62 |
| Steps / effort | 5 / 56 h | 3 / 56 h (14 h downtime) |
| Projected index | 25.90 | 27.72 |

The baseline is identical. The difference is the patch model, not a scoring change. The old plan
patched WTR-002, HLT-009, HLT-002 and HLT-007 by assuming the top three CVEs were fixed. For
WTR-002 none of its three candidates has a documented fixed version; for HLT-009 and HLT-002 the
highest-ranked CVEs (CVE-2022-1161, CVE-2022-45788) have none, and the risk signal is the maximum
priority percentile, so patching only the lower-ranked fixable CVEs leaves the signal unchanged.
Only HLT-007 (all three top CVEs have documented fixes, 0.60) keeps its benefit.
Segmentation of HLT-008 (3.68) is unchanged and PWR-008 (3.62) takes the freed budget.

## Not done

* Frontend changes (Codex): `run_id` is now required, so `Remediation.tsx` and `hooks/liveSimulation.ts`
  fail typecheck until they pass the current run id.
* No persistence of run history across restarts.
* Version comparison is numeric-segment based (`ml/matching.py`); pre-release tags and vendor-specific
  schemes are not interpreted.
* Calendar maintenance windows, crew capacity, rollback and process-safety effects.
