from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
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
    active = member.status == "1"
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
        if not raw_to:
            # Open span means still inactive. An Active member must not keep it.
            if active:
                continue
            return True
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


def _span_covers(spans, day: date) -> bool:
    for span in spans or []:
        if not isinstance(span, dict) or not span.get("from"):
            continue
        try:
            start = date.fromisoformat(str(span["from"])[:10])
        except ValueError:
            continue
        if day < start:
            continue
        raw_to = span.get("to")
        if not raw_to:
            return True
        try:
            end = date.fromisoformat(str(raw_to)[:10])
        except ValueError:
            continue
        if day <= end:
            return True
    return False


def _ensure_open_inactive(member: Member, start: date) -> None:
    spans = [span for span in (member.inactive_spans or []) if isinstance(span, dict)]
    if any(not span.get("to") for span in spans):
        return
    spans.append({"from": start.isoformat(), "to": None})
    member.inactive_spans = spans


def _clear_tags_after(db: Session, member_id: str, last: date) -> int:
    removed = (
        db.query(Assignment)
        .filter(Assignment.user_id == member_id, Assignment.date > last)
        .delete(synchronize_session=False)
    )
    removed += (
        db.query(SuppressedCarry)
        .filter(SuppressedCarry.user_id == member_id, SuppressedCarry.date > last)
        .delete(synchronize_session=False)
    )
    return int(removed or 0)


def sync_member_after_jl(
    db: Session,
    member: Member,
    last: date | None,
    today: date | None = None,
) -> bool:
    """After the last JL day, later cells stay empty. Once that day has passed, the member is inactive."""
    today = today or date.today()
    if last is None:
        if (member.jl_end_date or "").strip():
            member.jl_end_date = ""
            member.updated_at = utcnow()
            return True
        return False
    if today > last:
        start = last + timedelta(days=1)
        # Already inactive, or turned active again after this JL block.
        if member.status == "0" and not (member.jl_end_date or "").strip():
            return False
        if member.status == "1" and _span_covers(member.inactive_spans, start):
            if (member.jl_end_date or "").strip():
                member.jl_end_date = ""
                member.updated_at = utcnow()
                return True
            return False
        member.status = "0"
        member.jl_end_date = ""
        _ensure_open_inactive(member, start)
        _clear_tags_after(db, member.id, last)
        member.updated_at = utcnow()
        return True
    iso = last.isoformat()
    changed = (member.jl_end_date or "") != iso
    if changed:
        member.jl_end_date = iso
        member.updated_at = utcnow()
    removed = _clear_tags_after(db, member.id, last)
    return changed or removed > 0


def sync_member_jl(db: Session, member: Member) -> bool:
    db.flush()
    last = (
        db.query(func.max(Assignment.date))
        .filter(Assignment.user_id == member.id, func.upper(Assignment.tag) == "JL")
        .scalar()
    )
    return sync_member_after_jl(db, member, last)


def sync_due_jl(db: Session) -> bool:
    """Heal members whose JL has already ended but who are still carrying MS."""
    pairs = (
        db.query(Assignment.user_id, func.max(Assignment.date))
        .filter(func.upper(Assignment.tag) == "JL")
        .group_by(Assignment.user_id)
        .all()
    )
    changed = False
    today = date.today()
    if pairs:
        ids = [user_id for user_id, _last in pairs]
        members = {
            row.id: row
            for row in db.query(Member).filter(Member.id.in_(ids)).all()
        }
        for user_id, last in pairs:
            member = members.get(user_id)
            if member is None:
                continue
            if sync_member_after_jl(db, member, last, today):
                changed = True
    leftovers = (
        db.query(Member)
        .filter(Member.jl_end_date != "")
        .all()
    )
    seen = {user_id for user_id, _last in pairs}
    for member in leftovers:
        if member.id in seen:
            continue
        if sync_member_after_jl(db, member, None, today):
            changed = True
    return changed


def member_jl_state(member: Member) -> dict:
    return {
        "id": member.id,
        "status": member.status if member.status in ("0", "1") else "1",
        "jl_end_date": member.jl_end_date or "",
        "inactive_spans": member.inactive_spans or [],
    }


def empty_cells_after(member_id: str, last: date | None) -> list[dict]:
    if last is None:
        return []
    start = last + timedelta(days=1)
    anchors = [last, date.today()]
    end = start
    for anchor in anchors:
        if anchor.month == 12:
            month_end = date(anchor.year, 12, 31)
        else:
            month_end = date(anchor.year, anchor.month + 1, 1) - timedelta(days=1)
        if month_end > end:
            end = month_end
    if start > end:
        return []
    return [
        {
            "member_id": member_id,
            "date": day.isoformat(),
            "tag": None,
            "source": "empty",
        }
        for day in each_date(start, end)
    ]


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
    """Daily RR paints any tag, including MFR and FR. Other menus keep their own rules."""
    return can_assign(member, day)


def apply_mfr_default(member: Member, tag: str) -> None:
    """Profile/default-tag helper. Daily RR writes must not call this."""
    if tag == "JL" and is_mfr_locked(member):
        member.default_tag = "JL"


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
    mfr_lock: bool = True,
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
    if mfr_lock and is_mfr_locked(member):
        return {
            "member_id": member.id,
            "date": day.isoformat(),
            "tag": "MFR",
            "source": "carry",
        }
    # A saved tag covers only that day. Later empty days return to default_tag.
    tag = (member.default_tag or "").upper()
    if tag:
        return {
            "member_id": member.id,
            "date": day.isoformat(),
            "tag": tag,
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
    query = db.query(Member).filter(
        Member.approval_status == "approved",
        ~Member.member_type.in_(("guest", "civilian")),
    )
    if member_id:
        query = query.filter(Member.id == member_id)
    family = None
    if wing and wing != "all" and str(wing_family or "").lower() in {"1", "true", "yes"}:
        family = wing_family_names(db, wing)
        names = [name.lower() for name in (family or [])]
        query = query.filter(func.lower(Member.wing).in_(names or ["__none__"]))
    elif wing and wing != "all":
        query = query.filter(Member.wing == wing)
    if rank and rank != "all":
        query = query.filter(Member.rank == rank)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Member.name.ilike(like),
                Member.rab_id.ilike(like),
                Member.personal_id.ilike(like),
                Member.rank.ilike(like),
                Member.wing.ilike(like),
                Member.phone.ilike(like),
            )
        )
    members = query.all()
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
    mfr_lock: bool = True,
) -> list[dict]:
    return [
        project_cell(
            member,
            day,
            stored_map.get((member.id, day)),
            suppressed,
            mfr_lock=mfr_lock,
        )
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
    if sync_due_jl(db):
        db.commit()
        bust_daily()
        bust_members()
    else:
        cached = cache_get(key)
        if cached is not None:
            return envelope(cached)
    members, stored_map, suppressed = load_window(
        db, start, end, q, rank, wing, member_id, wing_family
    )
    days = list(each_date(start, end))
    items = []
    for member in members:
        items.extend(
            cells_for_member(
                member,
                days,
                stored_map,
                suppressed,
                mfr_lock=False,
            )
        )
    data = {"items": items, "from": start.isoformat(), "to": end.isoformat()}
    cache_set(key, data)
    summary_key = cache_key(
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
    cache_set(summary_key, _summary_from_items(items, start, end, len(members)))
    return envelope(data)


def _summary_from_items(items: list, start, end, member_count: int) -> dict:
    by_tag: dict[str, int] = {}
    tagged = 0
    for cell in items:
        if cell.get("source") in ("stored", "carry") and cell.get("tag"):
            tag = cell["tag"]
            by_tag[tag] = by_tag.get(tag, 0) + 1
            tagged += 1
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "by_tag": by_tag,
        "total_tagged_person_days": tagged,
        "member_count": member_count,
    }


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
    list_key = cache_key(
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
    listed = cache_get(list_key)
    if listed is not None:
        items = listed.get("items") or []
        member_ids = {cell.get("member_id") for cell in items if cell.get("member_id")}
        data = _summary_from_items(items, start, end, len(member_ids))
        cache_set(key, data)
        return envelope(data)
    members, stored_map, suppressed = load_window(
        db, start, end, q, rank, wing, member_id, wing_family
    )
    days = list(each_date(start, end))
    items = []
    for member in members:
        items.extend(
            cells_for_member(member, days, stored_map, suppressed)
        )
    data = _summary_from_items(items, start, end, len(members))
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
    sync_member_jl(db, member)
    last_jl = (
        db.query(func.max(Assignment.date))
        .filter(Assignment.user_id == member.id, func.upper(Assignment.tag) == "JL")
        .scalar()
    )
    painted = {
        "member_id": row.user_id,
        "date": row.date.isoformat(),
        "tag": row.tag,
        "source": "stored",
        "trg_tone": row.trg_tone,
        "updated_at": row.updated_at.isoformat(),
        "updated_by": row.updated_by,
    }
    kept = [] if last_jl is not None and row.date > last_jl else [painted]
    db.commit()
    db.refresh(member)
    if kept:
        db.refresh(row)
    bust_daily()
    bust_members()
    return envelope(
        {
            "items": [
                *kept,
                *empty_cells_after(member.id, last_jl),
            ],
            "member": member_jl_state(member),
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
    if not can_assign(member, target):
        raise HTTPException(status_code=409, detail="Cannot clear tag on this date")
    freeze_prior_tags(db, member, target, staff)
    db.query(Assignment).filter(
        Assignment.user_id == member_id, Assignment.date == target
    ).delete()
    set_suppressed(db, member_id, target, True)
    unlock_date(db, target)
    member.updated_at = utcnow()
    sync_member_jl(db, member)
    db.commit()
    db.refresh(member)
    bust_daily()
    bust_members()
    last_jl = (
        db.query(func.max(Assignment.date))
        .filter(Assignment.user_id == member.id, func.upper(Assignment.tag) == "JL")
        .scalar()
    )
    return envelope(
        {
            "items": [
                {
                    "member_id": member_id,
                    "date": target.isoformat(),
                    "tag": None,
                    "source": "suppressed",
                },
                *empty_cells_after(member.id, last_jl),
            ],
            "member": member_jl_state(member),
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
            if not can_assign(member, day):
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
    sync_member_jl(db, member)
    last_jl = (
        db.query(func.max(Assignment.date))
        .filter(Assignment.user_id == member.id, func.upper(Assignment.tag) == "JL")
        .scalar()
    )
    if last_jl is not None:
        cutoff = last_jl.isoformat()
        items = [item for item in items if str(item.get("date") or "") <= cutoff]
    items.extend(empty_cells_after(member.id, last_jl))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not save this tag range",
        ) from exc
    db.refresh(member)
    bust_daily()
    bust_members()
    return envelope(
        {"updated": updated, "items": items, "member": member_jl_state(member)},
        "Range updated",
    )


@router.post("/api/v1/days/{day}/approve")
def approve_day(
    day: str,
    staff: Staff = Depends(require_roles(*DAILY_WRITE)),
    db: Session = Depends(get_db),
):
    target = parse_day(day)
    if sync_due_jl(db):
        db.commit()
        bust_daily()
        bust_members()
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
