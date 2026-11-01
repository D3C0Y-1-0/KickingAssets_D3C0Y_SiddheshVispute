"""Real, bounded HTTP target services. No shell, host paths, production DB or inventory access.

Run separately from Gridinal. Both gateways share only the dedicated SOC control/evidence DB.
"""

import hashlib
import os
import re
import secrets
import sqlite3
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request

from app.schemas.soc import SocLogin
from app.services.soc import SocStore, peer
from app.services.soc_gateway import SocGateway


def create_targets(store: SocStore, folder: Path, protected_password: str | None = None):
    app = FastAPI(title="Gridinal confined node services", docs_url=None, redoc_url=None)
    app.state.soc = store
    app.add_middleware(SocGateway, store=store, target=True)
    # No general filesystem API: only two server-owned, fixed fictional reports can be read.
    folder.mkdir(parents=True, exist_ok=True)
    for name, value in {
        "public-status.txt": "Fictional hospital status: demonstration only.",
        "private-maintenance.txt": "Fictional restricted maintenance schedule. No patient data.",
    }.items():
        (folder / name).write_text(value, encoding="utf-8")
    password = protected_password or secrets.token_urlsafe(32)
    sessions = {}

    def observe(request, asset, category, outcome, explanation, severity="info"):
        request.state.soc_observation = dict(
            asset=asset,
            category=category,
            outcome=outcome,
            explanation=explanation,
            severity=severity,
        )

    def identity(request):
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        entry = sessions.get(hashlib.sha256(token.encode()).hexdigest())
        if (
            not entry
            or entry["expires"] < time.time()
            or entry["ip"] != peer(request)
            or entry["protected"] != store.protected("PWR-001")
        ):
            raise HTTPException(
                401, "A viewer node-session token is required; it is not a SOC operator session."
            )
        return entry["name"]

    @app.get("/health")
    def health():
        return {"status": "ok", "scope": "confined synthetic-data node services"}

    @app.post("/nodes/PWR-001/login")
    def login(body: SocLogin, request: Request):
        ip = peer(request)
        protected = store.protected("PWR-001")
        count = store.count(ip, "login")
        if protected and count > 5:
            observe(
                request,
                "PWR-001",
                "authentication.throttled",
                "blocked",
                "Login throttling enforced after five requests in a fixed 10-second window.",
                "medium",
            )
            raise HTTPException(429, "Login throttled; wait for the next 10-second window.")
        expected = password if protected else body.username
        if body.username not in {"viewer", "operator"} or not secrets.compare_digest(
            body.password, expected
        ):
            observe(
                request,
                "PWR-001",
                "authentication.failure",
                "denied",
                f"Authentication denied; attempt {count} in this 10-second window.",
                "high" if count >= 3 else "info",
            )
            raise HTTPException(401, "Invalid node credentials")
        # Hard bounded, ephemeral node sessions. No credentials or tokens enter SOC events.
        if len(sessions) >= 100:
            sessions.clear()
        token = secrets.token_urlsafe(24)
        sessions[hashlib.sha256(token.encode()).hexdigest()] = dict(
            name=body.username, ip=ip, expires=time.time() + 1800, protected=protected
        )
        observe(
            request,
            "PWR-001",
            "authentication.success",
            "authenticated",
            "Real node-service login accepted. Synthetic credentials; not host access.",
            "high" if not protected else "info",
        )
        return {
            "token": token,
            "account": body.username,
            "expires_in": 1800,
            "scope": "node records only",
        }

    @app.get("/nodes/PWR-008/records/{record_id}")
    def record(record_id: int, request: Request):
        account = identity(request)
        records = {
            1001: dict(owner="viewer", content="Fictional public dispatch status"),
            1002: dict(
                owner="operator", content="Fictional restricted dispatch maintenance schedule"
            ),
        }
        item = records.get(record_id)
        if item is None:
            raise HTTPException(404, "Unknown fictional record")
        forbidden = account != item["owner"]
        if forbidden and store.protected("PWR-008"):
            observe(
                request,
                "PWR-008",
                "authorization.record",
                "blocked",
                "Ownership check denied another account's fictional record.",
                "medium",
            )
            raise HTTPException(403, "Record belongs to a different account")
        observe(
            request,
            "PWR-008",
            "authorization.record",
            "unauthorized_read" if forbidden else "allowed",
            "Ownership policy violated: another account's fictional record was returned."
            if forbidden
            else "Own fictional record returned.",
            "high" if forbidden else "info",
        )
        return dict(record_id=record_id, **item, synthetic=True)

    @app.get("/nodes/WTR-005/history")
    def history(request: Request, q: str = Query(default="public", max_length=128)):
        db = sqlite3.connect(":memory:")
        try:
            db.execute("CREATE TABLE readings (name TEXT, value TEXT)")
            db.executemany(
                "INSERT INTO readings VALUES (?,?)",
                [
                    ("public", "Fictional reservoir level: 70"),
                    ("restricted", "Fictional maintenance-only sensor note"),
                ],
            )

            # SELECT can access only this in-memory table. ATTACH, PRAGMA, DDL, writes and
            # arbitrary functions are denied, even in the intentionally vulnerable profile.
            def authorize(action, arg1, arg2, database, source):
                if action == sqlite3.SQLITE_SELECT or (
                    action == sqlite3.SQLITE_READ and arg1 == "readings"
                ):
                    return sqlite3.SQLITE_OK
                return sqlite3.SQLITE_DENY

            db.set_authorizer(authorize)
            db.set_progress_handler(lambda: 1, 10000)
            if store.protected("WTR-005"):
                rows = db.execute(
                    "SELECT name,value FROM readings WHERE name=? AND name='public'", (q,)
                ).fetchall()
            else:
                # Intentional training weakness, confined to ephemeral synthetic data only.
                rows = db.execute(f"SELECT name,value FROM readings WHERE name='{q}'").fetchall()
            exposed = any(name != "public" for name, value in rows)
            protected_attempt = store.protected("WTR-005") and bool(
                re.search(r"'\s*(?:or|union)\b|--|;", q, re.IGNORECASE)
            )
            observe(
                request,
                "WTR-005",
                "query.attempt" if protected_attempt else "query.result",
                "unauthorized_read" if exposed else "blocked" if protected_attempt else "allowed",
                "SQL query returned restricted fictional rows; actual service disclosure, not infrastructure compromise."
                if exposed
                else "SQL-like query syntax observed; parameter binding prevented restricted-row disclosure. No compromise established."
                if protected_attempt
                else "Query completed without a demonstrated predicate bypass.",
                "high" if exposed else "medium" if protected_attempt else "info",
            )
            return {"rows": [dict(name=a, value=b) for a, b in rows], "synthetic": True}
        except sqlite3.Error:
            observe(
                request,
                "WTR-005",
                "query.rejected",
                "denied",
                "Malformed or out-of-scope SQL rejected by the confined query service.",
                "medium",
            )
            raise HTTPException(400, "Query rejected") from None
        finally:
            db.close()

    @app.get("/nodes/HLT-008/export")
    def export(request: Request, name: str = Query(default="public-status.txt", max_length=64)):
        if name not in {"public-status.txt", "private-maintenance.txt"}:
            raise HTTPException(
                404, "Only fixed fictional report names exist; arbitrary paths are never opened"
            )
        restricted = name == "private-maintenance.txt"
        if restricted and store.protected("HLT-008"):
            observe(
                request,
                "HLT-008",
                "file.access",
                "blocked",
                "Restricted fictional report export denied.",
                "medium",
            )
            raise HTTPException(403, "Report is restricted")
        observe(
            request,
            "HLT-008",
            "file.access",
            "unauthorized_read" if restricted else "allowed",
            "Restricted fictional report read from the dedicated target directory."
            if restricted
            else "Public fictional report returned.",
            "high" if restricted else "info",
        )
        return {
            "name": name,
            "content": (folder / name).read_text(encoding="utf-8"),
            "synthetic": True,
        }

    @app.get("/nodes/PWR-005/telemetry")
    def telemetry(request: Request):
        count = store.count(peer(request), "telemetry")
        if count > 5 and store.protected("PWR-005"):
            observe(
                request,
                "PWR-005",
                "traffic.throttled",
                "blocked",
                "Application rate limit enforced; no outage inferred.",
                "medium",
            )
            raise HTTPException(429, "Telemetry rate limit reached")
        observe(
            request,
            "PWR-005",
            "traffic.request",
            "observed",
            f"{count} real requests in a fixed 10-second window. {'Throttling disabled; burst observed.' if count > 5 else 'No degradation established.'}",
            "medium" if count > 5 else "info",
        )
        return {"timestamp": time.time(), "requests_in_window": count, "synthetic_service": True}

    return app


def app_factory():
    path = os.environ.get("GRIDSENTINEL_SOC_DB")
    if not path:
        raise RuntimeError("Use scripts/start-soc.ps1 to select the dedicated SOC store.")
    folder = Path(path).parent / "soc-target-reports"
    return create_targets(
        SocStore(Path(path)), folder, os.environ.get("GRIDSENTINEL_NODE_PASSWORD")
    )
