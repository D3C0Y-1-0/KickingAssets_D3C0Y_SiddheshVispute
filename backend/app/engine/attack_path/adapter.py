"""Adapters from the existing scenario bundle and simulation run to attack-path inputs.

The engine itself imports none of this; it can be driven by hand-built AttackGraphInput.
"""

from collections.abc import Iterable

from app.engine.attack_path.engine import ConsequenceLookup
from app.engine.attack_path.models import (
    AnalysisConfig,
    AssetFacts,
    AttackGraphInput,
    Controls,
    CyberEdgeFacts,
    VulnerabilityEvidence,
)
from app.engine.pivot import PivotImpact
from app.schemas.models import ScenarioBundle
from app.schemas.simulation import AssetSimulation, SimulationRun


def evidence_from_run(
    run: SimulationRun, config: AnalysisConfig | None = None
) -> tuple[VulnerabilityEvidence, ...]:
    """Summarize each asset's version-matched CVE findings. Zero applicable CVEs for a known
    product is evidence of absence; an unknown product is unavailable, never zero."""
    threshold = (config or AnalysisConfig()).high_priority_percentile
    return tuple(_evidence(a, threshold) for a in sorted(run.assets, key=lambda a: a.asset_id))


def _evidence(asset: AssetSimulation, threshold: float) -> VulnerabilityEvidence:
    match = asset.matching
    if not match.product_known:
        return VulnerabilityEvidence(asset_id=asset.asset_id, level="unavailable")
    percentiles = [
        v.priority_percentile
        for v in asset.top_vulnerabilities
        if v.priority_percentile is not None
    ]
    top = max(percentiles, default=None)
    cves = tuple(sorted(v.cve_id for v in asset.top_vulnerabilities))
    if match.kev_listed > 0:
        level = "kev_listed"
    elif top is not None and top >= threshold:
        level = "high_priority"
    elif asset.candidate_count > 0:
        level = "candidates"
    else:
        level = "none_applicable"
    return VulnerabilityEvidence(
        asset_id=asset.asset_id,
        level=level,
        applicable_cves=asset.candidate_count,
        kev_listed=match.kev_listed,
        max_priority_percentile=top,
        cve_ids=cves,
    )


def from_bundle(
    bundle: ScenarioBundle,
    evidence: Iterable[VulnerabilityEvidence] = (),
    controls: Controls | None = None,
) -> AttackGraphInput:
    """Only cyber edges are passed on. Operational dependencies cannot enter the engine."""
    return AttackGraphInput(
        assets=tuple(
            AssetFacts(
                id=a.id,
                name=a.name,
                sector=str(a.sector),
                asset_type=a.asset_type,
                criticality=a.criticality,
                network_zone=a.security.network_zone,
                internet_exposed=a.security.internet_exposed,
                remote_access=a.security.remote_access,
                mfa_enabled=a.security.mfa_enabled,
            )
            for a in bundle.assets
        ),
        edges=tuple(
            CyberEdgeFacts(
                id=e.id,
                source=e.source_asset_id,
                target=e.target_asset_id,
                protocol=e.protocol,
                access=e.access,
                possible_effects=tuple(e.possible_effects),
            )
            for e in bundle.cyber_edges
        ),
        evidence=tuple(evidence),
        controls=controls or Controls(),
    )


def consequence_lookup(bundle: ScenarioBundle) -> ConsequenceLookup:
    """Downstream service consequence of a target, from the operational dependency graph."""
    pivot = PivotImpact(bundle)

    def lookup(target: str, effect: str) -> tuple[tuple[str, float], ...]:
        return pivot.scenario(target, effect)[1]

    return lookup
