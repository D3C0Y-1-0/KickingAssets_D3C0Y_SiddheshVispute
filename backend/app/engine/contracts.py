"""Future pure engine boundaries. Protocols declare interfaces, not implementations."""

from collections.abc import Mapping, Sequence
from typing import Literal, Protocol

from app.schemas.models import (
    AssetVulnerability,
    ImpactResult,
    RemediationPlan,
    RemediationRequest,
    RiskAssessment,
    ScenarioBundle,
    VulnerabilityFinding,
    VulnerabilityReference,
    WhatIfRequest,
    WhatIfResult,
)

CompromiseEffect = Literal[
    "loss_of_control", "loss_of_visibility", "data_integrity", "unavailability"
]


class VulnerabilityPrioritizer(Protocol):
    def prioritize(
        self,
        inputs: ScenarioBundle,
        references: Sequence[VulnerabilityReference],
        applicability: Sequence[AssetVulnerability],
    ) -> list[VulnerabilityFinding]: ...


class ServiceImpactEngine(Protocol):
    def simulate(
        self, inputs: ScenarioBundle, assumed_effects: Mapping[str, CompromiseEffect]
    ) -> list[ImpactResult]: ...


class AssetRiskScorer(Protocol):
    def assess(
        self,
        inputs: ScenarioBundle,
        findings: Sequence[VulnerabilityFinding],
        impacts: Sequence[ImpactResult],
    ) -> list[RiskAssessment]: ...


class WhatIfEngine(Protocol):
    def recalculate(
        self,
        inputs: ScenarioBundle,
        baseline: Sequence[RiskAssessment],
        request: WhatIfRequest,
    ) -> WhatIfResult: ...


class RemediationOptimizer(Protocol):
    def optimize(
        self,
        inputs: ScenarioBundle,
        baseline: Sequence[RiskAssessment],
        request: RemediationRequest,
    ) -> RemediationPlan: ...
