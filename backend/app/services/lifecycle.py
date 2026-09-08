from sqlalchemy.orm import Session

from app.domain.assign import is_mfr_locked
from app.domain.dates import today_dhaka
from app.domain.members import member_public, normalize_status, normalize_tag
from app.domain.phones import digits_only
from app.domain.queues import duty_tag_queue
from app.domain.spans import apply_status_to_spans
from app.models.member import Member
from app.models.settings import OrgMemberBank
from app.models.staff import Staff
from app.services.assignments import paint_today_if_immediate, purge_unassignable
from app.services.audit import record_audit
from app.services.members import _set_spans
from app.services.tag_requests import create_duty_request, refresh_pending_gauge, request_public


def _clamp_bank(db: Session, name: str) -> str:
    trimmed = name.strip()
    if not trimmed:
        return ""
    banks = db.query(OrgMemberBank).all()
    hit = next((b.label for b in banks if b.label.lower() == trimmed.lower()), None)
    return hit or ""


def approve_member(db: Session, member: Member, body: dict, staff: Staff, request) -> dict:
    today_tag = (body.get("today_tag") or "").strip().upper()
    before = {"approval_status": member.approval_status, "status": member.status}
    status_changed = member.status != "1"
    member.approval_status = "approved"
    member.status = "1"
    member.jl_end_date = ""
    if status_changed:
        current = [(s.from_date, s.to_date) for s in member.inactive_spans]
        _set_spans(member, apply_status_to_spans(current, "1", member.joining_date))

    if body.get("default_tag"):
        tag = normalize_tag(body.get("default_tag"))
        if is_mfr_locked(member) and tag not in {"MFR", "FR"}:
            tag = "MFR"
        member.default_tag = tag

    assignment = None
    tag_request = None
    if today_tag:
        routed = duty_tag_queue(today_tag)
        if routed == "immediate":
            assignment = paint_today_if_immediate(db, member, today_tag, staff, body)
        else:
            today = today_dhaka().isoformat()
            created = create_duty_request(
                db,
                {
                    "user_id": member.id,
                    "to_tag": today_tag,
                    "from_date": today,
                    "to_date": today,
                    "queue": routed,
                    "trg_tone": body.get("trg_tone"),
                    "trg_sarda": body.get("trg_sarda"),
                },
                staff,
                request,
                commit=False,
            )
            tag_request = request_public(created)

    record_audit(
        db,
        staff=staff,
        action="member.approve",
        entity_type="member",
        entity_id=member.id,
        before=before,
        after={"approval_status": "approved"},
        request=request,
    )
    db.commit()
    db.refresh(member)
    refresh_pending_gauge(db)
    return {"member": member_public(member), "assignment": assignment, "tag_request": tag_request}


def reject_member(db: Session, member: Member, staff: Staff, request) -> Member:
    member.approval_status = "rejected"
    record_audit(
        db,
        staff=staff,
        action="member.reject",
        entity_type="member",
        entity_id=member.id,
        request=request,
    )
    db.commit()
    db.refresh(member)
    return member


def end_member(db: Session, member: Member, staff: Staff, request) -> Member:
    status_changed = member.status != "0"
    member.approval_status = "ended"
    member.status = "0"
    if status_changed:
        current = [(s.from_date, s.to_date) for s in member.inactive_spans]
        _set_spans(member, apply_status_to_spans(current, "0", member.joining_date))
    purge_unassignable(db, member)
    record_audit(
        db,
        staff=staff,
        action="member.end",
        entity_type="member",
        entity_id=member.id,
        request=request,
    )
    db.commit()
    db.refresh(member)
    return member


def patch_status(db: Session, member: Member, body: dict, staff: Staff, request) -> Member:
    status = normalize_status(body.get("status"), default=member.status)
    if status == member.status:
        return member
    current = [(s.from_date, s.to_date) for s in member.inactive_spans]
    member.status = status
    if status == "1":
        member.jl_end_date = ""
    _set_spans(member, apply_status_to_spans(current, status, member.joining_date))
    purge_unassignable(db, member)
    record_audit(
        db,
        staff=staff,
        action="member.status",
        entity_type="member",
        entity_id=member.id,
        after={"status": status},
        request=request,
    )
    db.commit()
    db.refresh(member)
    return member


def patch_bank(db: Session, member: Member, body: dict, staff: Staff, request) -> Member:
    member.bank_name = _clamp_bank(db, str(body.get("bank_name") or ""))
    member.account_name = str(body.get("account_name") or "").strip()
    member.account_number = digits_only(str(body.get("account_number") or ""))
    member.routing = digits_only(str(body.get("routing") or ""))
    member.branch = str(body.get("branch") or "").strip()
    member.branch_location = str(body.get("branch_location") or "").strip()
    record_audit(
        db,
        staff=staff,
        action="member.bank",
        entity_type="member",
        entity_id=member.id,
        after={"bank_name": member.bank_name},
        request=request,
    )
    db.commit()
    db.refresh(member)
    return member
