import json
from datetime import date

import pytest

from app.db.store import connection, read_documents
from app.db.vulnerability_store import assess as assess_vulnerabilities
from app.domain.seed import ROOT, SCENARIO_ID, SNAPSHOT_ID
from app.schemas.intelligence import IntelligenceReport
from app.services import intelligence, model_signal


def test_actual_model_native_contract_and_kev_exclusion():
    raw = json.loads((ROOT / "data/reference/risk-v1/nvd-CVE-2021-44224.json").read_text())[
        "vulnerabilities"
    ][0]["cve"]
    inputs = json.loads(intelligence.INPUTS.read_text())
    args = dict(
        feature_date=date.fromisoformat(inputs["feature_date"]),
        epss_rank=inputs["ranks"][raw["id"]],
        kev_added=None,
    )
    output = model_signal.predict(raw, **args)
    assert output.status == "computed" and 0 <= output.signal <= 1
    assert output == model_signal.predict(raw, **args)
    assert output.contributions and all(
        c.feature in model_signal.evidence().feature_names for c in output.contributions
    )
    known = model_signal.predict(raw, **{**args, "kev_added": date(2021, 11, 3)})
    assert known.status == "known_kev" and known.signal is None and not known.contributions
    missing = model_signal.predict(raw, **{**args, "epss_rank": None})
    assert missing.status == "unavailable" and missing.signal is None


def test_scoped_actual_pipeline_and_factor_reconciliation(client):
    response = client.get("/api/v1/intelligence")
    assert response.status_code == 200
    report = IntelligenceReport.model_validate(response.json())
    assert report.assessed_count == 3 and report.unavailable_count == 27
    assert len(report.assets) == 30
    for asset in report.assets:
        assert asset.risk.snapshot_id == SNAPSHOT_ID
        if asset.risk.status == "computed":
            assert asset.risk.score == pytest.approx(
                sum(f.contribution for f in asset.risk.factors)
            )
            assert 0 <= asset.risk.score <= 100 and asset.coverage == "partial"
        else:
            assert asset.risk.score is None and not asset.risk.factors
    by_id = {a.asset_id: a for a in report.assets}
    assert any(s.status == "computed" for s in by_id["HLT-001"].signals)
    assert by_id["PWR-008"].risk.status == "unavailable"  # candidates never become scored matches
    assert by_id["WTR-008"].risk.score is None
    water = next(i for i in by_id["WTR-008"].impacts if i.service_id == "svc-water")
    assert water.state == "projected" and water.disruption_fraction == 1.0
    assert report.assets[0].asset_id == "PWR-001"  # stable ID tie-break
    context = {"scenario_id": SCENARIO_ID, "snapshot_id": SNAPSHOT_ID}
    assert client.post("/api/v1/intelligence/assess", json=context).json() == response.json()
    assert client.get("/api/v1/assets/PWR-001").json()["risk"] == by_id["PWR-001"].risk.model_dump(
        mode="json"
    )
    assert client.get("/api/v1/intelligence?scenario_id=missing").status_code == 404
    assert client.get("/api/v1/intelligence?snapshot_id=missing").status_code == 404
    assert client.post("/api/v1/intelligence/assess", json={}).status_code == 422


def test_stale_evidence_rejected_and_control_improvement_reduces_priority(client):
    original = client.get("/api/v1/intelligence").json()
    path = client.app.state.db_path
    with connection(path) as db:
        row = json.loads(db.execute("SELECT payload FROM assets WHERE id='PWR-001'").fetchone()[0])
        row["security"]["mfa_enabled"] = True
        db.execute("UPDATE assets SET payload=? WHERE id='PWR-001'", (json.dumps(row),))
    assert client.get("/api/v1/intelligence").status_code == 409
    context = {"scenario_id": SCENARIO_ID, "snapshot_id": SNAPSHOT_ID}
    assert client.post("/api/v1/intelligence/assess", json=context).status_code == 409
    assess_vulnerabilities(path, SCENARIO_ID)
    new = client.post("/api/v1/intelligence/assess", json=context).json()
    old_score = next(a["risk"]["score"] for a in original["assets"] if a["asset_id"] == "PWR-001")
    new_score = next(a["risk"]["score"] for a in new["assets"] if a["asset_id"] == "PWR-001")
    assert new["id"] != original["id"] and new_score < old_score
    assert client.get("/api/v1/intelligence").json()["id"] == new["id"]


def test_assessment_preserves_input_and_ignores_cyber_edges(client):
    path = client.app.state.db_path
    before = {
        table: read_documents(path, table, SCENARIO_ID, SNAPSHOT_ID)
        for table in ("assets", "operational_edges", "snapshots")
    }
    first = intelligence.assess(path, SCENARIO_ID)
    with connection(path) as db:
        db.execute("DELETE FROM cyber_edges")
    second = intelligence.assess(path, SCENARIO_ID)
    assert [a.risk.score for a in first.assets] == [a.risk.score for a in second.assets]
    for table, expected in before.items():
        assert read_documents(path, table, SCENARIO_ID, SNAPSHOT_ID) == expected


def test_model_card_metrics_are_not_relabelled(client):
    model = client.get("/api/v1/intelligence/model").json()
    card = json.loads((model_signal.ARTIFACTS / "kev-signal-v1_model_card.json").read_text())
    assert model["metrics"] == card["test_results"]
    assert "vendor_kev_pre" not in model["feature_names"]
    assert model["variant"] == "xgboost_no_kev_history"
    assert any("Not calibrated" in limit for limit in model["limitations"])
