import hashlib
import json
import os
import time
from urllib.parse import urlparse, urlunparse

import redis

from config import settings

CACHE_TTL = int(os.getenv("REDIS_CACHE_TTL", "120"))

_client: redis.Redis | None = None
_raw_client: redis.Redis | None = None


def build_redis_url() -> str:
    url = settings.redis_url
    password = settings.redis_password
    parsed = urlparse(url)
    path = parsed.path or f"/{settings.redis_db}"
    if password and not parsed.password:
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 6379
        user = parsed.username or ""
        auth = f"{user}:{password}" if user else f":{password}"
        netloc = f"{auth}@{host}:{port}"
        return urlunparse(parsed._replace(netloc=netloc, path=path))
    return url


def redis_log_target() -> str:
    parsed = urlparse(build_redis_url())
    host = parsed.hostname or "unknown"
    port = parsed.port or 6379
    db = (parsed.path or "/0").lstrip("/") or "0"
    return f"{host}:{port}/{db}"


def _reset() -> None:
    global _client, _raw_client
    _client = None
    _raw_client = None


def _connect(decode: bool, *, blocking: bool = False) -> redis.Redis | None:
    try:
        client = redis.Redis.from_url(
            build_redis_url(),
            decode_responses=decode,
            socket_connect_timeout=2.0,
            socket_timeout=None if blocking else 3.0,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        client.ping()
        return client
    except redis.RedisError:
        return None


def get_redis() -> redis.Redis | None:
    global _client
    if _client is not None:
        return _client
    client = _connect(True)
    if client is None:
        return None
    _client = client
    return client


def get_redis_raw() -> redis.Redis | None:
    global _raw_client
    if _raw_client is not None:
        return _raw_client
    client = _connect(False, blocking=True)
    if client is None:
        return None
    _raw_client = client
    return client


def redis_up() -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.ping())
    except redis.RedisError:
        _reset()
        return False


def _group_from_pattern(pattern: str) -> str | None:
    raw = (pattern or "").strip()
    if raw.startswith("rab:"):
        raw = raw[4:]
    raw = raw.rstrip("*").rstrip(":")
    return raw or None


def cache_gen(group: str) -> str:
    client = get_redis()
    if client is None:
        return "0"
    try:
        raw = client.get(f"rab:{group}:gen")
        return str(int(raw)) if raw is not None else "0"
    except (redis.RedisError, TypeError, ValueError):
        _reset()
        return "0"


def cache_key(group: str, **parts) -> str:
    payload = json.dumps(parts, sort_keys=True, default=str, separators=(",", ":"))
    digest = hashlib.sha256(payload.encode()).hexdigest()[:24]
    return f"rab:{group}:v{cache_gen(group)}:{digest}"


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
    """Invalidate a group by bumping its generation. Stale keys expire via TTL.

    SCAN + DELETE used to sit on the 1.5s socket timeout after Daily RR writes
    and `_reset()` the client, so every later read hit Postgres.
    """
    client = get_redis()
    if client is None:
        return
    groups: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        group = _group_from_pattern(pattern)
        if not group or group in seen:
            continue
        seen.add(group)
        groups.append(group)
    if not groups:
        return
    try:
        pipe = client.pipeline()
        for group in groups:
            pipe.incr(f"rab:{group}:gen")
        pipe.execute()
    except redis.RedisError:
        _reset()


def deny_key(token: str, jti: str | None = None) -> str:
    if jti:
        return f"rab:auth:deny:{jti}"
    digest = hashlib.sha256(token.encode()).hexdigest()
    return f"rab:auth:deny:{digest}"


def is_revoked(token: str, payload: dict) -> bool:
    if cache_has(deny_key(token, payload.get("jti"))):
        return True
    staff_id = payload.get("sub")
    if staff_id and cache_has(f"rab:auth:staffdeny:{staff_id}"):
        denied_after = cache_get(f"rab:auth:staffdeny:{staff_id}")
        iat = int(payload.get("iat") or 0)
        if isinstance(denied_after, dict):
            return iat <= int(denied_after.get("at") or 0)
        return True
    return False


def revoke_token(token: str, payload: dict) -> None:
    exp = int(payload.get("exp") or 0)
    ttl = max(1, exp - int(time.time()))
    cache_set_raw(deny_key(token, payload.get("jti")), "1", ttl)


def revoke_staff_access(staff_id: str, ttl: int | None = None) -> None:
    cache_set(
        f"rab:auth:staffdeny:{staff_id}",
        {"at": int(time.time())},
        ttl or settings.jwt_expires_seconds,
    )


def worker_heartbeat(ttl: int = 90) -> None:
    cache_set_raw("rab:worker:heartbeat", str(int(time.time())), ttl)


def worker_up() -> bool:
    return cache_has("rab:worker:heartbeat")


def bust_members() -> None:
    cache_bust("rab:members:*", "rab:assignments:*", "rab:snapshot:*", "rab:reports:*")


def bust_tag_requests() -> None:
    cache_bust("rab:tag-requests:*", "rab:snapshot:*")


def bust_daily() -> None:
    cache_bust("rab:assignments:*", "rab:locks:*", "rab:snapshot:*", "rab:reports:*")


def bust_boro() -> None:
    cache_bust("rab:boro:*")


def bust_settings() -> None:
    cache_bust("rab:settings:*", "rab:snapshot:*")
