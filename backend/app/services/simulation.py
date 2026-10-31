"""Simulation, what-if and remediation orchestration.

Nothing here invents a score. Vulnerability signals come from the trained ML model scored on
real CVEs; consequence comes from the conditional impact engine; the composition is the
published formula in app.engine.risk.
"""

import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from app.db.store import read_documents
from app.domain.product_profiles import ProductProfile, profile_for
from app.engine import risk as risk_engine
from app.engine.pivot import PivotImpact, WorstCase
from app.schemas.models import (
    InfrastructureAsset,
    Provenance,
    RiskAssessment,
    RiskFactor,
    ScenarioBundle,
)
from app.schemas.simulation import (
    ActionDefinition,
    ActionOption,
    ActionType,
    AppliedAction,
    AssetDelta,
    AssetSimulation,
    CandidateCve,
    CategoryCount,
    Driver,
    OptimizeRequest,
    PlanStep,
    ProfileAssumption,
    RemediationPlan,
    ServiceDisruption,
    ServiceRisk,
    SimulationRun,
    SimulationStage,
    WhatIfRequest,
    WhatIfResult,
    WorstScenario,
)
from ml import inference

TOP_VULNERABILITIES = 8
CANDIDATE_WINDOW_DAYS = 730
PATCH_BATCH = 3

ACTIONS: dict[str, ActionDefinition] = {
    "patch_prioritization": ActionDefinition(
        type="patch_prioritization",
        name="Patch prioritization",
        description="Patch the KEV-listed and highest ML-ranked CVEs for this asset's product "
        f"family first, up to {PATCH_BATCH} per maintenance window.",
        modelled=True,
        effort_hours=8,
        operational_disruption="Restart or maintenance window; validate vendor compatibility "
        "and rollback first.",
        assumption="Assumes the candidate CVEs apply to the real product and patches exist.",
    ),
    "network_segmentation": ActionDefinition(
        type="network_segmentation",
        name="Network segmentation",
        description="Remove internet exposure and remote access, and isolate the asset from its "
        "configured cyber routes in both directions.",
        modelled=True,
        effort_hours=24,
        operational_disruption="May interrupt remote operator access and cross-zone data flows.",
        assumption="Assumes segmentation fully removes the asset's configured routes.",
    ),
    "access_control": ActionDefinition(
        type="access_control",
        name="Access-control improvement",
        description="Require multifactor authentication and disable unrestricted remote "
        "management for this asset.",
        modelled=True,
        effort_hours=12,
        operational_disruption="Enrollment window; keep an emergency access procedure.",
        assumption="Assumes MFA and a managed access path replace direct remote access.",
    ),
    "enhanced_monitoring": ActionDefinition(
        type="enhanced_monitoring",
        name="Enhanced monitoring",
        description="Add detection and logging for this asset to shorten time to detect "
        "compromise.",
        modelled=False,
        effort_hours=40,
        operational_disruption="Sensor placement and tuning; no process interruption expected.",
        assumption="The risk index has no detection-time term, so no reduction is claimed.",
    ),
    "incident_response_plan": ActionDefinition(
        type="incident_response_plan",
        name="Incident-response planning",
        description="Prepare and rehearse a response plan for compromise of this asset and the "
        "services that depend on it.",
        modelled=False,
        effort_hours=16,
        operational_disruption="Staff time; no process interruption.",
        assumption="The risk index has no recovery-time term, so no reduction is claimed.",
    ),
}


@dataclass
class AssetEvidence:
    asset: InfrastructureAsset
    profile: ProductProfile
    unlisted: pd.DataFrame
    listed: pd.DataFrame
    top: list[CandidateCve]


@dataclass
class Mods:
    patched: dict[str, set[str]] = field(default_factory=dict)
    segmented: set[str] = field(default_factory=set)
    security: dict[str, dict] = field(default_factory=dict)


@dataclass
class AssetState:
    asset_id: str
    signal: float | None
    exposure: float
    exposure_parts: list[str]
    impact: float
    worst: WorstCase | None
    score: float | None


@dataclass
class RunContext:
    bundle: ScenarioBundle
    pivot: PivotImpact
    evidence: dict[str, AssetEvidence]
    run: SimulationRun | None = None
    _worst_cache: dict = field(default_factory=dict)

    def edges(self, mods: Mods):
        if not mods.segmented:
            return self.bundle.cyber_edges
        return [
            e
            for e in self.bundle.cyber_edges
            if e.source_asset_id not in mods.segmented and e.target_asset_id not in mods.segmented
        ]

    def worst(self, asset_id: str, mods: Mods) -> WorstCase | None:
        key = (asset_id, frozenset(mods.segmented))
        if key not in self._worst_cache:
            self._worst_cache[key] = self.pivot.worst_for(asset_id, self.edges(mods))
        return self._worst_cache[key]


def load_bundle(db_path: Path, scenario_id: str, snapshot_id: str) -> ScenarioBundle:
    scenario = read_documents(db_path, "scenarios", scenario_id)[0]
    snapshot = read_documents(db_path, "snapshots", scenario_id, snapshot_id)[0]
    return ScenarioBundle.model_validate(
        {
            "scenario": scenario,
            "snapshot": snapshot,
            "assets": read_documents(db_path, "assets", scenario_id, snapshot_id),
            "cyber_edges": read_documents(db_path, "cyber_edges", scenario_id, snapshot_id),
            "operational_edges": read_documents(
                db_path, "operational_edges", scenario_id, snapshot_id
            ),
            "services": read_documents(db_path, "services", scenario_id, snapshot_id),
        }
    )


def _candidate(row: pd.Series, drivers: list[dict] | None, listed: bool, ref) -> CandidateCve:
    def num(value):
        return None if pd.isna(value) else float(value)

    published = row["published"]
    if listed:
        added = ref.ctx["added"][ref.positions[row["cve_id"]]]
        kev_added = pd.Timestamp("1970-01-01") + pd.Timedelta(days=int(added))
    return CandidateCve(
        cve_id=row["cve_id"],
        published=published,
        status="kev_listed" if listed else "scored",
        ml_score=None if listed else round(float(row["ml_score"]), 6),
        priority_percentile=None if listed else round(float(row["priority_percentile"]), 6),
        epss_percentile=num(row["epss_percentile"]),
        cvss_score=num(row["cvss_score"]),
        kev_added=kev_added.date() if listed else None,
        drivers=[Driver(**d) for d in drivers or []],
    )


def _signal(evidence: AssetEvidence, patched: set[str]) -> float | None:
    total = len(evidence.unlisted) + len(evidence.listed)
    if total == 0:
        return None
    unlisted = evidence.unlisted[~evidence.unlisted["cve_id"].isin(patched)]
    listed = evidence.listed[~evidence.listed["cve_id"].isin(patched)]
    if len(unlisted) + len(listed) == 0:
        return 0.0
    return risk_engine.vulnerability_signal(
        unlisted["priority_percentile"].tolist(), len(listed), len(unlisted) + len(listed)
    )


def _patch_set(evidence: AssetEvidence) -> set[str]:
    """KEV-listed CVEs first (newest first), then the highest ML-ranked ones."""
    listed = evidence.listed.sort_values("published", ascending=False)["cve_id"].tolist()
    ranked = evidence.unlisted.sort_values("ml_score", ascending=False)["cve_id"].tolist()
    return set((listed + ranked)[:PATCH_BATCH])


def assess(ctx: RunContext, mods: Mods) -> dict[str, AssetState]:
    states = {}
    for asset in ctx.bundle.assets:
        evidence = ctx.evidence[asset.id]
        security = asset.security.model_dump() | mods.security.get(asset.id, {})
        exposure, parts = risk_engine.exposure_factor(security)
        signal = _signal(evidence, mods.patched.get(asset.id, set()))
        worst = ctx.worst(asset.id, mods)
        impact = worst.max_disruption if worst else 0.0
        score = (
            None
            if signal is None
            else risk_engine.risk_score(signal, exposure, risk_engine.impact_factor(impact))
        )
        states[asset.id] = AssetState(asset.id, signal, exposure, parts, impact, worst, score)
    return states


def city_index(ctx: RunContext, states: dict[str, AssetState]) -> float:
    rows = [
        (s.score, a.criticality) for a in ctx.bundle.assets if (s := states[a.id]).score is not None
    ]
    return risk_engine.city_index(rows) or 0.0


def _service_risks(ctx: RunContext, mods: Mods) -> list[ServiceRisk]:
    worst = ctx.pivot.service_worst([a.id for a in ctx.bundle.assets], ctx.edges(mods))
    names = {a.id: a.name for a in ctx.bundle.assets}
    out = []
    for service in sorted(ctx.bundle.services, key=lambda s: s.id):
        fraction, asset_id, effect = worst.get(service.id, (0.0, None, None))
        out.append(
            ServiceRisk(
                service_id=service.id,
                name=service.name,
                sector=service.sector,
                worst_disruption_fraction=fraction,
                initiating_asset_id=asset_id,
                initiating_asset_name=names.get(asset_id) if asset_id else None,
                effect=effect,
            )
        )
    return out


def _provenance(now: datetime) -> Provenance:
    return Provenance(
        kind="model",
        source=f"GridSentinel {risk_engine.SCORING_VERSION} over {inference.MODEL_VERSION}",
        recorded_at=now,
        notes="Relative risk index from ML-scored candidate CVEs, exposure and conditional impact.",
    )


def _asset_risk(
    ctx: RunContext, asset: InfrastructureAsset, state: AssetState, now: datetime
) -> RiskAssessment:
    base = {
        "scenario_id": asset.scenario_id,
        "snapshot_id": asset.snapshot_id,
        "asset_id": asset.id,
        "state": "current",
        "provenance": _provenance(now),
    }
    evidence = ctx.evidence[asset.id]
    if state.score is None:
        return RiskAssessment(
            **base,
            status="unavailable",
            unavailable_reason=f"No candidate CVEs for the assumed product family "
            f"({evidence.profile.label}) in the last {CANDIDATE_WINDOW_DAYS} days.",
        )
    top = evidence.top[:3]
    worst = state.worst
    factors = [
        RiskFactor(
            name="ML vulnerability signal",
            contribution=state.signal or 0.0,
            evidence_ids=[c.cve_id for c in top],
            explanation=(
                f"Highest ML priority percentile among {len(evidence.unlisted)} candidate CVEs "
                f"for {evidence.profile.label}; {len(evidence.listed)} already CISA-KEV-listed."
            ),
        ),
        RiskFactor(
            name="Exposure",
            contribution=state.exposure,
            evidence_ids=[],
            explanation="; ".join(state.exposure_parts),
        ),
        RiskFactor(
            name="Conditional service impact",
            contribution=risk_engine.impact_factor(state.impact),
            evidence_ids=[],
            explanation=(
                f"Worst plausible: {worst.effect} at {worst.target_asset_id} disrupts a service "
                f"for {worst.max_disruption:.0%} of the horizon (upper bound)."
                if worst
                else "No reachable scenario disrupts a modelled service."
            ),
        ),
    ]
    return RiskAssessment(
        **base,
        status="computed",
        score=state.score,
        category=risk_engine.category(state.score),
        factors=factors,
        unavailable_reason=None,
        scoring_version=risk_engine.SCORING_VERSION,
        model_version=inference.MODEL_VERSION,
        calculated_at=now,
    )


def run_simulation(db_path: Path, scenario_id: str, snapshot_id: str) -> RunContext:
    stages: list[SimulationStage] = []
    clock = time.perf_counter()

    def stage(name: str, detail: str) -> None:
        nonlocal clock
        now = time.perf_counter()
        stages.append(SimulationStage(name=name, detail=detail, seconds=round(now - clock, 2)))
        clock = now

    bundle = load_bundle(db_path, scenario_id, snapshot_id)
    stage(
        "Load inventory", f"{len(bundle.assets)} fictional assets, {len(bundle.services)} services"
    )

    ref = inference.load_reference()
    stage(
        "Load reference data and model",
        f"KEV, NVD and EPSS as of {ref.as_of}; model {inference.MODEL_VERSION}",
    )

    evidence: dict[str, AssetEvidence] = {}
    by_profile: dict[str, tuple[pd.DataFrame, pd.DataFrame]] = {}
    total_candidates = 0
    for asset in sorted(bundle.assets, key=lambda a: a.id):
        profile = profile_for(asset.sector.value, asset.asset_type)
        if profile.key not in by_profile:
            unlisted_pos, listed_pos = ref.candidates(
                list(profile.vendors),
                list(profile.product_contains),
                list(profile.product_excludes),
                CANDIDATE_WINDOW_DAYS,
            )
            by_profile[profile.key] = (
                ref.score_positions(unlisted_pos),
                ref.frame(listed_pos),
            )
        unlisted, listed = by_profile[profile.key]
        total_candidates += len(unlisted) + len(listed)
        evidence[asset.id] = AssetEvidence(asset, profile, unlisted, listed, [])
    stage(
        "Fetch candidate CVEs and score with the ML model",
        f"{len(by_profile)} product families; {total_candidates:,} candidate CVE-asset pairs "
        "scored live",
    )

    top_by_profile: dict[str, list[CandidateCve]] = {}
    for key, (unlisted, listed) in by_profile.items():
        newest_listed = listed.sort_values("published", ascending=False).head(3)
        ranked = unlisted.sort_values("ml_score", ascending=False).head(TOP_VULNERABILITIES)
        drivers = ref.drivers(ranked.reset_index(drop=True), top=3)
        items = [_candidate(r, None, True, ref) for _, r in newest_listed.iterrows()]
        items += [
            _candidate(r, d, False, ref)
            for (_, r), d in zip(ranked.iterrows(), drivers, strict=True)
        ]
        top_by_profile[key] = items[:TOP_VULNERABILITIES]
    for item in evidence.values():
        item.top = top_by_profile[item.profile.key]
    stage("Explain top candidates", "Exact TreeSHAP drivers for the highest-ranked CVEs")

    pivot = PivotImpact(bundle)
    ctx = RunContext(bundle, pivot, evidence)
    states = assess(ctx, Mods())
    stage(
        "Reachability and conditional service impact",
        "Cyber routes decide where an attacker could pivot; the dependency graph decides "
        "what that does to services",
    )

    now = datetime.now(UTC)
    assets_out = []
    for asset in bundle.assets:
        state = states[asset.id]
        worst = state.worst
        names = {a.id: a.name for a in bundle.assets}
        service_names = {s.id: s.name for s in bundle.services}
        assets_out.append(
            AssetSimulation(
                asset_id=asset.id,
                name=asset.name,
                sector=asset.sector,
                asset_type=asset.asset_type,
                criticality=asset.criticality,
                profile=ProfileAssumption(
                    key=evidence[asset.id].profile.key,
                    label=evidence[asset.id].profile.label,
                    vendors=list(evidence[asset.id].profile.vendors),
                    product_filters=[
                        *evidence[asset.id].profile.product_contains,
                        *[f"not {x}" for x in evidence[asset.id].profile.product_excludes],
                    ],
                    rationale=evidence[asset.id].profile.rationale,
                ),
                candidate_count=len(evidence[asset.id].unlisted) + len(evidence[asset.id].listed),
                known_exploited_count=len(evidence[asset.id].listed),
                vulnerability_signal=state.signal,
                top_vulnerabilities=evidence[asset.id].top,
                exposure_factor=state.exposure,
                impact_factor=risk_engine.impact_factor(state.impact),
                worst_scenario=None
                if worst is None
                else WorstScenario(
                    target_asset_id=worst.target_asset_id,
                    target_asset_name=names[worst.target_asset_id],
                    effect=worst.effect,
                    path=list(worst.path),
                    max_disruption_fraction=worst.max_disruption,
                    services=[
                        ServiceDisruption(
                            service_id=sid,
                            service_name=service_names[sid],
                            disruption_fraction=fraction,
                        )
                        for sid, fraction in worst.service_fractions
                    ],
                ),
                risk=_asset_risk(ctx, asset, state, now),
            )
        )
    ordered = sorted(assets_out, key=lambda a: (-(a.risk.score or -1.0), a.asset_id))
    index = city_index(ctx, states)
    counts = {c: 0 for c in ("critical", "high", "medium", "low")}
    for a in assets_out:
        if a.risk.category:
            counts[a.risk.category] += 1
    scored = sum(1 for a in assets_out if a.risk.score is not None)
    city = RiskAssessment(
        scenario_id=scenario_id,
        snapshot_id=snapshot_id,
        asset_id=None,
        state="current",
        status="computed",
        score=index,
        category=risk_engine.category(index),
        factors=[
            RiskFactor(
                name="Coverage",
                contribution=scored / len(assets_out),
                evidence_ids=[],
                explanation=f"{scored} of {len(assets_out)} assets have a computed score; the "
                "city index is a criticality-weighted mean over those.",
            )
        ],
        unavailable_reason=None,
        scoring_version=risk_engine.SCORING_VERSION,
        model_version=inference.MODEL_VERSION,
        calculated_at=now,
        provenance=_provenance(now),
    )
    stage("Compose risk index", f"City index {index} from {scored} scored assets")

    run = SimulationRun(
        scenario_id=scenario_id,
        snapshot_id=snapshot_id,
        id=f"run-{now:%Y%m%d-%H%M%S}",
        as_of=ref.as_of,
        kev_released=ref.kev_released,
        model_version=inference.MODEL_VERSION,
        created_at=now,
        stages=stages,
        city_risk=city,
        category_counts=[CategoryCount(category=k, count=v) for k, v in counts.items()],
        assets=ordered,
        services=_service_risks(ctx, Mods()),
        assumptions=[
            "Assets are fictional. Each is assumed to run a real product family chosen by sector "
            "and role (see each asset's profile); real CVEs for that family are candidate "
            "findings, versions are not matched and nothing is confirmed.",
            f"Candidates are CVEs published {CANDIDATE_WINDOW_DAYS} to 30 days before "
            f"{ref.as_of}. CVEs already listed in CISA KEV are shown as known exploited and set "
            "a floor on the vulnerability signal; the others are scored by the ML model.",
            "The ML score is a KEV-prioritisation signal (resemblance to CVEs later added to "
            "KEV), converted to a percentile against all unlisted CVEs at the snapshot. It is "
            "not the probability that an asset is attacked.",
            "Impact is conditional: reachability gives configured routes, not compromise; the "
            "effect at each target is an explicit assumption; results are an upper bound with "
            "respect to backups.",
            "The risk index is relative and uncalibrated. Configuration flags are scenario "
            "assumptions, not observations.",
        ],
        formula=risk_engine.FORMULA,
    )
    ctx.run = run
    return ctx


# ---------------------------------------------------------------------------------- actions


def _applicable(
    ctx: RunContext, asset: InfrastructureAsset, action: ActionType
) -> tuple[bool, str]:
    evidence = ctx.evidence[asset.id]
    sec = asset.security
    if action == "patch_prioritization":
        remaining = len(evidence.unlisted) + len(evidence.listed)
        return (remaining > 0, "No candidate CVEs to patch." if remaining == 0 else "")
    if action == "network_segmentation":
        routed = any(
            asset.id in (e.source_asset_id, e.target_asset_id) for e in ctx.bundle.cyber_edges
        )
        needed = routed or sec.internet_exposed is True or sec.remote_access is True
        return (needed, "" if needed else "No configured routes or remote exposure to remove.")
    if action == "access_control":
        needed = sec.mfa_enabled is False or sec.remote_access is True
        return (needed, "" if needed else "MFA is configured and remote access is not enabled.")
    return True, ""


def _apply(ctx: RunContext, mods: Mods, asset_id: str, action: ActionType) -> None:
    if action == "patch_prioritization":
        mods.patched.setdefault(asset_id, set()).update(_patch_set(ctx.evidence[asset_id]))
    elif action == "network_segmentation":
        mods.segmented.add(asset_id)
        mods.security.setdefault(asset_id, {}).update(internet_exposed=False, remote_access=False)
    elif action == "access_control":
        mods.security.setdefault(asset_id, {}).update(mfa_enabled=True, remote_access=False)


def _effect_text(ctx: RunContext, asset_id: str, action: ActionType, before, after) -> str:
    definition = ACTIONS[action]
    if not definition.modelled:
        return "Recommendation only: " + definition.assumption
    b, a = before[asset_id].score, after[asset_id].score
    if b is None or a is None:
        return "No score available to compare."
    return f"Asset risk {b} -> {a} (projected, not verified)."


def options(ctx: RunContext) -> list[ActionOption]:
    base = assess(ctx, Mods())
    base_city = city_index(ctx, base)
    out = []
    names = {a.id: a for a in ctx.bundle.assets}
    for asset in ctx.bundle.assets:
        for action, definition in ACTIONS.items():
            ok, reason = _applicable(ctx, asset, action)  # type: ignore[arg-type]
            projected = reduction = city_reduction = None
            justification = reason or definition.description
            if ok and definition.modelled:
                mods = Mods()
                _apply(ctx, mods, asset.id, action)  # type: ignore[arg-type]
                after = assess(ctx, mods)
                b, a = base[asset.id].score, after[asset.id].score
                if b is not None and a is not None:
                    projected, reduction = a, round(b - a, 2)
                    city_reduction = round(base_city - city_index(ctx, after), 2)
                    justification = f"{definition.description} Projected asset risk {b} -> {a}."
            elif ok:
                state = base[asset.id]
                level = risk_engine.category(state.score) if state.score is not None else "n/a"
                justification = f"{definition.description} Asset is currently {level}."
            out.append(
                ActionOption(
                    asset_id=asset.id,
                    asset_name=names[asset.id].name,
                    action_type=action,  # type: ignore[arg-type]
                    name=definition.name,
                    applicable=ok,
                    modelled=definition.modelled,
                    effort_hours=definition.effort_hours,
                    projected_asset_score=projected,
                    asset_reduction=reduction,
                    city_reduction=city_reduction,
                    justification=justification,
                    operational_disruption=definition.operational_disruption,
                )
            )
    return out


def what_if(ctx: RunContext, request: WhatIfRequest) -> WhatIfResult:
    assert ctx.run is not None
    known = {a.id: a for a in ctx.bundle.assets}
    mods = Mods()
    applied = []
    notes = [
        "Projected results are estimates from the same model. Nothing was changed; the "
        "current assessment is unchanged and no action is verified.",
    ]
    base = assess(ctx, Mods())
    for staged in request.actions:
        asset = known.get(staged.asset_id)
        if asset is None:
            raise KeyError(f"Unknown asset {staged.asset_id}")
        ok, reason = _applicable(ctx, asset, staged.action_type)
        if not ok:
            notes.append(f"{staged.asset_id} {staged.action_type}: skipped. {reason}")
            continue
        _apply(ctx, mods, staged.asset_id, staged.action_type)
        applied.append(staged)
    after = assess(ctx, mods)
    deltas, actions_out = [], []
    for asset in ctx.bundle.assets:
        b, a = base[asset.id].score, after[asset.id].score
        if b is None or a is None:
            continue
        deltas.append(
            AssetDelta(
                asset_id=asset.id,
                name=asset.name,
                current_score=b,
                projected_score=a,
                current_category=risk_engine.category(b),  # type: ignore[arg-type]
                projected_category=risk_engine.category(a),  # type: ignore[arg-type]
            )
        )
    for staged in applied:
        definition = ACTIONS[staged.action_type]
        actions_out.append(
            AppliedAction(
                asset_id=staged.asset_id,
                asset_name=known[staged.asset_id].name,
                action_type=staged.action_type,
                name=definition.name,
                modelled=definition.modelled,
                effect=_effect_text(ctx, staged.asset_id, staged.action_type, base, after),
                effort_hours=definition.effort_hours,
                operational_disruption=definition.operational_disruption,
            )
        )
    current, projected = city_index(ctx, base), city_index(ctx, after)
    if any(not ACTIONS[a.action_type].modelled for a in applied):
        notes.append(
            "Monitoring and incident-response planning are recommendations: the index has no "
            "detection or recovery term, so they show no modelled reduction."
        )
    return WhatIfResult(
        scenario_id=ctx.bundle.scenario.id,
        snapshot_id=ctx.bundle.snapshot.snapshot_id,
        run_id=ctx.run.id,
        current_city_index=current,
        projected_city_index=projected,
        city_reduction=round(current - projected, 2),
        applied=actions_out,
        asset_deltas=sorted(
            deltas, key=lambda d: d.current_score - d.projected_score, reverse=True
        ),
        services_before=ctx.run.services,
        services_after=_service_risks(ctx, mods),
        notes=notes,
    )


def optimize(ctx: RunContext, request: OptimizeRequest) -> RemediationPlan:
    assert ctx.run is not None
    """Greedy: repeatedly pick the action with the best marginal city-index reduction per
    effort hour, recomputing after every pick so overlapping benefits are not double counted."""
    excluded = set(request.excluded_asset_ids)
    names = {a.id: a for a in ctx.bundle.assets}
    candidates = [
        (a.id, action)
        for a in ctx.bundle.assets
        if a.id not in excluded
        for action, d in ACTIONS.items()
        if d.modelled and _applicable(ctx, a, action)[0]  # type: ignore[arg-type]
    ]
    mods = Mods()
    state = assess(ctx, mods)
    start = city_index(ctx, state)
    current = start
    remaining = request.effort_budget_hours
    steps: list[PlanStep] = []
    chosen: set[tuple[str, str]] = set()
    while True:
        best = None
        for asset_id, action in candidates:
            effort = ACTIONS[action].effort_hours
            if (asset_id, action) in chosen or effort > remaining:
                continue
            trial = Mods(
                {k: set(v) for k, v in mods.patched.items()},
                set(mods.segmented),
                {k: dict(v) for k, v in mods.security.items()},
            )
            _apply(ctx, trial, asset_id, action)  # type: ignore[arg-type]
            after = assess(ctx, trial)
            gain = current - city_index(ctx, after)
            if gain <= 1e-9:
                continue
            key = (gain / effort, gain, asset_id, action)
            if best is None or key > best[0]:
                best = (key, asset_id, action, trial, after, gain)
        if best is None:
            break
        _, asset_id, action, trial, after, gain = best
        definition = ACTIONS[action]
        before_score, after_score = state[asset_id].score, after[asset_id].score
        current -= gain
        remaining -= definition.effort_hours
        mods, state = trial, after
        chosen.add((asset_id, action))
        steps.append(
            PlanStep(
                rank=len(steps) + 1,
                asset_id=asset_id,
                asset_name=names[asset_id].name,
                action_type=action,  # type: ignore[arg-type]
                name=definition.name,
                effort_hours=definition.effort_hours,
                marginal_reduction=round(gain, 2),
                cumulative_reduction=round(start - current, 2),
                city_index_after=round(current, 2),
                justification=f"{definition.description} Asset risk {before_score} -> "
                f"{after_score} (projected).",
                operational_disruption=definition.operational_disruption,
            )
        )
    recommendation_only = [
        o
        for o in options(ctx)
        if not o.modelled and o.asset_id not in excluded and _is_priority(ctx, o.asset_id)
    ]
    return RemediationPlan(
        scenario_id=ctx.bundle.scenario.id,
        snapshot_id=ctx.bundle.snapshot.snapshot_id,
        run_id=ctx.run.id,
        effort_budget_hours=request.effort_budget_hours,
        used_hours=round(request.effort_budget_hours - remaining, 2),
        starting_city_index=start,
        ending_city_index=round(current, 2),
        steps=steps,
        recommendation_only=recommendation_only,
        method="Greedy by marginal city-index reduction per effort hour, recomputed after each "
        "pick. Monitoring and incident-response planning carry no modelled reduction and are "
        "listed separately for assets rated high or critical.",
    )


def _is_priority(ctx: RunContext, asset_id: str) -> bool:
    assert ctx.run is not None
    asset = next(a for a in ctx.run.assets if a.asset_id == asset_id)
    return asset.risk.category in {"high", "critical"}
