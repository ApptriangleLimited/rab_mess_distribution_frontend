from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import require_roles
from app.services.month_close import close_month, reopen_month

router = APIRouter(prefix="/months", tags=["months"])


@router.post("/{month}/close")
def post_close(
    month: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("ration", "admin"))],
) -> dict:
    return close_month(db, month, staff, request)


@router.post("/{month}/reopen")
def post_reopen(
    month: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("admin"))],
) -> dict:
    return reopen_month(db, month, staff, request)
