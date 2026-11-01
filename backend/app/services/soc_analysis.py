"""Read-only incident-to-planning bridge. Observed events never become model features.

The existing evaluated CVE pipeline supplies the asset priority. Its existing action
engine supplies projections; no infrastructure state or risk baseline is changed here.
"""

from fastapi import HTTPException

from app.schemas.simulation import PlanHandoffRequest, StagedActionRequest, WhatIfRequest
from app.schemas.soc import SocAnalysis, SocAnalysisRequest, SocEvent
from app.services import simulation
from app.services.remediation import bind_baseline


def analyze(store, ctx, history, body: SocAnalysisRequest) -> SocAnalysis:
    bind_baseline(ctx, history, body)
    with store.connection() as db:
        row = db.execute("SELECT * FROM events WHERE id=?", (body.event_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Event is unavailable or outside retained history.")
    event = SocEvent.model_validate(dict(row))
    if not event.asset_id or not event.path.startswith(f"/nodes/{event.asset_id}/"):
        raise HTTPException(422, "Only observed node-service requests support incident planning.")
    if ctx.run.scenario_id != "aurora-city":
        raise HTTPException(
            409, "Confined node services map only to Aurora City's simulated assets."
        )
    asset = next((a for a in ctx.run.assets if a.asset_id == event.asset_id), None)
    if asset is None:
        raise HTTPException(409, "Event asset is absent from the bound simulation.")
    # These are existing scenario actions, not claims of repairing the confined demo service.
    preferred = {"access_control", "network_segmentation", "enhanced_monitoring"}
    if event.category.startswith("traffic."):
        preferred = {"network_segmentation", "enhanced_monitoring"}
    options = [
        o
        for o in simulation.options(ctx)
        if o.asset_id == event.asset_id and o.action_type in preferred
    ]
    actions = [
        StagedActionRequest(asset_id=asset.asset_id, action_type=o.action_type)
        for o in options
        if o.applicable and o.modelled
    ]
    request = (
        WhatIfRequest(
            scenario_id=body.scenario_id,
            snapshot_id=body.snapshot_id,
            run_id=body.run_id,
            baseline_fingerprint=body.baseline_fingerprint,
            actions=actions,
        )
        if actions
        else None
    )
    projection = simulation.what_if(ctx, request) if request else None
    return SocAnalysis(
        **body.model_dump(),
        event=event,
        model_version=ctx.run.model_version,
        model_as_of=ctx.run.as_of,
        asset=asset,
        options=options,
        what_if_request=PlanHandoffRequest(**request.model_dump()) if request else None,
        projection=projection,
        notes=[
            "Actual HTTP evidence is linked by asset ID; it is not a new ML feature or a CVE match.",
            "The existing model ranks CVE exploitation/KEV signals. Asset risk is a relative "
            "scenario index, not a probability of this asset being compromised.",
            "Projected controls affect the simulated infrastructure baseline only. They do not "
            "repair the demo service or execute remediation. Use its protection/IP controls manually.",
            "Cyber adjacency is potential exposure only. Operational consequences require an "
            "explicit conditional failure; a data disclosure does not establish an outage.",
            "No CVE-specific patch is inferred from a generic request or disclosure.",
        ],
    )
