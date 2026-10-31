"""Typed inputs and outputs of the cyber attack-path engine.

The engine knows only the cyber reachability graph. Operational dependencies are deliberately not
representable here: an attack path can only be built from CyberEdgeFacts.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

METHOD_VERSION = "attack-path-v1"

Effect = Literal["loss_of_control", "loss_of_visibility", "data_integrity", "unavailability"]
Access = Literal["network", "remote_management", "local_trust"]
Criticality = Literal["essential", "important", "supporting"]
# How much real vulnerability evidence exists for an asset's assumed product version.
EvidenceLevel = Literal[
    "kev_listed", "high_priority", "candidates", "none_applicable", "unavailable"
]
HopStatus = Literal["plausible", "conditional", "insufficient_evidence", "not_supported", "blocked"]
PathStatus = Literal["plausible", "conditional", "insufficient_evidence"]


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class AssetFacts(Frozen):
    id: str
    name: str
    sector: str
    asset_type: str
    criticality: Criticality
    network_zone: str
    internet_exposed: bool | None = None  # None = unknown, never assumed False
    remote_access: bool | None = None
    mfa_enabled: bool | None = None


class CyberEdgeFacts(Frozen):
    id: str
    source: str
    target: str
    protocol: str
    access: Access
    possible_effects: tuple[Effect, ...] = ()


class VulnerabilityEvidence(Frozen):
    """What is known about vulnerabilities on one asset. Absence of an entry means unavailable."""

    asset_id: str
    level: EvidenceLevel
    applicable_cves: int | None = None
    kev_listed: int | None = None
    max_priority_percentile: float | None = None
    cve_ids: tuple[str, ...] = ()


class Controls(Frozen):
    """Applied segmentation. Blocked assets and edges cannot be traversed at all."""

    isolated_assets: frozenset[str] = frozenset()
    blocked_edges: frozenset[str] = frozenset()


class AttackGraphInput(Frozen):
    assets: tuple[AssetFacts, ...]
    edges: tuple[CyberEdgeFacts, ...]
    evidence: tuple[VulnerabilityEvidence, ...] = ()
    controls: Controls = Controls()


class AnalysisConfig(Frozen):
    entry_points: tuple[str, ...] | None = None  # default: internet-exposed assets
    targets: tuple[str, ...] | None = None  # default: security-critical assets
    max_hops: int = Field(default=8, ge=1, le=20)
    max_paths_per_target: int = Field(default=5, ge=1, le=50)
    # Protocols with no native authentication (scenario assumption, case-insensitive).
    unauthenticated_protocols: frozenset[str] = frozenset(
        {"modbus", "modbus tcp", "dnp3", "s7comm"}
    )
    high_priority_percentile: float = Field(default=0.95, ge=0, le=1)


class HopAssessment(Frozen):
    edge_id: str | None  # None for the initial-access step from the internet
    source: str
    target: str
    protocol: str | None
    access: Access | None
    status: HopStatus
    basis: tuple[str, ...]
    effects: tuple[Effect, ...] = ()  # effects the connection could give on the target
    explanation: str


class ServiceConsequence(Frozen):
    service_id: str
    disruption_fraction: float


class Consequence(Frozen):
    """Downstream effect of the target, from the operational dependency graph. Reporting only."""

    effect: Effect
    services: tuple[ServiceConsequence, ...]
    max_disruption: float


class AttackPath(Frozen):
    rank: int
    entry_point: str
    target: str
    nodes: tuple[str, ...]
    hops: tuple[HopAssessment, ...]
    status: PathStatus
    ranking_score: float  # ordinal ranking aid, not a probability
    weakest_hop: int  # index into hops of the least-supported step
    final_effects: tuple[Effect, ...]
    consequence: Consequence | None
    explanation: str


class ChokePoint(Frozen):
    asset_id: str
    name: str
    paths_through: int
    targets_cut: tuple[str, ...]  # removing this asset eliminates every analysed path to these


class TargetReachability(Frozen):
    target: str
    reachable: bool  # plain graph reachability from some entry point
    supported_paths: int  # paths that are plausible, conditional or lack evidence
    verdict: Literal["supported_path", "reachable_without_supported_path", "unreachable"]


class AttackPathAnalysis(Frozen):
    method_version: str
    entry_points: tuple[str, ...]
    targets: tuple[str, ...]
    unknown_exposure_assets: tuple[str, ...]
    paths: tuple[AttackPath, ...]
    chokepoints: tuple[ChokePoint, ...]
    target_reachability: tuple[TargetReachability, ...]
    notes: tuple[str, ...]
