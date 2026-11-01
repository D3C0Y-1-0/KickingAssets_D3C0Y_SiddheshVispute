# Resilience Planner final clarity pass

Based on verified Phase 8 `4e777061`, local branch `codex/resilience-planner-clarity`.
Preserves the existing UI and the earlier local HLT-001 feedback fix. Does not use the rejected
cinematic branch. Backend, API contracts, algorithms, datasets, ML artifacts and packages unchanged.

## Behavior and evidence boundaries

- Resilience Planner is directly after Live Simulation in the existing sidebar, tagged PLAN. The sidebar
  navigation scrolls within its available height; the existing asset drawer shortcut remains.
- Planner and Infrastructure Map use the same graph API, scenario/snapshot and asset inventory.
  Cyber context is accepted only with matching scenario/snapshot and exactly the same asset IDs.
  Cyber and operational edges are never mixed. Access does not establish compromise.
- Full Infrastructure keeps all assets; Affected Dependencies retains initiating failures, API
  outage assets, reported causal-edge endpoints and triggered standby relationships. This is a
  display filter, not a reachability or impact calculation. No transitive edges are invented.
- Heavy node outlines identify direct assumed failures. Other reported outages are indirect.
  Unaffected assets are dimmed. Colors change at actual API interval boundaries; reported causal
  edges are aggregate evidence with no per-edge event times. Replay hover edges do not animate
  imagined traffic. Play/pause/step and timeline buttons remain keyboard accessible.
- Dashed operational arrows mean provider to dependent. Dotted operational edges are declared
  standby relationships. The shared D3 edge titles include declared requirement/group/grace data.
  Infrastructure Map's old claim that cascades are unimplemented was replaced with a topology-only
  explanation and reference to the existing calculated planner.
- Backup cards expose service/requirement IDs, scheduled activation, usable output intervals,
  energy-runtime duration, exhaustion limit and only graph-declared backup connections. Null
  activation means not triggered, not immediate activation. Available intervals determine output.
  Capacity is energy runtime at nominal output; no physical kW/load-flow capacity is supplied.
  Stress capacity fractions and forced-unavailability labels come from the returned stress case.
- Planning labels explain demo credits, engineering hours and pre-incident maintenance limits.
  Candidate selection is a search space, not an applied plan. Costs, effects, prerequisites,
  exact-search scope, benefit and rejected alternatives come from the API.
- Comparison bars and numeric values display Before Protection / After Protection / Backup Stress
  Test with a common service-minute scale. Missing results remain Not calculated. Asset interval
  summaries and residual consequences are descriptive, not new risk or recovery calculations.
- Existing pending/error feedback, stale-run clearing, request identity and projected/not_verified
  labels are preserved. View simulation results focuses and scrolls to the comparison.

## Reproducible demo

Launch from the repository root with `.\scripts\start.ps1 -SQLite` after stopping any older
instances on ports 8000/5173. A compiled local alternative is `-Production -SQLite` on port 8000.
The isolated verification app is on port 8001 with its separate SQLite database.

1. Complete Live Simulation. Open Assets & Risk, PWR-008, Simulate resilience failure (or open
   `/resilience-planner?asset=PWR-008`). Use Local power loss, horizon 360, no restoration deadline.
2. Simulate failure. Actual baseline is 360 service-minutes. Use View simulation results, inspect
   the comparison and the existing D3 graph. Toggle Full Infrastructure / Affected Dependencies.
3. Step to minute 30. PWR-010's available interval begins and the reported asset outage intervals
   end. Inspect the expanded standby windows and actual declared PWR-010 -> PWR-008 edge.
   The nominal stored-energy limit is minute 270. The timeline never treats a horizon cutoff as repair.
4. Inspect Cyber Connections (context only), then return to Operational Dependencies. This changes
   displayed connections only, with the same asset inventory and separate operational outcome.
5. Keep Available Budget 12, Engineering Work Hours 24, Maximum Planned Shutdown 6 and optional
   per-action limit blank. Optimize protection with the default candidates. The existing exact
   engine selects recover-PWR-008: 4 credits, 8 hours effort, 1 hour planned shutdown.
6. Replay protected scenario: 90 service-minutes. The chart shows 360 before and 90 after, with
   service residuals and shorter asset-outage intervals. These are projected assumptions.
7. Choose standby PWR-010, Force selected backup unavailable, Calculate stress test. With that
   recovery plan, the actual protected stress result is 180 minutes (90 extra versus nominal).
   The chart shows 360 / 90 / 180. Inspect its failed-backup output intervals and residuals.
8. Separately choose HLT-001, local power loss, horizon 360. Simulate: HLT-001 has an outage over
   [0,360] but zero downstream service-disruption minutes. This remains the backend's real result.

No physical recovery, real infrastructure control, worst-case stress optimization or full WCAG
certification is claimed. Planning state remains local; a new run invalidates prior results.


Verification: 54 focused tests across planner/shared modules passed; final planner rerun 19/19. TypeScript, Prettier and final production build passed. Actual browser verified PWR-008 360/90/180, HLT-001 zero downstream minutes, matching map/planner topology and mobile 390x844 without overflow. See VERIFICATION.md for measured evidence and limits.
