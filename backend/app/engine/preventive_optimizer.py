"""Exact bounded service-minute optimization; no ML, risk weights or additive benefits."""

from collections.abc import Callable
from dataclasses import dataclass
from itertools import combinations

from app.schemas.preventive import FailureOutcome, Intervention, OptimizationRequest


@dataclass(frozen=True)
class Selection:
    ids: tuple[str, ...]
    outcome: FailureOutcome
    considered: int
    feasible: int
    exclusions: dict[str, list[str]]


def objective(outcome: FailureOutcome, service_ids: set[str]) -> int:
    return sum(s.disrupted_minutes for s in outcome.services if s.service_id in service_ids)


def totals(actions: list[Intervention]) -> tuple[int, float, float]:
    return (
        sum(a.cost_credits for a in actions),
        sum(a.effort_hours for a in actions),
        sum(a.downtime_hours for a in actions),
    )


def infeasible(actions: list[Intervention], request: OptimizationRequest) -> list[str]:
    cost, effort, downtime = totals(actions)
    reasons = []
    if cost > request.budget_credits:
        reasons.append("budget_exceeded")
    if effort > request.effort_limit_hours:
        reasons.append("effort_exceeded")
    if downtime > request.downtime_limit_hours:
        reasons.append("total_downtime_exceeded")
    if any(a.asset_id in request.excluded_asset_ids for a in actions):
        reasons.append("asset_excluded")
    if request.max_action_downtime_hours is not None and any(
        a.downtime_hours > request.max_action_downtime_hours for a in actions
    ):
        reasons.append("maintenance_window_exceeded")
    return reasons


def optimize_subsets(
    candidates: list[Intervention],
    request: OptimizationRequest,
    evaluate: Callable[[tuple[str, ...]], FailureOutcome],
    service_ids: set[str],
) -> Selection:
    if len(candidates) > 12 or len({a.id for a in candidates}) != len(candidates):
        raise ValueError("Exact optimization needs at most 12 unique candidates")
    candidates = sorted(candidates, key=lambda a: a.id)
    exclusions = {a.id: infeasible([a], request) for a in candidates}
    best = None
    considered = feasible = 0
    for count in range(len(candidates) + 1):
        for subset in combinations(candidates, count):
            considered += 1
            actions = list(subset)
            if infeasible(actions, request):
                continue
            feasible += 1
            ids = tuple(a.id for a in actions)
            outcome = evaluate(ids)
            rank = (objective(outcome, service_ids), *totals(actions), ids)
            if best is None or rank < best[0]:
                best = (rank, ids, outcome)
    assert best is not None  # the empty set is always feasible
    return Selection(best[1], best[2], considered, feasible, exclusions)
