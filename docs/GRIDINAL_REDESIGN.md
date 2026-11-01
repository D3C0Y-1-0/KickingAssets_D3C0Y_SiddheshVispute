# GRIDINAL redesign: audit, architecture and status

Branch `feature/gridinal-cinematic-ui` (from `feature/phase-5-hardening` a5bac82). Not pushed.

## Phase A: audit of the existing frontend (verified in the repository)

- **Stack:** React 19, TypeScript strict, Vite 7, Tailwind 4 (used only for `@theme`; almost all styling is hand-written CSS in `src/styles/index.css`, 3,300 lines), TanStack Query, React Router 7, Recharts, d3-force, Cytoscape (dependency present), Lucide.
- **Before this work:** no GSAP, no Three.js, no animation library, no web fonts (system stack only).
- **Auth and roles:** none exist. The app is a single-user local prototype, so there is nothing to preserve or to break there.
- **Routes (13 in the shell):** `/` Overview, `/live`, `/infrastructure` (force graph, full-screen), `/digital-twins` (5 isometric SVG viewers with a risk radar), `/assets`, `/intelligence`, `/curated-intelligence`, `/ml`, `/what-if`, `/remediation`, `/posture`, `/resilience`, `/coverage`, `/methodology`. All fetch through `api/client.ts` and `hooks/queries.ts`; the contract is generated from OpenAPI.
- **Reusable:** `components/ui.tsx` (Panel, PageHeading, RiskBadge, SampleBadge, QueryState, EmptyState), `components/AssetDrawer.tsx`, `components/SimulationProgress.tsx`, `components/TwinRadar.tsx`, the five twin viewers.
- **Constraints found:**
  - Colour is defined in `design/tokens.css` but the twin viewers and `iso.css` hard-code their own lime values (about 100 occurrences). They are figure-local and were left alone.
  - The twin side panel uses 43 invented assets that share no id with the 30 scenario assets (see `AUDIT_REPORT.md` F1). The new substation scene deliberately uses real scenario ids instead.
  - Backend simulation is held in process memory; scenes that need a run show "Not assessed" until one exists.
  - Existing `tsc -b` reports 7 errors from the Phase 5A contract change (`run_id` required) in `Remediation.tsx`, `WhatIf.tsx`, `liveSimulation.ts` and `tests/workflow.test.tsx`. They predate this work and were not touched.
  - Someone re-added the "Sample scenario" bar and the "Simulated as of" banner after the earlier request to remove them. Not changed here.

## Architecture (as built)

```
/gridinal            standalone route in main.tsx, outside the app shell (no sidebar)
 GridinalExperience  mode choice, scroll driver, overlays        (lazy chunk)
  capability.ts      WebGL / reduced-motion / compact detection -> 'cinematic' | 'static'
  scenes.ts          scene map, Hermite camera path, layer visibility. Pure, unit-tested.
  world.ts           seeded illustrative network (64 nodes), pure
  substation.ts      six REAL scenario assets + the six real relationships among them
  CinematicCanvas    one React Three Fiber canvas = one world, one camera   (lazy chunk)
  StaticScene        same story, SVG plan view, no WebGL, no scroll scrubbing
  ui.tsx             TopBar, SceneNav, SimulatedChip, AssetList, AssetPanel, RiskPill, MetricStat, Legend
```

Scroll model: a 560vh track with a `position: sticky` 100svh stage (no GSAP pin spacer, so no layout shift). One ScrollTrigger writes `progress` to a ref. The camera reads it with exponential damping in `useFrame`; overlay text is scrubbed by a GSAP timeline from the same scroll position, so forward and reverse scroll are the same function of position. React state changes only when the scene changes, never per frame. The render loop pauses when the stage is off screen or the tab is hidden. GSAP is bundled and tree-shaken to `gsap` + `ScrollTrigger`; `drei` and `motion` were not installed because nothing needed them.

Mode choice: cinematic only with WebGL, no reduced-motion preference, a viewport of 760 px or more and more than 2 CPU cores / 2 GB. Otherwise the static story. A lost WebGL context or a failed scroll driver switches to static at runtime. `?mode=static` forces static (for testing); `?mode=cinematic` cannot force WebGL that is missing.

Honesty rules applied to the scene: the chip "Simulated scenario" is always visible; asset names, types, criticality and exposure are copied from `aurora-city.json` (a test compares them); only relationships that exist in the cyber or operational graph are drawn (a test checks it); product and risk come from the latest simulation run via the existing API and read "Not assessed" otherwise; the 64-node opening network is labelled illustrative in code and is not presented as scenario data.

## Phase B: design system (done)

- `design/tokens.css` rewritten: midnight navy `#0B1424`, slate `#17263C`, electric teal `#37C6C0` (single interactive accent), amber `#F4B860` (assumptions and caution), off-white `#F5F7FA`; status colours kept semantic and always paired with a label. This restyles the whole existing application through its variables.
- Bundled fonts (offline): Space Grotesk (display), Inter (UI), JetBrains Mono (data), via `@fontsource-variable`. Display, UI and mono tokens exist; only the new experience uses the display face so far.
- Brand renamed to GRIDINAL in the shell, page titles, `index.html`, footer, methodology text and the error boundary. A new "Inside the Grid" navigation entry opens `/gridinal`.
- Shared components in `gridinal/ui.tsx`: navigation (TopBar, SceneNav), metric display, asset information panel, risk indicator, graph legend, scene overlay pieces. Cards, tables, dialogs, alerts, charts and loading states continue to use the existing `components/ui.tsx` and page CSS.

## Phase C: vertical slice (done)

Scene 1 (network awakens, headline, two actions, camera dolly) flowing without a cut into scene 2 (fly-in to a procedural substation, six selectable markers, animated cyber and operational flows, details panel with a link to Assets & Risk), with a scene-progress rail, direct scene navigation and an always-visible "Enter Command Center".

## Not built (do not read as done)

Scenes 3 to 5; restyling the five twin viewers and `iso.css` to the new palette; applying display typography and new card styles across the 13 operational pages (only the token-level restyle exists); a light theme; touch gestures beyond native scroll; automated browser tests (verification below was manual); an accessibility audit with a screen reader; GPU/CPU profiling beyond the paused-when-hidden loop.
