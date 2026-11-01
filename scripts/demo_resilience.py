"""Reproduce Phase 7 with actual local API outputs, without changing infrastructure.

Run the app from this branch first. --run creates a new Aurora October 2026 simulation;
otherwise the current matching run is required. Full responses stay in ignored artifacts/.
"""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--run", action="store_true")
    parser.add_argument(
        "--output", type=Path, default=Path("artifacts/phase7-demo.json")
    )
    args = parser.parse_args()
    responses = []

    def call(name, path, body=None):
        request = Request(
            args.url.rstrip("/") + "/api/v1" + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json"},
        )
        with urlopen(request, timeout=240) as response:
            result = json.load(response)
        responses.append({"check": name, "response": result})
        print(f"PASS {name}", flush=True)
        return result

    if args.run:
        call("October 2026 Aurora simulation", "/simulation/run?as_of=2026-10-01", {})
    run = call("baseline", "/simulation/latest")
    if (run["scenario_id"], run["snapshot_id"], run["as_of"]) != (
        "aurora-city",
        "aurora-baseline-v1",
        "2026-10-01",
    ):
        raise ValueError(
            "This named-asset demo needs Aurora baseline / 2026-10-01; use --run"
        )
    bound = {
        "scenario_id": run["scenario_id"],
        "snapshot_id": run["snapshot_id"],
        "run_id": run["id"],
        "baseline_fingerprint": run["fingerprint"],
    }
    prefix = "/resilience/preventive"
    cat = call("catalog", prefix + "/catalog", bound)
    request = {
        **bound,
        "catalog_fingerprint": cat["catalog_fingerprint"],
        "scenario": {
            "horizon_minutes": 360,
            "failures": [{"id": "power", "asset_id": "PWR-008", "cause": "power_loss"}],
        },
        "intervention_ids": [],
    }
    baseline = call("power-loss scenario", prefix + "/simulate", request)
    restored = call(
        "prepared recovery",
        prefix + "/simulate",
        {**request, "intervention_ids": ["recover-PWR-008"]},
    )
    plan = call(
        "best feasible subset",
        prefix + "/optimize",
        {
            **request,
            "intervention_ids": [
                "recover-PWR-008",
                "backup-PWR-010",
                "segment-PWR-004",
            ],
            "budget_credits": 12,
            "effort_limit_hours": 24,
            "downtime_limit_hours": 6,
        },
    )
    stressed = call(
        "standby stress scenarios",
        prefix + "/stress-test",
        {
            **request,
            "intervention_ids": ["backup-PWR-010"],
            "cases": [
                {"id": "backup-failed", "failed_backup_ids": ["PWR-010"]},
                {
                    "id": "half-energy",
                    "backup_capacity": [
                        {"backup_asset_id": "PWR-010", "usable_energy_fraction": 0.5}
                    ],
                },
                {
                    "id": "extra-water-failure",
                    "additional_failures": [
                        {
                            "id": "water",
                            "asset_id": "WTR-008",
                            "cause": "hardware_failure",
                        }
                    ],
                },
            ],
        },
    )
    attack = {
        **request,
        "scenario": {
            "horizon_minutes": 120,
            "cyber_challenges": [
                {
                    "id": "candidate-path",
                    "entry_asset_id": "PWR-001",
                    "target_asset_id": "PWR-008",
                    "effect": "data_integrity",
                }
            ],
        },
        "intervention_ids": ["segment-PWR-004"],
    }
    segmented = call("cyber-only route prevention", prefix + "/simulate", attack)
    old_plan = call(
        "unchanged Phase 6 60h plan",
        "/actions/optimize",
        {**bound, "effort_budget_hours": 60},
    )
    old_replay = call(
        "unchanged Phase 6 What-If", "/actions/what-if", old_plan["what_if_request"]
    )
    paths = call(
        "unchanged Phase 6 attack report",
        "/simulation/attack-paths?" + urlencode(bound),
    )
    after = call("baseline immutability", "/simulation/latest")
    assert after == run
    assert (
        run["city_risk"]["score"],
        old_plan["ending_city_index"],
        old_replay["projected_city_index"],
    ) == (35.62, 27.72, 27.72)
    assert len(paths["paths"]) == 15
    assert plan["comparison"] == restored["comparison"]
    summary = {
        "verified_at": datetime.now(UTC).isoformat(),
        "api_checks": len(responses),
        "run_id": run["id"],
        "baseline_fingerprint": run["fingerprint"],
        "catalog_fingerprint": cat["catalog_fingerprint"],
        "horizon_minutes": 360,
        "baseline_service_minutes": baseline["comparison"]["before"][
            "total_service_disruption_minutes"
        ],
        "recovery_service_minutes": restored["comparison"]["after"][
            "total_service_disruption_minutes"
        ],
        "best_interventions": [a["id"] for a in plan["interventions"]],
        "cost_credits": plan["cost_credits"],
        "effort_hours": plan["effort_hours"],
        "downtime_hours": plan["downtime_hours"],
        "stress_nominal_minutes": stressed["nominal"]["comparison"]["after"][
            "total_service_disruption_minutes"
        ],
        "stress_projected_minutes": {
            c["case"]["id"]: c["comparison"]["after"][
                "total_service_disruption_minutes"
            ]
            for c in stressed["cases"]
        },
        "segmented_service_minutes": segmented["comparison"]["after"][
            "total_service_disruption_minutes"
        ],
        "phase6_city_index": run["city_risk"]["score"],
        "phase6_plan_city_index": old_plan["ending_city_index"],
        "phase6_paths": len(paths["paths"]),
        "baseline_unchanged": True,
        "state": "projected",
        "verification": "not_verified",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps({"summary": summary, "responses": responses}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
