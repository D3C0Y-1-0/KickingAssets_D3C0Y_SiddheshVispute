"""Actual confined HTTP evidence -> existing evaluated ML -> bound What-If engine.

No numerical model outputs or engine results are substituted in these tests.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.soc_targets import create_targets


@pytest.fixture(scope="module")
def assessed(tmp_path_factory):
    root = tmp_path_factory.mktemp("soc_analysis")
    with pytest.MonkeyPatch.context() as env:
        env.setenv("GRIDSENTINEL_WARM_START", "0")
        app = create_app(root / "inventory.sqlite3", static_dir=root / "static")
        with TestClient(app, client=("127.0.0.1", 1234)) as op:
            assert op.post("/api/v1/soc/session").status_code == 200
            response = op.post("/api/v1/simulation/run")
            assert response.status_code == 200, response.text
            run = response.json()
            assert (
                op.post(
                    "/api/v1/soc/nodes/WTR-005/protection", json={"protected": False}
                ).status_code
                == 200
            )
            target = TestClient(
                create_targets(app.state.soc, root / "reports"), client=("192.0.2.10", 1235)
            )
            assert (
                len(
                    target.get("/nodes/WTR-005/history", params={"q": "public' OR '1'='1"}).json()[
                        "rows"
                    ]
                )
                == 2
            )
            event = next(
                e
                for e in reversed(op.get("/api/v1/soc/snapshot").json()["events"])
                if e["outcome"] == "unauthorized_read"
            )
            binding = {
                "scenario_id": run["scenario_id"],
                "snapshot_id": run["snapshot_id"],
                "run_id": run["id"],
                "baseline_fingerprint": run["fingerprint"],
                "event_id": event["id"],
            }
            yield op, app, run, event, binding


def test_real_event_model_projection_and_immutable_baseline(assessed):
    op, _, run, event, body = assessed
    assert event["severity"] == "critical"
    assert event["rule_version"] == "soc-rules-v2"
    response = op.post("/api/v1/soc/analyze", json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    original = next(a for a in run["assets"] if a["asset_id"] == "WTR-005")
    assert result["asset"] == original
    assert result["model_version"] == run["model_version"]
    assert result["projection"] is not None
    assert result["projection"]["verification"] == "not_verified"
    assert all(
        a["action_type"] != "patch_prioritization" for a in result["what_if_request"]["actions"]
    )
    replay = op.post("/api/v1/actions/what-if", json=result["what_if_request"])
    assert replay.status_code == 200, replay.text
    assert replay.json() == result["projection"]
    assert op.get("/api/v1/simulation/latest").json() == run
    print(
        "SOC actual model:",
        result["model_version"],
        "asset risk:",
        result["asset"]["risk"]["score"],
        "city:",
        result["projection"]["current_city_index"],
        "->",
        result["projection"]["projected_city_index"],
    )


def test_protected_query_is_an_attempt_not_a_disclosure(assessed):
    op, app, _, _, _ = assessed
    op.post("/api/v1/soc/nodes/WTR-005/protection", json={"protected": True})
    target = TestClient(
        create_targets(app.state.soc, app.state.soc.path.parent / "reports"),
        client=("192.0.2.20", 1236),
    )
    assert (
        target.get("/nodes/WTR-005/history", params={"q": "public' OR '1'='1"}).json()["rows"] == []
    )
    event = next(e for e in reversed(app.state.soc.page()) if e["source_ip"] == "192.0.2.20")
    assert (event["category"], event["severity"], event["outcome"]) == (
        "query.attempt",
        "medium",
        "blocked",
    )


def test_weak_login_uses_existing_model_not_a_new_attack_probability(assessed):
    op, app, run, _, body = assessed
    op.post("/api/v1/soc/nodes/PWR-001/protection", json={"protected": False})
    target = TestClient(
        create_targets(app.state.soc, app.state.soc.path.parent / "reports"),
        client=("192.0.2.30", 1237),
    )
    assert (
        target.post(
            "/nodes/PWR-001/login", json={"username": "viewer", "password": "viewer"}
        ).status_code
        == 200
    )
    event = next(e for e in reversed(app.state.soc.page()) if e["source_ip"] == "192.0.2.30")
    response = op.post("/api/v1/soc/analyze", json={**body, "event_id": event["id"]})
    assert response.status_code == 200, response.text
    result = response.json()
    assert (
        result["asset"]["risk"]
        == next(a for a in run["assets"] if a["asset_id"] == "PWR-001")["risk"]
    )
    assert result["projection"]["baseline_fingerprint"] == run["fingerprint"]
    print(
        "SOC weak login actual model:",
        result["asset"]["risk"]["score"],
        "city:",
        result["projection"]["current_city_index"],
        "->",
        result["projection"]["projected_city_index"],
    )


@pytest.mark.parametrize(
    "change,status",
    [
        ({"baseline_fingerprint": "0" * 32}, 409),
        ({"run_id": "missing-run"}, 404),
        ({"snapshot_id": "other-snapshot"}, 409),
        ({"event_id": 999999}, 404),
        ({"event_id": 0}, 422),
    ],
)
def test_context_and_retention_are_enforced(assessed, change, status):
    op, _, _, _, body = assessed
    assert op.post("/api/v1/soc/analyze", json={**body, **change}).status_code == status


def test_no_fingerprint_audit_event_and_remote_access_rejected(assessed):
    op, app, _, _, body = assessed
    missing = {k: v for k, v in body.items() if k != "baseline_fingerprint"}
    assert op.post("/api/v1/soc/analyze", json=missing).status_code == 422
    audit = app.state.soc.emit("127.0.0.1", "operator.protection", asset="WTR-005")
    assert op.post("/api/v1/soc/analyze", json={**body, "event_id": audit}).status_code == 422
    remote = TestClient(app, client=("192.0.2.10", 4321))
    assert remote.post("/api/v1/soc/analyze", json=body).status_code == 401
