"""Worst plausible consequence of compromising an asset, joining the two graphs deliberately.

* The cyber reachability graph decides WHICH assets an attacker could pivot to (a configured
  route, never a successful compromise) and which compromise effects are possible there.
* The operational dependency graph, through the conditional impact engine, decides WHAT a
  compromise of that target does to essential services.

The two graphs stay separate; this module only combines their answers.
"""

from collections.abc import Sequence
from dataclasses import dataclass

import networkx as nx

from app.engine.impact import ConditionalImpactEngine
from app.schemas.models import CyberReachabilityEdge, ScenarioBundle

# Scenario assumption: the effect assumed when an attacker controls the asset itself.
DEFAULT_EFFECT = {
    "gateway": "unavailability",
    "controller": "loss_of_control",
    "workstation": "loss_of_control",
    "server": "loss_of_control",
    "sensor": "data_integrity",
    "backup": "unavailability",
}


@dataclass(frozen=True, slots=True)
class WorstCase:
    target_asset_id: str
    effect: str
    path: tuple[str, ...]
    max_disruption: float
    service_fractions: tuple[tuple[str, float], ...]


class PivotImpact:
    def __init__(self, bundle: ScenarioBundle) -> None:
        self.bundle = bundle
        self._engine = ConditionalImpactEngine()
        self._types = {a.id: a.asset_type for a in bundle.assets}
        self._cache: dict[tuple[str, str], tuple[float, tuple[tuple[str, float], ...]]] = {}

    def scenario(self, target: str, effect: str) -> tuple[float, tuple[tuple[str, float], ...]]:
        key = (target, effect)
        if key not in self._cache:
            analysis = self._engine.analyze(self.bundle, {target: effect})
            fractions = tuple(
                (s.service_id, s.disruption_fraction)
                for s in analysis.services
                if s.disruption_fraction is not None
            )
            self._cache[key] = (max((f for _, f in fractions), default=0.0), fractions)
        return self._cache[key]

    def reachable_scenarios(
        self, asset_id: str, cyber_edges: Sequence[CyberReachabilityEdge] | None = None
    ) -> list[tuple[str, str, tuple[str, ...]]]:
        """(target, assumed effect, route) for the asset itself and everything it can reach."""
        edges = self.bundle.cyber_edges if cyber_edges is None else cyber_edges
        graph = nx.DiGraph()
        graph.add_node(asset_id)
        for edge in edges:
            graph.add_edge(edge.source_asset_id, edge.target_asset_id)
        region = {asset_id} | nx.descendants(graph, asset_id)
        incoming: dict[str, set[str]] = {}
        for edge in edges:
            if edge.source_asset_id in region and edge.target_asset_id in region:
                incoming.setdefault(edge.target_asset_id, set()).update(edge.possible_effects)
        out = []
        for target in sorted(region):
            effects = (
                {DEFAULT_EFFECT[self._types[target]]}
                if target == asset_id
                else incoming.get(target, set())
            )
            route = tuple(nx.shortest_path(graph, asset_id, target))
            out.extend((target, effect, route) for effect in sorted(effects))
        return out

    def worst_for(
        self, asset_id: str, cyber_edges: Sequence[CyberReachabilityEdge] | None = None
    ) -> WorstCase | None:
        best: WorstCase | None = None
        for target, effect, route in self.reachable_scenarios(asset_id, cyber_edges):
            worst, fractions = self.scenario(target, effect)
            candidate = WorstCase(target, effect, route, worst, fractions)
            if best is None or _rank(candidate) > _rank(best):
                best = candidate
        return best

    def service_worst(
        self, asset_ids: Sequence[str], cyber_edges: Sequence[CyberReachabilityEdge] | None = None
    ) -> dict[str, tuple[float, str, str]]:
        """Per service: the worst disruption over every initiating asset and reachable scenario,
        as (fraction, initiating asset, effect)."""
        out: dict[str, tuple[float, str, str]] = {}
        for asset_id in asset_ids:
            for target, effect, _ in self.reachable_scenarios(asset_id, cyber_edges):
                for service_id, fraction in self.scenario(target, effect)[1]:
                    best = out.get(service_id)
                    if best is None or fraction > best[0]:
                        out[service_id] = (fraction, asset_id, effect)
        return out


def _rank(case: WorstCase) -> tuple[float, int, str, str]:
    # Higher disruption wins; shorter routes and stable ids break ties deterministically.
    return (case.max_disruption, -len(case.path), case.target_asset_id, case.effect)
