"""Attacker routes, cheapest cut and containment over the cyber reachability graph. Pure; no I/O.

Everything here reads the same hop assessments as the attack-path engine, so a step is only
traversable when the evidence does not rule it out. A route is a *plausible* path on paper, never
proof that an attacker succeeded. The cheapest cut is an exact minimum-cost set of assets to
segment away (a minimum vertex cut found by max-flow); the hop cap of the route enumerator is not
applied, so the cut is conservative. Operational dependencies are not used to move an attacker.
"""

from collections import defaultdict
from dataclasses import dataclass

import networkx as nx

from app.engine.attack_path.engine import (
    TRAVERSABLE,
    AttackPathEngine,
    _assess,
    _best_hop,
)
from app.engine.attack_path.models import (
    AnalysisConfig,
    AssetFacts,
    AttackGraphInput,
    CyberEdgeFacts,
    HopAssessment,
)

ENGINE_VERSION = "defense-v1"
SEGMENTATION_HOURS = 24.0
_BIG = 1e9
STATUS_ORDER = {"plausible": 0, "conditional": 1, "insufficient_evidence": 2}
# Tie-breakers so equal-cost cuts prefer pivots over entry points over the targets themselves.
_ROLE_PENALTY = {"pivot": 0.0, "entry": 0.002, "target": 0.01}


@dataclass(frozen=True, slots=True)
class StepGraph:
    """Traversable attacker steps: edges whose assessment is not ruled out by the evidence."""

    graph: nx.DiGraph
    assets: dict[str, AssetFacts]
    entries: tuple[str, ...]  # internet-exposed entry points whose initial access is not ruled out
    targets: tuple[str, ...]


def step_graph(data: AttackGraphInput, config: AnalysisConfig | None = None) -> StepGraph:
    config = config or AnalysisConfig()
    assets = {a.id: a for a in data.assets}
    isolated = set(data.controls.isolated_assets)
    evidence = {e.asset_id: e for e in data.evidence}
    by_pair: dict[tuple[str, str], list[CyberEdgeFacts]] = defaultdict(list)
    for edge in sorted(data.edges, key=lambda e: e.id):
        if (
            edge.id in data.controls.blocked_edges
            or edge.source in isolated
            or edge.target in isolated
        ):
            continue
        by_pair[(edge.source, edge.target)].append(edge)
    graph = nx.DiGraph()
    graph.add_nodes_from(sorted(a for a in assets if a not in isolated))
    for (source, target), parallel in sorted(by_pair.items()):
        hop = _best_hop(
            [_assess(source, assets[target], e, evidence.get(target), config) for e in parallel]
        )
        if hop.status in TRAVERSABLE:
            graph.add_edge(source, target, hop=hop)
    all_entries = AttackPathEngine._entries(assets, config, isolated)
    entries = tuple(
        e
        for e in all_entries
        if _assess("internet", assets[e], None, evidence.get(e), config).status in TRAVERSABLE
    )
    targets = tuple(AttackPathEngine._targets(assets, config, isolated, set(all_entries)))
    return StepGraph(graph, assets, entries, targets)


def reachable_targets(sg: StepGraph, sources: tuple[str, ...]) -> tuple[str, ...]:
    reached: set[str] = set()
    for source in sources:
        if source in sg.graph:
            reached |= nx.descendants(sg.graph, source) | {source}
    return tuple(t for t in sg.targets if t in reached and t not in sources)


def cost_of(
    asset_id: str, sg: StepGraph, costs: dict[str, float], default: float = SEGMENTATION_HOURS
) -> float:
    role = "target" if asset_id in sg.targets else "entry" if asset_id in sg.entries else "pivot"
    return costs.get(asset_id, default) + _ROLE_PENALTY[role]


def min_cut(
    sg: StepGraph,
    sources: tuple[str, ...],
    targets: tuple[str, ...],
    costs: dict[str, float],
    locked: frozenset[str] = frozenset(),
) -> frozenset[str] | None:
    """Cheapest set of assets whose isolation leaves no traversable route from sources to targets.

    `locked` assets cannot be isolated. Returns None if no cut exists (e.g. a source is also a
    target), and an empty set if the targets are already unreachable.
    """
    sources = tuple(s for s in sources if s in sg.graph)
    targets = tuple(t for t in targets if t in sg.graph and t not in sources)
    if not sources or not targets:
        return frozenset()
    flow = nx.DiGraph()
    for node in sg.graph.nodes:
        capacity = _BIG if node in locked else cost_of(node, sg, costs)
        flow.add_edge((node, "in"), (node, "out"), capacity=capacity)
    for u, v in sg.graph.edges:
        flow.add_edge((u, "out"), (v, "in"), capacity=_BIG)
    for s in sources:
        flow.add_edge("S", (s, "in"), capacity=_BIG)
    for t in targets:
        flow.add_edge((t, "out"), "T", capacity=_BIG)
    if not nx.has_path(flow, "S", "T"):
        return frozenset()
    value, (reach, _) = nx.minimum_cut(flow, "S", "T")
    if value >= _BIG:
        return None
    return frozenset(
        node for node in sg.graph.nodes if (node, "in") in reach and (node, "out") not in reach
    )


@dataclass(frozen=True, slots=True)
class Reached:
    asset_id: str
    depth: int
    via: str
    hop: HopAssessment


def spread(sg: StepGraph, sources: tuple[str, ...]) -> tuple[Reached, ...]:
    """Assets an attacker holding `sources` could move onto, in waves of hops. Each asset keeps
    the best-supported step that reaches it first."""
    seen = {s for s in sources if s in sg.graph}
    frontier = sorted(seen)
    out: list[Reached] = []
    depth = 0
    while frontier:
        depth += 1
        found: dict[str, tuple[str, HopAssessment]] = {}
        for node in frontier:
            for nxt in sg.graph.successors(node):
                if nxt in seen:
                    continue
                hop = sg.graph.edges[node, nxt]["hop"]
                best = found.get(nxt)
                if best is None or (STATUS_ORDER[hop.status], node) < (
                    STATUS_ORDER[best[1].status],
                    best[0],
                ):
                    found[nxt] = (node, hop)
        frontier = sorted(found)
        seen.update(found)
        out.extend(Reached(a, depth, found[a][0], found[a][1]) for a in frontier)
    return tuple(out)
