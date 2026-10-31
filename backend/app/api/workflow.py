"""Workflow endpoints: ML section, simulation, and the action stage."""

import threading

from fastapi import APIRouter, HTTPException, Request

from app.domain.seed import SCENARIO_ID
from app.schemas.models import ErrorEnvelope
from app.schemas.simulation import (
    ActionDefinition,
    ActionOption,
    CveScore,
    MlOverview,
    MlStatus,
    OptimizeRequest,
    RemediationPlan,
    SimulationRun,
    WhatIfRequest,
    WhatIfResult,
)
from app.services import ml_overview, simulation
from app.services.inventory import Inventory
from ml import inference

router = APIRouter(
    prefix="/api/v1",
    responses={
        404: {"model": ErrorEnvelope},
        409: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
)
_run_lock = threading.Lock()


def _latest(request: Request) -> simulation.RunContext:
    ctx = getattr(request.app.state, "simulation", None)
    if ctx is None:
        raise HTTPException(409, "No simulation has been run yet. Run the simulation first.")
    return ctx


def _check_context(ctx: simulation.RunContext, scenario_id: str, snapshot_id: str) -> None:
    if (scenario_id, snapshot_id) != (ctx.bundle.scenario.id, ctx.bundle.snapshot.snapshot_id):
        raise HTTPException(409, "The latest simulation was run for a different snapshot.")


@router.get("/ml/status", response_model=MlStatus, tags=["ML"])
def ml_status():
    state = inference.status()
    return MlStatus(ready=state["ready"], missing=state["missing"])


@router.get("/ml/overview", response_model=MlOverview, tags=["ML"])
def ml_overview_endpoint():
    return ml_overview.overview()


@router.get("/ml/score", response_model=CveScore, tags=["ML"])
def ml_score(cve_id: str):
    try:
        result = inference.score_cve(cve_id.strip().upper())
    except inference.ReferenceUnavailable as exc:
        raise HTTPException(503, f"ML reference data unavailable: {exc}") from exc
    if result is None:
        raise HTTPException(404, "CVE not found in the local NVD data")
    return result


@router.post("/simulation/run", response_model=SimulationRun, tags=["Simulation"])
def run(request: Request, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None):
    inv = Inventory(request.app.state.db_path)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    with _run_lock:
        try:
            ctx = simulation.run_simulation(request.app.state.db_path, scenario_id, snapshot_id)
        except inference.ReferenceUnavailable as exc:
            raise HTTPException(503, f"ML reference data unavailable: {exc}") from exc
        request.app.state.simulation = ctx
    return ctx.run


@router.get("/simulation/latest", response_model=SimulationRun, tags=["Simulation"])
def latest(request: Request):
    return _latest(request).run


@router.get("/actions/catalog", response_model=list[ActionDefinition], tags=["Actions"])
def catalog():
    return list(simulation.ACTIONS.values())


@router.get("/actions/options", response_model=list[ActionOption], tags=["Actions"])
def options(request: Request):
    return simulation.options(_latest(request))


@router.post("/actions/what-if", response_model=WhatIfResult, tags=["Actions"])
def what_if(body: WhatIfRequest, request: Request):
    ctx = _latest(request)
    _check_context(ctx, body.scenario_id, body.snapshot_id)
    try:
        return simulation.what_if(ctx, body)
    except KeyError as exc:
        raise HTTPException(404, str(exc.args[0])) from exc


@router.post("/actions/optimize", response_model=RemediationPlan, tags=["Actions"])
def optimize(body: OptimizeRequest, request: Request):
    ctx = _latest(request)
    _check_context(ctx, body.scenario_id, body.snapshot_id)
    return simulation.optimize(ctx, body)
