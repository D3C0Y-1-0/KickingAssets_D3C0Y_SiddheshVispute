# Phase 6 module audit — 1 November 2026

Scope: verified Phase 5 baseline `62dece9793b3b0a901091bbd80bd6860a6ef69b8`,
branch `feature/phase-6-finalization`. No model retraining, changed source fixtures,
new scoring/path/impact algorithm or infrastructure execution was introduced.

## Verification method

All 14 assigned modules plus the additive Attack Paths interface were opened in a real
browser against the local FastAPI server. Desktop document width was 1265px; mobile viewport
was 390×844, with 375px document width after the scrollbar. Each audited mobile page had equal
document client/scroll widths; wide data tables scroll within their containers. Menus, native
selectors, calculated results, links and diagram controls were exercised, not inferred from a
build. A viewport emulation is not a physical-phone or touch-gesture test.

Data-backed module loading/failure boundaries are also covered in `frontend/tests/phase6.test.tsx`
(11 modules), alongside separate new attack-path loading/error/retry/no-run/empty/mismatched
context cases. Existing workflow tests cover no-plan, stale inputs, empty actions, patch errors,
constraints and handoff. Missing-reference handling is checked in an isolated backend app,
not by damaging the active reference cache. Static methodology/coverage pages have no API
loading state; authored diagrams are explicitly distinguished from their live calculated badges.
Not every error case was forced through every browser viewport; automated and observed checks
are distinguished below. Full local browser traces/screenshots are ignored under `artifacts/`.

## Modules and observed actions

- **Overview (`/`)**: inventory/services come from scenario APIs; latest matching simulation
  supplies index 35.62, nine critical assets and categories. Sector figure buttons change
  authored illustration focus; Water was selected at desktop and mobile widths. Curated
  evidence has its own stated scope. Failed/missing latest simulation cannot become zero risk.
- **Live Simulation (`/live`)**: all seven actual server stages completed in desktop browser;
  mobile controls rendered. A warm simulation took 11.3s; later stages fetched options, activity,
  weak points, vendor scenarios, a 40h plan and the risk brief. The former unconditional
  “report ready” step was fixed to fetch/check the real JSON brief. Hook tests cover failure
  and a wrong report run ID. A full pipeline is not rerun for every mobile screenshot.
- **Infrastructure Map (`/infrastructure`)**: separate cyber/operational graph APIs, scenario
  inventory and calculated risk overlay. Both modes and selected PWR-008 inspector were exercised.
  Mobile power filter produced ten cyber nodes; fit/zoom and native asset selection worked.
  Attack Paths handoff preserves operational mode/focus. No graph mode invents network access
  from provider/dependency edges. Pointer drag and touchscreen gestures were not audited anew.
- **Digital Twins (`/digital-twins`)**: all five diagrams inspected in both widths; selection,
  layer toggle, zoom/reset and desktop expand/exit exercised. Static readings/criticality are
  disclosed; only workflow risk badges are calculated, and transit is explicitly unscored.
  A confirmed fixed-canvas clipping defect was repaired using a shared measured viewport fit,
  without changing artwork or model values. All five fitted mobile SVG bounds were checked.
  Native part selectors remain usable at small sizes; diagram text can be enlarged with zoom.
- **Assets & Risk (`/assets`)**: real inventory/detail, curated vulnerability assessment and
  latest workflow results. PWR-001 opened from Live, and North Grid Gateway's drawer displayed
  FortiOS applicability, configuration/exposure and separate Apache curated references, sources,
  dates, CVSS/EPSS/KEV and formula details. Desktop/mobile drawer and mobile menu navigation worked;
  menu closed after navigation. No earlier “API route not found” appeared. Search/no-match behavior
  is preserved; no scan or installed-product verification is asserted.
- **Risk Ranking (`/intelligence`)**: actual run ranking with CVE signal, exposure, consequence
  reasoning and product assumptions. Evidence→ranking now retains PWR-001 via URL, then links
  to attack inspection. Missing analysis is unavailable. Empty run assets no longer cause an
  unchecked array access. Latest-run reads are scenario/snapshot scoped and error-safe.
- **Curated CVE Assessment (`/curated-intelligence`)**: separate curated API/formula, three
  assessed assets and 27 unavailable. Actual POST assessment, no-match search, PWR-001 restore
  and evidence display worked. Heading now names this limited scope rather than duplicating the
  workflow ranking title. Its 69.27 PWR-001 result is never substituted for 97.29 workflow risk.
- **AI Model (`/ml`)**: model overview/card, local CVE scoring and pooled anecdotal backtest.
  Invalid CVE-2099-999999 returned visible 404; CVE-2023-46717 returned real signal 0.0899,
  top 2.71%, and SHAP contributions. Four-CVE pooled examples retain their limitation. Corrected
  interval interpretation cannot announce superiority when paired AP interval contains zero.
  Missing-model guidance restores saved artifacts/cache rather than recommending training.
- **What-If (`/what-if`)**: exact authoritative plan transfer retained three CVE-specific actions,
  run/fingerprint and constraints. Explicit calculation reproduced 35.62→27.72, seven affected
  asset indices, 56h effort/14h downtime. Desktop result and mobile layout were observed.
  No-run state was observed before initial simulation. Patch/incompatibility/stale errors and
  baseline immutability are covered by automated and real HTTP checks.
- **Fix Plan (`/remediation`)**: 60h unexcluded desktop plan generated; full handoff worked.
  Mobile 2h/action, 4h/total with PWR-001 excluded returned 33.88, 32h effort/4h downtime.
  Changing budget marked it OUTDATED, hid old projection and removed transfer controls.
  API tests independently cover budget, exclusions, prerequisite/compatibility validation,
  empty budget-feasible plans, patch evidence and stale baselines.
- **Trends & Activity (`/posture`)**: 18 monthly replay points 33.62→35.62 from reference history;
  separate authored simulated telemetry/activity API. PWR-002 activity detail was opened with
  Enter on mobile; an accessible button fixes the previous pointer-only row. Empty trend points
  now produce “Trend not built” rather than indexing a missing first point. Urgency is explicitly
  a separate rule, not a new risk probability.
- **Weak Points (`/resilience`)**: operational chokepoints and vendor scenarios from backend,
  eleven chokepoints. Both Single points and Suppliers views exercised at desktop; mobile
  table rendered. Conditional vendor compromise and simulated assumptions remain stated.
- **Challenge Coverage (`/coverage`)**: authored original-objective/challenge/CERT-In mappings,
  working/partial/absent labels and links. Desktop/mobile inspected. “Fully working” was replaced
  by “within prototype scope”; authored statuses are not compliance or full objective proof.
- **Methodology & Evidence (`/methodology`)**: inspected both widths. Real references, fictional
  assets, current/projected/verified distinction and separate graphs preserved. Corrected the
  outdated claim that version-aware matching is absent; actual installation/exploitation is
  unverified. Distinguishes workflow simulation scoring from independent curated assessment.
- **Attack Paths (`/attack-paths`, new)**: minimal inspector for the existing engine. Native
  target/focus/limit selectors, candidate list, hop evidence, weakest step, uncertainty,
  hypothetical isolation, separate service consequence and links to ranking/graph/Fix Plan.
  PWR-001→PWR-004→PWR-008 inspected in desktop/mobile, PWR-004 isolation produced honest empty
  filtered results and removal restored them. No paths/ordinal scores are supplied by the client.
  API wrapper binds scenario/snapshot/run/fingerprint and rejects unknown isolation. Tests prove
  cyber-only edges and stale/mismatched contexts. Candidate enumeration is not exploit execution;
  coarse KEV/protocol/control evidence does not establish CVE attack-vector applicability.

## Context and analytical integrity fixes

Latest-run reads now poll/check on focus and reject scenario/snapshot mismatches; cached results
are hidden on errors. Other action-screen freshness guards and exact backend binding remain.
The attack-path response adds context around the unchanged engine result. Live replacement
requests proved old path/plan IDs return 409 even with equal calculated fingerprints. Fingerprint
mismatch returns 409, unknown isolation/invalid input returns 422, missing reference data returns
503 with no invented calculated fields. Real API projections left the baseline payload identical.

No controls imply real remediation, no frontend computes risk, and no model artifact was changed.
All seven authoritative PS03 objectives and expected solution remain preserved in PROJECT_SPEC.md.
See FINAL_DEMO_RUNBOOK.md for exact measured examples and limitations, including coarse controls,
vendor version semantics, single-process memory, sparse-positive ML evaluation and no compliance claim.
