from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain.members import register_public
from app.services.members import create_member
from app.services.qr_token import verify_register_token
from app.services.rate_limit import enforce_register_limit

router = APIRouter(tags=["register"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@router.post("/public/register", status_code=201)
def public_register(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    token: str | None = Query(None),
) -> dict:
    verify_register_token(token)
    enforce_register_limit(_client_ip(request))
    member = create_member(db, body, public=True, staff=None, request=request)
    return register_public(member)
