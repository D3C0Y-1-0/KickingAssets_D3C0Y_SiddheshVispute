import pytest
from impact_support import backup, bundle, edge, primary, service

from app.engine.impact import ConditionalImpactEngine
from app.engine.impact.policy import ImpactInputError
from app.engine.preventive_failure import simulate_failures
from app.schemas.preventive import Failure


def failure(asset="A", cause="hardware_failure", effect="unavailability", recovery=None):
    return Failure(
        id=f"fail-{asset}", asset_id=asset, cause=cause, effect=effect, recovery_minutes=recovery
    )


def minutes(b, failures, horizon=100, **kwargs):
    return simulate_failures(b, tuple(failures), horizon, **kwargs)


def chain(grace=0):
    return bundle(
        ["A", "B", "C"],
        [edge("A", "B", grace=grace), edge("B", "C")],
        [service("svc", [primary("r", ["C"])])],
    )


def standby(delay=5, duration=20, local=False):
    return bundle(
        ["A", "B", "C"],
        [edge("A", "C"), *([edge("B", "A", "backup", "backup")] if local else [])],
        [
            service(
                "svc",
                [primary("r", ["A"]), backup("b", ["B"], "r", delay=delay, duration=duration)],
            )
        ],
        types={"B": "backup"},
    )


def test_recovery_restores_cascade_with_exact_grace_and_intervals():
    result = minutes(chain(30), [failure(recovery=60)])
    assert result.total_service_disruption_minutes == 30
    assert result.services[0].restored_at_minutes == 60
    assert [(i.start_minutes, i.end_minutes) for i in result.services[0].intervals] == [(30, 60)]
    assert result.asset_outages[-1].dependency_edge_ids == ["ops-B-C-control"]


def test_short_failure_within_grace_does_not_cascade():
    assert minutes(chain(30), [failure(recovery=20)]).total_service_disruption_minutes == 0


def test_cycles_do_not_self_fail_or_latch_after_restoration():
    b = bundle(
        ["A", "B"], [edge("A", "B"), edge("B", "A")], [service("svc", [primary("r", ["B"])])]
    )
    assert minutes(b, []).total_service_disruption_minutes == 0
    result = minutes(b, [failure(recovery=20)])
    assert result.total_service_disruption_minutes == 20


def test_redundancy_preserves_one_provider_and_fails_when_both_lost():
    b = bundle(
        ["A", "B", "C"],
        [
            edge("A", "C", requirement="redundant", group="g"),
            edge("B", "C", requirement="redundant", group="g"),
        ],
        [service("svc", [primary("r", ["C"])])],
    )
    assert minutes(b, [failure()]).total_service_disruption_minutes == 0
    assert minutes(b, [failure(), failure("B", recovery=40)]).total_service_disruption_minutes == 40


@pytest.mark.parametrize(
    "effect,expected",
    [("loss_of_control", 100), ("data_integrity", 100), ("loss_of_visibility", 0)],
)
def test_backup_cannot_repair_cyber_integrity_control_or_visibility(effect, expected):
    result = minutes(standby(local=True), [failure(cause="cyber", effect=effect)])
    assert result.total_service_disruption_minutes == expected
    assert result.standbys[0].activation_minutes is None


def test_backup_delay_finite_duration_and_energy_capacity():
    b = standby()
    f = failure(cause="power_loss")
    assert minutes(b, [f]).total_service_disruption_minutes == 80
    assert minutes(b, [f], energy={"B": 0.5}).total_service_disruption_minutes == 90
    assert minutes(b, [f], energy={"B": 0}).total_service_disruption_minutes == 100
    assert minutes(b, [f], backup_extension={"B": 20}).total_service_disruption_minutes == 60


def test_failed_backup_cannot_supply_any_service_and_is_not_implicitly_repaired():
    b = standby(local=True)
    result = minutes(
        b,
        [failure(cause="power_loss"), failure("B")],
        disabled_backups=frozenset({"B"}),
        recovery={"B": 10},
    )
    assert result.total_service_disruption_minutes == 100
    assert result.standbys[0].available_intervals == []


def test_edge_level_backup_prevents_downstream_cascade_but_exhaustion_restarts_grace():
    b = bundle(
        ["A", "B", "C"],
        [edge("A", "C", grace=10), edge("B", "A", "backup", "backup")],
        [service("svc", [primary("r", ["C"]), backup("b", ["B"], "r", delay=0, duration=20)])],
        types={"B": "backup"},
    )
    result = minutes(b, [failure(cause="power_loss")])
    assert result.total_service_disruption_minutes == 70  # backup ends 20; grace expires 30
    assert result.services[0].intervals[0].start_minutes == 30


def test_backup_is_not_refuelled_by_restoration_or_reactivation():
    result = minutes(standby(), [failure(cause="power_loss", recovery=15)])
    assert result.total_service_disruption_minutes == 5
    assert result.standbys[0].exhaustion_minutes == 25


def test_simulation_is_deterministic_immutable_and_does_not_consult_cyber_graph():
    b = chain()
    before = b.model_dump_json()
    f = failure()
    assert minutes(b, [f]) == minutes(b, [f])
    assert b.model_dump_json() == before
    legacy = ConditionalImpactEngine().analyze(b, {"A": "unavailability"})
    assert legacy.services[0].disruption_fraction == 1
    assert minutes(b, [f]).services[0].disruption_fraction == 1


def test_direct_recovery_does_not_bypass_an_unrecovered_provider():
    b = chain()
    result = minutes(b, [failure(), failure("B")], recovery={"B": 10})
    assert result.total_service_disruption_minutes == 100


def test_identical_requirement_ids_in_different_services_do_not_share_energy():
    b = bundle(
        ["A", "B", "C", "D"],
        [],
        [
            service("first", [primary("r", ["A"]), backup("b", ["B"], "r", delay=0, duration=20)]),
            service("second", [primary("r", ["C"]), backup("b", ["D"], "r", delay=0, duration=40)]),
        ],
        types={"B": "backup", "D": "backup"},
    )
    result = minutes(b, [failure("A", cause="power_loss"), failure("C", cause="power_loss")])
    assert [s.disrupted_minutes for s in result.services] == [80, 60]


def test_competing_standby_load_is_rejected_instead_of_assuming_unlimited_capacity():
    b = standby(local=True)
    b = b.model_copy(
        update={
            "operational_edges": [
                *b.operational_edges,
                type(b.operational_edges[0]).model_validate(edge("B", "C", "backup", "backup")),
            ]
        }
    )
    with pytest.raises(ImpactInputError, match="Multi-target"):
        minutes(b, [failure(cause="power_loss")])


@pytest.mark.parametrize(
    "kwargs", [{"horizon": 0}, {"energy": {"X": 0.5}}, {"energy": {"B": float("nan")}}]
)
def test_unsupported_inputs_fail_instead_of_returning_safety(kwargs):
    with pytest.raises(ImpactInputError):
        minutes(standby(), [failure()], **kwargs)
