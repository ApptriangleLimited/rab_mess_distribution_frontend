from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models.staff import Staff
from app.security.tokens import decode_access_token, is_invalid_token
from app.services.session import is_denied


def _bearer(request: Request) -> str:
    header = request.headers.get("authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise AppError(401, "UNAUTHORIZED", "Missing bearer token")
    return token.strip()


def get_current_staff(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> Staff:
    token = _bearer(request)
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        if is_invalid_token(exc):
            raise AppError(401, "UNAUTHORIZED", "Invalid or expired token") from exc
        raise AppError(401, "UNAUTHORIZED", "Invalid or expired token") from exc

    jti = str(payload.get("jti") or "")
    if not jti or is_denied(jti):
        raise AppError(401, "UNAUTHORIZED", "Invalid or expired token")

    staff_id = str(payload.get("sub") or "")
    staff = db.get(Staff, staff_id) if staff_id else None
    if staff is None or not staff.active:
        raise AppError(401, "UNAUTHORIZED", "Invalid or expired token")

    request.state.staff = staff
    request.state.jwt_jti = jti
    request.state.jwt_payload = payload
    return staff


def require_roles(*roles: str):
    def _check(staff: Annotated[Staff, Depends(get_current_staff)]) -> Staff:
        if staff.role not in roles:
            raise AppError(403, "FORBIDDEN", "Role not allowed")
        return staff

    return _check
