"""SQLite control plane shared with the restricted node gateway. No production inventory writes."""

import hashlib
import ipaddress
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, Request

NODES = (
    ("PWR-001", "North Grid Gateway", "Weak test login", "/nodes/PWR-001/login"),
    ("PWR-008", "Dispatch Control Server", "Record authorization", "/nodes/PWR-008/records/1002"),
    ("WTR-005", "Water Quality Historian", "Confined SQL query", "/nodes/WTR-005/history"),
    ("HLT-008", "Hospital Operations Server", "Fictional report exposure", "/nodes/HLT-008/export"),
    ("PWR-005", "Energy Historian", "Request throttling", "/nodes/PWR-005/telemetry"),
)
NODE_IDS = {n[0] for n in NODES}


def canonical_ip(value: str) -> str:
    try:
        address = ipaddress.ip_address(value)
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        if address.is_unspecified or address.is_multicast:
            raise ValueError("Not a client address")
        return str(address)
    except ValueError as exc:
        raise HTTPException(
            422, "Use a single valid client IP address, not a subnet or hostname."
        ) from exc


def peer(request: Request) -> str:
    # Launchers disable proxy headers. Never read X-Forwarded-For here.
    if request.client is None:
        raise HTTPException(403, "Client address unavailable")
    return canonical_ip(request.client.host)


class SocStore:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
                    source_ip TEXT NOT NULL, asset_id TEXT, category TEXT NOT NULL,
                    severity TEXT NOT NULL, outcome TEXT NOT NULL, method TEXT NOT NULL,
                    path TEXT NOT NULL, status INTEGER NOT NULL, latency_ms REAL NOT NULL,
                    explanation TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS blocks (ip TEXT PRIMARY KEY, reason TEXT, expires_at REAL);
                CREATE TABLE IF NOT EXISTS profiles (asset_id TEXT PRIMARY KEY, protected INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, ip TEXT, expires_at REAL);
                CREATE TABLE IF NOT EXISTS counters (ip TEXT, scope TEXT, window INTEGER, count INTEGER,
                    PRIMARY KEY(ip,scope,window));
                CREATE INDEX IF NOT EXISTS events_source ON events(source_ip,id);
            """)
            db.execute("BEGIN IMMEDIATE")
            columns = {r[1] for r in db.execute("PRAGMA table_info(events)")}
            if "rule_version" not in columns:
                db.execute(
                    "ALTER TABLE events ADD COLUMN rule_version TEXT NOT NULL DEFAULT 'soc-rules-v1'"
                )
            db.executemany("INSERT OR IGNORE INTO profiles VALUES (?,1)", [(n[0],) for n in NODES])

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        finally:
            db.close()

    def emit(
        self,
        ip,
        category,
        severity="info",
        outcome="observed",
        asset=None,
        method="GET",
        path="",
        status=200,
        latency=0,
        explanation="",
    ):
        # No query strings, bodies, credentials, headers or tokens enter the event store.
        # A confirmed fictional-data disclosure is critical evidence. Other high-severity
        # attempts remain attempts; existing stored events are not rewritten.
        if outcome == "unauthorized_read" and severity == "high":
            severity = "critical"
        with self.connection() as db:
            row = db.execute(
                """INSERT INTO events(timestamp,source_ip,asset_id,category,severity,
                outcome,method,path,status,latency_ms,explanation,rule_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    datetime.now(UTC).isoformat(),
                    ip,
                    asset,
                    category,
                    severity,
                    outcome,
                    method,
                    path[:180],
                    status,
                    round(latency, 2),
                    explanation[:400],
                    "soc-rules-v2",
                ),
            )
            event_id = row.lastrowid
            if event_id % 100 == 0:
                db.execute("DELETE FROM events WHERE id <= ?", (event_id - 10000,))
                db.execute("DELETE FROM counters WHERE window < ?", (int(time.time() // 10) - 6,))
                db.execute("DELETE FROM sessions WHERE expires_at < ?", (time.time(),))
        return event_id

    def page(self, after=0, limit=100):
        with self.connection() as db:
            if after:
                rows = db.execute(
                    "SELECT * FROM events WHERE id>? ORDER BY id LIMIT ?", (after, limit)
                )
            else:
                rows = db.execute(
                    "SELECT * FROM (SELECT * FROM events ORDER BY id DESC LIMIT ?) ORDER BY id",
                    (limit,),
                )
            return [dict(r) for r in rows]

    def history(self, before, limit=100):
        with self.connection() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT * FROM events WHERE id<? ORDER BY id DESC LIMIT ?", (before, limit)
                )
            ]

    def bounds(self):
        with self.connection() as db:
            r = db.execute(
                "SELECT COALESCE(MIN(id),0),COALESCE(MAX(id),0),COUNT(*) FROM events"
            ).fetchone()
            return tuple(r)

    def protected(self, asset):
        with self.connection() as db:
            r = db.execute("SELECT protected FROM profiles WHERE asset_id=?", (asset,)).fetchone()
        if r is None:
            raise HTTPException(404, "Unknown project node")
        return bool(r[0])

    def nodes(self):
        return [
            dict(asset_id=a, name=n, scenario=s, path=p, protected=self.protected(a))
            for a, n, s, p in NODES
        ]

    def blocks(self):
        with self.connection() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT * FROM blocks WHERE expires_at>? ORDER BY ip", (time.time(),)
                )
            ]

    def blocked(self, ip):
        with self.connection() as db:
            return (
                db.execute(
                    "SELECT 1 FROM blocks WHERE ip=? AND expires_at>?", (ip, time.time())
                ).fetchone()
                is not None
            )

    def operator(self, request: Request):
        token = request.cookies.get("gridinal_operator", "")
        with self.connection() as db:
            return (
                db.execute(
                    "SELECT 1 FROM sessions WHERE digest=? AND ip=? AND expires_at>?",
                    (hashlib.sha256(token.encode()).hexdigest(), peer(request), time.time()),
                ).fetchone()
                is not None
            )

    def session(self, ip):
        token = secrets.token_urlsafe(32)
        with self.connection() as db:
            db.execute(
                "INSERT INTO sessions VALUES (?,?,?)",
                (hashlib.sha256(token.encode()).hexdigest(), ip, time.time() + 28800),
            )
        return token

    def count(self, ip, scope):
        window = int(time.time() // 10)
        with self.connection() as db:
            db.execute(
                "INSERT INTO counters VALUES (?,?,?,1) ON CONFLICT(ip,scope,window) DO UPDATE SET count=count+1",
                (ip, scope, window),
            )
            return db.execute(
                "SELECT count FROM counters WHERE ip=? AND scope=? AND window=?",
                (ip, scope, window),
            ).fetchone()[0]


def require_operator(request: Request):
    store = request.app.state.soc
    if not store.operator(request):
        raise HTTPException(401, "Open an operator session on this computer first.")
    if request.method != "GET":
        origin = request.headers.get("origin")
        if origin and origin != str(request.base_url).rstrip("/"):
            raise HTTPException(403, "Cross-origin operator action rejected")
    return store
