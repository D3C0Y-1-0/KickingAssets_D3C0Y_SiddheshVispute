"""Read-only reproduction of Claude's conditional impact calculation on Aurora data."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.engine.impact import ENGINE_VERSION, ConditionalImpactEngine, ImpactPolicy  # noqa: E402
from app.schemas.models import ScenarioBundle  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", default="WTR-008")
    parser.add_argument(
        "--effect",
        choices=(
            "unavailability",
            "loss_of_control",
            "loss_of_visibility",
            "data_integrity",
        ),
        default="unavailability",
    )
    parser.add_argument("--horizon-minutes", type=int, default=1440)
    args = parser.parse_args()
    bundle = ScenarioBundle.model_validate_json(
        (ROOT / "data/scenarios/aurora-city.json").read_text(encoding="utf-8")
    )
    engine = ConditionalImpactEngine(
        ImpactPolicy(horizon_minutes=args.horizon_minutes), state="projected"
    )
    analysis = engine.analyze(bundle, {args.asset: args.effect})
    print(
        json.dumps(
            {
                "scenario_id": bundle.scenario.id,
                "snapshot_id": bundle.snapshot.snapshot_id,
                "assumed_effect": {args.asset: args.effect},
                "state": "projected",
                "engine_version": ENGINE_VERSION,
                "horizon_minutes": args.horizon_minutes,
                "limits": (
                    "Conditional simulation, not an outage prediction. No operator recovery. "
                    "Requirement backups do not relieve edge cascades: cascaded fractions "
                    "are an upper bound with respect to backups. Cyber edges are not read."
                ),
                "services": [
                    {
                        "service_id": service.service_id,
                        "status": service.status,
                        "disrupted_minutes": service.disrupted_minutes,
                        "disruption_fraction": service.disruption_fraction,
                        "fraction_without_cascade": service.fraction_without_cascade,
                        "explanation": service.explanation,
                    }
                    for service in analysis.services
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
