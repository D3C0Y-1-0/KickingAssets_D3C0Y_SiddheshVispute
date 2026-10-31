# Phase 3A and latest-repository integration

## Final synchronized snapshot

The final fetched snapshot also includes readable Live UI `7f09433`, attack-path API/engine `ce13015`, and combined integration/updated force graph `3983920`. All **12 remote branch heads** from that fetch are ancestors of the local branch. Exact full SHAs and the fetch time are in [REMOTE_BRANCH_SNAPSHOT.json](REMOTE_BRANCH_SNAPSHOT.json). Subsequent teammate pushes are outside this recorded snapshot; this task is not a continuous merge watcher.

The latest UI uses these names: **Overview**, **Live Simulation**, **Assets & Risk**, **Risk Ranking**, **AI Model**, **What-If**, **Fix Plan**, **Trends & Activity**, **Weak Points**, **Challenge Coverage**, plus the graph, twins, methodology and preserved **Curated CVE Assessment**. The route URLs remain stable. Live Simulation is an on-demand local simulation, not real infrastructure monitoring. It completed all seven API-backed steps in browser verification. The latest cached date **2026-10-01** produced index **35.62**, nine critical assets, one simulated activity anomaly, eleven single-failure chokepoints and fourteen supplier scenarios. Its three-action estimate reduced the index to approximately **27.5**; this is projected, never verified. Select **2025-01-01** on Overview to reproduce the **35.14** held-out-date example below.

Existing imported modules additionally cover simulated activity, fixed-estate monthly replay, supplier concentration/failure scenarios, risk briefs and requirement coverage. The attack-path engine is exposed at `GET /api/v1/simulation/attack-paths` after a simulation. Its ordinal path-ranking weights are not probabilities, and operational dependencies are only used to report consequences, never as cyber traversal edges. No attack-path frontend was invented. The activity, supplier, chokepoint, trend, brief and attack-path endpoints all returned HTTP 200 in the local verification. New module behavior is covered by the expanded **141 passing backend tests**; frontend API tests remain **10 passing**. ML code, model artifacts and numerical dependency versions did not change in this final synchronization, so the source-verified model reevaluation below remains applicable.

Local branch: `integration/phase-3`. No remote branch was pushed or rewritten; remote main remains Phase 1. User approved integrating all subsequently discovered branches and keeping launch on local SQLite.

## Preserved histories

- Phase 1 baseline: `4acfd7ebfb708cb9442e9a879e28e238c448d666`.
- Phase 2A: `5b4d82fdf0c3bee732e58a81feb409eecbb2352b`.
- Phase 2B: `95160bc492f24c63ad74df96e8ab54eb0a1b742b`.
- Original evaluated ML artifacts: `37c97ad933f6d2730a17d42fe319874a7a533e0e`.
- Integrated workflow: `d87c46344a22905bd449d7d23fa9a21ebc049a68`.
- Digital twins: `33c963c3b1c9f34bfa51568d5dc4cd8aaea56bf8`.
- Force graph: `5ad34307b8bba83908fbfa8c205cc12c3d9d8c88`.
- Latest real-data workflow/readability/progress/radar: `024ab9849114cea16b5a0b8d1fcd57ef766fb09f`.
- Optional PostgreSQL and deployment integration: `3485c03a79932c6fb34369faf6917e94322b9e72`.

All fetched remote branch heads were verified as ancestors of this local integration branch. `42a42d2` preserves the unfinished Phase 3A work before synchronization. Merge commits `13fb9d8` and `b49fb08` preserve the latest remote histories. No force push, main merge or database reset was used.

## Two explicit assessment contexts

The remote workflow and the Phase 2A software overlay make different simulated product assumptions. Their scores must not be blended or compared as one assessment.

**Workflow:** the latest Command Overview, Risk Intelligence, ML Lab, What-If and Remediation screens use the teammate's product/version map (`aurora-product-map.json`), full historical NVD/KEV/EPSS cache, exact native main-model prediction contract and `risk-index-v1` formula. Scores appear only after an explicit simulation. Risk Intelligence includes feature drivers, version applicability, product history, conditional pivot/operational consequences and historical outcomes. Digital twins and their risk radar use the same workflow result. Results are conditional on the simulated configuration and attacker assumptions, not observed compromise.

**Curated CVE Assessment:** `/curated-intelligence` preserves the Phase 2A Apache overlay and adds a reproducible, explainable review-priority pipeline. Four assets have declared Apache identities; three have sufficient confirmed evidence for an index, 27 remain unavailable. PWR-001 and WTR-001 have known KEV matches. HLT-001 exercises actual native inference for the added non-KEV reference CVE-2021-44224. PWR-008's unknown version remains candidate-only and unscored. The original Phase 2 cache is unchanged; `data/reference/risk-v1` is a separately attributed three-CVE cache.

The register has separate **Workflow assessment** and **Curated priority** columns. Asset details retain original vulnerability source evidence and show both contexts. `AssetDetail.risk` belongs to the workflow and stays unavailable before a simulation; curated results are obtained from `/intelligence`. The force graph lets the operator select either calculated risk source; grey highlighted nodes are unavailable, not safe. Overview exposes the curated covered-asset mean separately from the workflow city index.

The curated pipeline intentionally uses the evaluated `xgboost_no_kev_history` ablation so its portable input bundle needs no fabricated vendor/CWE history counts. It reuses Claude's feature helpers and the exact artifact feature order. Full-snapshot EPSS ranks are calculated with the training method (average-tie percentile rank over 398,142 rows), with retrieval time, URL and original-source hash retained in `risk-inference.json`. Already-KEV CVEs are excluded from model inference and use known KEV evidence directly. Rejected applicability is excluded from the asset's signal display.

Curated index (`asset-priority-v1.1`):

`40 × vulnerability + 15 × exposure + 10 × configuration + 15 × criticality + 20 × conditional impact`.

Vulnerability is the maximum confirmed CVE value `0.6 × CVSS/10 + 0.4 × (known KEV=1, otherwise model signal)`. EPSS has no additional score weight because it is already a model feature. Exposure is external=1, internal=0.4, isolated=0.1; unknown is unavailable. Configuration is `min(1, weakness_count/2)`, excluding exposure and patch-review observations. Criticality is essential=1, important=0.65, supporting=0.3. Impact is the maximum service disruption fraction from independent assumed asset unavailability over 1,440 minutes. Bands: critical >=80, high >=60, medium >=35, otherwise low. Contributions reconcile to the returned index; policy weights are explicit engineering assumptions, not learned incident probabilities.

Curated priorities are persisted in additive `v3_reports`, scoped by scenario and snapshot and fingerprinted by inventory, graphs, vulnerability assessment, references, model artifact and scoring versions. GET rejects missing/stale results with 409. POST explicitly assesses and reuses identical results. Base inventory and snapshots are not rewritten. The original impact engine remains unchanged.

## Real evaluation, not invented metrics

All 95 files in Claude's exact training manifest were retrieved/verified against their SHA-256 hashes. The saved three XGBoost models and EPSS/CVSS baselines were reevaluated on **147,305** held-out CVE-month rows with population weights, matching model-card values to four decimals under the synchronized runtime (XGBoost 3.4.1, pandas 3.1.0, NumPy 2.5.4, scikit-learn 1.9.1). The durable record is `data/reference/ml-reevaluation.json`, with runtime versions and model/manifest hashes.

- Main `xgboost_with_epss`: AP **0.0037**, ROC-AUC **0.8789**, precision@200/month **0.0119**, recall@200/month **0.0532**.
- Portable `xgboost_no_kev_history`: AP **0.0061**, ROC-AUC **0.8864**, precision@200/month **0.0079**, recall@200/month **0.0350**.
- EPSS percentile baseline: AP **0.0044**, ROC-AUC **0.7290**, precision@200/month **0.0133**, recall@200/month **0.0597**.
- CVSS-only baseline: AP **0.0004**, ROC-AUC **0.7518**.

The main model underperforms EPSS on average precision and the review-budget metrics. The ablation's AP interval is wide (0.0027–0.0183), and its AP-difference interval against EPSS spans zero (-0.0119–0.0115). Do not claim established superiority over EPSS. Confidence intervals and the shuffled audit are the teammate's recorded training results, not recomputed bootstrap experiments in this integration. The shuffled-label AP is 0.0006 versus weighted prevalence 0.000158, so it does not establish absence of leakage. NVD records are current snapshots rather than historical archives; CVSS/CWE/product edits and text can carry post-snapshot information. Non-KEV CVEs are unlabeled, not confirmed unexploited. No output is calibrated as an infrastructure-compromise probability.

## Windows launch

From the repository root (stop a previous local server before starting another):

```powershell
git switch integration/phase-3
.\scripts\setup.ps1 -SQLite
.\scripts\start.ps1 -SQLite
```

Open `http://127.0.0.1:5173`. `-SQLite` temporarily selects `data/gridsentinel.sqlite3` for this process and restores the caller's database environment afterward. Optional PostgreSQL/Neon code and deployment files are preserved; no cloud database was contacted for this verification. PostgreSQL compatibility was adapted for additive evidence SQL, but no live PostgreSQL test is claimed.

If script execution is blocked: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -SQLite`. For a built single-server demonstration: `.\scripts\start.ps1 -Production -SQLite`, then open `http://127.0.0.1:8000`. Dependencies and reference caches must already be present for offline operation. Ctrl+C stops a script-owned session.

The full historical cache is ignored by Git. On a fresh laptop, restore the exact model sources and verify them once, without retraining or replacing model artifacts:

```powershell
.\.venv\Scripts\python.exe scripts/evaluate_model.py --fetch
```

The current laptop already has all 95 verified sources. Subsequent evaluation can omit `--fetch`. This command needs several minutes and writes its repeatable results under ignored `artifacts/`. It does not claim to retrain the model or reproduce uncommitted logistic coefficients.

## Demonstration

1. On **Command Overview**, select **2025-01-01** and run the simulation. This is a labelled held-out date. The verified run produced workflow city index **35.14**, with 6 critical, 9 high, 1 medium and 14 low priorities across 30 assets. PWR-001 / North Grid Gateway had index **97.62** for its assumed FortiOS 7.0.12 mapping; CVE-2024-26011 had actual ML priority percentile **0.9762** and confirmed version applicability. These are relative rankings, not probabilities.
2. Open **Risk Intelligence** and select a ranked asset to inspect its version-aware evidence, actual model drivers, history and conditional impact. Open **ML Lab** for metrics, data provenance, snapshot labels and individual CVE scoring.
3. Open **Curated CVE Assessment**. Select **Central Hospital Gateway (HLT-001)** for actual Apache-model inference, or **North Grid Gateway (PWR-001)** for known KEV findings. The curated priorities measured were PWR-001 **69.27**, WTR-001 **69.27**, HLT-001 **50.6753**, covered-asset mean **63.0718**. The non-KEV CVE's model signal is shown separately from the final index. Unknown PWR-008 remains unavailable.
4. In **Asset & Risk Register**, search PWR-001 and click **North Grid Gateway**. Expand the original CVE source evidence and the separate curated factors/model drivers. Workflow and curated columns use different assumptions; compare neither directly nor as probabilities.
5. On **Infrastructure Map**, choose cyber or operational view, open the inspector, choose the calculated risk source and enable **Color by computed risk**. The full-screen force graph, fit, shuffle and node inspection remain available. **Digital Twins** retains five interactive views and workflow-linked risk radar.
6. The already-existing **What-If** and **Remediation** features are preserved from the newly authorized remote work. They operate on simulated inputs, not real infrastructure. No new later-phase engine was developed in this integration.

Executable impact-only negative/control demonstration, unchanged:

```powershell
.\.venv\Scripts\python.exe scripts/demo_impact.py
.\.venv\Scripts\python.exe scripts/demo_impact.py --effect loss_of_visibility
```

Default WTR-008 unavailability: water and healthcare disruption fractions 1.0, power 0.0 over 1,440 minutes. Loss of visibility: all zero. Requirement backups do not relieve edge cascades, so the impact is an upper bound with respect to backups; no recovery or actual outage prediction is implied.

New curated API endpoints: `GET /api/v1/intelligence`, `POST /api/v1/intelligence/assess` with `{scenario_id,snapshot_id}`, `GET /api/v1/intelligence/model`. Existing vulnerability endpoints remain intact. Workflow endpoints are documented in WORKFLOW.md and exposed through OpenAPI.
