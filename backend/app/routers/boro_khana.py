from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.assignments import list_boro, parse_window, require_date, set_boro

router = APIRouter(prefix="/boro-khana", tags=["boro-khana"])


@router.get("")
def get_boro(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
) -> dict:
    start, end = parse_window(month=None, start=from_, end=to, one=None)
    return {"dates": list_boro(db, start, end), "from": start.isoformat(), "to": end.isoformat()}


@router.put("/{day}")
def put_boro(
    day: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
) -> dict:
    return set_boro(db, require_date(day), bool(body.get("on")), staff, request)
