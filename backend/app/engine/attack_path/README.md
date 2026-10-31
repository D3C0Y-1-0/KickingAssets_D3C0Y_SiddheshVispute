# Cyber attack-path engine (`attack-path-v1`)

Finds, assesses and ranks plausible routes from internet-exposed entry points to
security-critical assets over the **cyber reachability graph only**. It never reads the
operational dependency graph to move an attacker; that graph is used afterwards, and only to
report what a compromised target would do to services.

## Separation of graphs

* `AttackGraphInput` accepts `CyberEdgeFacts` only. Operational edges cannot be expressed in it;
  `adapter.from_bundle` drops them. A test removes all cyber edges and confirms no path remains.
* `AttackPathEngine(consequence=...)` optionally takes a lookup `(target, effect) -> services`.
  `adapter.consequence_lookup` wires it to the conditional impact engine. The result is attached to
  a path as `consequence`, as reporting. It is never traversed.

## Inputs (typed, frontend independent)

| Type | Meaning |
|---|---|
| `AssetFacts` | id, sector, type, criticality, zone, `internet_exposed`, `remote_access`, `mfa_enabled` (None = unknown) |
| `CyberEdgeFacts` | directed `source -> target`, protocol, access (`network`, `remote_management`, `local_trust`), possible effects |
| `VulnerabilityEvidence` | per asset level: `kev_listed`, `high_priority`, `candidates`, `none_applicable`, `unavailable` |
| `Controls` | applied segmentation: isolated assets, blocked edges (removed from the graph) |
| `AnalysisConfig` | entry points, targets, `max_hops`, `max_paths_per_target`, unauthenticated protocols, high-priority percentile |

`adapter.evidence_from_run` builds evidence from a simulation run: version-matched KEV count,
ML priority percentile of the top candidates, applicable CVE count. A known product with no
applicable CVE is `none_applicable` (evidence of absence); an unknown product is `unavailable`.
The ML model is only read, never changed.

## Algorithm

1. Build a `networkx.DiGraph` from non-blocked cyber edges (sorted by id, so results do not depend
   on input order). Isolated assets leave the graph.
2. **Entry points**: assets with `internet_exposed is True`. Assets whose exposure is unknown are
   listed in `unknown_exposure_assets` and are not assumed exposed.
3. **Targets**: essential-criticality assets and all controllers (or the configured list).
4. **Assess each step once.** A step "attacker moves onto asset T over edge E" depends only on E and
   T. First matching rule wins:

   | Status | Rule |
   |---|---|
   | plausible | T has applicable KEV-listed vulnerabilities |
   | plausible | `remote_management` access and T has MFA disabled |
   | plausible | `network` access over a protocol with no native authentication (Modbus, DNP3, S7comm by default) |
   | conditional | T has applicable vulnerabilities in the ML top 5% (none known exploited) |
   | conditional | `local_trust` access (needs a trust relationship to be abused) |
   | conditional | T has applicable vulnerabilities, none known exploited |
   | insufficient_evidence | no vulnerability evidence for T, or remote management with unknown MFA |
   | not_supported | connected, but nothing evidences a weakness (no applicable CVEs and/or MFA on) |

   Initial access from the internet to an entry uses the same rules (remote access counts as
   `remote_management`). Parallel edges use the strongest rule.
5. **Reachability vs plausibility.** Plain reachability uses all non-blocked edges. Paths are
   enumerated (`shortest_simple_paths`, hop cap) only over steps that are not `not_supported`. Per
   target the verdict is `supported_path`, `reachable_without_supported_path` (connected but no
   evidenced weakness) or `unreachable`.
6. **Path status** = weakest step: plausible < conditional < insufficient_evidence. A path with an
   unknown step is never reported as plausible.
7. **Ranking** (documented, lexicographic): path status; then `ranking_score` (product of step
   weights plausible 0.9, conditional 0.4, insufficient 0.2: an ordinal aid, **not a
   probability**); then target criticality; then fewer hops; then node ids.
8. **Choke points**: for each intermediate asset on a supported path, remove it from the graph of
   not-ruled-out steps and test whether every entry can still reach each target. `targets_cut`
   lists targets for which it is a true cut; `paths_through` counts reported paths.
9. Every hop carries `basis` codes and a sentence explaining the verdict; the path explanation
   quotes its weakest step.

## Limitations

* Evidence is coarse. KEV or ML evidence is not tied to an attack vector (network vs local) because
  the CVE attack vector is not part of the evidence summary, so a KEV-listed local-only flaw can
  make a hop "plausible". Treat results as prioritization, not proof of exploitability.
* Firewall rules, protocol versions and credential reuse are not modelled; authentication is
  judged from `mfa_enabled`, access type and a protocol list that is a scenario assumption.
* "Plausible" never means an attack happened. Configured reachability is not compromise.
* Choke points are exact for the supported-step graph, ignoring the hop cap.
* Aurora City has no cross-sector cyber links, so cross-sector behaviour is covered by synthetic
  tests only.
* Paths are simple (no repeated node); at most 200 candidates per entry/target are expanded.

## Reproducible demonstration

```powershell
.\.venv\Scripts\python.exe scripts/demo_attack_paths.py --write docs/ATTACK_PATH_DEMO.md
```

Needs the local reference data and trained model. The output is deterministic (two runs are
byte-identical); the committed `docs/ATTACK_PATH_DEMO.md` is the output as of the Aurora snapshot.

## API

`GET /api/v1/simulation/attack-paths?isolate=PWR-008&max_paths_per_target=5` analyses the latest
simulation run (409 until one exists). `isolate` repeats per asset and models segmentation as a
what-if; the response is `AttackPathAnalysis` (models in `models.py`, used directly as the OpenAPI
response model, so the generated TypeScript types include them).

## Integration requirements (for the coordinator)

No UI was added. The route reuses `evidence_from_run` -> `from_bundle` -> `AttackPathEngine`. If the
coordinator wants these models under `schemas/`, move `models.py` there and re-export it, then
regenerate OpenAPI and the TypeScript client. Segmentation actions from the what-if stage map
directly to `Controls.isolated_assets`.
