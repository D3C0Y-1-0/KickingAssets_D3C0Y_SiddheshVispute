"""Build the posture-trend artifact by replaying the simulation at past monthly snapshots.

Run from backend/ with the reference data cache present:

    python -m app.services.trend_build [--months 18]

Each point uses only information available at its date (the existing time-travel rule). The
trend reflects the changing public CVE, KEV and EPSS landscape against the ASSUMED products; it
is not a history of changes to the assets. Output: data/derived/posture-trend.json.
"""

import argparse
from datetime import UTC, datetime

from app.db.store import default_db_path, initialize
from app.domain.seed import SCENARIO_ID
from app.engine import risk as risk_engine
from app.schemas.insights import PostureTrend, TrendPoint
from app.services import simulation
from app.services.insights import TREND_PATH
from ml import inference

TOP_ASSETS = 3


def build(months: int) -> PostureTrend:
    target = default_db_path()
    initialize(target)
    scenario_id = SCENARIO_ID
    from app.services.inventory import Inventory

    scenario_id, snapshot_id = Inventory(target).context(scenario_id)
    dates = inference.available_snapshots()[-months:]
    points = []
    for as_of in dates:
        ctx = simulation.run_simulation(target, scenario_id, snapshot_id, as_of)
        run = ctx.run
        counts = {c.category: c.count for c in run.category_counts}
        scored = [a for a in run.assets if a.risk.score is not None]
        scored.sort(key=lambda a: (-(a.risk.score or 0), a.asset_id))
        points.append(
            TrendPoint(
                as_of=run.as_of,
                city_index=run.city_risk.score,
                category=run.city_risk.category,
                critical=counts.get("critical", 0),
                high=counts.get("high", 0),
                medium=counts.get("medium", 0),
                low=counts.get("low", 0),
                unscored=len(run.assets) - len(scored),
                held_out=run.held_out,
                top_asset_ids=[a.asset_id for a in scored[:TOP_ASSETS]],
            )
        )
        print(f"{run.as_of}: city index {run.city_risk.score}")
    return PostureTrend(
        scenario_id=scenario_id,
        snapshot_id=snapshot_id,
        status="computed",
        model_version=inference.MODEL_VERSION,
        scoring_version=risk_engine.SCORING_VERSION,
        generated_at=datetime.now(UTC),
        points=points,
        assumptions=[
            "Each point replays the whole workflow as of that month using only information "
            "available then: CVEs published, KEV additions and EPSS scores up to that date.",
            "Assets, assumed products, versions and configuration are held fixed, so the trend "
            "shows how the public vulnerability landscape moves against this estate, not changes "
            "to the estate.",
            "Points from 2025 onward are in the held-out test period of the model.",
            "The index is relative and uncalibrated; it is not an incident probability.",
        ],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--months", type=int, default=18)
    args = parser.parse_args()
    trend = build(args.months)
    TREND_PATH.parent.mkdir(parents=True, exist_ok=True)
    TREND_PATH.write_text(trend.model_dump_json(indent=2), encoding="utf-8")
    print(f"Wrote {TREND_PATH} ({len(trend.points)} points)")


if __name__ == "__main__":
    main()
