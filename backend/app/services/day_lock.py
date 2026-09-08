from redis.exceptions import RedisError

from app.redis_client import get_redis


def try_day_lock(day: str) -> None:
    try:
        get_redis().set(f"lock:day:{day}", "1", nx=True, ex=5)
    except RedisError:
        return


def release_day_lock(day: str) -> None:
    try:
        get_redis().delete(f"lock:day:{day}")
    except RedisError:
        return
