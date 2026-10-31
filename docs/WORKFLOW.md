# Workflow: simulate, assess with ML, act

Run (from the repository root, after `scripts/setup.ps1`, `python -m ml.fetch_reference` and `python -m ml.train` run from `backend/`):

```powershell
cd frontend; npm run build; cd ..
cd backend; ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

1. **Simulate** (`POST /api/v1/simulation/run`, button on the overview). Each fictional asset is mapped to a real product family by sector and role (`app/domain/product_profiles.py`, a labelled scenario assumption). Real CVEs for that family published 730 to 30 days before the latest EPSS snapshot are taken from the local NVD data. CVEs already in CISA KEV are shown as known exploited; the rest are scored live by `ml/artifacts/kev-signal-v1_xgboost_with_epss.ubj` with exact TreeSHAP drivers.
2. **Assess**. `risk = 100 x S x E x I'` (`app/engine/risk.py`): S is the ML vulnerability signal, E the exposure factor from configuration, I' the conditional service impact. Impact joins the cyber reachability graph (where an attacker could pivot) with the dependency graph through the conditional impact engine (what that does to services). Nothing is hardcoded; before a simulation there is no score.
3. **Act** (`/api/v1/actions/*`). The PS actions: patch prioritization, network segmentation and access control are modelled and recomputed; enhanced monitoring and incident-response planning are recommendations with no modelled reduction (the index has no detection or recovery term). What-if returns projected, never verified. The optimizer is greedy by city-index reduction per effort hour, recomputed after each pick.

`/api/v1/ml/overview` and `/api/v1/ml/score` back the ML Lab page.

## Known limits

- CVEs are candidates for an assumed product family; versions are not matched.
- Large vendor families keep dozens of KEV-bound CVEs, so patching a few barely moves the index and segmentation dominates the plan.
- Impact is an upper bound (no recovery; edge-level backups do not relieve cascades) and saturates at 100% for many assets.
- The model is statistically tied with the EPSS baseline (see the ML Lab).
- The simulation result is held in memory for the running server process.
- Effort hours per action are planning assumptions.
