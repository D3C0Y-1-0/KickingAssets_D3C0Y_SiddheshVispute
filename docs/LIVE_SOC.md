# Live SOC: project-side setup and two-device demonstration

Local branch `codex/live-soc`, based on `live-ui-merged-all` at da2f307. No commit or push
was requested. This observes actual project HTTP traffic; infrastructure outcomes remain
simulated. Existing Overview is preserved at `/overview`, along with Phase 1–8 workflows.

## Start on laptop 1

From the repository root, with the existing dependencies installed:

```powershell
.\scripts\start-soc.ps1
```

The launcher builds the frontend. Use `-NoBuild` only after a current successful build.
Operator console: http://127.0.0.1:8005/ . Node gateway: private server IPv4, port 8006.
Ports are configurable with `-Port` and `-TargetPort`. Enter/skip the existing intro,
then click **Open local operator session**. Reload once after a frontend deployment;
incoming events subsequently update without refreshing.

The operator session is an eight-hour random HttpOnly SameSite=Strict cookie, stored
hashed and bound to the connection IP. Bootstrap is direct-loopback only. This is a
trusted local console, not a production multi-user authentication system. Foreign-Origin
writes are rejected. Remote clients cannot bootstrap or replay the operator session.

Both servers share `artifacts/soc-live.sqlite3` for evidence and controls. Infrastructure
uses `artifacts/soc-infrastructure.sqlite3`, preserving the normal database. The launcher
disables proxy-header interpretation. No arbitrary forwarded-IP header is trusted.
New stores default protected; profile settings, blocks and events persist. Review Node
Services before testing. A generated protected-node password stays in the ignored
`artifacts/soc-node-password.txt`; it is never printed or logged. Ctrl+C stops only the
owned process trees. No other backend/teammate server is stopped.

Use a trusted private LAN/hotspot. If Windows Firewall blocks laptop 2, allow TCP 8005/8006
only from that laptop's address on the Private profile. No firewall rule is changed
automatically. Do not use internet forwarding or public tunnels. The node gateway rejects
globally routable peers and has request, body, query and concurrency ceilings. These
are bounded-demo controls, not a volumetric DDoS protection guarantee.

## Commands on laptop 2

Copy `scripts/soc-demo.ps1` to laptop 2. It needs PowerShell only, not Python/npm.
Replace the sample address with laptop 1's actual private IPv4 from `ipconfig`:

```powershell
$serverIp = '192.168.1.10' # replace with laptop 1 private IPv4
.\soc-demo.ps1 -ServerIP $serverIp -Action Probe
.\soc-demo.ps1 -ServerIP $serverIp -Action LoginAttempts
```

The helper is restricted to literal private/loopback IPv4 and fixed project node paths.
Its sequences are bounded; no session token is printed. Localhost on laptop 2 means
laptop 2, not laptop 1. Physical connectivity/firewall must be verified on both machines.

Use **Node Services** on laptop 1 to enable the relevant vulnerable profile:

- **PWR-001:** weak synthetic viewer/viewer or operator/operator login. `LoginAttempts`
  sends six incorrect attempts; `Login` tests weak accepted credentials. Protection
  requires the generated password and enforces throttling. Changing the login profile
  invalidates node tokens. Node tokens never authorize the SOC.
- **PWR-008:** `RecordAccess` first obtains a viewer token from vulnerable PWR-001.
  Protected PWR-008 denies operator-owned record 1002. Vulnerable PWR-008 actually returns
  that fictional record. Protection restores ownership checks.
- **WTR-005:** `QueryExposure` exercises the real query handler against an ephemeral
  SQLite table. Vulnerable mode returns additional fictional rows. Protection uses
  parameters and a public-row restriction. SQLite authorization denies ATTACH, schema
  reads, writes, PRAGMAs and functions. There is no production database connection.
- **HLT-008:** `FileAccess` requests the named fictional maintenance report. Protection
  returns 403; vulnerable mode reads the fixed report file. Only two server-owned
  filenames exist. Arbitrary host paths, uploads and directory traversal are unsupported.
- **PWR-005:** `RateBurst` sends 12 lightweight requests. Protection allows five per fixed
  10-second window and returns 429 for excess. Vulnerable mode removes that endpoint
  limit within the always-on safety ceiling. Timing/window boundaries are measured;
  no service outage or delay is fabricated.

```powershell
.\soc-demo.ps1 -ServerIP $serverIp -Action RecordAccess
.\soc-demo.ps1 -ServerIP $serverIp -Action QueryExposure
.\soc-demo.ps1 -ServerIP $serverIp -Action FileAccess
.\soc-demo.ps1 -ServerIP $serverIp -Action RateBurst
```

These are real service interactions with synthetic data, not access to actual power or
hospital equipment. The five logical services share a restricted gateway process,
separate from the SOC. No SSH listener, host shell, malware or distributed attack is added.

## Live evidence and blocking

One **SOC Overview** sidebar module contains logs, incidents, node services and IP controls,
using existing design tokens. Old SOC URLs redirect to its internal panels. Logs have
INFO/MEDIUM/HIGH/CRITICAL text badges and color accents. Confirmed fictional-data
disclosure is critical; blocked query syntax is medium; repeated failed logins and accepted
weak demo credentials are high. The original four-module wording below is historical.
Metrics describe the loaded recent-event window, not fabricated lifetime totals. IPs
identify connections, not people. Alerts distinguish attempts, denials, actual fictional
data disclosure and observed traffic. There is no public endpoint to inject fake events.

Select **IP for block**, review address/reason/duration, then **Block IP**. A persistent
rule is checked before new HTTP requests on both gateways. Repeat a request from laptop 2:
403. Unblock and repeat: access returns. Expired rules stop enforcing automatically.
Loopback/active operator addresses are protected. NAT clients may share an IP. Existing
downloads are not terminated. TCP connectivity tests can still report an open port;
this is HTTP enforcement, not an OS firewall, packet dropper or SSH-session terminator.

Events have server UTC timestamps, monotonic IDs, actual peer/status/headers latency and
persisted detector versions. Bodies, query strings, headers, passwords and tokens are
not stored. Log text is escaped by React. SQLite controls/evidence are separate from
infrastructure schemas and records.

SSE uses a snapshot plus ordered IDs, Last-Event-ID recovery, heartbeats and gap/expiry
handling. Bad events/gaps resynchronize; errors display reconnecting states. Full ASGI
tests verify uncompressed streaming through middleware. The server retains approximately
10,000 events, pruned in batches; the live browser buffer is bounded to 500. Security Logs
can page older retained records while the live stream and counters continue. No sample
attack data or false zero is substituted for missing observations.

Protection/block changes are audited. Evidence never automatically changes model inputs,
existing risk scores or infrastructure availability. New node alerts prepare an assessment
using the existing model and What-If engine, creating the first Aurora baseline only if
absent. Exact run/fingerprint guards reject mismatches; no silent baseline switch occurs.
Supported applicable access/segmentation actions are calculated; monitoring stays a
recommendation. No CVE patch is inferred from generic traffic. Projections do not repair
the demo service or execute remediation. The existing Resilience Planner remains separate.

When a projection is ready, What-If opens automatically from SOC Overview; its checkbox
disables auto-opening. Map inspection/other workflows are not interrupted. Critical/high
events show an in-app alert globally. Desktop alerts require **Enable desktop alerts**
and browser permission; no prompt occurs automatically. IDs are deduplicated, bursts group
for 10 seconds, and historical snapshots do not trigger alerts. All events remain logged.
Evidence inspection offers **Assess this event with the model** for retained alerts.

The map uses the same live provider. Red marks confirmed fictional disclosure/weak login;
orange marks attempts or actual directed neighbours requiring review. Node descriptions
explain evidence/edge lineage. Cyber adjacency is not compromise, and an operational
dependency is conditional, not an observed outage. The overlay covers the loaded window;
enabling protection does not erase historical evidence. Model risk remains a separate
relative scenario priority, not a calibrated probability learned from these requests.

## Additive API contracts

Operator-only routes under `/api/v1/soc`:

- POST /session (local bootstrap), DELETE /session (revoke own session).
- GET /snapshot (evidence, profiles, blocks, gateway readiness).
- GET /events?after=ID (SSE; Last-Event-ID, gap and expiry handling).
- GET /logs?before=ID&limit=N (bounded history).
- POST /blocks {ip, reason, minutes}; POST /unblock {ip}.
- POST /nodes/{asset}/protection {protected}.
- POST /analyze {event_id, scenario_id, snapshot_id, run_id, baseline_fingerprint}.

Schemas are additive in `app/schemas/soc.py`. OpenAPI and frontend types are regenerated.
The gateway has a separate target-only API. Original risk/impact models are unchanged.

## Verification and remaining limits

Earlier full backend regression: 280 passed in 305.02s. The final connected batch verified
70 distinct selected backend tests across SOC, incident analysis and remediation suites;
79 frontend tests, typecheck and build pass. Actual saved-model examples: WTR-005 asset
risk 10.0, city index 35.62 → 35.62; PWR-001 asset risk 97.29, city 35.62 → 33.14.
No change is fabricated when the model predicts no benefit. Exact commands, durations,
inherited formatting issues and browser limitations are recorded in VERIFICATION.md.

A real TCP client bound to this machine's private NIC (10.120.134.189) reached the node
gateway, generated a recorded fictional-row disclosure, received 403 after blocking even
with a forged forwarding header, regained 200 after unblock and received no disclosure
after protection. Original profile/block state was restored. Control calls exercised the
real ASGI API in-process against the shared store. This was NOT a physical second-laptop
or browser test; no source IP was spoofed through headers.

Browser verification is pending: saved browser permission policy continued to reject
inspection of localhost:8005 even after the user approved and opened the page. No alternate
browser, CDP or rendering workaround was used. A combined documentation/probe command was
also rejected by execution policy without detailed reason; it was not retried. Documentation
uses file edits; unexecuted script/network probes are not claimed as passed.

No physical second-device connectivity, visual/mobile/WCAG browser verification, production
hardening, public deployment, verified physical recovery or SSH compromise is claimed.
The Windows launcher was exercised; the second-device helper still needs its physical run.
