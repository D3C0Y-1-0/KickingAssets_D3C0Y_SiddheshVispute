# Local Phase 2 integration

Integrated on `integration/phase-2` from shared Phase 1 baseline `4acfd7ebfb708cb9442e9a879e28e238c448d666`:

- Phase 2A: `5b4d82fdf0c3bee732e58a81feb409eecbb2352b`, `feature/vulnerability-assessment`.
- Phase 2B: `95160bc492f24c63ad74df96e8ab54eb0a1b742b`, `feature/conditional-impact`.

Both branches were fetched and merged with merge commits, without conflicts or history rewriting. Remote main remains the Phase 1 baseline. The separately discovered ML branch was excluded. No integration changes were pushed.

## Compatibility and changes

Phase 2A owns additive vulnerability contracts, persistence, APIs and query-backed asset evidence. Phase 2B adds a pure operational-impact engine that returns the existing shared `ImpactResult` contract. Shared models, engine Protocols, scenario IDs, fixture graphs and generated API contracts remain unchanged. Both implementations and all their tests are retained. Source JSON bytes remain checksum-covered with Git line-ending normalization disabled.

The missing `networkx==3.5` dependency was added to both Python dependency files and installed in the local virtual environment. A Phase 2A test assertion received Ruff formatting only. `scripts/demo_impact.py` is a read-only runner over the committed Aurora fixture; it does not persist results, call future risk engines or change Claude's engine. All ten files from Claude's commit remain unchanged.

The earlier **API route not found** error came from an already-running Phase 1 backend on port 8000. Its live OpenAPI had no vulnerability routes. After confirming its project process identity, it was restarted with the integrated code; the project Vite server was also restarted. The register, direct backend API and Vite-proxied API now respond correctly. No database reset was needed.

## Launch on Windows

From the repository root, in PowerShell (stop an existing GridSentinel session before starting another on the same ports):

```powershell
git switch integration/phase-2
.\scripts\setup.ps1
.\scripts\start.ps1
```

Setup installs the committed Python and npm locks; repeat it after dependencies change. Initial installation needs internet. Open `http://127.0.0.1:5173/assets`. The script starts FastAPI on `127.0.0.1:8000`, proxies API requests through Vite, and stops its backend when Ctrl+C ends the session. If scripts are blocked by execution policy, use `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1` (similarly for setup).

For a compiled, single-process demonstration, use `.\scripts\start.ps1 -Production` and open `http://127.0.0.1:8000/assets` instead. Build tools must already be installed. The cached vulnerability data supports offline execution.

## Vulnerability demonstration

In **Asset & Risk Register**, search **PWR-001** and click **North Grid Gateway**. Its separately declared simulated Apache HTTP Server 2.4.49 component matches **CVE-2021-41773** and **CVE-2021-42013**. Both show CVSS 3.1 severity 9.8, dated EPSS signals, KEV listing and expandable source retrieval timestamps and hashes. Configuration weaknesses, exposure and patch review remain separate. These are real reference-backed applicability findings against assumed installed software, not proof of exploitation or a discovered installation.

Other useful cases: PWR-008 has an unknown Apache version and two candidates; HLT-001 has Apache 2.4.51 and both references excluded. Only 4 of 30 assets have declared product identity; lack of coverage is not safety. Risk remains unassessed.

To explicitly run the cached assessment through the running backend:

```powershell
$context = @{scenario_id='aurora-city'; snapshot_id='aurora-baseline-v1'} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/vulnerabilities/assess' -ContentType 'application/json' -Body $context
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/vulnerabilities/assets/PWR-001?scenario_id=aurora-city&snapshot_id=aurora-baseline-v1'
```

The measured persisted report was current (`stale=false`), covered all 30 assets for configuration review, and contained 3 confirmed version matches, 2 candidates and 3 exclusions across the four declared components. Idempotent reassessment retains the original assessment timestamp.

## Claude's impact demonstration

**There is no impact API endpoint or frontend calculation control yet.** The operational graph still displays stored relationships, and What-If calculation remains disabled. The following command executes the actual merged engine, without starting a server:

```powershell
.\.venv\Scripts\python.exe scripts/demo_impact.py
.\.venv\Scripts\python.exe scripts/demo_impact.py --effect loss_of_visibility
```

Default: assume **WTR-008 / Waterworks Control Server** becomes unavailable at minute 0, over a 1,440-minute horizon. The result is projected and conditional, not an incident prediction:

- `svc-water`: 1,440 disrupted minutes, fraction 1.0; initiator-only fraction 0.833333.
- `svc-healthcare`: 1,440 disrupted minutes, fraction 1.0; initiator-only fraction 0.0.
- `svc-power`: 0 disrupted minutes, fraction 0.0.

The water control backup runs from minute 5 to 245, leaving its named control group unsatisfied for 1,200 minutes. Cascading supply losses keep the overall water service disrupted. Requirement-level backups do not relieve edge-level cascades, so these cascaded results are an upper bound with respect to backups; no operator recovery is modeled. Loss of visibility stops no operational output and returns zero disruption for all three services. Cyber reachability is never used as compromise evidence. See `backend/app/engine/impact/README.md` for effect semantics and all engine limitations.

## Verification on the combined branch

- Backend: **65 tests passed**, including Claude's 23 impact cases and Phase 2A applicability/persistence tests. Existing non-failing Starlette/httpx deprecation warning remains.
- Frontend: **8 tests passed**; strict typecheck and production build passed.
- Python Ruff lint and formatting passed after the formatting correction; frontend Prettier check passed. No separate ESLint command is configured in this repository.
- `pip check` passed. OpenAPI re-export produced no semantic change.
- FastAPI health returned 200/`ok`; frontend `/assets` returned 200. Assessment POST and asset evidence GET worked directly and through the frontend proxy.
- Actual browser navigation covered all seven routes, both graph modes (27 cyber / 23 operational edges), WTR-008 node inspection, PWR-001 source evidence, PWR-008 candidates and HLT-001 exclusions. The register showed API connected, 30 assets and current assessment coverage with no route-not-found error. Captured browser warnings/errors: none.
- Both impact demo commands executed successfully against the committed dataset. Local screenshot: `artifacts/screenshots/phase2-integration-evidence.jpg` (ignored).

ML, asset risk scoring, What-If recalculation, optimization, and impact API/UI integration are not implemented by this integration batch.
