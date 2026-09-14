from fastapi import HTTPException, Request

from cache import get_redis
from config import settings


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def hit_limit(key: str, limit: int, window_seconds: int) -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        current = client.incr(key)
        if current == 1:
            client.expire(key, window_seconds)
        return int(current) > limit
    except Exception:
        return False


def reset_limit(key: str) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.delete(key)
    except Exception:
        return


def enforce_login_limits(request: Request, email: str) -> None:
    ip = client_ip(request)
    ip_key = f"rab:rl:login:ip:{ip}"
    email_key = f"rab:rl:login:email:{email.lower()}"
    if hit_limit(ip_key, settings.login_fail_limit * 3, settings.login_fail_window):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    if hit_limit(email_key, settings.login_fail_limit, settings.login_fail_window):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")


def clear_login_limits(request: Request, email: str) -> None:
    reset_limit(f"rab:rl:login:email:{email.lower()}")
    reset_limit(f"rab:rl:login:ip:{client_ip(request)}")


def enforce_register_limit(request: Request) -> None:
    key = f"rab:rl:register:ip:{client_ip(request)}"
    if hit_limit(key, settings.register_limit, settings.register_window):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Try again later.")


def enforce_reset_limit(request: Request, identifier: str) -> None:
    ip = client_ip(request)
    if hit_limit(f"rab:rl:reset:ip:{ip}", settings.reset_limit * 3, settings.reset_window):
        raise HTTPException(status_code=429, detail="Too many reset attempts. Try again later.")
    if hit_limit(
        f"rab:rl:reset:id:{identifier.lower()}",
        settings.reset_limit,
        settings.reset_window,
    ):
        raise HTTPException(status_code=429, detail="Too many reset attempts. Try again later.")
