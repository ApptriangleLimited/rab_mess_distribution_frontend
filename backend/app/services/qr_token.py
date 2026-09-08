import base64
import hashlib
import hmac
import time

from app.config import get_settings
from app.errors import AppError


def _secret() -> bytes:
    settings = get_settings()
    return (settings.qr_secret or settings.jwt_secret).encode()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def mint_register_token(ttl_seconds: int | None = None) -> dict:
    settings = get_settings()
    ttl = ttl_seconds if ttl_seconds is not None else settings.qr_ttl_seconds
    exp = int(time.time()) + int(ttl)
    msg = f"register:{exp}".encode()
    sig = hmac.new(_secret(), msg, hashlib.sha256).hexdigest()
    token = _b64(f"{exp}.{sig}".encode())
    return {
        "token": token,
        "expires_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(exp)),
        "url": f"/register?token={token}",
        "ttl_seconds": int(ttl),
    }


def verify_register_token(token: str | None) -> None:
    settings = get_settings()
    raw = (token or "").strip()
    if not raw:
        if settings.register_token_required:
            raise AppError(403, "QR_TOKEN_REQUIRED", "Register QR token required")
        return
    try:
        decoded = _unb64(raw).decode()
        exp_s, sig = decoded.split(".", 1)
        exp = int(exp_s)
    except (ValueError, UnicodeDecodeError) as exc:
        raise AppError(400, "QR_TOKEN_INVALID", "Invalid register token") from exc
    if exp < int(time.time()):
        raise AppError(400, "QR_TOKEN_EXPIRED", "Register token expired")
    expected = hmac.new(_secret(), f"register:{exp}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise AppError(400, "QR_TOKEN_INVALID", "Invalid register token")
