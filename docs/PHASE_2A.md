# Phase 2A — Real vulnerability assessment

This branch implements official PS03 objective 2 within explicit reference/software coverage limits. No ML, asset risk scoring, impact engine, What-If calculation or optimizer is implemented here.

## Ownership and integration

`backend/app/schemas/models.py`, `backend/app/engine/`, `backend/ml/`, base scenario records and both graph fixtures are unchanged. Feature-only response types live in `schemas/vulnerability.py` and reuse the existing Context, Provenance, AssetVulnerability, VulnerabilityReference and SecurityObservation. No shared risk/impact contract has been redefined. Claude's impact files have not been edited.

Future merge touchpoints are the small bootstrap/router registrations in main.py, compatible evidence projection in api/routes.py, generated OpenAPI/TypeScript and the central client/AssetDrawer. Coordinate those integration points when merging the impact branch; do not replace either module wholesale. The AssetDetail response shape is preserved and populated from the same persisted report. Risk remains null/unavailable; future intelligence routes still return 501.

## Source evidence and limits

The committed `data/reference/vulnerability-v1/` bundle contains original NVD 2.0 responses for CVE-2021-41773 and CVE-2021-42013, dated FIRST EPSS responses and the complete CISA KEV catalog. The source manifest records original HTTPS URLs, actual UTC retrieval times, source versions and SHA-256 checksums. Raw responses retain publication, modification and catalog-release timestamps.

Primary sources: [NVD API](https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2021-41773), [FIRST EPSS API](https://api.first.org/data/v1/epss?cve=CVE-2021-41773,CVE-2021-42013), [official CISA KEV mirror](https://github.com/cisagov/kev-data), [Apache vendor advisory](https://httpd.apache.org/security/vulnerabilities_24.html). Bundled EPSS signals are dated 2026-10-30; KEV catalog version is 2026.10.30 with 1,766 records. Checksums detect corruption, not malicious replacement of both files and manifest; only reviewed source bundles should be imported.

Normalization preserves CVE descriptions, publication/modification times, primary CVSS score/vector/version/source, nullable EPSS/percentile/date, KEV membership/addition date/required action, source IDs and applicability criteria. CVSS metric preference is 4.0, 3.1, 3.0, then 2.0, preferring Primary within a version. Missing metrics remain null. KEV false means absent from a validated complete catalog, not proof of non-exploitation. Reference metrics are not asset risk or incident probabilities.

This is a curated two-CVE bundle, not a full vulnerability scan. The optional downloader supports 1–30 explicit CVE IDs. Larger reference coverage does not supply an installed-software inventory automatically. No network is needed during startup, reads or assessment; online refresh is explicit and cache-only/offline import is the default.

## Explicit software assumptions

The baseline's fictional vendor/product/version records cannot establish real CVE applicability. A supplementary `data/scenarios/aurora-software-evidence.json` declares snapshot-scoped simulated components without rewriting baseline assets:

- PWR-001: Apache HTTP Server 2.4.49 — both curated CVEs match supported version rules.
- WTR-001: Apache HTTP Server 2.4.50 — CVE-2021-42013 matches; CVE-2021-41773 is outside its affected version.
- HLT-001: Apache HTTP Server 2.4.51 — outside both curated affected-version rules.
- PWR-008: Apache HTTP Server with unknown version — two candidates needing review.
- Other 26 assets: no supported software identity; CVE applicability is **unassessed**, not vulnerability-free.

These are authored simulated installations, not scan discoveries. They were declared on 31 October and are labelled as supplementary evidence. Current reference data is applied retrospectively to the 1 October baseline; it does not reconstruct historical knowledge and must not be treated as leakage-free historical training data.

## Matching and configuration rules

Matching requires an explicit CPE part/vendor/product identity. No fuzzy name matching or mapping of fictional product names is used. Supported applicability is limited to unqualified CPE 2.3 OR branches and numeric dotted exact versions or inclusive/exclusive ranges. Numeric tuples prevent lexical version errors. Unknown/custom versions, AND/negated/ambiguous compound rules and platform-qualified rules become review candidates rather than silent confirmations. Escaped/wildcard product identities and general environment reasoning are outside this subset.

`confirmed` is displayed as **Version match (scenario)**: product/version applicability to a declared component, not verified exploitability or compromise. `candidate` requires review; `rejected` is retained as negative version evidence. Reference IDs, component IDs, criteria, rationale and provenance remain inspectable. Existing VulnerabilityFinding is reserved for later model prioritization and is not populated with fake priorities.

Configuration findings are independent of CVEs: remote access without MFA (weakness), declared internet exposure (exposure), patch-review status (review), absent backup (weakness). Unknown controls are listed as unknown. Exposure is not itself a CVE; patch status cannot manufacture one. No arbitrary severity/risk weight is assigned. SecurityObservation.observed_at retains the underlying scenario configuration timestamp; assessed_at records actual rule execution time.

## Persistence and availability

The additive migration creates `v2a_datasets`, `v2a_state` and `v2a_assessments` without altering base schema-version ownership. Assessment references cascade only when their base scenario/snapshot is explicitly reset, so the Phase 1 reset command continues to work. Imported reference datasets remain available.

Dataset identity includes checksummed source metadata and the normalizer version. Report identity includes scenario, snapshot, dataset, inventory, software declarations and rule version. Identical inputs reuse the stored result/timestamp. Reports detect changed inputs and expose stale=true; per-asset reads reject stale data with 409. GET endpoints do not calculate or write. POST/CLI explicitly assess. Imports validate every source before transactional activation; failed downloads/imports leave the previous active dataset unchanged.

Offline startup imports the bundled dataset only when no active import exists, then assesses current inventory. Operator-imported data is preserved. Invalid/missing reference data degrades the vulnerability feature without replacing inventory or inventing findings.

## API

- `GET /api/v1/vulnerabilities/references`: active ReferenceDataset, normalized references and source metadata.
- `GET /api/v1/vulnerabilities/assessment?scenario_id=aurora-city&snapshot_id=aurora-baseline-v1`: persisted report, component coverage, applicability, configuration findings, unknown fields and staleness.
- `GET /api/v1/vulnerabilities/assets/{asset_id}`: scoped AssetEvidence; unknown context/assets return 404, stale data returns 409.
- `POST /api/v1/vulnerabilities/assess`: existing Context body with scenario_id/snapshot_id; actual deterministic assessment, no client-supplied scores or infrastructure changes.
- Existing `GET /api/v1/assets/{asset_id}`: compatible vulnerability links and observations projected from the same non-stale report. Empty evidence arrays do not establish security; the assessment endpoint carries coverage/availability.

Errors use the existing ErrorEnvelope. Generated OpenAPI and frontend declarations include additive contracts; shared models.py is untouched. The UI uses the central typed client and snapshot-scoped TanStack Query hooks. Counts represent applicability or rule findings, not risk calculations.

## PowerShell commands

From backend/:

```powershell
# Offline import/re-assessment; restores the committed dataset after experiments.
..\.venv\Scripts\python.exe -m app.services.vulnerability_cli

# Optional online refresh into a NEW directory. Never overwrites a reviewed bundle.
..\.venv\Scripts\python.exe -m app.services.vulnerability_cli --refresh --cache ../artifacts/reference-refresh --cve CVE-2021-41773 CVE-2021-42013

# Offline import of a previously downloaded compatible bundle.
..\.venv\Scripts\python.exe -m app.services.vulnerability_cli --cache ../artifacts/reference-refresh
```

The downloader validates 1–30 unique CVE IDs, uses fixed official endpoints, bounds response sizes, retries and paces NVD requests. Complete NVD 2.0 responses must be named nvd-*.json alongside epss.json, complete kev.json and sources.json. Incomplete/paginated responses fail validation. No dependencies, credentials or API keys were added.

Existing setup/start/check commands remain valid. For a separate verification port, run `..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001` from backend/. The compiled SPA uses the same origin. See VERIFICATION.md for executed tests and browser checks.

Remaining limits: curated coverage, conservative CPE subset, numeric versions, authored software assumptions and dated cached intelligence. There is no universal applicability engine, live monitoring or real infrastructure scan.
