from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.domain.assign import actor_name, can_assign_on_date, is_mfr_locked
from app.domain.dates import date_range, iso_z, today_dhaka
from app.domain.ids import new_id
from app.domain.queues import QUEUE_OWNERS, duty_tag_queue
from app.errors import AppError, FieldError
from app.metrics import TAG_REQUESTS_PENDING, TAG_REQUEST_APPLY
from app.models.member import Member
from app.models.requests import TagRequest
from app.models.staff import Staff
from app.services.assignments import cockpit_tag, normalize_duty_tag, paint_range, require_date
from app.services.audit import record_audit
from app.services.members import PAGE_SIZES


def request_public(row: TagRequest) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "date": row.date.isoformat(),
        "from_date": row.from_date.isoformat(),
        "to_date": row.to_date.isoformat(),
        "from_tag": row.from_tag,
        "to_tag": row.to_tag,
        "trg_tone": row.trg_tone,
        "trg_sarda": row.trg_sarda,
        "queue": row.queue,
        "status": row.status,
        "requested_by": row.requested_by,
        "requested_at": iso_z(row.requested_at),
        "updated_by": row.updated_by,
        "updated_at": iso_z(row.updated_at),
    }


def refresh_pending_gauge(db: Session) -> None:
    for queue in ("daily", "ration", "consume"):
        n = (
            db.query(TagRequest)
            .filter(TagRequest.queue == queue, TagRequest.status == "requested")
            .count()
        )
        TAG_REQUESTS_PENDING.labels(queue).set(n)


def _member(db: Session, user_id: str) -> Member:
    member = db.get(Member, user_id)
    if member is None:
        raise AppError(404, "NOT_FOUND", "Member not found")
    return member


def _range(from_raw, to_raw) -> tuple[date, date]:
    start = require_date(from_raw or today_dhaka().isoformat(), "from_date")
    end = require_date(to_raw or start.isoformat(), "to_date")
    if end < start:
        start, end = end, start
    return start, end


def _pending(db: Session, user_id: str, queue: str) -> TagRequest | None:
    return (
        db.query(TagRequest)
        .filter(
            TagRequest.user_id == user_id,
            TagRequest.queue == queue,
            TagRequest.status == "requested",
        )
        .one_or_none()
    )


def _upsert_open(
    db: Session,
    *,
    member: Member,
    queue: str,
    start: date,
    end: date,
    to_tag: str,
    from_tag: str,
    staff: Staff,
    trg_tone: str | None,
    trg_sarda: bool | None,
) -> TagRequest:
    existing = _pending(db, member.id, queue)
    actor = actor_name(staff)
    if existing:
        existing.date = start
        existing.from_date = start
        existing.to_date = end
        existing.from_tag = from_tag
        existing.to_tag = to_tag
        existing.trg_tone = trg_tone
        existing.trg_sarda = trg_sarda
        existing.requested_by = actor
        return existing
    row = TagRequest(
        id=new_id("tr_"),
        user_id=member.id,
        date=start,
        from_date=start,
        to_date=end,
        from_tag=from_tag,
        to_tag=to_tag,
        trg_tone=trg_tone,
        trg_sarda=trg_sarda,
        queue=queue,
        status="requested",
        requested_by=actor,
    )
    db.add(row)
    return row


def create_daily_request(db: Session, body: dict, staff: Staff, request) -> TagRequest:
    user_id = str(body.get("user_id") or body.get("member_id") or "").strip()
    member = _member(db, user_id)
    to_tag = normalize_duty_tag(body.get("to_tag"), field="to_tag")
    start, end = _range(body.get("from_date"), body.get("to_date"))
    if not can_assign_on_date(member, start):
        raise AppError(409, "INACTIVE_DATE", "Member is not assignable on from_date")
    if is_mfr_locked(member) and to_tag != "FR":
        raise AppError(409, "MFR_LOCKED", "MFR member can only request FR")
    from_tag = cockpit_tag(db, member, start)
    if from_tag == to_tag:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "to_tag matches current cockpit tag",
            [FieldError("to_tag", "same", "Already that tag")],
        )
    if not any(can_assign_on_date(member, d) for d in date_range(start, end)):
        raise AppError(409, "INACTIVE_DATE", "No assignable dates in range")
    row = _upsert_open(
        db,
        member=member,
        queue="daily",
        start=start,
        end=end,
        to_tag=to_tag,
        from_tag=from_tag,
        staff=staff,
        trg_tone=None,
        trg_sarda=None,
    )
    record_audit(
        db,
        staff=staff,
        action="tag_request.create",
        entity_type="tag_request",
        entity_id=row.id,
        after={"queue": "daily", "to_tag": to_tag},
        request=request,
    )
    db.commit()
    db.refresh(row)
    refresh_pending_gauge(db)
    return row


def create_duty_request(db: Session, body: dict, staff: Staff, request, *, commit: bool = True) -> TagRequest:
    user_id = str(body.get("user_id") or body.get("member_id") or "").strip()
    member = _member(db, user_id)
    to_tag = normalize_duty_tag(body.get("to_tag"), field="to_tag")
    routed = duty_tag_queue(to_tag)
    queue = str(body.get("queue") or routed).strip().lower()
    if routed == "immediate":
        raise AppError(400, "VALIDATION_ERROR", "MS/MFR apply immediately, not as a duty request")
    if queue != routed:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "queue does not match tag routing",
            [FieldError("queue", "mismatch", f"{to_tag} routes to {routed}")],
        )
    start, end = _range(body.get("from_date"), body.get("to_date"))
    if is_mfr_locked(member) and to_tag != "FR":
        raise AppError(409, "MFR_LOCKED", "MFR member can only request FR")
    from_tag = cockpit_tag(db, member, start)
    trg_tone = None
    trg_sarda = None
    if to_tag == "TRG":
        sent = body.get("trg_tone")
        trg_tone = sent if sent in {"black", "red"} else None
        if body.get("trg_sarda") is not None:
            trg_sarda = bool(body.get("trg_sarda"))
    row = _upsert_open(
        db,
        member=member,
        queue=queue,
        start=start,
        end=end,
        to_tag=to_tag,
        from_tag=from_tag,
        staff=staff,
        trg_tone=trg_tone,
        trg_sarda=trg_sarda,
    )
    record_audit(
        db,
        staff=staff,
        action="tag_request.duty",
        entity_type="tag_request",
        entity_id=row.id,
        after={"queue": queue, "to_tag": to_tag},
        request=request,
    )
    if commit:
        db.commit()
        db.refresh(row)
        refresh_pending_gauge(db)
    return row


def assert_queue_owner(staff: Staff, queue: str) -> None:
    allowed = QUEUE_OWNERS.get(queue, frozenset())
    if staff.role not in allowed:
        raise AppError(403, "FORBIDDEN", "Role cannot act on this queue")


def apply_request(db: Session, request_id: str, staff: Staff, request) -> dict:
    row = (
        db.query(TagRequest)
        .filter(TagRequest.id == request_id, TagRequest.status == "requested")
        .with_for_update()
        .one_or_none()
    )
    if row is None:
        existing = db.get(TagRequest, request_id)
        if existing is None:
            raise AppError(404, "NOT_FOUND", "Tag request not found")
        TAG_REQUEST_APPLY.labels(existing.queue, "not_pending").inc()
        raise AppError(409, "NOT_PENDING", "Request is not pending")
    assert_queue_owner(staff, row.queue)
    member = _member(db, row.user_id)
    dates = [d.isoformat() for d in date_range(row.from_date, row.to_date) if can_assign_on_date(member, d)]
    if not dates:
        TAG_REQUEST_APPLY.labels(row.queue, "inactive").inc()
        raise AppError(409, "INACTIVE_DATE", "No assignable dates in range")
    body = {"trg_tone": row.trg_tone, "trg_sarda": row.trg_sarda}
    painted = paint_range(
        db,
        member_id=row.user_id,
        dates=dates,
        tag=row.to_tag,
        staff=staff,
        body=body,
        request=request,
        commit=False,
    )
    row.status = "updated"
    row.updated_by = actor_name(staff)
    record_audit(
        db,
        staff=staff,
        action="tag_request.apply",
        entity_type="tag_request",
        entity_id=row.id,
        after={"updated": painted["updated"]},
        request=request,
    )
    db.commit()
    db.refresh(row)
    refresh_pending_gauge(db)
    TAG_REQUEST_APPLY.labels(row.queue, "ok").inc()
    return {"request": request_public(row), "updated": painted["updated"], "items": painted["items"]}


def reject_request(db: Session, request_id: str, staff: Staff, request) -> TagRequest:
    row = (
        db.query(TagRequest)
        .filter(TagRequest.id == request_id, TagRequest.status == "requested")
        .with_for_update()
        .one_or_none()
    )
    if row is None:
        existing = db.get(TagRequest, request_id)
        if existing is None:
            raise AppError(404, "NOT_FOUND", "Tag request not found")
        raise AppError(409, "NOT_PENDING", "Request is not pending")
    assert_queue_owner(staff, row.queue)
    row.status = "rejected"
    row.updated_by = actor_name(staff)
    record_audit(
        db,
        staff=staff,
        action="tag_request.reject",
        entity_type="tag_request",
        entity_id=row.id,
        request=request,
    )
    db.commit()
    db.refresh(row)
    refresh_pending_gauge(db)
    return row


def list_requests(
    db: Session,
    *,
    queue: str | None,
    status: str | None,
    user_id: str | None,
    q: str | None,
    page: int,
    page_size: int,
) -> tuple[list[TagRequest], int, int, int]:
    if page < 1:
        page = 1
    if page_size not in PAGE_SIZES:
        page_size = 25
    query = db.query(TagRequest)
    if queue and queue.lower() != "all":
        query = query.filter(TagRequest.queue == queue)
    if status and status.lower() != "all":
        query = query.filter(TagRequest.status == status)
    if user_id:
        query = query.filter(TagRequest.user_id == user_id)
    if q and q.strip() and q.strip().lower() != "all":
        like = f"%{q.strip().lower()}%"
        query = query.join(Member, Member.id == TagRequest.user_id).filter(
            or_(
                func.lower(Member.name).like(like),
                func.lower(Member.rab_id).like(like),
                func.lower(Member.personal_id).like(like),
            )
        )
    total = query.count()
    rows = (
        query.order_by(TagRequest.requested_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total, page, page_size


def pending_counts(db: Session) -> dict:
    counts = {"daily": 0, "ration": 0, "consume": 0}
    rows = (
        db.query(TagRequest.queue, func.count(TagRequest.id))
        .filter(TagRequest.status == "requested")
        .group_by(TagRequest.queue)
        .all()
    )
    for queue, n in rows:
        if queue in counts:
            counts[queue] = int(n)
    return counts
