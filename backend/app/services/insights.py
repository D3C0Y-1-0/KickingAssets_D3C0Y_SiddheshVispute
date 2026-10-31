"""Read-only orchestration for activity, resilience and the posture trend.

Pure engines live in app.engine; this module loads inputs, calls them and shapes the contracts
in app.schemas.insights. Nothing here writes to the database.
"""

import json
from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta
from functools import lru_cache

from app.domain.product_profiles import load_product_map
from app.domain.seed import ROOT, SEED_PATH
from app.engine import resilience as resilience_engine
from app.engine import telemetry as tm
from app.engine.pivot import DEFAULT_EFFECT
from app.schemas.insights import (
    ActivityDay,
    ActivityReport,
    AssetActivity,
    AssetActivitySeries,
    Chokepoint,
    ChokepointReport,
    ChokepointScenario,
    MetricPoint,
    MetricReading,
    MetricSeries,
    PostureTrend,
    ScenarioEvent,
    ServiceConcentration,
    ServiceShare,
    VendorReport,
    VendorRisk,
)
from app.schemas.models import Provenance, ScenarioBundle

EVENTS_PATH = ROOT / "data" / "scenarios" / "aurora-telemetry-events.json"
KEV_PATH = ROOT / "data" / "reference" / "cache" / "kev" / "known_exploited_vulnerabilities.json"
TREND_PATH = ROOT / "data" / "derived" / "posture-trend.json"
KEV_MATCH_RULE = "case-insensitive: vendor name contained in the CISA vendorProject field"
EFFECT_LABEL = {
    "unavailability": "loss of availability",
    "loss_of_control": "loss of control",
}


class InsightInputError(ValueError):
    """The requested date or asset is not covered by the simulated telemetry."""


@lru_cache(maxsize=1)
def _events_doc() -> dict:
    return json.loads(EVENTS_PATH.read_text(encoding="utf-8"))


def load_events() -> list[tm.EventSpec]:
    doc = _events_doc()
    end = date.fromisoformat(doc["end_date"])
    return [
        tm.EventSpec(
            id=e["id"],
            asset_id=e["asset_id"],
            title=e["title"],
            start=end + timedelta(days=e["start_offset"]),
            end=end + timedelta(days=e["end_offset"]),
            benign=e["benign"],
            description=e["description"],
            effects=dict(e["effects"]),
        )
        for e in doc["events"]
    ]


@lru_cache(maxsize=1)
def _fixture_bundle() -> ScenarioBundle:
    return ScenarioBundle.model_validate_json(SEED_PATH.read_text(encoding="utf-8"))


_TELEMETRY: dict[tuple, tm.Telemetry] = {}


def telemetry_assets(bundle: ScenarioBundle) -> list[tm.AssetInfo]:
    return [tm.AssetInfo(a.id, a.asset_type, a.criticality) for a in bundle.assets]


def load_telemetry_inputs(
    bundle: ScenarioBundle | None = None,
) -> tuple[list[tm.AssetInfo], list[tm.EventSpec], tm.Telemetry]:
    bundle = bundle or _fixture_bundle()
    assets = telemetry_assets(bundle)
    events = load_events()
    doc = _events_doc()
    key = tuple((a.id, a.asset_type) for a in assets)
    if key not in _TELEMETRY:
        _TELEMETRY[key] = tm.generate(
            assets, events, date.fromisoformat(doc["end_date"]), doc["window_days"]
        )
    return assets, events, _TELEMETRY[key]


def _provenance(now: datetime, source: str, kind: str = "simulation") -> Provenance:
    return Provenance(
        kind=kind, source=source, recorded_at=now, notes=_events_doc()["provenance"]["notes"]
    )


# ----------------------------------------------------------------------------- activity (F1)


def activity_report(
    bundle: ScenarioBundle,
    as_of: date | None = None,
    scores: Mapping[str, float | None] | None = None,
) -> ActivityReport:
    assets, events, telemetry = load_telemetry_inputs(bundle)
    try:
        results = tm.detect(telemetry, assets, as_of)
    except ValueError as exc:
        raise InsightInputError(str(exc)) from exc
    latest = results[-1]
    by_id = {a.id: a for a in bundle.assets}
    rows = []
    for info in assets:
        day = latest.assets[info.id]
        asset = by_id[info.id]
        score = scores.get(info.id) if scores is not None else None
        rows.append(
            AssetActivity(
                asset_id=info.id,
                asset_name=asset.name,
                sector=asset.sector,
                criticality=asset.criticality,
                anomaly=day.anomaly,
                consecutive_days=day.consecutive,
                reasons=[
                    MetricReading(
                        metric=r.metric,
                        label=tm.LABELS[r.metric],
                        observed=r.observed,
                        baseline=r.baseline,
                        z_score=r.z,
                    )
                    for r in day.readings
                ],
                risk_score=score,
                urgency=tm.urgency(score, day.anomaly) if scores is not None else None,
            )
        )
    rows.sort(key=lambda r: (-r.anomaly, -(r.urgency if r.urgency is not None else -1), r.asset_id))
    now = datetime.now(UTC)
    return ActivityReport(
        scenario_id=bundle.scenario.id,
        snapshot_id=bundle.snapshot.snapshot_id,
        as_of=latest.day,
        window_start=telemetry.days[0],
        window_end=telemetry.days[-1],
        detector_version=tm.DETECTOR_VERSION,
        latest=ActivityDay(
            day=latest.day,
            index=latest.index,
            band=latest.band,
            anomalous_assets=latest.anomalous_assets,
        ),
        series=[
            ActivityDay(day=r.day, index=r.index, band=r.band, anomalous_assets=r.anomalous_assets)
            for r in results
        ],
        assets=rows,
        events=[
            ScenarioEvent(
                id=e.id,
                asset_id=e.asset_id,
                title=e.title,
                start=e.start,
                end=e.end,
                benign=e.benign,
                description=e.description,
            )
            for e in events
            if e.start <= latest.day
        ],
        urgency_available=scores is not None,
        urgency_note=(
            "urgency = risk score x (1 + 0.5 x anomaly). It is a prioritisation aid separate from "
            "the risk index."
            if scores is not None
            else "Run the simulation to compute risk scores; urgency is unavailable until then."
        ),
        assumptions=[
            "All telemetry is SIMULATED by a seeded generator plus authored scenario events; it "
            "is not observed traffic and describes no real organisation.",
            f"Detector: robust z-score against each asset's trailing {tm.BASELINE_DAYS}-day "
            f"baseline (median and scaled MAD); a metric is anomalous at z >= {tm.Z_THRESHOLD}. "
            "Only samples up to the as-of date are read.",
            "A flag means the metric deviates from its own baseline, not that an attack occurred. "
            "Benign changes such as planned maintenance are flagged too.",
            "The activity index combines asset anomaly scores as a noisy-OR, each scaled by criticality "
            f"and capped at {tm.CONTRIBUTION_CAP}: 100 x (1 - product of (1 - cap x share x anomaly)). "
            "One strongly anomalous essential asset therefore raises the city index.",
        ],
        provenance=_provenance(now, f"{tm.GENERATOR_VERSION} + {tm.DETECTOR_VERSION}"),
    )


def asset_activity_series(
    bundle: ScenarioBundle, asset_id: str, as_of: date | None = None
) -> AssetActivitySeries:
    assets, _, telemetry = load_telemetry_inputs(bundle)
    info = next((a for a in assets if a.id == asset_id), None)
    if info is None:
        raise InsightInputError(f"Unknown asset: {asset_id}")
    last = len(telemetry.days) - 1
    if as_of is not None:
        eligible = [i for i, d in enumerate(telemetry.days) if d <= as_of]
        if not eligible or eligible[-1] < tm.BASELINE_DAYS:
            raise InsightInputError("Not enough telemetry history at the requested date")
        last = eligible[-1]
    out = []
    for metric in tm.metrics_for(info.asset_type):
        values = telemetry.series[(asset_id, metric)]
        points = []
        for i in range(tm.BASELINE_DAYS, last + 1):
            z, baseline = tm.robust_z(values[i - tm.BASELINE_DAYS : i], values[i], metric)
            points.append(
                MetricPoint(
                    day=telemetry.days[i],
                    value=values[i],
                    baseline=baseline,
                    z_score=round(z, 2),
                    anomalous=z >= tm.Z_THRESHOLD,
                )
            )
        out.append(MetricSeries(metric=metric, label=tm.LABELS[metric], points=points))
    name = next(a.name for a in bundle.assets if a.id == asset_id)
    return AssetActivitySeries(
        scenario_id=bundle.scenario.id,
        snapshot_id=bundle.snapshot.snapshot_id,
        asset_id=asset_id,
        asset_name=name,
        as_of=telemetry.days[last],
        series=out,
        provenance=_provenance(
            datetime.now(UTC), f"{tm.GENERATOR_VERSION} + {tm.DETECTOR_VERSION}"
        ),
    )


# --------------------------------------------------------------------- resilience (F2 and F3)


@lru_cache(maxsize=1)
def _kev_entries() -> tuple[tuple[tuple[str, date], ...], date] | None:
    if not KEV_PATH.is_file():
        return None
    doc = json.loads(KEV_PATH.read_text(encoding="utf-8"))
    entries = tuple(
        (v["vendorProject"].lower(), date.fromisoformat(v["dateAdded"]))
        for v in doc["vulnerabilities"]
    )
    return entries, date.fromisoformat(doc["dateReleased"][:10])


def _kev_counts(vendor: str) -> tuple[int, int]:
    loaded = _kev_entries()
    if loaded is None:
        return 0, 0
    entries, released = loaded
    cutoff = released - timedelta(days=730)
    matched = [added for name, added in entries if vendor.lower() in name]
    return len(matched), sum(1 for added in matched if added >= cutoff)


def vendor_report(bundle: ScenarioBundle) -> VendorReport:
    products, _ = load_product_map()
    vendors = {asset_id: p.vendor for asset_id, p in products.items()}
    names = {s.id: s.name for s in bundle.services}
    assets = {a.id: a for a in bundle.assets}
    members = resilience_engine.service_assets(bundle)
    results = resilience_engine.vendor_scenarios(bundle, vendors, DEFAULT_EFFECT)
    out = []
    for r in results:
        fractions = {s.service_id: s.fraction for s in r.scenario.services}
        total, recent = _kev_counts(r.vendor)
        out.append(
            VendorRisk(
                vendor=r.vendor,
                assets=list(r.assets),
                sectors=sorted({assets[a].sector for a in r.assets}, key=str),
                essential_assets=sum(1 for a in r.assets if assets[a].criticality == "essential"),
                kev_entries_total=total,
                kev_entries_last_24_months=recent,
                kev_match_rule=KEV_MATCH_RULE,
                assumed_effects=dict(r.effects),
                assets_lost=r.scenario.assets_lost,
                worst_disruption=r.scenario.worst,
                services=[
                    ServiceShare(
                        service_id=sid,
                        service_name=names[sid],
                        vendor_assets=r.service_vendor_assets[sid],
                        service_assets=len(members[sid]),
                        disruption=fractions.get(sid),
                    )
                    for sid in sorted(names)
                ],
            )
        )
    now = datetime.now(UTC)
    return VendorReport(
        scenario_id=bundle.scenario.id,
        snapshot_id=bundle.snapshot.snapshot_id,
        vendors=out,
        concentration=[
            ServiceConcentration(
                service_id=c.service_id,
                service_name=names[c.service_id],
                hhi=c.hhi,
                top_vendor=c.top_vendor,
                top_vendor_share=c.top_share,
            )
            for c in resilience_engine.concentration(bundle, vendors)
        ],
        kev_available=_kev_entries() is not None,
        assumptions=[
            "Vendors come from the product map, which ASSUMES a real vendor and product for each "
            "fictional asset; it is not a scan result.",
            "A vendor compromise is an assumed what-if: every asset of that vendor suffers its "
            "default effect for its type at the same moment (the update or management channel "
            "is assumed compromised). It is not a prediction that it will happen.",
            "Disruption comes from the conditional impact engine over operational dependencies "
            "only, assuming no operator recovery, so figures are an upper bound.",
            "KEV counts are CISA entries whose vendorProject contains the vendor name, as "
            "context only; they do not enter the scenario.",
            "HHI is the sum of squared vendor shares among a service's mapped assets (1 means a "
            "single vendor).",
        ],
        engine_version=resilience_engine.ENGINE_VERSION,
        calculated_at=now,
        provenance=Provenance(
            kind="simulation",
            source=f"GridSentinel {resilience_engine.ENGINE_VERSION} over the conditional impact engine",
            recorded_at=now,
            notes="Conditional on the listed assumptions; not an incident prediction.",
        ),
    )


def chokepoint_report(bundle: ScenarioBundle) -> ChokepointReport:
    assets = {a.id: a for a in bundle.assets}
    names = {s.id: s.name for s in bundle.services}
    rows = []
    for r in resilience_engine.chokepoints(bundle):
        scenarios = [
            ChokepointScenario(
                effect=effect,
                assets_lost=s.assets_lost,
                worst_disruption=s.worst,
                services_fully_disrupted=list(s.fully_disrupted()),
            )
            for effect, s in r.scenarios.items()
        ]
        worst = next(s for s in scenarios if s.effect == r.worst_effect)
        asset = assets[r.asset_id]
        if r.is_chokepoint:
            affected = ", ".join(names[s] for s in worst.services_fully_disrupted)
            reason = (
                f"{EFFECT_LABEL[worst.effect].capitalize()} alone fully disrupts {affected} and "
                f"takes down {worst.assets_lost} assets in total"
            )
        else:
            reason = "No single-asset loss fully disrupts a service"
        reason += (
            f"; {r.direct_dependents} direct dependent{'' if r.direct_dependents == 1 else 's'}; "
            + ("a backup edge involves this asset." if r.has_backup_edge else "no backup edge.")
        )
        rows.append(
            Chokepoint(
                asset_id=r.asset_id,
                asset_name=asset.name,
                sector=asset.sector,
                criticality=asset.criticality,
                direct_dependents=r.direct_dependents,
                has_backup_edge=r.has_backup_edge,
                is_chokepoint=r.is_chokepoint,
                worst=worst,
                scenarios=scenarios,
                reason=reason,
            )
        )
    now = datetime.now(UTC)
    return ChokepointReport(
        scenario_id=bundle.scenario.id,
        snapshot_id=bundle.snapshot.snapshot_id,
        chokepoints=rows,
        assumptions=[
            "Each asset is lost on its own under loss of availability and under loss of control; "
            "these are assumed effects, not predictions.",
            "A chokepoint fully disrupts at least one essential service on its own.",
            "Impact reads operational dependencies only and assumes no operator recovery, so it "
            "is an upper bound; edge-level backups do not relieve cascades.",
        ],
        engine_version=resilience_engine.ENGINE_VERSION,
        calculated_at=now,
        provenance=Provenance(
            kind="simulation",
            source=f"GridSentinel {resilience_engine.ENGINE_VERSION} over the conditional impact engine",
            recorded_at=now,
            notes="Conditional on the listed assumptions; not an incident prediction.",
        ),
    )


# ------------------------------------------------------------------------------------ trend


def posture_trend(scenario_id: str, snapshot_id: str) -> PostureTrend:
    if not TREND_PATH.is_file():
        return PostureTrend(
            scenario_id=scenario_id,
            snapshot_id=snapshot_id,
            status="unavailable",
            unavailable_reason="The posture trend has not been built. Run "
            "`python -m app.services.trend_build` from backend/ with the reference data present.",
        )
    trend = PostureTrend.model_validate_json(TREND_PATH.read_text(encoding="utf-8"))
    if (trend.scenario_id, trend.snapshot_id) != (scenario_id, snapshot_id):
        return PostureTrend(
            scenario_id=scenario_id,
            snapshot_id=snapshot_id,
            status="unavailable",
            unavailable_reason="The stored trend was built for a different snapshot.",
        )
    return trend
