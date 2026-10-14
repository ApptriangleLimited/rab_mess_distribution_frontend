"""Rates, senders, mess, public register, ZK — served by the Docker API."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from account import catalog_payload, file_out
from auth import current_staff, hash_password, require_roles
from security import decrypt_secret, encrypt_secret, validate_password
from rate_limit import enforce_register_limit
from database import SessionLocal, get_db
from models import Assignment, BoroKhanaDay, FileObject, Member, Rate, Sender, Staff
from persist import CATALOG_KEYS
from schemas import DUTY_TAGS, MemberIn
from storage import IMAGE_MAX_BYTES, StorageError, checksum, put_bytes, sniff_image_mime
from config import settings
from zk_gate import gate_snapshot, refresh_gate, start_sync

try:
    from auth import normalize_staff_login_id, staff_login_id_from_body
except ImportError:
    def normalize_staff_login_id(value: str) -> str:
        raw = (value or "").strip()
        if not raw:
            return ""
        if "@" in raw:
            return raw.lower()
        return raw.upper()

    def staff_login_id_from_body(body: object) -> str:
        for key in ("srb_id", "rab_id", "email", "username"):
            value = str(getattr(body, key, "") or "").strip()
            if value:
                return value
        return ""

try:
    from auth import set_staff_password
except ImportError:
    def set_staff_password(row: Staff, password: str) -> None:
        row.password_hash = hash_password(password)
        row.password_vault = encrypt_secret(password)

router = APIRouter()

SETTINGS_WRITE = ("ration", "admin")
DEFAULT_RATES = [
    ("FR", 220, True, False),
    ("MS", 180, True, False),
    ("CL", 220, True, False),
    ("CD", 220, True, False),
    ("TRG", 220, True, False),
    ("MED", 220, True, False),
    ("RL", 220, True, False),
    ("FUEL", 50, False, False),
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
        "label": "Firewood FR - Trust Bank",
        "bank_name": "Trust bank",
        "account_name": "Firewood FR",
        "account_number": "9002002001",
        "routing": "200000001",
        "mapped_tags": ["FUEL"],
    },
    {
        "id": "s_fuel_community_bank",
        "label": "Firewood FR - Community Bank",
        "bank_name": "Community bank",
        "account_name": "Firewood FR",
        "account_number": "9002002002",
        "routing": "200000002",
        "mapped_tags": ["FUEL"],
    },
    {
        "id": "s_fuel_sonali_bank",
        "label": "Firewood FR - Sonali Bank",
        "bank_name": "Sonali Bank",
        "account_name": "Firewood FR",
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


def sender_kind(value: str | None, default: str = "srb") -> str:
    raw = (value or "").strip().lower()
    if raw in ("mess", "srb"):
        return raw
    return default


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
        "kind": sender_kind(getattr(row, "kind", None)),
    }


def seed_catalog() -> None:
    db = SessionLocal()
    try:
        for row in db.query(Rate).all():
            if row.is_protected:
                row.is_protected = False
        clfr = db.get(Rate, "CLFR")
        if clfr is not None:
            db.delete(clfr)
            db.flush()
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
                        kind="mess",
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
    kind: str = "srb"


@router.get("/api/v1/auth/me")
def auth_me(staff: Staff = Depends(current_staff)):
    return envelope(
        {
            "id": staff.id,
            "email": staff.email,
            "srb_id": staff.email,
            "rab_id": staff.email,
            "display_name": staff.display_name,
            "role": staff.role,
            "avatar": getattr(staff, "avatar", "") or "",
            "mfa_enabled": bool(staff.mfa_enabled),
        }
    )


class ProfileIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=255)
    username: str = ""
    srb_id: str = ""
    rab_id: str = ""
    password: str = ""
    avatar: str | None = None


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
    if body.avatar is not None:
        avatar = (body.avatar or "").strip()
        if avatar and not avatar.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Profile photo must be an image")
        if len(avatar) > 1_200_000:
            raise HTTPException(status_code=400, detail="Profile photo is too large")
        row.avatar = avatar
    password = (body.password or "").strip()
    if password:
        error = validate_password(password, row.email)
        if error:
            raise HTTPException(status_code=400, detail=error)
        set_staff_password(row, password)
    db.commit()
    return envelope(
        {
            "id": row.id,
            "email": row.email,
            "srb_id": row.email,
            "rab_id": row.email,
            "display_name": row.display_name,
            "role": row.role,
            "avatar": getattr(row, "avatar", "") or "",
            "mfa_enabled": bool(row.mfa_enabled),
        },
        "Updated",
    )


STAFF_ROLES = ("cc", "daily", "mess", "consume", "ration", "admin")
STAFF_MANAGE = ("admin", "mess")


def _plain_staff_password(row: Staff) -> str:
    vault = getattr(row, "password_vault", None)
    if not vault:
        return ""
    try:
        return decrypt_secret(vault)
    except ValueError:
        return ""


def staff_out(row: Staff, *, include_password: bool = False) -> dict:
    data = {
        "id": row.id,
        "email": row.email,
        "srb_id": row.email,
        "rab_id": row.email,
        "display_name": row.display_name,
        "role": row.role,
        "avatar": getattr(row, "avatar", "") or "",
        "active": bool(row.active),
        "has_password": bool(getattr(row, "password_vault", None)),
    }
    if include_password:
        data["password"] = _plain_staff_password(row)
    return data


def _set_staff_password(row: Staff, password: str) -> None:
    set_staff_password(row, password)


class StaffCreateIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=255)
    username: str = ""
    email: str = ""
    srb_id: str = ""
    rab_id: str = ""
    password: str = Field(min_length=1, max_length=255)
    role: str


class StaffUpdateIn(BaseModel):
    display_name: str = ""
    username: str = ""
    email: str = ""
    srb_id: str = ""
    rab_id: str = ""
    password: str = ""
    role: str = ""
    active: bool | None = None


def find_staff_by_login(db: Session, login_id: str) -> Staff | None:
    key = (login_id or "").strip().lower()
    if not key:
        return None
    return db.query(Staff).filter(func.lower(Staff.email) == key).first()


def _staff_username_taken(db: Session, username: str, exclude_id: str | None = None) -> bool:
    existing = find_staff_by_login(db, username)
    return existing is not None and existing.id != exclude_id


SYSTEM_STAFF_LOGINS = {
    "SRB-ADMIN",
    "SRB-CC",
    "SRB-DAILY",
    "SRB-MESS",
    "SRB-CONSUME",
    "SRB-RATION",
    "SRB-SUPERADMIN",
}


def _staff_login_keys(login_id: str) -> list[str]:
    raw = (login_id or "").strip()
    if not raw:
        return []
    upper = raw.upper()
    keys = {raw.lower(), upper.lower()}
    bare = upper.removeprefix("SRB-").removeprefix("SRB")
    if bare:
        keys.add(bare.lower())
        keys.add(f"srb-{bare.lower()}")
    return [key for key in keys if key]


def _is_system_staff_login(login_id: str) -> bool:
    return (login_id or "").strip().upper() in SYSTEM_STAFF_LOGINS


def find_member_for_staff_login(db: Session, login_id: str) -> Member | None:
    keys = _staff_login_keys(login_id)
    if not keys:
        return None
    rows = (
        db.query(Member)
        .filter(
            or_(
                func.lower(Member.rab_id).in_(keys),
                func.lower(Member.personal_id).in_(keys),
            )
        )
        .all()
    )
    if not rows:
        return None
    want = (login_id or "").strip().lower()
    for row in rows:
        if (row.rab_id or "").strip().lower() == want:
            return row
    return rows[0]


def require_accepted_member_for_staff(db: Session, login_id: str) -> Member:
    member = find_member_for_staff_login(db, login_id)
    if member is None:
        raise HTTPException(
            status_code=400,
            detail="No accepted member has this SRB ID. Add them as a member first.",
        )
    status = (member.approval_status or "").strip().lower()
    if status == "pending":
        raise HTTPException(
            status_code=400,
            detail="This SRB ID is still pending. Daily must accept the member first.",
        )
    if status != "approved":
        raise HTTPException(
            status_code=400,
            detail="This SRB ID is not an accepted member.",
        )
    return member


@router.get("/api/v1/staff")
def list_staff(
    staff: Staff = Depends(require_roles(*STAFF_MANAGE)),
    db: Session = Depends(get_db),
):
    rows = db.query(Staff).order_by(Staff.role.asc(), Staff.display_name.asc()).all()
    include_password = staff.role == "admin"
    return envelope(
        {
            "items": [
                staff_out(row, include_password=include_password) for row in rows
            ]
        }
    )


@router.post("/api/v1/staff")
def create_staff(
    body: StaffCreateIn,
    actor: Staff = Depends(require_roles(*STAFF_MANAGE)),
    db: Session = Depends(get_db),
):
    name = body.display_name.strip()
    username = normalize_staff_login_id(staff_login_id_from_body(body))
    role = body.role.strip().lower()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name is too short")
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="SRB ID is required")
    if "@" in username:
        raise HTTPException(status_code=400, detail="Use a SRB ID, not an email address")
    if role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if _staff_username_taken(db, username):
        raise HTTPException(status_code=409, detail="SRB ID is already in use")
    if not _is_system_staff_login(username):
        require_accepted_member_for_staff(db, username)
    error = validate_password(body.password, username)
    if error:
        raise HTTPException(status_code=400, detail=error)
    row = Staff(
        id=new_id("st"),
        email=username,
        display_name=name,
        role=role,
        password_hash=hash_password(body.password),
        password_vault=encrypt_secret(body.password),
        active=True,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="SRB ID is already in use") from exc
    db.refresh(row)
    return envelope(
        staff_out(row, include_password=actor.role == "admin"),
        "Staff created",
        201,
    )


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
    username = normalize_staff_login_id(staff_login_id_from_body(body))
    if username:
        if "@" in username and username.lower() != row.email.lower():
            raise HTTPException(status_code=400, detail="Use a SRB ID, not an email address")
        if _staff_username_taken(db, username, row.id):
            raise HTTPException(status_code=409, detail="SRB ID is already in use")
        if not _is_system_staff_login(username):
            require_accepted_member_for_staff(db, username)
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
        _set_staff_password(row, password)
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
        raise HTTPException(status_code=409, detail="SRB ID is already in use") from exc
    db.refresh(row)
    return envelope(
        staff_out(row, include_password=actor.role == "admin"),
        "Updated",
    )


@router.get("/api/v1/staff/{staff_id}/password")
def reveal_staff_password(
    staff_id: str,
    _actor: Staff = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    row = db.get(Staff, staff_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Staff not found")
    vault = getattr(row, "password_vault", None)
    if not vault:
        raise HTTPException(
            status_code=404,
            detail="Password is not stored for viewing. Set a new password.",
        )
    try:
        password = decrypt_secret(vault)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail="Password is not stored for viewing. Set a new password.",
        ) from exc
    return envelope({"password": password})


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
                is_protected=False,
            )
            db.add(row)
        else:
            row.amount_per_day = item.amount_per_day
            row.is_protected = False
    for row in db.query(Rate).all():
        if row.tag not in seen:
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
        is_protected=False,
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
        kind=sender_kind(body.kind),
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
    row.kind = sender_kind(body.kind, getattr(row, "kind", None) or "srb")
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


PUBLIC_FORM_CATALOG_KEYS = tuple(
    key
    for key in CATALOG_KEYS
    if key
    not in ("manpower_held", "manpower_absent", "manpower_present", "manpower_absence_detail", "force_rank_officer", "paper_report_requests")
)


@router.get("/api/v1/public/catalog")
def public_catalog(db: Session = Depends(get_db)):
    """Dropdowns for the QR /register form — Settings wings, ranks, forces, banks."""
    payload = catalog_payload(db)
    return envelope({key: payload.get(key) for key in PUBLIC_FORM_CATALOG_KEYS})


@router.post("/api/v1/public/files")
async def public_upload_file(
    request: Request,
    upload: UploadFile = File(...),
    entity_type: str = Form(""),
    entity_id: str = Form(""),
    db: Session = Depends(get_db),
):
    """Document upload for public member entry (no staff login)."""
    enforce_register_limit(request)
    data = await upload.read()
    if len(data) > IMAGE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Photo is too large. Use an image up to 2.5 MB.")
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        _ext, mime = sniff_image_mime(data, upload.filename or "photo", upload.content_type)
        key = put_bytes(data, upload.filename or "photo")
    except StorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row = FileObject(
        id=new_id("fl"),
        original_name=(upload.filename or "file")[:255],
        storage_key=key,
        mime_type=mime,
        size=len(data),
        checksum=checksum(data),
        entity_type=(entity_type or "register")[:64],
        entity_id=entity_id[:64],
        uploaded_by="public",
    )
    db.add(row)
    db.commit()
    return envelope(file_out(row), "Uploaded", 201)


@router.post("/api/v1/public/register")
def public_register(body: MemberIn, request: Request, db: Session = Depends(get_db)):
    from main import apply_member_fields, find_member_by_rab

    enforce_register_limit(request)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if find_member_by_rab(db, body.rab_id):
        raise HTTPException(status_code=409, detail="A member with this SRB ID already exists")
    row = Member(id=new_id("u"), created_by=None)
    apply_member_fields(row, body)
    row.status = "1"
    row.approval_status = "pending"
    row.default_tag = ""
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


@router.get("/api/v1/zk/gate")
def zk_gate_list(
    _staff: Staff = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return envelope(refresh_gate(db))


@router.post("/api/v1/zk/sync")
def zk_gate_sync(_staff: Staff = Depends(require_roles("admin"))):
    started = start_sync(SessionLocal)
    payload = gate_snapshot()
    payload["started"] = started
    return envelope(payload)
