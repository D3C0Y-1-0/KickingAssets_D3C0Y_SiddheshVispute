"""Simulation, what-if and remediation orchestration.

Nothing here invents a score. Vulnerability signals come from the trained ML model scored on
real CVEs; consequence comes from the conditional impact engine; the composition is the
published formula in app.engine.risk.
"""

import threading
import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pandas as pd

from app.db.store import read_documents
from app.domain.product_profiles import AssetProduct, load_product_map, product_for
from app.engine import risk as risk_engine
from app.engine.pivot import PivotImpact, WorstCase
from app.schemas.models import (
    ApiIssue,
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
    AssetHistory,
    AssetSimulation,
    AssumedProduct,
    Backtest,
    BacktestGroup,
    BacktestHit,
    CandidateCve,
    CategoryCount,
    ConstraintReport,
    Driver,
    MatchSummary,
    OperationalConstraints,
    OptimizeRequest,
    PatchOutcome,
    PlanHandoffRequest,
    PlanStep,
    ProductMap,
    ProjectionSummary,
    RejectedCandidate,
    RemediationPlan,
    ServiceDisruption,
    ServiceRisk,
    SimulationRun,
    SimulationStage,
    StagedActionRequest,
    WhatIfRequest,
    WhatIfResult,
    WorstScenario,
)
from app.services.remediation import (
    PATCH_BATCH,
    SCORE_EPSILON,
    PatchResolution,
    PlannedAction,
    RemediationError,
    check_plan,
    incompatible_with,
    prerequisites_of,
    resolve_patch,
    run_fingerprint,
    validate_constraints,
)
from ml import inference

TOP_VULNERABILITIES = 8

ACTIONS: dict[str, ActionDefinition] = {
    "patch_prioritization": ActionDefinition(
        type="patch_prioritization",
        name="Patch prioritization",
        description="Patch the KEV-listed and highest ML-ranked CVEs that have a documented fixed "
        f"version, up to {PATCH_BATCH} per maintenance window.",
        modelled=True,
        effort_hours=8,
        downtime_hours=2,
        operational_disruption="Restart or maintenance window; validate vendor compatibility "
        "and rollback first.",
        assumption="A CVE is modelled as fixed only where NVD documents a fixed version (or a "
        "declared target version falls outside its affected ranges). Hours are assumptions.",
    ),
    "network_segmentation": ActionDefinition(
        type="network_segmentation",
        name="Network segmentation",
        description="Remove internet exposure and remote access, and isolate the asset from its "
        "configured cyber routes in both directions.",
        modelled=True,
        effort_hours=24,
        downtime_hours=6,
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
        downtime_hours=1,
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
        downtime_hours=0,
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
        downtime_hours=0,
        operational_disruption="Staff time; no process interruption.",
        assumption="The risk index has no recovery-time term, so no reduction is claimed.",
    ),
}


@dataclass
class AssetEvidence:
    asset: InfrastructureAsset
    product: AssetProduct
    match: inference.ProductCandidates
    unlisted: pd.DataFrame
    listed: pd.DataFrame
    top: list[CandidateCve]
    history: AssetHistory


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
    _patch_cache: dict = field(default_factory=dict)
    _fix_cache: dict = field(default_factory=dict)

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

    def resolve_patch(self, asset_id, cve_ids=None, target_version=None, path="actions"):
        return _resolve_patch(self, asset_id, cve_ids, target_version, path)

    def default_patch(self, asset_id) -> PatchResolution:
        """The patch an asset gets when no CVEs or version are specified (cached)."""
        if asset_id not in self._patch_cache:
            resolution, _ = _resolve_patch(self, asset_id, None, None, "actions")
            assert resolution is not None
            self._patch_cache[asset_id] = resolution
        return self._patch_cache[asset_id]


def _reference(ctx: RunContext):
    assert ctx.run is not None
    return inference.load_reference(ctx.run.as_of)


def _resolve_patch(ctx, asset_id, cve_ids, target_version, path):
    evidence = ctx.evidence[asset_id]
    product = evidence.product
    key = (product.nvd_vendor, product.nvd_product_contains, product.version)
    ref = _reference(ctx)
    if key not in ctx._fix_cache:
        ctx._fix_cache[key] = ref.fixed_versions(
            product.nvd_vendor, list(product.nvd_product_contains), product.version
        )
    return resolve_patch(
        evidence=evidence,
        fixed=ctx._fix_cache[key],
        match_at=lambda v: ref.shared.matcher.match(
            product.nvd_vendor, list(product.nvd_product_contains), v
        ),
        current_version=product.version,
        cve_ids=cve_ids,
        target_version=target_version,
        base_effort=ACTIONS["patch_prioritization"].effort_hours,
        path=path,
    )


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


def _candidate(row: pd.Series, *, drivers: list[dict] | None, listed: bool, ref) -> CandidateCve:
    def num(value):
        return None if pd.isna(value) else float(value)

    kev_added = None
    if listed:
        kev_added = inference.EPOCH + timedelta(
            days=int(ref.ctx["added"][ref.positions[row["cve_id"]]])
        )
    outcome = None if listed else row.get("outcome")
    outcome_date = None if listed or pd.isna(row.get("outcome_date")) else row["outcome_date"]
    return CandidateCve(
        cve_id=row["cve_id"],
        published=row["published"],
        status="kev_listed" if listed else "scored",
        ml_score=None if listed else round(float(row["ml_score"]), 6),
        priority_percentile=None if listed else round(float(row["priority_percentile"]), 6),
        epss_percentile=num(row["epss_percentile"]),
        cvss_score=num(row["cvss_score"]),
        kev_added=kev_added,
        applicability=row["applicability"],
        outcome=outcome,
        outcome_date=outcome_date,
        drivers=[Driver(**d) for d in drivers or []],
    )


def _signal(evidence: AssetEvidence, patched: set[str]) -> float | None:
    total = len(evidence.unlisted) + len(evidence.listed)
    if total == 0:
        # A known product with no applicable CVE is a real zero; an unknown product is missing.
        return 0.0 if evidence.match.product_known else None
    unlisted = evidence.unlisted[~evidence.unlisted["cve_id"].isin(patched)]
    listed = evidence.listed[~evidence.listed["cve_id"].isin(patched)]
    if len(unlisted) + len(listed) == 0:
        return 0.0
    return risk_engine.vulnerability_signal(
        unlisted["priority_percentile"].tolist(), len(listed), len(unlisted) + len(listed)
    )


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
    label = evidence.product.label
    if state.score is None:
        return RiskAssessment(
            **base,
            status="unavailable",
            unavailable_reason=f"The NVD data has no records for {label}. No data is not the "
            "same as no vulnerabilities.",
        )
    top = evidence.top[:3]
    worst = state.worst
    total = len(evidence.unlisted) + len(evidence.listed)
    signal_text = (
        f"{len(evidence.unlisted)} not-yet-listed and {len(evidence.listed)} CISA-KEV-listed CVEs "
        f"have NVD affected ranges that include {label}; the signal is the highest ML priority "
        "percentile among them (a KEV-listed CVE sets a floor)."
        if total
        else f"No CVE in the NVD data has an affected range that includes {label}, so the "
        "signal is 0 (the product is known to NVD)."
    )
    factors = [
        RiskFactor(
            name="ML vulnerability signal",
            contribution=state.signal or 0.0,
            evidence_ids=[c.cve_id for c in top],
            explanation=signal_text,
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


def _backtest(ref, evidence: dict[str, AssetEvidence]) -> Backtest:
    """Compare what the model flagged at the simulated date with what really entered KEV."""
    split = inference.split_label(ref.as_of)
    held_out = inference.is_held_out(ref.as_of)
    note = (
        "These CVEs were scored using only information available at the simulated date; the "
        "outcomes are the real CISA KEV additions that followed."
    )
    if not held_out:
        note += (
            " This date lies in a period the model was trained or tuned on, so the result is "
            "optimistic. Use a held-out date (2025 onward) for an honest check."
        )
    if not ref.outcome_window_closed:
        return Backtest(
            as_of=ref.as_of,
            split=split,
            held_out=held_out,
            window_days=inference.OUTCOME_HORIZON_DAYS,
            window_closed=False,
            cves_evaluated=0,
            became_kev=0,
            groups=[],
            hits=[],
            note="The 180-day outcome window has not closed yet, so there is nothing to check.",
        )
    frames, assets_by_cve = [], {}
    for asset_id, item in evidence.items():
        if len(item.unlisted):
            frames.append(
                item.unlisted[
                    ["cve_id", "priority_percentile", "epss_percentile", "outcome", "outcome_date"]
                ]
            )
        for cve in item.unlisted["cve_id"]:
            assets_by_cve.setdefault(cve, []).append(asset_id)
    if not frames:
        return Backtest(
            as_of=ref.as_of,
            split=split,
            held_out=held_out,
            window_days=inference.OUTCOME_HORIZON_DAYS,
            window_closed=True,
            cves_evaluated=0,
            became_kev=0,
            groups=[],
            hits=[],
            note=note,
        )
    table = pd.concat(frames).drop_duplicates("cve_id")
    table["hit"] = table["outcome"] == "added_to_kev"

    def group(label: str, mask) -> BacktestGroup:
        part = table[mask]
        return BacktestGroup(
            label=label,
            cves=int(len(part)),
            hits=int(part["hit"].sum()),
            hit_rate=round(float(part["hit"].mean()), 4) if len(part) else 0.0,
        )

    ml_top = table["priority_percentile"] >= 0.9
    epss_top = table["epss_percentile"].fillna(0) >= 0.9
    groups = [
        group("All version-matched candidates", table["hit"].notna()),
        group("ML top 10%", ml_top),
        group("ML other 90%", ~ml_top),
        group("EPSS top 10%", epss_top),
        group("EPSS other 90%", ~epss_top),
    ]
    hits = [
        BacktestHit(
            cve_id=row.cve_id,
            assets=sorted(assets_by_cve[row.cve_id]),
            priority_percentile=round(float(row.priority_percentile), 4),
            epss_percentile=None
            if pd.isna(row.epss_percentile)
            else round(float(row.epss_percentile), 4),
            kev_added=row.outcome_date,
        )
        for row in table[table["hit"]]
        .sort_values("priority_percentile", ascending=False)
        .itertuples()
    ][:15]
    return Backtest(
        as_of=ref.as_of,
        split=split,
        held_out=held_out,
        window_days=inference.OUTCOME_HORIZON_DAYS,
        window_closed=True,
        cves_evaluated=int(len(table)),
        became_kev=int(table["hit"].sum()),
        groups=groups,
        hits=hits,
        note=note,
    )


def product_map() -> ProductMap:
    products, provenance = load_product_map()
    return ProductMap(
        provenance_note=provenance["notes"],
        products=[
            AssumedProduct(
                asset_id=p.asset_id,
                label=p.label,
                vendor=p.vendor,
                product=p.product,
                version=p.version,
                nvd_vendor=p.nvd_vendor,
                product_filters=list(p.nvd_product_contains),
                role=p.role,
            )
            for _, p in sorted(products.items())
        ],
    )


STAGE_NAMES = [
    "Load inventory",
    "Load reference data and model",
    "Match real products to NVD affected-version ranges and score with the ML model",
    "Explain top candidates",
    "Reachability and conditional service impact",
    "Backtest against real KEV outcomes",
    "Compose risk index",
]


class Progress:
    """Live state of the run in flight. Written by run_simulation, read by the progress endpoint."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.state: dict = {"status": "idle", "steps": [], "note": None}

    def begin(self) -> None:
        with self._lock:
            self.state = {
                "status": "running",
                "steps": [
                    {"name": n, "detail": "", "seconds": None, "status": "pending"}
                    for n in STAGE_NAMES
                ],
                "note": None,
            }
            self.state["steps"][0]["status"] = "active"

    def note(self, text: str) -> None:
        with self._lock:
            self.state["note"] = text

    def done(self, name: str, detail: str, seconds: float) -> None:
        with self._lock:
            steps = self.state["steps"]
            for i, step in enumerate(steps):
                if step["name"] == name:
                    step.update(detail=detail, seconds=seconds, status="done")
                    if i + 1 < len(steps):
                        steps[i + 1]["status"] = "active"
            self.state["note"] = None

    def finish(self, ok: bool) -> None:
        with self._lock:
            self.state["status"] = "done" if ok else "failed"
            self.state["note"] = None

    def snapshot(self) -> dict:
        with self._lock:
            return {**self.state, "steps": [dict(s) for s in self.state["steps"]]}


PROGRESS = Progress()


def run_simulation(
    db_path: Path, scenario_id: str, snapshot_id: str, as_of: date | None = None
) -> RunContext:
    PROGRESS.begin()
    try:
        ctx = _run_simulation(db_path, scenario_id, snapshot_id, as_of)
    except BaseException:
        PROGRESS.finish(False)
        raise
    PROGRESS.finish(True)
    return ctx


def _run_simulation(
    db_path: Path, scenario_id: str, snapshot_id: str, as_of: date | None = None
) -> RunContext:
    stages: list[SimulationStage] = []
    clock = time.perf_counter()

    def stage(name: str, detail: str) -> None:
        nonlocal clock
        now = time.perf_counter()
        seconds = round(now - clock, 2)
        stages.append(SimulationStage(name=name, detail=detail, seconds=seconds))
        PROGRESS.done(name, detail, seconds)
        clock = now

    bundle = load_bundle(db_path, scenario_id, snapshot_id)
    stage(
        "Load inventory", f"{len(bundle.assets)} fictional assets, {len(bundle.services)} services"
    )

    ref = inference.load_reference(as_of)
    stage(
        "Load reference data and model",
        f"KEV, NVD and EPSS as of {ref.as_of}; model {inference.MODEL_VERSION}",
    )

    cache: dict[tuple, tuple] = {}
    evidence: dict[str, AssetEvidence] = {}
    total_candidates = confirmed_total = 0
    for number, asset in enumerate(sorted(bundle.assets, key=lambda a: a.id), start=1):
        product = product_for(asset.id)
        PROGRESS.note(f"{number}/{len(bundle.assets)} · {asset.id} · {product.label}")
        key = (product.nvd_vendor, product.nvd_product_contains, product.version)
        if key not in cache:
            match = ref.match_product(
                product.nvd_vendor, list(product.nvd_product_contains), product.version
            )
            unlisted = ref.score_positions(match.unlisted)
            unlisted["applicability"] = [match.applicability[c] for c in unlisted["cve_id"]]
            outcomes = ref.outcomes(match.unlisted)
            unlisted["outcome"] = [o for o, _ in outcomes]
            unlisted["outcome_date"] = [d for _, d in outcomes]
            listed = ref.frame(match.listed)
            listed["applicability"] = [match.applicability[c] for c in listed["cve_id"]]
            history = AssetHistory(
                **ref.history(
                    product.nvd_vendor, list(product.nvd_product_contains), match.product_positions
                )
            )
            cache[key] = (match, unlisted, listed, history)
        match, unlisted, listed, history = cache[key]
        total_candidates += len(unlisted) + len(listed)
        confirmed_total += match.confirmed_total
        evidence[asset.id] = AssetEvidence(asset, product, match, unlisted, listed, [], history)
    stage(
        "Match real products to NVD affected-version ranges and score with the ML model",
        f"{len(cache)} distinct real product versions; {total_candidates:,} applicable "
        "CVE-asset pairs scored live",
    )

    top_by_key: dict[tuple, list[CandidateCve]] = {}
    for key, (_match, unlisted, listed, _history) in cache.items():
        newest_listed = listed.sort_values("published", ascending=False).head(3)
        ranked = unlisted.sort_values("ml_score", ascending=False).head(TOP_VULNERABILITIES)
        drivers = ref.drivers(ranked.reset_index(drop=True), top=3)
        items = [
            _candidate(r, drivers=None, listed=True, ref=ref) for _, r in newest_listed.iterrows()
        ]
        items += [
            _candidate(r, drivers=d, listed=False, ref=ref)
            for (_, r), d in zip(ranked.iterrows(), drivers, strict=True)
        ]
        top_by_key[key] = items[:TOP_VULNERABILITIES]
    for item in evidence.values():
        item.top = top_by_key[
            (item.product.nvd_vendor, item.product.nvd_product_contains, item.product.version)
        ]
    stage("Explain top candidates", "Exact TreeSHAP drivers for the highest-ranked CVEs")

    pivot = PivotImpact(bundle)
    ctx = RunContext(bundle, pivot, evidence)
    states = assess(ctx, Mods())
    stage(
        "Reachability and conditional service impact",
        "Cyber routes decide where an attacker could pivot; the dependency graph decides "
        "what that does to services",
    )

    backtest = _backtest(ref, evidence)
    stage(
        "Backtest against real KEV outcomes",
        f"{backtest.cves_evaluated} CVEs evaluated; {backtest.became_kev} later entered KEV"
        if backtest.window_closed
        else "Outcome window not closed for this date",
    )

    now = datetime.now(UTC)
    names = {a.id: a.name for a in bundle.assets}
    service_names = {s.id: s.name for s in bundle.services}
    assets_out = []
    for asset in bundle.assets:
        state = states[asset.id]
        worst = state.worst
        item = evidence[asset.id]
        match = item.match
        assets_out.append(
            AssetSimulation(
                asset_id=asset.id,
                name=asset.name,
                sector=asset.sector,
                asset_type=asset.asset_type,
                criticality=asset.criticality,
                product=AssumedProduct(
                    asset_id=asset.id,
                    label=item.product.label,
                    vendor=item.product.vendor,
                    product=item.product.product,
                    version=item.product.version,
                    nvd_vendor=item.product.nvd_vendor,
                    product_filters=list(item.product.nvd_product_contains),
                    role=item.product.role,
                ),
                matching=MatchSummary(
                    version_confirmed=match.confirmed_total,
                    version_unknown=match.unknown_total,
                    excluded_by_version=match.excluded_total,
                    kev_listed=len(item.listed),
                    scored=len(item.unlisted),
                    product_known=match.product_known,
                ),
                history=item.history,
                candidate_count=len(item.unlisted) + len(item.listed),
                known_exploited_count=len(item.listed),
                vulnerability_signal=state.signal,
                top_vulnerabilities=item.top,
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
    ordered = sorted(
        assets_out,
        key=lambda a: (-(a.risk.score if a.risk.score is not None else -1.0), a.asset_id),
    )
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
        id=f"run-{now:%Y%m%d-%H%M%S}-{ref.as_of:%Y%m}",
        fingerprint=run_fingerprint(
            scenario_id=scenario_id,
            snapshot_id=snapshot_id,
            as_of=ref.as_of.isoformat(),
            model_version=inference.MODEL_VERSION,
            scoring_version=risk_engine.SCORING_VERSION,
            city_score=index,
            asset_scores=[(a.asset_id, a.risk.score) for a in assets_out],
        ),
        as_of=ref.as_of,
        as_of_split=inference.split_label(ref.as_of),
        held_out=inference.is_held_out(ref.as_of),
        backtest=backtest,
        kev_released=ref.kev_released,
        model_version=inference.MODEL_VERSION,
        created_at=now,
        stages=stages,
        city_risk=city,
        category_counts=[CategoryCount(category=k, count=v) for k, v in counts.items()],
        assets=ordered,
        services=_service_risks(ctx, Mods()),
        assumptions=[
            "Assets are fictional. Each is ASSUMED to run a specific real product and version "
            "(see the product map); that assumption is not a scan result.",
            "A CVE applies when the NVD affected-version ranges include the assumed version "
            "(version_confirmed) or the product matches but no range can be evaluated "
            "(version_unknown, lower confidence). CVEs whose ranges exclude the version are not "
            f"counted. Candidates are CVEs published at least 30 days before {ref.as_of}.",
            "CVEs already listed in CISA KEV at that date are shown as known exploited and set a "
            "floor on the vulnerability signal; the others are scored by the ML model using "
            "only information available at that date.",
            "The ML score is a KEV-prioritisation signal converted to a percentile against all "
            "not-yet-listed CVEs at the snapshot. It is not the probability that an asset is "
            "attacked.",
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


def _apply(
    ctx: RunContext,
    mods: Mods,
    asset_id: str,
    action: ActionType,
    resolution: PatchResolution | None = None,
) -> None:
    if action == "patch_prioritization":
        resolution = resolution or ctx.default_patch(asset_id)
        mods.patched.setdefault(asset_id, set()).update(resolution.cves)
    elif action == "network_segmentation":
        mods.segmented.add(asset_id)
        mods.security.setdefault(asset_id, {}).update(internet_exposed=False, remote_access=False)
    elif action == "access_control":
        mods.security.setdefault(asset_id, {}).update(mfa_enabled=True, remote_access=False)


def _copy(mods: Mods) -> Mods:
    return Mods(
        {k: set(v) for k, v in mods.patched.items()},
        set(mods.segmented),
        {k: dict(v) for k, v in mods.security.items()},
    )


def _effect_text(
    ctx: RunContext, asset_id: str, action: ActionType, before, after, patch: PatchOutcome | None
) -> str:
    definition = ACTIONS[action]
    if not definition.modelled:
        return "Recommendation only: " + definition.assumption
    b, a = before[asset_id].score, after[asset_id].score
    if b is None or a is None:
        return "No score available to compare."
    text = f"Asset risk {b} -> {a} (projected, not verified)."
    if patch is not None:
        text += (
            f" {len(patch.remediated)} CVE(s) modelled as remediated, "
            f"{len(patch.not_remediated)} not remediated."
        )
    return text


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
                    if action == "patch_prioritization":
                        patch = ctx.default_patch(asset.id)
                        justification += (
                            f" {len(patch.remediated)} CVE(s) have a documented fix; "
                            f"{len(patch.not_remediated)} top-ranked CVE(s) do not."
                        )
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


@dataclass(frozen=True)
class ResolvedAction:
    staged: StagedActionRequest
    asset: InfrastructureAsset
    path: str
    patch: PatchResolution | None

    @property
    def definition(self) -> ActionDefinition:
        return ACTIONS[self.staged.action_type]

    @property
    def effort_hours(self) -> float:
        return self.patch.effort_hours if self.patch else self.definition.effort_hours

    def planned(self) -> PlannedAction:
        return PlannedAction(
            self.path,
            self.asset.id,
            self.staged.action_type,
            self.effort_hours,
            self.definition.downtime_hours,
        )


def _validate_actions(
    ctx: RunContext, staged: list[StagedActionRequest], constraints: OperationalConstraints | None
) -> list[ResolvedAction]:
    """Resolve every staged action or reject the whole request with every problem found."""
    known = {a.id: a for a in ctx.bundle.assets}
    issues = validate_constraints(constraints)
    resolved: list[ResolvedAction] = []
    seen: dict[tuple[str, str], int] = {}
    for i, item in enumerate(staged):
        path = f"actions[{i}]"
        asset = known.get(item.asset_id)
        if asset is None:
            issues.append(
                ApiIssue(
                    path=f"{path}.asset_id",
                    code="unknown_asset",
                    message=f"No asset {item.asset_id} in this scenario.",
                )
            )
            continue
        key = (item.asset_id, item.action_type)
        if key in seen:
            issues.append(
                ApiIssue(
                    path=path,
                    code="duplicate_action",
                    message=f"{item.action_type} on {item.asset_id} is already staged at "
                    f"actions[{seen[key]}]. List the action once; patch CVEs go in cve_ids.",
                )
            )
            continue
        seen[key] = i
        if item.action_type != "patch_prioritization" and (item.cve_ids or item.target_version):
            issues.append(
                ApiIssue(
                    path=path,
                    code="parameter_not_applicable",
                    message="cve_ids and target_version apply only to patch_prioritization.",
                )
            )
            continue
        ok, reason = _applicable(ctx, asset, item.action_type)
        if not ok:
            issues.append(
                ApiIssue(
                    path=path,
                    code="action_not_applicable",
                    message=f"{item.action_type} does not apply to {item.asset_id}: {reason}",
                )
            )
            continue
        patch = None
        if item.action_type == "patch_prioritization":
            patch, problems = ctx.resolve_patch(
                asset.id, item.cve_ids, item.target_version, path=path
            )
            issues.extend(problems)
            if patch is None:
                continue
        resolved.append(ResolvedAction(item, asset, path, patch))
    if issues:
        raise RemediationError(
            422, "invalid_actions", f"{len(issues)} problem(s) in the request.", issues
        )
    problems, _ = check_plan([r.planned() for r in resolved], constraints)
    if problems:
        raise RemediationError(
            422,
            "constraint_violation",
            "The staged actions do not fit the operational constraints.",
            problems,
        )
    return resolved


def _category_counts(ctx: RunContext, states: dict[str, AssetState]) -> list[CategoryCount]:
    counts = {c: 0 for c in ("critical", "high", "medium", "low")}
    for state in states.values():
        if state.score is not None:
            counts[risk_engine.category(state.score)] += 1  # type: ignore[index]
    return [CategoryCount(category=k, count=v) for k, v in counts.items()]  # type: ignore[arg-type]


def _outcome(modelled: bool, marginal: float) -> str:
    if not modelled:
        return "recommendation_only"
    if marginal > SCORE_EPSILON:
        return "reduces_modelled_risk"
    if marginal < -SCORE_EPSILON:
        return "increases_modelled_risk"
    return "no_modelled_reduction"


def what_if(ctx: RunContext, request: WhatIfRequest) -> WhatIfResult:
    """Project the staged actions on top of the bound run. The run itself is never modified."""
    assert ctx.run is not None
    resolved = _validate_actions(ctx, request.actions, request.constraints)
    base = assess(ctx, Mods())
    current = city_index(ctx, base)
    if ctx.run.city_risk.score is None or abs(current - ctx.run.city_risk.score) > 0.01:
        raise RemediationError(
            409,
            "baseline_inconsistent",
            "The run's stored city index no longer reproduces from its inputs. Re-run the "
            "simulation.",
        )
    notes = [
        "Projected results are estimates from the same model. Nothing was changed; the "
        "current assessment is unchanged and no action is verified.",
    ]
    mods = Mods()
    sequence, standalone = [], []
    running = current
    for item in resolved:
        action = item.staged.action_type
        alone = Mods()
        _apply(ctx, alone, item.asset.id, action, item.patch)
        standalone.append(current - city_index(ctx, assess(ctx, alone)))
        _apply(ctx, mods, item.asset.id, action, item.patch)
        after_step = city_index(ctx, assess(ctx, mods))
        sequence.append(running - after_step)
        running = after_step
    after = assess(ctx, mods)
    projected = city_index(ctx, after)
    deltas = []
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
    applied = []
    for item, marginal, alone in zip(resolved, sequence, standalone, strict=True):
        definition = item.definition
        action = item.staged.action_type
        patch = item.patch.outcome() if item.patch else None
        outcome = _outcome(definition.modelled, marginal)
        applied.append(
            AppliedAction(
                asset_id=item.asset.id,
                asset_name=item.asset.name,
                action_type=action,
                name=definition.name,
                modelled=definition.modelled,
                effect=_effect_text(ctx, item.asset.id, action, base, after, patch),
                effort_hours=item.effort_hours,
                downtime_hours=definition.downtime_hours,
                operational_disruption=definition.operational_disruption,
                outcome=outcome,  # type: ignore[arg-type]
                standalone_city_reduction=round(alone, 2) if definition.modelled else None,
                marginal_city_reduction=round(marginal, 2) if definition.modelled else None,
                patch=patch,
            )
        )
        if outcome in ("no_modelled_reduction", "increases_modelled_risk"):
            notes.append(
                f"{item.asset.id} {action}: valid, but the modelled city-index change is "
                f"{-marginal:+.2f}. This is not an error; it means the model finds no benefit "
                "after the earlier actions."
            )
        if patch is not None and patch.not_remediated:
            notes.append(
                f"{item.asset.id} patch: {len(patch.not_remediated)} targeted CVE(s) are NOT "
                "modelled as remediated (see patch.not_remediated)."
            )
    if any(not a.modelled for a in applied):
        notes.append(
            "Monitoring and incident-response planning are recommendations: the index has no "
            "detection or recovery term, so they show no modelled reduction."
        )
    total_effort = round(sum(a.effort_hours for a in applied), 2)
    total_downtime = round(sum(a.downtime_hours for a in applied), 2)
    _, checks = check_plan([r.planned() for r in resolved], request.constraints)
    if total_downtime:
        notes.append(
            f"Trade-off: the staged actions need about {total_downtime} h of modelled downtime "
            "and may interrupt operations (see each action's operational_disruption)."
        )
    joint = current - projected
    return WhatIfResult(
        scenario_id=ctx.bundle.scenario.id,
        snapshot_id=ctx.bundle.snapshot.snapshot_id,
        run_id=ctx.run.id,
        baseline_fingerprint=ctx.run.fingerprint,
        current_city_index=current,
        projected_city_index=projected,
        city_reduction=round(joint, 2),
        summary=ProjectionSummary(
            current_city_index=current,
            projected_city_index=projected,
            city_reduction=round(joint, 2),
            current_category_counts=_category_counts(ctx, base),
            projected_category_counts=_category_counts(ctx, after),
            overlap_adjustment=round(sum(standalone) - joint, 2),
        ),
        constraint_report=ConstraintReport(
            constraints_supplied=request.constraints is not None,
            total_effort_hours=total_effort,
            total_downtime_hours=total_downtime,
            checks=checks,
        ),
        applied=applied,
        asset_deltas=sorted(
            deltas, key=lambda d: (d.current_score - d.projected_score, d.asset_id), reverse=True
        ),
        services_before=ctx.run.services,
        services_after=_service_risks(ctx, mods),
        notes=notes,
    )


PLAN_LIMITATIONS = [
    "Greedy heuristic: each step takes the best marginal city-index reduction per effort hour. "
    "It is not proven optimal and can miss a better combination (for example when a large "
    "action would have beaten several small ones within the budget).",
    "At most one action of each type per asset; a patch step covers one batch of CVEs with a "
    "documented fixed version and never a later batch for the same asset.",
    "Only patching, segmentation and access control have a modelled effect. Monitoring and "
    "incident response are listed as recommendations with no claimed reduction.",
    "Effort and downtime hours are fixed modelling assumptions per action type, not estimates "
    "for a real site. Calendar scheduling, crew availability and rollback are not modelled.",
    "A CVE counts as remediated only if NVD documents a fixed version; CVEs without one remain "
    "in the score even when a vendor patch may exist.",
    "Projections are not verified: the software changes nothing and no state is 'verified' "
    "until an updated inventory is re-imported.",
]


def optimize(ctx: RunContext, request: OptimizeRequest) -> RemediationPlan:
    """Greedy marginal-benefit planner. Recomputes the whole score after every pick, so
    overlapping benefits are counted once. Not claimed to be globally optimal."""
    assert ctx.run is not None
    constraints = request.constraints
    known = {a.id: a for a in ctx.bundle.assets}
    issues = validate_constraints(constraints)
    repeated = sorted(
        {a for a in request.excluded_asset_ids if request.excluded_asset_ids.count(a) > 1}
    )
    for asset_id in repeated:
        issues.append(
            ApiIssue(
                path="excluded_asset_ids",
                code="duplicate_exclusion",
                message=f"{asset_id} is excluded more than once.",
            )
        )
    for i, asset_id in enumerate(request.excluded_asset_ids):
        if asset_id not in known:
            issues.append(
                ApiIssue(
                    path=f"excluded_asset_ids[{i}]",
                    code="unknown_asset",
                    message=f"No asset {asset_id} in this scenario, so it cannot be excluded.",
                )
            )
    if issues:
        raise RemediationError(
            422, "invalid_request", f"{len(issues)} problem(s) in the request.", issues
        )
    excluded = set(request.excluded_asset_ids)
    names = known

    mods = Mods()
    state = assess(ctx, mods)
    start = city_index(ctx, state)
    if ctx.run.city_risk.score is None or abs(start - ctx.run.city_risk.score) > 0.01:
        raise RemediationError(
            409,
            "baseline_inconsistent",
            "The run's stored city index no longer reproduces from its inputs. Re-run the "
            "simulation.",
        )
    current = start
    budget = request.effort_budget_hours
    used_effort = used_downtime = 0.0
    chosen: dict[str, set[str]] = {}
    steps: list[PlanStep] = []
    staged: list[StagedActionRequest] = []

    def cost(asset_id: str, action: str) -> tuple[float, float]:
        if action == "patch_prioritization":
            effort = ctx.default_patch(asset_id).effort_hours
        else:
            effort = ACTIONS[action].effort_hours
        return effort, ACTIONS[action].downtime_hours

    def members_for(asset_id: str, action: str) -> list[str]:
        needed = [
            p for p in prerequisites_of(action, constraints) if p not in chosen.get(asset_id, ())
        ]
        return needed + [action]

    def feasibility(asset_id: str, action: str) -> tuple[str, str] | None:
        members = members_for(asset_id, action)
        present = set(chosen.get(asset_id, ())) | set(members)
        for member in members:
            ok, reason = _applicable(ctx, known[asset_id], member)  # type: ignore[arg-type]
            if not ok:
                return (
                    "prerequisite_not_applicable" if member != action else "not_applicable",
                    f"{member} cannot be applied to {asset_id}: {reason}",
                )
            clash = incompatible_with(member, present - {member}, constraints)
            if clash:
                return (
                    "incompatible_with_selected",
                    f"{member} is incompatible with {clash} on {asset_id}.",
                )
        costs = [cost(asset_id, m) for m in members]
        window = constraints.max_downtime_per_action_hours if constraints else None
        if window is not None and any(d > window for _, d in costs):
            return (
                "exceeds_maintenance_window",
                f"{action} on {asset_id} needs more downtime than the {window} h window.",
            )
        limit = constraints.max_total_downtime_hours if constraints else None
        extra_downtime = sum(d for _, d in costs)
        if limit is not None and used_downtime + extra_downtime > limit + SCORE_EPSILON:
            return (
                "exceeds_downtime_budget",
                f"{action} on {asset_id} would bring downtime to "
                f"{round(used_downtime + extra_downtime, 2)} h, over the {limit} h limit.",
            )
        extra_effort = sum(e for e, _ in costs)
        if used_effort + extra_effort > budget + SCORE_EPSILON:
            return (
                "exceeds_effort_budget",
                f"{action} on {asset_id} needs {extra_effort} h; "
                f"{round(budget - used_effort, 2)} h remain.",
            )
        return None

    def trial_for(asset_id: str, action: str):
        trial = _copy(mods)
        sequence = []
        running = current
        for member in members_for(asset_id, action):
            _apply(ctx, trial, asset_id, member)  # type: ignore[arg-type]
            after = assess(ctx, trial)
            now = city_index(ctx, after)
            sequence.append((member, running - now, after))
            running = now
        return trial, sequence

    universe = [
        (a.id, action)
        for a in ctx.bundle.assets
        if a.id not in excluded
        for action, definition in ACTIONS.items()
        if definition.modelled and _applicable(ctx, a, action)[0]  # type: ignore[arg-type]
    ]
    while True:
        best = None
        for asset_id, action in universe:
            if action in chosen.get(asset_id, ()) or feasibility(asset_id, action):
                continue
            trial, sequence = trial_for(asset_id, action)
            gain = sum(g for _, g, _ in sequence)
            if gain <= SCORE_EPSILON:
                continue
            effort = sum(cost(asset_id, m)[0] for m, _, _ in sequence)
            ratio = gain / effort
            key = (-round(ratio, 9), -round(gain, 9), asset_id, action)
            if best is None or key < best[0]:
                best = (key, asset_id, action, trial, sequence, gain)
        if best is None:
            break
        _, asset_id, action, trial, sequence, gain = best
        for member, member_gain, after in sequence:
            definition = ACTIONS[member]
            effort, downtime = cost(asset_id, member)
            before_score, after_score = state[asset_id].score, after[asset_id].score
            current -= member_gain
            used_effort += effort
            used_downtime += downtime
            chosen.setdefault(asset_id, set()).add(member)
            patch = ctx.default_patch(asset_id) if member == "patch_prioritization" else None
            state = after
            steps.append(
                PlanStep(
                    rank=len(steps) + 1,
                    kind="selected" if member == action else "prerequisite",
                    prerequisite_for=None if member == action else action,
                    asset_id=asset_id,
                    asset_name=names[asset_id].name,
                    action_type=member,  # type: ignore[arg-type]
                    name=definition.name,
                    effort_hours=effort,
                    downtime_hours=downtime,
                    marginal_reduction=round(member_gain, 2),
                    reduction_per_effort_hour=round(member_gain / effort, 4),
                    cumulative_reduction=round(start - current, 2),
                    city_index_after=round(current, 2),
                    justification=f"{definition.description} Asset risk {before_score} -> "
                    f"{after_score} (projected)."
                    + (f" Prerequisite for {action}." if member != action else ""),
                    operational_disruption=definition.operational_disruption,
                    patch=patch.outcome() if patch else None,
                )
            )
            staged.append(
                StagedActionRequest(
                    asset_id=asset_id,
                    action_type=member,  # type: ignore[arg-type]
                    cve_ids=[r.cve_id for r in patch.remediated]
                    if patch and patch.remediated
                    else None,
                )
            )
        mods = trial
    rejected = _rejected(ctx, excluded, chosen, feasibility, trial_for)
    recommendation_only = [
        o
        for o in options(ctx)
        if not o.modelled and o.asset_id not in excluded and _is_priority(ctx, o.asset_id)
    ]
    return RemediationPlan(
        scenario_id=ctx.bundle.scenario.id,
        snapshot_id=ctx.bundle.snapshot.snapshot_id,
        run_id=ctx.run.id,
        baseline_fingerprint=ctx.run.fingerprint,
        effort_budget_hours=budget,
        used_hours=round(used_effort, 2),
        used_downtime_hours=round(used_downtime, 2),
        starting_city_index=start,
        ending_city_index=round(current, 2),
        steps=steps,
        rejected=rejected,
        recommendation_only=recommendation_only,
        what_if_request=PlanHandoffRequest(
            scenario_id=ctx.bundle.scenario.id,
            snapshot_id=ctx.bundle.snapshot.snapshot_id,
            run_id=ctx.run.id,
            baseline_fingerprint=ctx.run.fingerprint,
            actions=staged or [],
            constraints=constraints,
        )
        if staged
        else None,
        method="Greedy by marginal city-index reduction per effort hour, recomputed after each "
        "pick. Ties break on larger absolute reduction, then asset id, then action name. "
        "Monitoring and incident-response planning carry no modelled reduction and are listed "
        "separately for assets rated high or critical.",
        limitations=PLAN_LIMITATIONS,
    )


def _rejected(ctx, excluded, chosen, feasibility, trial_for) -> list[RejectedCandidate]:
    """Why every modelled action that was not selected was not selected, at the final state."""
    out: list[RejectedCandidate] = []
    for asset in ctx.bundle.assets:
        for action, definition in ACTIONS.items():
            if not definition.modelled or action in chosen.get(asset.id, ()):
                continue
            if asset.id in excluded:
                code, reason = "asset_excluded", f"{asset.id} was excluded from the plan."
            else:
                ok, why = _applicable(ctx, asset, action)  # type: ignore[arg-type]
                if not ok:
                    code, reason = "not_applicable", why
                elif problem := feasibility(asset.id, action):
                    code, reason = problem
                else:
                    _, sequence = trial_for(asset.id, action)
                    gain = sum(g for _, g, _ in sequence)
                    if gain < -SCORE_EPSILON:
                        code, reason = "increases_modelled_risk", f"Modelled change {-gain:+.2f}."
                    else:
                        code = "no_modelled_reduction"
                        reason = "No modelled city-index reduction after the selected actions."
                        if action == "patch_prioritization":
                            missing = ctx.default_patch(asset.id).not_remediated
                            if missing:
                                reason += (
                                    f" {len(missing)} top-ranked CVE(s) have no documented fixed "
                                    "version, so none is modelled as remediated."
                                )
            out.append(
                RejectedCandidate(
                    asset_id=asset.id,
                    action_type=action,  # type: ignore[arg-type]
                    reason_code=code,  # type: ignore[arg-type]
                    reason=reason,
                )
            )
    return out


def _is_priority(ctx: RunContext, asset_id: str) -> bool:
    assert ctx.run is not None
    asset = next(a for a in ctx.run.assets if a.asset_id == asset_id)
    return asset.risk.category in {"high", "critical"}
