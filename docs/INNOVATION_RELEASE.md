# Phase 7 and Phase 8 innovation release

Target branch: `codex/innovation-phase-7-8`. This release retains the earlier approved main UI
and all completed resilience functionality. Publication to this feature branch is authorized;
no merge to main or force-push is authorized.

## Included work

- `ec1ed80174817b42886914c302a93136bc62beba`: verified Phase 7 failure simulator,
  intervention catalog, exact constrained optimizer, stress APIs and strict run binding.
- `4e777061f0f93da80d7b5fa6cb2c5e299c2e0f03`: Phase 8 planner, typed API integration,
  operational replay, planning constraints, comparison and stress-test workflows.
- `266eacefd8c924c095ae31e578cce32f08364674`: final planner clarity improvements and
  the HLT-001 completion/error feedback fix, with evidence-only filters, separate cyber
  context, declared standby windows, clearer limits and API-derived comparison charts.

## Rejected/unrelated UI excluded

The rejected cinematic redesign `ffed6446589891bd6a07070fd8935d33d07dcf13` is not an ancestor
of this release. No reverse patch is necessary: applying its revert here would alter approved
files that never received that redesign. Its separate branch/worktree is preserved untouched.

Excluded components include CinematicOverview, cinematic journey/route motion, workspace.css,
MotionControl and their associated theme/layout rewrites. These files/imports are absent.
The unrelated `origin/codex/inspo-dashboard-theme` branch (inspected at `965ddaa`) is also
not incorporated; its FloatingDock, encrypted greeting and additional styling/dependencies
are absent. This does not modify or delete either separate UI branch.

Compared with the approved Phase 6 baseline `91f2ab55`, design/tokens.css, Overview,
main.tsx, package manifests and Vite config are identical. The shell adds only the planner
module/route. Global stylesheet changes are limited to sidebar scrolling and the declared
standby edge pattern. Targeted planner/graph presentation changes preserve the approved theme.

## Fresh verification before push — 1 November 2026

- Backend resilience engine/API tests: **63 passed**, 22.08s; one inherited upstream
  Starlette/httpx deprecation warning.
- Frontend planner/shared-module tests: **54 passed**, 10.21s.
- Strict TypeScript, Prettier and production build passed (2607 modules, 10.23s).
- Actual local HTTP demo: **11 checks passed**, baseline immutable. PWR-008 unprotected
  360 and prepared-recovery 90 service-minutes; the separate standby-extension stress
  example retains its actual 1080/360/750 results. Phase 6 city index 35.62, old plan 27.72
  and 15 attack paths are unchanged. No ML run or retraining was performed.
- Prior real browser verification on exactly the included 266eace UI measured PWR-008
  360 / 90 / 180 for baseline / recovery / recovery with PWR-010 unavailable; HLT-001
  zero downstream disruption, matching graph inventories and responsive navigation.
  These differ from the standby-extension stress example because they use a different plan.
- Credential-pattern preflight and whitespace/scope review precede commit/push. Generated
  output, databases, environments and transient evidence remain ignored.

Exact demonstration: [RESILIENCE_PLANNER_DEMO.md](RESILIENCE_PLANNER_DEMO.md).
All outcomes remain synthetic, projected and not verified recovery; model limitations remain.
