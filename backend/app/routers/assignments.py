from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.assignments import (
    clear_assignment,
    normalize_duty_tag,
    paint,
    paint_range,
    parse_window,
    project,
    require_date,
    summary,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])
Write = Annotated[Staff, Depends(require_roles("daily", "admin"))]


@router.get("")
def get_assignments(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    month: str | None = None,
    date: str | None = None,
    member_id: str | None = None,
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
) -> dict:
    start, end = parse_window(month=month, start=from_, end=to, one=date)
    items = project(db, start=start, end=end, member_id=member_id, rank=rank, wing=wing, q=q)
    return {"items": items, "from": start.isoformat(), "to": end.isoformat()}


@router.get("/summary")
def get_summary(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    month: str | None = None,
    date: str | None = None,
    member_id: str | None = None,
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
) -> dict:
    start, end = parse_window(month=month, start=from_, end=to, one=date)
    items = project(db, start=start, end=end, member_id=member_id, rank=rank, wing=wing, q=q)
    member_ids = {c["member_id"] for c in items}
    return summary(items, start, end, len(member_ids))


@router.put("")
def put_assignment(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
    force: bool = Query(False),
) -> dict:
    tag = normalize_duty_tag(body.get("tag"))
    day = require_date(body.get("date"))
    member_id = str(body.get("member_id") or "").strip()
    if not member_id:
        from app.errors import AppError, FieldError

        raise AppError(400, "VALIDATION_ERROR", "member_id required", [FieldError("member_id", "required", "Required")])
    cell = paint(db, member_id=member_id, day=day, tag=tag, staff=staff, body=body, request=request, force=force)
    return {"items": [cell]}


@router.put("/range")
def put_range(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
    force: bool = Query(False),
) -> dict:
    tag = normalize_duty_tag(body.get("tag"))
    member_id = str(body.get("member_id") or "").strip()
    dates = body.get("dates") or []
    if not member_id:
        from app.errors import AppError, FieldError

        raise AppError(400, "VALIDATION_ERROR", "member_id required", [FieldError("member_id", "required", "Required")])
    return paint_range(
        db,
        member_id=member_id,
        dates=[str(d) for d in dates],
        tag=tag,
        staff=staff,
        body=body,
        request=request,
        force=force,
    )


@router.delete("")
def delete_assignment(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
    member_id: str = Query(...),
    date: str = Query(...),
    force: bool = Query(False),
) -> dict:
    cell = clear_assignment(
        db, member_id=member_id, day=require_date(date), staff=staff, request=request, force=force
    )
    return {"items": [cell]}
