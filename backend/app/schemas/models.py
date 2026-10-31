"""Versioned, contract-first domain models. See docs/DOMAIN_MODELS.md."""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

Id = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_.-]+$")]
Score = Annotated[float, Field(ge=0, le=100)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Sector(StrEnum):
    power = "power"
    water = "water"
    healthcare = "healthcare"


class Provenance(Contract):
    kind: Literal[
        "configured", "observed", "scenario_assumption", "reference", "model", "simulation"
    ]
    source: str
    recorded_at: AwareDatetime
    evidence_uri: str | None = None
    notes: str | None = None


class Context(Contract):
    scenario_id: Id
    snapshot_id: Id


class Scenario(Contract):
    id: Id
    name: str
    description: str
    current_snapshot_id: Id
    is_sample: bool
    seed_version: str
    created_at: AwareDatetime
    provenance: Provenance


class SecurityConfiguration(Contract):
    network_zone: str
    mfa_enabled: bool | None = None
    internet_exposed: bool | None = None
    remote_access: bool | None = None
    patch_status: Literal["current", "review_required", "unknown"] = "unknown"
    backup_mode: Literal["offline", "online", "none", "unknown"] = "unknown"
    notes: list[str] = Field(default_factory=list)
    provenance: Provenance


class InfrastructureAsset(Context):
    id: Id
    name: str
    sector: Sector
    asset_type: Literal["gateway", "controller", "workstation", "server", "sensor", "backup"]
    site: str
    product: str
    vendor: str
    version: str
    criticality: Literal["essential", "important", "supporting"]
    exposure: Literal["external", "internal", "isolated", "unknown"]
    description: str
    security: SecurityConfiguration
    provenance: Provenance


class VulnerabilityReference(Contract):
    id: Id
    cve_id: Annotated[str, Field(pattern=r"^CVE-\d{4}-\d{4,}$")]
    summary: str
    cvss: Annotated[float, Field(ge=0, le=10)] | None = None
    epss: Annotated[float, Field(ge=0, le=1)] | None = None
    kev_listed: bool | None = None
    published_at: AwareDatetime | None = None
    retrieved_at: AwareDatetime
    provenance: Provenance


class AssetVulnerability(Context):
    id: Id
    asset_id: Id
    vulnerability_id: Id
    applicability: Literal["candidate", "confirmed", "rejected", "unknown"]
    rationale: str
    provenance: Provenance


class SecurityObservation(Context):
    id: Id
    asset_id: Id
    category: str
    description: str
    observed_at: AwareDatetime
    provenance: Provenance


class CyberReachabilityEdge(Context):
    id: Id
    kind: Literal["cyber"] = "cyber"
    source_asset_id: Id
    target_asset_id: Id
    protocol: str
    access: Literal["network", "remote_management", "local_trust"]
    assumptions: list[str] = Field(min_length=1)
    possible_effects: list[
        Literal["loss_of_control", "loss_of_visibility", "data_integrity", "unavailability"]
    ]
    provenance: Provenance


class OperationalDependencyEdge(Context):
    """source provider -> target dependent, never an access path."""

    id: Id
    kind: Literal["operational"] = "operational"
    source_asset_id: Id
    target_asset_id: Id
    dependency: Literal["power", "water", "control", "data", "backup"]
    requirement: Literal["required", "redundant", "backup"]
    redundancy_group: str | None = None
    minimum_providers: Annotated[int, Field(ge=1)] = 1
    grace_period_minutes: Annotated[int, Field(ge=0)] = 0
    assumptions: list[str] = Field(min_length=1)
    provenance: Provenance


class ServiceRequirement(Contract):
    id: Id
    asset_ids: list[Id] = Field(min_length=1)
    minimum_available: Annotated[int, Field(ge=1)]
    role: Literal["primary", "backup"]
    backup_duration_minutes: Annotated[int, Field(ge=0)] | None = None
    activation_delay_minutes: Annotated[int, Field(ge=0)] = 0
    substitutes_requirement_id: Id | None = None
    activation_condition: str | None = None

    @model_validator(mode="after")
    def sufficient_members(self):
        if len(set(self.asset_ids)) != len(self.asset_ids):
            raise ValueError("Service requirement assets must be unique")
        if self.minimum_available > len(self.asset_ids):
            raise ValueError("Minimum availability exceeds providers")
        if self.role == "backup" and self.backup_duration_minutes is None:
            raise ValueError("Backup requirement needs an explicit duration")
        if self.role == "backup" and (
            not self.substitutes_requirement_id or not self.activation_condition
        ):
            raise ValueError(
                "Backup must identify the primary requirement and activation condition"
            )
        if self.role == "primary" and self.substitutes_requirement_id is not None:
            raise ValueError("Primary requirements cannot substitute another requirement")
        return self


class EssentialService(Context):
    id: Id
    name: str
    sector: Sector
    description: str
    requirements: list[ServiceRequirement]
    assumptions: list[str]
    provenance: Provenance


class AssessmentSnapshot(Context):
    name: str
    created_at: AwareDatetime
    state: Literal["current", "projected", "verified"]
    parent_snapshot_id: Id | None = None
    assessment_status: Literal["unavailable", "computed"] = "unavailable"
    scoring_version: str | None = None
    model_version: str | None = None
    provenance: Provenance


class VulnerabilityFinding(Context):
    id: Id
    asset_id: Id
    asset_vulnerability_id: Id
    priority: Score | None = None
    status: Literal["unavailable", "computed"] = "unavailable"
    explanation: list[str] = Field(default_factory=list)
    model_version: str | None = None
    provenance: Provenance

    @model_validator(mode="after")
    def no_fake_priority(self):
        if self.status == "unavailable" and self.priority is not None:
            raise ValueError("Unavailable finding cannot have a priority")
        if self.status == "computed" and (self.priority is None or not self.model_version):
            raise ValueError("Computed finding needs priority and model version")
        return self


class RiskFactor(Contract):
    name: str
    contribution: float
    evidence_ids: list[Id]
    explanation: str


class RiskAssessment(Context):
    asset_id: Id | None = None
    state: Literal["current", "projected", "verified"]
    status: Literal["unavailable", "computed"] = "unavailable"
    score: Score | None = None
    category: Literal["low", "medium", "high", "critical"] | None = None
    factors: list[RiskFactor] = Field(default_factory=list)
    unavailable_reason: str | None = "Risk engine is not implemented in Phase 1"
    scoring_version: str | None = None
    model_version: str | None = None
    calculated_at: AwareDatetime | None = None
    provenance: Provenance

    @model_validator(mode="after")
    def truthful_score(self):
        if self.status == "unavailable" and (
            self.score is not None or self.category is not None or self.factors
        ):
            raise ValueError("Unavailable analysis cannot carry computed risk fields")
        if self.status == "computed" and (
            self.score is None
            or self.category is None
            or not self.scoring_version
            or self.calculated_at is None
            or self.unavailable_reason is not None
        ):
            raise ValueError(
                "Computed analysis needs score, category, version, time and no unavailable reason"
            )
        return self


class ImpactResult(Context):
    service_id: Id
    initiating_asset_id: Id
    compromise_effect: Literal[
        "loss_of_control", "loss_of_visibility", "data_integrity", "unavailability"
    ]
    state: Literal["current", "projected"]
    status: Literal["unavailable", "computed"] = "unavailable"
    disruption_fraction: Annotated[float, Field(ge=0, le=1)] | None = None
    affected_asset_ids: list[Id] = Field(default_factory=list)
    assumptions: list[str]
    engine_version: str | None = None
    calculated_at: AwareDatetime | None = None
    provenance: Provenance

    @model_validator(mode="after")
    def truthful_impact(self):
        if self.status == "unavailable" and (
            self.disruption_fraction is not None or self.affected_asset_ids
        ):
            raise ValueError("Unavailable impact cannot carry a projection")
        if self.status == "computed" and (
            self.disruption_fraction is None
            or not self.engine_version
            or self.calculated_at is None
        ):
            raise ValueError("Computed impact needs fraction, engine version and time")
        return self


class MitigationAction(Context):
    id: Id
    asset_id: Id
    name: str
    action_type: Literal["enable_mfa", "restrict_remote_access", "patch_review", "offline_backup"]
    justification: str
    effort_hours: Annotated[float, Field(ge=0)] | None = None
    operational_disruption: str
    preconditions: list[str]
    provenance: Provenance


class StagedAction(Contract):
    asset_id: Id
    action_type: Literal["enable_mfa", "restrict_remote_access", "patch_review", "offline_backup"]


class WhatIfRequest(Context):
    actions: list[StagedAction] = Field(min_length=1, max_length=30)
    assumptions: list[str] = Field(default_factory=list)


class AssessmentRequest(Context):
    asset_ids: list[Id] = Field(default_factory=list)


class WhatIfResult(Context):
    request: WhatIfRequest
    state: Literal["projected"] = "projected"
    status: Literal["unavailable", "computed"] = "unavailable"
    current: RiskAssessment
    projected: RiskAssessment
    action_effects: list[RiskFactor] = Field(default_factory=list)
    impacts: list[ImpactResult] = Field(default_factory=list)
    engine_version: str | None = None

    @model_validator(mode="after")
    def coherent_result(self):
        for item in [self.request, self.current, self.projected, *self.impacts]:
            if (item.scenario_id, item.snapshot_id) != (self.scenario_id, self.snapshot_id):
                raise ValueError("What-if inputs and outputs must share their base context")
        if self.current.state != "current" or self.projected.state != "projected":
            raise ValueError("What-if must distinguish current and projected assessments")
        if self.status == "computed" and (
            not self.engine_version
            or self.current.status != "computed"
            or self.projected.status != "computed"
        ):
            raise ValueError("Computed what-if needs engine and both computed assessments")
        if self.status == "unavailable" and (
            self.action_effects
            or self.impacts
            or self.current.status != "unavailable"
            or self.projected.status != "unavailable"
        ):
            raise ValueError("Unavailable what-if cannot carry computed effects")
        return self


class RemediationPlan(Context):
    id: Id
    state: Literal["projected"] = "projected"
    status: Literal["unavailable", "computed"] = "unavailable"
    actions: list[MitigationAction] = Field(default_factory=list)
    marginal_risk_reductions: list[Score] = Field(default_factory=list)
    effort_budget_hours: Annotated[float, Field(gt=0)]
    optimizer_version: str | None = None
    provenance: Provenance

    @model_validator(mode="after")
    def coherent_plan(self):
        if self.status == "unavailable" and (self.actions or self.marginal_risk_reductions):
            raise ValueError("Unavailable optimizer cannot return a plan")
        if self.status == "computed" and (
            not self.optimizer_version or len(self.actions) != len(self.marginal_risk_reductions)
        ):
            raise ValueError("Plan needs optimizer version and one marginal reduction per action")
        if any(
            (a.scenario_id, a.snapshot_id) != (self.scenario_id, self.snapshot_id)
            for a in self.actions
        ):
            raise ValueError("Plan action context mismatch")
        return self


class RemediationRequest(Context):
    effort_budget_hours: Annotated[float, Field(gt=0, le=10000)]
    excluded_asset_ids: list[Id] = Field(default_factory=list)


class VerificationRecord(Context):
    id: Id
    action_id: Id
    state: Literal["verified"] = "verified"
    result: Literal["passed", "failed", "inconclusive"]
    verified_at: AwareDatetime
    verifier: str
    evidence_ids: list[Id] = Field(min_length=1)
    provenance: Provenance


class AssetDetail(Contract):
    asset: InfrastructureAsset
    vulnerabilities: list[AssetVulnerability]
    observations: list[SecurityObservation]
    risk: RiskAssessment


class CyberGraph(Context):
    type: Literal["cyber"] = "cyber"
    nodes: list[InfrastructureAsset]
    edges: list[CyberReachabilityEdge]


class OperationalGraph(Context):
    type: Literal["operational"] = "operational"
    nodes: list[InfrastructureAsset]
    edges: list[OperationalDependencyEdge]


class Health(Contract):
    status: Literal["ok", "degraded"]
    database: Literal["ready", "unavailable"]
    application_version: str
    intelligence: Literal["ready", "unavailable", "not_implemented"] = "not_implemented"


class ApiIssue(Contract):
    """One machine-readable problem; `path` points at the offending request field."""

    path: str
    code: str
    message: str


class ApiError(Contract):
    code: str
    message: str
    details: list[str] = Field(default_factory=list)
    issues: list[ApiIssue] = Field(default_factory=list)


class ErrorEnvelope(Contract):
    error: ApiError


class ScenarioBundle(Contract):
    scenario: Scenario
    snapshot: AssessmentSnapshot
    assets: list[InfrastructureAsset]
    cyber_edges: list[CyberReachabilityEdge]
    operational_edges: list[OperationalDependencyEdge]
    services: list[EssentialService]

    @model_validator(mode="after")
    def referential_integrity(self):
        context = (self.scenario.id, self.snapshot.snapshot_id)
        if self.scenario.current_snapshot_id != self.snapshot.snapshot_id:
            raise ValueError("Current snapshot mismatch")
        items = [
            self.snapshot,
            *self.assets,
            *self.cyber_edges,
            *self.operational_edges,
            *self.services,
        ]
        if any((x.scenario_id, x.snapshot_id) != context for x in items):
            raise ValueError("Scenario/snapshot context mismatch")
        for collection in [self.assets, self.cyber_edges, self.operational_edges, self.services]:
            if len({x.id for x in collection}) != len(collection):
                raise ValueError("Duplicate stable identifier")
        ids = {x.id for x in self.assets}
        for edge in [*self.cyber_edges, *self.operational_edges]:
            if edge.source_asset_id not in ids or edge.target_asset_id not in ids:
                raise ValueError("Dangling graph endpoint")
            if edge.source_asset_id == edge.target_asset_id:
                raise ValueError("Self dependencies are not supported")
        for service in self.services:
            if any(i not in ids for req in service.requirements for i in req.asset_ids):
                raise ValueError("Dangling service requirement")
            primary_ids = {req.id for req in service.requirements if req.role == "primary"}
            if len({req.id for req in service.requirements}) != len(service.requirements):
                raise ValueError("Duplicate service requirement identifier")
            if any(
                req.role == "backup" and req.substitutes_requirement_id not in primary_ids
                for req in service.requirements
            ):
                raise ValueError("Backup must substitute a primary requirement in the same service")
        return self
