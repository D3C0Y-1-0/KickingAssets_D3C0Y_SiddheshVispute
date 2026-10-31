"""Attacker view, prevention (cheapest cut) and reaction (containment) for the latest run."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.defense import AttackerView, CutPlan, ReactionPlan
from app.schemas.models import ErrorEnvelope
from app.services import defense

router = APIRouter(
    prefix="/api/v1/defense",
    tags=["Defense"],
    responses={404: {"model": ErrorEnvelope}, 409: {"model": ErrorEnvelope}},
)


def _latest(request: Request):
    ctx = getattr(request.app.state, "simulation", None)
    if ctx is None or ctx.run is None:
        raise HTTPException(409, "No simulation has been run yet. Run the simulation first.")
    return ctx


@router.get("/attacker", response_model=AttackerView)
def attacker(request: Request):
    """The best plausible route to each critical asset, and what it does to services step by step."""
    return defense.attacker_view(_latest(request))


@router.get("/prevention", response_model=CutPlan)
def prevention(request: Request):
    """The cheapest set of assets to segment so no plausible route reaches a critical asset."""
    return defense.prevention(_latest(request))


@router.get("/reaction", response_model=ReactionPlan)
def reaction(request: Request, asset: Annotated[str, Query(min_length=1)]):
    """If this asset were taken over: where it could spread, and how to contain it."""
    try:
        return defense.reaction(_latest(request), asset)
    except KeyError as exc:
        raise HTTPException(404, f"Unknown asset {asset}") from exc
