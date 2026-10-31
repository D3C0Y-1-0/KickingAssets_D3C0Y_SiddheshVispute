"""Conditional service evaluation: when each requirement group fails and what a backup covers."""

import math
from collections.abc import Mapping

from app.engine.impact.models import (
    NEVER,
    AssetLoss,
    BackupOutcome,
    RequirementOutcome,
    ServiceImpactDetail,
)
from app.engine.impact.policy import ImpactPolicy
from app.schemas.models import EssentialService, ServiceRequirement

Interval = tuple[int, int]


def evaluate_service(
    service: EssentialService,
    losses: Mapping[str, AssetLoss],
    functions: Mapping[str, frozenset[str]],
    policy: ImpactPolicy,
    *,
    baseline_losses: Mapping[str, AssetLoss] | None = None,
) -> ServiceImpactDetail:
    horizon = policy.horizon_minutes
    primaries = [r for r in service.requirements if r.role == "primary"]
    if not primaries:
        return ServiceImpactDetail(
            service_id=service.id,
            status="unavailable",
            unavailable_reason="Service defines no primary requirement group",
            horizon_minutes=horizon,
            disrupted_minutes=0,
            disruption_fraction=None,
            fraction_without_cascade=None,
            requirements=(),
            affected_asset_ids=(),
            explanation=(),
        )
    outcomes = tuple(
        _evaluate_requirement(service, req, losses, functions, policy) for req in primaries
    )
    disrupted = _merge([i for o in outcomes for i in o.disrupted_intervals])
    minutes = _measure(disrupted)
    direct = None
    if baseline_losses is not None:
        direct_outcomes = [
            _evaluate_requirement(service, req, baseline_losses, functions, policy)
            for req in primaries
        ]
        direct_minutes = _measure(
            _merge([i for o in direct_outcomes for i in o.disrupted_intervals])
        )
        direct = round(direct_minutes / horizon, 6)
    members = sorted({a for req in service.requirements for a in req.asset_ids})
    affected = tuple(a for a in members if _member_loss(losses, functions, a)[0] < horizon)
    return ServiceImpactDetail(
        service_id=service.id,
        status="computed",
        unavailable_reason=None,
        horizon_minutes=horizon,
        disrupted_minutes=minutes,
        disruption_fraction=round(minutes / horizon, 6),
        fraction_without_cascade=direct,
        requirements=outcomes,
        affected_asset_ids=affected,
        explanation=tuple(_explain(service, outcomes, horizon)),
    )


def _member_loss(
    losses: Mapping[str, AssetLoss], functions: Mapping[str, frozenset[str]], asset_id: str
) -> tuple[float, frozenset[str]]:
    loss = losses.get(asset_id)
    if loss is None:
        return NEVER, frozenset()
    time, roots, _ = loss.member_loss(functions.get(asset_id, frozenset()))
    return time, roots


def _group_failure(
    requirement: ServiceRequirement,
    losses: Mapping[str, AssetLoss],
    functions: Mapping[str, frozenset[str]],
) -> tuple[float, tuple[str, ...], frozenset[str]]:
    infos = sorted(
        ((*_member_loss(losses, functions, a), a) for a in requirement.asset_ids),
        key=lambda info: (info[0], info[2]),
    )
    # k-of-n: the group fails at the (n - k + 1)th member loss.
    fails_at = infos[len(infos) - requirement.minimum_available][0]
    if math.isinf(fails_at):
        return NEVER, (), frozenset()
    lost = tuple(a for time, _, a in infos if time <= fails_at)
    roots: set[str] = set()
    for time, member_roots, _ in infos:
        if time <= fails_at:
            roots |= member_roots
    return fails_at, lost, frozenset(roots)


def _evaluate_requirement(
    service: EssentialService,
    requirement: ServiceRequirement,
    losses: Mapping[str, AssetLoss],
    functions: Mapping[str, frozenset[str]],
    policy: ImpactPolicy,
) -> RequirementOutcome:
    horizon = policy.horizon_minutes
    fails_at, lost, roots = _group_failure(requirement, losses, functions)
    backups = [
        r
        for r in service.requirements
        if r.role == "backup" and r.substitutes_requirement_id == requirement.id
    ]
    if math.isinf(fails_at) or fails_at >= horizon:
        return RequirementOutcome(
            requirement_id=requirement.id,
            minimum_available=requirement.minimum_available,
            member_count=len(requirement.asset_ids),
            fails_at_minutes=None,
            lost_member_ids=lost,
            responsible_effects=tuple(sorted(roots)),
            backups=tuple(
                BackupOutcome(
                    b.id,
                    "not_needed",
                    "Primary group holds for the whole horizon",
                    None,
                    b.activation_condition,
                )
                for b in backups
            ),
            disrupted_intervals=(),
            disrupted_minutes=0,
        )
    start = int(fails_at)
    windows: list[Interval] = []
    backup_outcomes: list[BackupOutcome] = []
    for backup in backups:
        outcome, window = _evaluate_backup(backup, start, roots, losses, functions, policy)
        backup_outcomes.append(outcome)
        if window is not None:
            windows.append(window)
    disrupted = _subtract([(start, horizon)], _merge(windows))
    return RequirementOutcome(
        requirement_id=requirement.id,
        minimum_available=requirement.minimum_available,
        member_count=len(requirement.asset_ids),
        fails_at_minutes=start,
        lost_member_ids=lost,
        responsible_effects=tuple(sorted(roots)),
        backups=tuple(backup_outcomes),
        disrupted_intervals=tuple(disrupted),
        disrupted_minutes=_measure(disrupted),
    )


def _evaluate_backup(
    backup: ServiceRequirement,
    primary_failure: int,
    roots: frozenset[str],
    losses: Mapping[str, AssetLoss],
    functions: Mapping[str, frozenset[str]],
    policy: ImpactPolicy,
) -> tuple[BackupOutcome, Interval | None]:
    horizon = policy.horizon_minutes
    uncovered = sorted(roots - policy.backup_covered_effects)
    if uncovered:
        return (
            BackupOutcome(
                backup.id,
                "effect_not_covered",
                f"A standby cannot cure {', '.join(uncovered)}; it only substitutes "
                f"{', '.join(sorted(policy.backup_covered_effects)) or 'nothing'}.",
                None,
                backup.activation_condition,
            ),
            None,
        )
    backup_fails_at, _, _ = _group_failure(backup, losses, functions)
    activation = primary_failure + backup.activation_delay_minutes
    exhausted = activation + (backup.backup_duration_minutes or 0)
    end = min(exhausted, backup_fails_at)
    if end <= activation or activation >= horizon:
        reason = (
            "Backup provider is itself lost before it can activate"
            if backup_fails_at <= activation
            else "Backup activates only after the horizon ends"
        )
        return (
            BackupOutcome(
                backup.id, "backup_unavailable", reason, None, backup.activation_condition
            ),
            None,
        )
    window = (int(activation), int(min(end, horizon)))
    return (
        BackupOutcome(
            backup.id,
            "active_window",
            f"Substitutes from minute {window[0]} to {window[1]} "
            f"(delay {backup.activation_delay_minutes} min, duration "
            f"{backup.backup_duration_minutes} min).",
            window,
            backup.activation_condition,
        ),
        window,
    )


def _merge(intervals: list[Interval]) -> list[Interval]:
    merged: list[Interval] = []
    for start, end in sorted(i for i in intervals if i[1] > i[0]):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def _subtract(intervals: list[Interval], holes: list[Interval]) -> list[Interval]:
    result: list[Interval] = []
    for start, end in intervals:
        cursor = start
        for hole_start, hole_end in holes:
            if hole_end <= cursor or hole_start >= end:
                continue
            if hole_start > cursor:
                result.append((cursor, hole_start))
            cursor = max(cursor, hole_end)
        if cursor < end:
            result.append((cursor, end))
    return result


def _measure(intervals: list[Interval]) -> int:
    return sum(end - start for start, end in intervals)


def _explain(
    service: EssentialService, outcomes: tuple[RequirementOutcome, ...], horizon: int
) -> list[str]:
    lines: list[str] = []
    for outcome in outcomes:
        label = f"{outcome.requirement_id} ({outcome.minimum_available} of {outcome.member_count})"
        if outcome.fails_at_minutes is None:
            lines.append(f"{label} keeps enough providers for the whole {horizon} min horizon.")
            continue
        lines.append(
            f"{label} fails at minute {outcome.fails_at_minutes} after loss of "
            f"{', '.join(outcome.lost_member_ids)} ({', '.join(outcome.responsible_effects)})."
        )
        lines.extend(f"Backup {b.requirement_id}: {b.reason}" for b in outcome.backups)
        lines.append(f"{label} is unsatisfied for {outcome.disrupted_minutes} of {horizon} min.")
    return lines
