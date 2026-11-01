"""Response shapes for the attacker view, prevention (cheapest cut) and reaction (containment).

Every route, cut and plan is a modelled what-if on assumed products and configured reachability.
Nothing here is observed, and nothing is applied to any system.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ServiceLoss(Frozen):
    service_id: str
    service_name: str
    fraction: float | None  # None = unavailable, never zero


class RouteFrame(Frozen):
    """The state of the city after the attacker has reached this step of the route."""

    step: int
    asset_id: str
    asset_name: str
    effect: str  # assumed effect of controlling this asset (scenario assumption)
    hop_status: str | None  # None for the first step (initial access)
    note: str
    services: tuple[ServiceLoss, ...]
    worst: float | None


class AttackerRoute(Frozen):
    rank: int
    entry_point: str
    target: str
    target_name: str
    status: Literal["plausible", "conditional", "insufficient_evidence"]
    ranking_score: float  # ordinal ranking aid, not a probability
    nodes: tuple[str, ...]
    explanation: str
    frames: tuple[RouteFrame, ...]


class AttackerView(Frozen):
    method_version: str
    entry_points: tuple[str, ...]
    targets: tuple[str, ...]
    routes: tuple[AttackerRoute, ...]  # best route per reachable target
    unreached_targets: tuple[str, ...]
    assumptions: tuple[str, ...]


class CutAsset(Frozen):
    asset_id: str
    name: str
    sector: str
    criticality: str
    role: Literal["entry", "pivot", "target"]
    cost_hours: float
    routes_through: int  # routes of the attacker view that pass through this asset


class CutPlan(Frozen):
    method_version: str
    status: Literal["nothing_to_cut", "cut_found", "cannot_cut"]
    assets: tuple[CutAsset, ...]
    total_hours: float
    isolate_everything_hours: float  # cost of isolating every asset that sits on any route
    routes_before: int
    routes_after: int
    targets_before: int
    targets_after: int
    protected_targets: tuple[str, ...]
    verified_by: str
    assumptions: tuple[str, ...]


class SpreadItem(Frozen):
    asset_id: str
    name: str
    criticality: str
    depth: int
    via: str
    hop_status: str
    explanation: str
    worst_disruption: float | None  # services lost if this asset is taken over (assumed effect)


class ReactionStep(Frozen):
    order: int
    kind: Literal["contain", "block", "watch", "recover"]
    title: str
    detail: str
    assets: tuple[str, ...]
    hours: float | None


class ReactionPlan(Frozen):
    method_version: str
    compromised: str
    compromised_name: str
    spread: tuple[SpreadItem, ...]
    targets_reached: tuple[str, ...]
    isolate_source_disruption: float | None  # worst service loss if the source is switched off
    isolate_source_services: tuple[ServiceLoss, ...]
    block_assets: tuple[CutAsset, ...]
    block_hours: float
    targets_after_block: int
    steps: tuple[ReactionStep, ...]
    assumptions: tuple[str, ...]
