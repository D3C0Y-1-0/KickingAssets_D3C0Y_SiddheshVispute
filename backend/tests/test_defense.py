import itertools

import pytest
from fastapi.testclient import TestClient

from app.engine import defense as engine
from app.engine.attack_path import (
    AnalysisConfig,
    AssetFacts,
    AttackGraphInput,
    AttackPathEngine,
    Controls,
    CyberEdgeFacts,
)
from app.main import create_app
from ml import inference

needs_ml = pytest.mark.skipif(
    not inference.status()["ready"], reason="local reference data or model not available"
)


def asset(id, kind="server", crit="supporting", exposed=False):
    return AssetFacts(
        id=id,
        name=f"{id} name",
        sector="power",
        asset_type=kind,
        criticality=crit,
        network_zone="zone",
        internet_exposed=exposed,
        remote_access=False,
        mfa_enabled=True,
    )


def edge(source, target, protocol="Modbus"):
    return CyberEdgeFacts(
        id=f"{source}>{target}",
        source=source,
        target=target,
        protocol=protocol,
        access="network",
        possible_effects=("loss_of_control",),
    )


def data(assets, edges, isolated=()):
    return AttackGraphInput(
        assets=tuple(assets),
        edges=tuple(edges),
        controls=Controls(isolated_assets=frozenset(isolated)),
    )


# Two entries funnel through B to the essential target T; D is a decoy side branch.
FUNNEL = data(
    [
        asset("E1", exposed=True),
        asset("E2", exposed=True),
        asset("A"),
        asset("B"),
        asset("D"),
        asset("T", kind="controller", crit="essential"),
    ],
    [edge("E1", "A"), edge("E2", "A"), edge("A", "B"), edge("B", "T"), edge("E1", "D")],
)


def test_cheapest_cut_prefers_the_single_shared_pivot_over_both_entries():
    sg = engine.step_graph(FUNNEL)
    cut = engine.min_cut(sg, sg.entries, sg.targets, {})
    assert cut in (frozenset({"A"}), frozenset({"B"}))  # one pivot beats isolating E1 and E2
    after = engine.step_graph(data(FUNNEL.assets, FUNNEL.edges, isolated=cut))
    assert engine.reachable_targets(after, after.entries) == ()
    result = AttackPathEngine().analyze(
        data(FUNNEL.assets, FUNNEL.edges, isolated=cut), AnalysisConfig()
    )
    assert result.paths == ()  # the attack-path engine agrees that no route remains


def test_cut_is_minimum_cost_by_brute_force_and_respects_costs():
    sg = engine.step_graph(FUNNEL)
    costs = {"A": 100.0, "B": 100.0}  # expensive pivots: the cheaper entries must be chosen
    cut = engine.min_cut(sg, sg.entries, sg.targets, costs)
    nodes = [n for n in sg.graph.nodes]

    def feasible(chosen):
        reduced = engine.step_graph(data(FUNNEL.assets, FUNNEL.edges, isolated=chosen))
        return not engine.reachable_targets(reduced, reduced.entries)

    cost = sum(engine.cost_of(n, sg, costs) for n in cut)
    brute = min(
        sum(engine.cost_of(n, sg, costs) for n in combo)
        for size in range(1, 4)
        for combo in itertools.combinations(nodes, size)
        if feasible(set(combo))
    )
    assert cost == pytest.approx(brute)


def test_nothing_to_cut_when_no_route_exists():
    plain = data([asset("E1", exposed=True), asset("T", kind="controller", crit="essential")], [])
    sg = engine.step_graph(plain)
    assert engine.min_cut(sg, sg.entries, sg.targets, {}) == frozenset()


def test_source_that_is_locked_and_a_target_cannot_be_cut():
    sg = engine.step_graph(FUNNEL)
    assert engine.min_cut(sg, ("T",), ("T",), {}, locked=frozenset({"T"})) == frozenset()
    assert engine.min_cut(sg, ("E1",), ("T",), {}, locked=frozenset({"E1", "A", "B", "T"})) is None


def test_spread_orders_waves_and_never_includes_the_source():
    sg = engine.step_graph(FUNNEL)
    reached = engine.spread(sg, ("E1",))
    by_asset = {r.asset_id: r.depth for r in reached}
    assert by_asset == {"A": 1, "D": 1, "B": 2, "T": 3}
    assert "E1" not in by_asset
    assert engine.reachable_targets(sg, ("E1",)) == ("T",)
    assert engine.reachable_targets(sg, ("D",)) == ()  # D connects to nothing onward


def test_isolated_assets_leave_the_step_graph():
    sg = engine.step_graph(data(FUNNEL.assets, FUNNEL.edges, isolated={"B"}))
    assert "B" not in sg.graph
    assert engine.reachable_targets(sg, ("E1",)) == ()


def test_routes_are_deterministic():
    first = engine.spread(engine.step_graph(FUNNEL), ("E1",))
    second = engine.spread(engine.step_graph(FUNNEL), ("E1",))
    assert first == second


def client(tmp_path):
    return TestClient(create_app(tmp_path / "defense.sqlite3"))


def test_defense_endpoints_need_a_simulation_run(tmp_path):
    with client(tmp_path) as c:
        for path in ("attacker", "prevention"):
            assert c.get(f"/api/v1/defense/{path}").status_code == 409
        assert c.get("/api/v1/defense/reaction", params={"asset": "PWR-001"}).status_code == 409


@needs_ml
def test_defense_end_to_end_on_the_aurora_run(tmp_path):
    with client(tmp_path) as c:
        ctx = {"scenario_id": "aurora-city", "snapshot_id": "aurora-baseline-v1"}
        assert c.post("/api/v1/simulation/run", params=ctx).status_code == 200
        attacker = c.get("/api/v1/defense/attacker").json()
        plan = c.get("/api/v1/defense/prevention").json()
        reaction = c.get("/api/v1/defense/reaction", params={"asset": "PWR-001"}).json()
        unknown = c.get("/api/v1/defense/reaction", params={"asset": "NOPE-1"})
    assert unknown.status_code == 404
    for route in attacker["routes"]:
        assert route["frames"][0]["asset_id"] == route["entry_point"]
        assert route["frames"][-1]["asset_id"] == route["target"]
        # Taking over more assets never reduces the worst service loss.
        worsts = [f["worst"] for f in route["frames"] if f["worst"] is not None]
        assert worsts == sorted(worsts)
    if plan["status"] == "cut_found":
        assert plan["routes_after"] == 0 and plan["targets_after"] == 0
        assert plan["total_hours"] <= plan["isolate_everything_hours"]
    assert reaction["compromised"] == "PWR-001"
    assert reaction["steps"][0]["kind"] == "contain"
    assert reaction["steps"][-1]["kind"] == "recover"
    assert reaction["targets_after_block"] == 0 or not reaction["block_assets"]
