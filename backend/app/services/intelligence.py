"""Snapshot-scoped orchestration: reference applicability -> CVE signal -> conditional impact -> index."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException

from app.db.store import connection, read_documents
from app.db.vulnerability_store import active_dataset
from app.db.vulnerability_store import report as vulnerability_report
from app.domain.seed import ROOT
from app.engine.impact import ENGINE_VERSION, ConditionalImpactEngine, ImpactPolicy
from app.schemas.intelligence import AssetPriority, IntelligenceReport
from app.schemas.models import Provenance, RiskAssessment, RiskFactor, ScenarioBundle
from app.services import model_signal
from app.services.inventory import Inventory
from app.services.vulnerability_ingestion import digest, load_dataset

SCORING_VERSION = "asset-priority-v1.1"
INPUTS = ROOT / "data/reference/risk-inference.json"
RISK_CACHE = ROOT / "data/reference/risk-v1"
LIMITS = [
    "Relative review-priority index, not an asset-compromise probability or incident prediction.",
    "Curated CVE coverage only; unknown product/version, candidate-only and missing inputs remain unavailable.",
    "Infrastructure, software and controls are simulated assumptions. Current references are applied retrospectively to the inventory snapshot.",
    "Impact assumes each asset separately becomes unavailable for 1440 minutes, without operator recovery; this is not inferred exploit success.",
    "Impact is an upper bound with respect to backups: requirement-level backups do not relieve edge cascades.",
    "Covered-asset mean excludes unavailable assets and is not a city-wide risk estimate. No trend is inferred from one inventory snapshot.",
]


def bundle(path: Path, scenario_id: str, snapshot_id: str | None) -> ScenarioBundle:
    scenario_id, snapshot_id = Inventory(path).context(scenario_id, snapshot_id)
    scenario = read_documents(path, "scenarios", scenario_id)[0]
    # A historical snapshot can be analyzed without changing the persisted current pointer.
    scenario = {**scenario, "current_snapshot_id": snapshot_id}
    return ScenarioBundle(
        scenario=scenario,
        snapshot=read_documents(path, "snapshots", scenario_id, snapshot_id)[0],
        **{
            key: read_documents(path, table, scenario_id, snapshot_id)
            for key, table in (
                ("assets", "assets"),
                ("cyber_edges", "cyber_edges"),
                ("operational_edges", "operational_edges"),
                ("services", "services"),
            )
        },
    )


def prepare(path, scenario_id, snapshot_id):
    inputs = bundle(path, scenario_id, snapshot_id)
    assessment = vulnerability_report(path, scenario_id, inputs.snapshot.snapshot_id)
    if assessment.stale:
        raise HTTPException(
            409, "Vulnerability assessment is stale; reassess vulnerabilities first"
        )
    dataset = active_dataset(path)
    model = model_signal.evidence()
    run_id = digest(
        [
            inputs.model_dump(mode="json"),
            assessment.id,
            dataset.id,
            model.model_dump(mode="json"),
            SCORING_VERSION,
            ENGINE_VERSION,
            digest(json.loads(INPUTS.read_text())),
        ]
    )
    return inputs, assessment, dataset, model, run_id


def migrate(path):
    with connection(path) as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS v3_reports (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE, snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE, payload TEXT NOT NULL)"
        )


def get_report(path: Path, scenario_id: str, snapshot_id: str | None = None) -> IntelligenceReport:
    *_, run_id = prepare(path, scenario_id, snapshot_id)
    with connection(path) as db:
        row = db.execute("SELECT payload FROM v3_reports WHERE id=?", (run_id,)).fetchone()
    if not row:
        raise HTTPException(409, "Risk assessment missing or stale; run a current assessment")
    return IntelligenceReport.model_validate_json(row["payload"])


def category(score: float):
    return (
        "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 35 else "low"
    )


def assess(path: Path, scenario_id: str, snapshot_id: str | None = None) -> IntelligenceReport:
    inputs, assessment, dataset, model, run_id = prepare(path, scenario_id, snapshot_id)
    migrate(path)
    with connection(path) as db:
        prior = db.execute("SELECT payload FROM v3_reports WHERE id=?", (run_id,)).fetchone()
    if prior:
        return IntelligenceReport.model_validate_json(prior["payload"])
    now = datetime.now(UTC)
    provenance = Provenance(
        kind="model",
        source=f"{SCORING_VERSION}; {model.model_version}; {ENGINE_VERSION}",
        recorded_at=now,
        notes="Experimental relative prioritization of simulated assets; not calibrated incident probability.",
    )
    inference = json.loads(INPUTS.read_text())
    # These cached raw NVD records have validated source checksums. Never infer features from asset names.
    raw_dataset = load_dataset(RISK_CACHE)
    raw = {}
    for source in raw_dataset.sources:
        if source.id.startswith("nvd-"):
            for item in json.loads((RISK_CACHE / source.id).read_text())["vulnerabilities"]:
                raw[item["cve"]["id"]] = item["cve"]
    refs = {r.reference.cve_id: r for r in dataset.references}
    signal_by_cve = {}
    for cve_id, reference in refs.items():
        source = raw.get(cve_id)
        rank = inference["ranks"].get(cve_id)
        if source:
            signal_by_cve[cve_id] = model_signal.predict(
                source,
                feature_date=datetime.fromisoformat(inference["feature_date"]).date(),
                epss_rank=rank,
                kev_added=reference.kev_added,
            )
    engine = ConditionalImpactEngine(
        ImpactPolicy(horizon_minutes=1440), state="projected", clock=lambda: now
    )
    impacts = engine.simulate(inputs, {a.id: "unavailability" for a in inputs.assets})
    evidence = {a.asset_id: a for a in assessment.assets}
    results = []
    for asset in inputs.assets:
        item = evidence[asset.id]
        asset_impacts = [r for r in impacts if r.initiating_asset_id == asset.id]
        confirmed = [f for f in item.applicability if f.link.applicability == "confirmed"]
        signals = [
            signal_by_cve[f.link.vulnerability_id]
            for f in item.applicability
            if f.link.vulnerability_id in signal_by_cve and f.link.applicability != "rejected"
        ]
        risk = RiskAssessment(
            scenario_id=scenario_id,
            snapshot_id=inputs.snapshot.snapshot_id,
            asset_id=asset.id,
            state="current",
            provenance=provenance,
            unavailable_reason="No confirmed applicable CVE with complete supported signal inputs in curated coverage",
        )
        candidates = []
        for finding in confirmed:
            ref = refs[finding.link.vulnerability_id]
            signal = signal_by_cve.get(ref.reference.cve_id)
            if (
                signal is not None
                and signal.status != "unavailable"
                and ref.reference.cvss is not None
            ):
                priority = 1.0 if signal.status == "known_kev" else signal.signal
                candidates.append(
                    (0.6 * ref.reference.cvss / 10 + 0.4 * priority, finding.link.id, signal.cve_id)
                )
        exposure = {"external": 1.0, "internal": 0.4, "isolated": 0.1}.get(asset.exposure)
        control_known = asset.security.remote_access is not None and (
            not asset.security.remote_access or asset.security.mfa_enabled is not None
        )
        complete_impact = (
            len(asset_impacts) == len(inputs.services)
            and bool(asset_impacts)
            and all(r.status == "computed" for r in asset_impacts)
        )
        if candidates and exposure is not None and control_known and complete_impact:
            vulnerability, evidence_id, cve = max(candidates)
            weakness = min(1.0, sum(c.kind == "weakness" for c in item.configuration) / 2)
            criticality = {"essential": 1.0, "important": 0.65, "supporting": 0.3}[
                asset.criticality
            ]
            impact = max(r.disruption_fraction for r in asset_impacts)
            factors = [
                RiskFactor(
                    name="Vulnerability",
                    contribution=round(40 * vulnerability, 4),
                    evidence_ids=[evidence_id, cve],
                    explanation="40 × max confirmed CVE [0.6 × CVSS/10 + 0.4 × (known KEV=1, otherwise ML signal)]. EPSS has no separate weight; it is already a model input.",
                ),
                RiskFactor(
                    name="Exposure",
                    contribution=15 * exposure,
                    evidence_ids=[asset.id],
                    explanation="15 × exposure: external=1, internal=0.4, isolated=0.1; unknown is unavailable.",
                ),
                RiskFactor(
                    name="Configuration",
                    contribution=10 * weakness,
                    evidence_ids=[
                        c.observation.id for c in item.configuration if c.kind == "weakness"
                    ],
                    explanation="10 × min(1, weakness count/2). Exposure and patch-review observations are excluded to avoid double counting.",
                ),
                RiskFactor(
                    name="Criticality",
                    contribution=15 * criticality,
                    evidence_ids=[asset.id],
                    explanation="15 × criticality: essential=1, important=0.65, supporting=0.3; explicit policy weights.",
                ),
                RiskFactor(
                    name="Conditional impact",
                    contribution=20 * impact,
                    evidence_ids=[r.service_id for r in asset_impacts],
                    explanation="20 × maximum service disruption fraction under independent assumed asset unavailability, 1440-minute horizon. Not a probability of compromise.",
                ),
            ]
            score = round(sum(f.contribution for f in factors), 4)
            risk = RiskAssessment(
                **risk.model_dump(
                    exclude={
                        "status",
                        "score",
                        "category",
                        "factors",
                        "unavailable_reason",
                        "scoring_version",
                        "model_version",
                        "calculated_at",
                    }
                ),
                status="computed",
                score=score,
                category=category(score),
                factors=factors,
                unavailable_reason=None,
                scoring_version=SCORING_VERSION,
                model_version=f"{model.model_version}/{model.variant}",
                calculated_at=now,
            )
        results.append(
            AssetPriority(
                asset_id=asset.id,
                name=asset.name,
                sector=asset.sector,
                coverage="partial" if risk.status == "computed" else "unavailable",
                risk=risk,
                signals=signals,
                impacts=asset_impacts,
                assumptions=LIMITS,
            )
        )
    results.sort(key=lambda a: (a.risk.score is None, -(a.risk.score or 0), a.asset_id))
    scores = [r.risk.score for r in results if r.risk.score is not None]
    result = IntelligenceReport(
        scenario_id=scenario_id,
        snapshot_id=inputs.snapshot.snapshot_id,
        id=run_id,
        calculated_at=now,
        reference_dataset_id=dataset.id,
        vulnerability_assessment_id=assessment.id,
        scoring_version=SCORING_VERSION,
        impact_version=ENGINE_VERSION,
        model=model,
        assets=results,
        assessed_count=len(scores),
        unavailable_count=len(results) - len(scores),
        covered_asset_mean=round(sum(scores) / len(scores), 4) if scores else None,
        limitations=LIMITS,
    )
    with connection(path) as db:
        db.execute(
            "INSERT INTO v3_reports VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING",
            (run_id, scenario_id, inputs.snapshot.snapshot_id, result.model_dump_json()),
        )
    return result


def bootstrap(path):
    migrate(path)
    try:
        for scenario in read_documents(path, "scenarios"):
            assess(path, scenario["id"], scenario["current_snapshot_id"])
    except (OSError, ValueError, KeyError, HTTPException) as exc:
        logging.getLogger(__name__).warning("Risk intelligence unavailable: %s", exc)
