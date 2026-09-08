from datetime import date, datetime, timezone

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.dates import iso_z, parse_date, tz
from app.domain.ids import new_id
from app.domain.shifts import (
    BUILTIN_SHIFT_NAMES,
    assert_window,
    is_builtin_shift,
    normalize_name,
    normalize_time,
    plan_id_for,
    windows_overlap,
)
from app.errors import AppError
from app.metrics import ZK_INGEST
from app.models.kitchen import GuestMeal, MealAssign, MealPlan, MealShift
from app.models.member import Member
from app.services.assignments import require_date
from app.services.members import PAGE_SIZES


def parse_iso_dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _require_iso_dt(value: str | None, field: str = "check_in_time") -> datetime:
    parsed = parse_iso_dt(value)
    if parsed is None:
        raise AppError(400, "VALIDATION_ERROR", "Invalid datetime", [{"field": field, "code": "invalid", "message": "Use ISO-8601"}])
    return parsed


def shift_public(row: MealShift) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "description": row.description or "",
        "created_at": iso_z(row.created_at),
        "updated_at": iso_z(row.updated_at),
    }


def plan_public(row: MealPlan) -> dict:
    return {
        "id": row.id,
        "date": row.date.isoformat(),
        "meals": list(row.meals or []),
        "created_at": iso_z(row.created_at),
        "updated_at": iso_z(row.updated_at),
    }


def assign_public(row: MealAssign) -> dict:
    return {
        "id": row.id,
        "member_id": row.member_id,
        "shift_id": row.shift_id,
        "status": int(row.status),
        "date": row.date.isoformat(),
        "check_in_time": iso_z(row.check_in_time),
        "created_at": iso_z(row.created_at),
        "updated_at": iso_z(row.updated_at),
    }


def guest_public(row: GuestMeal) -> dict:
    return {
        "id": row.id,
        "shift_id": row.shift_id,
        "date": row.date.isoformat(),
        "check_in_time": iso_z(row.check_in_time),
        "guest_name": row.guest_name,
        "guest_info": row.guest_info,
        "ref_info": row.ref_info,
        "created_at": iso_z(row.created_at),
        "updated_at": iso_z(row.updated_at),
    }


def list_shifts(db: Session) -> list[MealShift]:
    rows = db.query(MealShift).all()
    return sorted(rows, key=lambda s: (s.start_time, s.name.lower()))


def _assert_unique_name(db: Session, name: str, except_id: str | None = None) -> None:
    key = name.lower()
    for row in db.query(MealShift).all():
        if except_id and row.id == except_id:
            continue
        if row.name.lower() == key:
            raise AppError(400, "NAME_TAKEN", "Shift name already exists")


def _assert_no_overlap(db: Session, start: str, end: str, except_id: str | None = None) -> None:
    for row in db.query(MealShift).all():
        if except_id and row.id == except_id:
            continue
        if windows_overlap(start, end, row.start_time, row.end_time):
            raise AppError(400, "OVERLAP", "Shift overlaps another window")


def create_shift(db: Session, body: dict) -> MealShift:
    name = normalize_name(body.get("name"))
    if not name:
        raise AppError(400, "EMPTY_NAME", "Name is required")
    start = normalize_time(body.get("start_time"))
    end = normalize_time(body.get("end_time"))
    assert_window(start, end)
    _assert_unique_name(db, name)
    _assert_no_overlap(db, start, end)
    row = MealShift(
        id=new_id("sh_"),
        name=name,
        start_time=start,
        end_time=end,
        description=str(body.get("description") or "").strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_shift(db: Session, shift_id: str, body: dict) -> MealShift:
    row = db.get(MealShift, shift_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Shift not found")
    name = BUILTIN_SHIFT_NAMES[shift_id] if is_builtin_shift(shift_id) else normalize_name(body.get("name"))
    if not name:
        raise AppError(400, "EMPTY_NAME", "Name is required")
    start = normalize_time(body.get("start_time"))
    end = normalize_time(body.get("end_time"))
    assert_window(start, end)
    _assert_unique_name(db, name, except_id=shift_id)
    _assert_no_overlap(db, start, end, except_id=shift_id)
    row.name = name
    row.start_time = start
    row.end_time = end
    row.description = str(body.get("description") or "").strip()
    db.commit()
    db.refresh(row)
    return row


def _shift_in_use(db: Session, shift_id: str) -> bool:
    if db.query(MealAssign).filter(MealAssign.shift_id == shift_id).first():
        return True
    if db.query(GuestMeal).filter(GuestMeal.shift_id == shift_id).first():
        return True
    for plan in db.query(MealPlan).all():
        for meal in plan.meals or []:
            if isinstance(meal, dict) and meal.get("shift_id") == shift_id:
                return True
    return False


def delete_shift(db: Session, shift_id: str) -> None:
    row = db.get(MealShift, shift_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Shift not found")
    if is_builtin_shift(shift_id):
        raise AppError(409, "BUILTIN", "Cannot delete a builtin shift")
    if _shift_in_use(db, shift_id):
        raise AppError(409, "IN_USE", "Shift is referenced by a plan or punch")
    db.delete(row)
    db.commit()


def _known_shift_ids(db: Session) -> list[str]:
    return [s.id for s in list_shifts(db)]


def clean_meals(db: Session, raw: list | None) -> list[dict]:
    by_shift: dict[str, int] = {}
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        shift_id = str(item.get("shift_id") or "").strip()
        try:
            count = int(item.get("count"))
        except (TypeError, ValueError):
            continue
        if not shift_id or count <= 0:
            continue
        by_shift[shift_id] = count
    known = _known_shift_ids(db)
    return [{"shift_id": shift_id, "count": by_shift[shift_id]} for shift_id in known if shift_id in by_shift]


def _require_meals(db: Session, raw: list | None) -> list[dict]:
    meals = clean_meals(db, raw)
    if not meals:
        raise AppError(400, "EMPTY", "Plan has no meals")
    return meals


def list_plans(db: Session, start: date, end: date) -> list[MealPlan]:
    return (
        db.query(MealPlan)
        .filter(MealPlan.date >= start, MealPlan.date <= end)
        .order_by(MealPlan.date.desc())
        .all()
    )


def get_plan(db: Session, day: date) -> MealPlan:
    row = db.query(MealPlan).filter(MealPlan.date == day).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Meal plan not found")
    return row


def create_plan(db: Session, body: dict) -> MealPlan:
    day = require_date(body.get("date"))
    meals = _require_meals(db, body.get("meals"))
    if db.query(MealPlan).filter(MealPlan.date == day).one_or_none():
        raise AppError(409, "CONFLICT", "A plan already exists for this date")
    row = MealPlan(id=plan_id_for(day), date=day, meals=meals)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_plan(db: Session, day: date, body: dict) -> MealPlan:
    row = get_plan(db, day)
    row.meals = _require_meals(db, body.get("meals"))
    db.commit()
    db.refresh(row)
    return row


def delete_plan(db: Session, day: date) -> str:
    row = get_plan(db, day)
    db.delete(row)
    db.commit()
    return day.isoformat()


def _page(page: int, page_size: int) -> tuple[int, int]:
    if page < 1:
        page = 1
    if page_size not in PAGE_SIZES:
        page_size = 25
    return page, page_size


def list_assigns(
    db: Session,
    *,
    start: date,
    end: date,
    shift_id: str | None = None,
    status: str | None = None,
    member_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[MealAssign], int, int, int]:
    page, page_size = _page(page, page_size)
    query = db.query(MealAssign).filter(MealAssign.date >= start, MealAssign.date <= end)
    if shift_id:
        query = query.filter(MealAssign.shift_id == shift_id)
    if member_id:
        query = query.filter(MealAssign.member_id == member_id)
    if status in {"1", "2"}:
        query = query.filter(MealAssign.status == int(status))
    total = query.count()
    rows = (
        query.order_by(MealAssign.check_in_time.desc(), MealAssign.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total, page, page_size


def list_guests(
    db: Session,
    *,
    start: date,
    end: date,
    shift_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[GuestMeal], int, int, int]:
    page, page_size = _page(page, page_size)
    query = db.query(GuestMeal).filter(GuestMeal.date >= start, GuestMeal.date <= end)
    if shift_id:
        query = query.filter(GuestMeal.shift_id == shift_id)
    total = query.count()
    rows = (
        query.order_by(GuestMeal.check_in_time.desc(), GuestMeal.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total, page, page_size


def _resolve_member(db: Session, body: dict) -> Member:
    member_id = str(body.get("member_id") or "").strip()
    if member_id:
        member = db.get(Member, member_id)
        if member is None:
            raise AppError(404, "NOT_FOUND", "Member not found")
        return member
    token = str(body.get("rfid") or body.get("zk_user_id") or "").strip()
    if not token:
        raise AppError(400, "VALIDATION_ERROR", "member_id, rfid, or zk_user_id required")
    member = (
        db.query(Member)
        .filter(
            or_(
                Member.rfid == token,
                Member.id == token,
                Member.personal_id == token,
                Member.rab_id == token,
            )
        )
        .first()
    )
    if member is None:
        raise AppError(404, "NOT_FOUND", "Member not found")
    return member


def ingest_assign(db: Session, body: dict) -> MealAssign:
    shift_id = str(body.get("shift_id") or "").strip()
    if not shift_id or db.get(MealShift, shift_id) is None:
        raise AppError(404, "NOT_FOUND", "Shift not found")
    member = _resolve_member(db, body)
    punched = parse_iso_dt(body.get("check_in_time")) or datetime.now(timezone.utc)
    day = parse_date(body.get("date"))
    if day is None:
        day = punched.astimezone(tz()).date()
    existing = (
        db.query(MealAssign)
        .filter(
            MealAssign.member_id == member.id,
            MealAssign.shift_id == shift_id,
            MealAssign.date == day,
            MealAssign.check_in_time == punched,
        )
        .one_or_none()
    )
    if existing is not None:
        ZK_INGEST.labels("existing").inc()
        return existing
    prior = (
        db.query(MealAssign)
        .filter(
            MealAssign.member_id == member.id,
            MealAssign.shift_id == shift_id,
            MealAssign.date == day,
        )
        .count()
    )
    status = 1 if prior == 0 else 2
    row = MealAssign(
        id=new_id("ma_"),
        member_id=member.id,
        shift_id=shift_id,
        status=status,
        date=day,
        check_in_time=punched,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        again = (
            db.query(MealAssign)
            .filter(
                MealAssign.member_id == member.id,
                MealAssign.shift_id == shift_id,
                MealAssign.date == day,
                MealAssign.check_in_time == punched,
            )
            .one_or_none()
        )
        if again is None:
            raise
        ZK_INGEST.labels("existing").inc()
        return again
    db.refresh(row)
    ZK_INGEST.labels(str(status)).inc()
    return row
