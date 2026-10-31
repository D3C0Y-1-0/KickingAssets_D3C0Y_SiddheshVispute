"""Earliest-failure propagation over operational dependencies.

Failure is monotone (no recovery), so each asset's loss time only ever decreases and the
iteration reaches a least fixed point. A cycle with no external failure never fails by itself.
"""

import math
from collections.abc import Mapping
from dataclasses import dataclass, field

from app.engine.impact.graph import DependencyGroup, OperationalView
from app.engine.impact.models import NEVER, AssetLoss
from app.engine.impact.policy import FUNCTIONS, ImpactPolicy


@dataclass(slots=True)
class _State:
    own_effect: str | None = None
    own_lost_at: dict[str, float] = field(default_factory=dict)
    cascade_lost_at: float = NEVER
    cascade_roots: frozenset[str] = frozenset()
    cascade_edge_ids: tuple[str, ...] = ()

    def lost_at(self, function: str) -> float:
        return min(self.own_lost_at.get(function, NEVER), self.cascade_lost_at)

    def roots_at(self, function: str) -> frozenset[str]:
        own = self.own_lost_at.get(function, NEVER)
        earliest = min(own, self.cascade_lost_at)
        roots: set[str] = set()
        if own == earliest and self.own_effect is not None:
            roots.add(self.own_effect)
        if self.cascade_lost_at == earliest:
            roots |= self.cascade_roots
        return frozenset(roots)


def propagate(
    view: OperationalView,
    policy: ImpactPolicy,
    initiators: Mapping[str, str],
    *,
    cascade: bool = True,
) -> dict[str, AssetLoss]:
    state: dict[str, _State] = {}
    for asset_id, effect in sorted(initiators.items()):
        state[asset_id] = _State(
            own_effect=effect,
            own_lost_at={f: 0.0 if policy.breaks(effect, f) else NEVER for f in FUNCTIONS},
        )
    if cascade:
        candidates = sorted(view.downstream(initiators))
        limit = (len(candidates) + 2) * (len(candidates) + 2)
        for _ in range(limit):
            if not _relax(view, state, candidates):
                break
        else:  # pragma: no cover - monotone decrease over a finite time set always converges
            raise RuntimeError("Cascade failed to converge")
    return {
        asset_id: AssetLoss(
            asset_id=asset_id,
            own_effect=s.own_effect,
            own_lost_at=dict(s.own_lost_at),
            cascade_lost_at=s.cascade_lost_at,
            cascade_roots=s.cascade_roots,
            cascade_edge_ids=s.cascade_edge_ids,
        )
        for asset_id, s in sorted(state.items())
        if any(math.isfinite(s.lost_at(f)) for f in FUNCTIONS)
    }


def _relax(view: OperationalView, state: dict[str, _State], candidates: list[str]) -> bool:
    changed = False
    for dependent in candidates:
        found = _failure_time(view.groups.get(dependent, ()), state)
        if found is None:
            continue
        time, roots, edge_ids = found
        current = state.setdefault(dependent, _State())
        if time < current.cascade_lost_at:
            current.cascade_lost_at = time
            current.cascade_roots = roots
            current.cascade_edge_ids = edge_ids
            changed = True
        elif time == current.cascade_lost_at and (
            roots - current.cascade_roots or set(edge_ids) - set(current.cascade_edge_ids)
        ):
            current.cascade_roots |= roots
            current.cascade_edge_ids = tuple(sorted({*current.cascade_edge_ids, *edge_ids}))
            changed = True
    return changed


def _failure_time(
    groups: tuple[DependencyGroup, ...], state: dict[str, _State]
) -> tuple[float, frozenset[str], tuple[str, ...]] | None:
    best: tuple[float, set[str], set[str]] | None = None
    for group in groups:
        losses = sorted(
            (_provider_loss(state, provider, group.dependency), provider)
            for provider in group.provider_ids
        )
        # With n providers and k needed, the group fails at the (n - k + 1)th provider loss.
        trigger_time = losses[len(losses) - group.required_providers][0]
        if math.isinf(trigger_time):
            continue
        time = trigger_time + group.grace_minutes
        roots: set[str] = set()
        for loss_time, provider in losses:
            if loss_time <= trigger_time:
                roots |= state[provider].roots_at(group.dependency)
        if best is None or time < best[0]:
            best = (time, roots, set(group.edge_ids))
        elif time == best[0]:
            best[1].update(roots)
            best[2].update(group.edge_ids)
    if best is None:
        return None
    return best[0], frozenset(best[1]), tuple(sorted(best[2]))


def _provider_loss(state: dict[str, _State], provider: str, function: str) -> float:
    provider_state = state.get(provider)
    return NEVER if provider_state is None else provider_state.lost_at(function)
