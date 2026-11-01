# Final demo runbook â€” Phase 6, 1 November 2026

Branch `feature/phase-6-finalization`, built from verified Phase 5 integration
`62dece9793b3b0a901091bbd80bd6860a6ef69b8`. This is a verified local prototype,
not a production deployment, a compliance certification or a real infrastructure assessment.
The original seven PS03 objectives remain unchanged in PROJECT_SPEC.md.

## Setup and launch on Windows

From the repository root, using Python 3.12+ and Node/npm:

```powershell
.\scripts\setup.ps1 -SQLite
.\.venv\Scripts\python.exe scripts/evaluate_model.py --fetch
.\scripts\start.ps1 -SQLite
```

The first two commands prepare dependencies, SQLite and exact manifest-pinned public
reference files. They need network access on a fresh checkout. The evaluator verifies
checksums and reevaluates the saved model; it never trains or replaces it. Do not run
`ml.train` for this demonstration. On this already prepared laptop, launch with only
`.\scripts\start.ps1 -SQLite`.

Open `http://127.0.0.1:5173/live`; API is `http://127.0.0.1:8000/api/v1/health`.
For a compiled single-process demo instead, stop the previous session with Ctrl+C,
run `.\scripts\start.ps1 -Production -SQLite` and open `http://127.0.0.1:8000/live`.
Do not start a second application on occupied ports. Both launches explicitly keep
the database local even if an optional PostgreSQL URL exists in the environment.
Once prepared, the application, bundled assets, model and reference reads work locally;
physical network-disconnection testing was not performed in this batch.

## Demonstration journey

1. **Live Simulation:** retain the default latest data date, **2026-10-01**, and click
   **Start simulation**. Wait for all seven server stages, including **Risk brief**.
   Stage seven now actually fetches the JSON report and checks its run ID. A cold model
   load takes longer than subsequent requests; allow a minute before judging it stalled.
   Note the new run ID; do not reuse the timestamped example ID below after a restart/re-run.
2. Click **PWR-001** in the critical-asset list. In **Assets & Risk**, click
   **North Grid Gateway**. Its real-product assumption is **Fortinet FortiOS 7.0.12**;
   workflow risk is **97.29** (UI rounds to 97.3), with **99 candidate CVEs / 7 KEV**
   in this dated simulation. Inspect the CVE reasoning and provenance. This is applicability
   to an assumed installation, not a scan or exploitation finding. The drawer's separate
   **Apache 2.4.49 curated overlay** is a smaller reference demonstration, with its own
   formula/coverage; its **69.27** priority must not replace the workflow score.
3. Follow **Full reasoning in Risk Intelligence**. The selected PWR-001 is retained in
   `/intelligence?asset=PWR-001`; inspect the ML CVE signal, exposure and conditional impact.
4. Click **Inspect attack paths**. Select **PWR-008 Â· Dispatch Control Server** as target.
   The reported route is **internet â†’ PWR-001 â†’ PWR-004 â†’ PWR-008**, using
   `cyber-PWR-1-4` (HTTPS remote management) and `cyber-PWR-4-8` (OPC UA remote management).
   Inspect every hop, its basis, weakest step and uncertainty. Its **0.7290 ordinal aid**
   orders candidates; it is not a path-success probability. The full report has **15 paths**,
   from declared exposed entries **HLT-001, PWR-001, WTR-001**. Add hypothetical isolation
   of **PWR-004** to remove this selected route, then remove isolation to restore it.
   No reported route is not proof of security. Isolating PWR-008 leaves **10** paths overall.
5. Read **Conditional operational impact**: the example assumes **data integrity** compromise
   of PWR-008. Existing dependency/backup assumptions yield **100%** disruption upper bounds
   for each essential service. These are conditional consequences, not predictions of outages.
   Follow **Inspect operational dependencies**, then switch to **Cyber Reachability** to
   demonstrate the two distinct graphs. The selected PWR-008 survives the handoff.
6. Open **Fix Plan**. Use **60 effort hours**, no excluded assets and blank maintenance
   constraints; click **Generate plan**. The calculated sequence is:
   - HLT-008 segmentation: **24h effort / 6h downtime**, marginal index reduction **3.68**.
   - PWR-008 segmentation: **24h / 6h**, marginal reduction **3.62**.
   - HLT-007 patch: **8h / 2h**, marginal reduction **0.60**.
   Inspect **Patch evidence**: CVE-2022-0778, CVE-2023-28831, CVE-2026-25786;
   documented fixed versions V3.0.1, V3.0.3, V4.1.6 respectively. These reference boundaries
   do not establish installation or vendor compatibility.
7. Click **Simulate full plan in What-If**. Review the exact three actions, CVE IDs,
   constraints, run ID and fingerprint. Click **Calculate projected risk**. Actual result:
   **35.62 â†’ 27.72**, **7.90 index points / 22.18% relative reduction**, **56h effort / 14h
   downtime**, seven affected asset indices. The three worst-plausible service disruption
   upper bounds remain **100%** because other initiating scenarios still disrupt services.
   The baseline is unchanged; nothing is executed or verified.
8. Change a patch parameter or constraint: the comparison becomes outdated until recalculated.
   A **1h maintenance window** rejects these actions with structured 422 issues. Restore
   valid constraints to recover. In Fix Plan, changing budget/exclusions similarly removes
   the obsolete projection/handoff. A new simulation requires baseline review.

Additional measured variations: constraints **2h per action / 4h total** yield **33.87**
with 32h effort and 4h downtime. Adding protected **PWR-001** changes that plan to **33.88**
(browser verified); the excluded asset is not a selected target. A PWR-001 access-control
projection alone yields **35.05**. A one-hour effort budget selects no steps, not fabricated
benefits. These values are observations from the pinned data, never client constants.

The pre-correction 25.90 plan from earlier phases is intentionally not reproduced. Phase 5
requires fixed-version evidence; unsupported generic patch benefits were removed. Phase 6
preserves the corrected 27.72 result and does not alter scoring/model/impact/path algorithms.

## Reproduce through the API and checks

With the application running and a simulation completed:

```powershell
.\.venv\Scripts\python.exe scripts/verify_demo.py
# Also create a replacement run and prove the earlier requests are stale:
.\.venv\Scripts\python.exe scripts/verify_demo.py --replace-baseline
# Fresh process without any run:
.\.venv\Scripts\python.exe scripts/verify_demo.py --run
# Complete code verification; run in another terminal, not instead of starting the app:
.\scripts\check.ps1
# Check all pinned model sources and reproduce metrics without network/retraining:
.\.venv\Scripts\python.exe scripts/evaluate_model.py
```

The verifier saves complete responses under ignored `artifacts/`. It makes **32** checks,
or **35** with replacement, including inventory, evidence, both graphs, actual inference,
operational impact, exact plan replay, budgets/exclusions, invalid patch/incompatible actions,
fingerprint mismatch and baseline immutability. The optional replacement intentionally changes
the current simulated run; return to Live or check/review the latest baseline afterwards.

`GET /api/v1/simulation/attack-paths` now echoes exact run/scenario/snapshot/fingerprint and
current/projected isolation context. The frontend supplies all four binding fields. Explicit
old IDs return **409 stale_baseline**, even if the new fingerprint is equal. Unknown isolation
IDs return **422**. Legacy callers may omit all context fields to read latest; the new UI does
not use that unbound mode. No operational edges are traversed as cyber access.

## Measured evidence and model limitations

[PHASE_6_DEMO.json](PHASE_6_DEMO.json) records calculated values, exact patch/path evidence,
and the tested identity `run-20261031-205057-202610` / fingerprint
`fd5c651c1885ec6b207192bf985490fb`. Re-running creates a different ID. Times in machine-readable
records are UTC; the local verification date is 1 November 2026 in India.

[PHASE_6_MODEL_EVALUATION.json](PHASE_6_MODEL_EVALUATION.json) records the saved-model recheck:
**95 source checksums**, **147,305 test rows**; deployed XGBoost AP **0.0037**, ROC AUC **0.8789**,
precision@200/month **0.0119**, recall@200/month **0.0532**. EPSS-percentile baseline AP
**0.0044**, AUC **0.7290**, precision@200 **0.0133**, recall@200 **0.0597**. Saved CVE-clustered
95% AP interval is **[0.0023, 0.0071]**; paired AP difference vs EPSS interval is
**[-0.0141, 0.0017]**, so a statistically clear improvement is not established. Intervals were
preserved from the model card, not bootstrapped anew in Phase 6. Metrics and model hashes
reproduced without retraining. AUC alone does not establish useful precision in this imbalanced task.

The model predicts resemblance to later **KEV inclusion within 180 days** for CVEs absent from
KEV at a monthly snapshot; it does not estimate asset-compromise probability. Negative examples
are unlabeled, sampled at 3% and inverse-weighted. NVD features use a current record rather than
a full point-in-time archive, and sparse positives/KEV inclusion practices limit generalization.
The deterministic asset/city index combines that signal with configured exposure and conditional
impact. EPSS is a CVE-level exploitation signal; neither EPSS nor ML output measures compromise
of these simulated devices. Known KEV membership is distinct from confirmed local exploitation.

## Architecture and remaining limits

FastAPI owns evidence validation, inference, index calculation, cyber paths, conditional impact
and action projections. React consumes generated OpenAPI types and displays explanations.
SQLite stores fictional inventory and separate evidence assessments. The workflow uses its
own declared real-product mapping; the curated overlay is explicitly separate. Cyber edges
represent possible access; operational providerâ†’dependent edges model consequences, including
effect-specific backup substitution. New Phase 6 API report fields wrap the unchanged pure
attack-path engine. All projections retain current/projected distinctions.

- This is a single-process local demo. Latest run/history are in memory and shared by clients;
  restart loses them. IDs have second-level time granularity; fingerprints are reproducibility
  aids, not complete signed input manifests or authentication controls.
- Attack paths are bounded candidate enumeration with coarse protocol/control and CVE summaries.
  KEV membership alone does not prove a CVE enables a particular hop; the interface states that
  limitation. No exploit, lateral movement, scan or successful compromise is observed.
- Numeric version matching has vendor/pre-release limitations. Missing fixed-version evidence is
  not proof that no vendor fix exists. Neither target-version evaluation nor patch outcomes verify
  compatibility, process safety or installation.
- Impact fractions are assumed worst-plausible bounds, not calibrated forecasts. Isolation is
  coarse full cyber disconnection. Effort/downtime are constants; calendar, crews, rollback,
  process-safety validation and optimizer optimality are not established. Monitoring and response
  are recommendation-only with no claimed numeric benefit.
- Twins contain authored readings/criticality and illustrative art; only calculated-risk badges
  use the workflow. Transit has no scored inventory. Trends replay reference history and telemetry
  is authored simulation, not live monitoring. Coverage is an authored mapping, not compliance proof.
- No penetration test, load/concurrency test, full WCAG audit, hosted deployment verification,
  mobile touch gesture automation or physical network-disconnection test was performed. Native
  selectors and view controls work at mobile width; tiny diagram labels can be inspected with zoom.

## Troubleshooting

- **No score / 409 before simulation:** run Live Simulation; absence is not zero risk.
- **Stale baseline:** check latest, explicitly review/refresh baseline and recalculate. Never paste
  old run IDs into new requests. A 409 is intended protection, not a reason to silently substitute.
- **503 / intelligence unavailable:** inspect `/api/v1/ml/status`; restore manifest cache using
  the evaluator's `--fetch` option while online. It verifies hashes rather than accepting changed
  sources. Foundation inventory remains available; do not substitute mock findings.
- **API offline / route not found:** use the matching API/frontend from this checkout, check
  health and `artifacts/backend-error.log`, stop an obsolete process before relaunch. The asset
  register and deep links were checked against the merged API, with no obsolete route error.
- **Port occupied:** close the previous launch terminal with Ctrl+C. Do not kill unrelated services.
- **Test temp directory cannot be created in a restricted shell:** use a new, empty directory
  under ignored `artifacts/` via pytest `--basetemp`; do not delete someone else's temp directory.
- **Dependencies absent:** run setup while online. Swagger's optional interactive UI may use a CDN;
  the application and raw OpenAPI do not require that UI.

Read [PHASE_6_MODULE_AUDIT.md](PHASE_6_MODULE_AUDIT.md) and [VERIFICATION.md](VERIFICATION.md)
for the distinction between browser observations, automated boundary tests and untested claims.
