import asyncio
import ipaddress
import json
import os
import time

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from app.schemas.soc import (
    SocAnalysis,
    SocAnalysisRequest,
    SocBlockRequest,
    SocEvent,
    SocProtectionRequest,
    SocSession,
    SocSnapshot,
    SocUnblockRequest,
)
from app.services.soc import NODE_IDS, canonical_ip, peer, require_operator

router = APIRouter(prefix="/api/v1/soc", tags=["Live SOC"])


@router.post("/analyze", response_model=SocAnalysis)
def analyze(body: SocAnalysisRequest, request: Request):
    from app.api.workflow import _history, _latest
    from app.services.soc_analysis import analyze as analyze_event

    store = require_operator(request)
    ctx = _latest(request)
    result = analyze_event(store, ctx, _history(request), body)
    # Reject a run replaced during calculation rather than returning a mismatched result.
    from app.services.remediation import bind_baseline

    bind_baseline(_latest(request), _history(request), body)
    return result


@router.post("/session", response_model=SocSession)
def session(request: Request, response: Response):
    ip = peer(request)
    origin = request.headers.get("origin")
    if not ipaddress.ip_address(ip).is_loopback or (
        origin and origin != str(request.base_url).rstrip("/")
    ):
        raise HTTPException(
            403, "Operator sessions can only be opened locally on the server computer."
        )
    store = request.app.state.soc
    token = store.session(ip)
    response.set_cookie(
        "gridinal_operator",
        token,
        httponly=True,
        samesite="strict",
        max_age=28800,
        path="/api/v1/soc",
        secure=request.url.scheme == "https",
    )
    store.emit(
        ip,
        "operator.session",
        outcome="authenticated",
        method="POST",
        explanation="Local operator session opened; not an attacker identity.",
    )
    return {"operator": True}


@router.delete("/session", response_model=SocSession)
def logout(request: Request, response: Response):
    store = require_operator(request)
    import hashlib

    with store.connection() as db:
        db.execute(
            "DELETE FROM sessions WHERE digest=?",
            (hashlib.sha256(request.cookies.get("gridinal_operator", "").encode()).hexdigest(),),
        )
    response.delete_cookie("gridinal_operator", path="/api/v1/soc")
    return {"operator": False}


@router.get("/snapshot", response_model=SocSnapshot)
def snapshot(request: Request):
    store = require_operator(request)
    floor, cursor, count = store.bounds()
    port = int(os.environ.get("GRIDSENTINEL_SOC_TARGET_PORT", "8006"))
    ready = False
    if os.environ.get("GRIDSENTINEL_SOC_TARGET_PORT"):
        try:
            r = httpx.get(f"http://127.0.0.1:{port}/health", timeout=0.5, trust_env=False)
            ready = (
                r.status_code == 200
                and r.json().get("scope") == "confined synthetic-data node services"
            )
        except (httpx.HTTPError, ValueError):
            pass
    return dict(
        gateway_port=port,
        gateway_ready=ready,
        events=store.page(),
        nodes=store.nodes(),
        blocks=store.blocks(),
        cursor=cursor,
        retained_events=count,
        retention_floor=floor,
        operator=True,
    )


@router.get("/logs", response_model=list[SocEvent])
def logs(
    request: Request, before: int = Query(ge=1), limit: int = Query(default=100, ge=1, le=200)
):
    return require_operator(request).history(before, limit)


@router.post("/blocks", response_model=SocSnapshot)
def block(body: SocBlockRequest, request: Request):
    store = require_operator(request)
    ip = canonical_ip(body.ip)
    if ipaddress.ip_address(ip).is_loopback or ip == peer(request):
        raise HTTPException(
            409, "Loopback and the active operator address are protected from lockout."
        )
    with store.connection() as db:
        active_operator = db.execute(
            "SELECT 1 FROM sessions WHERE ip=? AND expires_at>?", (ip, time.time())
        ).fetchone()
        if active_operator:
            raise HTTPException(409, "An active operator address cannot be blocked.")
        db.execute(
            "INSERT OR REPLACE INTO blocks VALUES (?,?,?)",
            (ip, body.reason, time.time() + body.minutes * 60),
        )
    store.emit(
        peer(request),
        "operator.block",
        outcome="applied",
        method="POST",
        explanation=f"Blocked {ip} for {body.minutes} minutes: {body.reason}",
    )
    return snapshot(request)


@router.post("/unblock", response_model=SocSnapshot)
def unblock(body: SocUnblockRequest, request: Request):
    store = require_operator(request)
    ip = canonical_ip(body.ip)
    with store.connection() as db:
        db.execute("DELETE FROM blocks WHERE ip=?", (ip,))
    store.emit(
        peer(request),
        "operator.unblock",
        outcome="applied",
        method="POST",
        explanation=f"Unblocked {ip}",
    )
    return snapshot(request)


@router.post("/nodes/{asset}/protection", response_model=SocSnapshot)
def protection(asset: str, body: SocProtectionRequest, request: Request):
    store = require_operator(request)
    if asset not in NODE_IDS:
        raise HTTPException(404, "Unknown node")
    with store.connection() as db:
        db.execute("UPDATE profiles SET protected=? WHERE asset_id=?", (int(body.protected), asset))
    store.emit(
        peer(request),
        "operator.protection",
        outcome="applied",
        asset=asset,
        method="POST",
        explanation=f"Protection {'enabled' if body.protected else 'disabled'} for confined project target. Infrastructure unchanged.",
    )
    return snapshot(request)


@router.get("/events")
async def events(request: Request, after: int = Query(default=0, ge=0)):
    store = require_operator(request)
    try:
        cursor = max(after, int(request.headers.get("last-event-id", "0")))
    except ValueError as exc:
        raise HTTPException(422, "Invalid event cursor") from exc
    floor, latest, _ = store.bounds()
    if cursor > latest:
        raise HTTPException(409, "Event cursor is ahead of this store; reload snapshot.")

    async def stream():
        nonlocal cursor
        heartbeat = time.monotonic()
        while not await request.is_disconnected():
            if not await asyncio.to_thread(store.operator, request):
                yield "event: expired\ndata: {}\n\n"
                return
            floor, _, _ = await asyncio.to_thread(store.bounds)
            if cursor and cursor < floor - 1:
                yield "event: gap\ndata: {}\n\n"
                return
            rows = await asyncio.to_thread(store.page, cursor, 100) if cursor else []
            # An empty database cursor still needs to receive its first event.
            if not cursor:
                rows = await asyncio.to_thread(store.page, 0, 100)
            for event in rows:
                cursor = event["id"]
                yield f"id: {cursor}\ndata: {json.dumps(event)}\n\n"
            if time.monotonic() - heartbeat > 10:
                heartbeat = time.monotonic()
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.35)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
