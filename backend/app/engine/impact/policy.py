"""Explicit, versioned effect semantics for conditional impact analysis.

Nothing here is measured. These are modelling assumptions that the engine echoes into every
result so a reader can see exactly what a number is conditional on.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import get_args

from app.engine.contracts import CompromiseEffect

EFFECTS: frozenset[str] = frozenset(get_args(CompromiseEffect))
FUNCTIONS: tuple[str, ...] = ("control", "data", "power", "water", "backup")

_DEFAULT_BREAKING: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        "control": frozenset({"unavailability", "loss_of_control", "data_integrity"}),
        "data": frozenset({"unavailability", "data_integrity"}),
        "power": frozenset({"unavailability", "loss_of_control"}),
        "water": frozenset({"unavailability", "loss_of_control"}),
        "backup": frozenset({"unavailability", "loss_of_control", "data_integrity"}),
    }
)

_DEFAULT_LEAF_FUNCTIONS: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        "gateway": frozenset({"data"}),
        "controller": frozenset({"control"}),
        "workstation": frozenset({"data"}),
        "server": frozenset({"data"}),
        "sensor": frozenset({"data"}),
        "backup": frozenset({"backup"}),
    }
)


class ImpactInputError(ValueError):
    """The requested analysis is not defined for the supplied scenario or assumptions."""


@dataclass(frozen=True, slots=True)
class ImpactPolicy:
    """Which compromise effects stop which operational function.

    breaking_effects: dependency type -> effects after which a provider no longer delivers it.
        loss_of_visibility is deliberately absent everywhere: it removes operator awareness,
        not the asset's operational output.
    leaf_functions: asset type -> functions assumed for an asset with no outgoing operational
        edge, used only to decide whether it can still fill a service requirement.
    backup_covered_effects: effects a standby can cure. Backup power or a spare controller
        replaces something that is unavailable; it cannot repair control or data compromise.
    horizon_minutes: evaluation window. Disruption is the share of it spent unsatisfied,
        assuming no operator recovery.
    """

    breaking_effects: Mapping[str, frozenset[str]] = field(default=_DEFAULT_BREAKING)
    leaf_functions: Mapping[str, frozenset[str]] = field(default=_DEFAULT_LEAF_FUNCTIONS)
    backup_covered_effects: frozenset[str] = frozenset({"unavailability"})
    horizon_minutes: int = 1440

    def __post_init__(self) -> None:
        if self.horizon_minutes <= 0:
            raise ImpactInputError("Horizon must be a positive number of minutes")
        if not self.backup_covered_effects <= EFFECTS:
            raise ImpactInputError("Unknown effect in backup_covered_effects")
        for function, effects in self.breaking_effects.items():
            if function not in FUNCTIONS or not effects <= EFFECTS:
                raise ImpactInputError(f"Invalid breaking effects for {function!r}")
        for asset_type, functions in self.leaf_functions.items():
            if not functions <= set(FUNCTIONS):
                raise ImpactInputError(f"Invalid leaf functions for {asset_type!r}")

    def breaks(self, effect: str, function: str) -> bool:
        return effect in self.breaking_effects.get(function, frozenset())

    def describe_effect(self, effect: str) -> str:
        broken = sorted(f for f in FUNCTIONS if self.breaks(effect, f))
        if not broken:
            return (
                f"{effect}: treated as degrading operator awareness only; it does not stop any "
                "operational dependency or service-requirement membership."
            )
        return (
            f"{effect}: the compromised asset is treated as no longer providing "
            f"{', '.join(broken)}."
        )
