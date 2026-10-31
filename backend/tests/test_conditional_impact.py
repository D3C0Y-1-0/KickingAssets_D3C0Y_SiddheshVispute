import pytest
from impact_support import FIXED_NOW, backup, bundle, edge, primary, service

from app.domain.seed import make_bundle
from app.engine.impact import ConditionalImpactEngine, ImpactInputError, ImpactPolicy
from app.engine.impact.graph import OperationalView
from app.schemas.models import ImpactResult

UN, LC, LV, DI = "unavailability", "loss_of_control", "loss_of_visibility", "data_integrity"


def make_engine(**policy):
    return ConditionalImpactEngine(ImpactPolicy(**policy), clock=lambda: FIXED_NOW)


def fraction(engine, scenario, effects, service_id="svc"):
    (result,) = [r for r in engine.simulate(scenario, effects) if r.service_id == service_id]
    return result.disruption_fraction


def detail(engine, scenario, initiators, service_id="svc"):
    analysis = engine.analyze(scenario, initiators)
    return next(s for s in analysis.services if s.service_id == service_id)


@pytest.fixture
def chain():
    return bundle(
        ["A", "B", "C"],
        [edge("A", "B"), edge("B", "C")],
        [service("svc", [primary("r", ["C"])])],
    )


def test_required_chain_fails_downstream_dependents(chain):
    engine = make_engine()
    assert fraction(engine, chain, {"A": UN}) == 1.0
    analysis = engine.analyze(chain, {"A": UN})
    assert {a: loss.cascade_lost_at for a, loss in analysis.cascade.items()} == {
        "A": float("inf"),
        "B": 0,
        "C": 0,
    }
    assert detail(engine, chain, {"A": UN}).affected_asset_ids == ("C",)


def test_grace_period_delays_loss_by_exactly_the_grace():
    scenario = bundle(
        ["A", "B", "C"],
        [edge("A", "B", grace=30), edge("B", "C")],
        [service("svc", [primary("r", ["C"])])],
    )
    result = detail(make_engine(), scenario, {"A": UN})
    assert result.requirements[0].fails_at_minutes == 30
    assert result.disrupted_minutes == 1410
    assert result.disruption_fraction == 0.979167


def test_redundant_providers_absorb_one_loss_but_not_two():
    scenario = bundle(
        ["P1", "P2", "B"],
        [
            edge("P1", "B", "power", "redundant", group="g"),
            edge("P2", "B", "power", "redundant", group="g"),
        ],
        [service("svc", [primary("r", ["B"])])],
    )
    engine = make_engine()
    assert fraction(engine, scenario, {"P1": UN}) == 0.0
    assert detail(engine, scenario, {"P1": UN}).affected_asset_ids == ()
    assert detail(engine, scenario, {"P1": UN, "P2": UN}).disruption_fraction == 1.0


def test_k_of_n_service_group_threshold():
    scenario = bundle(
        ["M1", "M2", "M3"], [], [service("svc", [primary("r", ["M1", "M2", "M3"], minimum=2)])]
    )
    engine = make_engine()
    assert fraction(engine, scenario, {"M1": UN}) == 0.0
    assert detail(engine, scenario, {"M1": UN, "M2": UN}).disruption_fraction == 1.0


def test_descendants_are_not_failures():
    scenario = bundle(
        ["P1", "P2", "B", "C"],
        [
            edge("P1", "B", "power", "redundant", group="g"),
            edge("P2", "B", "power", "redundant", group="g"),
            edge("B", "C"),
        ],
        [service("svc", [primary("r", ["C"])])],
    )
    view = OperationalView(scenario, ImpactPolicy())
    assert view.downstream({"P1"}) == {"B", "C"}
    analysis = make_engine().analyze(scenario, {"P1": UN})
    assert set(analysis.cascade) == {"P1"}


@pytest.fixture
def backed_up():
    return bundle(
        ["X", "S"],
        [],
        [service("svc", [primary("r", ["X"]), backup("b", ["S"], "r")])],
        types={"S": "backup"},
    )


def test_backup_covers_unavailability_after_delay_for_finite_duration(backed_up):
    result = detail(make_engine(), backed_up, {"X": UN})
    assert result.requirements[0].disrupted_intervals == ((0, 5), (245, 1440))
    assert result.disrupted_minutes == 1200
    assert result.disruption_fraction == 0.833333
    assert result.requirements[0].backups[0].window == (5, 245)


@pytest.mark.parametrize("effect", [LC, DI])
def test_backup_cannot_repair_control_or_data_compromise(backed_up, effect):
    result = detail(make_engine(), backed_up, {"X": effect})
    assert result.disruption_fraction == 1.0
    assert result.requirements[0].backups[0].status == "effect_not_covered"


def test_backup_window_is_cut_by_the_horizon(backed_up):
    result = detail(make_engine(horizon_minutes=200), backed_up, {"X": UN})
    assert result.disrupted_minutes == 5
    assert result.disruption_fraction == 0.025


def test_activation_delay_and_duration_are_both_counted():
    scenario = bundle(
        ["X", "S"],
        [],
        [service("svc", [primary("r", ["X"]), backup("b", ["S"], "r", delay=30, duration=100)])],
        types={"S": "backup"},
    )
    result = detail(make_engine(), scenario, {"X": UN})
    assert result.requirements[0].disrupted_intervals == ((0, 30), (130, 1440))
    assert result.disruption_fraction == 0.930556


def test_compromised_backup_provides_nothing(backed_up):
    result = detail(make_engine(), backed_up, {"X": UN, "S": UN})
    assert result.requirements[0].backups[0].status == "backup_unavailable"
    assert result.disruption_fraction == 1.0


def test_backup_only_substitutes_its_named_requirement():
    scenario = bundle(
        ["X", "Y", "S"],
        [],
        [
            service(
                "svc",
                [primary("r1", ["X"]), primary("r2", ["Y"]), backup("b", ["S"], "r1")],
            )
        ],
        types={"S": "backup"},
    )
    result = detail(make_engine(), scenario, {"Y": UN})
    assert result.requirements[1].backups == ()
    assert result.disruption_fraction == 1.0


def test_cycle_terminates_and_never_self_fails():
    scenario = bundle(
        ["A", "B", "C", "D"],
        [edge("A", "B"), edge("B", "A"), edge("C", "A")],
        [service("svc", [primary("r", ["B"])])],
    )
    engine = make_engine()
    analysis = engine.analyze(scenario, {"C": UN})
    assert analysis.cycles == (("A", "B"),)
    assert {a for a, loss in analysis.cascade.items() if loss.cascade_lost_at == 0} == {"A", "B"}
    assert engine.analyze(scenario, {"D": UN}).cascade.keys() == {"D"}


def test_loss_of_visibility_is_a_negative_control(chain):
    engine = make_engine()
    analysis = engine.analyze(chain, {"A": LV})
    assert analysis.cascade == {}
    assert fraction(engine, chain, {"A": LV}) == 0.0
    (result,) = engine.simulate(chain, {"A": LV})
    assert any("operator awareness" in line for line in result.assumptions)


def test_service_without_requirements_is_unavailable_not_zero():
    scenario = bundle(["A"], [], [service("svc", [])])
    (result,) = make_engine().simulate(scenario, {"A": UN})
    assert result.status == "unavailable"
    assert result.disruption_fraction is None


def test_inputs_are_validated():
    scenario = bundle(["A", "B"], [], [service("svc", [primary("r", ["A"])])])
    engine = make_engine()
    with pytest.raises(ImpactInputError):
        engine.simulate(scenario, {"missing": UN})
    with pytest.raises(ImpactInputError):
        engine.simulate(scenario, {"A": "explodes"})
    infeasible = bundle(
        ["P", "B"],
        [edge("P", "B", "power", "redundant", group="g", minimum=2)],
        [service("svc", [primary("r", ["B"])])],
    )
    with pytest.raises(ImpactInputError):
        engine.simulate(infeasible, {"P": UN})
    with pytest.raises(ImpactInputError):
        ImpactPolicy(horizon_minutes=0)


def test_results_are_deterministic_immutable_and_schema_valid():
    scenario = make_bundle()
    before = scenario.model_dump(mode="json")
    effects = {"WTR-008": UN, "PWR-007": LC}
    first = make_engine().simulate(scenario, effects)
    assert first == make_engine().simulate(scenario, effects)
    assert scenario.model_dump(mode="json") == before
    assert len(first) == 2 * len(scenario.services)
    assert [(r.initiating_asset_id, r.service_id) for r in first] == sorted(
        (r.initiating_asset_id, r.service_id) for r in first
    )
    assert all(isinstance(r, ImpactResult) and r.status == "computed" for r in first)
    assert all(r.calculated_at == FIXED_NOW and r.state == "current" for r in first)
    projected = ConditionalImpactEngine(state="projected").simulate(scenario, {"WTR-008": UN})
    assert {r.state for r in projected} == {"projected"}


def test_cyber_reachability_never_influences_impact():
    scenario = make_bundle()
    stripped = scenario.model_copy(update={"cyber_edges": []})
    effects = {"WTR-008": UN, "HLT-001": LC}
    assert make_engine().simulate(scenario, effects) == make_engine().simulate(stripped, effects)
    # HLT-001 reaches many assets in the cyber graph but has no operational dependents.
    assert all(
        r.disruption_fraction == 0.0 for r in make_engine().simulate(scenario, {"HLT-001": LC})
    )


def seed_detail(effects, service_id):
    return detail(make_engine(), make_bundle(), effects, service_id)


def test_aurora_control_server_unavailable_backup_helps_directly_but_not_through_cascade():
    water = seed_detail({"WTR-008": UN}, "svc-water")
    control = next(r for r in water.requirements if r.requirement_id == "req-water-control")
    assert control.disrupted_minutes == 1200
    assert control.backups[0].window == (5, 245)
    assert water.fraction_without_cascade == 0.833333
    # The PLCs that lose their required controller take the supply group down with them,
    # and the backup names only the control group.
    supply = next(r for r in water.requirements if r.requirement_id == "req-water-supply")
    assert supply.fails_at_minutes == 0 and supply.backups == ()
    assert water.disruption_fraction == 1.0
    assert seed_detail({"WTR-008": UN}, "svc-healthcare").disruption_fraction == 1.0
    assert seed_detail({"WTR-008": UN}, "svc-power").disruption_fraction == 0.0


def test_aurora_backup_controller_cannot_cure_a_compromised_control_server():
    for service_id, asset_id in [("svc-power", "PWR-008"), ("svc-water", "WTR-008")]:
        covered = seed_detail({asset_id: UN}, service_id)
        compromised = seed_detail({asset_id: LC}, service_id)
        assert covered.fraction_without_cascade == 0.833333
        assert compromised.fraction_without_cascade == 1.0
        control = compromised.requirements[0] if compromised.requirements[0].backups else None
        assert control and control.backups[0].status == "effect_not_covered"


def test_aurora_redundant_power_supply_survives_a_single_loss():
    engine, scenario = make_engine(), make_bundle()
    results = engine.simulate(scenario, {"PWR-007": UN})
    assert all(r.disruption_fraction == 0.0 for r in results)
    power = next(r for r in results if r.service_id == "svc-power")
    assert power.affected_asset_ids == ["PWR-007"]


def test_aurora_joint_loss_of_both_power_sources_is_covered_only_where_a_backup_names_it():
    engine = make_engine()
    joint = {"PWR-007": UN, "PWR-009": UN}
    healthcare = detail(engine, make_bundle(), joint, "svc-healthcare")
    power = next(r for r in healthcare.requirements if r.requirement_id == "req-healthcare-power")
    assert power.backups[0].window == (5, 485)
    assert power.disrupted_minutes == 960
    assert detail(engine, make_bundle(), joint, "svc-water").disruption_fraction == 1.0


def test_aurora_loss_of_visibility_stops_nothing():
    engine, scenario = make_engine(), make_bundle()
    assert engine.analyze(scenario, {"WTR-008": LV}).cascade == {}
    assert all(r.disruption_fraction == 0.0 for r in engine.simulate(scenario, {"WTR-008": LV}))
