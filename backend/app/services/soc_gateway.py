"""Application-layer IP enforcement. Client addresses must come from the TCP peer."""

import asyncio
import ipaddress
import time

from fastapi import HTTPException
from starlette.responses import JSONResponse

from app.services.soc import NODE_IDS, canonical_ip


class SocGateway:
    def __init__(self, app, store, target=False):
        self.app, self.store, self.target = app, store, target

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        try:
            ip = canonical_ip(scope.get("client", ("unavailable", 0))[0])
        except HTTPException:
            ip = "unavailable"  # Unix/test transports never gain operator privileges.
        path, method = scope["path"], scope["method"]
        parts = path.split("/")
        asset = (
            parts[2] if len(parts) > 2 and parts[1] == "nodes" and parts[2] in NODE_IDS else None
        )
        if self.target and (ip == "unavailable" or ipaddress.ip_address(ip).is_global):
            return await JSONResponse(
                {"detail": "Node demonstration gateway is private-network only"}, status_code=403
            )(scope, receive, send)
        if await asyncio.to_thread(self.store.blocked, ip):
            # Sampling limits logging amplification; all denied requests remain denied.
            n = await asyncio.to_thread(self.store.count, ip, "blocked")
            if n == 1 or n % 20 == 0:
                await asyncio.to_thread(
                    self.store.emit,
                    ip,
                    "access.blocked",
                    "medium",
                    "blocked",
                    asset=asset,
                    method=method,
                    path=path,
                    status=403,
                    explanation=f"Persistent IP rule denied access; {n} denied requests in this 10-second window (sampled).",
                )
            return await JSONResponse(
                {
                    "error": {
                        "code": "ip_blocked",
                        "message": "Access blocked by the Gridinal operator.",
                    }
                },
                status_code=403,
            )(scope, receive, send)
        if self.target and await asyncio.to_thread(self.store.count, ip, "gateway") > 80:
            await asyncio.to_thread(
                self.store.emit,
                ip,
                "gateway.ceiling",
                "medium",
                "blocked",
                method=method,
                path=path,
                status=429,
                explanation="Fixed private demonstration gateway safety ceiling enforced; no outage inferred.",
            )
            return await JSONResponse(
                {"detail": "Fixed gateway safety ceiling exceeded"}, status_code=429
            )(scope, receive, send)
        start = time.perf_counter()
        status = 500
        elapsed = 0.0
        size = 0

        async def bounded_receive():
            nonlocal size
            message = await receive()
            if self.target and message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > 4096:
                    from starlette.exceptions import HTTPException

                    raise HTTPException(413, "Target request exceeds the 4KB demonstration limit")
            return message

        async def capture(message):
            nonlocal status, elapsed
            if message["type"] == "http.response.start":
                status = message["status"]
                elapsed = (time.perf_counter() - start) * 1000
            await send(message)

        try:
            await self.app(scope, bounded_receive, capture)
        finally:
            # SSE and SOC reads are excluded to prevent recursive monitoring noise.
            soc_denial = path.startswith("/api/v1/soc") and status >= 400
            if soc_denial or not path.startswith(("/api/v1/soc", "/assets/")):
                observation = scope.get("state", {}).get("soc_observation", {})
                await asyncio.to_thread(
                    self.store.emit,
                    ip,
                    observation.get("category", "operator.denied" if soc_denial else "request"),
                    observation.get(
                        "severity",
                        "medium" if status >= 500 or status in {403, 413, 429} else "info",
                    ),
                    observation.get("outcome", "denied" if status >= 400 else "observed"),
                    asset=observation.get("asset", asset),
                    method=method,
                    path=path,
                    status=status,
                    latency=elapsed,
                    explanation=observation.get(
                        "explanation",
                        "Observed HTTP request; no malicious identity or infrastructure compromise inferred.",
                    ),
                )
