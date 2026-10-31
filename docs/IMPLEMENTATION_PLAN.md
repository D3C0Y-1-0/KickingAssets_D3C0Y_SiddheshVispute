# Implementation plan

**Phase 6 assigned scope delivered:** final verification/demo readiness on `feature/phase-6-finalization`, from verified Phase 5 `62dece9`. See FINAL_DEMO_RUNBOOK.md and PHASE_6_MODULE_AUDIT.md for the actual 14-module audit, minimal attack-path inspector, context/error fixes, reproducible calculations and remaining prototype limitations. This completes the specifically requested local readiness batch; it does not imply production capabilities or full satisfaction of every objective in the historical roadmap below. No later phase, retraining or main merge is included.

**Phase 5 integrated and verified:** [PHASE_5_INTEGRATION.md](PHASE_5_INTEGRATION.md) records exact run/fingerprint binding, CVE-specific patches, maintenance constraints, optimizer/handoff compatibility and complete tests/browser checks on `integration/phase-5`. This completes the specifically assigned Phase 5 integration, not every later production capability in the historical roadmap. Phase 6 has not begun; define its scope against the recorded remaining limitations.

**Delivered integration batch:** [PHASE_3_INTEGRATION.md](PHASE_3_INTEGRATION.md) documents the bounded Phase 3A work and subsequent user-authorized synchronization of all existing branches. ML training/artifacts were inspected and reevaluated, not replaced. Risk UI/API and transparent prioritization now use real inference. Existing workflow, twins, force graph and action implementations were integrated from remote histories; no new later-phase engine was developed. The historical phase numbering below remains the original roadmap.

**Phase 2A delivered:** real offline-capable reference ingestion, conservative applicability to declared simulated components, separate configuration/exposure evidence, persistence, APIs and register integration. [PHASE_2A.md](PHASE_2A.md) records exact coverage and remaining limits. Subsequent ML/risk/What-If/optimizer work remains deferred. Claude's independent impact module must be integrated separately through coordinated entry points; this branch does not implement or modify it.

## Phase 1 acceptance boundary

Phase 1 implements foundations for the seven official objectives preserved in PROJECT_SPEC.md. It does not claim completion of vulnerability assessment (O2), AI-based prediction (O3), calculated risk prioritization (O4), consequence calculation (O5), predictive evidence/trends (O6) or evidence-backed preventive recommendations (O7).

Completion requires all of the following:

- Local React/Vite and FastAPI launch, plus compiled SPA serving from FastAPI.
- Seven stable routes, persistent responsive dark shell, semantic design tokens, visible sample status and no dead controls pretending to execute engines.
- Deterministic SQLite seed with 30 stable assets in power/water/healthcare; source products, versions and configurations labelled fictional.
- Scenario-scoped inventory/detail/services/snapshot APIs; structured health, validation and error responses.
- Separate typed cyber/operational edge stores and Cytoscape modes with fit, zoom/pan, selection, filters, inspection and search focus.
- Shared domain models, provenance, snapshot/version/state semantics and null unavailable results.
- Original isolated isometric SVG using reviewed Anatomy principles, meaningful sector highlight and no fabricated telemetry.
- Search/sort/filter inventory, product/security/source inspection, and honest vulnerability/analysis absence.
- Frontend API tests/typecheck/build, backend tests/lint/seed reproducibility, actual browser route/interaction/responsive/failure checks.
- Complete architecture, contract, specification, test evidence, handoff, ownership conventions and reproducible Windows commands.

Actual acceptance evidence and limits live in VERIFICATION.md. A checked foundation item is not a checked intelligence engine.

## Phase 2 — Reference intelligence and applicability (O2; extends O1)

**Depends on:** Phase 1 schemas, asset versions and persistence. Add source-backed NVD, CVSS, EPSS and KEV importers with recorded retrieval/publication cutoffs and offline cached fixtures. Introduce vulnerability/observation/link tables through an explicit migration. Distinguish candidate matches from confirmed applicability. Normalize product identity without equating fictional vendor strings with real products.

**Validation gate:** feed schema/version handling, deduplication, missing values, stale records, source lineage, candidate/confirmed/rejected matches, deterministic offline replay and frontend evidence inspection. No risk score before applicability and model/scoring semantics are settled.

## Phase 3 — CVE prioritization and evaluation (O3; supports O4)

**Depends on:** versioned reference dataset and applicability outputs. Build training/evaluation in backend/ml with XGBoost and scikit-learn. Compare to transparent severity/EPSS/KEV baselines. Keep future KEV information out of earlier training rows; historical modelling requires dated datasets and a temporal holdout. Version features, weights, cutoffs, labels and artifacts.

**Validation gate:** reproducible split, leakage audit, class imbalance handling, ranking metrics at a review budget, uncertainty and baseline comparison. Do not fabricate evaluation numbers. Expose inference only after a real model and acceptable evaluation exist. The model prioritizes CVEs, not incident timing.

## Phase 4 — Effect-specific relationships and conditional service impact (O5)

**Depends on:** validated graph/service definitions; may be developed alongside Phase 3 after shared schema coordination. Use NetworkX internally without merging the two graph semantics. Describe reachable targets under explicit assumptions separately from successful compromise. Evaluate loss of control, loss of visibility, integrity and unavailability distinctly.

Implement k-of-n groups, named backup substitution, activation conditions, finite backup duration, grace periods and initiating effect/time horizon. Do not count all descendants as failed. Cycles need an explicit fixed-point or bounded evaluation rule rather than implicit recursion.

**Validation gate:** hand-calculable chain/fork/cycle cases, redundant provider survival, exhausted backup, activation delay, cross-sector effects and negative controls where loss of visibility does not imply immediate service unavailability.

## Phase 5 — Transparent risk assessment and dashboard evidence (O3, O4, O6)

**Depends on:** findings and conditional impact; a documented scorer can use unavailable/partial signals only under an explicit completeness policy. Add versioned persistence and orchestration, named factors/evidence IDs, asset ordering and an aggregate city relative index. Publish the formula and normalization; maintain reference/model/scoring versions.

Replace isolated frontend preview fixtures with query-backed results, showing unavailable and partial coverage. Add comparable assessment history instead of turning the seeded inventory timestamp into an assessment event.

**Validation gate:** bounded scores, missing≠zero, no double counting, stable ties, understandable factor contributions, monotonic control cases, source inspection, snapshot/version compatibility and UI behavior on failed calculations. Calibrated probabilities require separate support; a relative index is not sufficient.

## Phase 6 — Recommendations and What-If recalculation (O7; extends O4–O6)

**Depends on:** real baseline scoring, action applicability and conditional impact. Build a backend action catalog with provenance, prerequisites, estimated effort and operational disruption. Include patch, segmentation and access control options; monitoring/response planning can be recommendations without adding a monitoring/response system.

Apply hypothetical configuration deltas to isolated inputs. Return current/projected assessments, per-action effects and conditional impacts; preserve the base context and versions. Create projected snapshots only through a coordinated persistence design. No endpoint applies real infrastructure changes.

**Validation gate:** baseline unchanged after simulation, inapplicable/conflicting actions rejected, repeatable comparisons, sensible no-op results, preserved service constraints and no transition to verified without evidence.

## Phase 7 — Lightweight greedy remediation optimizer (O7; extends O4)

**Depends on:** What-If engine and reliable cost/constraint definitions. Recompute each remaining action's marginal reduction after each selection; rank feasible actions under effort/disruption restrictions. Keep chosen sequence and its marginal values inspectable. Avoid adding a solver service or multi-agent orchestration.

**Validation gate:** overlapping mitigations do not receive duplicate credit; zero/negative improvements are excluded according to documented policy; effort budgets and exclusions are obeyed; deterministic tie-breaking; brute-force comparison on tiny cases to characterize greedy limitations.

## Phase 8 — Integrated demonstration and evaluation (all objectives)

**Depends on:** completed real modules and their gates. Assemble source-backed score explanations and a before/after what-if narrative. Test offline startup from a fresh checkout and reset database; verify all routes and deep links, source inspection, graph semantics and error states. Record measured model results and explicitly simulated impact assumptions. Preserve current/projected/verified states.

Judge readiness by the official objective behavior, not the number of screens. Independent verification records may document manually supplied evidence; no autonomous remediation is introduced. Live feeds, real-world incident forecasting, cloud rollout and security monitoring remain out of scope unless separately approved.

## Agent dependency and integration order

Codex can own reference ingestion/persistence, orchestration, API integration and frontend wiring. Claude can own isolated ML training/evaluation or graph/impact engine implementations after a bounded assignment. These are suggested future roles, not agents dispatched during Phase 1.

The coordinating agent owns shared schemas, engine Protocols, API routes, generated artifacts, fixture changes and handoff docs. Establish exact file ownership before concurrent work. Integrate one engine through tests and regenerated contracts at a time; never let two agents independently redefine risk semantics or alter the seed to suit their algorithm.
