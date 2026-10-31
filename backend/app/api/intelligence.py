from fastapi import APIRouter, Request

from app.domain.seed import SCENARIO_ID
from app.schemas.intelligence import IntelligenceReport, ModelEvidence
from app.schemas.models import Context
from app.services import intelligence, model_signal

router = APIRouter(prefix="/api/v1/intelligence", tags=["Risk intelligence"])


@router.get("", response_model=IntelligenceReport)
def report(request: Request, scenario_id: str = SCENARIO_ID, snapshot_id: str | None = None):
    return intelligence.get_report(request.app.state.db_path, scenario_id, snapshot_id)


@router.post("/assess", response_model=IntelligenceReport)
def assess(body: Context, request: Request):
    return intelligence.assess(request.app.state.db_path, body.scenario_id, body.snapshot_id)


@router.get("/model", response_model=ModelEvidence)
def model():
    return model_signal.evidence()
