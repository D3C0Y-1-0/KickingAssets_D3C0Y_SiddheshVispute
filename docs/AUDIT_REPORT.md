# GridSentinel audit: backend, ML, data flow and PS03 coverage

Date: 31 October 2026. Branch `feature/phase-5-hardening` at a5bac82 (Phase 5A backend plus the merged
Phase 5B frontend). Read-only audit: no code or website file was changed. This file is the only
addition and is not committed.

## 1. Verdict

| Question | Answer |
|---|---|
| Does the backend work? | **Yes.** 180 backend tests pass; all 18 endpoints probed returned 200 on the running server; ruff clean. |
| Is the ML real? | **Yes, and honest.** Real NVD, CISA KEV and EPSS data, time-split evaluation, baselines and bootstrap intervals. **It does not beat the EPSS baseline** and the repo says so. |
| Is the data real? | Vulnerability data is real. The city, its products, versions, security flags, traffic and failure assumptions are simulated or assumed, and labelled as such. |
| Do all sections share one flow? | **Mostly on the backend, not on the frontend.** The risk run, What-If, Fix Plan, Weak Points, Trends and the brief form one connected chain. The Digital Twin diagrams, the curated assessment and the attack-path engine are partly or fully outside that chain. Your impression is correct. |
| Does the solution cover the PS03 objectives? | **Objectives 1 to 7 are all implemented in some form.** Gaps are in presentation and linkage, not missing engines. Details in section 6. |
| Is it judge-ready? | Backend yes. The demo story has four visible weaknesses (section 5) that a judge can find in minutes. |

What I verified directly: running tests, calling the live API, reading the code, model card and
manifest. What I did not verify: how pages render in a browser, the hosted Azure/Vercel site, the
Postgres path, behaviour with several simultaneous users.

## 2. Where the data comes from and who fetches it

```
 Internet (only when a human runs a command)          Repository / local disk                    Running app (offline)
 ───────────────────────────────────────────          ───────────────────────                    ─────────────────────
 CISA KEV json ──┐                                    data/reference/cache  (231 MB, ignored)
 NVD per-year    ├─ python -m ml.fetch_reference ───► + manifest.json (95 files, SHA-256, URLs)
   (fkie-cad)    │                                    ml/artifacts: 3 XGBoost models + model card
 EPSS monthly  ──┘                                    data/reference/vulnerability-v1, risk-v1
                                                      (3-5 CVE hand-curated caches, committed)
 (optional) vulnerability_cli refresh ─────────────►  data/scenarios/*.json  (the fictional city)
                                                                  │
                                                                  ▼
                                      SQLite (data/gridsentinel.sqlite3) or Postgres/Neon via env var
                                                                  │
                                                                  ▼
                              FastAPI: inventory ─► simulation run (held in process memory) ─► every analysis endpoint
```

- **Fetchers:** only `backend/ml/fetch_reference.py` (KEV, NVD, EPSS), `services/vulnerability_cli.py`
  (curated refresh) and two scripts under `scripts/`. All are manual commands. **The running server
  makes no outbound network calls.** There is no live feed and no scheduler. This is consistent with
  "offline demo", but means "changing threat levels" is replayed history, not live.
- **Provenance:** `data/reference/manifest.json` records URL, size and SHA-256 for all 95 files,
  retrieved 2026-10-31, NVD release `v2026.10.31-010015`. Good lineage.
- **The city is fictional.** 30 assets, 3 sectors, 3 services, 27 cyber edges, 23 operational edges.
  Each fictional asset is *assumed* to run a specific real product and version
  (`aurora-product-map.json`). That assumption is what links the city to real CVEs. It is disclosed in
  the API and UI.
- **Telemetry is simulated.** A seeded generator plus authored events (`aurora-telemetry-events.json`)
  feed a z-score detector. Labelled as simulated everywhere I looked. It does not feed the risk index.
- **Persistence:** scenario and curated reports are persisted; **the simulation run lives only in
  process memory.** Restarting the server loses it, and every page that needs a run is empty until
  someone runs it again. Single worker only (also stated in `render.yaml`).
- **Security posture (prototype level):** no authentication and no CORS configuration (served same-origin);
  SQL uses bound parameters, with two f-string table names that come from code constants, not input;
  no secrets in the repository (`GRIDSENTINEL_DATABASE_URL` is read from the environment);
  security headers are set. Acceptable for a loopback demo, not for a networked deployment, which the
  spec already says.
- **Housekeeping:** `server.log` and `server.err.log` are untracked files in the repo root.
  `render.yaml` still deploys branch `codex/innovations`, and `vercel.json` proxies to an Azure host,
  so two deployment targets exist and neither points at the current branch.

## 3. The core chain (what works end to end)

1. `POST /simulation/run` takes the city, matches each asset's assumed product and version to NVD
   affected ranges, scores the matched CVEs with the XGBoost model, then computes
   `risk = 100 × S × E × I'` per asset and a criticality-weighted city index (35.62 on 2026-10-01).
2. The same run feeds Assets & Risk, Risk Ranking, AI Model evidence, the Infrastructure Map colours,
   the Digital Twin radar, What-If, Fix Plan, Weak Points (chokepoints and suppliers), Trends & Activity
   and the downloadable risk brief. I confirmed these endpoints return consistent data (30 assets,
   3 services, city 35.62, 9 critical / 5 high / 2 medium / 14 low).
3. Phase 5A makes What-If and the optimizer bind to that exact run, so a plan can no longer be
   computed against a different baseline than the one shown. The plan hands off to What-If and
   reproduces its projection.
4. Impact is conditional: reachability on the cyber graph decides where an attacker could pivot,
   the operational graph decides which services stop. The two graphs are never merged, and tests
   protect that.

This chain is sound and is the project's strongest asset.

## 4. ML audit

- **Task:** rank CVEs by resemblance to those CISA later adds to KEV within 180 days. It is a
  "KEV-prioritisation signal", not an attack probability, and the model card says so
  (`not_claimed` list).
- **Data and splits:** 375,027 CVE-month rows (3,790 positives, 842 distinct CVEs), monthly snapshots
  from 2021-12. Time-split with purging: train to 2024-01, validation to 2025-01, test 2025 onward
  (147,305 rows). Negatives subsampled 3% and re-weighted.
- **Leakage controls present:** NVD reference links, `cisaExploit*`, SSVC and tags never read;
  KEV-history features only up to the snapshot; EPSS as a within-snapshot rank; eras-specific CVSS
  fields dropped. Point-in-time rules have tests.

Held-out test results (population-weighted):

| Model | Avg precision | ROC-AUC | Precision@50/mo | Recall@200/mo |
|---|---|---|---|---|
| XGBoost with EPSS (production) | 0.0037 | 0.879 | 0.018 | 0.053 |
| XGBoost without KEV history | 0.0061 | 0.886 | 0.015 | 0.035 |
| **EPSS percentile baseline** | **0.0044** | 0.729 | 0.027 | 0.060 |
| CVSS only | 0.0004 | 0.752 | 0.017 | 0.025 |
| Prevalence | 0.00016 | | | |

What this means, plainly:
- The model separates KEV-bound CVEs from the rest far better than chance (ROC-AUC 0.88 vs 0.73 for
  EPSS), and far better than CVSS. That is a legitimate result.
- **At the top of the list, where an operator actually works, it does not beat plain EPSS** (average
  precision and precision@K are lower; the difference interval against EPSS spans zero). The honest
  claim is "comparable to EPSS, better overall ranking, not proven better". The repo already says
  "do not claim superiority over EPSS". Judges will respect that, but do not let the presentation
  say otherwise.
- The shuffled-label audit is 0.0006 against prevalence 0.00016, so it does **not** prove the absence
  of leakage. NVD files are current records, not point-in-time archives, so fields edited after a
  snapshot can leak information. Both are documented limits.
- Absolute precision is tiny (positives are about 0.016% of rows). That is normal for this task but
  will look alarming if shown without context.
- For the demo date (2026-10-01) the outcome window has not closed, so the in-run backtest shows
  0 CVEs evaluated. The pooled backtest endpoint (about 10 s) does give historical hit rates. A judge
  who clicks "backtest" on the default run sees an empty result.
- Reproducibility is good: pinned manifest hashes, saved models, and a reevaluation file matching the
  model card to four decimals.

## 5. Why the demo looks "unpolished": findings that matter

**F1. The Digital Twin lives in a different asset universe from the rest of the app (high).**
The twin's side panel and part statuses come from `frontend/src/data/demoAssets.ts`: 43 hand-written
assets with ids like `SUB-TR-01`, `WTR-PLT-01`, `HLT-HOS-01`, hard-coded criticality scores,
IP addresses, dependency lists, "why important" text and an `operational/degraded/offline` status.
The scenario has 30 assets with ids `PWR-001` to `HLT-010`. **The two sets share zero ids.** The only
bridge is `data/twinLinks.ts`, a hand-written mapping used to draw the red radar from the real run.
So on the same page you can see a part with a real computed risk (radar) next to a side panel
describing a different, invented asset. The Water and Hospital twins use only the radar; the Substation
and Smart City twins also colour parts by the hand-written status. The Transit twin is explicitly not
in the scored scenario. This is the main reason the SVG section feels disconnected.

**F2. Two assessment systems that give different answers (high).**
"Workflow" (all 30 assets, full NVD, ML model) and "Curated CVE Assessment" (3 assets scored, 27
unavailable, hand-curated 3 CVE cache, different formula `asset-priority-v1.1`) coexist. Overview shows
a city index (35.62) and a separate "covered-asset mean" (63.07). The docs explain this, but a judge
sees two scores for the same asset and two risk pages. It reads as duplicated work.

**F3. The score saturates and ties (medium-high).**
Signal S is the maximum percentile over all matched CVEs. Windows machines match 1,600 to 3,300
CVEs and 39 to 87 KEV entries, so S = 1.00. Result: HLT-004, PWR-004, WTR-004 all score exactly 79.9;
three Server 2019 assets all score exactly 60.0; three more exactly 10.0. Impact is almost binary
(0.2 or 1.0). Nine of 30 assets are "critical". The ranking is therefore driven by product identity and
configuration flags, not by anything specific to each sector. It is defensible, but it makes
"explain why this asset is high risk" shallow for the Windows hosts, and a judge will notice identical
scores.

**F4. Some modules have no screen or no link (medium).**
The attack-path engine (`/simulation/attack-paths`, 15 paths, 6 chokepoints) has no frontend page, and
does not feed the risk index. Simulated activity is shown but does not change any score. Selecting an
asset in the map, the register, a twin and a chart do not share one selection; pages pass context only
through links and a few query strings (`/assets?q=`, `/infrastructure?sector=`).

**F5. Fresh-start experience (medium).** With no run in memory, most pages show empty or "run the
simulation" states. A judge who opens a page directly sees nothing. The run is not persisted and the
default hosted setup needs about 1 GB of RAM.

**F6. Numbers are in flux (low but visible).** The 60 h plan used to project 25.90 (Phase 5 backend),
the Phase 5B notes quote 26.30, the Phase 5A hardening gives 27.72 (fewer CVEs treated as fixed
because NVD names no fixed version). Any figure quoted in slides must come from the final branch.

**F7. Frontend/backend contract break (known).** `run_id` is now required. The merged frontend still
sends What-If and optimize requests without it (3 call sites), so those pages fail until fixed.
Also, 5 type errors in the Phase 5B test fixtures.

**F8. Smaller scope than the original plan.** 3 services (the plan said about 6), no cross-sector cyber
links in the scenario (so cross-sector pivoting is only exercised by synthetic tests), 3 sectors.

## 6. PS03 coverage

The seven official objectives are in `docs/PROJECT_SPEC.md` (supplied by the project owner).

| # | Objective | Engine / data | Screen | Status | Gap |
|---|---|---|---|---|---|
| 1 | Asset profiling | 30 assets, criticality, exposure, products, two graphs, services | Assets, Infrastructure Map | **Covered** | Twin side panel uses a different invented inventory (F1) |
| 2 | Vulnerability assessment | Real NVD range matching by version, KEV, EPSS; configuration flags | Assets (evidence), Curated CVE | **Covered** | Product versions are assumed, not scanned; 4,421 "version unknown" matches are lower confidence; curated path covers only 3 assets |
| 3 | AI risk prediction | XGBoost KEV signal + risk formula + conditional impact | AI Model, Risk Ranking | **Covered, with honest limits** | Not better than EPSS at top-K; no calibrated probability; backtest empty for the demo date |
| 4 | Risk prioritisation | Ranked register with severity, exposure, criticality, impact | Overview, Assets, Risk Ranking | **Covered** | Ties and saturation (F3) |
| 5 | Dependency / impact analysis | Cyber reachability + operational dependency, k-of-n, backups, attack paths, chokepoints, suppliers | Map, Weak Points | **Covered** | Attack paths have no screen; 3 services only |
| 6 | Predictive dashboard | Scores, vulnerable assets, trend, activity, priority list | Overview, Posture, Live | **Mostly covered** | "Changing threat levels" is replayed history and simulated traffic, not a live feed (stated) |
| 7 | Preventive recommendations | Patch (CVE-specific), segmentation, access control modelled; monitoring and IR as recommendations; optimizer; What-If | Fix Plan, What-If | **Covered** | Frontend needs the `run_id` update (F7) |

Expected solution (three statements in the spec):

| Statement | Our solution |
|---|---|
| Move operators from reactive to proactive assessment | Yes: scores before any incident, with projected reductions |
| Prototype with simulated map, inventory, vulnerability information, AI-generated risk scores, recommendations | **All five present.** Map and inventory: yes. Vulnerability information: real. AI scores: yes. Recommendations: yes |
| Explain *why* an asset is high risk and *how fixing a vulnerability reduces overall risk* | **Why:** yes, per-CVE ML drivers, exposure parts, impact scenario. **How fixing reduces risk:** yes, What-If and Fix Plan recompute the whole index; since Phase 5A a patch counts only where NVD supports it. Weak for ties (F3) |

Honesty rules the project set for itself (no fake scores, no invented exploitability, projected
not verified, unavailable is not zero) are implemented and tested. This is a differentiator.

## 7. What would make it judge-ready (recommendations only; none applied)

Ordered by value for the least risk:

1. **Unify the Digital Twin with the scenario (F1).** Drive the side panel, part status and
   dependencies from the backend asset a part maps to, drop `demoAssets.ts` from the selection
   path, and show the mapped asset id. Biggest single improvement to the "everything coordinates"
   impression.
2. **Update the three frontend callers to send `run_id`, then re-run frontend tests (F7).**
   Required before any demo of What-If or Fix Plan.
3. **Pick one headline score (F2).** Present the workflow index as primary and label the curated
   assessment as "evidence cross-check on 3 assets", or fold it into the asset drawer.
4. **Break the ties (F3).** For example show the number of KEV-listed CVEs and the per-asset
   top-CVE in the ranking so identical scores have visible reasons; consider a signal that
   considers more than the maximum. This is a modelling change and should be explained, not hidden.
5. **Give attack paths a screen, or drop the claim (F4).** The engine is solid and tested.
6. **Persist the latest run (F5)** or auto-run once at start-up so no page opens empty.
7. **Settle the numbers (F6)** and quote only figures reproduced on the final branch.
8. **Point deployment at one branch (section 2)** and remove the log files from the repository root.
9. **Prepare the one-sentence answers to the likely judge questions:** "Is the model better than
   EPSS?" (comparable; better overall ranking; not proven better at the top), "Are these real
   systems?" (no, fictional assets assumed to run real products), "Is it live?" (no, replayed and
   simulated, by design).

## 8. Evidence

- `pytest backend/tests`: 180 passed (run on this branch before the frontend merge, which did not
  touch backend files). `ruff check` and `ruff format --check` clean.
- Live API (server on port 8000): `/health`, `/scenarios`, `/graph` (30 nodes, 27 cyber and 23
  operational edges), `/assets`, `/services` (3), `/activity`, `/resilience/*`, `/simulation/trend`,
  `/simulation/backtest` (9.9 s), `/simulation/attack-paths`, `/ml/overview`, `/intelligence`
  (3 assessed, 27 unavailable), `/vulnerabilities/references`, `/actions/catalog`, `/reports/brief`:
  all 200.
- Model figures: `backend/ml/artifacts/kev-signal-v1_model_card.json` and
  `data/reference/ml-reevaluation.json`.
- Frontend: `npm run typecheck` fails with 9 errors (3 missing `run_id`, 6 in the new test file);
  `tests/workflow.test.tsx` needs `jsdom` and Testing Library installed (`npm install`).
