from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from app.api.intelligence import router as intelligence_router
from app.api.routes import router
from app.api.vulnerability import router as vulnerability_router
from app.api.workflow import router as workflow_router
from app.db.store import STORAGE_ERRORS, Target, close_pools, default_db_path, initialize
from app.db.vulnerability_store import bootstrap
from app.domain.seed import ROOT
from app.services.intelligence import bootstrap as bootstrap_intelligence


def create_app(db_path: Target | None = None, static_dir: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        initialize(application.state.db_path)
        bootstrap(application.state.db_path, ROOT / "data/reference/risk-v1")
        bootstrap_intelligence(application.state.db_path)
        yield
        close_pools()

    application = FastAPI(
        title="GridSentinel",
        version="0.1.0",
        description="Simulated infrastructure, real reference-backed vulnerability evidence and experimental explainable risk prioritization. No incident probability is claimed.",
        lifespan=lifespan,
    )
    application.state.db_path = db_path or default_db_path()
    application.add_middleware(GZipMiddleware, minimum_size=1024)

    @application.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        codes = {404: "not_found", 409: "conflict", 501: "not_implemented", 503: "unavailable"}
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": codes.get(exc.status_code, "request_error"),
                    "message": str(exc.detail),
                    "details": [],
                }
            },
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        details = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request validation failed",
                    "details": details,
                }
            },
        )

    @application.exception_handler(STORAGE_ERRORS[0])
    @application.exception_handler(STORAGE_ERRORS[1])
    async def storage_error(request: Request, exc: Exception):
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "unavailable",
                    "message": "Scenario storage is unavailable",
                    "details": [],
                }
            },
        )

    application.include_router(router)
    application.include_router(vulnerability_router)
    application.include_router(intelligence_router)
    application.include_router(workflow_router)
    compiled = (static_dir or ROOT / "frontend" / "dist").resolve()
    if (compiled / "assets").is_dir():
        application.mount(
            "/assets", StaticFiles(directory=compiled / "assets"), name="frontend-assets"
        )

    @application.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "API route not found")
        candidate = (compiled / path).resolve()
        if candidate.is_relative_to(compiled) and candidate.is_file():
            return FileResponse(candidate)
        if "." in Path(path).name:
            raise HTTPException(404, "Static file not found")
        if (compiled / "index.html").is_file():
            return FileResponse(compiled / "index.html")
        raise HTTPException(
            404, "Frontend not built. Run npm run build in frontend/ or use Vite on port 5173."
        )

    return application


app = create_app()
