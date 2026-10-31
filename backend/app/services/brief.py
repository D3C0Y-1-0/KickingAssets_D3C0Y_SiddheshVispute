"""Exportable risk brief: a readable summary of the latest simulation and its companions.

Every line is derived from the run, the activity report, the vendor and chokepoint reports and
the optimizer plan. A section whose input is missing says so instead of showing a value.
"""

import html
from datetime import UTC, datetime

from app.engine import risk as risk_engine
from app.schemas.insights import (
    ActivityReport,
    BriefSection,
    ChokepointReport,
    RiskBrief,
    VendorReport,
)
from app.schemas.models import Provenance
from app.schemas.simulation import RemediationPlan, SimulationRun

TOP_ASSETS = 10
TOP_ACTIVITY = 5
TOP_VENDORS = 3
TOP_CHOKEPOINTS = 5
EFFECT = {
    "unavailability": "loss of availability",
    "loss_of_control": "loss of control",
    "data_integrity": "data-integrity compromise",
    "loss_of_visibility": "loss of visibility",
}
LIMITATIONS = [
    "Assets, configuration flags and assumed products are fictional or assumed, not scanned.",
    "Impact assumes no operator recovery and is an upper bound.",
    "Network activity is simulated telemetry with authored events, not observed traffic.",
    "Projected reductions are model estimates; nothing here has been verified on a system.",
]


def _pct(value: float) -> str:
    return f"{round(value * 100)}%"


def _summary(run: SimulationRun) -> BriefSection:
    counts = ", ".join(f"{c.count} {c.category}" for c in run.category_counts)
    city = run.city_risk
    return BriefSection(
        title="Summary",
        available=city.score is not None,
        lines=[
            f"City risk index {city.score:.1f} of 100 ({city.category})."
            if city.score is not None
            else "City risk index unavailable.",
            f"Assets by band: {counts}.",
            f"Reference data as of {run.as_of}; model {run.model_version}; "
            f"scoring {risk_engine.SCORING_VERSION}.",
            "Formula: " + run.formula,
        ],
    )


def _assets(run: SimulationRun) -> BriefSection:
    scored = [a for a in run.assets if a.risk.score is not None]
    scored.sort(key=lambda a: (-(a.risk.score or 0), a.asset_id))
    lines = []
    for a in scored[:TOP_ASSETS]:
        top = a.top_vulnerabilities[0] if a.top_vulnerabilities else None
        why = ""
        if top is not None and top.drivers:
            parts = [
                f"{d.label} ({'+' if d.contribution >= 0 else ''}{d.contribution:.2f})"
                for d in top.drivers[:3]
            ]
            why = f" Why: {top.cve_id} driven by " + "; ".join(parts) + "."
        lines.append(
            f"{a.name} ({a.asset_id}): {a.risk.score:.1f} {a.risk.category}. "
            f"Signal {a.vulnerability_signal:.2f} x exposure {a.exposure_factor:.2f} x impact "
            f"{a.impact_factor:.2f}. Assumed product {a.product.label}; "
            f"{a.known_exploited_count} known-exploited CVE(s) of {a.candidate_count} candidates."
            + why
        )
    unscored = len(run.assets) - len(scored)
    if unscored:
        lines.append(f"{unscored} asset(s) have no computed score and are not ranked.")
    return BriefSection(title="Highest-risk assets", available=bool(scored), lines=lines)


def _services(run: SimulationRun) -> BriefSection:
    lines = []
    for s in sorted(run.services, key=lambda s: (-s.worst_disruption_fraction, s.service_id)):
        cause = (
            f" if {s.initiating_asset_name} suffers {EFFECT.get(s.effect or '', s.effect)}"
            if s.initiating_asset_name
            else ""
        )
        lines.append(f"{s.name}: up to {_pct(s.worst_disruption_fraction)} disrupted{cause}.")
    return BriefSection(title="Services at risk", available=bool(lines), lines=lines)


def _activity(report: ActivityReport | None) -> BriefSection:
    if report is None:
        return BriefSection(
            title="Network activity (simulated)",
            available=False,
            lines=["Activity report unavailable."],
        )
    lines = [
        f"Activity index {report.latest.index:.1f} ({report.latest.band}) on {report.latest.day}; "
        f"{report.latest.anomalous_assets} asset(s) deviate from their baseline.",
    ]
    for a in [x for x in report.assets if x.anomaly > 0][:TOP_ACTIVITY]:
        why = "; ".join(
            f"{r.label}: {r.observed:g} vs baseline {r.baseline:.4g} (z {r.z_score:.1f})"
            for r in a.reasons
        )
        urgency = f" Urgency {a.urgency:.1f}." if a.urgency is not None else ""
        lines.append(f"{a.asset_name} ({a.asset_id}): anomaly {a.anomaly:.2f}. {why}.{urgency}")
    lines.append("Telemetry is simulated; a flag is a deviation, not proof of an attack.")
    return BriefSection(title="Network activity (simulated)", available=True, lines=lines)


def _vendors(report: VendorReport | None) -> BriefSection:
    if report is None:
        return BriefSection(title="Supply-chain exposure", available=False, lines=["Unavailable."])
    lines = []
    for v in report.vendors[:TOP_VENDORS]:
        worst = "unavailable" if v.worst_disruption is None else _pct(v.worst_disruption)
        lines.append(
            f"{v.vendor}: {len(v.assets)} asset(s); if its update channel were compromised, up to "
            f"{worst} of a service is disrupted and {v.assets_lost} assets are lost. "
            f"CISA KEV entries: {v.kev_entries_total} total, {v.kev_entries_last_24_months} in "
            "the last 24 months."
        )
    lines.append("Assumed what-if, not a prediction; vendors are assumed products.")
    return BriefSection(title="Supply-chain exposure", available=True, lines=lines)


def _chokepoints(report: ChokepointReport | None) -> BriefSection:
    if report is None:
        return BriefSection(title="Chokepoints", available=False, lines=["Unavailable."])
    rows = [c for c in report.chokepoints if c.is_chokepoint][:TOP_CHOKEPOINTS]
    lines = [f"{c.asset_name} ({c.asset_id}): {c.reason}" for c in rows]
    if not rows:
        lines.append("No single asset fully disrupts a service on its own.")
    return BriefSection(title="Chokepoints", available=True, lines=lines)


def _actions(plan: RemediationPlan | None) -> BriefSection:
    if plan is None:
        return BriefSection(title="Recommended actions", available=False, lines=["Unavailable."])
    lines = [
        f"Projected, not verified. {plan.effort_budget_hours:g} h budget: city index "
        f"{plan.starting_city_index:.1f} to {plan.ending_city_index:.1f} using {plan.used_hours:g} h."
    ]
    for s in plan.steps:
        lines.append(
            f"{s.rank}. {s.name} on {s.asset_name} ({s.asset_id}): -{s.marginal_reduction:.2f} "
            f"city index, {s.effort_hours:g} h. {s.operational_disruption}"
        )
    if plan.recommendation_only:
        kinds = sorted({o.name for o in plan.recommendation_only})
        lines.append("Recommendations without a modelled reduction: " + ", ".join(kinds) + ".")
    return BriefSection(title="Recommended actions", available=True, lines=lines)


def build_brief(
    run: SimulationRun,
    activity: ActivityReport | None,
    vendors: VendorReport | None,
    chokepoints: ChokepointReport | None,
    plan: RemediationPlan | None,
) -> RiskBrief:
    now = datetime.now(UTC)
    sections = [
        _summary(run),
        _assets(run),
        _services(run),
        _activity(activity),
        _vendors(vendors),
        _chokepoints(chokepoints),
        _actions(plan),
        BriefSection(
            title="Assumptions and limitations",
            available=True,
            lines=list(dict.fromkeys([*run.assumptions, *LIMITATIONS])),
        ),
    ]
    return RiskBrief(
        scenario_id=run.scenario_id,
        snapshot_id=run.snapshot_id,
        run_id=run.id,
        as_of=run.as_of,
        model_version=run.model_version,
        scoring_version=risk_engine.SCORING_VERSION,
        generated_at=now,
        sections=sections,
        provenance=Provenance(
            kind="model",
            source=f"GridSentinel brief over {run.id}",
            recorded_at=now,
            notes="Compiled from the latest simulation and companion reports; simulated and assumed inputs are labelled.",
        ),
    )


def to_markdown(brief: RiskBrief) -> str:
    out = [
        "# GridSentinel risk brief",
        "",
        f"Scenario {brief.scenario_id} · snapshot {brief.snapshot_id} · run {brief.run_id} · "
        f"as of {brief.as_of} · generated {brief.generated_at:%Y-%m-%d %H:%M} UTC",
        "",
        "> Fictional infrastructure. Relative risk index, not an incident probability.",
    ]
    for section in brief.sections:
        out += ["", f"## {section.title}", ""]
        out += [f"- {line}" for line in section.lines]
    return "\n".join(out) + "\n"


def to_html(brief: RiskBrief) -> str:
    body = "".join(
        f"<section><h2>{html.escape(s.title)}</h2><ul>"
        + "".join(f"<li>{html.escape(line)}</li>" for line in s.lines)
        + "</ul></section>"
        for s in brief.sections
    )
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        "<title>GridSentinel risk brief</title><style>"
        "body{font:15px/1.5 system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;"
        "color:#111}h1{font-size:1.6rem}h2{font-size:1.05rem;border-bottom:1px solid #ccc;"
        "padding-bottom:.2rem;margin-top:1.6rem}li{margin:.3rem 0}.meta{color:#555}"
        "</style></head><body><h1>GridSentinel risk brief</h1>"
        f'<p class="meta">Scenario {html.escape(brief.scenario_id)} · snapshot '
        f"{html.escape(brief.snapshot_id)} · run {html.escape(brief.run_id)} · as of {brief.as_of} · "
        f"generated {brief.generated_at:%Y-%m-%d %H:%M} UTC</p>"
        "<p><strong>Fictional infrastructure. Relative risk index, not an incident "
        f"probability.</strong></p>{body}</body></html>"
    )
