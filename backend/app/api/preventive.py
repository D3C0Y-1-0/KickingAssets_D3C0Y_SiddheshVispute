"""Additive Phase 7 endpoints; every call binds before and after computation."""

from fastapi import APIRouter, Request

from app.api.workflow import _history, _latest
from app.engine.impact.policy import ImpactInputError
from app.schemas.models import ErrorEnvelope
from app.schemas.preventive import (
    Binding,
    Catalog,
    Evaluation,
    EvaluationRequest,
    Optimization,
    OptimizationRequest,
    StressReport,
    StressRequest,
)
from app.services import preventive
from app.services.remediation import bind_baseline
from ml import inference

router = APIRouter(
    prefix="/api/v1/resilience/preventive",
    tags=["Preventive resilience"],
    responses={status: {"model": ErrorEnvelope} for status in (404, 409, 422, 503)},
)


def _execute(request, body, operation):
    ctx = _latest(request)
    bind_baseline(ctx, _history(request), body)
    try:
        result = operation(ctx)
    except ImpactInputError as exc:
        preventive.fail("resilience_unavailable", str(exc), "scenario", status=503)
    except inference.ReferenceUnavailable as exc:
        preventive.fail("reference_unavailable", str(exc), "baseline", status=503)
    latest = _latest(request)
    bind_baseline(latest, _history(request), body)
    if latest is not ctx:
        preventive.fail(
            "stale_baseline", "Simulation was replaced during calculation.", "run_id", status=409
        )
    return result


@router.post("/catalog", response_model=Catalog)
def catalog(body: Binding, request: Request):
    return _execute(request, body, preventive.catalog)


@router.post("/simulate", response_model=Evaluation)
def simulate(body: EvaluationRequest, request: Request):
    return _execute(request, body, lambda ctx: preventive.evaluate(ctx, body))


@router.post("/optimize", response_model=Optimization)
def optimize(body: OptimizationRequest, request: Request):
    return _execute(request, body, lambda ctx: preventive.optimize(ctx, body))


@router.post("/stress-test", response_model=StressReport)
def stress_test(body: StressRequest, request: Request):
    return _execute(request, body, lambda ctx: preventive.stress_test(ctx, body))
