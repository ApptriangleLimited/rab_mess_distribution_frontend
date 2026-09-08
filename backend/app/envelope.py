from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from app.errors import AppError

SKIP_ENVELOPE_PATHS = frozenset({"/metrics", "/docs", "/redoc", "/openapi.json"})


def success(data: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"ok": True, "data": data})


def problem(
    status: int,
    code: str,
    detail: str,
    errors: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "ok": False,
            "code": code,
            "detail": detail,
            "errors": errors or [],
        },
    )


def _http_code(status: int) -> str:
    return {
        400: "VALIDATION_ERROR",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        429: "RATE_LIMITED",
        503: "REDIS_UNAVAILABLE",
    }.get(status, "INTERNAL_ERROR")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError) -> JSONResponse:
        return problem(exc.status, exc.code, exc.detail, exc.errors)

    @app.exception_handler(RequestValidationError)
    async def validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for err in exc.errors():
            loc = err.get("loc", ())
            field = ".".join(str(p) for p in loc if p != "body")
            errors.append(
                {
                    "field": field or "body",
                    "code": "invalid",
                    "message": err.get("msg", "Invalid value"),
                }
            )
        return problem(400, "VALIDATION_ERROR", "Request failed", errors)

    @app.exception_handler(HTTPException)
    async def http_exc(_: Request, exc: HTTPException) -> JSONResponse:
        if exc.status_code == 204:
            return Response(status_code=204)
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return problem(exc.status_code, _http_code(exc.status_code), detail)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        return problem(500, "INTERNAL_ERROR", "Request failed")
