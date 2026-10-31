"""Repository: typed JSON documents plus relational identity constraints.

SQLite (a file path) is the default for local use and tests. Setting
GRIDSENTINEL_DATABASE_URL to a postgres:// URL selects PostgreSQL with the same schema.
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.domain.seed import ROOT, SEED_PATH
from app.schemas.models import ScenarioBundle

Target = Path | str
STORAGE_ERRORS = (sqlite3.Error, psycopg.Error)
SEED_LOCK_KEY = 7_203_031

SCHEMA = [
    "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenarios(id), payload TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS assets (id TEXT NOT NULL, scenario_id TEXT NOT NULL REFERENCES scenarios(id), snapshot_id TEXT NOT NULL REFERENCES snapshots(id), payload TEXT NOT NULL, PRIMARY KEY(id,snapshot_id))",
    "CREATE TABLE IF NOT EXISTS cyber_edges (id TEXT NOT NULL, scenario_id TEXT NOT NULL REFERENCES scenarios(id), snapshot_id TEXT NOT NULL REFERENCES snapshots(id), source_id TEXT NOT NULL, target_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(id,snapshot_id), FOREIGN KEY(source_id,snapshot_id) REFERENCES assets(id,snapshot_id), FOREIGN KEY(target_id,snapshot_id) REFERENCES assets(id,snapshot_id))",
    "CREATE TABLE IF NOT EXISTS operational_edges (id TEXT NOT NULL, scenario_id TEXT NOT NULL REFERENCES scenarios(id), snapshot_id TEXT NOT NULL REFERENCES snapshots(id), source_id TEXT NOT NULL, target_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(id,snapshot_id), FOREIGN KEY(source_id,snapshot_id) REFERENCES assets(id,snapshot_id), FOREIGN KEY(target_id,snapshot_id) REFERENCES assets(id,snapshot_id))",
    "CREATE TABLE IF NOT EXISTS services (id TEXT NOT NULL, scenario_id TEXT NOT NULL REFERENCES scenarios(id), snapshot_id TEXT NOT NULL REFERENCES snapshots(id), payload TEXT NOT NULL, PRIMARY KEY(id,snapshot_id))",
]

_pools: dict[str, ConnectionPool] = {}


def default_db_path() -> Target:
    url = os.environ.get("GRIDSENTINEL_DATABASE_URL")
    if url:
        return url
    return Path(os.environ.get("GRIDSENTINEL_DB", str(ROOT / "data" / "gridsentinel.sqlite3")))


def is_postgres(target: Target) -> bool:
    return isinstance(target, str) and target.startswith(("postgres://", "postgresql://"))


class _PostgresConnection:
    """Adapts psycopg to the qmark style the repository's SQL is written in."""

    def __init__(self, conn: psycopg.Connection):
        self._conn = conn

    def execute(self, sql: str, params=()):
        return self._conn.execute(sql.replace("?", "%s"), params)


def _pool(url: str) -> ConnectionPool:
    if url not in _pools:
        _pools[url] = ConnectionPool(
            url,
            min_size=1,
            max_size=int(os.environ.get("GRIDSENTINEL_DB_POOL_MAX", "5")),
            timeout=20,
            check=ConnectionPool.check_connection,
            # prepare_threshold=None: Neon's pooled endpoint is PgBouncer in transaction mode.
            kwargs={"row_factory": dict_row, "connect_timeout": 15, "prepare_threshold": None},
            open=True,
        )
    return _pools[url]


def close_pools() -> None:
    while _pools:
        _pools.popitem()[1].close()


@contextmanager
def connection(target: Target):
    if is_postgres(target):
        with _pool(str(target)).connection() as conn:
            yield _PostgresConnection(conn)
        return
    path = Path(target)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def initialize(target: Target, *, reset: bool = False) -> None:
    bundle = ScenarioBundle.model_validate_json(SEED_PATH.read_text(encoding="utf-8"))
    with connection(target) as db:
        if is_postgres(target):
            # Serialises concurrent replicas seeding the same database.
            db.execute("SELECT pg_advisory_xact_lock(?)", (SEED_LOCK_KEY,))
        for statement in SCHEMA:
            db.execute(statement)
        existing = db.execute(
            "SELECT payload FROM scenarios WHERE id=?", (bundle.scenario.id,)
        ).fetchone()
        if existing and not reset:
            return
        if reset:
            for table in ["cyber_edges", "operational_edges", "services", "assets", "snapshots"]:
                db.execute(f"DELETE FROM {table} WHERE scenario_id=?", (bundle.scenario.id,))
            db.execute("DELETE FROM scenarios WHERE id=?", (bundle.scenario.id,))
        db.execute(
            "INSERT INTO scenarios VALUES (?,?)",
            (bundle.scenario.id, bundle.scenario.model_dump_json()),
        )
        db.execute(
            "INSERT INTO snapshots VALUES (?,?,?)",
            (bundle.snapshot.snapshot_id, bundle.scenario.id, bundle.snapshot.model_dump_json()),
        )
        for asset in bundle.assets:
            db.execute(
                "INSERT INTO assets VALUES (?,?,?,?)",
                (asset.id, asset.scenario_id, asset.snapshot_id, asset.model_dump_json()),
            )
        for table, edges in [
            ("cyber_edges", bundle.cyber_edges),
            ("operational_edges", bundle.operational_edges),
        ]:
            for edge in edges:
                db.execute(
                    f"INSERT INTO {table} VALUES (?,?,?,?,?,?)",
                    (
                        edge.id,
                        edge.scenario_id,
                        edge.snapshot_id,
                        edge.source_asset_id,
                        edge.target_asset_id,
                        edge.model_dump_json(),
                    ),
                )
        for service in bundle.services:
            db.execute(
                "INSERT INTO services VALUES (?,?,?,?)",
                (service.id, service.scenario_id, service.snapshot_id, service.model_dump_json()),
            )
        db.execute(
            "INSERT INTO metadata VALUES ('schema_version','1') "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        )


def read_documents(
    target: Target, table: str, scenario_id: str | None = None, snapshot_id: str | None = None
) -> list[dict]:
    if table not in {
        "scenarios",
        "snapshots",
        "assets",
        "cyber_edges",
        "operational_edges",
        "services",
    }:
        raise ValueError("Unknown collection")
    clauses, params = [], []
    if scenario_id is not None:
        clauses.append("id=?" if table == "scenarios" else "scenario_id=?")
        params.append(scenario_id)
    if snapshot_id is not None:
        clauses.append("id=?" if table == "snapshots" else "snapshot_id=?")
        params.append(snapshot_id)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with connection(target) as db:
        return [
            json.loads(row["payload"])
            for row in db.execute(f"SELECT payload FROM {table}{where} ORDER BY id", params)
        ]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Seed Aurora City; --reset replaces only this scenario."
    )
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    initialize(default_db_path(), reset=args.reset)
    close_pools()
    print("Aurora City database ready (30 assets; no model predictions).")
