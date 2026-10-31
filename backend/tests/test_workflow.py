import pytest
from fastapi.testclient import TestClient

from app.domain.seed import SCENARIO_ID, SNAPSHOT_ID, make_bundle
from app.engine import risk
from app.engine.pivot import PivotImpact
from app.main import create_app
from ml import inference

CONTEXT = {"scenario_id": SCENARIO_ID, "snapshot_id": SNAPSHOT_ID}
needs_ml = pytest.mark.skipif(
    not inference.status()["ready"], reason="local reference data or model not available"
)


# ---------------------------------------------------------------- formula and honesty rules


def test_exposure_factor_is_bounded_and_explained():
    plain = {"internet_exposed": False, "remote_access": False, "mfa_enabled": True}
    assert risk.exposure_factor(plain)[0] == risk.EXPOSURE_BASE
    worst = {
        "internet_exposed": True,
        "remote_access": True,
        "mfa_enabled": False,
        "patch_status": "review_required",
    }
    value, parts = risk.exposure_factor(worst)
    assert value == 1.0 and len(parts) == 5
    assert risk.exposure_factor({"mfa_enabled": None})[0] == risk.EXPOSURE_BASE  # unknown != bad


def test_missing_signal_is_not_zero():
    assert risk.vulnerability_signal([], 0, 0) is None
    assert risk.vulnerability_signal([], 0, 5) == 0.0  # candidates exist, all neutralised
    assert risk.vulnerability_signal([0.4, 0.7], 0, 2) == 0.7
    assert risk.vulnerability_signal([0.1], 2, 3) == risk.KEV_FLOOR  # a known exploited CVE


def test_score_bands_and_city_index_weights():
    assert [risk.category(s) for s in (0, 19.9, 20, 40, 60, 100)] == [
        "low",
        "low",
        "medium",
        "high",
        "critical",
        "critical",
    ]
    assert risk.risk_score(1.0, 1.0, 1.0) == 100.0
    assert risk.risk_score(0.5, 0.5, 0.5) == 12.5
    assert risk.city_index([]) is None
    # essential counts 3x supporting: (80*3 + 20*1) / 4
    assert risk.city_index([(80.0, "essential"), (20.0, "supporting")]) == 65.0


def test_segmentation_removes_the_pivot_path_but_not_the_asset_itself():
    bundle = make_bundle()
    pivot = PivotImpact(bundle)
    open_case = pivot.worst_for("PWR-001")
    assert open_case and len(open_case.path) > 1  # gateway can reach deeper assets
    isolated = [
        e for e in bundle.cyber_edges if "PWR-001" not in (e.source_asset_id, e.target_asset_id)
    ]
    closed_case = pivot.worst_for("PWR-001", isolated)
    assert closed_case is not None and closed_case.path == ("PWR-001",)
    assert closed_case.max_disruption <= open_case.max_disruption


def test_pivot_effects_come_from_reachability_not_from_all_effects():
    pivot = PivotImpact(make_bundle())
    scenarios = pivot.reachable_scenarios("PWR-001")
    targets = {t for t, _, _ in scenarios}
    assert "PWR-001" in targets
    assert all(t.startswith("PWR") for t in targets)  # the seed has no cross-sector cyber edges


# ---------------------------------------------------------------- API workflow


@pytest.fixture(scope="module")
def app_client(tmp_path_factory):
    path = tmp_path_factory.mktemp("workflow")
    app = create_app(path / "test.sqlite3", static_dir=path / "static")
    with TestClient(app) as client:
        yield client


def test_actions_require_a_simulation_first(tmp_path):
    with TestClient(create_app(tmp_path / "t.sqlite3", static_dir=tmp_path / "s")) as client:
        assert client.get("/api/v1/simulation/latest").status_code == 409
        assert client.get("/api/v1/actions/options").status_code == 409
        body = {**CONTEXT, "actions": [{"asset_id": "PWR-001", "action_type": "access_control"}]}
        assert client.post("/api/v1/actions/what-if", json=body).status_code == 409
        asset = client.get("/api/v1/assets/PWR-001").json()
        assert asset["risk"]["status"] == "unavailable"  # no invented score before a run
        assert asset["risk"]["score"] is None


def test_action_catalog_covers_the_ps_actions(app_client):
    catalog = {a["type"]: a for a in app_client.get("/api/v1/actions/catalog").json()}
    assert set(catalog) == {
        "patch_prioritization",
        "network_segmentation",
        "access_control",
        "enhanced_monitoring",
        "incident_response_plan",
    }
    assert not catalog["enhanced_monitoring"]["modelled"]
    assert not catalog["incident_response_plan"]["modelled"]


@pytest.fixture(scope="module")
def run(app_client):
    if not inference.status()["ready"]:
        pytest.skip("local reference data or model not available")
    response = app_client.post("/api/v1/simulation/run")
    assert response.status_code == 200, response.text
    return response.json()


@needs_ml
def test_simulation_scores_every_asset_from_ml_evidence(run, app_client):
    assert len(run["assets"]) == 30
    assert run["model_version"] == "kev-signal-v1"
    assert run["city_risk"]["status"] == "computed"
    for asset in run["assets"]:
        signal = asset["vulnerability_signal"]
        assert asset["profile"]["vendors"] and asset["candidate_count"] > 0
        assert 0 <= signal <= 1
        # The published formula reproduces every score from its three visible components.
        expected = round(100 * signal * asset["exposure_factor"] * asset["impact_factor"], 2)
        assert asset["risk"]["score"] == pytest.approx(expected, abs=0.01)
        assert asset["risk"]["factors"] and asset["risk"]["model_version"] == "kev-signal-v1"
        for cve in asset["top_vulnerabilities"]:
            if cve["status"] == "scored":
                assert 0 <= cve["priority_percentile"] <= 1 and cve["drivers"]
    scores = [a["risk"]["score"] for a in run["assets"]]
    assert scores == sorted(scores, reverse=True)
    assert len({s for s in scores}) > 3  # not a constant or a fixture
    detail = app_client.get("/api/v1/assets/PWR-001").json()
    assert detail["risk"]["status"] == "computed" and detail["risk"]["score"] is not None


@needs_ml
def test_simulation_is_deterministic(run, app_client):
    again = app_client.post("/api/v1/simulation/run").json()
    assert [(a["asset_id"], a["risk"]["score"]) for a in again["assets"]] == [
        (a["asset_id"], a["risk"]["score"]) for a in run["assets"]
    ]
    assert again["city_risk"]["score"] == run["city_risk"]["score"]


@needs_ml
def test_what_if_projects_without_changing_the_current_state(run, app_client):
    target = next(a for a in run["assets"] if a["exposure_factor"] > 0.5)
    body = {
        **CONTEXT,
        "actions": [{"asset_id": target["asset_id"], "action_type": "network_segmentation"}],
    }
    result = app_client.post("/api/v1/actions/what-if", json=body).json()
    assert result["state"] == "projected" and result["verification"] == "not_verified"
    assert result["projected_city_index"] <= result["current_city_index"]
    delta = next(d for d in result["asset_deltas"] if d["asset_id"] == target["asset_id"])
    assert delta["projected_score"] < delta["current_score"]
    latest = app_client.get("/api/v1/simulation/latest").json()
    assert latest["city_risk"]["score"] == run["city_risk"]["score"]  # baseline untouched


@needs_ml
@pytest.mark.parametrize("action", ["enhanced_monitoring", "incident_response_plan"])
def test_recommendation_only_actions_claim_no_reduction(run, app_client, action):
    body = {**CONTEXT, "actions": [{"asset_id": "PWR-001", "action_type": action}]}
    result = app_client.post("/api/v1/actions/what-if", json=body).json()
    assert result["city_reduction"] == 0
    assert result["applied"][0]["modelled"] is False
    assert "Recommendation only" in result["applied"][0]["effect"]


@needs_ml
def test_options_list_all_five_actions_per_asset(run, app_client):
    options = app_client.get("/api/v1/actions/options").json()
    assert len(options) == 30 * 5
    modelled = [o for o in options if o["applicable"] and o["modelled"]]
    assert modelled and all(o["city_reduction"] is not None for o in modelled)
    assert all(o["city_reduction"] is None for o in options if not o["modelled"])


@needs_ml
def test_optimizer_respects_budget_and_recomputes_marginal_gains(run, app_client):
    plan = app_client.post(
        "/api/v1/actions/optimize", json={**CONTEXT, "effort_budget_hours": 60}
    ).json()
    assert plan["used_hours"] <= 60 and plan["steps"]
    previous = plan["starting_city_index"]
    for step in plan["steps"]:
        assert step["marginal_reduction"] > 0
        assert step["city_index_after"] < previous
        previous = step["city_index_after"]
    assert plan["ending_city_index"] == pytest.approx(previous, abs=0.01)
    assert all(not o["modelled"] for o in plan["recommendation_only"])
    again = app_client.post(
        "/api/v1/actions/optimize", json={**CONTEXT, "effort_budget_hours": 60}
    ).json()
    assert [(s["asset_id"], s["action_type"]) for s in again["steps"]] == [
        (s["asset_id"], s["action_type"]) for s in plan["steps"]
    ]
    excluded = plan["steps"][0]["asset_id"]
    without = app_client.post(
        "/api/v1/actions/optimize",
        json={**CONTEXT, "effort_budget_hours": 60, "excluded_asset_ids": [excluded]},
    ).json()
    assert all(s["asset_id"] != excluded for s in without["steps"])


# ---------------------------------------------------------------- ML section


def test_ml_overview_reports_data_model_and_baselines(app_client):
    overview = app_client.get("/api/v1/ml/overview").json()
    assert overview["model_version"] == "kev-signal-v1"
    names = {m["name"] for m in overview["metrics"]}
    assert {"xgboost_with_epss", "epss_percentile_baseline", "cvss_only_baseline"} <= names
    assert {s["name"].split()[0] for s in overview["sources"]} >= {"CISA", "NVD", "EPSS"}
    assert overview["leakage_controls"] and overview["limitations"] and overview["not_claimed"]


@needs_ml
def test_cve_scoring_endpoint(app_client):
    listed = app_client.get("/api/v1/ml/score", params={"cve_id": "CVE-2021-44228"}).json()
    assert listed["status"] == "already_in_kev" and listed["ml_score"] is None
    assert app_client.get("/api/v1/ml/score", params={"cve_id": "CVE-1900-0001"}).status_code == 404
    run_result = app_client.post("/api/v1/simulation/run").json()
    cve = next(
        c["cve_id"]
        for a in run_result["assets"]
        for c in a["top_vulnerabilities"]
        if c["status"] == "scored"
    )
    scored = app_client.get("/api/v1/ml/score", params={"cve_id": cve}).json()
    assert scored["status"] == "scored" and 0 <= scored["priority_percentile"] <= 1
    assert scored["drivers"]
