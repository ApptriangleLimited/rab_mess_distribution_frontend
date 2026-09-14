"""Rates, senders, mess, public register, ZK — served by the Docker API."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import current_staff, hash_password, require_roles
from security import validate_password
from rate_limit import enforce_register_limit
from database import SessionLocal, get_db
from models import Assignment, BoroKhanaDay, Member, Rate, Sender, Staff
from schemas import DUTY_TAGS, MemberIn

router = APIRouter()

SETTINGS_WRITE = ("ration", "admin")
PROTECTED_RATE_TAGS = {"FR", "MS", "FUEL", "CLFR"}
DEFAULT_RATES = [
    ("FR", 220, True, True),
    ("MS", 180, True, True),
    ("CL", 220, True, False),
    ("CD", 220, True, False),
    ("TRG", 220, True, False),
    ("MED", 220, True, False),
    ("RL", 220, True, False),
    ("FUEL", 50, False, True),
    ("CLFR", 2500, False, True),
]
DEFAULT_SENDERS = [
    {
        "id": "s_fresh_trust_bank",
        "label": "Fresh Money - Trust Bank",
        "bank_name": "Trust bank",
        "account_name": "Fresh Money",
        "account_number": "9002001001",
        "routing": "100000001",
        "mapped_tags": ["FR", "CL", "CD", "TRG", "MED", "RL"],
    },
    {
        "id": "s_fresh_community_bank",
        "label": "Fresh Money - Community Bank",
        "bank_name": "Community bank",
        "account_name": "Fresh Money",
        "account_number": "9002001002",
        "routing": "100000002",
        "mapped_tags": ["FR", "CL", "CD", "TRG", "MED", "RL"],
    },
    {
        "id": "s_fresh_sonali_bank",
        "label": "Fresh Money - Sonali Bank",
        "bank_name": "Sonali Bank",
        "account_name": "Fresh Money",
        "account_number": "9002001003",
        "routing": "100000003",
        "mapped_tags": ["FR", "CL", "CD", "TRG", "MED", "RL"],
    },
    {
        "id": "s_fuel_trust_bank",
        "label": "FR Fuel - Trust Bank",
        "bank_name": "Trust bank",
        "account_name": "FR Fuel",
        "account_number": "9002002001",
        "routing": "200000001",
        "mapped_tags": ["FUEL"],
    },
    {
        "id": "s_fuel_community_bank",
        "label": "FR Fuel - Community Bank",
        "bank_name": "Community bank",
        "account_name": "FR Fuel",
        "account_number": "9002002002",
        "routing": "200000002",
        "mapped_tags": ["FUEL"],
    },
    {
        "id": "s_fuel_sonali_bank",
        "label": "FR Fuel - Sonali Bank",
        "bank_name": "Sonali Bank",
        "account_name": "FR Fuel",
        "account_number": "9002002003",
        "routing": "200000003",
        "mapped_tags": ["FUEL"],
    },
]


def envelope(data, message: str = "", status: int = 200):
    return JSONResponse(
        {"ok": True, "success": True, "message": message, "data": data},
        status_code=status,
    )


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


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


def member_payload(row: Member) -> dict:
    from main import member_out

    return member_out(row)


def rate_out(row: Rate) -> dict:
    return {
        "tag": row.tag,
        "amount_per_day": float(row.amount_per_day),
        "is_builtin": bool(row.is_builtin),
        "is_protected": bool(row.is_protected),
    }


def sender_out(row: Sender) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "bank_name": row.bank_name,
        "account_name": row.account_name,
        "account_number": row.account_number,
        "routing": row.routing,
        "branch": row.branch,
        "branch_location": row.branch_location,
        "mapped_tags": list(row.mapped_tags or []),
        "active": bool(row.active),
    }


def seed_catalog() -> None:
    db = SessionLocal()
    try:
        if db.query(Rate).count() == 0:
            for tag, amount, builtin, protected in DEFAULT_RATES:
                db.add(
                    Rate(
                        tag=tag,
                        amount_per_day=amount,
                        is_builtin=builtin,
                        is_protected=protected,
                    )
                )
        if db.query(Sender).count() == 0:
            for item in DEFAULT_SENDERS:
                db.add(
                    Sender(
                        id=item["id"],
                        label=item["label"],
                        bank_name=item["bank_name"],
                        account_name=item["account_name"],
                        account_number=item["account_number"],
                        routing=item["routing"],
                        branch="Head Office",
                        branch_location="Dhaka",
                        mapped_tags=item["mapped_tags"],
                        active=True,
                    )
                )
        db.commit()
    finally:
        db.close()


class RateIn(BaseModel):
    tag: str
    amount_per_day: float = 0


class RatesPutIn(BaseModel):
    items: list[RateIn] = Field(default_factory=list)


class SenderIn(BaseModel):
    label: str = ""
    bank_name: str = ""
    account_name: str = ""
    account_number: str = ""
    routing: str = ""
    branch: str = ""
    branch_location: str = ""
    mapped_tags: list[str] = Field(default_factory=list)
    active: bool = True


@router.get("/api/v1/auth/me")
def auth_me(staff: Staff = Depends(current_staff)):
    return envelope(
        {
            "id": staff.id,
            "email": staff.email,
            "display_name": staff.display_name,
            "role": staff.role,
            "mfa_enabled": bool(staff.mfa_enabled),
        }
    )


class ProfileIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=255)
    username: str = ""
    password: str = ""


@router.patch("/api/v1/auth/me")
def update_me(
    body: ProfileIn,
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    name = body.display_name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name is too short")
    row = db.get(Staff, staff.id)
    if row is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    row.display_name = name
    username = (body.username or "").strip().lower()
    if username:
        taken = (
            db.query(Staff)
            .filter(func.lower(Staff.email) == username, Staff.id != row.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=409, detail="Username is already in use")
        row.email = username
    password = (body.password or "").strip()
    if password:
        error = validate_password(password, username or row.email)
        if error:
            raise HTTPException(status_code=400, detail=error)
        row.password_hash = hash_password(password)
    db.commit()
    return envelope(
        {
            "id": row.id,
            "email": row.email,
            "display_name": row.display_name,
            "role": row.role,
            "mfa_enabled": bool(row.mfa_enabled),
        },
        "Updated",
    )


STAFF_ROLES = ("cc", "daily", "mess", "consume", "ration", "admin")
STAFF_MANAGE = ("admin", "mess")


def staff_out(row: Staff) -> dict:
    return {
        "id": row.id,
        "email": row.email,
        "display_name": row.display_name,
        "role": row.role,
        "active": bool(row.active),
    }


class StaffCreateIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=255)
    username: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=1, max_length=255)
    role: str


class StaffUpdateIn(BaseModel):
    display_name: str = ""
    username: str = ""
    password: str = ""
    role: str = ""
    active: bool | None = None


def _staff_username_taken(db: Session, username: str, exclude_id: str | None = None) -> bool:
    query = db.query(Staff).filter(func.lower(Staff.email) == username)
    if exclude_id:
        query = query.filter(Staff.id != exclude_id)
    return query.first() is not None


@router.get("/api/v1/staff")
def list_staff(
    _staff: Staff = Depends(require_roles(*STAFF_MANAGE)),
    db: Session = Depends(get_db),
):
    rows = db.query(Staff).order_by(Staff.role.asc(), Staff.display_name.asc()).all()
    return envelope({"items": [staff_out(row) for row in rows]})


@router.post("/api/v1/staff")
def create_staff(
    body: StaffCreateIn,
    _staff: Staff = Depends(require_roles(*STAFF_MANAGE)),
    db: Session = Depends(get_db),
):
    name = body.display_name.strip()
    username = body.username.strip().lower()
    role = body.role.strip().lower()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name is too short")
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="Username is required")
    if role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if _staff_username_taken(db, username):
        raise HTTPException(status_code=409, detail="Username is already in use")
    error = validate_password(body.password, username)
    if error:
        raise HTTPException(status_code=400, detail=error)
    row = Staff(
        id=new_id("st"),
        email=username,
        display_name=name,
        role=role,
        password_hash=hash_password(body.password),
        active=True,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username is already in use") from exc
    db.refresh(row)
    return envelope(staff_out(row), "Staff created", 201)


@router.patch("/api/v1/staff/{staff_id}")
def update_staff(
    staff_id: str,
    body: StaffUpdateIn,
    actor: Staff = Depends(require_roles(*STAFF_MANAGE)),
    db: Session = Depends(get_db),
):
    row = db.get(Staff, staff_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    name = (body.display_name or "").strip()
    if name:
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name is too short")
        row.display_name = name
    username = (body.username or "").strip().lower()
    if username:
        if _staff_username_taken(db, username, row.id):
            raise HTTPException(status_code=409, detail="Username is already in use")
        row.email = username
    role = (body.role or "").strip().lower()
    if role:
        if role not in STAFF_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        if row.id == actor.id and role != actor.role:
            raise HTTPException(status_code=400, detail="You cannot change your own role")
        row.role = role
    password = (body.password or "").strip()
    if password:
        error = validate_password(password, username or row.email)
        if error:
            raise HTTPException(status_code=400, detail=error)
        row.password_hash = hash_password(password)
    if body.active is not None:
        if row.id == actor.id and not body.active:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        if row.role == "admin" and row.active and not body.active:
            other_admins = (
                db.query(Staff)
                .filter(Staff.role == "admin", Staff.active.is_(True), Staff.id != row.id)
                .count()
            )
            if other_admins == 0:
                raise HTTPException(status_code=400, detail="Keep at least one active admin")
        row.active = bool(body.active)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username is already in use") from exc
    db.refresh(row)
    return envelope(staff_out(row), "Updated")


@router.get("/api/v1/settings/rates")
def list_rates(
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    rows = db.query(Rate).order_by(Rate.tag.asc()).all()
    return envelope({"items": [rate_out(row) for row in rows]})


@router.put("/api/v1/settings/rates")
def put_rates(
    body: RatesPutIn,
    _staff: Staff = Depends(require_roles(*SETTINGS_WRITE)),
    db: Session = Depends(get_db),
):
    seen: set[str] = set()
    for item in body.items:
        tag = (item.tag or "").strip().upper()
        if not tag:
            continue
        seen.add(tag)
        row = db.get(Rate, tag)
        if row is None:
            row = Rate(
                tag=tag,
                amount_per_day=item.amount_per_day,
                is_builtin=tag in DUTY_TAGS,
                is_protected=tag in PROTECTED_RATE_TAGS,
            )
            db.add(row)
        else:
            row.amount_per_day = item.amount_per_day
    for row in db.query(Rate).all():
        if row.tag not in seen and not row.is_protected:
            db.delete(row)
    db.commit()
    rows = db.query(Rate).order_by(Rate.tag.asc()).all()
    return envelope({"items": [rate_out(row) for row in rows]})


@router.post("/api/v1/settings/rates")
def create_rate(
    body: RateIn,
    _staff: Staff = Depends(require_roles(*SETTINGS_WRITE)),
    db: Session = Depends(get_db),
):
    tag = (body.tag or "").strip().upper()
    if not tag:
        raise HTTPException(status_code=400, detail="Tag is required")
    if db.get(Rate, tag):
        raise HTTPException(status_code=409, detail="Rate already exists")
    row = Rate(
        tag=tag,
        amount_per_day=body.amount_per_day,
        is_builtin=tag in DUTY_TAGS,
        is_protected=tag in PROTECTED_RATE_TAGS,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return envelope(rate_out(row), "Rate created", 201)


@router.delete("/api/v1/settings/rates/{tag}")
def delete_rate(
    tag: str,
    _staff: Staff = Depends(require_roles(*SETTINGS_WRITE)),
    db: Session = Depends(get_db),
):
    key = tag.strip().upper()
    row = db.get(Rate, key)
    if row is None:
        raise HTTPException(status_code=404, detail="Rate not found")
    if row.is_protected:
        raise HTTPException(status_code=400, detail="Protected rate")
    db.delete(row)
    db.commit()
    return envelope({"tag": key}, "Rate deleted")


@router.get("/api/v1/senders")
def list_senders(
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    rows = db.query(Sender).order_by(Sender.label.asc()).all()
    return envelope({"items": [sender_out(row) for row in rows]})


@router.post("/api/v1/senders")
def create_sender(
    body: SenderIn,
    _staff: Staff = Depends(require_roles(*SETTINGS_WRITE)),
    db: Session = Depends(get_db),
):
    row = Sender(
        id=new_id("s"),
        label=body.label or body.account_name or body.bank_name,
        bank_name=body.bank_name,
        account_name=body.account_name,
        account_number=body.account_number,
        routing=body.routing,
        branch=body.branch,
        branch_location=body.branch_location,
        mapped_tags=[t.strip().upper() for t in body.mapped_tags if t.strip()],
        active=body.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return envelope(sender_out(row), "Sender created", 201)


@router.put("/api/v1/senders/{sender_id}")
def update_sender(
    sender_id: str,
    body: SenderIn,
    _staff: Staff = Depends(require_roles(*SETTINGS_WRITE)),
    db: Session = Depends(get_db),
):
    row = db.get(Sender, sender_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Sender not found")
    row.label = body.label or body.account_name or body.bank_name or row.label
    row.bank_name = body.bank_name
    row.account_name = body.account_name
    row.account_number = body.account_number
    row.routing = body.routing
    row.branch = body.branch
    row.branch_location = body.branch_location
    row.mapped_tags = [t.strip().upper() for t in body.mapped_tags if t.strip()]
    row.active = body.active
    db.commit()
    db.refresh(row)
    return envelope(sender_out(row), "Sender updated")


@router.delete("/api/v1/senders/{sender_id}")
def delete_sender(
    sender_id: str,
    _staff: Staff = Depends(require_roles(*SETTINGS_WRITE)),
    db: Session = Depends(get_db),
):
    row = db.get(Sender, sender_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Sender not found")
    db.delete(row)
    db.commit()
    return envelope({"id": sender_id}, "Sender deleted")


@router.post("/api/v1/public/register")
def public_register(body: MemberIn, request: Request, db: Session = Depends(get_db)):
    from main import apply_member_fields, find_member_by_rab

    enforce_register_limit(request)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if body.member_type != "guest" and not body.rab_id.strip():
        raise HTTPException(status_code=400, detail="SRB ID is required")
    if find_member_by_rab(db, body.rab_id):
        raise HTTPException(status_code=409, detail="A member with this SRB ID already exists")
    row = Member(id=new_id("u"), created_by=None)
    apply_member_fields(row, body)
    row.status = "1"
    row.approval_status = "pending"
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A member with this SRB ID already exists") from exc
    db.refresh(row)
    return envelope(
        {
            "id": row.id,
            "name": row.name,
            "rab_id": row.rab_id,
            "approval_status": row.approval_status,
            "status": row.status,
        },
        "Member request sent successfully",
        201,
    )


def _match_member(row: Member, q: str | None, rank: str | None, wing: str | None) -> bool:
    if rank and (row.rank or "") != rank:
        return False
    if wing and (row.wing or "") != wing:
        return False
    if q:
        blob = " ".join(
            [
                row.name or "",
                row.rab_id or "",
                row.rank or "",
                row.wing or "",
                row.phone or "",
            ]
        ).lower()
        if q.strip().lower() not in blob:
            return False
    return True


def _bk_reason(tag: str | None) -> str:
    if tag == "MS":
        return "MS"
    if tag == "FR":
        return "FR"
    return "BK"


@router.get("/api/v1/mess/eaters")
def mess_eaters(
    day: str = Query(..., alias="date"),
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    target = parse_day(day)
    boro = db.get(BoroKhanaDay, target) is not None
    members = {
        row.id: row
        for row in db.query(Member).filter(
            Member.approval_status == "approved",
            Member.status == "1",
        )
    }
    stored = {
        row.user_id: row
        for row in db.query(Assignment).filter(Assignment.date == target)
    }
    items = []
    if boro:
        for member in members.values():
            if not _match_member(member, q, rank, wing):
                continue
            assign = stored.get(member.id)
            payload = member_payload(member)
            payload["assignment_id"] = assign.id if assign else f"bk-{member.id}-{target.isoformat()}"
            payload["mess_reason"] = _bk_reason(assign.tag if assign else None)
            items.append(payload)
    else:
        for assign in stored.values():
            if assign.tag != "MS":
                continue
            member = members.get(assign.user_id)
            if member is None or not _match_member(member, q, rank, wing):
                continue
            payload = member_payload(member)
            payload["assignment_id"] = assign.id
            payload["mess_reason"] = "MS"
            items.append(payload)
    items.sort(key=lambda row: row.get("name") or "")
    return envelope(
        {
            "date": target.isoformat(),
            "boro_khana": boro,
            "items": items,
            "total": len(items),
        }
    )


@router.get("/api/v1/mess/ledger")
def mess_ledger(
    date_from: str = Query(..., alias="from"),
    date_to: str = Query(..., alias="to"),
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    start = parse_day(date_from, "from")
    end = parse_day(date_to, "to")
    if end < start:
        start, end = end, start
    days = list(each_date(start, end))
    members = [
        row
        for row in db.query(Member).filter(Member.approval_status == "approved")
        if _match_member(row, q, rank, wing)
    ]
    assigns = db.query(Assignment).filter(
        Assignment.date >= start,
        Assignment.date <= end,
    ).all()
    by_user: dict[str, dict[date, str]] = {}
    for row in assigns:
        by_user.setdefault(row.user_id, {})[row.date] = row.tag
    boro_days = {
        row.date
        for row in db.query(BoroKhanaDay).filter(
            BoroKhanaDay.date >= start,
            BoroKhanaDay.date <= end,
        )
    }
    tag_codes = sorted({tag for mapping in by_user.values() for tag in mapping.values()})
    rows = []
    for member in members:
        mapping = by_user.get(member.id, {})
        cells = [mapping.get(day, "") for day in days]
        counts: dict[str, int] = {}
        for tag in cells:
            if not tag:
                continue
            counts[tag] = counts.get(tag, 0) + 1
        if not any(cells):
            continue
        rows.append(
            {
                "member": member_payload(member),
                "days": cells,
                "tag_counts": counts,
                "total_days": sum(1 for tag in cells if tag),
            }
        )
    return envelope(
        {
            "from": start.isoformat(),
            "to": end.isoformat(),
            "dates": [day.isoformat() for day in days],
            "tag_codes": tag_codes,
            "rows": rows,
            "boro_khana_days": [
                {
                    "date": day.isoformat(),
                    "eater_count": sum(
                        1
                        for member in members
                        if member.status == "1"
                    ),
                }
                for day in sorted(boro_days)
            ],
        }
    )


@router.get("/api/v1/zk/demo/status")
def zk_status(_staff: Staff = Depends(current_staff)):
    return envelope(
        {
            "reachable": False,
            "host": "",
            "port": 4370,
            "latency_ms": 0,
            "error": "ZK device is not configured on the Docker API",
        }
    )


@router.get("/api/v1/zk/demo/users")
def zk_users(_staff: Staff = Depends(current_staff)):
    return envelope({"items": [], "total": 0})


@router.get("/api/v1/zk/demo/attendance")
def zk_attendance(_staff: Staff = Depends(current_staff)):
    return envelope(
        {"items": [], "total": 0, "limit": None, "from": None, "to": None}
    )
