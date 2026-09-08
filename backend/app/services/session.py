from redis.exceptions import RedisError

from app.errors import AppError
from app.redis_client import get_redis


def deny_jti(jti: str, ttl_seconds: int) -> None:
    try:
        get_redis().set(f"sess:deny:{jti}", "1", ex=max(1, ttl_seconds))
    except RedisError as exc:
        raise AppError(503, "REDIS_UNAVAILABLE", "Session store unavailable") from exc


def is_denied(jti: str) -> bool:
    try:
        return bool(get_redis().exists(f"sess:deny:{jti}"))
    except RedisError:
        # Fail open on deny (system-design §7). Still accept valid JWT.
        return False
