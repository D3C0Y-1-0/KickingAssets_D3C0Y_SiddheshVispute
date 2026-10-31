# Connected flow: simulation to twin to action

Changes made in response to `AUDIT_REPORT.md` findings. Not committed or pushed.

## What changed

- **Digital twin uses the scenario's own assets.** `frontend/src/data/twinAssets.ts` builds the twin's asset list from `GET /assets` and `TWIN_LINKS`. The 43 hand-written `SUB-*`/`CITY-*` assets are no longer used by the page (`data/demoAssets.ts` is now unreferenced). Selecting a diagram part selects the highest-risk linked scenario asset, so the side readout, the radar and the Assets page agree. Parts with no cyber asset are not selectable.
- **Readouts show real data only.** The invented telemetry and "system nominal" text are gone. The readout shows the asset id, name and the latest run's ML risk, or "Not assessed" before a run.
- **Simulation drives the twin.** While a run is in flight the stage shows a scan sweep and no radars. When it finishes, radars and chips pop in highest-risk first (`rank`, `--pop-delay`), replaying on every new run (`runId` key). Reduced-motion users get the final state without animation.
- **Results lead to action.** `TwinFlow` lists the flagged parts of the current diagram with the operational dependents each one feeds (from the operational graph), an Evidence link (Assets page) and "Test a fix", which opens What-If with that asset staged through the existing plan handoff.
- **`run_id` sent by all callers.** Remediation, What-If and the Live Simulation plan step now send the run id. The seven `tsc -b` errors are gone; test fixtures were updated to the Phase 5A contract.
- **Latest run survives a restart.** The run's inputs (scenario, snapshot, as-of) are saved in the `metadata` table (`last_run`). On startup a background thread rebuilds the run, and any endpoint that needs it rebuilds it on demand. The rebuild is a fresh deterministic computation with a new run id and timestamp, not a stored result; the fingerprint and scores match the original.

## Not changed (still open)

- Curated assessment still scores 3 assets with a different method from the main index.
- Score ties from a saturated vulnerability signal (several assets at exactly 79.9 / 60.0 / 10.0). Changing this alters scoring semantics and needs a coordinated decision.
- The attack-path engine still has no screen and does not feed the score.
- The 60 h plan figures differ between branches; quote only the final branch.
- The twin's reachability between parts is not drawn as lines on the SVG; the operational links appear in the flow panel instead.

## Verified

- Backend: 181 passed (new test: run rebuilt after restart and bound by What-If).
- Frontend: `tsc -b` clean, 50 tests passed, production build succeeds.
- Browser (running app): Run simulation on `/digital-twins` showed the scan, then 4 staggered radars and 4 flow rows; "Test a fix" opened What-If with the action staged and "Calculate projected risk" returned a projection; after a server restart `/simulation/latest` returned 200 without re-running; selecting a part showed `PWR-001 · ML RISK 97.3 · CRITICAL`.
- Not verified: other viewport widths, the water and hospital diagrams after a run, a screen reader pass.
