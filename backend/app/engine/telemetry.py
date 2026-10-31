"""Simulated network telemetry and a transparent anomaly detector. Pure; no I/O.

The telemetry is a SIMULATION: a seeded generator draws daily metrics from per-asset-type
profiles, and authored scenario events (see data/scenarios/aurora-telemetry-events.json) are
injected on top. Nothing here is observed traffic. The detector is a robust z-score against the
asset's own trailing baseline, so every flag can be explained by metric, observed value,
baseline and score.
"""

import hashlib
import math
import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median

GENERATOR_VERSION = "telemetry-sim-v1"
DETECTOR_VERSION = "activity-detector-v1"
WINDOW_DAYS = 60
BASELINE_DAYS = 28
Z_THRESHOLD = 3.5
MAD_SCALE = 1.4826
RELATIVE_FLOOR = 0.10
PERSISTENCE_BONUS = 0.1
CONTRIBUTION_CAP = 0.6
BANDS = ((40.0, "active"), (15.0, "elevated"), (0.0, "calm"))
CRITICALITY_WEIGHT = {"essential": 3.0, "important": 2.0, "supporting": 1.0}

METRICS = (
    "flows",
    "bytes_out_mb",
    "distinct_peers",
    "failed_logins",
    "off_hours_share",
    "ot_writes",
)
LABELS = {
    "flows": "Network flows per day",
    "bytes_out_mb": "Outbound volume (MB)",
    "distinct_peers": "Distinct peers contacted",
    "failed_logins": "Failed logins",
    "off_hours_share": "Share of traffic outside working hours",
    "ot_writes": "OT write commands",
}
# Smallest believable spread per metric, so quiet metrics do not turn a tiny change into a huge z.
ABSOLUTE_FLOOR = {
    "flows": 20.0,
    "bytes_out_mb": 1.0,
    "distinct_peers": 1.0,
    "failed_logins": 1.0,
    "off_hours_share": 0.03,
    "ot_writes": 2.0,
}
_COUNTS = {"flows", "distinct_peers", "failed_logins", "ot_writes"}

# (mean, relative noise) per asset type and metric. Scenario assumptions, not measurements.
PROFILES: Mapping[str, Mapping[str, tuple[float, float]]] = {
    "gateway": {
        "flows": (12000, 0.10),
        "bytes_out_mb": (900, 0.12),
        "distinct_peers": (140, 0.10),
        "failed_logins": (25, 0.25),
        "off_hours_share": (0.35, 0.10),
    },
    "controller": {
        "flows": (800, 0.05),
        "bytes_out_mb": (12, 0.08),
        "distinct_peers": (4, 0.15),
        "failed_logins": (1, 0.50),
        "off_hours_share": (0.45, 0.05),
        "ot_writes": (40, 0.10),
    },
    "workstation": {
        "flows": (3000, 0.15),
        "bytes_out_mb": (150, 0.20),
        "distinct_peers": (25, 0.15),
        "failed_logins": (2, 0.50),
        "off_hours_share": (0.06, 0.30),
    },
    "server": {
        "flows": (9000, 0.12),
        "bytes_out_mb": (600, 0.15),
        "distinct_peers": (60, 0.12),
        "failed_logins": (4, 0.40),
        "off_hours_share": (0.25, 0.15),
    },
    "sensor": {
        "flows": (300, 0.05),
        "bytes_out_mb": (2, 0.10),
        "distinct_peers": (2, 0.10),
        "failed_logins": (1, 0.60),
        "off_hours_share": (0.50, 0.04),
    },
    "backup": {
        "flows": (1500, 0.30),
        "bytes_out_mb": (2500, 0.35),
        "distinct_peers": (6, 0.20),
        "failed_logins": (1, 0.50),
        "off_hours_share": (0.70, 0.10),
    },
}
_OFFICE_TYPES = {"gateway", "workstation", "server"}


@dataclass(frozen=True, slots=True)
class AssetInfo:
    id: str
    asset_type: str
    criticality: str


@dataclass(frozen=True, slots=True)
class EventSpec:
    id: str
    asset_id: str
    title: str
    start: date
    end: date
    benign: bool
    description: str
    effects: Mapping[str, float]


@dataclass(frozen=True, slots=True)
class Telemetry:
    days: tuple[date, ...]
    series: Mapping[tuple[str, str], tuple[float, ...]]


@dataclass(frozen=True, slots=True)
class Reading:
    metric: str
    observed: float
    baseline: float
    z: float


@dataclass(frozen=True, slots=True)
class AssetDay:
    asset_id: str
    anomaly: float
    consecutive: int
    readings: tuple[Reading, ...]


@dataclass(frozen=True, slots=True)
class DayResult:
    day: date
    index: float
    band: str
    anomalous_assets: int
    assets: Mapping[str, AssetDay]


def band(index: float) -> str:
    return next(name for floor, name in BANDS if index >= floor)


def _rng(*parts: object) -> random.Random:
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def metrics_for(asset_type: str) -> tuple[str, ...]:
    return tuple(m for m in METRICS if m in PROFILES[asset_type])


def generate(
    assets: Sequence[AssetInfo],
    events: Sequence[EventSpec],
    end: date,
    window_days: int = WINDOW_DAYS,
) -> Telemetry:
    """Deterministic daily telemetry for `window_days` days ending on `end` (inclusive)."""
    days = tuple(end - timedelta(days=window_days - 1 - i) for i in range(window_days))
    by_asset: dict[str, list[EventSpec]] = {}
    for event in events:
        by_asset.setdefault(event.asset_id, []).append(event)
    series: dict[tuple[str, str], tuple[float, ...]] = {}
    for asset in sorted(assets, key=lambda a: a.id):
        profile = PROFILES[asset.asset_type]
        scale = 0.8 + 0.45 * _rng(asset.id, "scale").random()
        for metric in metrics_for(asset.asset_type):
            mean, noise = profile[metric]
            values: list[float] = []
            for day in days:
                rng = _rng(asset.id, metric, day.isoformat())
                weekend = day.weekday() >= 5 and asset.asset_type in _OFFICE_TYPES
                level = mean * (scale if metric != "off_hours_share" else 1.0)
                if weekend and metric in {"flows", "bytes_out_mb", "distinct_peers"}:
                    level *= 0.7
                value = level * (1 + noise * rng.gauss(0, 1))
                for event in by_asset.get(asset.id, ()):
                    if event.start <= day <= event.end and metric in event.effects:
                        value *= event.effects[metric]
                value = max(0.0, value)
                if metric == "off_hours_share":
                    value = min(1.0, value)
                values.append(float(round(value)) if metric in _COUNTS else round(value, 4))
            series[(asset.id, metric)] = tuple(values)
    return Telemetry(days=days, series=series)


def robust_z(history: Sequence[float], observed: float, metric: str) -> tuple[float, float]:
    """(z, baseline median) of `observed` against `history` using median and scaled MAD."""
    centre = median(history)
    spread = median(abs(h - centre) for h in history) * MAD_SCALE
    scale = max(spread, RELATIVE_FLOOR * abs(centre), ABSOLUTE_FLOOR[metric])
    return (observed - centre) / scale, centre


def anomaly_score(z_max: float, consecutive: int) -> float:
    if z_max < Z_THRESHOLD:
        return 0.0
    base = 1 - math.exp(-(z_max - Z_THRESHOLD) / 4)
    return round(min(1.0, base + PERSISTENCE_BONUS * max(0, consecutive - 1)), 4)


def _asset_day(
    telemetry: Telemetry, asset: AssetInfo, index: int, previous_streak: int
) -> AssetDay:
    readings = []
    for metric in metrics_for(asset.asset_type):
        values = telemetry.series[(asset.id, metric)]
        z, baseline = robust_z(values[index - BASELINE_DAYS : index], values[index], metric)
        readings.append(Reading(metric, values[index], baseline, round(z, 2)))
    anomalous = [r for r in readings if r.z >= Z_THRESHOLD]
    streak = previous_streak + 1 if anomalous else 0
    z_max = max((r.z for r in readings), default=0.0)
    return AssetDay(
        asset.id,
        anomaly_score(z_max, streak),
        streak,
        tuple(sorted(anomalous, key=lambda r: -r.z)),
    )


def detect(
    telemetry: Telemetry, assets: Sequence[AssetInfo], as_of: date | None = None
) -> list[DayResult]:
    """Daily results from the first day with a full baseline up to `as_of` (inclusive).

    Only samples on or before each day are read, so a past `as_of` can never see later data.
    """
    last = len(telemetry.days) - 1
    if as_of is not None:
        eligible = [i for i, d in enumerate(telemetry.days) if d <= as_of]
        if not eligible:
            raise ValueError("No telemetry on or before the requested date")
        last = eligible[-1]
    if last < BASELINE_DAYS:
        raise ValueError("Not enough history for a baseline at the requested date")
    ordered = sorted(assets, key=lambda a: a.id)
    streaks = {a.id: 0 for a in ordered}
    results: list[DayResult] = []
    for index in range(BASELINE_DAYS, last + 1):
        per_asset = {}
        for asset in ordered:
            day = _asset_day(telemetry, asset, index, streaks[asset.id])
            streaks[asset.id] = day.consecutive
            per_asset[asset.id] = day
        quiet = 1.0
        for asset in ordered:
            share = CRITICALITY_WEIGHT.get(asset.criticality, 1.0) / max(
                CRITICALITY_WEIGHT.values()
            )
            quiet *= 1 - CONTRIBUTION_CAP * share * per_asset[asset.id].anomaly
        value = round(100.0 * (1 - quiet), 2)
        results.append(
            DayResult(
                telemetry.days[index],
                value,
                band(value),
                sum(1 for d in per_asset.values() if d.anomaly > 0),
                per_asset,
            )
        )
    return results


def urgency(risk_score: float | None, anomaly: float) -> float | None:
    """risk x (1 + 0.5 x anomaly). None when the asset has no computed risk score."""
    return None if risk_score is None else round(risk_score * (1 + 0.5 * anomaly), 2)
