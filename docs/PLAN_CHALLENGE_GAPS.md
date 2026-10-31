# Plan: closing the PS03 Challenge gaps

Branch `codex/innovations`. Owner of this plan: the coordinator for this branch (shared schemas, routes, navigation, generated contracts, handoff documents). Status is tracked at the bottom and updated as work lands.

## 1. Why

The PS03 Challenge text asks for a system that evaluates posture from "simulated infrastructure data, vulnerability information, **network activity**, and asset criticality", flags vulnerable components, estimates risk, predicts **which assets need urgent attention**, shows **changing threat levels**, and covers **supply-chain** risk and CERT-In smart-city areas. The seven objectives are met by the integrated workflow; these Challenge items are not:

| Gap | Today | After this plan |
|---|---|---|
| Network activity input | none | simulated telemetry plus a transparent anomaly detector (F1) |
| Compromised vendor / supply chain | vendor is only a label | vendor concentration and vendor-compromise scenarios (F2) |
| Where would an incident hurt most | per-asset worst case only | single-point-of-failure ranking (F3) |
| Changing threat levels | no trend | monthly posture replay and daily activity index (F4) |
| Explain and hand over the result | on-screen only | exportable risk brief (F5) |
| Prove scope honestly | prose in docs | in-app PS03 and CERT-In coverage matrix (F6) |

Not built, with reasons: calibrated incident likelihood (the model is a ranking signal and there is no outcome data for Aurora); new sectors such as transport and telecom (would change the protected scenario fixture); modelled detection and recovery time (the engine has no recovery term, so monitoring and incident-response stay recommendations).

## 2. Rules that apply to every feature

1. Nothing synthetic is shown as observed. Telemetry and its events are labelled `simulation` with authored provenance, in the API and on screen.
2. Missing analysis is `null`/unavailable, never zero. A feature that needs a simulation run says so (HTTP 409), as the existing workflow does.
3. Existing contracts are untouched: new shapes live in `schemas/insights.py`; `risk-index-v1` is not changed. Activity influences only a separate, documented **urgency** value.
4. Pure engines (no I/O) under `app/engine/`; services orchestrate; routes stay thin; one new router registered in `main.py`.
5. Deterministic: seeded generators, injected clock, stable ordering. Tests protect the invariants, not the rendering.
6. Cyber and operational graphs stay separate. Connectivity is never treated as compromise. Vendor compromise is an explicit assumed effect.
7. Every figure carries its method version and assumptions.

## 3. Features

### F1. Simulated network telemetry and anomaly detection (`app/engine/telemetry.py`)

**Data.** 60 daily samples per asset ending 2026-10-01 (the baseline snapshot date). Metrics: `flows`, `bytes_out_mb`, `distinct_peers`, `failed_logins`, `off_hours_share`, `ot_writes` (controllers only). Baseline level and variability come from asset type and zone (OT controllers: low and very regular; gateways: high; workstations: working-hours pattern), with a weekday factor and seeded noise (`random.Random(sha256(asset|metric|day))`, so reproducible on any machine).
**Authored events** (`data/scenarios/aurora-telemetry-events.json`, labelled scenario assumptions): a perimeter scan, credential stuffing against the internet-exposed VPN gateway, off-hours exfiltration-like transfer from a workstation, unusual write commands to a PLC, and one benign maintenance window (a deliberate false-positive probe). Each has id, asset, metrics multiplied, day range and a ground-truth `malicious` flag.
**Detector.** (City index = noisy-OR of asset anomaly scores scaled by criticality, capped at 0.6 each; bands calm < 15, elevated < 40, active.) For day t and metric m: robust z-score against the trailing 28 days (median and MAD scaled by 1.4826, with a floor of 10 % of the median so quiet metrics do not explode). A metric is anomalous at z >= 3.5. Asset anomaly score = 1 - exp(-(zmax - 3.5) / 4), floored at 0, plus 0.1 per extra consecutive anomalous day (cap 1.0). Reasons list metric, observed, baseline median, z. Only samples up to `as_of` are used (time-travel safe).
**City activity index** = criticality-weighted mean asset anomaly x 100, banded calm < 10, elevated < 25, active.
**Urgency** (needs a simulation run): `risk_score x (1 + 0.5 x anomaly)`, documented and separate from the index; assets with no risk score get `null`.
**API.** `GET /api/v1/activity?as_of=` returns series (city index per day), per-asset latest status and reasons, events (ground truth is NOT returned to the UI as "detections"). `GET /api/v1/activity/assets/{id}` returns metric series with baseline bands.
**Tests.** Deterministic output; no use of samples after `as_of`; every malicious event detected within 2 days; clean assets stay under a bounded false-alarm rate; the benign window is reported as an anomaly (a documented false positive, not hidden); constant series with zero MAD do not divide by zero.

### F2. Supply-chain concentration and vendor compromise (`app/engine/resilience.py`)

**Concentration.** Per vendor: asset count, sectors, essential assets, services touched. Per service: vendor share and a Herfindahl-Hirschman index. Real context: count of the vendor's CISA KEV entries (all time and last 24 months), joined by normalised vendor name; vendors without a KEV match show 0 matched entries and the match rule.
**Vendor compromise scenario.** Assume the vendor's update or management channel is compromised: every asset of that vendor suffers the assumed default effect for its type at once (existing `DEFAULT_EFFECT`), analysed jointly by `ConditionalImpactEngine.analyze`. Output per vendor: assets hit, services disrupted (fraction each), worst fraction, assumptions. Ranked by worst fraction then assets hit. This is an explicit what-if, not a probability.
**API.** `GET /api/v1/resilience/vendors`. No simulation run needed.
**Tests.** Counts equal the product map; joint analysis equals the engine called directly; unknown vendors are rejected; deterministic ordering.

### F3. Chokepoints / single points of failure (`app/engine/resilience.py`)

For each asset and each of `unavailability`, `loss_of_control`: run the conditional impact engine once; record assets lost, services disrupted and worst fraction. A **chokepoint** is an asset whose single loss fully disrupts at least one service. Output also lists direct dependents, whether a backup edge exists, and why it ranks where it does. **API** `GET /api/v1/resilience/chokepoints`. **Tests.** An asset with no dependents never ranks; a redundant-group member does not become a chokepoint while enough peers remain; results agree with `/impact` semantics.

### F4. Posture trend

**Risk trend.** A build script (`python -m app.services.trend_build`) replays the existing time-travel simulation over the last 18 monthly EPSS snapshots and writes `data/derived/posture-trend.json` (city index, band counts, top assets, model and scoring versions, held-out flag, generated time). The endpoint serves the file; absent file means `status: unavailable`. Label: the trend reflects the changing public CVE/KEV/EPSS landscape against the assumed products, not changes to assets. **Activity trend:** the daily activity index from F1. **API** `GET /api/v1/simulation/trend`. **Tests.** Schema validity of the artifact; monotonic dates; no future-dated source data.

### F5. Exportable risk brief (`app/services/brief.py`)

Markdown and HTML from the latest simulation: header and versions, city index and bands, top 10 assets with factors and drivers, services at risk, activity summary, top vendors, top chokepoints, the optimizer's recommended actions (projected, not verified), assumptions and limitations. `GET /api/v1/reports/brief?format=md|html`, 409 without a run. **Tests.** Contains versions and assumptions; contains no values that are absent from the run; unavailable sections say so.

### F6. In-app coverage matrix

A "Coverage" page: each PS03 objective and Challenge clause mapped to modules and a status (working, partial, not implemented), plus the CERT-In smart-city areas named in the statement (IoT security, continuous monitoring, vulnerability management, supply-chain security, incident response). Statuses are static, reviewed text, and link to the page that demonstrates each claim.

## 4. Contracts and files

New: `app/schemas/insights.py`, `app/engine/telemetry.py`, `app/engine/resilience.py`, `app/services/insights.py`, `app/services/brief.py`, `app/services/trend_build.py`, `app/api/insights.py`, `data/scenarios/aurora-telemetry-events.json`, tests `test_telemetry.py`, `test_resilience.py`, `test_insights_api.py`, `test_brief.py`; frontend `features/posture`, `features/resilience`, `features/coverage`.
Changed (coordinator): `app/main.py` (router), `docs/openapi.json`, `frontend/src/api/schema.d.ts`, `api/client.ts`, `hooks/queries.ts`, `app/App.tsx` navigation, `docs/*` handoff documents.
Order: schemas, engines + tests, services/routes + tests, OpenAPI + TypeScript regeneration, frontend, browser verification, documents, deploy.

## 5. Acceptance

All backend tests and Ruff pass; `npm run typecheck`, `build`, `test` pass; each new page loaded in the browser against the real API with no console errors other than expected 409s; every number on a new page traces to an endpoint; every simulated element is labelled; coverage page statuses match VERIFICATION.md.

## 6. Risks

Time-travel trend needs the reference cache (build-time script, artifact committed); chokepoint and vendor analysis cost scales with assets x effects (30 x 2 and 14 vendors, well under a second per run); the Vercel proxy timeout makes long calls risky, so heavy work is precomputed or cached; the simulated telemetry could be mistaken for real data, hence labels in API, UI, brief and docs.

## 7. Status

- [x] F1 telemetry and detector (`engine/telemetry.py`, 7 tests; 0 false alarms on 800 clean asset-days, every authored event flagged, the benign window flagged as a documented false positive)
- [x] F2 vendor concentration and compromise (`engine/resilience.py`)
- [x] F3 chokepoints (11 of 30 assets fully disrupt a service alone)
- [x] F4 posture trend (`data/derived/posture-trend.json`, 18 monthly points built with `python -m app.services.trend_build`)
- [x] F5 risk brief (`/api/v1/reports/brief`, md and html)
- [x] F6 coverage matrix (`/coverage`)
- [x] Contracts regenerated, frontend pages, browser verification
- [ ] Deployed to Azure and Vercel (see HANDOFF.md)
