"""Conditional infrastructure impact engine (Phase 4)."""

from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Literal

from app.engine.impact.cascade import propagate
from app.engine.impact.graph import OperationalView
from app.engine.impact.models import ImpactAnalysis, ServiceImpactDetail
from app.engine.impact.policy import EFFECTS, ImpactInputError, ImpactPolicy
from app.engine.impact.service import evaluate_service
from app.schemas.models import ImpactResult, Provenance, ScenarioBundle

ENGINE_VERSION = "conditional-impact-v1"


class ConditionalImpactEngine:
    """Implements the ServiceImpactEngine protocol over the operational dependency graph.

    Pure with respect to its inputs: the bundle is never mutated and the cyber reachability
    graph is never consulted. The only non-deterministic input is the injected clock, which
    stamps ``calculated_at``.
    """

    def __init__(
        self,
        policy: ImpactPolicy | None = None,
        *,
        state: Literal["current", "projected"] = "current",
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.policy = policy or ImpactPolicy()
        self.state = state
        self._clock = clock or (lambda: datetime.now(UTC))

    def analyze(self, inputs: ScenarioBundle, initiators: Mapping[str, str]) -> ImpactAnalysis:
        """Joint analysis: every initiator is compromised at the same moment."""
        self._validate(inputs, initiators)
        return self._analyze(OperationalView(inputs, self.policy), inputs, initiators)

    def simulate(
        self, inputs: ScenarioBundle, assumed_effects: Mapping[str, str]
    ) -> list[ImpactResult]:
        """One independent scenario per assumed (asset, effect), one result per service."""
        self._validate(inputs, assumed_effects)
        view = OperationalView(inputs, self.policy)
        calculated_at = self._clock()
        results: list[ImpactResult] = []
        for asset_id, effect in sorted(assumed_effects.items()):
            analysis = self._analyze(view, inputs, {asset_id: effect})
            for detail in analysis.services:
                results.append(self._to_result(inputs, asset_id, effect, detail, calculated_at))
        return results

    def _analyze(
        self, view: OperationalView, inputs: ScenarioBundle, initiators: Mapping[str, str]
    ) -> ImpactAnalysis:
        losses = propagate(view, self.policy, initiators)
        direct = propagate(view, self.policy, initiators, cascade=False)
        services = tuple(
            evaluate_service(service, losses, view.functions, self.policy, baseline_losses=direct)
            for service in sorted(inputs.services, key=lambda s: s.id)
        )
        return ImpactAnalysis(
            initiators=tuple(sorted(initiators.items())),
            cascade=losses,
            cycles=view.dependency_cycles(),
            services=services,
        )

    @staticmethod
    def _validate(inputs: ScenarioBundle, initiators: Mapping[str, str]) -> None:
        known = {a.id for a in inputs.assets}
        for asset_id, effect in initiators.items():
            if asset_id not in known:
                raise ImpactInputError(f"Unknown initiating asset: {asset_id}")
            if effect not in EFFECTS:
                raise ImpactInputError(f"Unknown compromise effect: {effect}")

    def _to_result(
        self,
        inputs: ScenarioBundle,
        asset_id: str,
        effect: str,
        detail: ServiceImpactDetail,
        calculated_at: datetime,
    ) -> ImpactResult:
        assumptions = self._assumptions(effect, detail)
        provenance = Provenance(
            kind="simulation",
            source=f"GridSentinel conditional impact engine {ENGINE_VERSION}",
            recorded_at=calculated_at,
            notes="Conditional on the listed assumptions; not an outage prediction.",
        )
        common = {
            "scenario_id": inputs.scenario.id,
            "snapshot_id": inputs.snapshot.snapshot_id,
            "service_id": detail.service_id,
            "initiating_asset_id": asset_id,
            "compromise_effect": effect,
            "state": self.state,
            "assumptions": assumptions,
            "engine_version": ENGINE_VERSION,
            "provenance": provenance,
        }
        if detail.status == "unavailable":
            return ImpactResult(**common, status="unavailable")
        return ImpactResult(
            **common,
            status="computed",
            disruption_fraction=detail.disruption_fraction,
            affected_asset_ids=list(detail.affected_asset_ids),
            calculated_at=calculated_at,
        )

    def _assumptions(self, effect: str, detail: ServiceImpactDetail) -> list[str]:
        policy = self.policy
        lines = [
            f"Assumed initiating effect. {policy.describe_effect(effect)}",
            "Only operational dependency edges and service requirement groups are used; "
            "cyber reachability is not consulted and never implies compromise or propagation.",
            f"Disruption is the share of a {policy.horizon_minutes}-minute horizon in which at "
            "least one primary requirement group is unsatisfied, assuming no operator recovery.",
            "A required dependency fails its dependent after the edge grace period; a redundant "
            "group fails when fewer than its minimum providers remain.",
            "A backup substitutes only the primary group it names, after its activation delay "
            "and for its finite duration, and only for effects in "
            f"{{{', '.join(sorted(policy.backup_covered_effects))}}}.",
            "Edge-level backup links do not relieve dependency cascades, so cascaded results "
            "are an upper bound with respect to backups; "
            "fraction_without_cascade shows the initiator-only figure.",
            "Reachability along dependencies is not failure: only assets whose providers "
            "actually fail are counted as lost.",
        ]
        if detail.status == "unavailable":
            lines.append(f"Result unavailable: {detail.unavailable_reason}.")
        return lines
