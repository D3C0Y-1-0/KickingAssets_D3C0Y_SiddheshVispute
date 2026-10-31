# API contract v1

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
