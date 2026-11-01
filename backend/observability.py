import json
import logging
import time
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("rab.api")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    logging.getLogger("zkteco.adms").setLevel(logging.INFO)


def log_event(level: int, **fields) -> None:
    safe = {key: value for key, value in fields.items() if key not in {
        "password",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "cookie",
        "secret",
        "otp",
        "recovery_code",
        "mfa_secret",
        "refresh_token",
        "redis_url",
        "REDIS_URL",
        "REDIS_PASSWORD",
        "SMTP_PASSWORD",
        "STORAGE_SECRET_KEY",
    }}
    logger.log(level, json.dumps(safe, default=str))


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log_event(
                logging.ERROR,
                service="api",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                event="unhandled_exception",
            )
            raise
        duration_ms = int((time.perf_counter() - started) * 1000)
        response.headers["x-request-id"] = request_id
        if request.url.path not in {"/health", "/health/live", "/health/ready"}:
            log_event(
                logging.INFO,
                service="api",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
            )
        return response
