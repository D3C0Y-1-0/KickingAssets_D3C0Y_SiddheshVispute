# Domain contracts

**Phase 7:** schemas/preventive.py adds mandatory-fingerprint Binding, explicit Failure/CyberChallenge/FailureScenario, versioned Intervention/Catalog, EvaluationRequest/OptimizationRequest/StressRequest, interval/standby/service/asset outcomes, Comparison/Evaluation/Optimization and StressReport. Finite strict numeric bounds, unique event identity, explicit causes and extra-field rejection protect the additive API. Outputs retain run/date/model/engine/scoring lineage, catalog/input hashes, UTC calculation time, projected/not_verified state and separate service-minute and optional legacy risk results. Existing shared models and schemas remain unchanged. See PHASE_7_RESILIENCE_ENGINE.md.

**Phase 6:** `schemas/attack_paths.py::AttackPathReport` inherits the unchanged pure-engine AttackPathAnalysis and adds exact scenario/snapshot/run/fingerprint, current/projected state and sorted hypothetical isolated asset IDs. It is an API envelope, not another risk/compromise model. Shared models.py, simulation shapes, graph schemas and model artifacts are unchanged. Generated contracts were regenerated. Missing/failed reads remain unavailable, never zero. See FINAL_DEMO_RUNBOOK.md.

**Phase 5:** `schemas/simulation.py` defines exact BaselineBinding, CVE-specific StagedActionRequest, OperationalConstraints, PatchOutcome/CveRemediation, ConstraintReport, ProjectionSummary and authoritative PlanHandoffRequest. SimulationRun.fingerprint summarizes the dated model/scorer output; WhatIfResult/RemediationPlan echo it with run_id. Per-action standalone/marginal reductions, outcomes and downtime remain calculated backend values. `schemas/models.py` adds structured ApiIssue(path/code/message) to errors. Shared impact/graph identities and original fixture are preserved. See PHASE_5_INTEGRATION.md for state/coverage limits; a modelled `remediated` CVE is not a verified installation.

**Phase 3 integration:** additive `schemas/intelligence.py` defines CVESignal (computed / known_kev / unavailable), signed FeatureContribution, AssetPriority, ModelEvidence and IntelligenceReport. Native model scores remain separate from relative asset indices. A report preserves scenario/snapshot, assessment/reference IDs, hashes, model variant and scoring/impact versions, partial coverage, explicit projected impacts and unavailable scores. `schemas/simulation.py` owns the independently merged workflow contracts. No existing impact Protocol or fixture identity was changed. See [PHASE_3_INTEGRATION.md](PHASE_3_INTEGRATION.md) for the two explicit assessment contexts.

**Phase 2A extension:** existing shared definitions remain unchanged. Feature-only reference, software-evidence, applicability/configuration and persisted-report response types are in schemas/vulnerability.py; see PHASE_2A.md. Existing VulnerabilityFinding remains reserved for future model priorities. AssetVulnerability and SecurityObservation now carry actual rule-derived evidence, scoped to simulated declarations and retained provenance, without risk calculations.

Authoritative code: `backend/app/schemas/models.py`. All models reject unknown fields. IDs are nonempty stable strings matching letters, numbers, underscores, periods or hyphens. Time fields use timezone-aware Pydantic AwareDatetime. JSON uses snake_case. Optional analysis fields serialize as null, not fabricated values.

## Context and evidence

**Scenario:** named simulated environment, stable ID, current snapshot, seed version, sample marker and provenance. `current_snapshot_id` points to the baseline snapshot. There is currently one scenario.

**Provenance:** evidence kind (`configured`, `observed`, `scenario_assumption`, `reference`, `model`, `simulation`), source, recorded time, optional evidence URI and notes. UI design fixtures are outside this evidence system and cannot be ingested as model results. All seed provenance is scenario_assumption.

**AssessmentSnapshot:** scenario/snapshot IDs, name, creation time, current/projected/verified state, optional parent and scoring/model versions, and assessment availability. A snapshot can be a valid inventory snapshot while assessment_status is unavailable. Snapshot identity does not mean a risk computation has occurred.

## Asset and security records

**InfrastructureAsset:** stable `id`, scenario/snapshot context, sector, asset type, site, fictional vendor/product/version, criticality, exposure, description and SecurityConfiguration. Asset IDs persist across snapshots; the database uses `(id, snapshot_id)` as the asset key.

**SecurityConfiguration:** network zone, nullable MFA/internet/remote-access indicators, patch-review status, backup mode, notes and provenance. Unknown is distinct from false. Configuration is not a successful security verification.

**VulnerabilityReference:** independent CVE record with valid CVE identifier, summary, nullable CVSS/EPSS/KEV signals, source publication/retrieval times and provenance. These fields must come from attributed reference data. None are seeded.

**AssetVulnerability:** context-scoped link from asset ID to vulnerability ID. Applicability is candidate/confirmed/rejected/unknown with rationale and provenance. Product-name similarity alone cannot set confirmed.

**SecurityObservation:** context-scoped observation ID, asset ID, category, description, observation time and provenance. This is evidence, not automatically a vulnerability or computed score. None are seeded.

## Relationships and service requirements

**CyberReachabilityEdge:** kind=cyber; source asset → target asset; protocol, access class, nonempty assumptions, possible compromise effects and provenance. Supports loss_of_control, loss_of_visibility, data_integrity and unavailability. Connectivity never implies successful compromise.

**OperationalDependencyEdge:** kind=operational; provider asset → dependent asset; power/water/control/data/backup dependency; required/redundant/backup requirement; optional redundancy group; minimum providers; grace period; assumptions and provenance. It cannot be deserialized as a cyber edge due to forbidden fields and the literal discriminator.

**EssentialService:** stable ID, sector, description, context, ServiceRequirements, assumptions and provenance. It defines a service rather than claiming it is currently available.

**ServiceRequirement:** named k-of-n provider group; unique asset IDs, minimum availability, primary or backup role. Primary groups are conjunctive. Backup groups require a finite duration, activation delay, activation_condition and substitutes_requirement_id. The target must be a primary group in the same service. A generator's power-only activation condition must not be applied to control compromise or integrity loss. Validation rejects impossible k-of-n groups, duplicate members and missing backup targets/durations.

**ScenarioBundle:** validated aggregate of Scenario, AssessmentSnapshot, asset inventory, both edge lists and services. It validates unique collection IDs, common context, current snapshot reference, graph endpoints, no self edges, service asset references and backup target references. Persistence loads this aggregate before inserting anything.

## Future analysis records

**VulnerabilityFinding:** result for a specific AssetVulnerability link, with context, nullable priority, status, explanations, model version and provenance. Unavailable findings reject a priority. Computed findings require an explicit priority and model version.

**RiskAssessment:** asset-specific or aggregate (`asset_id=null`) relative score, category, named RiskFactors with evidence IDs, current/projected/verified state, status, unavailable reason, calculation time, scoring/model versions and provenance. Unavailable assessments reject score/category/contributions; computed assessments require score, category, scoring version and calculation time, with no unavailable reason. Zero is legitimate only for an explicitly calculated versioned result. There is no fabricated default score.

**RiskFactor:** named numeric contribution, evidence IDs and explanation. A signed contribution is allowed; the later scorer defines its units/normalization and exposes them. Phase 1 supplies no computed contributions.

**ImpactResult:** scenario/snapshot and service IDs, initiating asset, specific compromise effect, current/projected state, availability, optional disruption fraction in [0,1], affected asset IDs, assumptions, engine version/time and provenance. Unavailable results reject computed disruption fields; computed results require fraction, version and time. This is conditional on assumptions rather than a real-world outage prediction.

**MitigationAction:** context, stable action and target IDs, named action type, security justification, optional effort hours, operational disruption description, prerequisites and provenance. Action definitions do not execute infrastructure changes. The Phase 1 frontend action catalog is a local presentation aid, not persisted recommendation evidence.

**WhatIfRequest:** base scenario/snapshot plus one to thirty StagedActions and explicit assumptions. **StagedAction:** target asset and allowed action type. No arbitrary infrastructure command or code is accepted.

**WhatIfResult:** base context, request, state=projected, current and projected RiskAssessments, per-action factors, impact outputs and engine version. It validates matching base context and distinct current/projected states. Computed status requires both assessments and an engine version. Unavailable status cannot contain computed effects. It does not mark actions verified.

**RemediationRequest:** base context, positive effort budget and excluded assets. **RemediationPlan:** state=projected, context, status, prioritized MitigationActions, one marginal risk reduction per action, effort budget, optimizer version and provenance. Unavailable status cannot return an optimized action list. Computed status requires version, aligned reduction/action counts and consistent action context. Future optimizer validation must additionally enforce eligibility, budget and operational constraints.

**VerificationRecord:** stable ID, context, action ID, state=verified, passed/failed/inconclusive outcome, verification time, verifier, at least one evidence ID and provenance. “Verified” describes a recorded verification attempt; failed/inconclusive does not establish success. An action projection never generates this evidence automatically.

**AssessmentRequest:** existing context and optional asset selection (empty selects the whole inventory in the future contract). It does not accept a client-supplied score.

## Response wrappers

**AssetDetail:** asset, vulnerability links, security observations and current RiskAssessment. Phase 1 returns empty evidence lists and an unavailable risk result; an empty list means not imported/collected, not vulnerability-free.

**CyberGraph / OperationalGraph:** explicit type, context, shared asset nodes and the corresponding typed edge list. The graph query requires a mode. There is no combined mode.

**Health:** database readiness, application version and explicit not_implemented intelligence status. It is an API process/storage check, not a security-monitoring status.

**ApiError / ErrorEnvelope:** stable error code, human-readable message and safe validation details. No request secrets or raw database exceptions are echoed.

## Persistence and change discipline

Only scenario, snapshot, assets, edges and services are persisted in Phase 1. The other schemas are designed future boundaries, not claims that their engines or storage exist. Add versioned migrations and evidence tables when implementing them. Coordinate schema changes first, regenerate OpenAPI and TypeScript, update model docs and run validation tests before merging an engine into a route.
