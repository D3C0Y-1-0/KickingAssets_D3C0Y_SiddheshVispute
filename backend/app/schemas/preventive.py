"""Additive Phase 7 contracts. Existing risk/action/impact contracts remain unchanged."""

from datetime import date
from typing import Annotated, Literal

from pydantic import AwareDatetime, ConfigDict, Field, model_validator

from app.engine.attack_path.models import Effect
from app.schemas.models import Contract, Id
from app.schemas.simulation import BaselineBinding, PatchOutcome, WhatIfResult

Minutes = Annotated[int, Field(strict=True, ge=1, le=10080)]
Credits = Annotated[int, Field(strict=True, ge=0, le=1000000)]
Hours = Annotated[float, Field(strict=True, ge=0, le=1000000, allow_inf_nan=False)]
Digest = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Fraction = Annotated[float, Field(strict=True, ge=0, le=1, allow_inf_nan=False)]


class StrictContract(Contract):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Binding(BaselineBinding):
    baseline_fingerprint: Annotated[str, Field(pattern=r"^[a-f0-9]{32}$")]


class Failure(StrictContract):
    id: Id
    asset_id: Id
    cause: Literal["power_loss", "hardware_failure", "cyber"]
    effect: Effect = "unavailability"
    recovery_minutes: Minutes | None = None

    @model_validator(mode="after")
    def cause_effect(self):
        if self.cause != "cyber" and self.effect != "unavailability":
            raise ValueError("Power/hardware failures must have the unavailability effect")
        return self


class CyberChallenge(StrictContract):
    id: Id
    entry_asset_id: Id
    target_asset_id: Id
    effect: Effect
    cve_id: (
        Annotated[
            str,
            Field(
                pattern=r"^CVE-\d{4}-\d{4,}$",
                description="Assume this CVE is the sole enabling cause of the specified target effect. "
                "Product/version applicability is checked; exploit-vector/effect attribution is not established.",
            ),
        ]
        | None
    ) = None
    recovery_minutes: Minutes | None = None


class FailureScenario(StrictContract):
    horizon_minutes: Annotated[int, Field(strict=True, ge=1, le=1440)] = 1440
    failures: list[Failure] = Field(default_factory=list, max_length=8)
    cyber_challenges: list[CyberChallenge] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def named_events(self):
        ids = [f.id for f in self.failures] + [c.id for c in self.cyber_challenges]
        if not ids or len(ids) != len(set(ids)):
            raise ValueError("Provide at least one event, with unique event IDs")
        return self


class Intervention(StrictContract):
    id: Id
    asset_id: Id
    action_type: Literal["patch", "segmentation", "backup_power", "recovery"]
    cost_credits: Credits
    effort_hours: Hours
    downtime_hours: Hours
    recovery_minutes: Minutes | None = None
    added_backup_minutes: Annotated[int, Field(strict=True, ge=0)] = 0
    patch: PatchOutcome | None = None
    preconditions: list[str]
    modelled_effect: str
    evidence_ids: list[str]


class Catalog(Binding):
    baseline_created_at: AwareDatetime
    baseline_as_of: date
    model_version: str
    catalog_version: str
    catalog_fingerprint: Digest
    interventions: list[Intervention]
    assumptions: list[str]


class EvaluationRequest(Binding):
    catalog_fingerprint: Digest
    scenario: FailureScenario
    intervention_ids: list[Id] = Field(default_factory=list, max_length=12)


class Capacity(StrictContract):
    backup_asset_id: Id
    usable_energy_fraction: Fraction


class StressCase(StrictContract):
    id: Id
    failed_backup_ids: list[Id] = Field(default_factory=list, max_length=8)
    additional_failures: list[Failure] = Field(default_factory=list, max_length=8)
    backup_capacity: list[Capacity] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def changed(self):
        if not (self.failed_backup_ids or self.additional_failures or self.backup_capacity):
            raise ValueError("A stress case must specify an actual stress assumption")
        return self


class OptimizationRequest(EvaluationRequest):
    intervention_ids: list[Id] = Field(min_length=1, max_length=12)
    budget_credits: Credits
    effort_limit_hours: Hours
    downtime_limit_hours: Hours
    max_action_downtime_hours: Hours | None = None
    excluded_asset_ids: list[Id] = Field(default_factory=list, max_length=30)
    service_ids: list[Id] = Field(default_factory=list, max_length=20)


class StressRequest(EvaluationRequest):
    cases: list[StressCase] = Field(min_length=1, max_length=4)


class Interval(StrictContract):
    start_minutes: int
    end_minutes: int


class AssetOutage(StrictContract):
    asset_id: str
    intervals: list[Interval]
    failure_ids: list[str]
    dependency_edge_ids: list[str]


class ServiceOutcome(StrictContract):
    service_id: str
    disrupted_minutes: int
    disruption_fraction: float
    intervals: list[Interval]
    restored_at_minutes: int | None


class StandbyOutcome(StrictContract):
    service_id: str
    requirement_id: str
    backup_asset_ids: list[str]
    activation_condition: str
    activation_minutes: int | None = Field(
        description="Scheduled window start, not proof of activation; inspect available_intervals."
    )
    exhaustion_minutes: int | None
    usable_duration_minutes: int
    available_intervals: list[Interval]


class FailureOutcome(StrictContract):
    horizon_minutes: int
    total_service_disruption_minutes: int
    services: list[ServiceOutcome]
    asset_outages: list[AssetOutage]
    standbys: list[StandbyOutcome]


class ChallengeOutcome(StrictContract):
    challenge_id: str
    outcome: Literal["assumed_compromise", "route_disconnected", "specified_cve_patched"]
    explanation: str
    candidate_paths: list[list[str]]


class Comparison(StrictContract):
    before: FailureOutcome
    after: FailureOutcome
    avoided_service_disruption_minutes: int
    improved_service_ids: list[str]
    fully_protected_service_ids: list[str]
    challenges: list[ChallengeOutcome]


class Evaluation(Binding):
    baseline_created_at: AwareDatetime
    baseline_as_of: date
    model_version: str
    scoring_version: str | None
    catalog_fingerprint: Digest
    input_fingerprint: Digest
    engine_version: str
    calculated_at: AwareDatetime
    state: Literal["projected"] = "projected"
    verification: Literal["not_verified"] = "not_verified"
    interventions: list[Intervention]
    cost_credits: Credits
    effort_hours: Hours
    downtime_hours: Hours
    comparison: Comparison
    baseline_city_index: float | None
    risk_projection: WhatIfResult | None = None
    risk_projection_intervention_ids: list[str] = Field(default_factory=list)
    assumptions: list[str]


class RejectedAlternative(StrictContract):
    intervention_id: str
    reasons: list[str]
    standalone_disruption_minutes: int


class Optimization(Evaluation):
    objective_service_ids: list[str]
    objective_before_minutes: int
    objective_after_minutes: int
    method: Literal["exhaustive-subsets-v1"] = "exhaustive-subsets-v1"
    optimal_within_submitted_candidates: Literal[True] = True
    subsets_considered: int
    feasible_subsets: int
    rejected_alternatives: list[RejectedAlternative]


class StressOutcome(StrictContract):
    case: StressCase
    comparison: Comparison
    extra_projected_disruption_minutes: int


class StressReport(StrictContract):
    nominal: Evaluation
    cases: list[StressOutcome]
