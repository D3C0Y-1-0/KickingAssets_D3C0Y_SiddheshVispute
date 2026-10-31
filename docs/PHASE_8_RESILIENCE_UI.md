# Phase 8 â€” Interactive Resilience Simulation

Local branch `feature/phase-8-resilience-ui`, based exactly on Phase 7
`ec1ed80174817b42886914c302a93136bc62beba`. No merge or push is authorized.

## Integration

The existing shell, navigation, semantic colors, panels, action errors, baseline notice and
D3 ForceGraph are reused. No theme, landing page, dependency, backend algorithm, model,
dataset or API schema changes. The new route is `/resilience-planner`; navigation, the risk
workflow, Infrastructure Map and asset drawer link to it. The drawer/map preserve asset ID.

The central typed API client wraps the four actual Phase 7 POSTs. Catalog and mutations check
the latest baseline before and after requests. Responses are checked for exact run, scenario,
snapshot, baseline fingerprint, catalog fingerprint, horizon and selected interventions.
Over-budget responses and mismatched stress cases are rejected. Catalog/operational graph
loading/error states provide retry; absent results never become zero disruption.

Scenario, candidate and limit signatures invalidate old projections and hide late responses.
A changed run clears the workspace and requires review. Stress edits invalidate only stress
results. Replaying protection performs a fresh simulate call using exact optimizer-selected IDs
and verifies its comparison matches the optimized plan. Structured backend issues remain visible.

## Replay semantics

The existing D3 graph receives operational edges only. Node colors derive from returned asset
outage and standby-availability intervals, without restarting graph layout. Native asset selection
and service-state tables provide a nonvisual alternative. Graph layout motion is not cascade data.

Play advances once per second between distinct API event boundaries. Pause, next event,
replay-from-start, event buttons and an integer-minute slider support inspection. Events at the
same minute stay simultaneous. No guessed hop delays, attack packets or fabricated repairs.
Scheduled standby activation is explicitly distinguished from usable output intervals. A window
ending at the horizon is not displayed as confirmed recovery. An outage ending because of standby
coverage is labelled as an interval ending, not permanent verified repair.

Service minutes and protected/residual service summaries use API results. Avoided/shorter asset
outages are display summaries derived from returned intervals, not new risk calculations.
All outcomes are projected/not verified. Synthetic credits, restoration deadlines, energy-runtime
assumptions, pre-incident maintenance downtime and the 12-candidate exact-search limit are visible.

## Launch and exact demo

Stop an older instance on the same ports before launching from this checkout. Dependencies and
the pinned reference cache must already be prepared as in the Phase 6/7 runbooks.

```powershell
.\scripts\start.ps1 -SQLite
```

Open `http://127.0.0.1:5173/live`. Compiled single-process alternative:
`.\scripts\start.ps1 -Production -SQLite`, then port 8000.

1. Complete Live Simulation (all seven real stages). Open Assets & Risk and select
   **PWR-008 Â· Dispatch Control Server**, then **Simulate resilience failure**. Alternatively
   open Resilience Planner from navigation and select PWR-008.
2. Keep **Local power loss**, **360-minute horizon**, blank existing restoration deadline.
   Click **Simulate failure**. The actual unprotected result is **360 service-minutes**.
3. Use Play/Pause, Next event and slider. At minute zero the initiating/cascaded outages are
   shown; minute **30** reports usable standby output and ended outages; at **270** the
   PWR-010 energy window exhausts and service outages recur. At 360 the horizon ends.
4. Keep **12 credits / 24h effort / 6h downtime**, blank per-action window. The asset's supported
   catalog interventions and linked standby are selected as candidates. Click **Optimize protection**.
   Current catalog selects **recover-PWR-008**, **4 credits / 8h effort / 1h downtime**.
5. Click **Replay protected scenario**. The fresh backend result is **360 â†’ 90 service-minutes**:
   each service has 120 before and 30 after. Inspect the same operational graph and residuals.
   The existing risk index is a separate metric, not relabelled service recovery.
6. Select **PWR-010** as standby. Forcing it unavailable gives **180** protected minutes for this
   recovery plan (extra 90 versus nominal). A half-energy stress may have no extra effect when
   prepared recovery occurs before exhaustion; that is an actual modeled outcome, not an error.
7. To reproduce Phase 7's energy-sensitive alternative, uncheck candidate **recover-PWR-008**,
   optimize and replay again. The selected **backup-PWR-010** extension costs **12 credits /
   16h effort / 2h downtime**, also giving 90 nominal minutes. Set PWR-010 energy to **0.5** and
   calculate stress: **360** protected service-minutes, extra **270**. Forced standby failure
   gives **1080** for this extension plan. An optional additional hardware failure can be added.
8. Change budget to **0**: the old plan is marked outdated, then optimization returns a valid
   empty plan. Replay shows **360 â†’ 360**, with no invented benefit. Restore limits to recover.
9. Run a replacement simulation in another tab, then **Check baseline**: prior results clear.
   Invalid limits disable submission; API failures show structured errors rather than fixtures.

The numbers above are measured outputs from pinned Aurora data, not frontend constants. Candidate
counts depend on the fetched catalog: the default PWR-008 UI selection currently has four
candidates (16 subsets); excluding recovery leaves three (8 subsets).

## Verification

Final gates passed: **247 backend tests**, **99 frontend tests** (14 new), strict TypeScript,
Ruff lint/format, Prettier and production build. See VERIFICATION.md for measured timings
and the distinction between automated boundary checks and actual browser observations.
New automated interaction tests use clearly isolated synthetic UI fixtures (8â†’3 rather than
the demo values), with real model/API calculations verified independently in browser/HTTP.

Desktop browser checks used the compiled app served by an isolated SQLite API on port 8001.
Actual Live Simulation, asset handoff, simulate/optimize/replay/stress, native asset inspection,
D3 recoloring, Play/Pause/Next, zero-budget recovery and stale-run clearing were exercised.
Mobile viewport 390Ã—844 had document client/scroll widths 375/375; controls wrap and tables
scroll internally. Keyboard range controls changed actual energy inputs. The mobile menu was
opened; an automation navigation issue required restoring the planner URL, so this is not
claimed as an exhaustive menu audit. Browser console was clean after the completed flow.

No full WCAG, physical touch-device, load/concurrency, production-hosted or real equipment trial
is claimed. The inherited D3 supports reduced-motion layout; planner playback begins only on
explicit user action and can be paused or stepped. Unit tests cover HTTP failures and retry;
not every failure was deliberately induced in the real browser.

## Remaining limits

- Planner UI authors simultaneous **direct** failure scenarios. Phase 7's CVE-attributed cyber
  challenge API remains available through its documented API/demo; no unsupported exploit UI
  is invented. Patch/segmentation candidates correctly receive no benefit for erasing an already
  assumed direct failure. The optimizer's prerequisites and limitations are shown.
- Stress reevaluates the fixed chosen plan; it does not optimize over a probability distribution
  or worst-case stress objective. Energy is runtime at nominal output, not power-flow physics.
- The UI uses the all-service objective and no asset exclusions; advanced API scopes remain
  in Phase 7. No API contract changed.
- State is local to the workspace; navigation/reload or a new run requires recalculation.
  Existing process-local run/history, version applicability and coarse graph assumptions remain.
- Backend intervals do not expose per-edge transition times. The UI colors asset intervals and
  lists aggregate causal edge IDs; it does not animate invented edge-by-edge failure travel.
