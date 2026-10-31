"""Additive Phase 3A contracts; CVE signals and asset indices have separate meanings."""

from typing import Annotated, Literal

from pydantic import AwareDatetime, Field

from app.schemas.models import Context, Contract, ImpactResult, RiskAssessment


class FeatureContribution(Contract):
    feature: str
    value: float | None
    log_odds_contribution: float


class CVESignal(Contract):
    cve_id: str
    status: Literal["computed", "known_kev", "unavailable"]
    signal: Annotated[float, Field(ge=0, le=1)] | None = None
    reason: str
    model_version: str
    model_variant: str
    artifact_sha256: str
    feature_date: str
    contributions: list[FeatureContribution] = Field(default_factory=list)


class AssetPriority(Contract):
    asset_id: str
    name: str
    sector: str
    coverage: Literal["partial", "unavailable"]
    risk: RiskAssessment
    signals: list[CVESignal]
    impacts: list[ImpactResult]
    assumptions: list[str]


class ModelEvidence(Contract):
    model_version: str
    variant: str
    artifact_sha256: str
    feature_names: list[str]
    task: str
    metrics: dict[str, dict[str, float | list[float]]]
    limitations: list[str]
    manifest_sha256: str
    evaluation_status: str


class IntelligenceReport(Context):
    id: str
    calculated_at: AwareDatetime
    reference_dataset_id: str
    vulnerability_assessment_id: str
    scoring_version: str
    impact_version: str
    model: ModelEvidence
    assets: list[AssetPriority]
    assessed_count: int
    unavailable_count: int
    covered_asset_mean: Annotated[float, Field(ge=0, le=100)] | None
    limitations: list[str]
