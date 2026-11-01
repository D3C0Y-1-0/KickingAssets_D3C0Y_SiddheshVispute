# Vinay website + Phase 7–8 resilience integration

Local branch: `codex/integration-vinay-resilience`.
First-parent base: `origin/Vinay` at `0a7a77943fa8390ef4731961c3965547e68399da`.
Integrated innovation branch: `origin/codex/innovation-phase-7-8` at
`e5c6945f1e1ed89b9fc5c844e398d0fc77621769` (Phase 7 ec1ed801, Phase 8 4e777061,
clarity/feedback 266eace). Initial working tree was clean; no stash or discard was required.
This is a local integration only. No remote branch, main, model or dataset was rewritten.

## Authority and resolutions

Vinay is the approved visual authority for this task, including his landing, grouped/collapsible
dock navigation, branding, halftone, Overview, digital-twin implementations and defense screens.
These approved changes supersede the previous innovation-only branch's theme-exclusion policy.
The separate rejected cinematic commit ffed644 remains absent from both parents and this result.
No CinematicOverview, cinematic workspace.css or RouteExperience was copied.

The merge produced 14 conflicting files. Vinay's shell/styles and five twin viewers were kept;
only the planner module/route and additive attack-path route were inserted into his shell.
Vinay's global stylesheet differs by just three lines for actual declared standby edges.
His map retains its twin links and layout, with a planner handoff and corrected topology caption.
The unused older DiagramViewport wrapper was omitted. Shared API client/hooks retain defense
calls and add exact resilience/attack-path binding. The live workflow retains Vinay's defense
step and the innovation branch's real report-fetch/run validation.

Backend auto-merges retain Vinay's defense router and opt-in warm start alongside the resilience
router and existing run/fingerprint guards. OpenAPI was exported from the combined backend;
TypeScript was regenerated, never resolved by manually concatenating generated schemas.
All 37 Vinay paths remain, with 41 combined paths. Dependency manifests/lock are exactly Vinay's.

The tests exposed two real edge cases: a computed trend with no points could crash, and twins
could label pending/failed risk as an unrun simulation. Small guards/status/retry feedback fix
those cases without changing the visual layout. The report test fixture now supplies Vinay's
real additional defense step; methodology assertions use his retained applicability disclosure.

## Verification (1 November 2026)

- Full backend: **258 passed**, 223.73s; one inherited Starlette/httpx deprecation warning.
- Full frontend: **104 passed**, 10.41s. Strict TypeScript, Ruff lint and backend format
  (87 files) passed. Targeted changed frontend files pass Prettier. Vinay's original global
  stylesheet formatting is retained; no broad formatting/redesign was performed.
- Production build passed: 3057 modules, 11.48s. Existing combined app bundle has a >500kB
  chunk warning; no performance/theme refactor is included.
- Real HTTP demo: 11 checks passed on port 8002, including immutable baseline, Phase 6 city
  index 35.62, original plan 27.72 and 15 attack paths. No training was performed.
- Real binding probes: wrong fingerprint -> 409 baseline_fingerprint_mismatch; unknown run ->
  404 baseline_not_found. The baseline was unchanged; no silent recalculation occurred.
- Actual browser: Vinay intro entered normally; all 8 Live Simulation steps completed, including
  defense (3 assets / 72h blocks 15 routes) and verified brief. Planner is in his Act nav group.
  PWR-008 power loss, horizon 360, no restoration -> 360 service-minutes. Defaults 12 credits /
  24 effort / 6 planned downtime select recover-PWR-008 (4/8/1), protected replay -> 90.
  PWR-010 forced unavailable under that same recovery plan -> 180 (90 extra).
- Actual replay: affected scope has 13 assets, declared standby edges and a minute-30 API
  transition. HLT-001 still has one outage and zero downstream service-disruption minutes.
- Actual retained Overview, Attack & Defend attacker view, power digital twin, Assets & Risk
  and its planner handoff, and What-If with current fingerprint were inspected. Browser consoles
  had no errors/warnings. This is smoke coverage, not an exhaustive physical-device/WCAG audit.
- Screenshots: ignored artifacts/screenshots/vinay-integrated-planner.jpg and
  vinay-integrated-overview.jpg captured and visually inspected.

## Launch and demonstration

Current combined compiled website: http://127.0.0.1:8002/ . First visit: Skip intro / Enter the
dashboard, then Live Simulation. Planner: Act -> Resilience Planner, or
http://127.0.0.1:8002/resilience-planner?asset=PWR-008 . Use the exact inputs above, then
Simulate failure -> View simulation results -> Optimize protection -> Replay protected scenario
-> choose PWR-010 / force backup unavailable -> Calculate stress test.

Current server uses isolated artifacts/vinay-integration.sqlite3 (launcher 9764, server 38848).
Other backend databases/processes were preserved. The old workspace Vite on 5173 (PID 12408)
held a native CSS DLL and blocked npm ci; only that verified process was stopped. Vinay's locked
dependencies then installed successfully. No unrelated teammate dev server was stopped.

For the standard next launch from this checkout, stop older instances occupying 8000/5173,
then run `.\scripts\start.ps1 -Production -SQLite` (port 8000), or omit -Production for Vite
on 5173. The already-running combined verification site is on 8002, not older backend ports.

All continuity outcomes are synthetic projected/not_verified. Capacity is energy runtime,
not power-flow physics or demonstrated physical recovery. Runs/history remain process-local;
a restart requires a fresh run (Vinay's optional warm start remains available). Advanced API
scopes and CVE challenge authoring remain outside the planner UI. No hosted/production release,
real infrastructure action or new ML evaluation/training is claimed.
