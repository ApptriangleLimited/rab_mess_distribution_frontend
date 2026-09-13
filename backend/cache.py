import hashlib
import json
import os
import time

import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6380/0")
CACHE_TTL = int(os.getenv("REDIS_CACHE_TTL", "120"))

_client: redis.Redis | None = None


def _reset() -> None:
    global _client
    _client = None


def get_redis() -> redis.Redis | None:
    global _client
    if _client is not None:
        return _client
    try:
        client = redis.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.4,
            socket_timeout=0.4,
        )
        client.ping()
        _client = client
        return client
    except redis.RedisError:
        return None


def redis_up() -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.ping())
    except redis.RedisError:
        _reset()
        return False


def cache_key(group: str, **parts) -> str:
    payload = json.dumps(parts, sort_keys=True, default=str, separators=(",", ":"))
    digest = hashlib.sha256(payload.encode()).hexdigest()[:24]
    return f"rab:{group}:{digest}"


def cache_get(key: str):
    client = get_redis()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except (redis.RedisError, json.JSONDecodeError, TypeError):
        _reset()
        return None


def cache_set(key: str, value, ttl: int | None = None) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.setex(key, ttl or CACHE_TTL, json.dumps(value, default=str))
    except (redis.RedisError, TypeError):
        _reset()


def cache_set_raw(key: str, value: str, ttl: int) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.setex(key, max(1, ttl), value)
    except redis.RedisError:
        _reset()


def cache_has(key: str) -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.exists(key))
    except redis.RedisError:
        _reset()
        return False


def cache_bust(*patterns: str) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        for pattern in patterns:
            keys = list(client.scan_iter(match=pattern, count=200))
            if keys:
                client.delete(*keys)
    except redis.RedisError:
        _reset()


def deny_key(token: str, jti: str | None = None) -> str:
    if jti:
        return f"rab:auth:deny:{jti}"
    digest = hashlib.sha256(token.encode()).hexdigest()
    return f"rab:auth:deny:{digest}"


def is_revoked(token: str, payload: dict) -> bool:
    return cache_has(deny_key(token, payload.get("jti")))


def revoke_token(token: str, payload: dict) -> None:
    exp = int(payload.get("exp") or 0)
    ttl = max(1, exp - int(time.time()))
    cache_set_raw(deny_key(token, payload.get("jti")), "1", ttl)


def bust_members() -> None:
    cache_bust("rab:members:*", "rab:assignments:*")


def bust_tag_requests() -> None:
    cache_bust("rab:tag-requests:*")


def bust_daily() -> None:
    cache_bust("rab:assignments:*", "rab:locks:*")


def bust_boro() -> None:
    cache_bust("rab:boro:*")
