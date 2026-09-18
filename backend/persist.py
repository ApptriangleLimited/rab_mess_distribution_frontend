"""Persist every remaining app slice in Postgres and assemble a full snapshot."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from auth import current_staff, require_roles
from permissions import filter_snapshot_body, require_permission
from database import SessionLocal, get_db
from models import (
    Assignment,
    AuthorizedStrength,
    BoroKhanaDay,
    CatalogState,
    DayLock,
    GuestMeal,
    ManpowerAbsent,
    MealAssign,
    MealPlan,
    MealShift,
    Member,
    PritibhojEvent,
    Rate,
    Sender,
    Staff,
    StateReport,
    SuppressedCarry,
    TagRequest,
)
from cache import bust_members

router = APIRouter()


def _rate_out(row: Rate) -> dict:
    from extra import rate_out

    return rate_out(row)


def _sender_out(row: Sender) -> dict:
    from extra import sender_out

    return sender_out(row)

CATALOG_KEYS = (
    "ranks",
    "wings",
    "wing_parent",
    "wing_labels",
    "wing_labels_bn",
    "wing_serials",
    "forces",
    "force_labels",
    "force_labels_bn",
    "force_serials",
    "force_ranks",
    "force_rank_extras",
    "force_rank_removed",
    "force_rank_labels",
    "force_rank_labels_bn",
    "force_rank_serials",
    "rank_labels",
    "rank_labels_bn",
    "rank_serials",
    "rank_forces",
    "rank_equivalents",
    "rank_force_wings",
    "member_banks",
    "manpower_held",
    "manpower_absent",
    "manpower_present",
    "manpower_absence_detail",
    "force_rank_officer",
    "paper_report_requests",
)


def envelope(data, message: str = "", status: int = 200):
    return JSONResponse(
        {"ok": True, "success": True, "message": message, "data": data},
        status_code=status,
    )


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def parse_day(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_demo_id(value: str) -> bool:
    return value.startswith("tr_demo_") or value.startswith("pb_demo_")


def _cockpit_police_members(today: date) -> list[dict]:
    joining = (today - timedelta(days=90)).isoformat()
    return [
        {
            "id": "u_seed_41",
            "name": "Rashedul Islam",
            "personal_id": "PN-11041",
            "rab_id": "SRB-3141",
            "rfid": "RFID-3141",
            "rank": "ASI",
            "wing": "Ops Wg",
            "force": "Police",
            "religion": "Islam",
            "member_type": "permanent",
            "dropdown_no": "",
            "phone": "01711200041",
            "blood_group": "B+",
            "status": "1",
            "approval_status": "approved",
            "bank_name": "Sonali Bank",
            "account_name": "Rashedul Islam",
            "account_number": "2202003141",
            "routing": "200270041",
            "branch": "Mirpur",
            "branch_location": "Dhaka",
            "documents": [
                {"name": "joining-order.pdf", "size": 352200},
                {"name": "id-photo.jpg", "size": 141100},
            ],
            "documents_verified": False,
            "joining_date": joining,
            "out_date": "",
            "default_tag": "MS",
            "emergency_contacts": [
                {"name": "Islam Father", "relation": "Father", "phone": "01811300041"}
            ],
            "inactive_spans": [],
        },
        {
            "id": "u_seed_42",
            "name": "Farzana Akter",
            "personal_id": "PN-11042",
            "rab_id": "SRB-3142",
            "rfid": "RFID-3142",
            "rank": "Constable",
            "wing": "Int Wg",
            "force": "Police",
            "religion": "Islam",
            "member_type": "permanent",
            "dropdown_no": "",
            "phone": "01711200042",
            "blood_group": "O+",
            "status": "1",
            "approval_status": "approved",
            "bank_name": "Community bank",
            "account_name": "Farzana Akter",
            "account_number": "2202003142",
            "routing": "200270042",
            "branch": "Uttara",
            "branch_location": "Dhaka",
            "documents": [
                {"name": "posting-order.pdf", "size": 356400},
                {"name": "id-photo.jpg", "size": 142200},
            ],
            "documents_verified": False,
            "joining_date": joining,
            "out_date": "",
            "default_tag": "FR",
            "emergency_contacts": [
                {"name": "Akter Spouse", "relation": "Spouse", "phone": "01811300042"}
            ],
            "inactive_spans": [],
        },
    ]


def seed_persist() -> None:
    db = SessionLocal()
    try:
        for row in db.query(TagRequest).filter(TagRequest.id.like("tr_demo_%")).all():
            db.delete(row)
        for row in db.query(PritibhojEvent).filter(PritibhojEvent.id.like("pb_demo_%")).all():
            db.delete(row)
        if db.get(CatalogState, "default") is None:
            db.add(CatalogState(id="default", payload={}))
        if db.query(MealShift).count() == 0:
            now = utcnow()
            for item in (
                ("breakfast", "Breakfast", "06:00", "09:00"),
                ("lunch", "Lunch", "12:00", "15:00"),
                ("dinner", "Dinner", "19:00", "22:00"),
            ):
                db.add(
                    MealShift(
                        id=item[0],
                        name=item[1],
                        start_time=item[2],
                        end_time=item[3],
                        description=item[1],
                        created_at=now,
                        updated_at=now,
                    )
                )
        db.commit()
        today = date.today()
        try:
            for raw in _cockpit_police_members(today):
                if db.get(Member, raw["id"]) is None:
                    upsert_member(db, raw)
                    upsert_assignment(
                        db,
                        {
                            "id": f"a_seed_{raw['id'][-2:]}_{today.strftime('%Y%m%d')}",
                            "user_id": raw["id"],
                            "date": today.isoformat(),
                            "tag": raw["default_tag"],
                            "updated_by": "daily",
                        },
                    )
            db.commit()
            bust_members()
        except Exception:
            db.rollback()
    finally:
        db.close()


def member_payload(row: Member) -> dict:
    from main import member_out

    return member_out(row)


def assignment_out(row: Assignment) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "date": row.date.isoformat(),
        "tag": row.tag,
        "trg_tone": row.trg_tone,
        "updated_by": row.updated_by,
        "updated_at": row.updated_at.isoformat() if row.updated_at else utcnow().isoformat(),
    }


def request_payload(row: TagRequest) -> dict:
    from main import request_out

    data = request_out(row)
    data.pop("member", None)
    return data


def authorized_out(row: AuthorizedStrength) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "count": int(row.count or 0),
        "wings": row.wings or {},
        "held_wings": row.held_wings or {},
    }


def state_report_out(row: StateReport) -> dict:
    return {
        "id": row.id,
        "date": row.date.isoformat(),
        "status": row.status,
        "submitted_at": row.submitted_at.isoformat() if row.submitted_at else "",
        "submitted_by": row.submitted_by,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "reviewed_by": row.reviewed_by or None,
        "note": row.note or None,
        "boro_khana": bool(row.boro_khana),
        "members": row.members or [],
        "totals": row.totals or {},
    }


def meal_shift_out(row: MealShift) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "description": row.description,
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def meal_plan_out(row: MealPlan) -> dict:
    return {
        "id": row.id,
        "date": row.date.isoformat(),
        "meals": row.meals or [],
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def meal_assign_out(row: MealAssign) -> dict:
    return {
        "id": row.id,
        "member_id": row.member_id,
        "shift_id": row.shift_id,
        "status": int(row.status),
        "date": row.date.isoformat(),
        "check_in_time": row.check_in_time,
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def guest_meal_out(row: GuestMeal) -> dict:
    return {
        "id": row.id,
        "shift_id": row.shift_id,
        "date": row.date.isoformat(),
        "check_in_time": row.check_in_time,
        "guest_name": row.guest_name,
        "guest_info": row.guest_info,
        "ref_info": row.ref_info,
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


def pritibhoj_out(row: PritibhojEvent) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "occasion": row.occasion,
        "date": row.date.isoformat(),
        "org": row.org,
        "main_rows": row.main_rows or [],
        "admin_rows": row.admin_rows or [],
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }


def upsert_pritibhoj(db: Session, raw: dict) -> PritibhojEvent | None:
    day = parse_day(raw.get("date"))
    if not day:
        return None
    event_id = str(raw.get("id") or new_id("pb"))
    if is_demo_id(event_id):
        return None
    row = db.get(PritibhojEvent, event_id)
    if row is None:
        row = PritibhojEvent(id=event_id, date=day, created_at=parse_dt(raw.get("created_at")) or utcnow())
        db.add(row)
    row.title = str(raw.get("title") or "").strip()
    row.occasion = str(raw.get("occasion") or "").strip()
    row.date = day
    row.org = str(raw.get("org") or "").strip()
    row.main_rows = raw.get("main_rows") or []
    row.admin_rows = raw.get("admin_rows") or []
    return row


class PritibhojIn(BaseModel):
    title: str = Field(min_length=1)
    occasion: str = ""
    date: str
    org: str = ""
    main_rows: list = Field(default_factory=list)
    admin_rows: list = Field(default_factory=list)


def build_snapshot(db: Session) -> dict:
    catalog = db.get(CatalogState, "default")
    payload = dict(catalog.payload or {}) if catalog else {}
    absent: dict[str, dict[str, int]] = {}
    for row in db.query(ManpowerAbsent).all():
        absent.setdefault(row.date.isoformat(), {})[row.wing] = row.count
    return {
        "users": [
            member_payload(row)
            for row in db.query(Member)
            .order_by(Member.created_at.desc(), Member.updated_at.desc(), Member.id.desc())
            .all()
        ],
        "assignments": [assignment_out(row) for row in db.query(Assignment).all()],
        "tag_requests": [
            request_payload(row)
            for row in db.query(TagRequest)
            .order_by(TagRequest.updated_at.desc(), TagRequest.requested_at.desc())
            .all()
        ],
        "senders": [_sender_out(row) for row in db.query(Sender).order_by(Sender.label).all()],
        "rates": [_rate_out(row) for row in db.query(Rate).order_by(Rate.tag).all()],
        **{
            key: payload.get(
                key,
                []
                if key
                in {
                    "ranks",
                    "wings",
                    "forces",
                    "member_banks",
                    "paper_report_requests",
                }
                else {},
            )
            for key in CATALOG_KEYS
        },
        "authorized": [authorized_out(row) for row in db.query(AuthorizedStrength).order_by(AuthorizedStrength.sort_order).all()],
        "manpower_officer_absent": absent,
        "approved_dates": [row.date.isoformat() for row in db.query(DayLock).all()],
        "suppressed_carries": [
            f"{row.user_id}|{row.date.isoformat()}" for row in db.query(SuppressedCarry).all()
        ],
        "boro_khana_dates": [row.date.isoformat() for row in db.query(BoroKhanaDay).all()],
        "state_reports": [state_report_out(row) for row in db.query(StateReport).all()],
        "meal_shifts": [meal_shift_out(row) for row in db.query(MealShift).all()],
        "meal_plans": [meal_plan_out(row) for row in db.query(MealPlan).all()],
        "meal_assigns": [meal_assign_out(row) for row in db.query(MealAssign).all()],
        "guest_meals": [guest_meal_out(row) for row in db.query(GuestMeal).all()],
        "pritibhoj_events": [pritibhoj_out(row) for row in db.query(PritibhojEvent).all()],
    }


def upsert_member(db: Session, raw: dict) -> None:
    from main import apply_member_fields
    from schemas import MemberIn

    member_id = str(raw.get("id") or new_id("u"))
    row = db.get(Member, member_id)
    if row is None:
        row = Member(id=member_id)
        db.add(row)
    body = MemberIn.model_validate(
        {
            "name": raw.get("name") or "Member",
            "rab_id": raw.get("rab_id") or "",
            "personal_id": raw.get("personal_id") or "",
            "rfid": raw.get("rfid") or "",
            "rank": raw.get("rank") or "",
            "wing": raw.get("wing") or "",
            "force": raw.get("force") or "",
            "force_rank": raw.get("force_rank") or "",
            "religion": raw.get("religion") or "",
            "member_type": raw.get("member_type") or "permanent",
            "dropdown_no": raw.get("dropdown_no") or "",
            "phone": raw.get("phone") or "",
            "blood_group": raw.get("blood_group") or "",
            "bank_name": raw.get("bank_name") or "",
            "account_name": raw.get("account_name") or "",
            "account_number": raw.get("account_number") or "",
            "routing": raw.get("routing") or "",
            "branch": raw.get("branch") or "",
            "branch_location": raw.get("branch_location") or "",
            "joining_date": parse_day(raw.get("joining_date")),
            "out_date": parse_day(raw.get("out_date")),
            "duty_start": parse_day(raw.get("duty_start")),
            "default_tag": raw.get("default_tag") or "",
            "documents": raw.get("documents") or [],
            "documents_verified": bool(raw.get("documents_verified")),
            "emergency_contacts": raw.get("emergency_contacts") or [],
            "status": raw.get("status") if raw.get("status") in ("0", "1") else "1",
            "approval_status": raw.get("approval_status") or "pending",
        }
    )
    apply_member_fields(row, body)
    if body.status in ("0", "1"):
        row.status = body.status
    if body.approval_status:
        from main import normalize_approval

        row.approval_status = normalize_approval(str(body.approval_status), row.approval_status)
    row.jl_end_date = str(raw.get("jl_end_date") or "")
    if isinstance(raw.get("inactive_spans"), list):
        row.inactive_spans = raw["inactive_spans"]


def upsert_assignment(db: Session, raw: dict) -> None:
    user_id = str(raw.get("user_id") or "")
    day = parse_day(raw.get("date"))
    if not user_id or not day or db.get(Member, user_id) is None:
        return
    existing = (
        db.query(Assignment)
        .filter(Assignment.user_id == user_id, Assignment.date == day)
        .first()
    )
    if existing is None:
        existing = Assignment(id=str(raw.get("id") or new_id("a")), user_id=user_id, date=day)
        db.add(existing)
    existing.tag = str(raw.get("tag") or "MS").upper()
    existing.trg_tone = raw.get("trg_tone")
    existing.updated_by = str(raw.get("updated_by") or "daily")
    existing.updated_at = parse_dt(raw.get("updated_at")) or utcnow()


def upsert_tag_request(db: Session, raw: dict) -> None:
    user_id = str(raw.get("user_id") or "")
    if not user_id or db.get(Member, user_id) is None:
        return
    req_id = str(raw.get("id") or new_id("tr"))
    if is_demo_id(req_id):
        return
    row = db.get(TagRequest, req_id)
    day = parse_day(raw.get("date")) or date.today()
    if row is None:
        row = TagRequest(id=req_id, user_id=user_id, date=day)
        db.add(row)
    row.user_id = user_id
    row.date = day
    row.from_date = parse_day(raw.get("from_date")) or day
    row.to_date = parse_day(raw.get("to_date")) or day
    row.from_tag = str(raw.get("from_tag") or "")
    row.to_tag = str(raw.get("to_tag") or "MS")
    row.trg_tone = raw.get("trg_tone")
    row.trg_sarda = raw.get("trg_sarda")
    row.queue = str(raw.get("queue") or "daily")
    row.status = str(raw.get("status") or "requested")
    row.requested_by = str(raw.get("requested_by") or "cc")
    row.requested_at = parse_dt(raw.get("requested_at")) or utcnow()
    row.updated_by = raw.get("updated_by")
    row.updated_at = parse_dt(raw.get("updated_at"))


def apply_catalog(db: Session, body: dict) -> None:
    row = db.get(CatalogState, "default")
    if row is None:
        row = CatalogState(id="default", payload={})
        db.add(row)
    payload = dict(row.payload or {})
    for key in CATALOG_KEYS:
        if key not in body:
            continue
        incoming = body[key]
        existing = payload.get(key)
        if incoming in ([], {}, None) and existing not in ([], {}, None, None):
            continue
        payload[key] = incoming
    row.payload = payload
    flag_modified(row, "payload")


def apply_authorized(db: Session, items: list) -> None:
    if not items and db.query(AuthorizedStrength).count() > 0:
        return
    db.query(AuthorizedStrength).delete()
    for i, raw in enumerate(items or []):
        db.add(
            AuthorizedStrength(
                id=str(raw.get("id") or new_id("az")),
                label=str(raw.get("label") or ""),
                count=int(raw.get("count") or 0),
                wings=raw.get("wings") or {},
                held_wings=raw.get("held_wings") or {},
                sort_order=i,
            )
        )


def apply_manpower(db: Session, mapping: dict) -> None:
    if not mapping and db.query(ManpowerAbsent).count() > 0:
        return
    db.query(ManpowerAbsent).delete()
    for day_key, wings in (mapping or {}).items():
        day = parse_day(day_key)
        if not day or not isinstance(wings, dict):
            continue
        for wing, count in wings.items():
            db.add(ManpowerAbsent(date=day, wing=str(wing), count=int(count or 0)))


def apply_state_reports(db: Session, items: list) -> None:
    if not items and db.query(StateReport).count() > 0:
        return
    keep = set()
    for raw in items or []:
        rid = str(raw.get("id") or new_id("sr"))
        keep.add(rid)
        day = parse_day(raw.get("date"))
        if not day:
            continue
        row = db.get(StateReport, rid)
        if row is None:
            row = StateReport(id=rid, date=day, submitted_at=utcnow())
            db.add(row)
        row.date = day
        row.status = str(raw.get("status") or "pending")
        row.submitted_at = parse_dt(raw.get("submitted_at")) or utcnow()
        row.submitted_by = str(raw.get("submitted_by") or "")
        row.reviewed_at = parse_dt(raw.get("reviewed_at"))
        row.reviewed_by = str(raw.get("reviewed_by") or "")
        row.note = str(raw.get("note") or "")
        row.boro_khana = bool(raw.get("boro_khana"))
        row.members = raw.get("members") or []
        row.totals = raw.get("totals") or {}
    for row in db.query(StateReport).all():
        if row.id not in keep and keep:
            db.delete(row)


def replace_simple(db: Session, model, items: list, builder) -> None:
    if items is None:
        return
    if len(items) == 0 and db.query(model).count() > 0:
        return
    db.query(model).delete()
    for raw in items:
        obj = builder(raw)
        if obj is not None:
            db.add(obj)


def apply_snapshot(db: Session, body: dict, *, replace_lists: bool) -> None:
    for raw in body.get("users") or []:
        upsert_member(db, raw)
    db.flush()
    for raw in body.get("assignments") or []:
        upsert_assignment(db, raw)
    for raw in body.get("tag_requests") or []:
        upsert_tag_request(db, raw)
    if any(key in body for key in CATALOG_KEYS):
        apply_catalog(db, body)
    if "authorized" in body:
        apply_authorized(db, body.get("authorized") or [])
    if "manpower_officer_absent" in body:
        apply_manpower(db, body.get("manpower_officer_absent") or {})
    if "state_reports" in body:
        apply_state_reports(db, body.get("state_reports") or [])
    if "meal_shifts" in body:
        replace_simple(
            db,
            MealShift,
            body.get("meal_shifts") or [],
            lambda raw: MealShift(
                id=str(raw.get("id") or new_id("ms")),
                name=str(raw.get("name") or ""),
                start_time=str(raw.get("start_time") or ""),
                end_time=str(raw.get("end_time") or ""),
                description=str(raw.get("description") or ""),
            ),
        )
    if "meal_plans" in body:
        replace_simple(
            db,
            MealPlan,
            body.get("meal_plans") or [],
            lambda raw: (
                MealPlan(
                    id=str(raw.get("id") or new_id("mp")),
                    date=parse_day(raw.get("date")),
                    meals=raw.get("meals") or [],
                )
                if parse_day(raw.get("date"))
                else None
            ),
        )
    if "meal_assigns" in body:
        replace_simple(
            db,
            MealAssign,
            body.get("meal_assigns") or [],
            lambda raw: (
                MealAssign(
                    id=str(raw.get("id") or new_id("ma")),
                    member_id=str(raw.get("member_id") or ""),
                    shift_id=str(raw.get("shift_id") or ""),
                    status=int(raw.get("status") or 1),
                    date=parse_day(raw.get("date")),
                    check_in_time=str(raw.get("check_in_time") or ""),
                )
                if parse_day(raw.get("date")) and raw.get("member_id")
                else None
            ),
        )
    if "guest_meals" in body:
        replace_simple(
            db,
            GuestMeal,
            body.get("guest_meals") or [],
            lambda raw: (
                GuestMeal(
                    id=str(raw.get("id") or new_id("gm")),
                    shift_id=str(raw.get("shift_id") or ""),
                    date=parse_day(raw.get("date")),
                    check_in_time=str(raw.get("check_in_time") or ""),
                    guest_name=str(raw.get("guest_name") or ""),
                    guest_info=str(raw.get("guest_info") or ""),
                    ref_info=str(raw.get("ref_info") or ""),
                )
                if parse_day(raw.get("date"))
                else None
            ),
        )
    if "pritibhoj_events" in body:
        for raw in body.get("pritibhoj_events") or []:
            upsert_pritibhoj(db, raw)
    if replace_lists:
        if "approved_dates" in body:
            db.query(DayLock).delete()
            for value in body.get("approved_dates") or []:
                day = parse_day(value)
                if day:
                    db.add(DayLock(date=day, locked_by="daily", locked_at=utcnow()))
        if "boro_khana_dates" in body:
            db.query(BoroKhanaDay).delete()
            for value in body.get("boro_khana_dates") or []:
                day = parse_day(value)
                if day:
                    db.add(BoroKhanaDay(date=day, updated_at=utcnow()))
        if "suppressed_carries" in body:
            db.query(SuppressedCarry).delete()
            for value in body.get("suppressed_carries") or []:
                if not isinstance(value, str) or "|" not in value:
                    continue
                user_id, day_s = value.split("|", 1)
                day = parse_day(day_s)
                if day and db.get(Member, user_id):
                    db.add(SuppressedCarry(user_id=user_id, date=day))


@router.get("/api/v1/app/snapshot")
def get_snapshot(
    _staff: Staff = Depends(require_permission("snapshot.read")),
    db: Session = Depends(get_db),
):
    return envelope(build_snapshot(db))


@router.put("/api/v1/app/snapshot")
def put_snapshot(
    body: dict,
    staff: Staff = Depends(require_permission("snapshot.write")),
    db: Session = Depends(get_db),
):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid snapshot")
    apply_snapshot(db, filter_snapshot_body(body, staff.role), replace_lists=True)
    db.commit()
    return envelope(build_snapshot(db), "Saved")


@router.post("/api/v1/app/import")
def import_snapshot(
    body: dict,
    _staff: Staff = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid import")
    apply_snapshot(db, body, replace_lists=False)
    if body.get("authorized") and db.query(AuthorizedStrength).count() == 0:
        apply_authorized(db, body.get("authorized") or [])
    if body.get("meal_shifts") and db.query(MealShift).count() == 0:
        apply_snapshot(db, {"meal_shifts": body["meal_shifts"]}, replace_lists=False)
    db.commit()
    return envelope(build_snapshot(db), "Imported")


def _norm_force(force: str) -> str:
    return (force or "").strip().lower().replace("-", " ").replace("_", " ")


def trg_ration_payable(tone: str | None, force: str) -> bool:
    """TRG red = money. TRG black = no money. Infer when tone is missing."""
    key = (tone or "").strip().lower()
    if key == "black":
        return False
    if key == "red":
        return True
    force_key = _norm_force(force)
    if force_key in {"army", "navy", "air force"}:
        return False
    if force_key == "bgb":
        return True
    if force_key in {"police", "ansar"}:
        return False
    return True


def month_bounds(month: str) -> tuple[date, date]:
    if len(month) != 7 or month[4] != "-":
        raise HTTPException(status_code=400, detail="Use YYYY-MM")
    year, month_n = int(month[:4]), int(month[5:7])
    start = date(year, month_n, 1)
    end = date(year, 12, 31) if month_n == 12 else date(year, month_n + 1, 1) - timedelta(days=1)
    return start, end


def consume_month_data(db: Session, month: str) -> dict:
    start, end = month_bounds(month)
    rates = {row.tag: float(row.amount_per_day) for row in db.query(Rate).all()}
    rows = (
        db.query(Assignment)
        .filter(Assignment.date >= start, Assignment.date <= end)
        .all()
    )
    by_user: dict[str, dict[str, int]] = {}
    for row in rows:
        by_user.setdefault(row.user_id, {})
        by_user[row.user_id][row.tag] = by_user[row.user_id].get(row.tag, 0) + 1
    payable_trg = {}
    force_by_user: dict[str, str] = {}
    for row in rows:
        if row.tag != "TRG":
            continue
        if row.user_id not in force_by_user:
            member = db.get(Member, row.user_id)
            force_by_user[row.user_id] = member.force if member else ""
        if not trg_ration_payable(row.trg_tone, force_by_user[row.user_id]):
            continue
        payable_trg[row.user_id] = payable_trg.get(row.user_id, 0) + 1

    items = []
    total = 0.0
    for user_id, tags in by_user.items():
        member = db.get(Member, user_id)
        if not member:
            continue
        amount = 0.0
        days = 0
        for tag, count in tags.items():
            days += count
            rate = rates.get(tag, 0)
            if rate <= 0:
                continue
            payable = payable_trg.get(user_id, 0) if tag == "TRG" else count
            amount += payable * rate
        total += amount
        items.append(
            {
                "user": member_payload(member),
                "tagDays": tags,
                "totalDays": days,
                "amount": round(amount, 2),
            }
        )
    return {"month": month, "rows": items, "totalAmount": round(total, 2)}


@router.get("/api/v1/reports/consume/{month}")
def consume_month_report(
    month: str,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    return envelope(consume_month_data(db, month))


@router.get("/api/v1/reports/ration/{month}")
def ration_month_report(
    month: str,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    data = consume_month_data(db, month)
    data["senders"] = [_sender_out(row) for row in db.query(Sender).all()]
    return envelope(data)


def manpower_day_data(db: Session, target: date) -> dict:
    """Roster + projected Daily tags for one day (same rules as the cockpit)."""
    from daily import can_assign, load_window, project_cell

    members, stored_map, suppressed = load_window(db, target, target, None, None, None)
    items = []
    for member in members:
        if member.status != "1":
            continue
        if member.member_type != "permanent":
            continue
        if not can_assign(member, target):
            continue
        cell = project_cell(
            member,
            target,
            stored_map.get((member.id, target)),
            suppressed,
        )
        source = cell.get("source") or "empty"
        painted = str(cell.get("tag") or "").upper()
        default = (member.default_tag or "MS").upper()
        if source == "suppressed":
            tag = ""
        else:
            tag = painted or default
        items.append(
            {
                "id": member.id,
                "name": member.name,
                "rank": member.rank,
                "wing": member.wing,
                "force": member.force or "",
                "force_rank": member.force_rank or "",
                "member_type": member.member_type,
                "status": member.status,
                "approval_status": member.approval_status,
                "joining_date": member.joining_date.isoformat()
                if member.joining_date
                else "",
                "duty_start": member.duty_start.isoformat()
                if member.duty_start
                else "",
                "out_date": member.out_date.isoformat() if member.out_date else "",
                "inactive_spans": member.inactive_spans or [],
                "default_tag": default,
                "tag": tag,
                "source": source,
            }
        )
    catalog = db.get(CatalogState, "default")
    payload = dict(catalog.payload or {}) if catalog else {}
    wings = list(payload.get("wings") or [])
    seen = {str(w).strip().lower() for w in wings if str(w).strip()}
    for item in items:
        wing = str(item.get("wing") or "").strip()
        if wing and wing.lower() not in seen:
            wings.append(wing)
            seen.add(wing.lower())
    return {
        "date": target.isoformat(),
        "members": items,
        "authorized": [
            authorized_out(row)
            for row in db.query(AuthorizedStrength).order_by(AuthorizedStrength.sort_order)
        ],
        "officer_absent": {
            row.wing: row.count
            for row in db.query(ManpowerAbsent).filter(ManpowerAbsent.date == target)
        },
        "wings": wings,
        "wing_parent": payload.get("wing_parent") or {},
    }


@router.get("/api/v1/reports/manpower")
def manpower_report(
    day: str,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    target = parse_day(day)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid date")
    return envelope(manpower_day_data(db, target))


def report_source_data(db: Session, start: date, end: date) -> dict:
    """Members, stored tags, rates, and senders from Postgres for report builders."""
    if end < start:
        start, end = end, start
    lookback = start - timedelta(days=90)
    members = (
        db.query(Member)
        .filter(Member.approval_status == "approved")
        .all()
    )
    assignments = (
        db.query(Assignment)
        .filter(Assignment.date >= lookback, Assignment.date <= end)
        .all()
    )
    suppressed = (
        db.query(SuppressedCarry)
        .filter(SuppressedCarry.date >= start, SuppressedCarry.date <= end)
        .all()
    )
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "users": [member_payload(row) for row in members],
        "assignments": [assignment_out(row) for row in assignments],
        "rates": [_rate_out(row) for row in db.query(Rate).all()],
        "senders": [_sender_out(row) for row in db.query(Sender).all()],
        "suppressed_carries": [
            f"{row.user_id}|{row.date.isoformat()}" for row in suppressed
        ],
    }


@router.get("/api/v1/reports/source")
def report_source(
    month: str | None = None,
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    if month:
        start, end = month_bounds(month)
    else:
        start = parse_day(date_from)
        end = parse_day(date_to) or start
        if not start or not end:
            raise HTTPException(status_code=400, detail="Use month=YYYY-MM or from/to")
    return envelope(report_source_data(db, start, end))


def mess_checkins_data(db: Session, start: date, end: date) -> dict:
    if end < start:
        start, end = end, start
    assigns = (
        db.query(MealAssign)
        .filter(MealAssign.date >= start, MealAssign.date <= end)
        .all()
    )
    guests = (
        db.query(GuestMeal)
        .filter(GuestMeal.date >= start, GuestMeal.date <= end)
        .all()
    )
    member_ids = {row.member_id for row in assigns}
    members = (
        db.query(Member).filter(Member.id.in_(member_ids)).all() if member_ids else []
    )
    extra = (
        db.query(Member)
        .filter(Member.approval_status == "approved", Member.status == "1")
        .all()
    )
    by_id = {row.id: row for row in extra}
    for row in members:
        by_id[row.id] = row
    boro = (
        db.query(BoroKhanaDay)
        .filter(BoroKhanaDay.date >= start, BoroKhanaDay.date <= end)
        .all()
    )
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "assigns": [meal_assign_out(row) for row in assigns],
        "guests": [guest_meal_out(row) for row in guests],
        "shifts": [meal_shift_out(row) for row in db.query(MealShift).all()],
        "members": [member_payload(row) for row in by_id.values()],
        "boro_khana_dates": [row.date.isoformat() for row in boro],
    }


@router.get("/api/v1/mess/checkins")
def mess_checkins(
    date_from: str = Query(..., alias="from"),
    date_to: str = Query(..., alias="to"),
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    start = parse_day(date_from)
    end = parse_day(date_to)
    if not start or not end:
        raise HTTPException(status_code=400, detail="Invalid date range")
    return envelope(mess_checkins_data(db, start, end))


def state_report_draft_data(db: Session, target: date) -> dict:
    mp = manpower_day_data(db, target)
    boro = db.get(BoroKhanaDay, target) is not None
    members_out = []
    by_tag: dict[str, int] = {}
    mess_eaters = 0
    for row in mp["members"]:
        member = db.get(Member, row["id"])
        tag = str(row.get("tag") or "").upper()
        if tag:
            by_tag[tag] = by_tag.get(tag, 0) + 1
        if boro or tag == "MS":
            mess_eaters += 1
        members_out.append(
            {
                "user_id": row["id"],
                "tag": tag,
                "mess_reason": "MS" if (not boro and tag == "MS") else ("BK" if boro else None),
                "name": row["name"],
                "rab_id": member.rab_id if member else "",
                "rank": row["rank"],
                "wing": row["wing"],
            }
        )
    return {
        "date": target.isoformat(),
        "boro_khana": boro,
        "members": members_out,
        "totals": {
            "active": len(members_out),
            "by_tag": by_tag,
            "mess_eaters": mess_eaters,
        },
    }


@router.get("/api/v1/state-reports")
def list_state_reports(
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    rows = db.query(StateReport).order_by(StateReport.submitted_at.desc()).all()
    return envelope([state_report_out(row) for row in rows])


@router.get("/api/v1/state-reports/draft")
def state_report_draft(
    day: str,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    target = parse_day(day)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid date")
    return envelope(state_report_draft_data(db, target))


@router.get("/api/v1/state-reports/{report_id}")
def get_state_report(
    report_id: str,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    row = db.get(StateReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="State report not found")
    return envelope(state_report_out(row))


@router.post("/api/v1/state-reports")
def submit_state_report(
    day: str,
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    target = parse_day(day)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid date")
    draft = state_report_draft_data(db, target)
    existing = (
        db.query(StateReport)
        .filter(StateReport.date == target, StateReport.status == "pending")
        .all()
    )
    for row in existing:
        db.delete(row)
    row = StateReport(
        id=new_id("sr"),
        date=target,
        status="pending",
        submitted_at=utcnow(),
        submitted_by=f"{staff.role}:{staff.name}",
        boro_khana=bool(draft["boro_khana"]),
        members=draft["members"],
        totals=draft["totals"],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return envelope(state_report_out(row), "Submitted")


class StateReviewIn(BaseModel):
    status: str
    note: str = ""


@router.post("/api/v1/state-reports/{report_id}/review")
def review_state_report(
    report_id: str,
    body: StateReviewIn,
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be approved or rejected")
    row = db.get(StateReport, report_id)
    if not row:
        raise HTTPException(status_code=404, detail="State report not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Report is not pending")
    row.status = body.status
    row.reviewed_at = utcnow()
    row.reviewed_by = f"{staff.role}:{staff.name}"
    if body.status == "rejected":
        row.note = body.note or row.note
    db.commit()
    db.refresh(row)
    return envelope(state_report_out(row), "Updated")


PRITIBHOJ_WRITE = ("mess", "admin")


@router.get("/api/v1/pritibhoj")
def list_pritibhoj(
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    rows = db.query(PritibhojEvent).order_by(PritibhojEvent.date.desc(), PritibhojEvent.created_at.desc()).all()
    return envelope([pritibhoj_out(row) for row in rows])


@router.get("/api/v1/pritibhoj/{event_id}")
def get_pritibhoj(
    event_id: str,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    row = db.get(PritibhojEvent, event_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Pritibhoj not found")
    return envelope(pritibhoj_out(row))


@router.post("/api/v1/pritibhoj")
def create_pritibhoj(
    body: PritibhojIn,
    _staff: Staff = Depends(require_roles(*PRITIBHOJ_WRITE)),
    db: Session = Depends(get_db),
):
    row = upsert_pritibhoj(db, {**body.model_dump(), "id": new_id("pb")})
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid date")
    db.commit()
    db.refresh(row)
    return envelope(pritibhoj_out(row), "Saved", 201)


@router.put("/api/v1/pritibhoj/{event_id}")
def update_pritibhoj(
    event_id: str,
    body: PritibhojIn,
    _staff: Staff = Depends(require_roles(*PRITIBHOJ_WRITE)),
    db: Session = Depends(get_db),
):
    if db.get(PritibhojEvent, event_id) is None:
        raise HTTPException(status_code=404, detail="Pritibhoj not found")
    row = upsert_pritibhoj(db, {**body.model_dump(), "id": event_id})
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid date")
    db.commit()
    db.refresh(row)
    return envelope(pritibhoj_out(row), "Saved")


@router.delete("/api/v1/pritibhoj/{event_id}")
def delete_pritibhoj(
    event_id: str,
    _staff: Staff = Depends(require_roles(*PRITIBHOJ_WRITE)),
    db: Session = Depends(get_db),
):
    row = db.get(PritibhojEvent, event_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Pritibhoj not found")
    db.delete(row)
    db.commit()
    return envelope({"id": event_id}, "Deleted")
