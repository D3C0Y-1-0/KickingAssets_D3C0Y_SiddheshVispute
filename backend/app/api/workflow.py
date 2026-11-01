"""Workflow endpoints: ML section, simulation, and the action stage."""

import logging
import threading
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request

from app.domain.seed import SCENARIO_ID
from app.engine.attack_path import (
    AnalysisConfig,
    AttackPathEngine,
    AttackPathInputError,
    Controls,
)
from app.engine.attack_path.adapter import consequence_lookup, evidence_from_run, from_bundle
from app.schemas.attack_paths import AttackPathReport
from app.schemas.models import ErrorEnvelope, Id
from app.schemas.simulation import (
    ActionDefinition,
    ActionOption,
    BaselineBinding,
    CveScore,
    MlOverview,
    MlStatus,
    OptimizeRequest,
    PooledBacktest,
    ProductMap,
    RemediationPlan,
    SimulationProgress,
    SimulationRun,
    SnapshotOption,
    WhatIfRequest,
    WhatIfResult,
)
from app.services import backtest, ml_overview, simulation
from app.services.inventory import Inventory
from app.services.remediation import bind_baseline
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
RUN_HISTORY_LIMIT = 100


log = logging.getLogger(__name__)


def warm_start(application) -> None:
    """Re-run the default simulation in the background, so a restarted server heals itself
    instead of leaving every result page empty until someone presses Run."""

    def work() -> None:
        try:
            inv = Inventory(application.state.db_path)
            scenario_id, snapshot_id = inv.context(SCENARIO_ID, None)
            with _run_lock:
                if getattr(application.state, "simulation", None) is not None:
                    return
                application.state.simulation = simulation.run_simulation(
                    application.state.db_path, scenario_id, snapshot_id, None
                )
        except Exception:  # never take the server down for a warm-up
            log.exception("Warm start failed")

    threading.Thread(target=work, name="warm-start", daemon=True).start()


def _latest(request: Request) -> simulation.RunContext:
    ctx = getattr(request.app.state, "simulation", None)
    if ctx is None:
        raise HTTPException(409, "No simulation has been run yet. Run the simulation first.")
    return ctx


def _history(request: Request) -> dict[str, str]:
    """Run id -> fingerprint of every run made in this session (bounded)."""
    if not hasattr(request.app.state, "run_history"):
        request.app.state.run_history = {}
    return request.app.state.run_history


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


@router.get("/simulation/snapshots", response_model=list[SnapshotOption], tags=["Simulation"])
def snapshots():
    """Dates the simulation can be run as of, with whether the model saw that period."""
    try:
        dates = inference.available_snapshots()
        closed = inference.load_reference().kev_released
    except inference.ReferenceUnavailable as exc:
        raise HTTPException(503, f"ML reference data unavailable: {exc}") from exc
    return [
        SnapshotOption(
            as_of=d,
            split=inference.split_label(d),
            held_out=inference.is_held_out(d),
            outcome_window_closed=(closed - d).days >= inference.OUTCOME_HORIZON_DAYS,
        )
        for d in reversed(dates)
    ]


@router.get("/simulation/products", response_model=ProductMap, tags=["Simulation"])
def products():
    """The real product and version each fictional asset is assumed to run."""
    return simulation.product_map()


@router.get("/simulation/backtest", response_model=PooledBacktest, tags=["Simulation"])
def pooled_backtest():
    try:
        return backtest.pooled_backtest()
    except inference.ReferenceUnavailable as exc:
        raise HTTPException(503, f"ML reference data unavailable: {exc}") from exc


@router.post("/simulation/run", response_model=SimulationRun, tags=["Simulation"])
def run(
    request: Request,
    scenario_id: str = SCENARIO_ID,
    snapshot_id: str | None = None,
    as_of: date | None = None,
):
    inv = Inventory(request.app.state.db_path)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    with _run_lock:
        try:
            ctx = simulation.run_simulation(
                request.app.state.db_path, scenario_id, snapshot_id, as_of
            )
        except inference.ReferenceUnavailable as exc:
            raise HTTPException(503, f"ML reference data unavailable: {exc}") from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        request.app.state.simulation = ctx
        history = _history(request)
        history[ctx.run.id] = ctx.run.fingerprint
        while len(history) > RUN_HISTORY_LIMIT:
            history.pop(next(iter(history)))
    return ctx.run


@router.get("/simulation/progress", response_model=SimulationProgress, tags=["Simulation"])
def progress():
    return simulation.PROGRESS.snapshot()


@router.get("/simulation/latest", response_model=SimulationRun, tags=["Simulation"])
def latest(request: Request):
    return _latest(request).run


@router.get("/simulation/attack-paths", response_model=AttackPathReport, tags=["Simulation"])
def attack_paths(
    request: Request,
    isolate: Annotated[
        list[str] | None, Query(description="Assets treated as segmented away")
    ] = None,
    max_paths_per_target: Annotated[int, Query(ge=1, le=50)] = 5,
    run_id: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
    baseline_fingerprint: Annotated[str | None, Query(min_length=8, max_length=64)] = None,
    scenario_id: Id | None = None,
    snapshot_id: Id | None = None,
):
    """Plausible cyber routes from exposed entry points to critical assets, using the latest
    simulation's vulnerability evidence. Reachability is not compromise."""
    ctx = _latest(request)
    if any(value is not None for value in (run_id, baseline_fingerprint, scenario_id, snapshot_id)):
        if run_id is None:
            raise HTTPException(422, "run_id is required when binding attack-path context.")
        bind_baseline(
            ctx,
            _history(request),
            BaselineBinding(
                scenario_id=scenario_id or ctx.run.scenario_id,
                snapshot_id=snapshot_id or ctx.run.snapshot_id,
                run_id=run_id,
                baseline_fingerprint=baseline_fingerprint,
            ),
        )
    unknown = sorted(set(isolate or ()) - {asset.id for asset in ctx.bundle.assets})
    if unknown:
        raise HTTPException(422, "Unknown isolated assets: " + ", ".join(unknown))
    try:
        analysis = AttackPathEngine(consequence_lookup(ctx.bundle)).analyze(
            from_bundle(
                ctx.bundle,
                evidence_from_run(ctx.run),
                Controls(isolated_assets=frozenset(isolate or [])),
            ),
            AnalysisConfig(max_paths_per_target=max_paths_per_target),
        )
        return AttackPathReport(
            **analysis.model_dump(),
            scenario_id=ctx.run.scenario_id,
            snapshot_id=ctx.run.snapshot_id,
            run_id=ctx.run.id,
            baseline_fingerprint=ctx.run.fingerprint,
            state="projected" if isolate else "current",
            isolated_assets=tuple(sorted(set(isolate or ()))),
        )
    except AttackPathInputError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get("/actions/catalog", response_model=list[ActionDefinition], tags=["Actions"])
def catalog():
    return list(simulation.ACTIONS.values())


@router.get("/actions/options", response_model=list[ActionOption], tags=["Actions"])
def options(
    request: Request,
    run_id: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=120,
            description="If given, must be the current run; otherwise 409/404",
        ),
    ] = None,
):
    ctx = _latest(request)
    if run_id is not None:
        bind_baseline(
            ctx,
            _history(request),
            BaselineBinding(
                scenario_id=ctx.bundle.scenario.id,
                snapshot_id=ctx.bundle.snapshot.snapshot_id,
                run_id=run_id,
            ),
        )
    return simulation.options(ctx)


@router.post("/actions/what-if", response_model=WhatIfResult, tags=["Actions"])
def what_if(body: WhatIfRequest, request: Request):
    ctx = _latest(request)
    bind_baseline(ctx, _history(request), body)
    return simulation.what_if(ctx, body)


@router.post("/actions/optimize", response_model=RemediationPlan, tags=["Actions"])
def optimize(body: OptimizeRequest, request: Request):
    ctx = _latest(request)
    bind_baseline(ctx, _history(request), body)
    return simulation.optimize(ctx, body)
