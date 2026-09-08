from datetime import date

from sqlalchemy.orm import Session

from app.domain.assign import actor_name, can_assign_on_date, is_cockpit
from app.domain.dates import iso_z
from app.domain.ids import new_id
from app.errors import AppError
from app.models.daily import Assignment, BoroKhanaDate
from app.models.member import Member
from app.models.requests import StateReport
from app.models.staff import Staff
from app.services.assignments import cockpit_tag
from app.services.audit import record_audit
from app.services.members import PAGE_SIZES


def report_public(row: StateReport) -> dict:
    return {
        "id": row.id,
        "date": row.date.isoformat(),
        "status": row.status,
        "submitted_at": iso_z(row.submitted_at),
        "submitted_by": row.submitted_by,
        "reviewed_at": iso_z(row.reviewed_at) if row.reviewed_at else None,
        "reviewed_by": row.reviewed_by,
        "note": row.note,
        "boro_khana": row.boro_khana,
        "members": row.members or [],
        "totals": row.totals or {"active": 0, "by_tag": {}, "mess_eaters": 0},
    }


def draft_snapshot(db: Session, day: date) -> dict:
    bk = db.get(BoroKhanaDate, day) is not None
    members = (
        db.query(Member)
        .filter(Member.approval_status == "approved", Member.status == "1", Member.member_type != "guest")
        .all()
    )
    members = [m for m in members if is_cockpit(m) and can_assign_on_date(m, day)]
    members.sort(key=lambda m: (m.rab_id, m.rank, m.name.lower()))
    by_tag: dict[str, int] = {}
    rows = []
    for member in members:
        tag = cockpit_tag(db, member, day)
        if tag:
            by_tag[tag] = by_tag.get(tag, 0) + 1
        reason = None
        if bk:
            if tag == "MS":
                reason = "MS"
            elif tag == "FR":
                reason = "FR"
            else:
                reason = "BK"
        rows.append(
            {
                "user_id": member.id,
                "tag": tag,
                "mess_reason": reason,
                "name": member.name,
                "rab_id": member.rab_id,
                "rank": member.rank,
                "wing": member.wing,
            }
        )
    if bk:
        eaters = len(rows)
    else:
        eaters = sum(
            1
            for a in db.query(Assignment).filter(Assignment.date == day, Assignment.tag == "MS").all()
            if (m := db.get(Member, a.member_id))
            and m.approval_status == "approved"
            and m.status == "1"
            and can_assign_on_date(m, day)
        )
    return {
        "date": day.isoformat(),
        "boro_khana": bk,
        "members": rows,
        "totals": {"active": len(rows), "by_tag": by_tag, "mess_eaters": eaters},
    }


def submit_report(db: Session, day: date, staff: Staff, request) -> StateReport:
    snapshot = draft_snapshot(db, day)
    db.query(StateReport).filter(StateReport.date == day, StateReport.status == "pending").delete()
    row = StateReport(
        id=new_id("sr_"),
        date=day,
        status="pending",
        submitted_by=actor_name(staff),
        boro_khana=snapshot["boro_khana"],
        totals=snapshot["totals"],
        members=snapshot["members"],
    )
    db.add(row)
    record_audit(
        db,
        staff=staff,
        action="state_report.submit",
        entity_type="state_report",
        entity_id=row.id,
        after={"date": day.isoformat()},
        request=request,
    )
    db.commit()
    db.refresh(row)
    return row


def get_report(db: Session, report_id: str) -> StateReport:
    row = db.get(StateReport, report_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "State report not found")
    return row


def _review(db: Session, report_id: str, status: str, staff: Staff, request, note: str | None) -> StateReport:
    row = (
        db.query(StateReport)
        .filter(StateReport.id == report_id, StateReport.status == "pending")
        .with_for_update()
        .one_or_none()
    )
    if row is None:
        existing = db.get(StateReport, report_id)
        if existing is None:
            raise AppError(404, "NOT_FOUND", "State report not found")
        raise AppError(409, "NOT_PENDING", "Report is not pending")
    from datetime import datetime, timezone

    row.status = status
    row.reviewed_at = datetime.now(timezone.utc)
    row.reviewed_by = actor_name(staff)
    if status == "rejected" and note:
        row.note = note
    record_audit(
        db,
        staff=staff,
        action=f"state_report.{status}",
        entity_type="state_report",
        entity_id=row.id,
        request=request,
    )
    db.commit()
    db.refresh(row)
    return row


def approve_report(db: Session, report_id: str, staff: Staff, request) -> StateReport:
    return _review(db, report_id, "approved", staff, request, None)


def reject_report(db: Session, report_id: str, staff: Staff, request, note: str | None) -> StateReport:
    return _review(db, report_id, "rejected", staff, request, note)


def list_reports(
    db: Session,
    *,
    status: str | None,
    day: date | None,
    start: date | None,
    end: date | None,
    page: int,
    page_size: int,
) -> tuple[list[StateReport], int, int, int]:
    if page < 1:
        page = 1
    if page_size not in PAGE_SIZES:
        page_size = 25
    query = db.query(StateReport)
    if status and status.lower() != "all":
        query = query.filter(StateReport.status == status)
    if day:
        query = query.filter(StateReport.date == day)
    if start:
        query = query.filter(StateReport.date >= start)
    if end:
        query = query.filter(StateReport.date <= end)
    total = query.count()
    rows = (
        query.order_by(StateReport.submitted_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total, page, page_size
