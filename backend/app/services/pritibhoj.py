from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.domain.dates import iso_z
from app.domain.ids import new_id
from app.domain.pritibhoj import lock_sheets
from app.errors import AppError
from app.models.settings import PritibhojEvent
from app.services.assignments import require_date
from app.services.members import PAGE_SIZES


def event_public(row: PritibhojEvent) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "occasion": row.occasion,
        "date": row.date.isoformat(),
        "org": row.org,
        "created_at": iso_z(row.created_at),
        "main_rows": list(row.main_rows or []),
        "admin_rows": list(row.admin_rows or []),
    }


def _normalize(body: dict) -> tuple[str, str, object, str, list, list]:
    title = str(body.get("title") or "").strip()
    if not title:
        raise AppError(400, "VALIDATION_ERROR", "title required")
    day = require_date(body.get("date"))
    occasion = str(body.get("occasion") or "").strip()
    org = str(body.get("org") or "").strip()
    main, admin = lock_sheets(body.get("main_rows"), body.get("admin_rows"))
    return title, occasion, day, org, main, admin


def list_events(
    db: Session,
    *,
    start=None,
    end=None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[PritibhojEvent], int, int, int]:
    if page < 1:
        page = 1
    if page_size not in PAGE_SIZES:
        page_size = 25
    query = db.query(PritibhojEvent)
    if start and end:
        query = query.filter(PritibhojEvent.date >= start, PritibhojEvent.date <= end)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(PritibhojEvent.title).like(like),
                func.lower(PritibhojEvent.occasion).like(like),
                func.lower(PritibhojEvent.org).like(like),
            )
        )
    total = query.count()
    rows = (
        query.order_by(PritibhojEvent.date.desc(), PritibhojEvent.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total, page, page_size


def get_event(db: Session, event_id: str) -> PritibhojEvent:
    row = db.get(PritibhojEvent, event_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Pritibhoj event not found")
    return row


def create_event(db: Session, body: dict) -> PritibhojEvent:
    title, occasion, day, org, main, admin = _normalize(body)
    row = PritibhojEvent(
        id=new_id("pb_"),
        title=title,
        occasion=occasion,
        date=day,
        org=org,
        main_rows=main,
        admin_rows=admin,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_event(db: Session, event_id: str, body: dict) -> PritibhojEvent:
    row = get_event(db, event_id)
    title, occasion, day, org, main, admin = _normalize(body)
    row.title = title
    row.occasion = occasion
    row.date = day
    row.org = org
    row.main_rows = main
    row.admin_rows = admin
    db.commit()
    db.refresh(row)
    return row


def delete_event(db: Session, event_id: str) -> str:
    row = get_event(db, event_id)
    db.delete(row)
    db.commit()
    return event_id
