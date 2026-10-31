"""Deterministic attack-path analysis over the cyber reachability graph. See README.md.

Reachability is not exploitability. Every hop is assessed from stated evidence (authentication,
protocol, vulnerability evidence) and ends in one of: plausible, conditional, insufficient
evidence, not supported, or blocked. Nothing is assumed exploitable because a connection exists.
"""

from collections import defaultdict
from collections.abc import Callable, Sequence
from itertools import islice

import networkx as nx

from app.engine.attack_path.models import (
    METHOD_VERSION,
    AnalysisConfig,
    AssetFacts,
    AttackGraphInput,
    AttackPath,
    AttackPathAnalysis,
    ChokePoint,
    Consequence,
    CyberEdgeFacts,
    HopAssessment,
    HopStatus,
    PathStatus,
    ServiceConsequence,
    TargetReachability,
    VulnerabilityEvidence,
)

ENGINE_VERSION = METHOD_VERSION
INTERNET = "internet"
# Ordinal weights used only to order paths; they are not probabilities.
HOP_WEIGHT = {"plausible": 0.9, "conditional": 0.4, "insufficient_evidence": 0.2}
PATH_ORDER = {"plausible": 0, "conditional": 1, "insufficient_evidence": 2}
CRITICALITY_WEIGHT = {"essential": 3, "important": 2, "supporting": 1}
TRAVERSABLE: tuple[HopStatus, ...] = ("plausible", "conditional", "insufficient_evidence")
MAX_CANDIDATE_PATHS = 200

ConsequenceLookup = Callable[[str, str], Sequence[tuple[str, float]]]


class AttackPathInputError(ValueError):
    pass


def _validate(data: AttackGraphInput, config: AnalysisConfig) -> dict[str, AssetFacts]:
    assets = {a.id: a for a in data.assets}
    if len(assets) != len(data.assets):
        raise AttackPathInputError("Duplicate asset identifier")
    if len({e.id for e in data.edges}) != len(data.edges):
        raise AttackPathInputError("Duplicate edge identifier")
    for edge in data.edges:
        for end in (edge.source, edge.target):
            if end not in assets:
                raise AttackPathInputError(f"Edge {edge.id} references unknown asset {end}")
    for label, ids in (("entry point", config.entry_points), ("target", config.targets)):
        for asset_id in ids or ():
            if asset_id not in assets:
                raise AttackPathInputError(f"Unknown {label} {asset_id}")
    return assets


def _assess(
    source: str,
    asset: AssetFacts,
    edge: CyberEdgeFacts | None,
    evidence: VulnerabilityEvidence | None,
    config: AnalysisConfig,
) -> HopAssessment:
    """Judge whether `source` could plausibly move onto `asset`. edge None = initial access."""
    level = evidence.level if evidence else "unavailable"
    if edge is None:
        access = "remote_management" if asset.remote_access else "network"
        protocol = None
        lead = f"Initial access to {asset.id} from the internet"
    else:
        access, protocol = edge.access, edge.protocol
        lead = f"{source} → {asset.id} over {edge.protocol} ({edge.access.replace('_', ' ')})"
    unauthenticated = (
        edge is not None
        and access == "network"
        and edge.protocol.lower() in config.unauthenticated_protocols
    )
    kev = evidence.kev_listed if evidence and evidence.kev_listed is not None else 0
    applicable = evidence.applicable_cves if evidence and evidence.applicable_cves else 0

    status: HopStatus
    basis: list[str]
    if level == "kev_listed":
        status, basis = "plausible", ["kev_listed_vulnerability"]
        why = f"{asset.id} has {kev} applicable vulnerabilit{'y' if kev == 1 else 'ies'} listed as known exploited (CISA KEV)"
    elif access == "remote_management" and asset.mfa_enabled is False:
        status, basis = "plausible", ["remote_management_without_mfa"]
        why = f"{asset.id} accepts remote management without multi-factor authentication"
    elif unauthenticated:
        status, basis = "plausible", ["protocol_without_native_authentication"]
        why = f"{edge.protocol if edge else ''} has no native authentication (scenario assumption)"
    elif level == "high_priority":
        status, basis = "conditional", ["high_priority_vulnerability"]
        why = (
            f"{asset.id} has applicable vulnerabilities the ML model ranks in its top "
            f"{(1 - config.high_priority_percentile) * 100:.0f}%, none known exploited"
        )
    elif access == "local_trust":
        status, basis = "conditional", ["trust_relationship"]
        why = f"depends on abusing a trust relationship with {source}; no evidence it is weak"
    elif level == "candidates":
        status, basis = "conditional", ["applicable_unlisted_vulnerabilities"]
        why = f"{asset.id} has {applicable} applicable vulnerabilities, none known exploited"
    elif level == "unavailable" or (access == "remote_management" and asset.mfa_enabled is None):
        status, basis = "insufficient_evidence", []
        if level == "unavailable":
            basis.append("vulnerability_evidence_unavailable")
        if access == "remote_management" and asset.mfa_enabled is None:
            basis.append("mfa_status_unknown")
        why = "cannot be judged: " + " and ".join(b.replace("_", " ") for b in basis)
    else:
        status, basis = "not_supported", []
        if level == "none_applicable":
            basis.append("no_applicable_vulnerabilities")
        if asset.mfa_enabled:
            basis.append("mfa_enabled")
        why = "connected, but no evidence of a weakness: " + (
            ", ".join(b.replace("_", " ") for b in basis) or "nothing found"
        )
    return HopAssessment(
        edge_id=edge.id if edge else None,
        source=source,
        target=asset.id,
        protocol=protocol,
        access=access if edge else None,
        status=status,
        basis=tuple(basis),
        effects=edge.possible_effects if edge else (),
        explanation=f"{lead}: {status.replace('_', ' ')}; {why}.",
    )


def _best_hop(hops: list[HopAssessment]) -> HopAssessment:
    order = {"plausible": 0, "conditional": 1, "insufficient_evidence": 2, "not_supported": 3}
    return min(hops, key=lambda h: (order[h.status], h.edge_id or ""))


class AttackPathEngine:
    def __init__(self, consequence: ConsequenceLookup | None = None) -> None:
        self._consequence = consequence

    def analyze(
        self, data: AttackGraphInput, config: AnalysisConfig | None = None
    ) -> AttackPathAnalysis:
        config = config or AnalysisConfig()
        assets = _validate(data, config)
        evidence = {e.asset_id: e for e in data.evidence}
        isolated = set(data.controls.isolated_assets)
        notes: list[str] = []

        # Plain reachability graph: blocked edges and isolated assets cannot be traversed.
        edges = sorted(
            (
                e
                for e in data.edges
                if e.id not in data.controls.blocked_edges
                and e.source not in isolated
                and e.target not in isolated
            ),
            key=lambda e: e.id,
        )
        graph = nx.DiGraph()
        graph.add_nodes_from(sorted(a for a in assets if a not in isolated))
        by_pair: dict[tuple[str, str], list[CyberEdgeFacts]] = defaultdict(list)
        for edge in edges:
            by_pair[(edge.source, edge.target)].append(edge)
        for pair in sorted(by_pair):
            graph.add_edge(*pair)

        entries = self._entries(assets, config, isolated)
        unknown_exposure = tuple(
            sorted(
                a.id
                for a in assets.values()
                if a.internet_exposed is None and a.id not in isolated and a.id not in entries
            )
        )
        if unknown_exposure:
            notes.append("Internet exposure is unknown for: " + ", ".join(unknown_exposure) + ".")
        targets = self._targets(assets, config, isolated, set(entries))
        if not data.evidence:
            notes.append("No vulnerability evidence supplied: hops rely on configuration only.")

        # Assess every traversable step once. Assessment depends only on the edge and its target.
        hop_of: dict[tuple[str, str], HopAssessment] = {}
        for (source, target), parallel in by_pair.items():
            hop_of[(source, target)] = _best_hop(
                [_assess(source, assets[target], e, evidence.get(target), config) for e in parallel]
            )
        entry_hop = {
            e: _assess(INTERNET, assets[e], None, evidence.get(e), config) for e in entries
        }
        live = [e for e in entries if entry_hop[e].status in TRAVERSABLE]
        for entry in entries:
            if entry_hop[entry].status == "not_supported":
                notes.append(f"Initial access to {entry} is not supported by the evidence.")

        # Subgraph of steps that are not ruled out.
        supported = nx.DiGraph()
        supported.add_nodes_from(graph.nodes)
        for pair, hop in hop_of.items():
            if hop.status in TRAVERSABLE:
                supported.add_edge(*pair)

        paths: list[AttackPath] = []
        reach: list[TargetReachability] = []
        for target in targets:
            candidates = self._paths_for(
                target, entries, live, graph, supported, hop_of, entry_hop, assets, config
            )
            reachable = any(nx.has_path(graph, e, target) for e in entries if e != target)
            verdict = (
                "supported_path"
                if candidates
                else "reachable_without_supported_path"
                if reachable
                else "unreachable"
            )
            reach.append(
                TargetReachability(
                    target=target,
                    reachable=reachable,
                    supported_paths=len(candidates),
                    verdict=verdict,
                )
            )
            paths.extend(candidates[: config.max_paths_per_target])

        paths.sort(key=lambda p: _order(p, assets))
        ranked = tuple(p.model_copy(update={"rank": i + 1}) for i, p in enumerate(paths))
        ranked = tuple(self._with_consequence(p) for p in ranked)
        chokes = self._chokepoints(ranked, supported, live, targets, assets)
        return AttackPathAnalysis(
            method_version=METHOD_VERSION,
            entry_points=tuple(entries),
            targets=tuple(targets),
            unknown_exposure_assets=unknown_exposure,
            paths=ranked,
            chokepoints=chokes,
            target_reachability=tuple(reach),
            notes=tuple(notes),
        )

    # ------------------------------------------------------------------ selection

    @staticmethod
    def _entries(
        assets: dict[str, AssetFacts], config: AnalysisConfig, isolated: set[str]
    ) -> list[str]:
        if config.entry_points is not None:
            return sorted(a for a in config.entry_points if a not in isolated)
        return sorted(
            a.id for a in assets.values() if a.internet_exposed is True and a.id not in isolated
        )

    @staticmethod
    def _targets(
        assets: dict[str, AssetFacts], config: AnalysisConfig, isolated: set[str], entries: set[str]
    ) -> list[str]:
        if config.targets is not None:
            return sorted(t for t in config.targets if t not in isolated)
        # Security-critical: essential service assets and every controller.
        return sorted(
            a.id
            for a in assets.values()
            if a.id not in isolated
            and a.id not in entries
            and (a.criticality == "essential" or a.asset_type == "controller")
        )

    # ------------------------------------------------------------------ paths

    def _paths_for(
        self,
        target: str,
        entries: list[str],
        live: list[str],
        graph: nx.DiGraph,
        supported: nx.DiGraph,
        hop_of: dict[tuple[str, str], HopAssessment],
        entry_hop: dict[str, HopAssessment],
        assets: dict[str, AssetFacts],
        config: AnalysisConfig,
    ) -> list[AttackPath]:
        out: list[AttackPath] = []
        for entry in live:
            if entry == target or not nx.has_path(supported, entry, target):
                continue
            generator = nx.shortest_simple_paths(supported, entry, target)
            for nodes in islice(generator, MAX_CANDIDATE_PATHS):
                if len(nodes) - 1 > config.max_hops:
                    break
                hops = (
                    entry_hop[entry],
                    *(hop_of[(a, b)] for a, b in zip(nodes, nodes[1:], strict=False)),
                )
                out.append(self._path(entry, target, tuple(nodes), hops, assets))
        out.sort(key=lambda p: _order(p, assets))
        return out

    @staticmethod
    def _path(
        entry: str,
        target: str,
        nodes: tuple[str, ...],
        hops: tuple[HopAssessment, ...],
        assets: dict[str, AssetFacts],
    ) -> AttackPath:
        status: PathStatus = max((h.status for h in hops), key=lambda s: PATH_ORDER[s])  # type: ignore[arg-type,assignment]
        score = 1.0
        for hop in hops:
            score *= HOP_WEIGHT[hop.status]
        weakest = max(range(len(hops)), key=lambda i: (PATH_ORDER[hops[i].status], -i))
        last = hops[-1]
        summary = (
            f"{' → '.join((INTERNET, *nodes))}: {status.replace('_', ' ')}. "
            f"Weakest step: {hops[weakest].explanation}"
        )
        return AttackPath(
            rank=0,
            entry_point=entry,
            target=target,
            nodes=nodes,
            hops=hops,
            status=status,
            ranking_score=round(score, 6),
            weakest_hop=weakest,
            final_effects=last.effects,
            consequence=None,
            explanation=summary,
        )

    def _with_consequence(self, path: AttackPath) -> AttackPath:
        """Attach the operational consequence of the target. Reporting only; never traversal."""
        if self._consequence is None or not path.final_effects:
            return path
        best: Consequence | None = None
        for effect in path.final_effects:
            services = tuple(
                ServiceConsequence(service_id=s, disruption_fraction=f)
                for s, f in sorted(self._consequence(path.target, effect))
            )
            worst = max((s.disruption_fraction for s in services), default=0.0)
            candidate = Consequence(effect=effect, services=services, max_disruption=worst)
            if best is None or candidate.max_disruption > best.max_disruption:
                best = candidate
        return path.model_copy(update={"consequence": best})

    # ------------------------------------------------------------------ choke points

    @staticmethod
    def _chokepoints(
        paths: tuple[AttackPath, ...],
        supported: nx.DiGraph,
        live: list[str],
        targets: list[str],
        assets: dict[str, AssetFacts],
    ) -> tuple[ChokePoint, ...]:
        through: dict[str, int] = defaultdict(int)
        for path in paths:
            for node in path.nodes[1:-1]:
                through[node] += 1
        reachable_targets = sorted({p.target for p in paths})
        cuts: dict[str, list[str]] = defaultdict(list)
        for node in sorted(through):
            pruned = supported.copy()
            pruned.remove_node(node)
            for target in reachable_targets:
                if target == node:
                    continue
                if not any(
                    e in pruned and nx.has_path(pruned, e, target) for e in live if e != node
                ):
                    cuts[node].append(target)
        items = [
            ChokePoint(
                asset_id=node,
                name=assets[node].name,
                paths_through=through[node],
                targets_cut=tuple(cuts.get(node, ())),
            )
            for node in through
        ]
        items.sort(key=lambda c: (-len(c.targets_cut), -c.paths_through, c.asset_id))
        return tuple(items)


def _order(path: AttackPath, assets: dict[str, AssetFacts]) -> tuple:
    return (
        PATH_ORDER[path.status],
        -path.ranking_score,
        -CRITICALITY_WEIGHT[assets[path.target].criticality],
        len(path.nodes),
        path.nodes,
    )
