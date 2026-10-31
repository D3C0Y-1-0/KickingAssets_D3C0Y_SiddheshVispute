# GridSentinel agent conventions

## Scope and sources of truth

Read README.md, docs/PROJECT_SPEC.md, docs/ARCHITECTURE.md, docs/API_CONTRACT.md, docs/IMPLEMENTATION_PLAN.md and docs/HANDOFF.md before extending the system. The seven official PS03 objectives in PROJECT_SPEC.md are authoritative; a screen does not satisfy its engine requirement. Preserve the approved two-graph architecture and phased implementation.

Do not implement later engines unless explicitly assigned. Never present UI fixtures, configuration assumptions or projected effects as observed findings, real predictions, live monitoring or verified changes. No automatic remediation or infrastructure commands are in scope.

## Contract-first changes

`backend/app/schemas/models.py` owns shared domain/API shapes. Generated OpenAPI and TypeScript are derived artifacts, never independent contracts. Coordinate changes to schemas, discriminators, state/availability rules, stable IDs, Protocols, scoring semantics and source fixture before editing them. Prefer additive versioned migrations; do not silently mutate existing databases or fabricate defaults to keep the UI green.

After a coordinated schema change, export OpenAPI, regenerate TypeScript, update DOMAIN_MODELS/API_CONTRACT and run backend/frontend checks. Preserve scenario_id, snapshot_id, provenance, timezone-aware timestamps and scoring/model versions. Missing analysis is null/unavailable, never an assumed zero.

## File ownership and concurrent work

Do not spawn parallel agents without an explicit user or task assignment. Before any authorized concurrent work, agree exact non-overlapping files and the owner of shared interfaces. The coordinator owns schemas, engine/contracts.py, api/routes.py, db migrations, generated contracts, fixtures, package manifests, navigation, global styles and handoff documents. An engine implementer owns its assigned engine/ML module and tests; a frontend implementer owns its assigned feature directory and tests.

Inspect git status/diffs before editing. Never reset, revert, overwrite or reformat another agent's or the user's uncommitted changes. If interfaces conflict, report the concrete mismatch and coordinate an additive change. Do not solve conflicts by deleting another module or changing fixture IDs to fit your implementation. Update HANDOFF.md with commands actually run and known limits.

## Code conventions

- Python 3.12+, Pydantic v2; Ruff formatting/lint. Thin routes, services for orchestration, repository for persistence, pure engine functions/Protocol implementations for calculations.
- React/TypeScript strict mode. Semantic colors live in design/tokens.css; local figure tokens are scoped. Use Lucide icons, visible focus, reduced-motion support and accessible names.
- Use the central API client and TanStack Query hooks; feature components do not fetch directly, compute backend risk or import scenario JSON.
- Cyber edges are technically plausible access paths; operational edges are provider → dependent relationships. Never merge them or infer successful compromise from connectivity.
- Preserve k-of-n groups, named conditional backup substitution, delay and duration. Backup power cannot repair control/data compromise.
- `frontend/src/fixtures/previews.ts` is isolated design-only data. Do not persist it or use it as inference evidence.
- Do not edit generated station-art.ts manually. Rebuild with reviewed local Anatomy tooling; no example app or WebGL runtime is needed. Retain THIRD_PARTY_NOTICES.md.
- System fonts and bundled assets must support offline demonstration. No secrets, absolute machine paths, hidden external services, unnecessary authentication or cloud infrastructure.

## Commands (repository root, PowerShell)

```powershell
.\scripts\setup.ps1
.\scripts\start.ps1
.\scripts\start.ps1 -Production
.\scripts\check.ps1
.\.venv\Scripts\python.exe -m pytest backend/tests -q
.\.venv\Scripts\python.exe -m ruff check backend scripts/export_openapi.py
.\.venv\Scripts\python.exe scripts/export_openapi.py
```

From frontend/: `npm test`, `npm run typecheck`, `npm run build`, `npm run generate:api`, `npm run format:check`. From backend/: `..\.venv\Scripts\python.exe -m app.db.store --reset` replaces only the Aurora scenario. See README for separate terminals and dependencies.

Run only appropriate tests; do not add tests that just duplicate rendering or implementation lines. Protect meaningful invariants: graph separation, referential integrity, deterministic reset, context isolation, unavailable≠zero, effect-specific backup logic, immutability and evidence lineage. Browser smoke checks must actually navigate and interact with the running app; do not report them as passed based only on a build.

## Git and delivery

Use codex/ branches by default. A local commit is allowed when requested; do not push, force-push, rewrite history or alter unrelated repositories. Keep databases, environments, build output and transient QA artifacts ignored. Record exact created/modified source files in docs/FILE_MANIFEST.md and measured verification in docs/VERIFICATION.md.
