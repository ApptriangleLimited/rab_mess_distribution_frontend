"""Mess checker: SRB ID check-in and guest meals for one branch."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import require_roles
from daily import project_cell
from database import get_db
from extra import checker_desk, envelope, new_id
from models import Assignment, GuestMeal, MealShift, Member, Staff, SuppressedCarry
from zk_gate import (
    DHAKA,
    STATUS_ACCEPTED,
    _load_shifts,
    _match_shift,
    _seconds_until_shift_end,
    append_checker_punch,
    device_pin,
    has_rfid,
    mess_today,
)

router = APIRouter()


def _branch(staff: Staff) -> str:
    return checker_desk(staff.role, getattr(staff, "desk", "") or "")


def _branch_label(branch: str) -> str:
    return "Haji Camp" if branch == "haji" else "SRB HQ"


def _find_member(db: Session, srb_id: str) -> Member | None:
    key = (srb_id or "").strip().lower()
    if not key:
        return None
    member = db.query(Member).filter(func.lower(Member.rab_id) == key).first()
    if member is not None:
        return member
    return db.query(Member).filter(func.lower(Member.personal_id) == key).first()


def _today_tag(db: Session, member: Member, day: date) -> str:
    stored = (
        db.query(Assignment)
        .filter(Assignment.user_id == member.id, Assignment.date == day)
        .first()
    )
    suppressed = {
        (row.user_id, row.date)
        for row in db.query(SuppressedCarry).filter(
            SuppressedCarry.user_id == member.id,
            SuppressedCarry.date == day,
        )
    }
    cell = project_cell(member, day, stored, suppressed)
    return str(cell.get("tag") or "").upper()


def _is_ms(member: Member, tag: str) -> bool:
    return (
        str(member.status) == "1"
        and (member.approval_status or "") == "approved"
        and tag == "MS"
    )


def _branch_rows(branch: str) -> list[dict]:
    if branch == "haji":
        from zk_hazz import hazz_snapshot

        return list(hazz_snapshot().get("rows") or [])
    from zk_gate import gate_snapshot

    return list(gate_snapshot().get("rows") or [])


def _same_person(row: dict, member: Member) -> bool:
    rab = str(row.get("rab_id") or "").strip().lower()
    pin = str(row.get("pin") or "").strip()
    if rab and rab == (member.rab_id or "").strip().lower():
        return True
    member_pin = device_pin(member.rab_id) or device_pin(getattr(member, "personal_id", ""))
    return bool(member_pin) and pin == member_pin


def _accepted_for_shift(rows: list[dict], member: Member, shift_id: str) -> bool:
    for row in rows:
        if str(row.get("status") or "") != STATUS_ACCEPTED:
            continue
        if str(row.get("shift_id") or "") != shift_id:
            continue
        if _same_person(row, member):
            return True
    return False


def _planned_ms(db: Session, day: date) -> int:
    members = db.query(Member).all()
    if not members:
        return 0
    ids = [member.id for member in members]
    stored = {
        row.user_id: row
        for row in db.query(Assignment).filter(Assignment.user_id.in_(ids), Assignment.date == day)
    }
    suppressed = {
        (row.user_id, row.date)
        for row in db.query(SuppressedCarry).filter(
            SuppressedCarry.user_id.in_(ids),
            SuppressedCarry.date == day,
        )
    }
    total = 0
    for member in members:
        tag = str(project_cell(member, day, stored.get(member.id), suppressed).get("tag") or "").upper()
        if _is_ms(member, tag):
            total += 1
    return total


def _shift_names(db: Session) -> dict[str, str]:
    return {
        str(row.id): str(row.name or row.id)
        for row in db.query(MealShift).all()
    }


class CheckIn(BaseModel):
    srb_id: str = ""


class GuestIn(BaseModel):
    guest_name: str = ""
    guest_info: str = ""
    ref_info: str = ""


def _current_shift(db: Session):
    now = datetime.now(DHAKA)
    shifts = _load_shifts(db)
    return now, _match_shift(now, shifts)


@router.get("/api/v1/mess/checker/board")
def checker_board(
    staff: Staff = Depends(require_roles("mess_checker")),
    db: Session = Depends(get_db),
):
    branch = _branch(staff)
    now, shift = _current_shift(db)
    day = now.date()
    rows = _branch_rows(branch)
    guests = (
        db.query(GuestMeal)
        .filter(GuestMeal.date == day, GuestMeal.branch == branch)
        .count()
    )
    return envelope(
        {
            "branch": branch,
            "branch_label": _branch_label(branch),
            "manager": staff.display_name,
            "online": True,
            "date": day.isoformat(),
            "now": now.isoformat(),
            "shift": None
            if shift is None
            else {
                "id": shift["id"],
                "name": shift["name"],
                "start_time": shift["start_time"],
                "end_time": shift["end_time"],
                "seconds_left": _seconds_until_shift_end(now, shift),
            },
            "stats": {
                "planned": _planned_ms(db, day),
                "consumptions": sum(1 for row in rows if row.get("status") == STATUS_ACCEPTED),
                "duplicates": sum(1 for row in rows if row.get("status") == "already_accepted"),
                "guests": int(guests),
            },
        }
    )


@router.post("/api/v1/mess/checker/check-in")
def checker_check_in(
    body: CheckIn,
    staff: Staff = Depends(require_roles("mess_checker")),
    db: Session = Depends(get_db),
):
    branch = _branch(staff)
    member = _find_member(db, body.srb_id)
    if member is None:
        return envelope({"ok": False, "code": "not_found"})
    if has_rfid(member):
        return envelope({"ok": False, "code": "has_rfid", "name": member.name})
    day = mess_today()
    if not _is_ms(member, _today_tag(db, member, day)):
        return envelope({"ok": False, "code": "not_ms", "name": member.name})
    now, shift = _current_shift(db)
    if shift is None:
        return envelope({"ok": False, "code": "no_shift", "name": member.name})
    if _accepted_for_shift(_branch_rows(branch), member, str(shift["id"])):
        return envelope(
            {"ok": False, "code": "duplicate", "name": member.name, "shift_name": shift["name"]}
        )
    punched = now.replace(tzinfo=None)
    row = {
        "name": member.name,
        "pin": device_pin(member.rab_id) or device_pin(getattr(member, "personal_id", "")),
        "rab_id": member.rab_id,
        "rfid": "",
        "punched_at": punched.strftime("%Y-%m-%d %H:%M:%S"),
        "allowed": True,
        "status": STATUS_ACCEPTED,
        "shift_id": shift["id"],
        "shift_name": shift["name"],
        "source": "checker",
    }
    append_checker_punch(day.isoformat(), branch, row)
    return envelope(
        {
            "ok": True,
            "code": "accepted",
            "name": member.name,
            "shift_name": shift["name"],
            "branch_label": _branch_label(branch),
        }
    )


@router.post("/api/v1/mess/checker/guests")
def checker_guest(
    body: GuestIn,
    staff: Staff = Depends(require_roles("mess_checker")),
    db: Session = Depends(get_db),
):
    name = body.guest_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Guest name is required")
    now, shift = _current_shift(db)
    if shift is None:
        return envelope({"ok": False, "code": "no_shift"})
    branch = _branch(staff)
    row = GuestMeal(
        id=new_id("gm"),
        shift_id=str(shift["id"]),
        date=now.date(),
        check_in_time=now.strftime("%H:%M:%S"),
        guest_name=name,
        guest_info=body.guest_info.strip(),
        ref_info=body.ref_info.strip(),
        branch=branch,
    )
    db.add(row)
    db.commit()
    return envelope(
        {
            "ok": True,
            "code": "accepted",
            "id": row.id,
            "guest_name": row.guest_name,
            "shift_name": shift["name"],
            "branch": branch,
        },
        "Guest checked in",
        201,
    )


@router.get("/api/v1/mess/guest-list")
def guest_list(
    day: str = Query(""),
    branch: str = Query(""),
    staff: Staff = Depends(require_roles("mess", "mess_checker", "admin")),
    db: Session = Depends(get_db),
):
    try:
        chosen = date.fromisoformat(day) if day else mess_today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date") from exc
    query = db.query(GuestMeal).filter(GuestMeal.date == chosen)
    locked = ""
    if staff.role == "mess_checker":
        locked = _branch(staff)
        query = query.filter(GuestMeal.branch == locked)
    else:
        wanted = branch.strip().lower()
        if wanted == "hq":
            query = query.filter(GuestMeal.branch.in_(["hq", ""]))
        elif wanted == "haji":
            query = query.filter(GuestMeal.branch == "haji")
    names = _shift_names(db)
    items = []
    for row in query.order_by(GuestMeal.check_in_time.asc(), GuestMeal.guest_name.asc()).all():
        saved = (getattr(row, "branch", "") or "") or "hq"
        items.append(
            {
                "id": row.id,
                "date": row.date.isoformat(),
                "check_in_time": row.check_in_time,
                "shift_id": row.shift_id,
                "shift_name": names.get(row.shift_id, row.shift_id),
                "guest_name": row.guest_name,
                "guest_info": row.guest_info,
                "ref_info": row.ref_info,
                "branch": saved,
                "branch_label": _branch_label(saved),
            }
        )
    return envelope(
        {
            "date": chosen.isoformat(),
            "branch": locked,
            "items": items,
        }
    )
