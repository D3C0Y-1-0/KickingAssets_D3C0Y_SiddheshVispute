# API contract v1

**Live SOC additive APIs:** `/api/v1/soc/session` POST/DELETE; `/snapshot`, `/events?after=ID`
(ordered SSE/Last-Event-ID) and `/logs?before=ID&limit=N` GET; `/blocks` POST
`{ip,reason,minutes}`; `/unblock` POST `{ip}`; `/nodes/{asset}/protection` POST `{protected}`.
Operator cookies are hashed, expiring, IP-bound and bootstrapped only through loopback.
Foreign-Origin control writes are rejected. `/analyze` POST requires
`{event_id,scenario_id,snapshot_id,run_id,baseline_fingerprint}`. `SocAnalysis` returns the
original event, model version/as-of, unchanged AssetSimulation, supported ActionOptions,
nullable PlanHandoffRequest/WhatIfResult and explicit limitations. Missing/non-node events,
unauthorized callers, non-Aurora contexts and stale/mismatched runs are rejected. Analysis
does not replace baselines. SocEvent adds critical severity for v2 confirmed fictional-data
disclosures; retained v1 evidence is unchanged. OpenAPI and TS types are regenerated.

**Phase 7 additive endpoints:** four POSTs under `/api/v1/resilience/preventive`: `/catalog`, `/simulate`, `/optimize`, `/stress-test`. All require exact scenario/snapshot/run and 32-hex baseline fingerprint; evaluation also requires the current 64-hex catalog fingerprint. New strict models live in schemas/preventive.py. Limits, action IDs, costs/units, event assumptions and structured 404/409/422/503 behavior are defined in PHASE_7_RESILIENCE_ENGINE.md and regenerated OpenAPI. All 34 pre-existing paths and 113 schemas were compared equal; older action APIs are unchanged. No frontend behavior changed.

**Phase 6 additive contract:** `GET /api/v1/simulation/attack-paths` returns `AttackPathReport`: unchanged engine analysis plus `scenario_id`, `snapshot_id`, `run_id`, `baseline_fingerprint`, `state` and `isolated_assets`. The UI supplies all binding fields; any supplied context requires run_id, optional omitted scenario/snapshot default to the current context, and explicit old/mismatched context is rejected through existing BaselineBinding (409; unknown run 404). Repeated `isolate` query values apply hypothetical full cyber isolation; unknown asset IDs now return 422. `max_paths_per_target` remains 1–50. Omitting all binding fields preserves legacy latest-read compatibility. `/actions/options?run_id=` now validates length at the HTTP boundary (422 rather than an uncaught model validation error). Raw OpenAPI and generated TS are authoritative; the pure attack-path engine is unchanged. See FINAL_DEMO_RUNBOOK.md for reproduction and limitations.

**Phase 5 integrated authority:** [PHASE_5_INTEGRATION.md](PHASE_5_INTEGRATION.md), [PHASE_5A.md](PHASE_5A.md) and regenerated OpenAPI. Working action endpoints are `/api/v1/actions/options?run_id=...`, `/actions/what-if` and `/actions/optimize` (all under `/api/v1`). POST requests require exact `run_id`; the UI also supplies `baseline_fingerprint`. Patch actions retain `cve_ids` / `target_version`; OperationalConstraints uses downtime limits, incompatible pairs and prerequisites. RemediationPlan.what_if_request is the authoritative replay payload. Errors retain `code`, `details` and optional structured `issues`. Historical foundation contracts below are not a claim that these engines remain absent.

**Current integrated contract:** see [PHASE_3_INTEGRATION.md](PHASE_3_INTEGRATION.md) and [WORKFLOW.md](WORKFLOW.md). The combined OpenAPI includes the original vulnerability router, workflow/ML/actions APIs and additive `GET /intelligence`, `POST /intelligence/assess`, `GET /intelligence/model`. All paths are under `/api/v1`. Curated assessments take scenario/snapshot context, preserve hashes and versions, return 409 for stale/missing results and use a distinct formula/product overlay from the workflow. `AssetDetail.risk` is the workflow result and stays unavailable before a simulation. Historical 501 examples below describe the original foundation, not all current APIs.

**Phase 2A:** [PHASE_2A.md](PHASE_2A.md) documents the additive `/api/v1/vulnerabilities` router, explicit assessment POST, coverage/staleness and compatible asset-detail projection. Empty evidence examples below describe the historical Phase 1 baseline. Current PWR-001 responses contain two applicability links and three configuration/exposure/review observations; risk remains unavailable.

Machine-readable authority: `GET /openapi.json`; tracked export: `docs/openapi.json`. Interactive API docs: `/docs`. Generated frontend types: `frontend/src/api/schema.d.ts`. Pydantic's runtime OpenAPI can split input/output schema names when defaults differ; generated names are authoritative.

## Conventions

- Base path `/api/v1`; JSON snake_case; errors use ErrorEnvelope.
- Stable scenario, asset and snapshot IDs are strings. Asset reads are scoped by both scenario and snapshot.
- Default scenario is `aurora-city`. Omitting snapshot_id resolves that scenario's current_snapshot_id; supplying an unknown scenario/snapshot returns 404 rather than silently falling back.
- Timestamps are timezone-aware ISO 8601. Phase 1 fixture time is 2026-10-01T09:00:00Z.
- All seeded records carry scenario_assumption provenance. No API risk field contains a visual preview score.
- Read collections return arrays in deterministic ID order. Asset filter ordering in the UI is a separate view concern. There is no pagination at the fixed 30-asset Phase 1 scale.
- GET endpoints do not modify infrastructure. Seeding occurs at process startup or via the documented local CLI; there is no HTTP reset endpoint.

## Implemented endpoints

### GET /health

Returns 200 when the SQLite schema is ready. Database failure returns 503 with ErrorEnvelope.

```json
{"status":"ok","database":"ready","application_version":"0.1.0","intelligence":"not_implemented"}
```

### GET /scenarios

Returns `Scenario[]`, currently one fictional Aurora City record. Each includes id, name, description, current_snapshot_id, is_sample=true, seed_version, created_at and provenance.

### GET /snapshots?scenario_id=aurora-city

Returns `AssessmentSnapshot[]` for the selected scenario. The baseline is current but assessment_status=unavailable. It is inventory history, not fabricated model history.

### GET /assets

Returns `InfrastructureAsset[]`. Optional queries:

- `scenario_id` and `snapshot_id`: context.
- `sector`: power, water or healthcare.
- `asset_type`: gateway, controller, workstation, server, sensor or backup.
- `q`: case-insensitive substring of asset ID, name or product.

Example: `/api/v1/assets?scenario_id=aurora-city&snapshot_id=aurora-baseline-v1&sector=water&asset_type=gateway` returns WTR-001. Invalid enum filters return 422. Empty matches return 200 with `[]`.

Asset shape example (abbreviated; full security/provenance fields are in OpenAPI):

```json
{
  "id":"PWR-001",
  "scenario_id":"aurora-city",
  "snapshot_id":"aurora-baseline-v1",
  "name":"North Grid Gateway",
  "sector":"power",
  "asset_type":"gateway",
  "vendor":"Aurora Systems (fictional)",
  "product":"Sentinel Gateway Series",
  "version":"3.1.0",
  "criticality":"important",
  "exposure":"external"
}
```

### GET /assets/{asset_id}

Optional scenario_id and snapshot_id. Returns AssetDetail:

```json
{
  "asset":{"id":"PWR-001","...":"full InfrastructureAsset record"},
  "vulnerabilities":[],
  "observations":[],
  "risk":{
    "scenario_id":"aurora-city",
    "snapshot_id":"aurora-baseline-v1",
    "asset_id":"PWR-001",
    "state":"current",
    "status":"unavailable",
    "score":null,
    "category":null,
    "factors":[],
    "unavailable_reason":"Risk engine is not implemented in Phase 1",
    "scoring_version":null,
    "model_version":null,
    "calculated_at":null,
    "provenance":{"kind":"scenario_assumption","source":"Aurora City fixture v1","recorded_at":"2026-10-01T09:00:00Z","evidence_uri":null,"notes":"Fictional scenario. No live infrastructure or scans."}
  }
}
```

The ellipsis in the example abbreviates asset fields; it is not a valid request fixture. Empty vulnerability/observation arrays do not establish security. Missing asset IDs return 404 in the requested context.

### GET /graph?type=cyber

Required `type` is cyber or operational. Optional scenario_id/snapshot_id. Returns CyberGraph or OperationalGraph with `nodes`, `edges`, `type` and context. There is no combined graph.

Cyber edge example:

```json
{
  "id":"cyber-PWR-1-4",
  "kind":"cyber",
  "scenario_id":"aurora-city",
  "snapshot_id":"aurora-baseline-v1",
  "source_asset_id":"PWR-001",
  "target_asset_id":"PWR-004",
  "protocol":"HTTPS",
  "access":"remote_management",
  "possible_effects":["data_integrity","unavailability"],
  "assumptions":["Configured directional route and protocol permitted in this fictional scenario.","Reachability does not establish exploitability or successful compromise."],
  "provenance":{"kind":"scenario_assumption","source":"Aurora City fixture v1","recorded_at":"2026-10-01T09:00:00Z","notes":"Fictional scenario. No live infrastructure or scans."}
}
```

### GET /graph?type=operational

Same wrapper, but edges have `kind=operational`, dependency, requirement, redundancy_group, minimum_providers, grace_period_minutes, assumptions and provenance. **Direction is provider → dependent**. Example: PWR-007 → WTR-007 is a redundant power provider relationship. It is not cyber connectivity. Mode-specific fields are forbidden in the other edge schema.

### GET /services

Optional scenario_id/snapshot_id. Returns EssentialService[] with requirements and assumptions. A requirement supplies asset_ids, minimum_available, primary/backup role and backup duration/delay/target/activation condition. This endpoint returns definitions; it provides no service uptime or calculated disruption.

## Future endpoints exposed as explicit unavailable contracts

Valid requests below always return **501** in Phase 1. Request validation still applies (invalid inputs return 422). OpenAPI describes the intended eventual response models; the existence of a 200 schema is not an implemented engine.

### POST /assessments

Request: AssessmentRequest. Eventual response: RiskAssessment (aggregate or selected asset as coordinated by the future service).

```json
{"scenario_id":"aurora-city","snapshot_id":"aurora-baseline-v1","asset_ids":[]}
```

### POST /what-if

Request: WhatIfRequest. Eventual response: WhatIfResult with distinct current/projected RiskAssessments, action effects and conditional impacts. All context in the result refers to the base snapshot. No mutation of current infrastructure is permitted.

```json
{
  "scenario_id":"aurora-city",
  "snapshot_id":"aurora-baseline-v1",
  "actions":[{"asset_id":"PWR-001","action_type":"enable_mfa"}],
  "assumptions":["Identity enrollment prerequisites must be validated."]
}
```

### POST /remediation/optimize

Request: RemediationRequest. Eventual response: RemediationPlan with per-action marginal reductions, effort and a versioned optimizer. Not an execution endpoint.

```json
{"scenario_id":"aurora-city","snapshot_id":"aurora-baseline-v1","effort_budget_hours":8,"excluded_asset_ids":[]}
```

## Errors and absence

```json
{"error":{"code":"not_implemented","message":"What-if recalculation engine is not implemented in Phase 1","details":[]}}
```

404 uses code=not_found; 422 uses validation_error and safe field-level details; 503 uses unavailable. Unknown API paths return structured 404, never the SPA. Validation messages do not echo full payloads. SQLite exceptions are replaced with a safe storage-unavailable message.

Null scores, empty findings and unavailable statuses must remain distinguishable. A failed API request must show an error/retry state; substituting local inventory or preview scores would hide failure and is forbidden. Successful reads support AbortSignal cancellation through the central client.

## Provenance and evolution requirements

Every future finding/reference/analysis must retain scenario/snapshot context where applicable, source identity, recorded/retrieved/calculated times, applicability status, assumptions and engine/model/scoring versions. A new reference feed must not overwrite original publication timestamps. Evidence IDs must link explanations back to inspectable records.

Schemas are contract-first: coordinate an additive migration and API change, update backend validation/tests, export OpenAPI, regenerate frontend types, update these docs and integrate Query hooks. Do not hand-edit generated declarations or invent a second interface in a feature component. See DOMAIN_MODELS.md and AGENTS.md.
