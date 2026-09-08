from datetime import datetime, timezone

from fastapi import APIRouter

from app.db import ping_db
from app.errors import AppError
from app.metrics import DB_UP, REDIS_UP
from app.redis_client import ping_redis

router = APIRouter(tags=["health"])


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/live")
def live() -> dict:
    return {"status": "ok"}


def _probe() -> tuple[bool, bool]:
    db_ok = ping_db()
    redis_ok = ping_redis()
    DB_UP.set(1 if db_ok else 0)
    REDIS_UP.set(1 if redis_ok else 0)
    return db_ok, redis_ok


@router.get("/health")
def health() -> dict:
    db_ok, redis_ok = _probe()
    degraded = not (db_ok and redis_ok)
    return {
        "status": "degraded" if degraded else "ok",
        "time": _now(),
        "db": "ok" if db_ok else "down",
        "redis": "ok" if redis_ok else "down",
    }


@router.get("/ready")
def ready() -> dict:
    db_ok, redis_ok = _probe()
    if not (db_ok and redis_ok):
        raise AppError(
            503,
            "NOT_READY",
            "Dependencies unavailable",
            [
                {"field": "db", "code": "down", "message": "down"}
                if not db_ok
                else {"field": "db", "code": "ok", "message": "ok"},
                {"field": "redis", "code": "down", "message": "down"}
                if not redis_ok
                else {"field": "redis", "code": "ok", "message": "ok"},
            ],
        )
    return {
        "status": "ok",
        "time": _now(),
        "db": "ok",
        "redis": "ok",
    }
