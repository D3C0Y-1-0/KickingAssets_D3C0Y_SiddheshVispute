# Architecture

**Local Phase 2 integration:** [PHASE_2_INTEGRATION.md](PHASE_2_INTEGRATION.md) records the combined branch. Objective O5 now also has Claude's pure conditional operational-impact engine, available through Python only; O2 retains Phase 2A's reference-backed assessment. No impact API/UI wiring or risk/ML engine was introduced. Historical phase descriptions below remain context, not the current combined implementation inventory.

**Phase 2A implemented:** [PHASE_2A.md](PHASE_2A.md) documents offline reference ingestion, conservative matching/configuration rules, additive v2a_* tables, scoped APIs and the query-backed register. This extends objective O2 within explicit coverage limits. Shared models.py and impact/risk engine files are unchanged. Original Phase 1 descriptions below remain the foundation boundary; no later risk/impact computation is claimed by this branch.

## System boundary and technology

One repository, one React/TypeScript/Vite frontend, one Python/FastAPI backend and one local SQLite database. Tailwind v4 is available alongside semantic CSS tokens, React Router supplies stable URLs, TanStack Query owns server-state caching, Cytoscape renders topology, Recharts renders the preview category chart and Lucide provides icons. No WebGL, external fonts, authentication service or cloud deployment is needed.

FastAPI uses Pydantic v2 response/request validation, a standard-library SQLite repository and thin inventory services. The compiled React SPA is served by FastAPI with a deep-link fallback. API and missing static-file paths return actual errors rather than falling through to index.html. Vite proxies `/api` during development; both production surfaces share an origin.

## Layers and ownership

1. **schemas:** shared domain contracts and invariants; the only authoritative definitions of HTTP data.
2. **domain:** deterministic scenario authoring and future domain rules, independent of HTTP.
3. **db:** SQLite initialization, idempotent fixture insertion and document retrieval; no risk calculations.
4. **services:** scoped inventory reads and scenario/snapshot resolution; future orchestration belongs here.
5. **api:** routes, HTTP error mapping and future explicit 501 boundaries.
6. **engine:** typed Python Protocol boundaries for future pure calculations; no implementation in Phase 1.
7. **ml:** reserved for versioned datasets, training, evaluation and inference artifacts.
8. **frontend:** central typed client → scoped Query hooks → feature screens. Components never calculate backend risk.

The database stores typed JSON documents with relational primary keys and graph endpoint foreign keys. ScenarioBundle validation checks cross-record identifiers, snapshot context, service references and edge endpoints before persistence. This keeps Phase 1 small while retaining explicit separate collections. Future vulnerability/assessment tables require a reviewed migration, not silent dynamic schema mutation. The current schema version is 1.

## Official objective ownership

The exact official text lives in PROJECT_SPEC.md and is authoritative here.

- **O1 Infrastructure Asset Profiling:** domain/seed, db/store, inventory service, assets and graph features. Working simulated foundation.
- **O2 Vulnerability Assessment:** future reference/applicability services and observation/finding persistence. Contracts/UI only in Phase 1.
- **O3 AI-Based Risk Prediction:** future ml prioritizer, risk scorer and impact engine. No calculation in Phase 1.
- **O4 Risk Prioritization:** future scorer/ranking orchestration; intelligence/overview presentation. Fixture previews only today.
- **O5 Dependency and Impact Analysis:** separate stored graphs today; effect-specific simulation later.
- **O6 Predictive Risk Dashboard:** frontend features and snapshots today; predictive evidence/trends later.
- **O7 Preventive Recommendations:** catalog staging today; recommendations, what-if and optimizer later.

Screen existence is never used as proof of objective completion.

## Two-graph architecture

Both graphs use the same immutable asset identity and snapshot context, but use distinct edge models and SQLite tables.

**CyberReachabilityEdge:** source → reachable target, permitted protocol/access class, explicit assumptions and possible compromise effects. This is configured technical plausibility. There is no successful-compromise flag, default exploit probability or implicit propagation engine.

**OperationalDependencyEdge:** source provider → target dependent, dependency resource, required/redundant/backup semantics, redundancy group, minimum providers and grace period. Cross-sector power/water edges exist only here in the seed. The UI uses dashed operational edges and solid cyber edges, separate query keys and descriptions.

ServiceRequirement holds k-of-n assets within a group. All primary groups must be satisfied. A backup names exactly which primary group it can substitute and carries an activation condition, delay and duration. A backup generator can substitute a power requirement during a power interruption; it cannot repair corrupted data or a compromised server. A future engine must evaluate these conditions against the initiating effect and time horizon.

## Future analysis pipeline and dependency order

Validated scenario snapshot → reference ingestion with publication/retrieval cutoffs → candidate applicability and confirmation → configuration observations → vulnerability prioritization → explicit compromise-effect assumptions / reachability → conditional operational service impact → transparent asset risk → aggregate city index → staged what-if recalculation → sequential marginal optimization → independent verification.

The ML prioritizer contributes a **CVE signal**, not a final asset incident probability. The risk scorer must expose its evidence and weights. A 0–100 relative risk index is never relabelled as a probability without a separately evaluated calibrated model. Lack of evidence must propagate as unavailable or partial analysis, not as a zero score.

## Future backend interfaces

`app/engine/contracts.py` contains Protocols, not placeholder algorithms:

- `VulnerabilityPrioritizer.prioritize(inputs, references, applicability) → list[VulnerabilityFinding]`
- `ServiceImpactEngine.simulate(inputs, assumed_effects) → list[ImpactResult]`
- `AssetRiskScorer.assess(inputs, findings, impacts) → list[RiskAssessment]`
- `WhatIfEngine.recalculate(inputs, baseline, request) → WhatIfResult`
- `RemediationOptimizer.optimize(inputs, baseline, request) → RemediationPlan`

`ScenarioBundle` is a validated snapshot input aggregate despite its seed use in Phase 1. Protocol implementations accept data and return values; they do not open SQLite, read HTTP requests, call frontend fixtures or mutate the input snapshot. Services load inputs, check applicability/context/version compatibility and persist results atomically. Reference I/O belongs in ingestion services, not in deterministic scoring functions.

The eventual reachability module must keep connectivity evidence distinct from the explicit assumed-effect mapping supplied to the impact engine. No invocation from the current routes performs any of these computations; exposed future routes return 501 after request validation.

## Identity, versions and provenance

Scenario IDs and stable asset IDs are human-readable strings; snapshot IDs are globally unique. Record identity is scoped by snapshot for repeatable snapshots. References preserve CVE IDs independently of asset-vulnerability links. Relationships carry explicit kind discriminators.

Timestamps are timezone-aware. Scoring/model/optimizer versions and provenance accompany derived records. The Phase 1 baseline is `aurora-baseline-v1`, fixed at 2026-10-01T09:00:00Z. Client time, browser refresh and health polling never change that timestamp.

Within a WhatIfResult, `scenario_id` and `snapshot_id` identify the **base snapshot** consistently across current/projected values. Future persistence of a distinct projected snapshot uses AssessmentSnapshot.parent_snapshot_id and must coordinate that API evolution explicitly. Verification requires evidence and a verifier; it is not produced by a simulated projection.

## Frontend extension strategy

Feature directories own screens. `api/client.ts` alone handles fetch, query parameters, cancellation and HTTP errors. `hooks/queries.ts` owns cache keys scoped to scenario, snapshot, graph mode and asset. Active scenario is resolved through `/scenarios`; no JSX contains inventory seed arrays. The current shell displays the single scenario rather than pretending a multi-scenario selector is available.

`fixtures/previews.ts` is the sole source for design-only demo scores and the non-executing action catalog. Future calculated data must replace this path explicitly, with unavailable handling and provenance. Do not join a missing result to a fabricated zero. The original figure is isolated under components/illustration and ships as precomputed SVG paths with scoped CSS; its generator depends on local Anatomy tooling only.

The native asset dialog supports modal focus, Escape and return focus. The graph has pointer selection and a native selector for keyboard inspection. Breakpoints collapse navigation and reorganize panels; wide tables scroll inside their own panels. Reduced motion disables animations, including the loading spinner.

## Integration and deployment boundary

Development: browser → Vite :5173 → `/api` proxy → FastAPI :8000 → SQLite. Offline demonstration: browser → FastAPI :8000 → compiled SPA and `/api/v1` → SQLite. No service worker caches stale API data. No external asset or feed is necessary to launch.

This is a local demonstration boundary. An eventual networked deployment needs its own authentication, authorization, audit, request limits, operational review and packaging work. Such deployment is not implied by this phase and has not been provisioned.
