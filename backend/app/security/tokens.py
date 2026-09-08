from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from jwt.exceptions import InvalidTokenError

from app.config import get_settings


def create_access_token(*, staff_id: str, role: str) -> tuple[str, str, int]:
    settings = get_settings()
    expires_in = settings.jwt_expires_in
    jti = str(uuid4())
    now = datetime.now(timezone.utc)
    payload = {
        "sub": staff_id,
        "role": role,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, jti, expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def token_ttl_seconds(payload: dict[str, Any]) -> int:
    exp = int(payload.get("exp") or 0)
    now = int(datetime.now(timezone.utc).timestamp())
    return max(1, exp - now)


def is_invalid_token(exc: Exception) -> bool:
    return isinstance(exc, InvalidTokenError)
