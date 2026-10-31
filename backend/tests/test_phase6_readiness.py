"""Demo boundaries: exact attack-path context, graph separation and honest failure states."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from ml import inference


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    if not inference.status()["ready"]:
        pytest.skip("Local reference inputs/model are required for the integration checks")
    root = tmp_path_factory.mktemp("phase6")
    with TestClient(create_app(root / "scenario.sqlite3", static_dir=root / "static")) as session:
        response = session.post("/api/v1/simulation/run")
        assert response.status_code == 200, response.text
        yield session


def binding(client):
    run = client.get("/api/v1/simulation/latest").json()
    return {
        "scenario_id": run["scenario_id"],
        "snapshot_id": run["snapshot_id"],
        "run_id": run["id"],
        "baseline_fingerprint": run["fingerprint"],
    }


def test_attack_report_preserves_context_and_uses_only_cyber_edges(client):
    params = binding(client)
    response = client.get("/api/v1/simulation/attack-paths", params=params)
    assert response.status_code == 200, response.text
    report = response.json()
    assert all(report[key] == value for key, value in params.items())
    assert report["state"] == "current" and report["isolated_assets"] == []
    context = {key: params[key] for key in ("scenario_id", "snapshot_id")}
    cyber = client.get("/api/v1/graph", params={**context, "type": "cyber"}).json()
    operational = client.get("/api/v1/graph", params={**context, "type": "operational"}).json()
    cyber_edges = {edge["id"]: edge for edge in cyber["edges"]}
    op_ids = {edge["id"] for edge in operational["edges"]}
    assert report["paths"]
    for path in report["paths"]:
        assert path["status"] in {"plausible", "conditional", "insufficient_evidence"}
        for hop in path["hops"]:
            if hop["edge_id"] is None:
                assert hop["source"] == "internet"
                continue
            assert hop["edge_id"] not in op_ids
            edge = cyber_edges[hop["edge_id"]]
            assert (hop["source"], hop["target"]) == (
                edge["source_asset_id"],
                edge["target_asset_id"],
            )


def test_hypothetical_isolation_removes_paths_without_mutating_baseline(client):
    before = client.get("/api/v1/simulation/latest").json()
    params = {**binding(client), "isolate": ["PWR-008"]}
    report = client.get("/api/v1/simulation/attack-paths", params=params).json()
    assert report["state"] == "projected" and report["isolated_assets"] == ["PWR-008"]
    assert not any("PWR-008" in path["nodes"] for path in report["paths"])
    assert client.get("/api/v1/simulation/latest").json() == before


@pytest.mark.parametrize(
    "extra",
    [
        {"isolate": "UNKNOWN-999"},
        {"run_id": ""},
        {"baseline_fingerprint": "short"},
        {"max_paths_per_target": 0},
        {"scenario_id": "invalid/context"},
    ],
)
def test_attack_path_invalid_requests_are_validation_errors_not_silent_noops(client, extra):
    response = client.get("/api/v1/simulation/attack-paths", params={**binding(client), **extra})
    assert response.status_code == 422, response.text
    assert "error" in response.json()


def test_attack_path_fingerprint_and_snapshot_mismatch_are_rejected(client):
    for extra, code in (
        ({"baseline_fingerprint": "0" * 32}, "baseline_fingerprint_mismatch"),
        ({"snapshot_id": "other-snapshot"}, "baseline_mismatch"),
    ):
        response = client.get(
            "/api/v1/simulation/attack-paths", params={**binding(client), **extra}
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == code


def test_superseded_attack_path_run_is_rejected_even_when_results_match(client):
    old = binding(client)
    assert client.post("/api/v1/simulation/run").status_code == 200
    response = client.get("/api/v1/simulation/attack-paths", params=old)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "stale_baseline"


def test_missing_reference_data_does_not_create_a_score(tmp_path, monkeypatch):
    def unavailable(*args, **kwargs):
        raise inference.ReferenceUnavailable("Reference cache intentionally unavailable in test")

    with TestClient(create_app(tmp_path / "empty.sqlite3", static_dir=tmp_path / "s")) as session:
        monkeypatch.setattr(inference, "load_reference", unavailable)
        response = session.post("/api/v1/simulation/run")
        assert response.status_code == 503
        assert "Reference cache intentionally unavailable" in response.json()["error"]["message"]
        assert session.get("/api/v1/simulation/latest").status_code == 409
        asset = session.get("/api/v1/assets/PWR-001").json()
        assert asset["risk"]["status"] == "unavailable"
        assert asset["risk"]["score"] is None
