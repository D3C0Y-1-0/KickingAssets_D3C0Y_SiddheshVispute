import json

import pytest
from fastapi.testclient import TestClient

from app.domain.seed import SCENARIO_ID, SNAPSHOT_ID
from app.main import create_app
from app.services import insights
from ml import inference

CONTEXT = {"scenario_id": SCENARIO_ID, "snapshot_id": SNAPSHOT_ID}
needs_ml = pytest.mark.skipif(
    not inference.status()["ready"], reason="local reference data or model not available"
)


def client(tmp_path):
    return TestClient(create_app(tmp_path / "insights.sqlite3"))


def test_activity_is_labelled_simulation_and_urgency_is_unavailable_before_a_run(tmp_path):
    with client(tmp_path) as c:
        body = c.get("/api/v1/activity").json()
    assert body["provenance"]["kind"] == "simulation"
    assert body["urgency_available"] is False
    assert all(a["urgency"] is None and a["risk_score"] is None for a in body["assets"])
    assert body["latest"]["day"] == body["as_of"] == body["window_end"]
    assert body["assets"][0]["anomaly"] >= body["assets"][-1]["anomaly"]  # most anomalous first
    assert any("SIMULATED" in line for line in body["assumptions"])


def test_activity_respects_as_of_and_rejects_dates_without_a_baseline(tmp_path):
    with client(tmp_path) as c:
        early = c.get("/api/v1/activity", params={"as_of": "2026-09-20"}).json()
        too_early = c.get("/api/v1/activity", params={"as_of": "2026-07-01"})
        series = c.get("/api/v1/activity/assets/PWR-002", params={"as_of": "2026-09-20"}).json()
        unknown = c.get("/api/v1/activity/assets/NOPE-1")
    assert early["as_of"] == "2026-09-20"
    assert all(day["day"] <= "2026-09-20" for day in early["series"])
    assert all(e["start"] <= "2026-09-20" for e in early["events"])  # later events not revealed
    assert too_early.status_code == 422
    assert series["series"] and series["series"][0]["points"][-1]["day"] == "2026-09-20"
    assert unknown.status_code == 404


def test_resilience_endpoints_return_labelled_conditional_results(tmp_path):
    with client(tmp_path) as c:
        vendors = c.get("/api/v1/resilience/vendors").json()
        chokepoints = c.get("/api/v1/resilience/chokepoints").json()
    assert vendors["provenance"]["kind"] == "simulation" and vendors["vendors"]
    assert chokepoints["chokepoints"][0]["is_chokepoint"] is True
    assert chokepoints["assumptions"] and vendors["assumptions"]


def test_trend_is_unavailable_not_invented_when_the_artifact_is_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(insights, "TREND_PATH", tmp_path / "absent.json")
    with client(tmp_path) as c:
        body = c.get("/api/v1/simulation/trend").json()
    assert body["status"] == "unavailable" and body["points"] == []
    assert body["unavailable_reason"]


def test_trend_artifact_is_served_when_built_for_this_snapshot(tmp_path, monkeypatch):
    artifact = {
        **CONTEXT,
        "status": "computed",
        "model_version": "kev-signal-v1",
        "scoring_version": "risk-index-v1",
        "generated_at": "2026-10-31T12:00:00Z",
        "points": [
            {
                "as_of": "2026-09-01",
                "city_index": 30.5,
                "category": "medium",
                "critical": 0,
                "high": 3,
                "medium": 8,
                "low": 10,
                "unscored": 9,
                "held_out": True,
                "top_asset_ids": ["PWR-008"],
            }
        ],
        "assumptions": ["replay"],
    }
    path = tmp_path / "trend.json"
    path.write_text(json.dumps(artifact), encoding="utf-8")
    monkeypatch.setattr(insights, "TREND_PATH", path)
    with client(tmp_path) as c:
        body = c.get("/api/v1/simulation/trend").json()
    assert body["status"] == "computed" and body["points"][0]["city_index"] == 30.5


def test_brief_requires_a_simulation_run(tmp_path):
    with client(tmp_path) as c:
        assert c.get("/api/v1/reports/brief").status_code == 409


@needs_ml
def test_after_a_run_urgency_appears_and_the_brief_is_grounded_in_the_run(tmp_path):
    with client(tmp_path) as c:
        run = c.post("/api/v1/simulation/run", params=CONTEXT).json()
        activity = c.get("/api/v1/activity").json()
        brief = c.get("/api/v1/reports/brief").json()
        markdown = c.get("/api/v1/reports/brief", params={"format": "md"})
        page = c.get("/api/v1/reports/brief", params={"format": "html"})
    assert activity["urgency_available"] is True
    scored = {a["asset_id"]: a["risk"]["score"] for a in run["assets"]}
    for row in activity["assets"]:
        expected = scored[row["asset_id"]]
        assert row["risk_score"] == expected
        if expected is None:
            assert row["urgency"] is None  # unavailable, never zero
        else:
            assert row["urgency"] == pytest.approx(expected * (1 + 0.5 * row["anomaly"]), abs=0.01)
    titles = [s["title"] for s in brief["sections"]]
    assert titles[0] == "Summary" and "Assumptions and limitations" in titles
    assert brief["run_id"] == run["id"] and brief["scoring_version"]
    top = max(
        (a for a in run["assets"] if a["risk"]["score"] is not None),
        key=lambda a: a["risk"]["score"],
    )
    assets_section = next(s for s in brief["sections"] if s["title"] == "Highest-risk assets")
    assert top["asset_id"] in assets_section["lines"][0]  # brief ranks by the run's own scores
    assert "Projected, not verified" in " ".join(
        next(s for s in brief["sections"] if s["title"] == "Recommended actions")["lines"]
    )
    assert markdown.status_code == 200 and markdown.text.startswith("# GridSentinel risk brief")
    assert "attachment" in markdown.headers["content-disposition"]
    assert page.status_code == 200 and "<!doctype html>" in page.text
