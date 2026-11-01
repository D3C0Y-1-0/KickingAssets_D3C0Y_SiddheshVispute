"""Verify the local demo using real API outputs; never trains or changes infrastructure.

Run Live Simulation first, or pass --run. --replace-baseline deliberately creates another
simulation at the end to verify stale-run rejection. Reports default to ignored artifacts/.
"""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument(
        "--run", action="store_true", help="Create the initial simulation"
    )
    parser.add_argument("--replace-baseline", action="store_true")
    parser.add_argument(
        "--output", type=Path, default=Path("artifacts/phase6-api-verification.json")
    )
    args = parser.parse_args()
    results = []

    def call(name, path, body=None, expected=200, code=None):
        request = Request(
            args.url.rstrip("/") + "/api/v1" + path,
            data=None if body is None else json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=240) as response:
                status, payload = response.status, json.load(response)
        except HTTPError as error:
            status, payload = error.code, json.load(error)
        if status != expected or code and payload.get("error", {}).get("code") != code:
            raise RuntimeError(f"{name}: HTTP {status}, expected {expected}: {payload}")
        results.append({"check": name, "status": status, "response": payload})
        print(f"PASS {name}: HTTP {status}", flush=True)
        return payload

    call("health", "/health")
    if args.run:
        call("initial simulation", "/simulation/run", {})
    run = call("latest simulation", "/simulation/latest")
    context = {key: run[key] for key in ("scenario_id", "snapshot_id")}
    bound = {**context, "run_id": run["id"], "baseline_fingerprint": run["fingerprint"]}
    query = urlencode(context)
    assets = call("inventory", "/assets?" + query)
    call("asset evidence", "/assets/PWR-001?" + query)
    call("curated applicability", "/vulnerabilities/assessment?" + query)
    call("curated references", "/vulnerabilities/references")
    call("curated priorities", "/intelligence?" + query)
    cyber = call("cyber graph", "/graph?" + query + "&type=cyber")
    operational = call("operational graph", "/graph?" + query + "&type=operational")
    model = call("model card", "/ml/overview")
    call("model readiness", "/ml/status")
    call("services", "/services?" + query)
    call("simulated activity", "/activity?" + query)
    call("asset activity", "/activity/assets/PWR-002?" + query)
    call("posture replay", "/simulation/trend?" + query)
    call("operational choke points", "/resilience/chokepoints?" + query)
    call("vendor scenarios", "/resilience/vendors?" + query)
    call("risk brief", "/reports/brief?" + query)
    call("action catalog", "/actions/catalog")
    call("bound action options", "/actions/options?" + urlencode({"run_id": run["id"]}))
    paths = call("bound attack paths", "/simulation/attack-paths?" + urlencode(bound))
    assert all(paths[key] == value for key, value in bound.items())
    expected_entries = sorted(
        asset["id"] for asset in assets if asset["security"]["internet_exposed"] is True
    )
    assert sorted(paths["entry_points"]) == expected_entries
    edge_by_id = {edge["id"]: edge for edge in cyber["edges"]}
    operational_ids = {edge["id"] for edge in operational["edges"]}
    for path in paths["paths"]:
        for hop in path["hops"]:
            if hop["edge_id"] is not None:
                edge = edge_by_id[hop["edge_id"]]
                assert hop["edge_id"] not in operational_ids
                assert (edge["source_asset_id"], edge["target_asset_id"]) == (
                    hop["source"],
                    hop["target"],
                )
    isolated = call(
        "isolated attack paths",
        "/simulation/attack-paths?" + urlencode({**bound, "isolate": "PWR-008"}),
    )
    assert isolated["state"] == "projected"
    assert not any("PWR-008" in path["nodes"] for path in isolated["paths"])
    call(
        "invalid isolation",
        "/simulation/attack-paths?" + urlencode({**bound, "isolate": "UNKNOWN"}),
        expected=422,
    )
    plan = call("60h plan", "/actions/optimize", {**bound, "effort_budget_hours": 60})
    assert plan["used_hours"] <= 60
    replay = call("exact plan replay", "/actions/what-if", plan["what_if_request"])
    assert replay["projected_city_index"] == plan["ending_city_index"]
    assert replay["constraint_report"]["total_effort_hours"] == plan["used_hours"]
    protected = call(
        "excluded target plan",
        "/actions/optimize",
        {**bound, "effort_budget_hours": 60, "excluded_asset_ids": ["HLT-008"]},
    )
    assert all(step["asset_id"] != "HLT-008" for step in protected["steps"])
    constraints = {"max_downtime_per_action_hours": 2, "max_total_downtime_hours": 4}
    constrained = call(
        "constrained plan",
        "/actions/optimize",
        {**bound, "effort_budget_hours": 60, "constraints": constraints},
    )
    assert constrained["used_downtime_hours"] <= 4
    assert all(step["downtime_hours"] <= 2 for step in constrained["steps"])
    access = {"asset_id": "PWR-001", "action_type": "access_control"}
    access_projection = call(
        "access control", "/actions/what-if", {**bound, "actions": [access]}
    )
    call(
        "invalid patch",
        "/actions/what-if",
        {
            **bound,
            "actions": [
                {
                    "asset_id": "PWR-001",
                    "action_type": "patch_prioritization",
                    "target_version": "not-a-version",
                }
            ],
        },
        422,
        "invalid_actions",
    )
    call(
        "incompatible actions",
        "/actions/what-if",
        {
            **bound,
            "actions": [
                access,
                {"asset_id": "PWR-001", "action_type": "network_segmentation"},
            ],
            "constraints": {
                "incompatible": [
                    {"first": "access_control", "second": "network_segmentation"}
                ]
            },
        },
        422,
        "constraint_violation",
    )
    call(
        "fingerprint mismatch",
        "/actions/what-if",
        {**bound, "baseline_fingerprint": "0" * 32, "actions": [access]},
        409,
        "baseline_fingerprint_mismatch",
    )
    assert call("baseline after projections", "/simulation/latest") == run
    if args.replace_baseline:
        replacement = call("replacement simulation", "/simulation/run?" + query, {})
        assert replacement["id"] != run["id"]
        call(
            "stale attack paths",
            "/simulation/attack-paths?" + urlencode(bound),
            expected=409,
            code="stale_baseline",
        )
        call(
            "stale plan replay",
            "/actions/what-if",
            plan["what_if_request"],
            409,
            "stale_baseline",
        )
    summary = {
        "verified_at": datetime.now(UTC).isoformat(),
        "checks": len(results),
        "scenario_id": run["scenario_id"],
        "snapshot_id": run["snapshot_id"],
        "run_id": run["id"],
        "fingerprint": run["fingerprint"],
        "as_of": run["as_of"],
        "baseline_city_index": run["city_risk"]["score"],
        "attack_entries": paths["entry_points"],
        "attack_paths": len(paths["paths"]),
        "isolated_paths": len(isolated["paths"]),
        "example_path": next(
            (path for path in paths["paths"] if path["target"] == "PWR-008"), None
        ),
        "plan_city_index": plan["ending_city_index"],
        "plan_effort_hours": plan["used_hours"],
        "plan_downtime_hours": plan["used_downtime_hours"],
        "plan_steps": plan["steps"],
        "constrained_city_index": constrained["ending_city_index"],
        "access_control_city_index": access_projection["projected_city_index"],
        "model_metrics": model["metrics"],
        "baseline_unchanged_by_projections": True,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps({"summary": summary, "checks": results}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
