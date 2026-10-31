"""Read-only endpoints for activity, resilience, posture trend and the risk brief."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, PlainTextResponse

from app.domain.seed import SCENARIO_ID
from app.schemas.insights import (
    ActivityReport,
    AssetActivitySeries,
    ChokepointReport,
    PostureTrend,
    RiskBrief,
    VendorReport,
)
from app.schemas.models import ErrorEnvelope, ScenarioBundle
from app.schemas.simulation import OptimizeRequest
from app.services import brief as brief_service
from app.services import insights, simulation
from app.services.inventory import Inventory

BRIEF_BUDGET_HOURS = 40.0

router = APIRouter(
    prefix="/api/v1",
    responses={
        404: {"model": ErrorEnvelope},
        409: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
)


def _bundle(request: Request, scenario_id: str, snapshot_id: str | None) -> ScenarioBundle:
    inv = Inventory(request.app.state.db_path)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    return simulation.load_bundle(inv.path, scenario_id, snapshot_id)


def _latest(request: Request, bundle: ScenarioBundle):
    ctx = getattr(request.app.state, "simulation", None)
    if ctx is None or ctx.run is None:
        return None
    if (ctx.bundle.scenario.id, ctx.bundle.snapshot.snapshot_id) != (
        bundle.scenario.id,
        bundle.snapshot.snapshot_id,
    ):
        return None
    return ctx


def _scores(ctx) -> dict[str, float | None] | None:
    return None if ctx is None else {a.asset_id: a.risk.score for a in ctx.run.assets}


def _activity(request: Request, bundle: ScenarioBundle, as_of: date | None, ctx):
    try:
        return insights.activity_report(bundle, as_of, _scores(ctx))
    except insights.InsightInputError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/activity", response_model=ActivityReport, tags=["Activity"])
def activity(
    request: Request,
    scenario_id: str = SCENARIO_ID,
    snapshot_id: str | None = None,
    as_of: date | None = None,
):
    bundle = _bundle(request, scenario_id, snapshot_id)
    return _activity(request, bundle, as_of, _latest(request, bundle))


@router.get("/activity/assets/{asset_id}", response_model=AssetActivitySeries, tags=["Activity"])
def asset_activity(
    asset_id: str,
    request: Request,
    scenario_id: str = SCENARIO_ID,
    snapshot_id: str | None = None,
    as_of: date | None = None,
):
    bundle = _bundle(request, scenario_id, snapshot_id)
    try:
        return insights.asset_activity_series(bundle, asset_id, as_of)
    except insights.InsightInputError as exc:
        status = 404 if str(exc).startswith("Unknown asset") else 422
        raise HTTPException(status, str(exc)) from exc


@router.get("/resilience/vendors", response_model=VendorReport, tags=["Resilience"])
def vendors(request: Request, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None):
    return insights.vendor_report(_bundle(request, scenario_id, snapshot_id))


@router.get("/resilience/chokepoints", response_model=ChokepointReport, tags=["Resilience"])
def chokepoints(request: Request, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None):
    return insights.chokepoint_report(_bundle(request, scenario_id, snapshot_id))


@router.get("/simulation/trend", response_model=PostureTrend, tags=["Simulation"])
def trend(request: Request, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None):
    inv = Inventory(request.app.state.db_path)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    return insights.posture_trend(scenario_id, snapshot_id)


def _brief(request: Request, scenario_id: str, snapshot_id: str | None) -> RiskBrief:
    bundle = _bundle(request, scenario_id, snapshot_id)
    ctx = _latest(request, bundle)
    if ctx is None:
        raise HTTPException(409, "No simulation has been run yet. Run the simulation first.")
    plan = simulation.optimize(
        ctx,
        OptimizeRequest(
            scenario_id=bundle.scenario.id,
            snapshot_id=bundle.snapshot.snapshot_id,
            run_id=ctx.run.id,
            effort_budget_hours=BRIEF_BUDGET_HOURS,
        ),
    )
    return brief_service.build_brief(
        ctx.run,
        _activity(request, bundle, None, ctx),
        insights.vendor_report(bundle),
        insights.chokepoint_report(bundle),
        plan,
    )


@router.get(
    "/reports/brief",
    response_model=RiskBrief,
    responses={200: {"content": {"text/markdown": {}, "text/html": {}}}},
    tags=["Reports"],
)
def risk_brief(
    request: Request,
    scenario_id: str = SCENARIO_ID,
    snapshot_id: str | None = None,
    format: Literal["json", "md", "html"] = "json",
):
    brief = _brief(request, scenario_id, snapshot_id)
    if format == "md":
        return PlainTextResponse(
            brief_service.to_markdown(brief),
            media_type="text/markdown",
            headers={"Content-Disposition": 'attachment; filename="gridsentinel-risk-brief.md"'},
        )
    if format == "html":
        return HTMLResponse(
            brief_service.to_html(brief),
            headers={"Content-Disposition": 'attachment; filename="gridsentinel-risk-brief.html"'},
        )
    return brief
