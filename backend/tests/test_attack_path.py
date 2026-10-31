import random

import pytest
from fastapi.testclient import TestClient

from app.domain.seed import make_bundle
from app.engine.attack_path import (
    AnalysisConfig,
    AssetFacts,
    AttackGraphInput,
    AttackPathEngine,
    AttackPathInputError,
    Controls,
    CyberEdgeFacts,
    VulnerabilityEvidence,
)
from app.engine.attack_path.adapter import consequence_lookup, evidence_from_run, from_bundle
from app.main import create_app
from ml import inference

needs_ml = pytest.mark.skipif(
    not inference.status()["ready"], reason="local reference data or model not available"
)


def asset(
    id, sector="power", kind="server", crit="supporting", exposed=False, mfa=True, remote=False
):
    return AssetFacts(
        id=id,
        name=f"{id} name",
        sector=sector,
        asset_type=kind,
        criticality=crit,
        network_zone="zone",
        internet_exposed=exposed,
        remote_access=remote,
        mfa_enabled=mfa,
    )


def edge(source, target, access="network", protocol="OPC UA", effects=("loss_of_control",)):
    return CyberEdgeFacts(
        id=f"e-{source}-{target}",
        source=source,
        target=target,
        protocol=protocol,
        access=access,
        possible_effects=effects,
    )


def ev(asset_id, level):
    return VulnerabilityEvidence(
        asset_id=asset_id,
        level=level,
        applicable_cves=0 if level in ("none_applicable", "unavailable") else 3,
        kev_listed=1 if level == "kev_listed" else 0,
    )


def chain(evidence_level="kev_listed", mfa=True):
    """internet -> GW -> WS -> PLC, a single path."""
    return AttackGraphInput(
        assets=(
            asset("GW", kind="gateway", exposed=True, remote=True, mfa=mfa),
            asset("WS", kind="workstation", mfa=mfa),
            asset("PLC", kind="controller", crit="essential", mfa=mfa),
        ),
        edges=(edge("GW", "WS", "remote_management", "HTTPS"), edge("WS", "PLC")),
        evidence=tuple(ev(a, evidence_level) for a in ("GW", "WS", "PLC")),
    )


engine = AttackPathEngine()


# ---------------------------------------------------------------- reachability


def test_reachable_target_gets_an_explained_path():
    result = engine.analyze(chain())
    assert result.entry_points == ("GW",) and result.targets == ("PLC",)
    (path,) = result.paths
    assert path.nodes == ("GW", "WS", "PLC") and path.status == "plausible"
    assert [h.source for h in path.hops] == ["internet", "GW", "WS"]
    assert all("known exploited" in h.explanation for h in path.hops)
    assert path.final_effects == ("loss_of_control",)


def test_unreachable_target_is_reported_not_invented():
    data = chain().model_copy(
        update={"assets": (*chain().assets, asset("ISO", kind="controller", crit="essential"))}
    )
    result = engine.analyze(data)
    verdicts = {t.target: t.verdict for t in result.target_reachability}
    assert verdicts == {"ISO": "unreachable", "PLC": "supported_path"}
    assert all(p.target != "ISO" for p in result.paths)


def test_connections_are_directed():
    # PLC -> WS exists, WS -> PLC does not: an attacker at the gateway cannot go "upstream".
    data = chain().model_copy(
        update={"edges": (edge("GW", "WS", "remote_management"), edge("PLC", "WS"))}
    )
    result = engine.analyze(data)
    assert result.paths == ()
    assert result.target_reachability[0].verdict == "unreachable"
    reverse = engine.analyze(data, AnalysisConfig(entry_points=("PLC",), targets=("WS",)))
    assert reverse.paths and reverse.paths[0].nodes == ("PLC", "WS")


# ---------------------------------------------------------------- segmentation


def test_blocked_edge_removes_the_path():
    data = chain().model_copy(update={"controls": Controls(blocked_edges=frozenset({"e-WS-PLC"}))})
    result = engine.analyze(data)
    assert result.paths == ()
    assert result.target_reachability[0].verdict == "unreachable"


def test_isolated_asset_is_neither_entry_nor_hop_nor_target():
    data = chain().model_copy(update={"controls": Controls(isolated_assets=frozenset({"WS"}))})
    assert engine.analyze(data).paths == ()
    gateway_isolated = chain().model_copy(
        update={"controls": Controls(isolated_assets=frozenset({"GW"}))}
    )
    result = engine.analyze(gateway_isolated)
    assert result.entry_points == () and result.paths == ()


# ---------------------------------------------------------------- authentication


def test_remote_management_without_mfa_is_plausible_without_vulnerabilities():
    result = engine.analyze(chain("none_applicable", mfa=False), AnalysisConfig(targets=("WS",)))
    hop = result.paths[0].hops[1]
    assert hop.status == "plausible" and hop.basis == ("remote_management_without_mfa",)


def test_mfa_and_no_vulnerabilities_means_reachable_but_not_supported():
    result = engine.analyze(chain("none_applicable", mfa=True))
    assert result.paths == ()
    (target,) = result.target_reachability
    assert target.reachable and target.verdict == "reachable_without_supported_path"
    assert any("not supported" in n for n in result.notes)


def test_unauthenticated_protocol_is_plausible_on_network_access():
    data = AttackGraphInput(
        assets=(
            asset("WS", kind="workstation", exposed=True),
            asset("PLC", kind="controller", crit="essential"),
        ),
        edges=(edge("WS", "PLC", "network", "Modbus"),),
        evidence=(ev("WS", "kev_listed"), ev("PLC", "none_applicable")),
    )
    (path,) = engine.analyze(data).paths
    assert path.hops[-1].basis == ("protocol_without_native_authentication",)
    authenticated = data.model_copy(update={"edges": (edge("WS", "PLC", "network", "OPC UA"),)})
    assert engine.analyze(authenticated).paths == ()  # same topology, no evidenced weakness


# ---------------------------------------------------------------- evidence


def test_missing_vulnerability_evidence_is_insufficient_never_exploitable():
    data = chain().model_copy(update={"evidence": ()})
    data = data.model_copy(
        update={"assets": tuple(a.model_copy(update={"mfa_enabled": None}) for a in data.assets)}
    )
    result = engine.analyze(data)
    (path,) = result.paths
    assert path.status == "insufficient_evidence"
    assert {"vulnerability_evidence_unavailable"} <= {b for h in path.hops for b in h.basis}
    assert any("No vulnerability evidence" in n for n in result.notes)


def test_stronger_evidence_ranks_ahead_of_weaker():
    # Two entries lead to the same target: one through a known-exploited asset, one conditional.
    data = AttackGraphInput(
        assets=(
            asset("A", kind="gateway", exposed=True),
            asset("B", kind="gateway", exposed=True),
            asset("M1"),
            asset("M2"),
            asset("T", kind="controller", crit="essential"),
        ),
        edges=(edge("A", "M1"), edge("M1", "T"), edge("B", "M2"), edge("M2", "T")),
        evidence=(
            ev("A", "kev_listed"),
            ev("M1", "kev_listed"),
            ev("T", "kev_listed"),
            ev("B", "candidates"),
            ev("M2", "candidates"),
        ),
    )
    result = engine.analyze(data)
    assert [p.entry_point for p in result.paths] == ["A", "B"]
    assert [p.status for p in result.paths] == ["plausible", "conditional"]
    assert result.paths[0].ranking_score > result.paths[1].ranking_score
    assert [p.rank for p in result.paths] == [1, 2]


# ---------------------------------------------------------------- multiple paths, choke points


def diamond():
    return AttackGraphInput(
        assets=(
            asset("GW", kind="gateway", exposed=True),
            asset("L"),
            asset("R"),
            asset("J"),
            asset("T", kind="controller", crit="essential"),
        ),
        edges=(edge("GW", "L"), edge("GW", "R"), edge("L", "J"), edge("R", "J"), edge("J", "T")),
        evidence=tuple(ev(a, "kev_listed") for a in ("GW", "L", "R", "J", "T")),
    )


def test_multiple_paths_found_and_choke_point_identified():
    result = engine.analyze(diamond())
    assert {p.nodes for p in result.paths} == {("GW", "L", "J", "T"), ("GW", "R", "J", "T")}
    chokes = {c.asset_id: c for c in result.chokepoints}
    assert chokes["J"].targets_cut == ("T",)  # every path to T goes through J
    assert chokes["L"].targets_cut == () and chokes["L"].paths_through == 1  # bypassable


def test_max_paths_per_target_limits_output_but_not_reachability_verdict():
    result = engine.analyze(diamond(), AnalysisConfig(max_paths_per_target=1))
    assert len(result.paths) == 1
    assert result.target_reachability[0].supported_paths == 2


# ---------------------------------------------------------------- cross-sector


def test_cross_sector_cyber_connection_creates_a_cross_sector_path():
    data = AttackGraphInput(
        assets=(
            asset("PWR-GW", "power", "gateway", exposed=True),
            asset("PWR-SRV", "power", "server"),
            asset("WTR-SRV", "water", "server"),
            asset("WTR-PLC", "water", "controller", "essential"),
        ),
        edges=(
            edge("PWR-GW", "PWR-SRV"),
            edge("PWR-SRV", "WTR-SRV", protocol="OPC UA"),  # shared engineering link
            edge("WTR-SRV", "WTR-PLC"),
        ),
        evidence=tuple(ev(a, "kev_listed") for a in ("PWR-GW", "PWR-SRV", "WTR-SRV", "WTR-PLC")),
    )
    (path,) = engine.analyze(data).paths
    sectors = {a.id: a.sector for a in data.assets}
    assert sectors[path.nodes[0]] != sectors[path.target]
    assert path.nodes == ("PWR-GW", "PWR-SRV", "WTR-SRV", "WTR-PLC")


# ---------------------------------------------------------------- no propagation via operations


def test_operational_dependencies_never_create_attack_paths():
    bundle = make_bundle()
    data = from_bundle(bundle)
    assert not hasattr(data, "operational_edges")
    cyber_ids = {e.id for e in bundle.cyber_edges}
    result = engine.analyze(data)
    used = {h.edge_id for p in result.paths for h in p.hops if h.edge_id}
    assert used <= cyber_ids
    # PWR-010 is linked only operationally (backup power); an attacker cannot route through it.
    assert not any("PWR-010" in p.nodes for p in result.paths)
    backup = engine.analyze(data, AnalysisConfig(targets=("PWR-010",)))
    assert backup.target_reachability[0].verdict == "unreachable" and backup.paths == ()
    # Without cyber edges there is no path at all, however many operational edges exist.
    assert bundle.operational_edges
    stripped = bundle.model_copy(update={"cyber_edges": []})
    assert engine.analyze(from_bundle(stripped)).paths == ()


# ---------------------------------------------------------------- determinism and validation


def test_results_are_deterministic_and_input_order_independent():
    data = diamond()
    first = engine.analyze(data)
    assert engine.analyze(data) == first
    shuffled_edges = list(data.edges)
    shuffled_assets = list(data.assets)
    random.Random(7).shuffle(shuffled_edges)
    random.Random(8).shuffle(shuffled_assets)
    again = engine.analyze(
        data.model_copy(update={"edges": tuple(shuffled_edges), "assets": tuple(shuffled_assets)})
    )
    assert again == first


def test_unknown_exposure_is_listed_not_assumed():
    data = chain().model_copy(
        update={
            "assets": tuple(
                a.model_copy(update={"internet_exposed": None}) if a.id == "WS" else a
                for a in chain().assets
            )
        }
    )
    result = engine.analyze(data)
    assert result.unknown_exposure_assets == ("WS",) and "WS" not in result.entry_points


def test_invalid_input_is_rejected():
    with pytest.raises(AttackPathInputError):
        engine.analyze(chain().model_copy(update={"edges": (edge("GW", "NOPE"),)}))
    with pytest.raises(AttackPathInputError):
        engine.analyze(chain(), AnalysisConfig(targets=("NOPE",)))


# ---------------------------------------------------------------- Aurora City


def aurora_evidence(level="kev_listed"):
    bundle = make_bundle()
    return tuple(ev(a.id, level) for a in bundle.assets)


def test_aurora_paths_follow_the_configured_cyber_chain_with_consequences():
    bundle = make_bundle()
    engine_with_impact = AttackPathEngine(consequence_lookup(bundle))
    result = engine_with_impact.analyze(from_bundle(bundle, aurora_evidence()))
    assert result.entry_points == ("HLT-001", "PWR-001", "WTR-001")
    power = [p for p in result.paths if p.entry_point == "PWR-001"]
    assert {p.target for p in power} >= {"PWR-002", "PWR-003", "PWR-007", "PWR-009"}
    assert {p.nodes[:3] for p in power} == {("PWR-001", "PWR-004", "PWR-008")}
    # The dispatch server and operator workstation are choke points for every power controller.
    chokes = {c.asset_id: c for c in result.chokepoints}
    assert {"PWR-002", "PWR-003"} <= set(chokes["PWR-008"].targets_cut)
    assert "PWR-004" in chokes
    # Consequences come from the operational graph and stay separate from the route.
    assert all(p.consequence is not None for p in result.paths if p.final_effects)
    # No sector reaches another: Aurora has no cross-sector cyber links.
    assert all({n[:3] for n in p.nodes} == {p.nodes[0][:3]} for p in result.paths)


def test_aurora_without_evidence_is_insufficient_not_plausible():
    bundle = make_bundle()
    result = engine.analyze(from_bundle(bundle))
    assert result.paths and all(p.status == "insufficient_evidence" for p in result.paths)
    # The gateway and workstation are weak by configuration alone; the server hop is unknown.
    assert (
        result.paths[0].hops[weakest := result.paths[0].weakest_hop].status
        == "insufficient_evidence"
    )
    assert weakest >= 2


@needs_ml
def test_aurora_with_real_simulation_evidence(tmp_path):
    with TestClient(create_app(tmp_path / "t.sqlite3", static_dir=tmp_path / "s")) as client:
        run = client.post("/api/v1/simulation/run").json()
    from app.schemas.simulation import SimulationRun

    evidence = evidence_from_run(SimulationRun.model_validate(run))
    levels = {e.asset_id: e.level for e in evidence}
    assert levels["PWR-001"] == "kev_listed"  # FortiOS version has known-exploited CVEs
    assert all(e.applicable_cves is not None for e in evidence)
    bundle = make_bundle()
    result = AttackPathEngine(consequence_lookup(bundle)).analyze(from_bundle(bundle, evidence))
    assert result.paths and all(p.status in ("plausible", "conditional") for p in result.paths)
    assert engine.analyze(from_bundle(bundle, evidence)) == engine.analyze(
        from_bundle(bundle, evidence)
    )
