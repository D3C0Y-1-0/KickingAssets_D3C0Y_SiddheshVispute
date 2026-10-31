"""Engine-internal result types. The shared ImpactResult schema is produced from these."""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

NEVER = math.inf

Origin = Literal["initiating", "cascade"]


@dataclass(frozen=True, slots=True)
class AssetLoss:
    """When an asset stops providing each function, and why. Times are minutes after onset."""

    asset_id: str
    own_effect: str | None
    own_lost_at: Mapping[str, float]
    cascade_lost_at: float
    cascade_roots: frozenset[str]
    cascade_edge_ids: tuple[str, ...]

    def lost_at(self, function: str) -> float:
        return min(self.own_lost_at.get(function, NEVER), self.cascade_lost_at)

    def member_loss(self, functions: frozenset[str]) -> tuple[float, frozenset[str], Origin]:
        """Earliest loss across the functions an asset provides, with the responsible effects."""
        own = min((self.own_lost_at.get(f, NEVER) for f in functions), default=NEVER)
        earliest = min(own, self.cascade_lost_at)
        if earliest == NEVER:
            return NEVER, frozenset(), "cascade"
        roots: set[str] = set()
        if own == earliest and self.own_effect is not None:
            roots.add(self.own_effect)
        if self.cascade_lost_at == earliest:
            roots |= self.cascade_roots
        return earliest, frozenset(roots), "initiating" if own == earliest else "cascade"


@dataclass(frozen=True, slots=True)
class BackupOutcome:
    requirement_id: str
    status: Literal["active_window", "effect_not_covered", "backup_unavailable", "not_needed"]
    reason: str
    window: tuple[int, int] | None
    activation_condition: str | None


@dataclass(frozen=True, slots=True)
class RequirementOutcome:
    requirement_id: str
    minimum_available: int
    member_count: int
    fails_at_minutes: int | None
    lost_member_ids: tuple[str, ...]
    responsible_effects: tuple[str, ...]
    backups: tuple[BackupOutcome, ...]
    disrupted_intervals: tuple[tuple[int, int], ...]
    disrupted_minutes: int


@dataclass(frozen=True, slots=True)
class ServiceImpactDetail:
    service_id: str
    status: Literal["computed", "unavailable"]
    unavailable_reason: str | None
    horizon_minutes: int
    disrupted_minutes: int
    disruption_fraction: float | None
    fraction_without_cascade: float | None
    requirements: tuple[RequirementOutcome, ...]
    affected_asset_ids: tuple[str, ...]
    explanation: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ImpactAnalysis:
    initiators: tuple[tuple[str, str], ...]
    cascade: Mapping[str, AssetLoss]
    cycles: tuple[tuple[str, ...], ...]
    services: tuple[ServiceImpactDetail, ...]
