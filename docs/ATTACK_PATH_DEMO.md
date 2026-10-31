# Aurora City attack-path demonstration

Method `attack-path-v1`. Simulated as of **2026-10-01**. Evidence: real NVD/KEV/EPSS data matched to the assumed product versions; topology and configuration are fictional scenario assumptions.

Entry points: HLT-001, PWR-001, WTR-001. Targets: 15 security-critical assets.

## Target reachability

| Target | Reachable | Supported paths | Verdict |
|---|---|---|---|
| HLT-002 | True | 1 | supported_path |
| HLT-003 | True | 1 | supported_path |
| HLT-007 | True | 1 | supported_path |
| HLT-008 | True | 1 | supported_path |
| HLT-009 | True | 1 | supported_path |
| PWR-002 | True | 1 | supported_path |
| PWR-003 | True | 1 | supported_path |
| PWR-007 | True | 1 | supported_path |
| PWR-008 | True | 1 | supported_path |
| PWR-009 | True | 1 | supported_path |
| WTR-002 | True | 1 | supported_path |
| WTR-003 | True | 1 | supported_path |
| WTR-007 | True | 1 | supported_path |
| WTR-008 | True | 1 | supported_path |
| WTR-009 | True | 1 | supported_path |

## Ranked paths (top 6)

1. **internet → HLT-001 → HLT-004 → HLT-008** (plausible, score 0.729)
    - Initial access to HLT-001 from the internet: plausible; HLT-001 has 1 applicable vulnerability listed as known exploited (CISA KEV).
    - HLT-001 → HLT-004 over HTTPS (remote management): plausible; HLT-004 has 39 applicable vulnerabilities listed as known exploited (CISA KEV).
    - HLT-004 → HLT-008 over OPC UA (remote management): plausible; HLT-008 has 73 applicable vulnerabilities listed as known exploited (CISA KEV).
    - Operational consequence if HLT-008 suffers data integrity (dependency graph): svc-healthcare 100%, svc-power 0%, svc-water 0%
2. **internet → PWR-001 → PWR-004 → PWR-008** (plausible, score 0.729)
    - Initial access to PWR-001 from the internet: plausible; PWR-001 has 7 applicable vulnerabilities listed as known exploited (CISA KEV).
    - PWR-001 → PWR-004 over HTTPS (remote management): plausible; PWR-004 has 53 applicable vulnerabilities listed as known exploited (CISA KEV).
    - PWR-004 → PWR-008 over OPC UA (remote management): plausible; PWR-008 has 59 applicable vulnerabilities listed as known exploited (CISA KEV).
    - Operational consequence if PWR-008 suffers data integrity (dependency graph): svc-healthcare 100%, svc-power 100%, svc-water 100%
3. **internet → WTR-001 → WTR-004 → WTR-008** (plausible, score 0.729)
    - Initial access to WTR-001 from the internet: plausible; WTR-001 has 7 applicable vulnerabilities listed as known exploited (CISA KEV).
    - WTR-001 → WTR-004 over HTTPS (remote management): plausible; WTR-004 has 58 applicable vulnerabilities listed as known exploited (CISA KEV).
    - WTR-004 → WTR-008 over OPC UA (remote management): plausible; WTR-008 has 59 applicable vulnerabilities listed as known exploited (CISA KEV).
    - Operational consequence if WTR-008 suffers data integrity (dependency graph): svc-healthcare 100%, svc-power 0%, svc-water 100%
4. **internet → HLT-001 → HLT-004 → HLT-008 → HLT-002** (conditional, score 0.2916)
    - Initial access to HLT-001 from the internet: plausible; HLT-001 has 1 applicable vulnerability listed as known exploited (CISA KEV).
    - HLT-001 → HLT-004 over HTTPS (remote management): plausible; HLT-004 has 39 applicable vulnerabilities listed as known exploited (CISA KEV).
    - HLT-004 → HLT-008 over OPC UA (remote management): plausible; HLT-008 has 73 applicable vulnerabilities listed as known exploited (CISA KEV).
    - HLT-008 → HLT-002 over OPC UA (network): conditional; HLT-002 has 11 applicable vulnerabilities, none known exploited.
    - Operational consequence if HLT-002 suffers loss of control (dependency graph): svc-healthcare 100%, svc-power 0%, svc-water 0%
5. **internet → HLT-001 → HLT-004 → HLT-008 → HLT-003** (conditional, score 0.2916)
    - Initial access to HLT-001 from the internet: plausible; HLT-001 has 1 applicable vulnerability listed as known exploited (CISA KEV).
    - HLT-001 → HLT-004 over HTTPS (remote management): plausible; HLT-004 has 39 applicable vulnerabilities listed as known exploited (CISA KEV).
    - HLT-004 → HLT-008 over OPC UA (remote management): plausible; HLT-008 has 73 applicable vulnerabilities listed as known exploited (CISA KEV).
    - HLT-008 → HLT-003 over OPC UA (network): conditional; HLT-003 has 19 applicable vulnerabilities, none known exploited.
    - Operational consequence if HLT-003 suffers loss of control (dependency graph): svc-healthcare 100%, svc-power 0%, svc-water 0%
6. **internet → HLT-001 → HLT-004 → HLT-008 → HLT-007** (conditional, score 0.2916)
    - Initial access to HLT-001 from the internet: plausible; HLT-001 has 1 applicable vulnerability listed as known exploited (CISA KEV).
    - HLT-001 → HLT-004 over HTTPS (remote management): plausible; HLT-004 has 39 applicable vulnerabilities listed as known exploited (CISA KEV).
    - HLT-004 → HLT-008 over OPC UA (remote management): plausible; HLT-008 has 73 applicable vulnerabilities listed as known exploited (CISA KEV).
    - HLT-008 → HLT-007 over OPC UA (network): conditional; HLT-007 has applicable vulnerabilities the ML model ranks in its top 5%, none known exploited.
    - Operational consequence if HLT-007 suffers loss of control (dependency graph): svc-healthcare 100%, svc-power 0%, svc-water 0%

## Choke points

| Asset | Paths through | Removing it cuts all paths to |
|---|---|---|
| HLT-004 Clinical Engineering Workstation | 5 | HLT-002, HLT-003, HLT-007, HLT-008, HLT-009 |
| PWR-004 Grid Operator Workstation | 5 | PWR-002, PWR-003, PWR-007, PWR-008, PWR-009 |
| WTR-004 Water Operator Workstation | 5 | WTR-002, WTR-003, WTR-007, WTR-008, WTR-009 |
| HLT-008 Hospital Operations Server | 4 | HLT-002, HLT-003, HLT-007, HLT-009 |
| PWR-008 Dispatch Control Server | 4 | PWR-002, PWR-003, PWR-007, PWR-009 |
| WTR-008 Waterworks Control Server | 4 | WTR-002, WTR-003, WTR-007, WTR-009 |

## Effect of isolating PWR-008 (Dispatch Control Server)

Supported paths drop from 15 to 10; power controllers reached through it: PWR-002, PWR-003, PWR-007, PWR-009.
