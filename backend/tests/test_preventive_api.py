"""Real saved-model/Aurora integration; no model, findings or calculated outcomes are mocked."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import preventive
from ml import inference

PREFIX = "/api/v1/resilience/preventive"


@pytest.fixture(scope="module")
def running(tmp_path_factory):
    assert inference.status()["ready"], "Restore pinned local references before verification"
    root = tmp_path_factory.mktemp("preventive")
    app = create_app(root / "local.sqlite3", static_dir=root / "static")
    with TestClient(app) as client:
        response = client.post("/api/v1/simulation/run")
        assert response.status_code == 200, response.text
        run = response.json()
        bound = {
            "scenario_id": run["scenario_id"],
            "snapshot_id": run["snapshot_id"],
            "run_id": run["id"],
            "baseline_fingerprint": run["fingerprint"],
        }
        response = client.post(PREFIX + "/catalog", json=bound)
        assert response.status_code == 200, response.text
        cat = response.json()
        yield client, app, bound, cat


def payload(running, **changes):
    _, _, bound, cat = running
    return {
        **bound,
        "catalog_fingerprint": cat["catalog_fingerprint"],
        "scenario": {
            "horizon_minutes": 360,
            "failures": [{"id": "power", "asset_id": "PWR-008", "cause": "power_loss"}],
        },
        "intervention_ids": [],
        **changes,
    }


def post(running, suffix, body, status=200):
    response = running[0].post(PREFIX + suffix, json=body)
    assert response.status_code == status, response.text
    return response.json()


def test_catalog_preserves_fixed_version_evidence_and_is_stable(running):
    client, _, bound, cat = running
    assert client.post(PREFIX + "/catalog", json=bound).json() == cat
    patches = [a for a in cat["interventions"] if a["action_type"] == "patch"]
    assert patches and all(a["patch"]["remediated"] for a in patches)
    assert all(c["fixed_in"] for a in patches for c in a["patch"]["remediated"])
    assert {a["action_type"] for a in cat["interventions"]} == {
        "patch",
        "segmentation",
        "backup_power",
        "recovery",
    }


def test_actual_failure_recovery_backup_and_best_feasible_plan(running):
    request = payload(running)
    baseline = post(running, "/simulate", request)
    assert baseline["comparison"]["before"]["total_service_disruption_minutes"] == 360
    recovery = post(running, "/simulate", {**request, "intervention_ids": ["recover-PWR-008"]})
    assert recovery["comparison"]["after"]["total_service_disruption_minutes"] == 90
    backup = post(running, "/simulate", {**request, "intervention_ids": ["backup-PWR-010"]})
    assert backup["comparison"]["after"]["total_service_disruption_minutes"] == 90
    plan = post(
        running,
        "/optimize",
        {
            **request,
            "intervention_ids": ["recover-PWR-008", "backup-PWR-010", "segment-PWR-004"],
            "budget_credits": 12,
            "effort_limit_hours": 24,
            "downtime_limit_hours": 6,
        },
    )
    assert [a["id"] for a in plan["interventions"]] == ["recover-PWR-008"]
    assert plan["subsets_considered"] == 8
    assert plan["cost_credits"] == 4 and plan["objective_after_minutes"] == 90
    assert plan["comparison"] == recovery["comparison"]
    assert len(plan["rejected_alternatives"]) == 2


def test_zero_budget_and_exclusion_return_valid_empty_plan(running):
    request = {
        **payload(running),
        "intervention_ids": ["recover-PWR-008"],
        "budget_credits": 0,
        "effort_limit_hours": 24,
        "downtime_limit_hours": 6,
    }
    plan = post(running, "/optimize", request)
    assert plan["interventions"] == [] and plan["feasible_subsets"] == 1
    assert plan["objective_after_minutes"] == plan["objective_before_minutes"]
    assert "budget_exceeded" in plan["rejected_alternatives"][0]["reasons"]
    plan = post(
        running, "/optimize", {**request, "budget_credits": 20, "excluded_asset_ids": ["PWR-008"]}
    )
    assert plan["interventions"] == []
    assert "asset_excluded" in plan["rejected_alternatives"][0]["reasons"]


def test_cyber_routes_are_separate_and_alternative_routes_are_not_silently_removed(running):
    request = payload(
        running,
        scenario={
            "horizon_minutes": 120,
            "cyber_challenges": [
                {
                    "id": "attack",
                    "entry_asset_id": "PWR-001",
                    "target_asset_id": "PWR-008",
                    "effect": "data_integrity",
                }
            ],
        },
    )
    result = post(running, "/simulate", request)
    assert result["comparison"]["after"]["total_service_disruption_minutes"] == 360
    protected = post(running, "/simulate", {**request, "intervention_ids": ["segment-PWR-004"]})
    assert protected["comparison"]["after"]["total_service_disruption_minutes"] == 0
    assert protected["comparison"]["challenges"][0]["outcome"] == "route_disconnected"
    assert protected["risk_projection"] is not None
    direct = payload(running, intervention_ids=["segment-PWR-004"])
    result = post(running, "/simulate", direct)
    assert result["comparison"]["avoided_service_disruption_minutes"] == 0


def test_patch_prevents_only_its_explicitly_attributed_supported_cve(running):
    scenario = {
        "horizon_minutes": 120,
        "cyber_challenges": [
            {
                "id": "patchable",
                "entry_asset_id": "HLT-001",
                "target_asset_id": "HLT-007",
                "effect": "loss_of_control",
                "cve_id": "CVE-2022-0778",
            }
        ],
    }
    request = payload(running, scenario=scenario, intervention_ids=["patch-HLT-007"])
    result = post(running, "/simulate", request)
    assert result["comparison"]["challenges"][0]["outcome"] == "specified_cve_patched"
    assert result["comparison"]["after"]["total_service_disruption_minutes"] == 0
    del scenario["cyber_challenges"][0]["cve_id"]
    result = post(running, "/simulate", request)
    assert result["comparison"]["challenges"][0]["outcome"] == "assumed_compromise"
    assert result["comparison"]["avoided_service_disruption_minutes"] == 0


def test_stress_backup_failure_energy_and_extra_failure_recalculate_independently(running):
    request = payload(
        running,
        intervention_ids=["backup-PWR-010"],
        cases=[
            {"id": "failed", "failed_backup_ids": ["PWR-010"]},
            {
                "id": "half",
                "backup_capacity": [{"backup_asset_id": "PWR-010", "usable_energy_fraction": 0.5}],
            },
            {
                "id": "extra",
                "additional_failures": [
                    {"id": "extra-water", "asset_id": "WTR-008", "cause": "hardware_failure"}
                ],
            },
        ],
    )
    result = post(running, "/stress-test", request)
    assert result["nominal"]["comparison"]["after"]["total_service_disruption_minutes"] == 90
    assert result["cases"][0]["comparison"]["after"]["total_service_disruption_minutes"] == 1080
    assert result["cases"][1]["comparison"]["after"]["total_service_disruption_minutes"] == 360
    assert result["cases"][2]["comparison"]["after"]["total_service_disruption_minutes"] > 90
    assert (
        post(running, "/simulate", payload(running))["comparison"]["before"][
            "total_service_disruption_minutes"
        ]
        == 360
    )


@pytest.mark.parametrize(
    "change,code,status",
    [
        ({"baseline_fingerprint": "0" * 32}, "baseline_fingerprint_mismatch", 409),
        ({"snapshot_id": "other"}, "baseline_mismatch", 409),
        ({"run_id": "unknown"}, "baseline_not_found", 404),
        ({"catalog_fingerprint": "0" * 64}, "catalog_mismatch", 409),
        ({"intervention_ids": ["unsupported"]}, "unknown_intervention", 422),
        ({"intervention_ids": ["recover-PWR-008"] * 2}, "duplicate_value", 422),
        ({"intervention_ids": ["recover-PWR-008"] * 13}, "validation_error", 422),
        ({"undeclared": 1}, "validation_error", 422),
        ({"scenario": {"failures": []}}, "validation_error", 422),
        (
            {
                "scenario": {
                    "horizon_minutes": True,
                    "failures": [{"id": "f", "asset_id": "PWR-008", "cause": "power_loss"}],
                }
            },
            "validation_error",
            422,
        ),
        (
            {"scenario": {"failures": [{"id": "f", "asset_id": "UNKNOWN", "cause": "power_loss"}]}},
            "unknown_asset",
            422,
        ),
    ],
)
def test_invalid_requests_have_safe_structured_errors(running, change, code, status):
    response = post(running, "/simulate", {**payload(running), **change}, status)
    assert response["error"]["code"] == code


@pytest.mark.parametrize(
    "case",
    [
        {"id": "empty"},
        {"id": "unknown", "failed_backup_ids": ["PWR-008"]},
        {"id": "dup", "failed_backup_ids": ["PWR-010", "PWR-010"]},
        {
            "id": "bad",
            "backup_capacity": [{"backup_asset_id": "PWR-010", "usable_energy_fraction": -0.5}],
        },
        {
            "id": "bad",
            "additional_failures": [
                {"id": "power", "asset_id": "PWR-007", "cause": "hardware_failure"}
            ],
        },
    ],
)
def test_invalid_stress_cannot_silently_produce_a_plan(running, case):
    post(running, "/stress-test", payload(running, cases=[case]), 422)


def test_run_replaced_during_calculation_is_rejected_even_if_ids_and_scores_match(
    running, monkeypatch
):
    _, app, _, _ = running
    original = preventive.evaluate

    def replaced(ctx, body):
        result = original(ctx, body)
        monkeypatch.setattr(app.state, "simulation", replace(ctx))
        return result

    monkeypatch.setattr(preventive, "evaluate", replaced)
    result = post(running, "/simulate", payload(running), 409)
    assert result["error"]["code"] == "stale_baseline"


def test_phase6_golden_results_and_baseline_are_unchanged(running):
    client, _, bound, _ = running
    before = client.get("/api/v1/simulation/latest").json()
    assert before["city_risk"]["score"] == 35.62
    plan = client.post("/api/v1/actions/optimize", json={**bound, "effort_budget_hours": 60}).json()
    assert plan["ending_city_index"] == 27.72 and plan["used_hours"] == 56
    replay = client.post("/api/v1/actions/what-if", json=plan["what_if_request"])
    assert replay.status_code == 200 and replay.json()["projected_city_index"] == 27.72
    post(running, "/simulate", payload(running, intervention_ids=["recover-PWR-008"]))
    assert client.get("/api/v1/simulation/latest").json() == before
    paths = client.get("/api/v1/simulation/attack-paths", params=bound).json()
    assert len(paths["paths"]) == 15


@pytest.mark.parametrize(
    "change",
    [
        {"budget_credits": -1},
        {"budget_credits": True},
        {"effort_limit_hours": "24"},
        {"service_ids": ["missing-service"]},
        {"excluded_asset_ids": ["UNKNOWN"]},
        {"service_ids": ["svc-power", "svc-power"]},
    ],
)
def test_optimizer_rejects_invalid_constraints_and_scopes(running, change):
    request = {
        **payload(running),
        "intervention_ids": ["recover-PWR-008"],
        "budget_credits": 4,
        "effort_limit_hours": 8,
        "downtime_limit_hours": 1,
        **change,
    }
    post(running, "/optimize", request, 422)


def test_missing_reference_and_unsupported_capacity_model_are_unavailable_not_zero(
    running, monkeypatch
):
    _, app, bound, _ = running

    def unavailable(*args):
        raise inference.ReferenceUnavailable("Reference intentionally unavailable in boundary test")

    monkeypatch.setattr(app.state.simulation, "default_patch", unavailable)
    result = post(running, "/catalog", bound, 503)
    assert result["error"]["code"] == "reference_unavailable"
    assert "comparison" not in result


def test_fingerprint_is_mandatory_and_nonfinite_limits_do_not_pass(running):
    request = payload(running)
    del request["baseline_fingerprint"]
    post(running, "/simulate", request, 422)
    request = {
        **payload(running),
        "intervention_ids": ["recover-PWR-008"],
        "budget_credits": 4,
        "effort_limit_hours": 8,
        "downtime_limit_hours": 1,
    }
    import json

    raw = json.dumps(request).replace('"effort_limit_hours": 8', '"effort_limit_hours": NaN')
    response = running[0].post(
        PREFIX + "/optimize", content=raw, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422 and "error" in response.json()


def test_cve_effect_and_exposure_evidence_are_required(running):
    base = {
        "id": "challenge",
        "entry_asset_id": "HLT-001",
        "target_asset_id": "HLT-007",
        "effect": "loss_of_control",
    }
    for change, code in [
        ({"cve_id": "CVE-2099-999999"}, "cve_not_applicable"),
        ({"entry_asset_id": "HLT-004"}, "unsupported_entry"),
        ({"effect": "unavailability"}, "unsupported_challenge"),
    ]:
        result = post(
            running,
            "/simulate",
            payload(running, scenario={"cyber_challenges": [{**base, **change}]}),
            422,
        )
        assert result["error"]["code"] == code


def test_superseded_run_is_rejected_after_real_replacement(running):
    client, _, bound, _ = running
    assert client.post("/api/v1/simulation/run").status_code == 200
    result = post(running, "/simulate", payload(running), 409)
    assert result["error"]["code"] == "stale_baseline"
    assert client.post(PREFIX + "/catalog", json=bound).status_code == 409


def test_no_run_returns_conflict_without_a_result(tmp_path):
    with TestClient(create_app(tmp_path / "empty.sqlite3", static_dir=tmp_path / "s")) as client:
        response = client.post(
            PREFIX + "/catalog",
            json={
                "scenario_id": "aurora-city",
                "snapshot_id": "aurora-baseline-v1",
                "run_id": "none",
                "baseline_fingerprint": "a" * 32,
            },
        )
        assert response.status_code == 409
