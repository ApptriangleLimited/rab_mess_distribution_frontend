import re
from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.assign import (
    actor_name,
    can_assign_on_date,
    can_write_tag,
    carry_tag,
    is_cockpit,
    is_mfr_locked,
    is_user_inactive_on_date,
    resolve_trg_tone,
)
from app.domain.dates import date_range, date_str, iso_z, month_bounds, next_date, parse_date, today_dhaka
from app.domain.ids import new_id
from app.domain.spans import apply_status_to_spans
from app.domain.tags import TAG_RE
from app.errors import AppError, FieldError
from app.metrics import ASSIGNMENT_WRITES, DAY_APPROVE_FILL, DAY_APPROVES
from app.models.daily import ApprovedDay, Assignment, BoroKhanaDate, SuppressedCarry
from app.models.member import Member, MemberInactiveSpan
from app.models.staff import Staff
from app.services.audit import record_audit
from app.services.day_lock import release_day_lock, try_day_lock
from app.services.month_close import assert_months_writable


def require_date(value: str | None, field: str = "date") -> date:
    parsed = parse_date(value)
    if parsed is None:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid date",
            [FieldError(field, "invalid", "Use YYYY-MM-DD")],
        )
    return parsed


def parse_window(*, month: str | None, start: str | None, end: str | None, one: str | None) -> tuple[date, date]:
    if month:
        return month_bounds(month)
    if one:
        day = require_date(one, "date")
        return day, day
    if start and end:
        a, b = require_date(start, "from"), require_date(end, "to")
        if b < a:
            raise AppError(400, "VALIDATION_ERROR", "from must be on or before to")
        return a, b
    raise AppError(400, "VALIDATION_ERROR", "Provide month, date, or from+to")


def normalize_duty_tag(value: str | None, *, field: str = "tag") -> str:
    tag = (value or "").strip().upper()
    if not tag or not re.match(TAG_RE, tag):
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid tag",
            [FieldError(field, "invalid", "Tag must be 2–8 letters or digits")],
        )
    return tag


def _trg_tone_for(member: Member, tag: str, body: dict | None) -> str | None:
    if tag != "TRG":
        return None
    body = body or {}
    sent = body.get("trg_tone")
    if sent in {"black", "red"}:
        return sent
    training = bool(body.get("training") or body.get("trg_sarda"))
    return resolve_trg_tone(member.force, training)


def _cell(member_id: str, day: date, tag: str | None, source: str, row: Assignment | None = None) -> dict:
    out = {
        "member_id": member_id,
        "date": day.isoformat(),
        "tag": tag,
        "source": source,
    }
    if tag == "TRG" and row and row.trg_tone:
        out["trg_tone"] = row.trg_tone
    if source == "stored" and row:
        out["updated_at"] = iso_z(row.updated_at)
        out["updated_by"] = row.updated_by
    return out


def _get_member(db: Session, member_id: str, *, lock: bool = False) -> Member:
    q = db.query(Member).filter(Member.id == member_id)
    if lock:
        q = q.with_for_update()
    member = q.one_or_none()
    if member is None:
        raise AppError(404, "NOT_FOUND", "Member not found")
    return member


def _assert_writable(member: Member, day: date, tag: str) -> None:
    if not can_assign_on_date(member, day):
        ASSIGNMENT_WRITES.labels("inactive").inc()
        raise AppError(409, "INACTIVE_DATE", "Member is not assignable on this date")
    if is_mfr_locked(member) and tag not in {"MFR", "FR"}:
        ASSIGNMENT_WRITES.labels("mfr_locked").inc()
        raise AppError(409, "MFR_LOCKED", "MFR member can only be painted FR or MFR")


def unlock_day(db: Session, day: date) -> None:
    row = db.get(ApprovedDay, day)
    if row is not None:
        db.delete(row)


def _clear_suppress(db: Session, member_id: str, day: date) -> None:
    row = db.get(SuppressedCarry, {"member_id": member_id, "date": day})
    if row is not None:
        db.delete(row)


def _set_suppress(db: Session, member_id: str, day: date) -> None:
    if db.get(SuppressedCarry, {"member_id": member_id, "date": day}) is None:
        db.add(SuppressedCarry(member_id=member_id, date=day))


def last_jl_date(db: Session, member_id: str) -> date | None:
    row = (
        db.query(Assignment)
        .filter(Assignment.member_id == member_id, Assignment.tag == "JL")
        .order_by(Assignment.date.desc())
        .first()
    )
    return row.date if row else None


def apply_mfr_default(member: Member, tag: str) -> None:
    if tag == "MFR":
        member.default_tag = "MFR"
    elif tag == "FR" and is_mfr_locked(member):
        member.default_tag = "FR"


def purge_unassignable(db: Session, member: Member) -> None:
    rows = db.query(Assignment).filter(Assignment.member_id == member.id).all()
    for row in rows:
        if is_user_inactive_on_date(member, row.date) or not can_assign_on_date(member, row.date):
            db.delete(row)


def _set_spans(member: Member, spans: list[tuple]) -> None:
    member.inactive_spans.clear()
    for start, end in spans:
        member.inactive_spans.append(
            MemberInactiveSpan(id=new_id("sp_"), from_date=start, to_date=end)
        )


def sync_after_jl(db: Session, member: Member, as_of: date | None = None) -> None:
    as_of = as_of or today_dhaka()
    last = last_jl_date(db, member.id)
    if last is None:
        if member.jl_end_date:
            member.jl_end_date = ""
        return
    if as_of > last:
        if member.status == "0" and not member.jl_end_date:
            purge_unassignable(db, member)
            return
        start = next_date(last)
        member.jl_end_date = ""
        member.status = "0"
        current = [(s.from_date, s.to_date) for s in member.inactive_spans]
        if not any(end is None for _f, end in current):
            current.append((start, None))
            _set_spans(member, current)
        purge_unassignable(db, member)
        return
    if member.jl_end_date != last.isoformat():
        member.jl_end_date = last.isoformat()


def _upsert_row(db: Session, member: Member, day: date, tag: str, staff: Staff, body: dict | None) -> Assignment:
    tone = _trg_tone_for(member, tag, body)
    actor = actor_name(staff)
    row = (
        db.query(Assignment)
        .filter(Assignment.member_id == member.id, Assignment.date == day)
        .with_for_update()
        .one_or_none()
    )
    if row is not None:
        row.tag = tag
        row.trg_tone = tone
        row.updated_by = actor
        return row
    row = Assignment(
        id=new_id("a_"),
        member_id=member.id,
        date=day,
        tag=tag,
        trg_tone=tone,
        updated_by=actor,
    )
    try:
        with db.begin_nested():
            db.add(row)
            db.flush()
        return row
    except IntegrityError:
        existing = (
            db.query(Assignment)
            .filter(Assignment.member_id == member.id, Assignment.date == day)
            .one_or_none()
        )
        if existing is None:
            row = Assignment(
                id=new_id("a_"),
                member_id=member.id,
                date=day,
                tag=tag,
                trg_tone=tone,
                updated_by=actor,
            )
            db.add(row)
            db.flush()
            return row
        existing.tag = tag
        existing.trg_tone = tone
        existing.updated_by = actor
        return existing


def paint(db: Session, *, member_id: str, day: date, tag: str, staff: Staff, body: dict, request, force: bool = False) -> dict:
    try_day_lock(day.isoformat())
    try:
        assert_months_writable(db, [day], staff, force=force, request=request)
        member = _get_member(db, member_id, lock=True)
        _assert_writable(member, day, tag)
        db.query(Assignment).filter(Assignment.date == day).with_for_update().all()
        unlock_day(db, day)
        row = _upsert_row(db, member, day, tag, staff, body)
        _clear_suppress(db, member.id, day)
        apply_mfr_default(member, tag)
        sync_after_jl(db, member)
        record_audit(
            db,
            staff=staff,
            action="assignment.paint",
            entity_type="assignment",
            entity_id=row.id,
            after={"member_id": member.id, "date": day.isoformat(), "tag": tag},
            request=request,
        )
        db.commit()
        db.refresh(row)
        ASSIGNMENT_WRITES.labels("ok").inc()
        return _cell(member.id, day, tag, "stored", row)
    except AppError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        ASSIGNMENT_WRITES.labels("error").inc()
        raise
    finally:
        release_day_lock(day.isoformat())


def paint_range(
    db: Session,
    *,
    member_id: str,
    dates: list[str],
    tag: str,
    staff: Staff,
    body: dict,
    request,
    commit: bool = True,
    force: bool = False,
) -> dict:
    member = _get_member(db, member_id, lock=True)
    items = []
    seen: set[date] = set()
    parsed_days = []
    for raw in dates:
        day = parse_date(raw)
        if day is None or day in seen:
            continue
        seen.add(day)
        parsed_days.append(day)
    assert_months_writable(db, parsed_days, staff, force=force, request=request)
    for day in parsed_days:
        if not can_write_tag(member, day, tag):
            continue
        try_day_lock(day.isoformat())
        try:
            db.query(Assignment).filter(Assignment.date == day).with_for_update().all()
            unlock_day(db, day)
            row = _upsert_row(db, member, day, tag, staff, body)
            _clear_suppress(db, member.id, day)
            items.append((day, row))
        finally:
            release_day_lock(day.isoformat())
    apply_mfr_default(member, tag)
    sync_after_jl(db, member)
    record_audit(
        db,
        staff=staff,
        action="assignment.range",
        entity_type="assignment",
        entity_id=member.id,
        after={"tag": tag, "updated": len(items)},
        request=request,
    )
    if commit:
        db.commit()
        ASSIGNMENT_WRITES.labels("ok").inc()
        out = []
        for day, row in items:
            db.refresh(row)
            out.append(_cell(member.id, day, tag, "stored", row))
        return {"updated": len(out), "items": out}
    ASSIGNMENT_WRITES.labels("ok").inc()
    return {
        "updated": len(items),
        "items": [_cell(member.id, day, tag, "stored", row) for day, row in items],
    }


def clear_assignment(db: Session, *, member_id: str, day: date, staff: Staff, request, force: bool = False) -> dict:
    try_day_lock(day.isoformat())
    try:
        assert_months_writable(db, [day], staff, force=force, request=request)
        member = _get_member(db, member_id, lock=True)
        if not can_assign_on_date(member, day):
            ASSIGNMENT_WRITES.labels("inactive").inc()
            raise AppError(409, "INACTIVE_DATE", "Member is not assignable on this date")
        if is_mfr_locked(member):
            ASSIGNMENT_WRITES.labels("mfr_locked").inc()
            raise AppError(409, "MFR_LOCKED", "MFR member can only be painted FR or MFR")
        db.query(Assignment).filter(Assignment.date == day).with_for_update().all()
        unlock_day(db, day)
        row = (
            db.query(Assignment)
            .filter(Assignment.member_id == member.id, Assignment.date == day)
            .one_or_none()
        )
        if row is not None:
            db.delete(row)
        _set_suppress(db, member.id, day)
        sync_after_jl(db, member)
        record_audit(
            db,
            staff=staff,
            action="assignment.clear",
            entity_type="assignment",
            entity_id=f"{member.id}|{day.isoformat()}",
            request=request,
        )
        db.commit()
        ASSIGNMENT_WRITES.labels("ok").inc()
        return _cell(member.id, day, None, "suppressed")
    except AppError:
        db.rollback()
        raise
    finally:
        release_day_lock(day.isoformat())


def approve_day(db: Session, day: date, staff: Staff, request, force: bool = False) -> dict:
    try_day_lock(day.isoformat())
    try:
        assert_months_writable(db, [day], staff, force=force, request=request)
        existing = db.query(ApprovedDay).filter(ApprovedDay.date == day).with_for_update().one_or_none()
        if existing is not None:
            DAY_APPROVES.labels("already").inc()
            return {"date": day.isoformat(), "filled": 0, "locked": True}

        db.query(Assignment).filter(Assignment.date == day).with_for_update().all()
        members = (
            db.query(Member)
            .filter(Member.approval_status == "approved", Member.member_type != "guest")
            .with_for_update()
            .all()
        )
        filled = 0
        for member in members:
            if not can_assign_on_date(member, day):
                continue
            stored = (
                db.query(Assignment)
                .filter(Assignment.member_id == member.id, Assignment.date == day)
                .one_or_none()
            )
            suppressed = db.get(SuppressedCarry, {"member_id": member.id, "date": day})
            if stored is not None and suppressed is None:
                continue
            fill = carry_tag(member)
            if not fill:
                if suppressed is not None:
                    db.delete(suppressed)
                continue
            _upsert_row(db, member, day, fill, staff, None)
            if suppressed is not None:
                db.delete(suppressed)
            filled += 1
        db.add(ApprovedDay(date=day))
        record_audit(
            db,
            staff=staff,
            action="day.approve",
            entity_type="day",
            entity_id=day.isoformat(),
            after={"filled": filled},
            request=request,
        )
        db.commit()
        DAY_APPROVES.labels("ok").inc()
        DAY_APPROVE_FILL.observe(filled)
        return {"date": day.isoformat(), "filled": filled, "locked": True}
    except AppError:
        db.rollback()
        DAY_APPROVES.labels("error").inc()
        raise
    except Exception:
        db.rollback()
        DAY_APPROVES.labels("error").inc()
        raise
    finally:
        release_day_lock(day.isoformat())


def _filter_members(db: Session, *, member_id: str | None, rank: str | None, wing: str | None, q: str | None) -> list[Member]:
    query = db.query(Member).filter(Member.approval_status == "approved", Member.member_type != "guest")
    if member_id:
        query = query.filter(Member.id == member_id)
    if rank and rank.lower() != "all":
        query = query.filter(Member.rank == rank)
    if wing and wing.lower() != "all":
        query = query.filter(Member.wing == wing)
    if q and q.strip() and q.strip().lower() != "all":
        like = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Member.name).like(like),
                func.lower(Member.rab_id).like(like),
                func.lower(Member.personal_id).like(like),
                func.lower(Member.rfid).like(like),
            )
        )
    return query.all()


def cockpit_tag(db: Session, member: Member, day: date) -> str:
    if is_mfr_locked(member) and can_assign_on_date(member, day):
        return "MFR"
    stored = (
        db.query(Assignment)
        .filter(Assignment.member_id == member.id, Assignment.date == day)
        .one_or_none()
    )
    if stored is not None:
        return stored.tag
    if db.get(SuppressedCarry, {"member_id": member.id, "date": day}):
        return ""
    if not can_assign_on_date(member, day):
        return ""
    return carry_tag(member) or ""


def project(
    db: Session,
    *,
    start: date,
    end: date,
    member_id: str | None = None,
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
) -> list[dict]:
    members = _filter_members(db, member_id=member_id, rank=rank, wing=wing, q=q)
    days = date_range(start, end)
    if not members or not days:
        return []
    ids = [m.id for m in members]
    stored = {
        (r.member_id, r.date): r
        for r in db.query(Assignment)
        .filter(Assignment.member_id.in_(ids), Assignment.date >= start, Assignment.date <= end)
        .all()
    }
    suppressed = {
        (r.member_id, r.date)
        for r in db.query(SuppressedCarry)
        .filter(SuppressedCarry.member_id.in_(ids), SuppressedCarry.date >= start, SuppressedCarry.date <= end)
        .all()
    }
    items = []
    for member in members:
        for day in days:
            row = stored.get((member.id, day))
            if row is not None:
                items.append(_cell(member.id, day, row.tag, "stored", row))
                continue
            if (member.id, day) in suppressed:
                items.append(_cell(member.id, day, None, "suppressed"))
                continue
            if can_assign_on_date(member, day):
                tag = carry_tag(member)
                if tag:
                    items.append(_cell(member.id, day, tag, "carry"))
                    continue
            items.append(_cell(member.id, day, None, "empty"))
    return items


def summary(items: list[dict], start: date, end: date, member_count: int) -> dict:
    by_tag: dict[str, int] = {}
    total = 0
    for cell in items:
        if cell["source"] not in {"stored", "carry"} or not cell["tag"]:
            continue
        by_tag[cell["tag"]] = by_tag.get(cell["tag"], 0) + 1
        total += 1
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "by_tag": by_tag,
        "total_tagged_person_days": total,
        "member_count": member_count,
    }


def list_locks(db: Session, start: date, end: date) -> list[str]:
    rows = (
        db.query(ApprovedDay)
        .filter(ApprovedDay.date >= start, ApprovedDay.date <= end)
        .order_by(ApprovedDay.date)
        .all()
    )
    return [r.date.isoformat() for r in rows]


def list_boro(db: Session, start: date, end: date) -> list[str]:
    rows = (
        db.query(BoroKhanaDate)
        .filter(BoroKhanaDate.date >= start, BoroKhanaDate.date <= end)
        .order_by(BoroKhanaDate.date)
        .all()
    )
    return [r.date.isoformat() for r in rows]


def set_boro(db: Session, day: date, on: bool, staff: Staff, request) -> dict:
    row = db.get(BoroKhanaDate, day)
    if on and row is None:
        db.add(BoroKhanaDate(date=day))
    elif not on and row is not None:
        db.delete(row)
    record_audit(
        db,
        staff=staff,
        action="boro.toggle",
        entity_type="boro_khana",
        entity_id=day.isoformat(),
        after={"on": on},
        request=request,
    )
    db.commit()
    return {"date": day.isoformat(), "on": on}


def paint_today_if_immediate(db: Session, member: Member, tag: str, staff: Staff, body: dict, force: bool = False, request=None) -> dict | None:
    day = today_dhaka()
    if not can_write_tag(member, day, tag):
        return None
    assert_months_writable(db, [day], staff, force=force, request=request)
    row = _upsert_row(db, member, day, tag, staff, body)
    _clear_suppress(db, member.id, day)
    unlock_day(db, day)
    apply_mfr_default(member, tag)
    return _cell(member.id, day, tag, "stored", row)
