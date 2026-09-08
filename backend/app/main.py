import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.config import get_settings
from app.envelope import SKIP_ENVELOPE_PATHS, problem, register_exception_handlers, success
from app.logging import setup_logging
from app.metrics import MetricsMiddleware, metrics_response
from app.middleware import AccessLogMiddleware, RequestIdMiddleware
from app.routers import assignments, auth, boro_khana, days, health, kitchen, members, mess, months, pritibhoj, register, reports, senders, staff
from app.routers import settings as settings_routes
from app.routers import state_reports, tag_requests, zk
from app.seed import seed_p2, seed_p5, seed_staff

setup_logging()
settings = get_settings()
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.seed_on_start:
        try:
            n = seed_staff()
            if n:
                log.info("seeded staff", extra={"path": "startup", "status": n})
        except Exception:
            log.warning("staff seed skipped", exc_info=True)
        try:
            n = seed_p2()
            if n:
                log.info("seeded catalog", extra={"path": "startup", "status": n})
        except Exception:
            log.warning("catalog seed skipped", exc_info=True)
        try:
            n = seed_p5()
            if n:
                log.info("seeded shifts", extra={"path": "startup", "status": n})
        except Exception:
            log.warning("shift seed skipped", exc_info=True)
    yield


app = FastAPI(title="RAB Mess Distribution API", version="0.1.0", lifespan=lifespan)
app.add_middleware(AccessLogMiddleware)
app.add_middleware(MetricsMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(staff.router, prefix="/api/v1")
app.include_router(register.router, prefix="/api/v1")
app.include_router(members.router, prefix="/api/v1")
app.include_router(settings_routes.router, prefix="/api/v1")
app.include_router(senders.router, prefix="/api/v1")
app.include_router(assignments.router, prefix="/api/v1")
app.include_router(days.router, prefix="/api/v1")
app.include_router(boro_khana.router, prefix="/api/v1")
app.include_router(tag_requests.router, prefix="/api/v1")
app.include_router(state_reports.router, prefix="/api/v1")
app.include_router(mess.router, prefix="/api/v1")
app.include_router(kitchen.shifts_router, prefix="/api/v1")
app.include_router(kitchen.plans_router, prefix="/api/v1")
app.include_router(kitchen.assigns_router, prefix="/api/v1")
app.include_router(kitchen.guests_router, prefix="/api/v1")
app.include_router(zk.router, prefix="/api/v1")
app.include_router(months.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(pritibhoj.router, prefix="/api/v1")


@app.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    return metrics_response()


@app.middleware("http")
async def wrap_json_envelope(request: Request, call_next) -> Response:
    response = await call_next(request)
    if request.url.path in SKIP_ENVELOPE_PATHS:
        return response
    if response.status_code == 204:
        return Response(status_code=204)
    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        return response
    body = b"".join([chunk async for chunk in response.body_iterator])
    try:
        payload = json.loads(body.decode() or "null")
    except json.JSONDecodeError:
        return Response(
            content=body,
            status_code=response.status_code,
            headers={
                k: v
                for k, v in response.headers.items()
                if k.lower() != "content-length"
            },
            media_type=content_type,
        )
    rid = response.headers.get("X-Request-ID", "")
    if isinstance(payload, dict) and "ok" in payload:
        out = JSONResponse(status_code=response.status_code, content=payload)
        if rid:
            out.headers["X-Request-ID"] = rid
        return out
    if response.status_code >= 400:
        detail = "Request failed"
        if isinstance(payload, dict) and isinstance(payload.get("detail"), str):
            detail = payload["detail"]
        code = {
            400: "VALIDATION_ERROR",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            429: "RATE_LIMITED",
            503: "NOT_READY",
        }.get(response.status_code, "INTERNAL_ERROR")
        out = problem(response.status_code, code, detail)
        if rid:
            out.headers["X-Request-ID"] = rid
        return out
    wrapped = success(payload, response.status_code)
    if rid:
        wrapped.headers["X-Request-ID"] = rid
    return wrapped
