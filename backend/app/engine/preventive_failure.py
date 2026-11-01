"""Deterministic event-time continuity model; no cyber edges or risk scores are read.

Reuses the original operational groups, function/effect policy and service requirements.
The original monotone impact algorithm is untouched. This extension adds restoration,
shared finite standby windows and energy derating, all at integer-minute resolution.
"""

from dataclasses import dataclass
from math import floor

from app.engine.impact.graph import OperationalView
from app.engine.impact.policy import FUNCTIONS, ImpactInputError, ImpactPolicy
from app.schemas.models import ScenarioBundle
from app.schemas.preventive import (
    AssetOutage,
    Failure,
    FailureOutcome,
    Interval,
    ServiceOutcome,
    StandbyOutcome,
)

ENGINE_VERSION = "preventive-continuity-v1"


@dataclass(frozen=True)
class Standby:
    id: str
    service_id: str
    primary_id: str
    members: tuple[str, ...]
    minimum: int
    targets: tuple[str, ...]
    delay: int
    duration: int
    condition: str

    @property
    def key(self):
        return self.service_id, self.id


def standbys(bundle: ScenarioBundle) -> tuple[Standby, ...]:
    result = []
    owners: set[str] = set()
    for service in sorted(bundle.services, key=lambda s: s.id):
        if not any(r.role == "primary" for r in service.requirements):
            raise ImpactInputError(f"Service {service.id} has no primary requirements")
        for req in sorted(service.requirements, key=lambda r: r.id):
            if req.role != "backup":
                continue
            if owners.intersection(req.asset_ids):
                raise ImpactInputError(
                    "Shared standby across multiple requirement groups is unsupported"
                )
            owners.update(req.asset_ids)
            edges = [
                e
                for e in bundle.operational_edges
                if e.requirement == "backup" and e.source_asset_id in req.asset_ids
            ]
            if len({e.target_asset_id for e in edges}) > 1:
                raise ImpactInputError("Multi-target standby capacity allocation is unsupported")
            result.append(
                Standby(
                    req.id,
                    service.id,
                    req.substitutes_requirement_id,
                    tuple(sorted(req.asset_ids)),
                    req.minimum_available,
                    tuple(sorted({e.target_asset_id for e in edges})),
                    max([req.activation_delay_minutes, *(e.grace_period_minutes for e in edges)]),
                    req.backup_duration_minutes,
                    req.activation_condition,
                )
            )
    return tuple(result)


def _append(intervals: list[Interval], start: int, end: int) -> None:
    if intervals and intervals[-1].end_minutes == start:
        intervals[-1] = Interval(start_minutes=intervals[-1].start_minutes, end_minutes=end)
    else:
        intervals.append(Interval(start_minutes=start, end_minutes=end))


def simulate_failures(
    bundle: ScenarioBundle,
    failures: tuple[Failure, ...],
    horizon: int,
    *,
    recovery: dict[str, int] | None = None,
    backup_extension: dict[str, int] | None = None,
    energy: dict[str, float] | None = None,
    disabled_backups: frozenset[str] = frozenset(),
) -> FailureOutcome:
    """All initiating events start at zero; future events are calculated transitions only.

    Capacity is stored-energy fraction at nominal full output, not fractional process
    throughput. A half-capacity standby lasts half as long. Cycles settle from healthy
    state to the greatest available fixed point each event; unsupported self-failure and
    latching after upstream restoration are not introduced.
    """
    if not 1 <= horizon <= 1440:
        raise ImpactInputError("Horizon must be in 1..1440 minutes")
    recovery, backup_extension, energy = recovery or {}, backup_extension or {}, energy or {}
    policy = ImpactPolicy(horizon_minutes=horizon)
    view = OperationalView(bundle, policy)
    profiles = standbys(bundle)
    known = set(view.asset_types)
    if any(f.asset_id not in known for f in failures) or len({f.id for f in failures}) != len(
        failures
    ):
        raise ImpactInputError("Unknown asset or duplicate initiating event")
    backup_ids = {a for p in profiles for a in p.members}
    if not set(energy) <= backup_ids or not disabled_backups <= backup_ids:
        raise ImpactInputError("Unknown standby capacity/failure target")
    if any(not 0 <= value <= 1 for value in energy.values()):
        raise ImpactInputError("Usable energy must be a fraction in [0,1]")
    if any(k not in known or not 1 <= v <= 10080 for k, v in recovery.items()):
        raise ImpactInputError("Invalid restoration assumption")
    if any(k not in backup_ids or v < 0 for k, v in backup_extension.items()):
        raise ImpactInputError("Invalid standby extension")
    by_id = {f.id: f for f in failures}
    deadlines = {
        f.id: min(f.recovery_minutes or horizon, recovery.get(f.asset_id, horizon))
        if f.asset_id not in disabled_backups
        else horizon
        for f in failures
    }
    # Multi-member standbys are conservatively limited by the weakest member's energy.
    durations = {
        p.key: floor(
            (p.duration + min(backup_extension.get(a, 0) for a in p.members))
            * min(energy.get(a, 1.0) for a in p.members)
        )
        for p in profiles
    }
    events = {0, horizon, *(t for t in deadlines.values() if t < horizon)}
    windows: dict[tuple[str, str], tuple[int, int]] = {}
    outages: dict[tuple[str, int], int] = {}
    asset_intervals = {a: [] for a in sorted(known)}
    asset_roots = {a: set() for a in known}
    asset_edges = {a: set() for a in known}
    service_intervals = {s.id: [] for s in bundle.services}
    standby_intervals = {p.key: [] for p in profiles}

    def eligible(roots):
        return bool(roots) and all(
            by_id[r].cause == "power_loss" and by_id[r].effect == "unavailability" for r in roots
        )

    def trigger(p, t):
        if p.key in windows:
            return False
        start = t + p.delay
        windows[p.key] = (start, start + durations[p.key])
        events.update(v for v in windows[p.key] if t < v < horizon)
        return start == t and durations[p.key] > 0

    def settle(t):
        active = [f for f in failures if t < deadlines[f.id]]
        for _restart in range(len(profiles) + 2):
            lost = {(a, fn): set() for a in known for fn in FUNCTIONS}
            edges_by_asset = {a: set() for a in known}

            def member_roots(a, lost=lost):
                return set().union(*(lost[a, fn] for fn in view.functions[a]))

            def available(p):
                window = windows.get(p.key)
                return (
                    window is not None
                    and window[0] <= t < window[1]
                    and sum(not member_roots(a) and a not in disabled_backups for a in p.members)
                    >= p.minimum
                )

            restart = False
            for _iteration in range(len(known) * (len(failures) + 1) * 5 + 2):
                changed = False
                for a in sorted(known):
                    own: dict[str, set[str]] = {fn: set() for fn in FUNCTIONS}
                    for f in active:
                        if f.asset_id != a:
                            continue
                        local = [p for p in profiles if a in p.targets]
                        if eligible({f.id}):
                            for p in local:
                                restart |= trigger(p, t)
                        covered = eligible({f.id}) and any(available(p) for p in local)
                        if not covered:
                            for fn in FUNCTIONS:
                                if policy.breaks(f.effect, fn):
                                    own[fn].add(f.id)
                    cascade_roots = set()
                    for i, group in enumerate(view.groups.get(a, ())):
                        failed = [p for p in group.provider_ids if lost[p, group.dependency]]
                        if len(group.provider_ids) - len(failed) >= group.required_providers:
                            continue
                        start = outages.setdefault((a, i), t)
                        due = start + group.grace_minutes
                        if t < due < horizon:
                            events.add(due)
                        if t < due:
                            continue
                        roots = set().union(*(lost[p, group.dependency] for p in failed))
                        local = [p for p in profiles if a in p.targets]
                        power = group.dependency == "power" and eligible(roots)
                        if power:
                            for p in local:
                                restart |= trigger(p, t)
                        if not (power and any(available(p) for p in local)):
                            cascade_roots.update(roots)
                            edges_by_asset[a].update(group.edge_ids)
                    for fn in FUNCTIONS:
                        roots = own[fn] | cascade_roots
                        if roots - lost[a, fn]:
                            lost[a, fn].update(roots)
                            changed = True
                if restart or not changed:
                    break
            else:
                raise ImpactInputError("Operational fixed point did not converge")
            if restart:
                continue
            services_down = set()
            for service in sorted(bundle.services, key=lambda s: s.id):
                for req in service.requirements:
                    if req.role != "primary":
                        continue
                    failed = [a for a in req.asset_ids if member_roots(a)]
                    if len(req.asset_ids) - len(failed) >= req.minimum_available:
                        continue
                    roots = set().union(*(member_roots(a) for a in failed))
                    backups = [
                        p for p in profiles if p.service_id == service.id and p.primary_id == req.id
                    ]
                    if eligible(roots):
                        for p in backups:
                            restart |= trigger(p, t)
                    if not (eligible(roots) and any(available(p) for p in backups)):
                        services_down.add(service.id)
            if restart:
                continue
            # Clear continuous-deficit timers only after the entire fixed point is stable.
            for a in sorted(known):
                for i, group in enumerate(view.groups.get(a, ())):
                    healthy = sum(not lost[p, group.dependency] for p in group.provider_ids)
                    if healthy >= group.required_providers:
                        outages.pop((a, i), None)
            return (
                {a: member_roots(a) for a in known},
                edges_by_asset,
                services_down,
                {p.key for p in profiles if available(p)},
            )
        raise ImpactInputError("Standby activation did not converge")

    t = 0
    while t < horizon:
        lost, edges, down, available_backups = settle(t)
        end = min(v for v in events if v > t)
        for a, roots in lost.items():
            if roots:
                _append(asset_intervals[a], t, end)
                asset_roots[a].update(roots)
                asset_edges[a].update(edges[a])
        for service_id in down:
            _append(service_intervals[service_id], t, end)
        for key in available_backups:
            _append(standby_intervals[key], t, end)
        t = end
    services = []
    for service_id, intervals in sorted(service_intervals.items()):
        minutes = sum(i.end_minutes - i.start_minutes for i in intervals)
        services.append(
            ServiceOutcome(
                service_id=service_id,
                disrupted_minutes=minutes,
                disruption_fraction=minutes / horizon,
                intervals=intervals,
                restored_at_minutes=intervals[-1].end_minutes
                if intervals and intervals[-1].end_minutes < horizon
                else None,
            )
        )
    return FailureOutcome(
        horizon_minutes=horizon,
        total_service_disruption_minutes=sum(s.disrupted_minutes for s in services),
        services=services,
        asset_outages=[
            AssetOutage(
                asset_id=a,
                intervals=intervals,
                failure_ids=sorted(asset_roots[a]),
                dependency_edge_ids=sorted(asset_edges[a]),
            )
            for a, intervals in sorted(asset_intervals.items())
            if intervals
        ],
        standbys=[
            StandbyOutcome(
                service_id=p.service_id,
                requirement_id=p.id,
                backup_asset_ids=list(p.members),
                activation_condition=p.condition,
                activation_minutes=windows[p.key][0] if p.key in windows else None,
                exhaustion_minutes=windows[p.key][1] if p.key in windows else None,
                usable_duration_minutes=durations[p.key],
                available_intervals=standby_intervals[p.key],
            )
            for p in profiles
        ],
    )
