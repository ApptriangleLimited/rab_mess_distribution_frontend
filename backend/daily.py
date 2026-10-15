from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import current_staff, require_roles
from cache import bust_boro, bust_daily, cache_get, cache_key, cache_set
from database import get_db
from models import Assignment, BoroKhanaDay, DayLock, Member, Staff, SuppressedCarry
from schemas import normalize_tag
from wings import wing_family_names, wing_in_family

DAILY_WRITE = ("daily", "admin")
router = APIRouter()


def daily_day_writable(day: date) -> bool:
    """Today/future always writable. Past days only in the current month."""
    today = date.today()
    if day >= today:
        return True
    return day.year == today.year and day.month == today.month


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    import uuid

    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def envelope(data, message: str = "", status: int = 200):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        {"ok": True, "success": True, "message": message, "data": data},
        status_code=status,
    )


def parse_day(value: str, field: str = "date") -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field}") from exc


def each_date(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def resolve_range(
    month: str | None,
    date_from: str | None,
    date_to: str | None,
    single: str | None,
) -> tuple[date, date]:
    if single:
        day = parse_day(single)
        return day, day
    if date_from or date_to:
        start = parse_day(date_from or date_to or "", "from")
        end = parse_day(date_to or date_from or "", "to")
        if end < start:
            start, end = end, start
        return start, end
    if month:
        try:
            year, mon = month.split("-")
            start = date(int(year), int(mon), 1)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid month") from exc
        if mon == "12":
            end = date(int(year), 12, 31)
        else:
            end = date(int(year), int(mon) + 1, 1) - timedelta(days=1)
        return start, end
    raise HTTPException(status_code=400, detail="from/to or month is required")


def roster_start(member: Member) -> date | None:
    """First Daily RR day is the joining date, not the accept / duty-start day."""
    return member.joining_date


def is_before_join(member: Member, day: date) -> bool:
    start = roster_start(member)
    return bool(start and day < start)


def is_inactive_on(member: Member, day: date) -> bool:
    for span in member.inactive_spans or []:
        if not isinstance(span, dict) or not span.get("from"):
            continue
        try:
            span_from = date.fromisoformat(str(span["from"])[:10])
        except ValueError:
            continue
        if day < span_from:
            continue
        raw_to = span.get("to")
        if raw_to:
            try:
                end = date.fromisoformat(str(raw_to)[:10])
            except ValueError:
                continue
            if day > end:
                continue
        return True
    jl_end = (member.jl_end_date or "").strip()
    if jl_end:
        try:
            if day > date.fromisoformat(jl_end):
                return True
        except ValueError:
            pass
    if member.status != "1" and not (member.inactive_spans or []):
        return True
    return False


def can_assign(member: Member, day: date) -> bool:
    if member.member_type in ("guest", "civilian"):
        return False
    if is_before_join(member, day):
        return False
    if is_inactive_on(member, day):
        return False
    if member.out_date and day > member.out_date:
        return False
    return True


def is_mfr_locked(member: Member) -> bool:
    return (member.default_tag or "").upper() == "MFR"


def can_write_tag(member: Member, day: date, tag: str) -> bool:
    if not can_assign(member, day):
        return False
    if is_mfr_locked(member) and tag and tag not in ("MFR", "FR"):
        return False
    return True


def apply_mfr_default(member: Member, tag: str) -> None:
    if tag == "MFR":
        member.default_tag = "MFR"
    elif tag == "FR" and is_mfr_locked(member):
        member.default_tag = "FR"


def member_matches(
    member: Member,
    q: str | None,
    rank: str | None,
    wing: str | None,
    family: list[str] | None = None,
) -> bool:
    if member.approval_status != "approved":
        return False
    if member.member_type in ("guest", "civilian"):
        return False
    if rank and rank != "all" and member.rank != rank:
        return False
    if wing and wing != "all":
        if family:
            if not wing_in_family(member.wing, family):
                return False
        elif member.wing != wing:
            return False
    if q and q.strip():
        hay = " ".join(
            [
                member.name,
                member.rab_id,
                member.personal_id,
                member.rank,
                member.wing,
                member.phone,
            ]
        ).lower()
        if q.strip().lower() not in hay:
            return False
    return True


def project_cell(
    member: Member,
    day: date,
    stored: Assignment | None,
    suppressed: set[tuple[str, date]],
) -> dict:
    key = (member.id, day)
    if stored:
        return {
            "member_id": member.id,
            "date": day.isoformat(),
            "tag": stored.tag,
            "source": "stored",
            "trg_tone": stored.trg_tone,
            "updated_at": stored.updated_at.isoformat() if stored.updated_at else None,
            "updated_by": stored.updated_by,
        }
    if key in suppressed:
        return {
            "member_id": member.id,
            "date": day.isoformat(),
            "tag": None,
            "source": "suppressed",
        }
    if not can_assign(member, day):
        return {
            "member_id": member.id,
            "date": day.isoformat(),
            "tag": None,
            "source": "empty",
        }
    if is_mfr_locked(member):
        return {
            "member_id": member.id,
            "date": day.isoformat(),
            "tag": "MFR",
            "source": "carry",
        }
    default = (member.default_tag or "").upper()
    if default:
        return {
            "member_id": member.id,
            "date": day.isoformat(),
            "tag": default,
            "source": "carry",
        }
    return {
        "member_id": member.id,
        "date": day.isoformat(),
        "tag": None,
        "source": "empty",
    }


def load_window(
    db: Session,
    start: date,
    end: date,
    q: str | None,
    rank: str | None,
    wing: str | None,
    member_id: str | None = None,
    wing_family: str | None = None,
):
    query = db.query(Member)
    if member_id:
        query = query.filter(Member.id == member_id)
    family = None
    if wing and wing != "all" and str(wing_family or "").lower() in {"1", "true", "yes"}:
        family = wing_family_names(db, wing)
    members = [m for m in query.all() if member_matches(m, q, rank, wing, family)]
    ids = [m.id for m in members]
    stored_rows = []
    suppressed_rows = []
    if ids:
        stored_rows = (
            db.query(Assignment)
            .filter(
                Assignment.user_id.in_(ids),
                Assignment.date >= start,
                Assignment.date <= end,
            )
            .all()
        )
        suppressed_rows = (
            db.query(SuppressedCarry)
            .filter(
                SuppressedCarry.user_id.in_(ids),
                SuppressedCarry.date >= start,
                SuppressedCarry.date <= end,
            )
            .all()
        )
    stored_map = {(row.user_id, row.date): row for row in stored_rows}
    suppressed = {(row.user_id, row.date) for row in suppressed_rows}
    return members, stored_map, suppressed


def cells_for_member(
    member: Member,
    days: list[date],
    stored_map: dict,
    suppressed: set[tuple[str, date]],
) -> list[dict]:
    return [
        project_cell(member, day, stored_map.get((member.id, day)), suppressed)
        for day in days
    ]


def unlock_date(db: Session, day: date) -> None:
    db.query(DayLock).filter(DayLock.date == day).delete()


def set_suppressed(db: Session, user_id: str, day: date, on: bool) -> None:
    existing = db.get(SuppressedCarry, {"user_id": user_id, "date": day})
    if on and existing is None:
        db.add(SuppressedCarry(user_id=user_id, date=day))
    if not on and existing is not None:
        db.delete(existing)


def session_member_dates(db: Session, model, member_id: str) -> set[date]:
    """Dates already staged in this session (unflushed inserts/updates)."""
    dates: set[date] = set()
    for obj in list(db.new) + list(db.dirty):
        if isinstance(obj, model) and getattr(obj, "user_id", None) == member_id:
            day = getattr(obj, "date", None)
            if day is not None:
                dates.add(day)
    return dates


def freeze_prior_tags(db: Session, member: Member, before: date, staff: Staff) -> None:
    """Lock empty days before `before` as stored default tags so later paints cannot rewrite them."""
    default = (member.default_tag or "").upper()
    if not default or before <= date.min:
        return
    window_start = before - timedelta(days=90)
    start = roster_start(member)
    if start and start > window_start:
        window_start = start
    if window_start >= before:
        return
    last = before - timedelta(days=1)
    existing = {
        row.date
        for row in db.query(Assignment.date).filter(
            Assignment.user_id == member.id,
            Assignment.date >= window_start,
            Assignment.date <= last,
        )
    } | session_member_dates(db, Assignment, member.id)
    suppressed = {
        row.date
        for row in db.query(SuppressedCarry.date).filter(
            SuppressedCarry.user_id == member.id,
            SuppressedCarry.date >= window_start,
            SuppressedCarry.date <= last,
        )
    } | session_member_dates(db, SuppressedCarry, member.id)
    now = utcnow()
    for day in each_date(window_start, last):
        if day in existing or day in suppressed:
            continue
        if not can_assign(member, day):
            continue
        db.add(
            Assignment(
                id=new_id("a"),
                user_id=member.id,
                date=day,
                tag=default,
                updated_by=staff.id,
                updated_at=now,
            )
        )


def infer_trg_tone(force: str | None, trg_tone: str | None = None) -> str:
    if trg_tone in ("black", "red"):
        return trg_tone
    key = (force or "").strip().lower().replace("-", " ").replace("_", " ")
    if key in {"army", "navy", "air force", "police", "ansar"}:
        return "black"
    return "red"


def upsert_assignment(
    db: Session,
    member: Member,
    day: date,
    tag: str,
    staff: Staff,
    trg_tone: str | None = None,
) -> Assignment:
    freeze_prior_tags(db, member, day, staff)
    row = (
        db.query(Assignment)
        .filter(Assignment.user_id == member.id, Assignment.date == day)
        .first()
    )
    now = utcnow()
    tone = infer_trg_tone(member.force, trg_tone) if tag == "TRG" else None
    if row:
        row.tag = tag
        row.trg_tone = tone
        row.updated_by = staff.id
        row.updated_at = now
    else:
        row = Assignment(
            id=new_id("a"),
            user_id=member.id,
            date=day,
            tag=tag,
            trg_tone=tone,
            updated_by=staff.id,
            updated_at=now,
        )
        db.add(row)
    set_suppressed(db, member.id, day, False)
    unlock_date(db, day)
    apply_mfr_default(member, tag)
    member.updated_at = now
    return row


class AssignmentIn(BaseModel):
    member_id: str
    date: str
    tag: str
    trg_tone: str | None = None


class AssignmentRangeIn(BaseModel):
    member_id: str
    dates: list[str]
    tag: str = ""
    trg_tone: str | None = None


class BoroKhanaIn(BaseModel):
    on: bool


@router.get("/api/v1/assignments")
def list_assignments(
    month: str | None = None,
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    day: str | None = Query(None, alias="date"),
    member_id: str | None = None,
    rank: str | None = None,
    wing: str | None = None,
    wing_family: str | None = None,
    q: str | None = None,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    start, end = resolve_range(month, date_from, date_to, day)
    key = cache_key(
        "assignments",
        kind="list",
        start=start.isoformat(),
        end=end.isoformat(),
        member_id=member_id,
        rank=rank,
        wing=wing,
        wing_family=wing_family,
        q=q,
    )
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    members, stored_map, suppressed = load_window(
        db, start, end, q, rank, wing, member_id, wing_family
    )
    days = list(each_date(start, end))
    items = []
    for member in members:
        items.extend(cells_for_member(member, days, stored_map, suppressed))
    data = {"items": items, "from": start.isoformat(), "to": end.isoformat()}
    cache_set(key, data)
    return envelope(data)


@router.get("/api/v1/assignments/summary")
def assignment_summary(
    month: str | None = None,
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    day: str | None = Query(None, alias="date"),
    member_id: str | None = None,
    rank: str | None = None,
    wing: str | None = None,
    wing_family: str | None = None,
    q: str | None = None,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    start, end = resolve_range(month, date_from, date_to, day)
    key = cache_key(
        "assignments",
        kind="summary",
        start=start.isoformat(),
        end=end.isoformat(),
        member_id=member_id,
        rank=rank,
        wing=wing,
        wing_family=wing_family,
        q=q,
    )
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    members, stored_map, suppressed = load_window(
        db, start, end, q, rank, wing, member_id, wing_family
    )
    days = list(each_date(start, end))
    by_tag: dict[str, int] = {}
    tagged = 0
    for member in members:
        for cell in cells_for_member(member, days, stored_map, suppressed):
            if cell["source"] in ("stored", "carry") and cell["tag"]:
                by_tag[cell["tag"]] = by_tag.get(cell["tag"], 0) + 1
                tagged += 1
    data = {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "by_tag": by_tag,
        "total_tagged_person_days": tagged,
        "member_count": len(members),
    }
    cache_set(key, data)
    return envelope(data)


@router.put("/api/v1/assignments")
def put_assignment(
    body: AssignmentIn,
    staff: Staff = Depends(require_roles(*DAILY_WRITE)),
    db: Session = Depends(get_db),
):
    member = db.get(Member, body.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")
    day = parse_day(body.date)
    try:
        tag = normalize_tag(body.tag)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not daily_day_writable(day):
        raise HTTPException(status_code=409, detail="Previous tags cannot be changed")
    if not can_write_tag(member, day, tag):
        raise HTTPException(status_code=409, detail="Cannot assign tag on this date")
    row = upsert_assignment(db, member, day, tag, staff, body.trg_tone)
    db.commit()
    db.refresh(row)
    bust_daily()
    return envelope(
        {
            "items": [
                {
                    "member_id": row.user_id,
                    "date": row.date.isoformat(),
                    "tag": row.tag,
                    "source": "stored",
                    "trg_tone": row.trg_tone,
                    "updated_at": row.updated_at.isoformat(),
                    "updated_by": row.updated_by,
                }
            ]
        },
        "Tag updated",
    )


@router.delete("/api/v1/assignments")
def delete_assignment(
    member_id: str,
    day: str = Query(..., alias="date"),
    staff: Staff = Depends(require_roles(*DAILY_WRITE)),
    db: Session = Depends(get_db),
):
    member = db.get(Member, member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")
    target = parse_day(day)
    if not daily_day_writable(target):
        raise HTTPException(status_code=409, detail="Previous tags cannot be changed")
    if is_mfr_locked(member):
        raise HTTPException(status_code=409, detail="Cannot clear an MFR-locked member")
    if not can_assign(member, target):
        raise HTTPException(status_code=409, detail="Cannot clear tag on this date")
    freeze_prior_tags(db, member, target, staff)
    db.query(Assignment).filter(
        Assignment.user_id == member_id, Assignment.date == target
    ).delete()
    set_suppressed(db, member_id, target, True)
    unlock_date(db, target)
    member.updated_at = utcnow()
    db.commit()
    bust_daily()
    return envelope(
        {
            "items": [
                {
                    "member_id": member_id,
                    "date": target.isoformat(),
                    "tag": None,
                    "source": "suppressed",
                }
            ]
        },
        "Tag cleared",
    )


@router.put("/api/v1/assignments/range")
def put_assignment_range(
    body: AssignmentRangeIn,
    staff: Staff = Depends(require_roles(*DAILY_WRITE)),
    db: Session = Depends(get_db),
):
    member = db.get(Member, body.member_id)
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")
    tag = ""
    if body.tag.strip():
        try:
            tag = normalize_tag(body.tag)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    items = []
    updated = 0
    write_days = []
    for raw in body.dates:
        day = parse_day(raw)
        if not daily_day_writable(day):
            continue
        write_days.append(day)
    for day in write_days:
        if tag:
            if not can_write_tag(member, day, tag):
                continue
            row = upsert_assignment(db, member, day, tag, staff, body.trg_tone)
            items.append(
                {
                    "member_id": row.user_id,
                    "date": row.date.isoformat(),
                    "tag": row.tag,
                    "source": "stored",
                    "trg_tone": row.trg_tone,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else utcnow().isoformat(),
                    "updated_by": row.updated_by,
                }
            )
            updated += 1
        else:
            if is_mfr_locked(member) or not can_assign(member, day):
                continue
            db.query(Assignment).filter(
                Assignment.user_id == member.id, Assignment.date == day
            ).delete()
            set_suppressed(db, member.id, day, True)
            unlock_date(db, day)
            items.append(
                {
                    "member_id": member.id,
                    "date": day.isoformat(),
                    "tag": None,
                    "source": "suppressed",
                }
            )
            updated += 1
    member.updated_at = utcnow()
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not save this tag range",
        ) from exc
    bust_daily()
    return envelope({"updated": updated, "items": items}, "Range updated")


@router.post("/api/v1/days/{day}/approve")
def approve_day(
    day: str,
    staff: Staff = Depends(require_roles(*DAILY_WRITE)),
    db: Session = Depends(get_db),
):
    target = parse_day(day)
    members = [
        m
        for m in db.query(Member).all()
        if member_matches(m, None, None, None) and m.status == "1"
    ]
    stored = {
        (row.user_id, row.date): row
        for row in db.query(Assignment)
        .filter(Assignment.date == target, Assignment.user_id.in_([m.id for m in members] or ["_"]))
        .all()
    }
    suppressed = {
        (row.user_id, row.date)
        for row in db.query(SuppressedCarry)
        .filter(SuppressedCarry.date == target)
        .all()
    }
    filled = 0
    for member in members:
        if not can_assign(member, target):
            continue
        existing = stored.get((member.id, target))
        suppressed_here = (member.id, target) in suppressed
        if existing and not suppressed_here:
            continue
        fill = (member.default_tag or "").upper()
        if not fill:
            set_suppressed(db, member.id, target, False)
            continue
        upsert_assignment(db, member, target, fill, staff)
        filled += 1
    lock = db.get(DayLock, target)
    if lock is None:
        db.add(DayLock(date=target, locked_by=staff.id, locked_at=utcnow()))
    db.commit()
    bust_daily()
    return envelope({"date": target.isoformat(), "filled": filled, "locked": True})


@router.get("/api/v1/days/locks")
def list_locks(
    date_from: str = Query(..., alias="from"),
    date_to: str = Query(..., alias="to"),
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    start, end = resolve_range(None, date_from, date_to, None)
    key = cache_key("locks", start=start.isoformat(), end=end.isoformat())
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    rows = (
        db.query(DayLock)
        .filter(DayLock.date >= start, DayLock.date <= end)
        .all()
    )
    data = {
        "dates": [row.date.isoformat() for row in rows],
        "from": start.isoformat(),
        "to": end.isoformat(),
    }
    cache_set(key, data)
    return envelope(data)


@router.get("/api/v1/boro-khana")
def list_boro_khana(
    date_from: str = Query(..., alias="from"),
    date_to: str = Query(..., alias="to"),
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    start, end = resolve_range(None, date_from, date_to, None)
    key = cache_key("boro", start=start.isoformat(), end=end.isoformat())
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    rows = (
        db.query(BoroKhanaDay)
        .filter(BoroKhanaDay.date >= start, BoroKhanaDay.date <= end)
        .all()
    )
    data = {
        "dates": [row.date.isoformat() for row in rows],
        "from": start.isoformat(),
        "to": end.isoformat(),
    }
    cache_set(key, data)
    return envelope(data)


@router.put("/api/v1/boro-khana/{day}")
def set_boro_khana(
    day: str,
    body: BoroKhanaIn,
    staff: Staff = Depends(require_roles(*DAILY_WRITE)),
    db: Session = Depends(get_db),
):
    target = parse_day(day)
    existing = db.get(BoroKhanaDay, target)
    if body.on and existing is None:
        db.add(BoroKhanaDay(date=target, updated_at=utcnow()))
    if not body.on and existing is not None:
        db.delete(existing)
    db.commit()
    bust_boro()
    return envelope({"date": target.isoformat(), "on": body.on})
