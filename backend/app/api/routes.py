from typing import Literal

from fastapi import APIRouter, HTTPException, Request

from app.db.store import connection, read_documents
from app.db.vulnerability_store import report
from app.domain.seed import SCENARIO_ID
from app.schemas.models import (
    AssessmentRequest,
    AssessmentSnapshot,
    AssetDetail,
    CyberGraph,
    ErrorEnvelope,
    EssentialService,
    Health,
    InfrastructureAsset,
    OperationalGraph,
    RemediationPlan,
    RemediationRequest,
    RiskAssessment,
    Scenario,
    WhatIfRequest,
    WhatIfResult,
)
from app.services.intelligence import get_report
from app.services.inventory import Inventory

router = APIRouter(
    prefix="/api/v1",
    responses={
        404: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    },
)


def inventory(request: Request) -> Inventory:
    return Inventory(request.app.state.db_path)


@router.get("/health", response_model=Health, tags=["Foundation"])
def health(request: Request):
    try:
        with connection(request.app.state.db_path) as db:
            row = db.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()
            if not row:
                raise RuntimeError("Schema not initialized")
        return Health(status="ok", database="ready", application_version="0.1.0")
    except Exception as exc:
        raise HTTPException(503, "Database unavailable") from exc


@router.get("/scenarios", response_model=list[Scenario], tags=["Inventory"])
def scenarios(request: Request):
    return read_documents(request.app.state.db_path, "scenarios")


@router.get("/snapshots", response_model=list[AssessmentSnapshot], tags=["Inventory"])
def snapshots(request: Request, scenario_id: str = SCENARIO_ID):
    inv = inventory(request)
    inv.context(scenario_id)
    return read_documents(inv.path, "snapshots", scenario_id)


@router.get("/assets", response_model=list[InfrastructureAsset], tags=["Inventory"])
def assets(
    request: Request,
    scenario_id: str = SCENARIO_ID,
    snapshot_id: str | None = None,
    sector: Literal["power", "water", "healthcare"] | None = None,
    asset_type: Literal["gateway", "controller", "workstation", "server", "sensor", "backup"]
    | None = None,
    q: str | None = None,
):
    inv = inventory(request)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    rows = inv.collection("assets", scenario_id, snapshot_id)
    return [
        a
        for a in rows
        if (sector is None or a["sector"] == sector)
        and (asset_type is None or a["asset_type"] == asset_type)
        and (not q or q.casefold() in " ".join([a["name"], a["id"], a["product"]]).casefold())
    ]


@router.get("/assets/{asset_id}", response_model=AssetDetail, tags=["Inventory"])
def asset_detail(
    asset_id: str, request: Request, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None
):
    inv = inventory(request)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    asset = next(
        (a for a in inv.collection("assets", scenario_id, snapshot_id) if a["id"] == asset_id), None
    )
    if asset is None:
        raise HTTPException(404, "Asset not found in this snapshot")
    risk = RiskAssessment(
        scenario_id=scenario_id,
        snapshot_id=snapshot_id,
        asset_id=asset_id,
        state="current",
        provenance=asset["provenance"],
    )
    try:
        priority = get_report(inv.path, scenario_id, snapshot_id)
        risk = next(item.risk for item in priority.assets if item.asset_id == asset_id)
    except (HTTPException, OSError, ValueError):
        risk.unavailable_reason = (
            "Current risk intelligence is unavailable; inspect the intelligence endpoint"
        )
    evidence = None
    try:
        assessment = report(inv.path, scenario_id, snapshot_id)
        if not assessment.stale:
            evidence = next((item for item in assessment.assets if item.asset_id == asset_id), None)
    except HTTPException as exc:
        if exc.status_code not in {404, 503}:
            raise
    return AssetDetail(
        asset=asset,
        vulnerabilities=[f.link for f in evidence.applicability] if evidence else [],
        observations=[f.observation for f in evidence.configuration] if evidence else [],
        risk=risk,
    )


@router.get("/graph", response_model=CyberGraph | OperationalGraph, tags=["Graphs"])
def graph(
    request: Request,
    type: Literal["cyber", "operational"],
    scenario_id: str = SCENARIO_ID,
    snapshot_id: str | None = None,
):
    inv = inventory(request)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    return {
        "type": type,
        "scenario_id": scenario_id,
        "snapshot_id": snapshot_id,
        "nodes": inv.collection("assets", scenario_id, snapshot_id),
        "edges": inv.collection(
            "cyber_edges" if type == "cyber" else "operational_edges", scenario_id, snapshot_id
        ),
    }


@router.get("/services", response_model=list[EssentialService], tags=["Inventory"])
def services(request: Request, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None):
    inv = inventory(request)
    scenario_id, snapshot_id = inv.context(scenario_id, snapshot_id)
    return inv.collection("services", scenario_id, snapshot_id)


@router.post(
    "/assessments",
    response_model=RiskAssessment,
    responses={501: {"model": ErrorEnvelope}},
    tags=["Future engines"],
)
def assess(body: AssessmentRequest):
    raise HTTPException(501, "Risk assessment engine is not implemented in Phase 1")


@router.post(
    "/what-if",
    response_model=WhatIfResult,
    responses={501: {"model": ErrorEnvelope}},
    tags=["Future engines"],
)
def what_if(body: WhatIfRequest):
    raise HTTPException(501, "What-if recalculation engine is not implemented in Phase 1")


@router.post(
    "/remediation/optimize",
    response_model=RemediationPlan,
    responses={501: {"model": ErrorEnvelope}},
    tags=["Future engines"],
)
def optimize(body: RemediationRequest):
    raise HTTPException(501, "Remediation optimizer is not implemented in Phase 1")
