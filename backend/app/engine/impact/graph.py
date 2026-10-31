"""Operational-dependency view. Cyber reachability edges are never read here."""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

import networkx as nx

from app.engine.impact.policy import ImpactInputError, ImpactPolicy
from app.schemas.models import ScenarioBundle


@dataclass(frozen=True, slots=True)
class DependencyGroup:
    """Providers whose loss can stop one dependent.

    A required edge is its own group of one. Redundant edges with the same dependent,
    dependency type and redundancy group form a k-of-n group: it fails once fewer than
    ``required_providers`` providers remain.
    """

    dependent: str
    dependency: str
    provider_ids: tuple[str, ...]
    edge_ids: tuple[str, ...]
    required_providers: int
    grace_minutes: int


class OperationalView:
    def __init__(self, bundle: ScenarioBundle, policy: ImpactPolicy) -> None:
        self.asset_types = {a.id: a.asset_type for a in bundle.assets}
        self.graph = nx.MultiDiGraph()
        self.graph.add_nodes_from(sorted(self.asset_types))
        # Backup edges are kept for inspection but never relieve a cascade: their activation
        # delay and duration live on service requirements (see README, limitation 2).
        self.cascade_graph = nx.MultiDiGraph()
        self.cascade_graph.add_nodes_from(sorted(self.asset_types))
        for edge in sorted(bundle.operational_edges, key=lambda e: e.id):
            self.graph.add_edge(edge.source_asset_id, edge.target_asset_id, key=edge.id)
            if edge.requirement != "backup":
                self.cascade_graph.add_edge(edge.source_asset_id, edge.target_asset_id, key=edge.id)
        self.groups = self._build_groups(bundle)
        self.functions = self._build_functions(bundle, policy)

    @staticmethod
    def _build_groups(bundle: ScenarioBundle) -> dict[str, tuple[DependencyGroup, ...]]:
        by_dependent: dict[str, list[DependencyGroup]] = defaultdict(list)
        redundant: dict[tuple[str, str, str | None], list] = defaultdict(list)
        for edge in sorted(bundle.operational_edges, key=lambda e: e.id):
            if edge.requirement == "required":
                by_dependent[edge.target_asset_id].append(
                    DependencyGroup(
                        dependent=edge.target_asset_id,
                        dependency=edge.dependency,
                        provider_ids=(edge.source_asset_id,),
                        edge_ids=(edge.id,),
                        required_providers=1,
                        grace_minutes=edge.grace_period_minutes,
                    )
                )
            elif edge.requirement == "redundant":
                key = (edge.target_asset_id, edge.dependency, edge.redundancy_group)
                redundant[key].append(edge)
        for (dependent, dependency, group_name), edges in sorted(
            redundant.items(), key=lambda item: (item[0][0], item[0][1], item[0][2] or "")
        ):
            providers = tuple(sorted({e.source_asset_id for e in edges}))
            required = max(e.minimum_providers for e in edges)
            if required > len(providers):
                raise ImpactInputError(
                    f"Redundancy group {group_name or '(ungrouped)'} for {dependent} needs "
                    f"{required} providers but only {len(providers)} exist"
                )
            by_dependent[dependent].append(
                DependencyGroup(
                    dependent=dependent,
                    dependency=dependency,
                    provider_ids=providers,
                    edge_ids=tuple(sorted(e.id for e in edges)),
                    required_providers=required,
                    grace_minutes=min(e.grace_period_minutes for e in edges),
                )
            )
        return {dependent: tuple(groups) for dependent, groups in by_dependent.items()}

    def _build_functions(
        self, bundle: ScenarioBundle, policy: ImpactPolicy
    ) -> dict[str, frozenset[str]]:
        provided: dict[str, set[str]] = defaultdict(set)
        for edge in bundle.operational_edges:
            provided[edge.source_asset_id].add(edge.dependency)
        return {
            asset_id: frozenset(provided[asset_id])
            if provided.get(asset_id)
            else policy.leaf_functions.get(asset_type, frozenset())
            for asset_id, asset_type in self.asset_types.items()
        }

    def downstream(self, asset_ids: Iterable[str]) -> set[str]:
        """Assets reachable by dependency edges. Reachability is not failure."""
        reached: set[str] = set()
        for asset_id in asset_ids:
            reached |= nx.descendants(self.cascade_graph, asset_id)
        return reached

    def dependency_cycles(self) -> tuple[tuple[str, ...], ...]:
        components = [
            tuple(sorted(c))
            for c in nx.strongly_connected_components(self.cascade_graph)
            if len(c) > 1
        ]
        return tuple(sorted(components))
