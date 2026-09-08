from datetime import date

from sqlalchemy.orm import Session

from app.domain.assign import actor_name
from app.domain.dates import iso_z, month_bounds
from app.errors import AppError, FieldError
from app.metrics import ASSIGNMENT_WRITES, MONTH_CLOSED
from app.models.settings import AllowanceRate, ClosedMonth
from app.models.staff import Staff
from app.services.audit import record_audit
from app.services.rates import list_rate_rows


def require_month(value: str) -> str:
    text = (value or "").strip()
    try:
        month_bounds(text)
    except AppError:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid month",
            [FieldError("month", "invalid", "Use YYYY-MM")],
        ) from None
    return text


def month_of(day: date) -> str:
    return f"{day.year:04d}-{day.month:02d}"


def get_closed(db: Session, month: str) -> ClosedMonth | None:
    return db.get(ClosedMonth, month)


def is_month_closed(db: Session, month: str) -> bool:
    return get_closed(db, month) is not None


def rate_map_for_month(db: Session, month: str) -> dict:
    from decimal import Decimal

    closed = get_closed(db, month)
    if closed and closed.rates_snapshot:
        return {str(k).upper(): Decimal(str(v)) for k, v in closed.rates_snapshot.items()}
    return {r.tag.upper(): Decimal(r.amount_per_day) for r in db.query(AllowanceRate).all()}


def snapshot_rates(db: Session) -> dict:
    return {r["tag"]: r["amount_per_day"] for r in list_rate_rows(db, use_cache=False)}


def closed_public(row: ClosedMonth) -> dict:
    return {
        "month": row.month,
        "closed": True,
        "closed_at": iso_z(row.closed_at),
        "closed_by": row.closed_by,
        "rates_snapshot": row.rates_snapshot or {},
    }


def close_month(db: Session, month: str, staff: Staff, request) -> dict:
    month = require_month(month)
    if get_closed(db, month):
        raise AppError(409, "CONFLICT", "Month is already closed")
    row = ClosedMonth(
        month=month,
        closed_by=actor_name(staff),
        rates_snapshot=snapshot_rates(db),
    )
    db.add(row)
    record_audit(
        db,
        staff=staff,
        action="month.close",
        entity_type="month",
        entity_id=month,
        after={"rates": row.rates_snapshot},
        request=request,
    )
    db.commit()
    db.refresh(row)
    MONTH_CLOSED.labels(month).set(1)
    return closed_public(row)


def reopen_month(db: Session, month: str, staff: Staff, request) -> dict:
    month = require_month(month)
    row = get_closed(db, month)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Month is not closed")
    before = closed_public(row)
    db.delete(row)
    record_audit(
        db,
        staff=staff,
        action="month.reopen",
        entity_type="month",
        entity_id=month,
        before=before,
        request=request,
    )
    db.commit()
    MONTH_CLOSED.labels(month).set(0)
    return {"month": month, "closed": False}


def assert_months_writable(
    db: Session,
    days: list[date],
    staff: Staff,
    *,
    force: bool = False,
    request=None,
) -> None:
    months = sorted({month_of(day) for day in days})
    blocked = [m for m in months if is_month_closed(db, m)]
    if not blocked:
        return
    if force and staff.role == "admin":
        record_audit(
            db,
            staff=staff,
            action="month.force_write",
            entity_type="month",
            entity_id=",".join(blocked),
            after={"force": True},
            request=request,
        )
        return
    ASSIGNMENT_WRITES.labels("month_closed").inc()
    raise AppError(403, "MONTH_CLOSED", f"Month {blocked[0]} is closed")


def require_closed_month(db: Session, month: str) -> ClosedMonth:
    month = require_month(month)
    row = get_closed(db, month)
    if row is None:
        raise AppError(409, "MONTH_OPEN", "Close the month before ration letters")
    return row
