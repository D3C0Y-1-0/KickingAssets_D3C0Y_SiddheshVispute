"""Real HTTP handlers and SQLite evidence; client addresses are explicit ASGI test peers."""

import asyncio
import time

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.api.soc import events
from app.main import create_app
from app.services.soc import SocStore
from app.soc_targets import create_targets


@pytest.fixture
def system(tmp_path):
    main = create_app(db_path=tmp_path / "inventory.sqlite3")
    store = main.state.soc
    targets = create_targets(store, tmp_path / "reports", "protected-test-password")
    operator = TestClient(main, client=("127.0.0.1", 1234))
    remote = TestClient(main, client=("192.0.2.10", 4321))
    attacker = TestClient(targets, client=("192.0.2.10", 4321))
    assert operator.post("/api/v1/soc/session").status_code == 200
    return operator, remote, attacker, store


def test_remote_cannot_control_soc_or_spoof_local_ip(system):
    op, remote, _, _ = system
    assert (
        remote.post("/api/v1/soc/session", headers={"X-Forwarded-For": "127.0.0.1"}).status_code
        == 403
    )
    assert remote.get("/api/v1/soc/snapshot").status_code == 401
    assert (
        remote.post(
            "/api/v1/soc/blocks", json={"ip": "192.0.2.50", "reason": "test reason"}
        ).status_code
        == 401
    )
    assert (
        op.post(
            "/api/v1/soc/blocks",
            json={"ip": "192.0.2.50", "reason": "test reason"},
            headers={"Origin": "http://evil.invalid"},
        ).status_code
        == 403
    )
    assert (
        op.post("/api/v1/soc/session", headers={"Origin": "http://evil.invalid"}).status_code == 403
    )


def test_shared_gateway_block_unblock_and_spoof_resistance(system):
    op, remote, target, store = system
    assert target.get("/nodes/PWR-005/telemetry").status_code == 200
    assert (
        op.post(
            "/api/v1/soc/blocks",
            json={"ip": "::ffff:192.0.2.10", "reason": "Confirmed demo request", "minutes": 1},
        ).status_code
        == 200
    )
    for client, path in [(target, "/nodes/PWR-005/telemetry"), (remote, "/api/v1/health")]:
        assert client.get(path, headers={"X-Forwarded-For": "192.0.2.99"}).status_code == 403
    assert op.get("/api/v1/soc/snapshot").status_code == 200
    assert any(e["category"] == "access.blocked" for e in store.page())
    assert op.post("/api/v1/soc/unblock", json={"ip": "192.0.2.10"}).status_code == 200
    assert target.get("/nodes/PWR-005/telemetry").status_code == 200
    assert remote.get("/openapi.json").status_code == 200


@pytest.mark.parametrize("ip", ["127.0.0.1", "127.0.0.2", "::1", "::ffff:127.0.0.1"])
def test_operator_lockout_is_prevented(system, ip):
    op, *_ = system
    assert (
        op.post("/api/v1/soc/blocks", json={"ip": ip, "reason": "test protection"}).status_code
        == 409
    )


@pytest.mark.parametrize("ip", ["*", "0.0.0.0", "192.0.2.0/24", "example.com", "224.0.0.1"])
def test_invalid_block_address_rejected(system, ip):
    op, *_ = system
    assert (
        op.post("/api/v1/soc/blocks", json={"ip": ip, "reason": "invalid address"}).status_code
        == 422
    )


def test_block_persistence_expiry_and_session_expiry(system):
    op, remote, _, store = system
    op.post("/api/v1/soc/blocks", json={"ip": "192.0.2.10", "reason": "test expiry"})
    reopened = SocStore(store.path)
    assert reopened.blocked("192.0.2.10")
    with store.connection() as db:
        db.execute("UPDATE blocks SET expires_at=?", (time.time() - 1,))
    assert remote.get("/openapi.json").status_code == 200
    with store.connection() as db:
        db.execute("UPDATE sessions SET expires_at=0")
    assert op.get("/api/v1/soc/snapshot").status_code == 401


def vulnerable(op, asset):
    r = op.post(f"/api/v1/soc/nodes/{asset}/protection", json={"protected": False})
    assert r.status_code == 200


def test_real_login_record_disclosure_and_protection(system):
    op, remote, target, store = system
    assert (
        target.post(
            "/nodes/PWR-001/login", json={"username": "viewer", "password": "viewer"}
        ).status_code
        == 401
    )
    vulnerable(op, "PWR-001")
    r = target.post("/nodes/PWR-001/login", json={"username": "viewer", "password": "viewer"})
    assert r.status_code == 200
    headers = {"Authorization": "Bearer " + r.json()["token"]}
    assert target.get("/nodes/PWR-008/records/1002", headers=headers).status_code == 403
    vulnerable(op, "PWR-008")
    assert target.get("/nodes/PWR-008/records/1002", headers=headers).json()["owner"] == "operator"
    e = store.page()[-1]
    assert e["outcome"] == "unauthorized_read" and e["source_ip"] == "192.0.2.10"
    assert target.get("/nodes/PWR-008/records/1001", headers=headers).json()["owner"] == "viewer"
    assert remote.get("/api/v1/soc/snapshot", headers=headers).status_code == 401
    op.post("/api/v1/soc/nodes/PWR-008/protection", json={"protected": True})
    assert target.get("/nodes/PWR-008/records/1002", headers=headers).status_code == 403
    text = str(store.page())
    assert r.json()["token"] not in text and "Bearer" not in text


def test_sql_scope_real_results_and_query_protection(system):
    op, _, target, store = system
    q = "public' OR '1'='1"
    assert target.get("/nodes/WTR-005/history", params={"q": q}).json()["rows"] == []
    vulnerable(op, "WTR-005")
    r = target.get("/nodes/WTR-005/history", params={"q": q})
    assert len(r.json()["rows"]) == 2
    assert store.page()[-1]["outcome"] == "unauthorized_read"
    assert (
        target.get(
            "/nodes/WTR-005/history", params={"q": "x' UNION SELECT name,sql FROM sqlite_master --"}
        ).status_code
        == 400
    )
    assert (
        target.get(
            "/nodes/WTR-005/history", params={"q": "x'; ATTACH DATABASE 'host.db' AS h; --"}
        ).status_code
        == 400
    )
    assert q not in str(store.page())
    assert target.get("/nodes/WTR-005/history", params={"q": "x" * 129}).status_code == 422


def test_file_service_confined_to_named_fictional_files(system):
    op, _, target, store = system
    route = "/nodes/HLT-008/export"
    assert target.get(route, params={"name": "private-maintenance.txt"}).status_code == 403
    vulnerable(op, "HLT-008")
    assert (
        "Fictional"
        in target.get(route, params={"name": "private-maintenance.txt"}).json()["content"]
    )
    assert target.get(route, params={"name": "../../.env"}).status_code == 404
    assert target.get(route, params={"name": "C:\\Windows\\win.ini"}).status_code == 404


def test_rate_limit_changes_are_measured_not_fake_outages(system, monkeypatch):
    fixed = int(time.time() // 10) * 10 + 1
    monkeypatch.setattr("app.services.soc.time.time", lambda: fixed)
    op, _, target, store = system
    codes = [target.get("/nodes/PWR-005/telemetry").status_code for _ in range(7)]
    assert codes == [200] * 5 + [429] * 2
    vulnerable(op, "PWR-005")
    assert target.get("/nodes/PWR-005/telemetry").status_code == 200
    assert store.page()[-1]["outcome"] == "observed"


def test_body_limit_and_unknown_target_have_no_host_side_effect(system):
    _, _, target, store = system
    assert (
        target.post(
            "/nodes/PWR-001/login",
            content=b"x" * 5000,
            headers={"Content-Type": "application/json"},
        ).status_code
        == 413
    )
    assert target.get("/nodes/PWR-999/shell").status_code == 404


def test_durable_ordered_stream_and_paged_history(system):
    op, _, _, store = system
    cursor = store.bounds()[1]
    store.emit("192.0.2.10", "test.evidence", explanation="Actual store event")
    token = op.cookies.get("gridinal_operator")

    async def run():
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/soc/events",
            "headers": [(b"cookie", f"gridinal_operator={token}".encode())],
            "client": ("127.0.0.1", 1234),
            "server": ("testserver", 80),
            "scheme": "http",
            "app": op.app,
        }

        async def receive():
            return {"type": "http.request", "body": b""}

        response = await events(Request(scope, receive), after=cursor)
        message = await anext(response.body_iterator)
        assert f"id: {cursor + 1}" in message and "test.evidence" in message
        store.emit("192.0.2.10", "test.next")
        assert "test.next" in await anext(response.body_iterator)
        await response.body_iterator.aclose()

    asyncio.run(run())
    rows = op.get("/api/v1/soc/logs", params={"before": store.bounds()[1] + 1, "limit": 2}).json()
    assert len(rows) == 2 and rows[0]["id"] > rows[1]["id"]
    assert (
        op.get("/api/v1/soc/events", params={"after": store.bounds()[1] + 100}).status_code == 409
    )


def test_sessions_cannot_be_replayed_from_another_address(system):
    op, remote, _, _ = system
    remote.cookies.set("gridinal_operator", op.cookies.get("gridinal_operator"))
    assert remote.get("/api/v1/soc/snapshot").status_code == 401


def test_target_session_revoked_by_login_profile_change(system):
    op, _, target, _ = system
    vulnerable(op, "PWR-001")
    token = target.post(
        "/nodes/PWR-001/login", json={"username": "viewer", "password": "viewer"}
    ).json()["token"]
    headers = {"Authorization": "Bearer " + token}
    assert target.get("/nodes/PWR-008/records/1001", headers=headers).status_code == 200
    op.post("/api/v1/soc/nodes/PWR-001/protection", json={"protected": True})
    assert target.get("/nodes/PWR-008/records/1001", headers=headers).status_code == 401


def test_public_network_target_client_is_rejected(system, tmp_path):
    *_, store = system
    app = create_targets(store, tmp_path / "public-test")
    assert TestClient(app, client=("8.8.8.8", 1234)).get("/health").status_code == 403


def test_sse_through_complete_app_is_live_uncompressed_and_authenticated(system):
    op, _, _, store = system
    cursor = store.bounds()[1]
    store.emit("192.0.2.10", "wire-evidence")
    token = op.cookies.get("gridinal_operator")

    async def run():
        finished = asyncio.Event()
        output = []
        first = True

        async def receive():
            nonlocal first
            if first:
                first = False
                return {"type": "http.request", "body": b"", "more_body": False}
            await finished.wait()
            return {"type": "http.disconnect"}

        async def send(message):
            output.append(message)
            if message["type"] == "http.response.body" and b"wire-evidence" in message.get(
                "body", b""
            ):
                finished.set()

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/api/v1/soc/events",
            "raw_path": b"/api/v1/soc/events",
            "query_string": f"after={cursor}".encode(),
            "root_path": "",
            "headers": [
                (b"host", b"testserver"),
                (b"accept-encoding", b"gzip"),
                (b"cookie", f"gridinal_operator={token}".encode()),
            ],
            "client": ("127.0.0.1", 1234),
            "server": ("testserver", 80),
        }
        await asyncio.wait_for(op.app(scope, receive, send), timeout=4)
        start = next(m for m in output if m["type"] == "http.response.start")
        assert start["status"] == 200
        assert not any(k == b"content-encoding" for k, v in start["headers"])
        assert finished.is_set()

    asyncio.run(run())
