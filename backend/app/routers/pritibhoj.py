from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.assignments import parse_window
from app.services.pritibhoj import create_event, delete_event, event_public, get_event, list_events, update_event

router = APIRouter(prefix="/pritibhoj", tags=["pritibhoj"])
Write = Annotated[Staff, Depends(require_roles("mess", "admin"))]


@router.get("")
def get_events(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    q: str | None = None,
    page: int = Query(1),
    page_size: int = Query(25),
) -> dict:
    start = end = None
    if from_ and to:
        start, end = parse_window(month=None, start=from_, end=to, one=None)
    items, total, page, page_size = list_events(db, start=start, end=end, q=q, page=page, page_size=page_size)
    return {
        "items": [event_public(r) for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{event_id}")
def get_one(
    event_id: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return event_public(get_event(db, event_id))


@router.post("", status_code=201)
def post_event(
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    _staff: Write,
) -> dict:
    return event_public(create_event(db, body))


@router.put("/{event_id}")
def put_event(
    event_id: str,
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    _staff: Write,
) -> dict:
    return event_public(update_event(db, event_id, body))


@router.delete("/{event_id}")
def remove_event(
    event_id: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: Write,
) -> dict:
    return {"id": delete_event(db, event_id)}
