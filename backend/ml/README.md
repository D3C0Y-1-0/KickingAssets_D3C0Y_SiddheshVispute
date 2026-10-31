# KEV-prioritization signal (Phase 3)

Ranks CVEs by how much they resemble CVEs that CISA later adds to its Known Exploited Vulnerabilities (KEV) catalog. It is a relative signal for CVEs. It is **not** the probability that an asset or organisation is attacked, and it is not calibrated.

## Reproduce (from `backend/`)

```powershell
..\.venv\Scripts\python.exe -m ml.fetch_reference   # downloads KEV, NVD, EPSS into data/reference/cache (not committed)
..\.venv\Scripts\python.exe -m ml.train             # builds the panel, trains, evaluates, writes artifacts/
```

Needs `pandas`, `numpy`, `scikit-learn`, `xgboost`, `pyarrow` (not yet in `requirements.txt`; the coordinator owns that manifest).

## Data

- CISA KEV JSON (labels), NVD per-year feeds from the fkie-cad release (features), EPSS monthly snapshots (baseline and feature). Exact files, sizes and SHA-256 digests: `data/reference/manifest.json`.
- A monthly panel from 2021-12: every CVE at least 30 days old and not yet in KEV is a candidate. Label: added to KEV in the next 180 days. Non-KEV CVEs are unlabeled, not confirmed unexploited.
- Negatives are subsampled (3%) and weighted by 1/rate, so reported metrics describe the full population.

## Leakage controls

- NVD `references`, `cisaExploit*`, SSVC metrics and `cveTags` are never read.
- KEV-history features count only entries with `dateAdded <=` the snapshot.
- Snapshots start after KEV launched (Nov 2021); its bulk initial listing is a catalog artifact.
- Time split with purging: training label windows close before validation, validation before test. Hyperparameters are chosen on validation only.
- EPSS enters as a within-snapshot rank percentile, because its scale changed across model versions.
- CVSS fields that exist only in some NVD scoring eras (`cvss_version`, `cvss_ui`, `cvss_scope`) are excluded: they encode publication date.
- A shuffled-label audit must score near prevalence.

## Output

`artifacts/kev-signal-v1_model_card.json` holds the design, splits, metrics with CVE-clustered bootstrap intervals, baselines (EPSS percentile, CVSS only, vendor KEV history), the shuffled-label audit, drift by quarter, feature contributions and limitations. `tests/test_ml_kev.py` protects the point-in-time rules.

## Limits

NVD files are the current record, not a point-in-time archive, so CVSS/CWE/affected-product fields may have been edited after a snapshot. Positives are few (hundreds of distinct CVEs), so intervals are wide. KEV reflects CISA's inclusion criteria and timing, not all exploitation. Do not present results as incident prediction.
