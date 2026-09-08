from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.assignments import parse_window, require_date
from app.services.state_reports import (
    approve_report,
    draft_snapshot,
    get_report,
    list_reports,
    reject_report,
    report_public,
    submit_report,
)

router = APIRouter(prefix="/state-reports", tags=["state-reports"])
DailyWrite = Annotated[Staff, Depends(require_roles("daily", "admin"))]


@router.get("/draft")
def get_draft(
    db: Annotated[Session, Depends(get_db)],
    _staff: DailyWrite,
    date: str,
) -> dict:
    return draft_snapshot(db, require_date(date))


@router.get("")
def get_reports(
    db: Annotated[Session, Depends(get_db)],
    _staff: DailyWrite,
    status: str | None = None,
    date: str | None = None,
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    page: int = Query(1),
    page_size: int = Query(25),
) -> dict:
    day = require_date(date) if date else None
    start = end = None
    if from_ or to:
        start, end = parse_window(month=None, start=from_, end=to, one=None)
    items, total, page, page_size = list_reports(
        db, status=status, day=day, start=start, end=end, page=page, page_size=page_size
    )
    return {
        "items": [report_public(r) for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
def post_report(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: DailyWrite,
) -> dict:
    return report_public(submit_report(db, require_date(body.get("date")), staff, request))


@router.get("/{report_id}")
def get_one(
    report_id: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: DailyWrite,
) -> dict:
    return report_public(get_report(db, report_id))


@router.post("/{report_id}/approve")
def post_approve(
    report_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("admin"))],
) -> dict:
    return report_public(approve_report(db, report_id, staff, request))


@router.post("/{report_id}/reject")
def post_reject(
    report_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("admin"))],
    body: dict | None = None,
) -> dict:
    note = (body or {}).get("note")
    return report_public(reject_report(db, report_id, staff, request, note))
