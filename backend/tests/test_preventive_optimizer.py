"""Hand-calculable service-minute objective, including a synergy greedy would miss."""

from impact_support import bundle, primary, service

from app.engine.preventive_failure import simulate_failures
from app.engine.preventive_optimizer import optimize_subsets
from app.schemas.preventive import Failure, Intervention, OptimizationRequest


def problem(**limits):
    b = bundle(
        ["A", "B", "C"],
        [],
        [service("joint", [primary("r", ["A", "B"], 2)]), service("small", [primary("r2", ["C"])])],
    )
    failures = tuple(
        Failure(
            id=a, asset_id=a, cause="hardware_failure", recovery_minutes=20 if a == "C" else None
        )
        for a in ("A", "B", "C")
    )
    actions = [
        Intervention(
            id=a,
            asset_id=a,
            action_type="recovery",
            cost_credits=5 if a == "C" else 4,
            effort_hours=8.0,
            downtime_hours=1.0,
            recovery_minutes=10 if a == "C" else 60,
            preconditions=["Synthetic unit-test restoration"],
            modelled_effect="restore",
            evidence_ids=[a],
        )
        for a in ("A", "B", "C")
    ]
    request = OptimizationRequest(
        scenario_id="unit",
        snapshot_id="unit-v1",
        run_id="test",
        baseline_fingerprint="a" * 32,
        catalog_fingerprint="b" * 64,
        scenario={"horizon_minutes": 120, "failures": list(failures)},
        intervention_ids=[a.id for a in actions],
        **({"budget_credits": 8, "effort_limit_hours": 16.0, "downtime_limit_hours": 2.0} | limits),
    )

    def evaluate(ids):
        return simulate_failures(
            b,
            failures,
            120,
            recovery={a.asset_id: a.recovery_minutes for a in actions if a.id in ids},
        )

    return actions, request, evaluate


def test_exact_optimizer_selects_joint_benefit_instead_of_better_standalone_ratio():
    actions, req, evaluate = problem()
    # A/B alone do not improve the joint service; C alone improves ten minutes.
    assert evaluate(("A",)).total_service_disruption_minutes == 140
    assert evaluate(("C",)).total_service_disruption_minutes == 130
    selected = optimize_subsets(actions, req, evaluate, {"joint", "small"})
    assert selected.ids == ("A", "B")
    assert selected.outcome.total_service_disruption_minutes == 80
    assert selected.considered == 8


def test_zero_budget_retains_empty_feasible_plan_and_baseline():
    actions, req, evaluate = problem(budget_credits=0)
    selected = optimize_subsets(actions, req, evaluate, {"joint", "small"})
    assert selected.ids == () and selected.feasible == 1
    assert selected.outcome.total_service_disruption_minutes == 140


def test_exclusion_effort_total_and_per_action_downtime_are_all_enforced():
    for limit in (
        {"excluded_asset_ids": ["A"]},
        {"effort_limit_hours": 8.0},
        {"downtime_limit_hours": 1.0},
    ):
        actions, req, evaluate = problem(**limit)
        selected = optimize_subsets(actions, req, evaluate, {"joint", "small"})
        assert selected.ids == ("C",)
    actions, req, evaluate = problem(max_action_downtime_hours=0.5)
    assert optimize_subsets(actions, req, evaluate, {"joint", "small"}).ids == ()


def test_service_selection_and_deterministic_tie_break_do_not_depend_on_candidate_order():
    actions, req, evaluate = problem()
    selected = optimize_subsets(actions[::-1], req, evaluate, {"small"})
    assert selected.ids == ("C",)
    assert selected == optimize_subsets(actions, req, evaluate, {"small"})
