from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.config import get_settings

_client: Any = None


def set_redis(client: Any) -> None:
    global _client
    _client = client


def get_redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(
            get_settings().redis_url,
            decode_responses=True,
            socket_connect_timeout=1.5,
            socket_timeout=1.5,
        )
    return _client


def ping_redis() -> bool:
    try:
        return bool(get_redis().ping())
    except RedisError:
        return False
