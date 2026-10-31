"""Contracts for the simulation, ML section and action stage. Additive to schemas/models.py."""

from datetime import date
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, Field

from app.schemas.models import Context, Contract, Id, RiskAssessment, Score, Sector

Effect = Literal["loss_of_control", "loss_of_visibility", "data_integrity", "unavailability"]
Category = Literal["low", "medium", "high", "critical"]
ActionType = Literal[
    "patch_prioritization",
    "network_segmentation",
    "access_control",
    "enhanced_monitoring",
    "incident_response_plan",
]
Fraction = Annotated[float, Field(ge=0, le=1)]


class Driver(Contract):
    feature: str
    label: str
    value: float | None
    contribution: float


class AssumedProduct(Contract):
    """The real product and version a fictional asset is ASSUMED to run (scenario assumption)."""

    asset_id: Id
    label: str
    vendor: str
    product: str
    version: str
    nvd_vendor: str
    product_filters: list[str]
    role: str


class MatchSummary(Contract):
    """How NVD affected-version ranges relate to the assumed version."""

    version_confirmed: int
    version_unknown: int
    excluded_by_version: int
    kev_listed: int
    scored: int
    product_known: bool


class YearHistory(Contract):
    year: int
    cves_published: int
    kev_added: int


class AssetHistory(Contract):
    """Real vulnerability history of the assumed product family up to the snapshot."""

    by_year: list[YearHistory]
    product_cves_total: int
    product_kev_listed: int
    vendor_kev_total: int
    vendor_kev_last_90d: int
    vendor_cve_total: int
    product_kev_total: int
    first_kev_added: date | None = None
    last_kev_added: date | None = None


class CandidateCve(Contract):
    cve_id: str
    published: date
    status: Literal["scored", "kev_listed"]
    ml_score: float | None = None
    priority_percentile: Fraction | None = None
    epss_percentile: Fraction | None = None
    cvss_score: float | None = None
    kev_added: date | None = None
    applicability: Literal["version_confirmed", "version_unknown"] = "version_confirmed"
    outcome: Literal["added_to_kev", "not_added_in_window", "window_open"] | None = None
    outcome_date: date | None = None
    drivers: list[Driver] = Field(default_factory=list)


class ServiceDisruption(Contract):
    service_id: Id
    service_name: str
    disruption_fraction: Fraction


class WorstScenario(Contract):
    """Worst plausible consequence if an attacker pivots along configured routes.

    Reachability is a configured route, not a successful compromise; the effect at each target
    is an explicit assumption."""

    target_asset_id: Id
    target_asset_name: str
    effect: Effect
    path: list[Id]
    max_disruption_fraction: Fraction
    services: list[ServiceDisruption]


class AssetSimulation(Contract):
    asset_id: Id
    name: str
    sector: Sector
    asset_type: str
    criticality: str
    product: AssumedProduct
    matching: MatchSummary
    history: AssetHistory
    candidate_count: int
    known_exploited_count: int
    vulnerability_signal: Fraction | None
    top_vulnerabilities: list[CandidateCve]
    exposure_factor: Fraction
    impact_factor: Fraction
    worst_scenario: WorstScenario | None
    risk: RiskAssessment


class ServiceRisk(Contract):
    service_id: Id
    name: str
    sector: Sector
    worst_disruption_fraction: Fraction
    initiating_asset_id: Id | None
    initiating_asset_name: str | None
    effect: Effect | None


class SimulationStage(Contract):
    name: str
    detail: str
    seconds: float


class ProgressStep(Contract):
    name: str
    detail: str
    seconds: float | None
    status: Literal["pending", "active", "done"]


class SimulationProgress(Contract):
    status: Literal["idle", "running", "done", "failed"]
    steps: list[ProgressStep]
    note: str | None


class CategoryCount(Contract):
    category: Category
    count: int


class BacktestGroup(Contract):
    label: str
    cves: int
    hits: int
    hit_rate: float


class BacktestHit(Contract):
    cve_id: str
    assets: list[Id]
    priority_percentile: Fraction
    epss_percentile: Fraction | None
    kev_added: date


class Backtest(Contract):
    """What actually happened after the simulated date, from the real KEV catalog."""

    as_of: date
    split: str
    held_out: bool
    window_days: int
    window_closed: bool
    cves_evaluated: int
    became_kev: int
    groups: list[BacktestGroup]
    hits: list[BacktestHit]
    note: str


class SnapshotOption(Contract):
    as_of: date
    split: str
    held_out: bool
    outcome_window_closed: bool


class SimulationRun(Context):
    id: str
    fingerprint: str
    state: Literal["current"] = "current"
    as_of: date
    as_of_split: str
    held_out: bool
    backtest: Backtest | None = None
    kev_released: date
    model_version: str
    created_at: AwareDatetime
    stages: list[SimulationStage]
    city_risk: RiskAssessment
    category_counts: list[CategoryCount]
    assets: list[AssetSimulation]
    services: list[ServiceRisk]
    assumptions: list[str]
    formula: str


class ActionDefinition(Contract):
    type: ActionType
    name: str
    description: str
    modelled: bool
    effort_hours: float
    downtime_hours: float
    operational_disruption: str
    assumption: str


class ActionOption(Contract):
    asset_id: Id
    asset_name: str
    action_type: ActionType
    name: str
    applicable: bool
    modelled: bool
    effort_hours: float
    projected_asset_score: Score | None
    asset_reduction: float | None
    city_reduction: float | None
    justification: str
    operational_disruption: str


CveId = Annotated[str, Field(pattern=r"^CVE-\d{4}-\d{4,}$")]
Fingerprint = Annotated[str, Field(min_length=8, max_length=64)]


class StagedActionRequest(Contract):
    asset_id: Id
    action_type: ActionType
    cve_ids: list[CveId] | None = Field(
        default=None,
        min_length=1,
        max_length=25,
        description="patch_prioritization only: the exact CVEs this patch targets. Omit for the "
        "default batch (highest-priority CVEs with a documented fixed version).",
    )
    target_version: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description="patch_prioritization only: the software version the asset is upgraded to. "
        "A CVE counts as remediated only if NVD affected ranges exclude this version.",
    )


class ActionPair(Contract):
    first: ActionType
    second: ActionType


class ActionPrerequisite(Contract):
    action: ActionType
    requires: ActionType


class OperationalConstraints(Contract):
    """Deterministic planning limits. Hours are modelled assumptions, not a schedule."""

    max_downtime_per_action_hours: float | None = Field(
        default=None, gt=0, le=1000, description="Longest single maintenance window available."
    )
    max_total_downtime_hours: float | None = Field(default=None, ge=0, le=100000)
    incompatible: list[ActionPair] = Field(
        default_factory=list,
        max_length=20,
        description="Action types that must not both be applied to the same asset.",
    )
    prerequisites: list[ActionPrerequisite] = Field(
        default_factory=list,
        max_length=20,
        description="`action` on an asset requires `requires` on the same asset.",
    )


class BaselineBinding(Context):
    """Pins a request to the exact simulation run whose results are the baseline."""

    run_id: str = Field(min_length=1, max_length=120)
    baseline_fingerprint: Fingerprint | None = Field(
        default=None,
        description="Optional: fingerprint of the run's results; rejected if it does not match.",
    )


class WhatIfRequest(BaselineBinding):
    actions: list[StagedActionRequest] = Field(min_length=1, max_length=40)
    constraints: OperationalConstraints | None = None


CveStatus = Literal[
    "remediated",
    "fix_version_not_documented",
    "not_resolved_by_target_version",
    "applicability_unestablished",
]
ActionOutcome = Literal[
    "reduces_modelled_risk",
    "no_modelled_reduction",
    "recommendation_only",
    "increases_modelled_risk",
]


class CveRemediation(Contract):
    cve_id: str
    status: CveStatus
    applicability: Literal["version_confirmed", "version_unknown"]
    fixed_in: str | None
    reason: str


class PatchOutcome(Contract):
    """Which CVEs a patch is modelled to remediate, and which it is not."""

    scope: Literal["explicit_cves", "default_batch", "target_version"]
    target_version: str | None
    remediated: list[CveRemediation]
    not_remediated: list[CveRemediation]


class AssetDelta(Contract):
    asset_id: Id
    name: str
    current_score: Score
    projected_score: Score
    current_category: Category
    projected_category: Category


class AppliedAction(Contract):
    asset_id: Id
    asset_name: str
    action_type: ActionType
    name: str
    modelled: bool
    effect: str
    effort_hours: float
    downtime_hours: float
    operational_disruption: str
    outcome: ActionOutcome
    standalone_city_reduction: float | None = Field(
        default=None, description="City-index reduction if this were the only action."
    )
    marginal_city_reduction: float | None = Field(
        default=None,
        description="Added reduction in request order after the earlier actions; these sum to the "
        "total, so overlapping benefits are counted once.",
    )
    patch: PatchOutcome | None = None


class ConstraintReport(Contract):
    constraints_supplied: bool
    total_effort_hours: float
    total_downtime_hours: float
    checks: list[str]


class ProjectionSummary(Contract):
    """Calculated current versus projected metrics (projected = estimate, not verified)."""

    current_city_index: Score
    projected_city_index: Score
    city_reduction: float
    current_category_counts: list[CategoryCount]
    projected_category_counts: list[CategoryCount]
    overlap_adjustment: float = Field(
        description="Sum of standalone reductions minus the joint reduction: the benefit that "
        "would have been double counted if actions were simply added up."
    )


class WhatIfResult(Context):
    state: Literal["projected"] = "projected"
    verification: Literal["not_verified"] = "not_verified"
    run_id: str
    baseline_fingerprint: str
    current_city_index: Score
    projected_city_index: Score
    city_reduction: float
    summary: ProjectionSummary
    constraint_report: ConstraintReport
    applied: list[AppliedAction]
    asset_deltas: list[AssetDelta]
    services_before: list[ServiceRisk]
    services_after: list[ServiceRisk]
    notes: list[str]


class OptimizeRequest(BaselineBinding):
    effort_budget_hours: Annotated[float, Field(gt=0, le=10000)]
    excluded_asset_ids: list[Id] = Field(default_factory=list, max_length=100)
    constraints: OperationalConstraints | None = None


class PlanStep(Contract):
    rank: int
    kind: Literal["selected", "prerequisite"] = "selected"
    prerequisite_for: str | None = None
    asset_id: Id
    asset_name: str
    action_type: ActionType
    name: str
    effort_hours: float
    downtime_hours: float
    marginal_reduction: float
    reduction_per_effort_hour: float
    cumulative_reduction: float
    city_index_after: Score
    justification: str
    operational_disruption: str
    patch: PatchOutcome | None = None


class RejectedCandidate(Contract):
    asset_id: Id
    action_type: ActionType
    reason_code: Literal[
        "asset_excluded",
        "not_applicable",
        "no_modelled_reduction",
        "increases_modelled_risk",
        "exceeds_effort_budget",
        "exceeds_maintenance_window",
        "exceeds_downtime_budget",
        "incompatible_with_selected",
        "prerequisite_not_applicable",
    ]
    reason: str


class PlanHandoffRequest(WhatIfRequest):
    """Same shape as WhatIfRequest; a separate name keeps request and response schemas distinct."""


class RemediationPlan(Context):
    state: Literal["projected"] = "projected"
    verification: Literal["not_verified"] = "not_verified"
    run_id: str
    baseline_fingerprint: str
    optimality: Literal["greedy_heuristic"] = "greedy_heuristic"
    effort_budget_hours: float
    used_hours: float
    used_downtime_hours: float
    starting_city_index: Score
    ending_city_index: Score
    steps: list[PlanStep]
    rejected: list[RejectedCandidate]
    recommendation_only: list[ActionOption]
    what_if_request: PlanHandoffRequest | None = Field(
        description="Ready to POST to /actions/what-if to reproduce this plan's projection. "
        "Null when the plan has no steps."
    )
    method: str
    limitations: list[str]


class MlSource(Contract):
    name: str
    kind: Literal["real"] = "real"
    role: str
    url: str
    files: int
    megabytes: float
    note: str


class MlMetricRow(Contract):
    name: str
    average_precision: float
    average_precision_ci95: list[float]
    roc_auc: float
    precision_at_50_per_month: float
    recall_at_50_per_month: float
    precision_at_200_per_month: float
    ap_delta_vs_epss_ci95: list[float] | None = None
    is_baseline: bool


class FeatureImportance(Contract):
    feature: str
    label: str
    mean_abs_contribution: float


class MlStatus(Contract):
    ready: bool
    missing: list[str]


class MlOverview(Contract):
    status: MlStatus
    model_version: str | None = None
    task: str | None = None
    not_claimed: list[str] = Field(default_factory=list)
    sources: list[MlSource] = Field(default_factory=list)
    manifest_retrieved_at: str | None = None
    nvd_release_tag: str | None = None
    panel: dict[str, Any] = Field(default_factory=dict)
    design: dict[str, Any] = Field(default_factory=dict)
    leakage_controls: list[str] = Field(default_factory=list)
    metrics: list[MlMetricRow] = Field(default_factory=list)
    prevalence: float | None = None
    shuffled_label_audit: dict[str, float] = Field(default_factory=dict)
    importances: list[FeatureImportance] = Field(default_factory=list)
    ap_by_quarter: dict[str, dict[str, float]] = Field(default_factory=dict)
    features: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class CveScore(Contract):
    cve_id: str
    status: Literal["scored", "already_in_kev", "too_recent"]
    published: date
    as_of: date
    model_version: str
    ml_score: float | None = None
    priority_percentile: Fraction | None = None
    epss_percentile: Fraction | None = None
    cvss_score: float | None = None
    kev_added: date | None = None
    drivers: list[Driver] = Field(default_factory=list)


class ProductMap(Contract):
    provenance_note: str
    products: list[AssumedProduct]


class PooledHit(Contract):
    cve_id: str
    assets: list[Id]
    first_flagged: date
    kev_added: date
    best_priority_percentile: Fraction
    epss_percentile: Fraction | None


class PooledBacktest(Contract):
    """Held-out months pooled: how often this city's applicable CVEs later entered real KEV."""

    first_snapshot: date
    last_snapshot: date
    snapshots: int
    pairs_evaluated: int
    hit_pairs: int
    distinct_hit_cves: int
    groups: list[BacktestGroup]
    hits: list[PooledHit]
    note: str
