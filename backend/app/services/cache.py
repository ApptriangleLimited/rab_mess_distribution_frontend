import json
from typing import Any

from redis.exceptions import RedisError

from app.constants import CACHE_CATALOG_KEY, CACHE_RATES_KEY
from app.redis_client import get_redis


def cache_get(key: str) -> Any | None:
    try:
        raw = get_redis().get(key)
    except RedisError:
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def cache_set(key: str, value: Any, ttl: int) -> None:
    try:
        get_redis().set(key, json.dumps(value), ex=ttl)
    except RedisError:
        return


def bust_settings_cache() -> None:
    try:
        get_redis().delete(CACHE_CATALOG_KEY, CACHE_RATES_KEY)
    except RedisError:
        return
