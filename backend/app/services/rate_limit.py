from redis.exceptions import RedisError

from app.constants import (
    LOGIN_EMAIL_LIMIT,
    LOGIN_IP_LIMIT,
    LOGIN_WINDOW_SEC,
    REGISTER_GLOBAL_LIMIT,
    REGISTER_IP_LIMIT,
    REGISTER_WINDOW_SEC,
)
from app.errors import AppError
from app.redis_client import get_redis


def _bump(key: str, limit: int, window: int, detail: str) -> None:
    try:
        redis = get_redis()
        count = int(redis.incr(key))
        if count == 1:
            redis.expire(key, window)
        if count > limit:
            raise AppError(429, "RATE_LIMITED", detail)
    except AppError:
        raise
    except RedisError as exc:
        raise AppError(503, "REDIS_UNAVAILABLE", "Rate limit unavailable") from exc


def enforce_login_limit(ip: str, email: str) -> None:
    _bump(f"rl:login:{ip or 'unknown'}", LOGIN_IP_LIMIT, LOGIN_WINDOW_SEC, "Too many login attempts")
    _bump(
        f"rl:login:{email.strip().lower()}",
        LOGIN_EMAIL_LIMIT,
        LOGIN_WINDOW_SEC,
        "Too many login attempts",
    )


def enforce_register_limit(ip: str) -> None:
    _bump(
        f"rl:reg:{ip or 'unknown'}",
        REGISTER_IP_LIMIT,
        REGISTER_WINDOW_SEC,
        "Too many registrations",
    )
    _bump("rl:reg:global", REGISTER_GLOBAL_LIMIT, REGISTER_WINDOW_SEC, "Too many registrations")
