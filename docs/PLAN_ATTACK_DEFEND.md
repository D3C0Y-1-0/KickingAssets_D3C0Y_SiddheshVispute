# Plan: Attack & Defend (prevention and reaction)

Branch `live-ui`. Engine `defense-v1`. Builds only on existing engines; `risk-index-v1` and `attack-path-v1` are unchanged.

## Why
The product ranked flaws and listed routes, but prevention (fix plan) and the attacker model (routes) were separate, and nothing told an operator what to do when one asset is taken over.

## Features
1. **Attacker's view** (`GET /api/v1/defense/attacker`): the best plausible route to each critical asset, replayed step by step. After each step the conditional impact engine is run jointly on every asset taken over so far, so the story shows services failing as the attacker advances.
2. **Prevention: cheapest cut** (`GET /api/v1/defense/prevention`): the minimum-cost set of assets to segment so no plausible route reaches a critical asset. Exact (minimum vertex cut by max-flow on a node-split graph, 24 h per asset, ties prefer pivots over entries over targets). Verified by re-running the attack-path engine with those assets isolated. The route enumerator's hop cap is not applied, so the cut is conservative.
3. **Reaction: containment** (`GET /api/v1/defense/reaction?asset=ID`): if that asset were taken over, the waves of assets it could reach, the services lost if it is switched off, the cheapest cut protecting critical assets from it, and an ordered playbook (isolate, block, watch, recover). Recommendations only.

## Rules
Hop assessments are the attack-path engine's, so reachability is never compromise. Cyber and operational graphs stay separate; the operational graph is used only to report consequences. Effects of taking over an asset are the scenario's default per type. Nothing is applied; recovery time is not modelled. Endpoints return 409 until a simulation has run; an unknown asset is 404.

## Files
`app/engine/defense.py`, `app/schemas/defense.py`, `app/services/defense.py`, `app/api/defense.py`, `tests/test_defense.py`; frontend `features/defense`, `hooks/defense.ts`, nav entry `/defend`.

## Measured on Aurora City
Cutting HLT-004, PWR-004 and WTR-004 (72 h) removes all 15 plausible routes; isolating every asset on a route would cost 504 h. Tests: 9 in `test_defense.py` (brute-force cost check, engine agreement, determinism, 409/404); full suite 150 passed.

## Status
- [x] Engine, schemas, service, API, tests
- [x] Frontend page, coverage row
- [ ] Deployed and checked in the browser (see HANDOFF.md)
