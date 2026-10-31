"""Phase 5A: run binding, request validation, CVE-specific patching, constraints, planner."""

from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.domain.seed import SCENARIO_ID, SNAPSHOT_ID
from app.main import create_app
from app.schemas.simulation import OperationalConstraints
from app.services import remediation as R
from ml import inference
from ml.matching import AffectedIndex

CONTEXT = {"scenario_id": SCENARIO_ID, "snapshot_id": SNAPSHOT_ID}
needs_ml = pytest.mark.skipif(
    not inference.status()["ready"], reason="local reference data or model not available"
)

# ------------------------------------------------------------- fixed-version evidence (no ML)


def _affected(rows):
    return AffectedIndex(
        pd.DataFrame(
            rows,
            columns=["vendor", "product", "cve_id", "version", "less_than", "less_than_or_equal"],
        )
    )


def test_fixed_versions_use_only_documented_less_than_bounds():
    index = _affected(
        [
            ("acme", "plc", "CVE-2024-0001", "0", "3.5", None),  # fixed in 3.5
            (
                "acme",
                "plc",
                "CVE-2024-0002",
                "0",
                None,
                "3.9",
            ),  # affected through 3.9, no fix named
            ("acme", "plc", "CVE-2024-0003", "0", "3.4", None),  # two ranges contain 3.1
            ("acme", "plc", "CVE-2024-0003", "3.0", "3.7", None),
            ("acme", "plc", "CVE-2024-0004", "0", "3.0", None),  # does not contain 3.1
            ("acme", "plc", "CVE-2024-0005", "0", "3.6", None),  # one range has no usable fix
            ("acme", "plc", "CVE-2024-0005", "3.0", None, "3.2"),
        ]
    )
    fixed = index.fixed_versions("acme", ["plc"], "3.1")
    assert fixed["CVE-2024-0001"] == "3.5"
    assert fixed["CVE-2024-0002"] is None  # inclusive bound only: a fix is not established
    assert fixed["CVE-2024-0003"] == "3.7"  # leaving every containing range needs the highest
    assert fixed["CVE-2024-0005"] is None  # any undocumented range makes the CVE undocumented
    assert "CVE-2024-0004" not in fixed
    assert index.fixed_versions("acme", ["plc"], "no digits") == {}


def _evidence():
    listed = pd.DataFrame(
        {
            "cve_id": ["CVE-2024-0100"],
            "published": [pd.Timestamp("2024-01-01")],
            "applicability": ["version_confirmed"],
        }
    )
    unlisted = pd.DataFrame(
        {
            "cve_id": ["CVE-2024-0001", "CVE-2024-0002", "CVE-2024-0003", "CVE-2024-0004"],
            "ml_score": [0.9, 0.8, 0.7, 0.6],
            "applicability": ["version_confirmed"] * 3 + ["version_unknown"],
        }
    )
    return SimpleNamespace(listed=listed, unlisted=unlisted)


FIXED = {
    "CVE-2024-0001": "3.5",
    "CVE-2024-0002": None,
    "CVE-2024-0003": "3.8",
    "CVE-2024-0100": None,
}


def _resolve(cve_ids=None, target=None, excluded=(), confirmed=(), version="3.1"):
    return R.resolve_patch(
        evidence=_evidence(),
        fixed=FIXED,
        match_at=lambda v: SimpleNamespace(excluded=set(excluded), confirmed=set(confirmed)),
        current_version=version,
        cve_ids=cve_ids,
        target_version=target,
        base_effort=8,
        path="actions[0]",
    )


def test_default_patch_remediates_only_cves_with_a_documented_fix():
    resolution, issues = _resolve()
    assert not issues and resolution.scope == "default_batch"
    # The KEV-listed CVE and the second-ranked CVE have no documented fix: reported, not assumed.
    assert [r.cve_id for r in resolution.remediated] == ["CVE-2024-0001", "CVE-2024-0003"]
    assert {r.cve_id for r in resolution.not_remediated} == {"CVE-2024-0100", "CVE-2024-0002"}
    assert all(r.status == "fix_version_not_documented" for r in resolution.not_remediated)


def test_explicit_cve_patch_is_scoped_to_the_named_cves():
    resolution, _ = _resolve(cve_ids=["CVE-2024-0003", "CVE-2024-0002"])
    assert resolution.cves == {"CVE-2024-0003"}
    assert [r.cve_id for r in resolution.not_remediated] == ["CVE-2024-0002"]
    assert resolution.remediated[0].fixed_in == "3.8"


def test_patch_for_a_cve_the_asset_does_not_have_is_rejected():
    resolution, issues = _resolve(cve_ids=["CVE-2024-0001", "CVE-1999-0001", "CVE-2024-0001"])
    assert resolution is None
    assert {i.code for i in issues} == {"cve_not_applicable", "duplicate_cve"}


def test_target_version_remediates_only_what_nvd_ranges_support():
    resolution, issues = _resolve(
        target="3.6", excluded={"CVE-2024-0001"}, confirmed={"CVE-2024-0002", "CVE-2024-0003"}
    )
    assert not issues and resolution.scope == "target_version"
    status = {r.cve_id: r.status for r in resolution.remediated + resolution.not_remediated}
    assert status["CVE-2024-0001"] == "remediated"
    assert status["CVE-2024-0002"] == "not_resolved_by_target_version"
    assert status["CVE-2024-0100"] == "applicability_unestablished"  # NVD cannot say either way
    assert resolution.cves == {"CVE-2024-0001"}


@pytest.mark.parametrize("target", ["3.1", "2.0", "latest"])
def test_target_version_must_be_newer_and_parseable(target):
    resolution, issues = _resolve(target=target)
    assert resolution is None and [i.code for i in issues] == ["invalid_target_version"]


def test_constraint_sets_that_cannot_be_satisfied_are_rejected():
    def issues(**kw):
        return {i.code for i in R.validate_constraints(OperationalConstraints(**kw))}

    assert issues(incompatible=[{"first": "access_control", "second": "access_control"}]) == {
        "invalid_constraint"
    }
    assert "prerequisite_cycle" in issues(
        prerequisites=[
            {"action": "network_segmentation", "requires": "access_control"},
            {"action": "access_control", "requires": "network_segmentation"},
        ]
    )
    assert "unsatisfiable_constraints" in issues(
        prerequisites=[{"action": "network_segmentation", "requires": "access_control"}],
        incompatible=[{"first": "network_segmentation", "second": "access_control"}],
    )
    assert issues(max_total_downtime_hours=8) == set()


def test_check_plan_reports_each_violation_and_each_passed_check():
    planned = [
        R.PlannedAction("actions[0]", "A", "network_segmentation", 24, 6),
        R.PlannedAction("actions[1]", "A", "access_control", 12, 1),
    ]
    bad = OperationalConstraints(
        max_downtime_per_action_hours=4,
        max_total_downtime_hours=5,
        incompatible=[{"first": "network_segmentation", "second": "access_control"}],
        prerequisites=[{"action": "access_control", "requires": "incident_response_plan"}],
    )
    issues, _ = R.check_plan(planned, bad)
    assert {i.code for i in issues} == {
        "exceeds_maintenance_window",
        "exceeds_downtime_budget",
        "incompatible_actions",
        "missing_prerequisite",
    }
    ok = OperationalConstraints(max_downtime_per_action_hours=6, max_total_downtime_hours=7)
    issues, checks = R.check_plan(planned, ok)
    assert not issues and len(checks) == 2


# ------------------------------------------------------------------------------ API fixtures


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    path = tmp_path_factory.mktemp("phase5")
    with TestClient(create_app(path / "t.sqlite3", static_dir=path / "s")) as c:
        yield c


@pytest.fixture(scope="module")
def run(client):
    if not inference.status()["ready"]:
        pytest.skip("local reference data or model not available")
    response = client.post("/api/v1/simulation/run")
    assert response.status_code == 200, response.text
    return response.json()


def bound(client):
    latest = client.get("/api/v1/simulation/latest").json()
    return {**CONTEXT, "run_id": latest["id"]}


def what_if(client, actions, **extra):
    return client.post(
        "/api/v1/actions/what-if", json={**bound(client), "actions": actions, **extra}
    )


def optimize(client, hours, **extra):
    return client.post(
        "/api/v1/actions/optimize", json={**bound(client), "effort_budget_hours": hours, **extra}
    )


def codes(response):
    return {i["code"] for i in response.json()["error"]["issues"]}


def act(asset_id, action_type, **extra):
    return {"asset_id": asset_id, "action_type": action_type, **extra}


def exposed_asset(run):
    return next(a["asset_id"] for a in run["assets"] if a["exposure_factor"] > 0.5)


# ------------------------------------------------------------------------------ run binding


@needs_ml
def test_what_if_is_bound_to_the_run_and_echoes_its_fingerprint(client, run):
    response = what_if(client, [act("PWR-001", "access_control")])
    assert response.status_code == 200, response.text
    result = response.json()
    latest = client.get("/api/v1/simulation/latest").json()
    assert (
        result["run_id"] == latest["id"] and result["baseline_fingerprint"] == latest["fingerprint"]
    )
    pinned = what_if(
        client, [act("PWR-001", "access_control")], baseline_fingerprint=latest["fingerprint"]
    )
    assert pinned.status_code == 200


@needs_ml
def test_missing_unknown_and_mismatched_baselines_are_rejected(client, run):
    body = {**bound(client), "actions": [act("PWR-001", "access_control")]}
    no_run = {k: v for k, v in body.items() if k != "run_id"}
    assert client.post("/api/v1/actions/what-if", json=no_run).status_code == 422
    unknown = client.post("/api/v1/actions/what-if", json={**body, "run_id": "run-nope"})
    assert unknown.status_code == 404 and unknown.json()["error"]["code"] == "baseline_not_found"
    fingerprint = client.post(
        "/api/v1/actions/what-if", json={**body, "baseline_fingerprint": "0" * 32}
    )
    assert fingerprint.status_code == 409
    assert fingerprint.json()["error"]["code"] == "baseline_fingerprint_mismatch"
    snapshot = client.post("/api/v1/actions/what-if", json={**body, "snapshot_id": "other"})
    assert snapshot.status_code == 409 and snapshot.json()["error"]["code"] == "baseline_mismatch"
    plan = client.post(
        "/api/v1/actions/optimize", json={**body, "actions": None, "effort_budget_hours": 20}
    )
    assert plan.status_code in (409, 422)  # extra field is rejected, not ignored


@needs_ml
def test_a_superseded_run_is_stale_for_what_if_optimize_and_options(client, run):
    old = bound(client)["run_id"]
    assert client.post("/api/v1/simulation/run").status_code == 200
    body = {**CONTEXT, "run_id": old}
    stale = client.post(
        "/api/v1/actions/what-if", json={**body, "actions": [act("PWR-001", "access_control")]}
    )
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "stale_baseline"
    message = stale.json()["error"]["issues"][0]["message"]
    assert "identical" in message  # same inputs, so the fix is simply to rebind
    assert (
        client.post(
            "/api/v1/actions/optimize", json={**body, "effort_budget_hours": 20}
        ).status_code
        == 409
    )
    assert client.get("/api/v1/actions/options", params={"run_id": old}).status_code == 409
    assert (
        client.get(
            "/api/v1/actions/options", params={"run_id": bound(client)["run_id"]}
        ).status_code
        == 200
    )


@needs_ml
def test_same_inputs_give_the_same_fingerprint_and_projection(client, run):
    first = client.get("/api/v1/simulation/latest").json()
    again = client.post("/api/v1/simulation/run").json()
    assert first["fingerprint"] == again["fingerprint"] and first["id"] != again["id"]
    actions = [
        act(exposed_asset(first), "network_segmentation"),
        act("HLT-007", "patch_prioritization"),
    ]
    a = what_if(client, actions).json()
    b = what_if(client, actions).json()
    assert a == b


# ------------------------------------------------------------------------------ validation


@needs_ml
def test_duplicate_actions_are_rejected_with_a_pointer_to_the_first(client, run):
    response = what_if(
        client,
        [
            act("PWR-001", "access_control"),
            act("HLT-007", "patch_prioritization"),
            act("PWR-001", "access_control"),
        ],
    )
    assert response.status_code == 422
    issue = response.json()["error"]["issues"][0]
    assert issue["code"] == "duplicate_action" and issue["path"] == "actions[2]"
    assert "actions[0]" in issue["message"]


@needs_ml
def test_unknown_assets_are_rejected_not_skipped(client, run):
    response = what_if(client, [act("NOPE-1", "access_control"), act("PWR-001", "access_control")])
    assert response.status_code == 422 and codes(response) == {"unknown_asset"}
    plan = optimize(client, 40, excluded_asset_ids=["NOPE-1", "PWR-001", "PWR-001"])
    assert plan.status_code == 422 and codes(plan) == {"unknown_asset", "duplicate_exclusion"}


@needs_ml
def test_parameters_and_preconditions_are_validated(client, run):
    misplaced = what_if(client, [act("PWR-001", "access_control", target_version="9.9")])
    assert codes(misplaced) == {"parameter_not_applicable"}
    options = client.get("/api/v1/actions/options").json()
    inapplicable = next(o for o in options if not o["applicable"] and o["modelled"])
    response = what_if(client, [act(inapplicable["asset_id"], inapplicable["action_type"])])
    assert response.status_code == 422 and codes(response) == {"action_not_applicable"}
    assert "does not apply" in response.json()["error"]["issues"][0]["message"]
    bad_cve = what_if(client, [act("HLT-007", "patch_prioritization", cve_ids=["CVE-1999-0001"])])
    assert bad_cve.status_code == 422 and codes(bad_cve) == {"cve_not_applicable"}
    malformed = what_if(client, [act("HLT-007", "patch_prioritization", cve_ids=["not-a-cve"])])
    assert malformed.status_code == 422
    older = what_if(client, [act("HLT-007", "patch_prioritization", target_version="1.0")])
    assert codes(older) == {"invalid_target_version"}


@needs_ml
def test_every_problem_is_reported_at_once(client, run):
    response = what_if(
        client,
        [
            act("NOPE-1", "access_control"),
            act("PWR-001", "access_control"),
            act("PWR-001", "access_control"),
        ],
    )
    error = response.json()["error"]
    assert error["code"] == "invalid_actions" and len(error["issues"]) == 2
    assert error["details"] and all(": " in d for d in error["details"])


@needs_ml
def test_invalid_is_distinct_from_valid_with_zero_modelled_reduction(client, run):
    recommendation = what_if(client, [act("PWR-001", "enhanced_monitoring")])
    assert recommendation.status_code == 200
    assert recommendation.json()["applied"][0]["outcome"] == "recommendation_only"
    # FortiOS 7.0.12 has no documented fixed version in NVD: valid request, nothing remediated.
    patch = what_if(client, [act("PWR-001", "patch_prioritization")])
    assert patch.status_code == 200, patch.text
    applied = patch.json()["applied"][0]
    assert applied["outcome"] == "no_modelled_reduction" and patch.json()["city_reduction"] == 0
    assert applied["patch"]["remediated"] == []
    assert applied["patch"]["not_remediated"][0]["status"] == "fix_version_not_documented"
    assert any("not an error" in n for n in patch.json()["notes"])


# ------------------------------------------------------------------------------ patch modelling


@needs_ml
def test_patch_is_cve_specific_and_never_marks_unsupported_cves_fixed(client, run):
    full = what_if(client, [act("HLT-007", "patch_prioritization")]).json()["applied"][0]
    fixed = [r["cve_id"] for r in full["patch"]["remediated"]]
    assert fixed and all(r["fixed_in"] for r in full["patch"]["remediated"])
    one = what_if(client, [act("HLT-007", "patch_prioritization", cve_ids=fixed[:1])]).json()
    patch = one["applied"][0]["patch"]
    assert (
        patch["scope"] == "explicit_cves"
        and [r["cve_id"] for r in patch["remediated"]] == fixed[:1]
    )
    assert (
        one["city_reduction"]
        <= what_if(client, [act("HLT-007", "patch_prioritization")]).json()["city_reduction"]
    )


@needs_ml
def test_declared_target_version_must_be_supported_by_nvd_ranges(client, run):
    default = what_if(client, [act("PWR-001", "patch_prioritization")]).json()
    assert default["city_reduction"] == 0  # no documented fix
    upgraded = what_if(client, [act("PWR-001", "patch_prioritization", target_version="99.0.0")])
    assert upgraded.status_code == 200, upgraded.text
    patch = upgraded.json()["applied"][0]["patch"]
    assert patch["scope"] == "target_version" and patch["remediated"]
    statuses = {r["status"] for r in patch["remediated"] + patch["not_remediated"]}
    assert statuses <= {
        "remediated",
        "not_resolved_by_target_version",
        "applicability_unestablished",
    }
    assert upgraded.json()["city_reduction"] > 0
    # An in-between version only fixes what its ranges exclude; the rest is reported as such.
    partial = what_if(client, [act("PWR-001", "patch_prioritization", target_version="7.0.13")])
    if partial.status_code == 200:
        p = partial.json()["applied"][0]["patch"]
        assert len(p["remediated"]) <= len(patch["remediated"])


# ------------------------------------------------------------------------------ constraints


@needs_ml
def test_maintenance_and_downtime_constraints_are_enforced_in_what_if(client, run):
    target = exposed_asset(run)
    plan = [act(target, "network_segmentation"), act("HLT-007", "patch_prioritization")]
    window = what_if(client, plan, constraints={"max_downtime_per_action_hours": 4})
    assert window.status_code == 422 and window.json()["error"]["code"] == "constraint_violation"
    assert codes(window) == {"exceeds_maintenance_window"}
    total = what_if(client, plan, constraints={"max_total_downtime_hours": 5})
    assert codes(total) == {"exceeds_downtime_budget"}
    fits = what_if(
        client,
        plan,
        constraints={"max_total_downtime_hours": 8, "max_downtime_per_action_hours": 6},
    )
    assert fits.status_code == 200
    report = fits.json()["constraint_report"]
    assert report["total_downtime_hours"] == 8 and report["checks"]


@needs_ml
def test_incompatible_and_prerequisite_rules_apply_per_asset(client, run):
    target = exposed_asset(run)
    both = [act(target, "network_segmentation"), act(target, "access_control")]
    clash = what_if(
        client,
        both,
        constraints={
            "incompatible": [{"first": "access_control", "second": "network_segmentation"}]
        },
    )
    assert clash.status_code == 422 and codes(clash) == {"incompatible_actions"}
    other_asset = what_if(
        client,
        [act(target, "network_segmentation"), act("HLT-007", "patch_prioritization")],
        constraints={
            "incompatible": [{"first": "patch_prioritization", "second": "network_segmentation"}]
        },
    )
    assert other_asset.status_code == 200  # the rule is per asset
    missing = what_if(
        client,
        [act(target, "network_segmentation")],
        constraints={
            "prerequisites": [
                {"action": "network_segmentation", "requires": "incident_response_plan"}
            ]
        },
    )
    assert codes(missing) == {"missing_prerequisite"}
    present = what_if(
        client,
        [act(target, "network_segmentation"), act(target, "incident_response_plan")],
        constraints={
            "prerequisites": [
                {"action": "network_segmentation", "requires": "incident_response_plan"}
            ]
        },
    )
    assert present.status_code == 200
    broken = what_if(
        client,
        both,
        constraints={"prerequisites": [{"action": "access_control", "requires": "access_control"}]},
    )
    assert codes(broken) == {"invalid_constraint"}


# ---------------------------------------------------------------- overlap and recomputation


@needs_ml
def test_overlapping_actions_are_not_double_counted(client, run):
    target = exposed_asset(run)
    result = what_if(
        client, [act(target, "access_control"), act(target, "network_segmentation")]
    ).json()
    applied = result["applied"]
    marginals = [a["marginal_city_reduction"] for a in applied]
    standalone = [a["standalone_city_reduction"] for a in applied]
    assert sum(marginals) == pytest.approx(result["city_reduction"], abs=0.02)
    assert result["city_reduction"] <= sum(standalone) + 0.02
    assert result["summary"]["overlap_adjustment"] >= -0.02
    assert marginals[1] < standalone[1]  # the second action adds less than it would alone


@needs_ml
def test_segmentation_recomputes_conditional_impact_for_other_assets(client, run):
    result = what_if(client, [act("HLT-008", "network_segmentation")]).json()
    changed = [
        d
        for d in result["asset_deltas"]
        if d["asset_id"] != "HLT-008" and d["projected_score"] != d["current_score"]
    ]
    assert changed, "isolating a hub must change the pivot impact of assets that routed through it"
    assert result["services_after"] != result["services_before"] or result["city_reduction"] > 0
    assert (
        result["summary"]["projected_category_counts"] != []
        and result["summary"]["current_category_counts"] != []
    )


@needs_ml
def test_baseline_run_is_immutable(client, run):
    before = client.get("/api/v1/simulation/latest").json()
    what_if(
        client,
        [act(exposed_asset(run), "network_segmentation"), act("HLT-007", "patch_prioritization")],
    )
    optimize(client, 80)
    after = client.get("/api/v1/simulation/latest").json()
    assert before == after
    result = what_if(client, [act("PWR-001", "access_control")]).json()
    assert result["current_city_index"] == before["city_risk"]["score"]
    scores = {a["asset_id"]: a["risk"]["score"] for a in before["assets"]}
    assert all(d["current_score"] == scores[d["asset_id"]] for d in result["asset_deltas"])


# ------------------------------------------------------------------------------ optimizer


@needs_ml
@pytest.mark.parametrize("budget", [8, 24, 33, 60, 120])
def test_effort_budget_is_never_exceeded(client, run, budget):
    plan = optimize(client, budget).json()
    assert plan["used_hours"] <= budget
    assert sum(s["effort_hours"] for s in plan["steps"]) == pytest.approx(plan["used_hours"])
    previous = plan["starting_city_index"]
    for step in plan["steps"]:
        assert step["marginal_reduction"] > 0 and step["city_index_after"] < previous
        previous = step["city_index_after"]


@needs_ml
def test_optimizer_is_deterministic_including_rejections(client, run):
    a = optimize(client, 60).json()
    b = optimize(client, 60).json()
    assert a == b


@needs_ml
def test_exclusions_are_strictly_respected_and_explained(client, run):
    plan = optimize(client, 80).json()
    excluded = [s["asset_id"] for s in plan["steps"][:2]]
    without = optimize(client, 80, excluded_asset_ids=excluded).json()
    assert not {s["asset_id"] for s in without["steps"]} & set(excluded)
    assert not {a["asset_id"] for a in without["what_if_request"]["actions"]} & set(excluded)
    reasons = {(r["asset_id"], r["reason_code"]) for r in without["rejected"]}
    assert all((asset, "asset_excluded") in reasons for asset in excluded)
    assert not any(o["asset_id"] in excluded for o in without["recommendation_only"])


@needs_ml
def test_rejected_candidates_carry_a_reason_and_selected_ones_are_absent(client, run):
    plan = optimize(client, 60).json()
    chosen = {(s["asset_id"], s["action_type"]) for s in plan["steps"]}
    assert plan["rejected"] and not chosen & {
        (r["asset_id"], r["action_type"]) for r in plan["rejected"]
    }
    assert all(r["reason"] for r in plan["rejected"])
    assert {r["reason_code"] for r in plan["rejected"]} <= {
        "asset_excluded",
        "not_applicable",
        "no_modelled_reduction",
        "increases_modelled_risk",
        "exceeds_effort_budget",
        "exceeds_maintenance_window",
        "exceeds_downtime_budget",
        "incompatible_with_selected",
        "prerequisite_not_applicable",
    }
    assert plan["optimality"] == "greedy_heuristic"
    assert any("not proven optimal" in text for text in plan["limitations"])


@needs_ml
def test_zero_benefit_patches_are_rejected_with_the_evidence_gap(client, run):
    plan = optimize(client, 400).json()
    row = next(
        r
        for r in plan["rejected"]
        if r["asset_id"] == "PWR-001" and r["action_type"] == "patch_prioritization"
    )
    assert (
        row["reason_code"] == "no_modelled_reduction"
        and "no documented fixed version" in row["reason"]
    )


@needs_ml
def test_optimizer_enforces_downtime_incompatibility_and_prerequisites(client, run):
    limited = optimize(client, 200, constraints={"max_total_downtime_hours": 6}).json()
    assert limited["used_downtime_hours"] <= 6
    assert any(r["reason_code"] == "exceeds_downtime_budget" for r in limited["rejected"])
    windowed = optimize(client, 200, constraints={"max_downtime_per_action_hours": 3}).json()
    assert all(s["action_type"] != "network_segmentation" for s in windowed["steps"])
    exclusive = optimize(
        client,
        200,
        constraints={
            "incompatible": [{"first": "network_segmentation", "second": "access_control"}]
        },
    ).json()
    pairs = {}
    for s in exclusive["steps"]:
        pairs.setdefault(s["asset_id"], set()).add(s["action_type"])
    assert not any({"network_segmentation", "access_control"} <= kinds for kinds in pairs.values())
    rules = {
        "prerequisites": [{"action": "network_segmentation", "requires": "incident_response_plan"}]
    }
    planned = optimize(client, 120, constraints=rules).json()
    assert planned["used_hours"] <= 120
    for i, step in enumerate(planned["steps"]):
        if step["action_type"] == "network_segmentation":
            before = planned["steps"][i - 1]
            assert before["kind"] == "prerequisite" and before["asset_id"] == step["asset_id"]
            assert before["action_type"] == "incident_response_plan"
            assert before["prerequisite_for"] == "network_segmentation"
    assert any(s["kind"] == "prerequisite" for s in planned["steps"])


@needs_ml
def test_plan_hands_off_to_what_if_and_reproduces_the_projection(client, run):
    for constraints in (None, {"max_total_downtime_hours": 10}):
        extra = {"constraints": constraints} if constraints else {}
        plan = optimize(client, 60, **extra).json()
        handoff = plan["what_if_request"]
        assert handoff["run_id"] == plan["run_id"]
        result = client.post("/api/v1/actions/what-if", json=handoff)
        assert result.status_code == 200, result.text
        assert result.json()["projected_city_index"] == pytest.approx(
            plan["ending_city_index"], abs=0.01
        )
        assert (
            result.json()["constraint_report"]["total_downtime_hours"]
            == plan["used_downtime_hours"]
        )


@needs_ml
def test_nothing_to_do_yields_an_empty_plan_without_a_handoff(client, run):
    plan = optimize(client, 1).json()  # cheaper than every action
    assert plan["steps"] == [] and plan["what_if_request"] is None
    assert plan["ending_city_index"] == plan["starting_city_index"]


@needs_ml
def test_regression_reference_scenario_still_runs(client, run):
    """The Phase 5 demo (60 h budget) is a reference, not a pinned result: the corrected patch
    model may legitimately differ, but the baseline and the invariants must hold."""
    plan = optimize(client, 60).json()
    assert plan["starting_city_index"] == pytest.approx(run["city_risk"]["score"], abs=0.01)
    assert 0 < plan["used_hours"] <= 60 and plan["ending_city_index"] < plan["starting_city_index"]
    assert plan["steps"][0]["action_type"] in {
        "network_segmentation",
        "patch_prioritization",
        "access_control",
    }
