import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.db.store import initialize, read_documents
from app.domain.seed import SCENARIO_ID, SEED_PATH, SNAPSHOT_ID, make_bundle
from app.main import create_app
from app.schemas.models import (
    CyberGraph,
    OperationalGraph,
    RiskAssessment,
    ScenarioBundle,
    ServiceRequirement,
    VulnerabilityFinding,
    WhatIfResult,
)


def test_health_and_scenario(client):
    health = client.get("/api/v1/health").json()
    assert health["status"] == "ok" and health["database"] == "ready"
    assert health["application_version"] == "0.1.0"
    assert health["intelligence"] in {"ready", "unavailable"}
    scenario = client.get("/api/v1/scenarios").json()[0]
    assert scenario["id"] == SCENARIO_ID
    assert scenario["is_sample"] is True
    assert scenario["current_snapshot_id"] == SNAPSHOT_ID
    assert client.get("/api/v1/snapshots").json()[0]["assessment_status"] == "unavailable"


def test_inventory_filters_and_detail(client):
    rows = client.get("/api/v1/assets").json()
    assert len(rows) == len({a["id"] for a in rows}) == 30
    assert all(a["snapshot_id"] == SNAPSHOT_ID and a["scenario_id"] == SCENARIO_ID for a in rows)
    assert len(client.get("/api/v1/assets?sector=water").json()) == 10
    assert len(client.get("/api/v1/assets?asset_type=gateway").json()) == 3
    assert client.get("/api/v1/assets?q=North%20Grid").json()[0]["id"] == "PWR-001"
    detail = client.get("/api/v1/assets/PWR-001").json()
    assert detail["asset"]["security"]["mfa_enabled"] is False
    assert detail["risk"]["score"] is None
    assert detail["risk"]["status"] == "unavailable"
    assert detail["vulnerabilities"] == []
    assert detail["observations"] == []


def test_two_graphs_are_distinct(client):
    cyber = CyberGraph.model_validate(client.get("/api/v1/graph?type=cyber").json())
    operational = OperationalGraph.model_validate(
        client.get("/api/v1/graph?type=operational").json()
    )
    assert len(cyber.nodes) == len(operational.nodes) == 30
    assert len(cyber.edges) == 27
    assert len(operational.edges) == 23
    assert all(e.kind == "cyber" and e.assumptions and e.possible_effects for e in cyber.edges)
    assert all(e.kind == "operational" and e.assumptions for e in operational.edges)
    assert set(e.id for e in cyber.edges).isdisjoint(e.id for e in operational.edges)
    assert any(
        e.source_asset_id.startswith("PWR") and e.target_asset_id.startswith("WTR")
        for e in operational.edges
    )
    assert not any(e.source_asset_id[:3] != e.target_asset_id[:3] for e in cyber.edges)
    assert any(e.requirement == "backup" for e in operational.edges)
    assert any(e.requirement == "redundant" for e in operational.edges)


def test_service_redundancy(client):
    services = client.get("/api/v1/services").json()
    assert len(services) == 3
    for service in services:
        assert any(
            len(r["asset_ids"]) == 2 and r["minimum_available"] == 1
            for r in service["requirements"]
        )
        assert any(
            r["role"] == "backup" and r["backup_duration_minutes"] > 0
            for r in service["requirements"]
        )


@pytest.mark.parametrize(
    "path,code",
    [
        ("/api/v1/assets/missing", 404),
        ("/api/v1/assets?scenario_id=missing", 404),
        ("/api/v1/graph?type=cyber&snapshot_id=missing", 404),
        ("/api/v1/graph?type=combined", 422),
        ("/api/v1/graph", 422),
        ("/api/v1/assets?sector=other", 422),
        ("/api/v1/assets?asset_type=other", 422),
        ("/api/v1/missing", 404),
    ],
)
def test_consistent_errors(client, path, code):
    response = client.get(path)
    assert response.status_code == code
    assert set(response.json()["error"]) == {"code", "message", "details"}


def test_seed_is_fixed_idempotent_and_resettable(tmp_path):
    fixture = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    assert make_bundle().model_dump(mode="json") == fixture
    path = tmp_path / "seed.sqlite3"
    initialize(path)
    before = {
        table: read_documents(path, table)
        for table in [
            "scenarios",
            "snapshots",
            "assets",
            "cyber_edges",
            "operational_edges",
            "services",
        ]
    }
    initialize(path)
    assert read_documents(path, "assets") == before["assets"]
    initialize(path, reset=True)
    assert {table: read_documents(path, table) for table in before} == before


def test_contracts_reject_fabricated_defaults_and_invalid_groups():
    bundle = make_bundle()
    context = {"scenario_id": SCENARIO_ID, "snapshot_id": SNAPSHOT_ID}
    risk = RiskAssessment(**context, state="current", provenance=bundle.scenario.provenance)
    assert risk.score is None
    with pytest.raises(ValidationError):
        RiskAssessment(**{**risk.model_dump(), "score": 0})
    with pytest.raises(ValidationError):
        RiskAssessment(**{**risk.model_dump(), "status": "computed"})
    # Zero is valid only as an explicitly calculated, versioned result.
    assert (
        RiskAssessment(
            **{
                **risk.model_dump(),
                "status": "computed",
                "score": 0,
                "category": "low",
                "scoring_version": "test-v1",
                "calculated_at": bundle.scenario.created_at,
                "unavailable_reason": None,
            }
        ).score
        == 0
    )
    with pytest.raises(ValidationError):
        ServiceRequirement(id="req", asset_ids=["PWR-001"], minimum_available=2, role="primary")
    with pytest.raises(ValidationError):
        ServiceRequirement(id="req", asset_ids=["PWR-001"], minimum_available=1, role="backup")
    with pytest.raises(ValidationError):
        VulnerabilityFinding(
            **context,
            id="finding",
            asset_id="PWR-001",
            asset_vulnerability_id="av-1",
            priority=91,
            provenance=bundle.scenario.provenance,
        )
    with pytest.raises(ValidationError):
        WhatIfResult(
            **context,
            request={**context, "actions": [{"asset_id": "PWR-001", "action_type": "enable_mfa"}]},
            current=risk,
            projected=risk,
        )


def test_contract_rejects_dangling_edges_and_wrong_context():
    data = make_bundle().model_dump(mode="json")
    data["cyber_edges"][0]["target_asset_id"] = "missing"
    with pytest.raises(ValidationError):
        ScenarioBundle.model_validate(data)


def test_timestamps_require_timezones_and_backup_targets_exist():
    data = make_bundle().model_dump(mode="json")
    data["scenario"]["created_at"] = "2026-10-01T09:00:00"
    with pytest.raises(ValidationError):
        ScenarioBundle.model_validate(data)
    data = make_bundle().model_dump(mode="json")
    data["services"][0]["requirements"][-1]["substitutes_requirement_id"] = "missing"
    with pytest.raises(ValidationError):
        ScenarioBundle.model_validate(data)
    data = make_bundle().model_dump(mode="json")
    data["assets"][0]["snapshot_id"] = "wrong"
    with pytest.raises(ValidationError):
        ScenarioBundle.model_validate(data)


def test_compiled_spa_deep_links_and_api_isolation(tmp_path):
    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<html>GridSentinel test shell</html>", encoding="utf-8")
    with TestClient(create_app(tmp_path / "db.sqlite3", static_dir=static)) as client:
        assert "GridSentinel test shell" in client.get("/infrastructure").text
        assert client.get("/missing.js").status_code == 404
        assert client.get("/api/v1/missing").status_code == 404
        assert client.get("/api/v1/health").json()["status"] == "ok"


def test_database_failure_is_explicit(client):
    path = Path(client.app.state.db_path)
    from app.db.store import connection

    with connection(path) as db:
        db.execute("DROP TABLE metadata")
    assert client.get("/api/v1/health").status_code == 503
