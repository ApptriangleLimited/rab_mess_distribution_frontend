from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models.staff import Staff
from app.security.deps import get_current_staff
from app.security.passwords import verify_password
from app.security.tokens import create_access_token, token_ttl_seconds
from app.services.rate_limit import enforce_login_limit
from app.services.session import deny_jti
from app.services.staff_admin import staff_public

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@router.post("/login")
def login(body: LoginBody, request: Request, db: Annotated[Session, Depends(get_db)]) -> dict:
    email = body.email.strip().lower()
    enforce_login_limit(_client_ip(request), email)

    staff = db.query(Staff).filter(Staff.email == email).one_or_none()
    if (
        staff is None
        or not staff.active
        or not verify_password(staff.password_hash, body.password)
    ):
        raise AppError(401, "INVALID_CREDENTIALS", "Invalid email or password")

    token, _jti, expires_in = create_access_token(staff_id=staff.id, role=staff.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "staff": staff_public(staff),
    }


@router.post("/logout")
def logout(request: Request, staff: Annotated[Staff, Depends(get_current_staff)]) -> Response:
    payload = getattr(request.state, "jwt_payload", None) or {}
    jti = getattr(request.state, "jwt_jti", "") or str(payload.get("jti") or "")
    if jti:
        deny_jti(jti, token_ttl_seconds(payload) if payload else get_settings().jwt_expires_in)
    return Response(status_code=204)


@router.get("/me")
def me(staff: Annotated[Staff, Depends(get_current_staff)]) -> dict:
    return staff_public(staff, with_active=True)
