# Gridinal Phase 7 — Preventive Resilience Optimizer

Backend-only extension of GridSentinel, from verified Phase 6 commit
`91f2ab55fc0b32af0b4cca2c88d6ca8bb7784b42`, on
`feature/phase-7-resilience-optimizer`. No branch merge, UI change, model training or
infrastructure execution is part of this delivery. Existing algorithms and source datasets
remain unchanged. The original seven PS03 objectives remain authoritative in PROJECT_SPEC.md.
This extends conditional impact and preventive recommendations (O5/O7), with the existing
O2–O4 evidence/risk pipeline reused; it is not a claim of verified real-world resilience.

## Audit and architecture

The Phase 6 foundation already contains:

- `engine/impact`: deterministic, effect-specific, k-of-n operational failure propagation;
  finite service backups and grace periods, but monotone failures/no operator recovery.
- `engine/attack_path`: bounded candidate cyber paths, configured controls and explicit
  uncertainty. Operational edges cannot enter its graph input.
- `services/remediation.py` and `services/simulation.py`: documented NVD fixes, CVE-specific
  patch resolution, exact baseline binding, risk-index What-If and a greedy risk optimizer.
- Process-local latest run/history, run fingerprint, structured errors, existing tests and
  generated OpenAPI/TypeScript declarations.

Phase 7 adds separate modules rather than replacing these algorithms:

1. `schemas/preventive.py`: additive, strict contracts with mandatory run/fingerprint identity.
2. `engine/preventive_failure.py`: pure event-time continuity simulation. Reuses
   `OperationalView`, its dependency grouping/functions, and `ImpactPolicy` effect semantics.
3. `engine/preventive_optimizer.py`: exact subset search against **joint simulated service
   disruption**, not an additive sum of standalone benefits.
4. `services/preventive.py`: versioned catalog, existing patch resolver/attack-path adapters,
   scenario validation, deterministic evaluation, stress cases and optional legacy What-If.
5. `api/preventive.py`: four thin POST endpoints registered additively in main.py.

The original risk, attack-path, impact and What-If code is untouched. Old API shapes remain
identical: a generated-contract comparison verified all **34 existing paths and 113 schemas**.
Only generated TypeScript declarations change in the frontend; no UI route, behavior, styling,
component or redesign is added. The separate newer Gridinal redesign/connected-flow branches
are intentionally not merged into this specifically requested Phase 6 base.

## Failure and continuity model

Version: `preventive-continuity-v1`. All initiating events start at minute zero. The caller
chooses a horizon of 1–1440 integer minutes, direct failures and/or conditional cyber challenges.
An event is not a random draw, prediction or confirmed compromise.

- Direct failures specify stable event/asset IDs, cause (`power_loss`, `hardware_failure`,
  `cyber`), effect and optional restoration deadline. Power/hardware causes require the
  unavailability effect. Missing restoration means no repair within the horizon.
- The inherited effect policy determines which asset functions stop. Loss of visibility does
  not automatically stop operational output; control/integrity failures cannot be repaired
  by backup power. A failed required group or unsatisfied redundant k-of-n group stops the
  dependent after its continuous-deficit grace period.
- At each event time, the operational graph settles from healthy state to the greatest
  available fixed point. Roots/edge IDs are propagated. Cycles do not self-fail, and recovery
  of all external causes permits a cycle to restore. Grace timers reset only after the whole
  fixed point is stable. Unknown/unsupported assumptions fail explicitly rather than returning
  zero disruption.
- Existing service requirements and backup edges identify standby providers, their named
  primary groups and protected components. Only explicit **power-loss unavailability** is
  eligible for this continuity model's standby substitution, conservatively narrower than
  the legacy service-only unavailability assumption. No free-form condition text is parsed
  as executable policy; it is preserved as an additional prerequisite for review.
- Standby activation delay is the **maximum** of the service requirement's activation delay
  and its configured backup edge grace. Each standby gets one finite energy window, shared
  by its service substitution and configured component. There is no refuelling or clock reset.
  A failed provider cannot supply output; `available_intervals` distinguishes simulated usable
  output from the merely scheduled activation/exhaustion times.
- Capacity means **usable stored energy at nominal full output**, not process throughput:
  `duration = floor((existing duration + purchased extension) × usable_energy_fraction)`.
  Half energy means half runtime; zero means no usable runtime. For a multi-provider standby
  group the weakest member is the conservative limit. Shared sources across separate groups
  and multiple competing protected components are rejected, since load allocation is undefined.
- Recovery interventions cap direct initiating failures at 60 minutes, respecting any earlier
  caller deadline. Dependents recover when their required functions are restored; repairing a
  dependent cannot bypass another failed provider. Independent restart delays are not invented.
- Service output is binary per requirement: all primary groups must meet k-of-n or have their
  named eligible standby. The union of outage intervals gives disrupted minutes. Fractions are
  disrupted minutes divided by the horizon, **not incident probabilities**. Total service-minutes
  sums these durations across distinct services; it may exceed the horizon.

Events include restoration, grace expiry, activation and energy exhaustion; stable intervals
are integrated exactly without sampling every minute. Outputs include service/asset outage
intervals, restoration within the horizon, causal event and dependency-edge IDs, standby
windows and availability, residual disruption and improvements.

## Intervention catalog

Version: `aurora-preventive-catalog-v1`. Costs are authored **synthetic planning credits**,
not currency or real quotations. The catalog fingerprint hashes the full bundle, action
definitions/evidence and assumptions. Every response retains source run ID/fingerprint,
baseline timestamp/date/model version. Evaluation adds scoring/engine versions, UTC calculation
time and a deterministic input fingerprint. Current inventory and ML artifacts are not rewritten.

- `patch-{asset}`: **3 credits**; effort from existing evidence-based patch resolution, downtime
  from the existing 2h action. Listed only if the default batch has documented fixed versions.
  Full remediated/unresolved CVE records, NVD fixed versions, applicability tiers and reasons
  are retained. This is a supported-reference batch, not an assertion of installed patches.
- `segment-{asset}`: **5 credits / 24h effort / 6h maintenance downtime**, using the existing
  action definition. Full cyber isolation removes routes through the asset, never operational
  dependencies. Essential communication/process-safety review is an external prerequisite.
- `backup-{asset}`: **12 credits / 16h effort / 2h downtime**; adds **240 nominal-output minutes**
  to an existing single-provider named standby. It creates no asset, edge or substitution.
  Actual energy/fuel and compatibility are unverified synthetic assumptions.
- `recover-{asset}`: **4 credits / 8h effort / 1h downtime**; assumes preparation enables a clean,
  safe restore within **60 minutes** of the event. Available crews/configuration/backups and
  safe restart must be validated outside this prototype.

Maintenance effort/downtime are pre-incident planning totals and are not added to incident
service outages. No calendar, crew scheduling, process-safety or financial valuation model exists.

Patches and segmentation are preventive only for **cyber_challenges**. A direct failure is
already assumed and is not erased by these actions. Challenges require a declared exposed
entry, known target and an existing candidate path supporting the specified final effect.
Only the target is assumed compromised, not every node on the route. If a CVE is named it
must have confirmed target-version applicability; naming it also explicitly assumes it is
the **sole enabling cause** of that target effect. That CVE/effect attribution is a user
assumption, not verified exploit semantics. A documented patch can prevent that specified
scenario; it cannot prevent an unattributed or independent compromise.

After segmentation, a connected target remains conservatively assumed compromised even if
bounded path enumeration reports no supported path. Only configured graph disconnection
removes the route challenge. The legacy engine's coarse authentication/KEV/CVE judgments
still do not establish successful exploitation or calibrated path probabilities.

## Exact optimizer and stress testing

Objective: minimize the sum of disrupted minutes for the requested `service_ids` (all services
if empty). Services have equal weight. Other service outcomes remain visible in the response.
No new risk weights, arbitrary risk-reduction percentages or monetary loss functions are used.

The caller submits at most **12 unique candidate IDs** from the catalog. Every subset,
including the empty set, is considered: at most **4096**. Feasible subsets satisfy all of:
planning-credit budget, effort hours, total downtime hours, optional per-action maintenance
window, and target-asset exclusions. Exclusions forbid modifying the named asset; another
action may still protect a service that depends on it.

Each feasible subset is simulated jointly, including overlaps, redundancy, recovery and
backup exhaustion. Exact-result caching avoids repeated identical physical scenarios.
The deterministic tie-break is: lowest objective minutes, then credits, effort, downtime,
then sorted intervention IDs. Empty/no-benefit solutions do not waste resources. The report
states subset counts, feasibility, selected costs, before/after objective/service outcomes,
improved/fully-protected services, assumptions and rejected alternatives with reasons and
standalone results.

“Optimal” is restricted to the submitted finite catalog candidates under this model/objective;
it is not a claim about every real-world intervention. A unit case proves the search can select
a beneficial pair whose individual gains are zero, where a greedy standalone ratio would fail.

Stress testing reevaluates a **fixed selected plan**, independently per case:

- Explicit standby source unavailable for the whole horizon (a recovery action cannot silently
  cancel this forced stress assumption).
- Additional simultaneous direct asset failure(s), not prevented by a prior patch/segmentation.
- Reduced usable stored-energy fraction for named standby providers.

Each case returns stressed before/after outcomes and the extra projected disruption relative
to the nominal selected plan. Cases do not contaminate one another or change the source run.
This is sensitivity analysis, not robust/minimax optimization or probabilistic reliability.

Optional `risk_projection` is the unchanged legacy What-If result for selected patch/segmentation
actions only, with `risk_projection_intervention_ids`. Backup/recovery service benefits are
not misrepresented as changes to the original risk index. All reports remain
`state=projected`, `verification=not_verified`.

## APIs and strict binding

Prefix: `/api/v1/resilience/preventive`. Generated OpenAPI is authoritative.

- `POST /catalog`: mandatory `scenario_id`, `snapshot_id`, exact `run_id` and 32-hex
  `baseline_fingerprint`. Returns supported interventions and a 64-hex catalog fingerprint.
- `POST /simulate`: binding plus `catalog_fingerprint`, `scenario`, `intervention_ids`
  (empty allowed). Returns a conditional before/after evaluation.
- `POST /optimize`: simulation fields plus 1–12 candidate IDs, `budget_credits`,
  `effort_limit_hours`, `downtime_limit_hours`, optional `max_action_downtime_hours`,
  `excluded_asset_ids`, `service_ids`.
- `POST /stress-test`: simulation fields plus 1–4 named `cases`, each containing
  `failed_backup_ids`, `additional_failures` and/or `backup_capacity` entries with
  `backup_asset_id`, `usable_energy_fraction`.

Unknown fields are forbidden. Numeric bounds reject booleans, string coercion, NaN/Infinity,
negative limits and fractions outside [0,1]. Events/IDs must be unique where required;
unknown targets, unsupported CVEs/effects and invalid scopes fail before a successful result.
Events are capped at eight direct failures/four cyber challenges; stress additions at eight.

The existing baseline binder runs **before and after** calculation. A changed context pointer
is also rejected, even if a replacement happens to reuse an ID/fingerprint. Errors use the
existing safe `error.code/message/details/issues` envelope:

- **404** unknown run; **409** absent/stale/mismatched run, fingerprint or changed catalog.
- **422** invalid/unknown/duplicate/unsupported actions, events, scope, constraints or values.
- **503** unavailable reference data or an unsupported continuity model (e.g. ambiguous
  standby capacity allocation); absence is never converted into zero disruption.

Existing process-local history and second-level run-ID limitations remain. Mandatory fingerprints
and post-computation checks are not authentication, signatures or durable immutable run storage.

## Reproduce on Windows

Use the current branch with prepared dependencies/reference cache (Phase 6 setup/runbook).
Restart an older backend before expecting the new routes; this task adds no UI controls.
From the repository root, after stopping a previous session on the same ports:

```powershell
.\scripts\start.ps1 -SQLite
```

In a second terminal at the repository root:

```powershell
.\.venv\Scripts\python.exe scripts/demo_resilience.py --run
```

`--run` deliberately creates an Aurora simulation as of 2026-10-01. Omit it to require the
current matching baseline. Use `--url http://127.0.0.1:8001` for an explicitly launched QA
instance. Full actual responses go to ignored `artifacts/phase7-demo.json`; the tool does not
train, scan or execute infrastructure actions. It also checks the old Phase 6 optimizer,
What-If and attack API, and confirms the baseline is immutable.

The demonstration uses a **360-minute local power-loss event on PWR-008**:

1. No interventions: existing PWR-010 standby starts after max(5,30)=**30 minutes**, lasts
   240 minutes to minute 270, then exhausts. Each of three services loses 120 minutes:
   **360 service-minutes total**.
2. Prepared recovery of PWR-008 at minute 60 removes the underlying event before standby
   exhaustion. Only the initial 30 minutes remain for each service: **90 service-minutes**.
3. Candidate set `recover-PWR-008`, `backup-PWR-010`, `segment-PWR-004`, with **12 credits /
   24h effort / 6h downtime**, selects `recover-PWR-008`: **4 credits / 8h effort / 1h downtime**.
   Backup extension also reaches 90 minutes in this horizon but costs more; segmentation
   cannot remove an already-assumed power failure. All eight subsets are considered.
4. A fixed backup-extension plan gives nominal **90 service-minutes**. Forced backup failure
   gives **1080**, half usable energy gives **360**. An additional WTR-008 hardware failure
   is calculated independently and reported with its causal outages.
5. Conditional PWR-001 → PWR-004 → PWR-008 integrity challenge, 120-minute horizon:
   isolating PWR-004 disconnects the route, giving **0 residual service-minutes** under that
   specific challenge. This does not establish universal safety or observed protection.
6. Existing Phase 6 baseline remains **35.62**, original 60h risk plan/What-If **27.72**,
   **56h effort**, **15 candidate paths**. These are different metrics/scenarios from the
   new 360→90 service-minute result; no historical risk score is replaced.

Example request after retrieving binding/catalog identity:

```json
{
  "scenario_id": "aurora-city",
  "snapshot_id": "aurora-baseline-v1",
  "run_id": "COPY_CURRENT_RUN_ID",
  "baseline_fingerprint": "COPY_32_HEX_FINGERPRINT",
  "catalog_fingerprint": "COPY_64_HEX_CATALOG_FINGERPRINT",
  "scenario": {
    "horizon_minutes": 360,
    "failures": [{"id": "power", "asset_id": "PWR-008", "cause": "power_loss"}]
  },
  "intervention_ids": ["recover-PWR-008", "backup-PWR-010", "segment-PWR-004"],
  "budget_credits": 12,
  "effort_limit_hours": 24,
  "downtime_limit_hours": 6
}
```

The placeholder strings above are instructions, not valid fingerprints; copy real values
from `/simulation/latest` and `/resilience/preventive/catalog`.

## Verification and limits

Focused new suites: **57 tests passed**, including hand-calculable temporal cases, exact search
with synergy, budget/effort/downtime/exclusions, independent stress cases, real saved-model/Aurora
API integration, missing references, invalid values/CVEs/effects, catalog mismatch, replacement
during calculation, superseded runs and Phase 6 golden results. Full verification passed:
**247 backend tests** (354.57s, no skips; one upstream Starlette/httpx deprecation warning),
**85 frontend tests** (12.01s), strict TypeScript, Ruff lint/format (85 Python files), frontend
Prettier and production build (2602 modules, 18.55s). The full check command exited zero.
**12 real HTTP demo checks passed** on an isolated SQLite API, including unchanged Phase 6
results and baseline immutability. The additional WTR-008 failure produced **750** projected
service-minutes. Measured output: [PHASE_7_DEMO.json](PHASE_7_DEMO.json).

The user-requested progress audit confirmed the suite was active rather than stalled: backend
and frontend suites had already passed and only the build was pending. The build completed
without restarting or repeating the passed tests. Total runner elapsed time was approximately
7m13s. Quiet output did not retain the last individual frontend test name. See VERIFICATION.md
for process, command and boundary-test details.

Run all regression/type/style/build checks with `.\scripts\check.ps1`. Targeted commands:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_preventive_failure.py backend/tests/test_preventive_optimizer.py backend/tests/test_preventive_api.py -q
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Known limits: authored costs/recovery targets/energy assumptions; binary service output rather
than power-flow or fractional-load physics; conservative power-loss-only standby coverage;
no competing load allocation, refuelling, calendar/crew optimization or real compatibility
validation; coarse bounded cyber evidence and user-assumed CVE/effect attribution; finite
candidate/horizon limits; nominal-objective search rather than optimization over stress cases;
process-local run history; no UI, deployment, load/concurrency, hardware or real recovery trial.
No new real-world model evaluation, calibrated probabilities or complete objective/compliance
claim is made. The unchanged saved ML model's Phase 6 evaluation/limitations still apply.
