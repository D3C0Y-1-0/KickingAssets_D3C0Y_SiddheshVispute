# Conditional infrastructure impact engine

`ConditionalImpactEngine` implements the `ServiceImpactEngine` protocol (Phase 4, objective 5). Given a validated `ScenarioBundle` and an **assumed** compromise effect on an asset, it answers: which operational dependents and essential services could be disrupted, for how long, and what a backup does or does not cover. It does not predict that a compromise happens, and it does not claim a real-world outage.

## What it reads

- Operational dependency edges (provider → dependent) and service requirement groups.
- Never the cyber reachability graph. Connectivity is not compromise; the effect arrives as an explicit input. A test proves results are identical with all cyber edges removed.
- The bundle is never mutated.

## Model

1. **Initiating effect.** Each asset in `assumed_effects` is evaluated as its own scenario (`simulate`). `analyze` evaluates several initiators jointly.
2. **Effect semantics** (`ImpactPolicy`, echoed in every result's `assumptions`):

   | dependency | stopped by |
   |---|---|
   | control | unavailability, loss_of_control, data_integrity |
   | data | unavailability, data_integrity |
   | power, water | unavailability, loss_of_control |
   | backup | unavailability, loss_of_control, data_integrity |

   `loss_of_visibility` stops nothing: it removes operator awareness, not output (negative control).
3. **Cascade.** Earliest-failure fixed point, no recovery. A required edge fails its dependent after `grace_period_minutes`. Redundant edges with the same dependent, dependency and group fail it once fewer than `minimum_providers` remain, i.e. at the (n−k+1)th provider loss. Reachability is not failure. Cycles terminate and never fail without an external trigger. NetworkX holds the operational graph (descendants, strongly connected components).
4. **Service evaluation.** Primary groups are conjunctive; members use k-of-n. A group fails at its (n−k+1)th member loss. A member's loss uses the functions the asset provides (its outgoing dependency types, or a documented default by asset type for leaf assets).
5. **Backups.** A backup substitutes only the primary group it names, from `failure + activation_delay` for `backup_duration`, only if every responsible root effect is in `backup_covered_effects` (default `{unavailability}`) and the backup group itself is still available. Backup power cannot repair control or data compromise.
6. **Result.** `disruption_fraction` is the share of a horizon (default 1440 min) with at least one primary group unsatisfied, assuming no operator recovery. A service with no primary group yields `status="unavailable"`, never zero. Richer detail (timelines, backup outcomes, explanations, `fraction_without_cascade`) is available from `analyze`.

## Determinism

No randomness. Inputs are sorted everywhere. The only impure input is the injected clock used for `calculated_at`.

## Known limits

1. Cascaded results are an **upper bound** with respect to backups: edge-level backup links do not relieve dependency cascades. `fraction_without_cascade` gives the initiator-only figure.
2. Backup is described twice in the seed (edge: 30 min grace and no duration; requirement: 5 min delay and a finite duration, and the healthcare backup edge targets a different asset than the requirement it substitutes). Requirement-level backup is authoritative.
3. Free-text `activation_condition` is echoed, never parsed.
4. Impact is conditional on the scenario assumptions; population or consequence figures are not computed.

## Proposed shared changes (not made; coordinator decides)

- Add `networkx` to `backend/requirements.txt` and the lock file (currently installed locally only).
- Add an additive `covered_effects` list to backup `ServiceRequirement`, replacing the engine-level default policy.
- Add `horizon_minutes` to `ImpactResult`, so the meaning of `disruption_fraction` is explicit in the contract.
- Decide one representation for backups (edge-level vs requirement-level) and align the seed.
- Optionally add a typed `function` to `ServiceRequirement` to replace the leaf-function defaults.
