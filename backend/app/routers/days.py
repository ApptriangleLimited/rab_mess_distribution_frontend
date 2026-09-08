from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.assignments import approve_day, list_locks, parse_window

router = APIRouter(prefix="/days", tags=["days"])


@router.post("/{day}/approve")
def post_approve(
    day: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
    force: bool = Query(False),
) -> dict:
    start, _end = parse_window(month=None, start=None, end=None, one=day)
    return approve_day(db, start, staff, request, force=force)


@router.get("/locks")
def get_locks(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
) -> dict:
    start, end = parse_window(month=None, start=from_, end=to, one=None)
    return {"dates": list_locks(db, start, end), "from": start.isoformat(), "to": end.isoformat()}
