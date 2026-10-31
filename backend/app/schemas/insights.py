"""Contracts for activity, resilience, posture trend and the risk brief. Additive to models.py.

Everything here is conditional or simulated and says so: telemetry is a labelled simulation,
vendor and chokepoint results are assumed-effect scenarios, and the trend is a replay.
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import AwareDatetime, Field

from app.schemas.models import Context, Contract, Id, Provenance, Sector
from app.schemas.simulation import Category, Effect, Fraction

Metric = Literal[
    "flows", "bytes_out_mb", "distinct_peers", "failed_logins", "off_hours_share", "ot_writes"
]
ActivityBand = Literal["calm", "elevated", "active"]
Unit = Annotated[float, Field(ge=0, le=1)]


# ----------------------------------------------------------------------------- activity (F1)


class MetricReading(Contract):
    metric: Metric
    label: str
    observed: float
    baseline: float
    z_score: float


class ActivityDay(Contract):
    day: date
    index: Annotated[float, Field(ge=0, le=100)]
    band: ActivityBand
    anomalous_assets: int


class AssetActivity(Contract):
    asset_id: Id
    asset_name: str
    sector: Sector
    criticality: Literal["essential", "important", "supporting"]
    anomaly: Unit
    consecutive_days: Annotated[int, Field(ge=0)]
    reasons: list[MetricReading]
    risk_score: float | None = None
    urgency: float | None = None


class ScenarioEvent(Contract):
    """An authored scenario event: part of the simulation, never an observed incident."""

    id: Id
    asset_id: Id
    title: str
    start: date
    end: date
    benign: bool
    description: str


class ActivityReport(Context):
    state: Literal["current"] = "current"
    as_of: date
    window_start: date
    window_end: date
    detector_version: str
    latest: ActivityDay
    series: list[ActivityDay]
    assets: list[AssetActivity]
    events: list[ScenarioEvent]
    urgency_available: bool
    urgency_note: str
    assumptions: list[str]
    provenance: Provenance


class MetricPoint(Contract):
    day: date
    value: float
    baseline: float
    z_score: float
    anomalous: bool


class MetricSeries(Contract):
    metric: Metric
    label: str
    points: list[MetricPoint]


class AssetActivitySeries(Context):
    asset_id: Id
    asset_name: str
    as_of: date
    series: list[MetricSeries]
    provenance: Provenance


# -------------------------------------------------------------------- resilience (F2 and F3)


class ServiceShare(Contract):
    service_id: Id
    service_name: str
    vendor_assets: int
    service_assets: int
    disruption: Fraction | None


class VendorRisk(Contract):
    vendor: str
    assets: list[Id]
    sectors: list[Sector]
    essential_assets: int
    kev_entries_total: int
    kev_entries_last_24_months: int
    kev_match_rule: str
    assumed_effects: dict[str, Effect]
    assets_lost: int
    worst_disruption: Fraction | None
    services: list[ServiceShare]


class ServiceConcentration(Contract):
    service_id: Id
    service_name: str
    hhi: Annotated[float, Field(ge=0, le=1)]
    top_vendor: str
    top_vendor_share: Unit


class VendorReport(Context):
    state: Literal["current"] = "current"
    vendors: list[VendorRisk]
    concentration: list[ServiceConcentration]
    kev_available: bool
    assumptions: list[str]
    engine_version: str
    calculated_at: AwareDatetime
    provenance: Provenance


class ChokepointScenario(Contract):
    effect: Effect
    assets_lost: int
    worst_disruption: Fraction | None
    services_fully_disrupted: list[Id]


class Chokepoint(Contract):
    asset_id: Id
    asset_name: str
    sector: Sector
    criticality: Literal["essential", "important", "supporting"]
    direct_dependents: int
    has_backup_edge: bool
    is_chokepoint: bool
    worst: ChokepointScenario | None
    scenarios: list[ChokepointScenario]
    reason: str


class ChokepointReport(Context):
    state: Literal["current"] = "current"
    chokepoints: list[Chokepoint]
    assumptions: list[str]
    engine_version: str
    calculated_at: AwareDatetime
    provenance: Provenance


# ------------------------------------------------------------------------- posture trend (F4)


class TrendPoint(Contract):
    as_of: date
    city_index: float | None
    category: Category | None
    critical: int
    high: int
    medium: int
    low: int
    unscored: int
    held_out: bool
    top_asset_ids: list[Id]


class PostureTrend(Context):
    status: Literal["computed", "unavailable"]
    unavailable_reason: str | None = None
    model_version: str | None = None
    scoring_version: str | None = None
    generated_at: AwareDatetime | None = None
    points: list[TrendPoint] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- risk brief (F5)


class BriefSection(Contract):
    title: str
    available: bool
    lines: list[str]


class RiskBrief(Context):
    run_id: str
    as_of: date
    model_version: str
    scoring_version: str
    generated_at: AwareDatetime
    sections: list[BriefSection]
    provenance: Provenance
