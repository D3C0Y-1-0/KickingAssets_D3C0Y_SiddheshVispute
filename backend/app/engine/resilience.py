"""Supply-chain concentration, vendor-compromise scenarios and chokepoints. Pure; no I/O.

Both analyses call the conditional impact engine. They read only the operational dependency
graph and service requirements: connectivity is never treated as compromise, and every effect
is an explicit assumption supplied by the caller.
"""

import math
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.engine.impact import ConditionalImpactEngine
from app.engine.impact.models import ImpactAnalysis
from app.schemas.models import ScenarioBundle

ENGINE_VERSION = "resilience-v1"
CHOKEPOINT_EFFECTS = ("unavailability", "loss_of_control")
FULL = 0.999


@dataclass(frozen=True, slots=True)
class ServiceOutcome:
    service_id: str
    fraction: float | None


@dataclass(frozen=True, slots=True)
class Scenario:
    assets_lost: int
    worst: float | None
    services: tuple[ServiceOutcome, ...]

    def fully_disrupted(self) -> tuple[str, ...]:
        return tuple(s.service_id for s in self.services if (s.fraction or 0.0) >= FULL)


def _scenario(analysis: ImpactAnalysis) -> Scenario:
    lost = 0
    for loss in analysis.cascade.values():
        first = min([*loss.own_lost_at.values(), loss.cascade_lost_at])
        if math.isfinite(first):
            lost += 1
    services = tuple(ServiceOutcome(s.service_id, s.disruption_fraction) for s in analysis.services)
    fractions = [s.fraction for s in services if s.fraction is not None]
    return Scenario(lost, max(fractions) if fractions else None, services)


def service_assets(bundle: ScenarioBundle) -> dict[str, set[str]]:
    """Distinct assets named by each service's requirement groups (primary and backup)."""
    return {s.id: {a for r in s.requirements for a in r.asset_ids} for s in bundle.services}


# ---------------------------------------------------------------------------- vendors (F2)


@dataclass(frozen=True, slots=True)
class VendorResult:
    vendor: str
    assets: tuple[str, ...]
    effects: Mapping[str, str]
    scenario: Scenario
    service_vendor_assets: Mapping[str, int]


@dataclass(frozen=True, slots=True)
class Concentration:
    service_id: str
    hhi: float
    top_vendor: str
    top_share: float


def vendor_scenarios(
    bundle: ScenarioBundle,
    vendors: Mapping[str, str],
    default_effect: Mapping[str, str],
    engine: ConditionalImpactEngine | None = None,
) -> list[VendorResult]:
    """Assume each vendor's update or management channel is compromised: every asset it supplies
    suffers the default effect for its type at the same moment (a joint analysis)."""
    engine = engine or ConditionalImpactEngine()
    types = {a.id: a.asset_type for a in bundle.assets}
    members = service_assets(bundle)
    grouped: dict[str, list[str]] = {}
    for asset_id, vendor in sorted(vendors.items()):
        if asset_id in types:
            grouped.setdefault(vendor, []).append(asset_id)
    results = []
    for vendor, asset_ids in sorted(grouped.items()):
        effects = {a: default_effect[types[a]] for a in asset_ids}
        scenario = _scenario(engine.analyze(bundle, effects))
        touch = {sid: len(set(asset_ids) & ids) for sid, ids in members.items()}
        results.append(VendorResult(vendor, tuple(asset_ids), effects, scenario, touch))
    return sorted(
        results,
        key=lambda r: (
            -(r.scenario.worst if r.scenario.worst is not None else -1.0),
            -r.scenario.assets_lost,
            r.vendor,
        ),
    )


def concentration(bundle: ScenarioBundle, vendors: Mapping[str, str]) -> list[Concentration]:
    """Herfindahl-Hirschman index of vendor shares among each service's mapped assets."""
    out = []
    for service in sorted(bundle.services, key=lambda s: s.id):
        ids = service_assets(bundle)[service.id]
        counts = Counter(vendors[a] for a in ids if a in vendors)
        total = sum(counts.values())
        if total == 0:
            out.append(Concentration(service.id, 0.0, "", 0.0))
            continue
        top_vendor, top = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0]
        hhi = round(sum((c / total) ** 2 for c in counts.values()), 4)
        out.append(Concentration(service.id, hhi, top_vendor, round(top / total, 4)))
    return out


# ------------------------------------------------------------------------- chokepoints (F3)


@dataclass(frozen=True, slots=True)
class ChokepointResult:
    asset_id: str
    direct_dependents: int
    has_backup_edge: bool
    scenarios: Mapping[str, Scenario]

    @property
    def is_chokepoint(self) -> bool:
        return any(s.fully_disrupted() for s in self.scenarios.values())

    @property
    def worst_effect(self) -> str:
        return max(
            self.scenarios,
            key=lambda e: (
                self.scenarios[e].worst if self.scenarios[e].worst is not None else -1.0,
                self.scenarios[e].assets_lost,
                e,
            ),
        )


def chokepoints(
    bundle: ScenarioBundle,
    effects: Sequence[str] = CHOKEPOINT_EFFECTS,
    engine: ConditionalImpactEngine | None = None,
) -> list[ChokepointResult]:
    """Single-asset loss scenarios. A chokepoint fully disrupts at least one service alone."""
    engine = engine or ConditionalImpactEngine()
    dependents: dict[str, set[str]] = {}
    backup: set[str] = set()
    for edge in bundle.operational_edges:
        dependents.setdefault(edge.source_asset_id, set()).add(edge.target_asset_id)
        if edge.requirement == "backup":
            backup.update({edge.source_asset_id, edge.target_asset_id})
    results = []
    for asset in sorted(bundle.assets, key=lambda a: a.id):
        scenarios = {e: _scenario(engine.analyze(bundle, {asset.id: e})) for e in effects}
        results.append(
            ChokepointResult(
                asset.id,
                len(dependents.get(asset.id, ())),
                asset.id in backup,
                scenarios,
            )
        )

    def rank(r: ChokepointResult):
        worst = r.scenarios[r.worst_effect]
        return (
            not r.is_chokepoint,
            -(worst.worst if worst.worst is not None else -1.0),
            -len(worst.fully_disrupted()),
            -worst.assets_lost,
            r.asset_id,
        )

    return sorted(results, key=rank)
