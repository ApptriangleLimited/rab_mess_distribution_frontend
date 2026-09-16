import logging
import os
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from auth import (
    JWT_EXPIRES_SECONDS,
    bearer,
    create_access_token,
    current_staff,
    decode_token,
    hash_password,
    issue_refresh_session,
    require_roles,
    revoke_staff_sessions,
    verify_password,
)
from cache import (
    bust_daily,
    bust_members,
    bust_tag_requests,
    cache_get,
    cache_key,
    cache_set,
    redis_log_target,
    redis_up,
    revoke_staff_access,
    revoke_token,
    worker_up,
)
from daily import can_assign, each_date, router as daily_router, upsert_assignment
from extra import router as extra_router, seed_catalog
from persist import router as persist_router, seed_persist
from account import router as account_router
from headers import SecurityHeadersMiddleware
from permissions import seed_permissions
from security import verify_login_mfa
from audit import write_audit
from config import settings
from database import Base, SessionLocal, engine, get_db
from models import Assignment, Member, Staff, TagRequest
from observability import RequestContextMiddleware, configure_logging, log_event
from rate_limit import (
    client_ip,
    clear_login_limits,
    enforce_login_limits,
)
from schemas import (
    AcceptMemberIn,
    LoginIn,
    MemberIn,
    StatusIn,
    TagIn,
    TagRequestIn,
    TagRequestPatchIn,
    normalize_tag,
)

ROLES = ("cc", "daily", "mess", "consume", "ration", "admin")
MEMBER_ROLES = ("cc", "daily", "admin")
MEMBER_CREATE_ROLES = ("cc", "admin")
QUEUE_ROLES = {
    "daily": ("daily", "admin"),
    "ration": ("ration", "admin"),
    "consume": ("consume", "admin"),
}

configure_logging()
settings.assert_secure()

app = FastAPI(
    title="SRB-Special Response Battalion Mess CC API",
    version="0.2.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.include_router(daily_router)
app.include_router(extra_router)
app.include_router(persist_router)
app.include_router(account_router)

_origins = settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def envelope(data, message: str = "", status: int = 200):
    return JSONResponse(
        {
            "ok": True,
            "success": True,
            "message": message,
            "data": data,
        },
        status_code=status,
    )


def cors_headers_for(request: Request | None) -> dict[str, str]:
    if request is None:
        return {}
    origin = request.headers.get("origin")
    if origin and origin in _origins:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}


def fail(
    status: int,
    message: str,
    code: str,
    errors: list | None = None,
    *,
    request: Request | None = None,
):
    return JSONResponse(
        {
            "ok": False,
            "success": False,
            "message": message,
            "code": code,
            "detail": message,
            "errors": errors or [],
        },
        status_code=status,
        headers=cors_headers_for(request),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = str(exc.detail)
    code = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
    }.get(exc.status_code, "ERROR")
    if exc.status_code == 401 and (
        "invalid email" in detail.lower() or "credentials" in detail.lower()
    ):
        code = "AUTH_INVALID_CREDENTIALS"
    if exc.status_code == 409 and ("RAB" in detail or "SRB" in detail):
        code = "CONFLICT_RAB_ID"
    return fail(exc.status_code, str(exc.detail), code, request=request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = err.get("loc", ())
        field = str(loc[-1]) if loc else ""
        errors.append(
            {
                "field": field,
                "code": "invalid",
                "message": err.get("msg", "Invalid value"),
            }
        )
    message = errors[0]["message"] if errors else "Validation failed"
    return fail(422, message, "VALIDATION_ERROR", errors, request=request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import logging

    log_event(
        logging.ERROR,
        service="api",
        request_id=getattr(request.state, "request_id", ""),
        method=request.method,
        path=str(request.url.path),
        event="unhandled_exception",
        error_type=type(exc).__name__,
    )
    return fail(500, "Unexpected server error", "INTERNAL_ERROR", request=request)


def iso_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def member_out(row: Member) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "personal_id": row.personal_id or "",
        "rab_id": row.rab_id or "",
        "rfid": row.rfid or "",
        "rank": row.rank or "",
        "wing": row.wing or "",
        "force": row.force or "",
        "religion": row.religion or "",
        "member_type": row.member_type or "permanent",
        "dropdown_no": row.dropdown_no or "",
        "phone": row.phone or "",
        "blood_group": row.blood_group or "",
        "documents": row.documents or [],
        "documents_verified": bool(row.documents_verified),
        "status": row.status if row.status in ("0", "1") else "1",
        "approval_status": row.approval_status or "pending",
        "bank_name": row.bank_name or "",
        "account_name": row.account_name or "",
        "account_number": row.account_number or "",
        "routing": row.routing or "",
        "branch": row.branch or "",
        "branch_location": row.branch_location or "",
        "joining_date": iso_date(row.joining_date),
        "out_date": iso_date(row.out_date),
        "default_tag": (row.default_tag or "").upper(),
        "jl_end_date": row.jl_end_date or "",
        "inactive_spans": row.inactive_spans or [],
        "emergency_contacts": row.emergency_contacts or [],
        "created_at": row.created_at.isoformat() if row.created_at else utcnow().isoformat(),
        "updated_at": row.updated_at.isoformat() if row.updated_at else utcnow().isoformat(),
    }


def request_out(row: TagRequest) -> dict:
    payload = {
        "id": row.id,
        "user_id": row.user_id,
        "date": row.date.isoformat(),
        "from_date": row.from_date.isoformat(),
        "to_date": row.to_date.isoformat(),
        "from_tag": row.from_tag or "",
        "to_tag": row.to_tag,
        "trg_tone": row.trg_tone,
        "trg_sarda": row.trg_sarda,
        "queue": row.queue,
        "status": row.status,
        "requested_by": row.requested_by,
        "requested_at": row.requested_at.isoformat() if row.requested_at else utcnow().isoformat(),
        "updated_by": row.updated_by,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "member": member_out(row.member) if row.member else None,
    }
    return payload


def normalize_approval(value: str | None, default: str = "pending") -> str:
    if not value:
        return default
    if value == "accepted":
        return "approved"
    if value in ("pending", "approved", "rejected", "ended"):
        return value
    raise HTTPException(status_code=400, detail="Invalid approval status")


def apply_member_fields(row: Member, body: MemberIn) -> None:
    row.name = body.name.strip()
    row.rab_id = body.rab_id.strip()
    row.personal_id = body.personal_id.strip()
    row.rfid = body.rfid.strip()
    row.rank = body.rank.strip()
    row.wing = body.wing.strip()
    row.force = body.force.strip()
    row.religion = body.religion.strip()
    row.member_type = body.member_type
    row.dropdown_no = body.dropdown_no.strip()
    row.phone = body.phone.strip()
    row.blood_group = body.blood_group.strip()
    row.bank_name = body.bank_name.strip()
    row.account_name = body.account_name.strip()
    row.account_number = body.account_number.strip()
    row.routing = body.routing.strip()
    row.branch = body.branch.strip()
    row.branch_location = body.branch_location.strip()
    row.joining_date = body.joining_date
    row.out_date = body.out_date
    raw_tag = (body.default_tag or "").strip()
    row.default_tag = normalize_tag(raw_tag) if raw_tag else ""
    row.documents = [d.model_dump() for d in body.documents]
    row.documents_verified = bool(body.documents_verified)
    row.emergency_contacts = [
        c.model_dump() for c in body.emergency_contacts if c.name or c.relation or c.phone
    ]


def find_member_by_rab(db: Session, rab_id: str, exclude_id: str | None = None) -> Member | None:
    key = rab_id.strip().lower()
    if not key:
        return None
    query = db.query(Member).filter(func.lower(Member.rab_id) == key)
    if exclude_id:
        query = query.filter(Member.id != exclude_id)
    return query.first()


def queue_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(TagRequest.queue, func.count(TagRequest.id))
        .filter(TagRequest.status == "requested")
        .group_by(TagRequest.queue)
        .all()
    )
    counts = {"daily": 0, "ration": 0, "consume": 0}
    for queue, total in rows:
        if queue in counts:
            counts[queue] = int(total)
    return counts


def seed_staff() -> None:
    if not settings.seed_staff:
        return
    password = settings.seed_staff_password
    db = SessionLocal()
    try:
        existing = {row.email for row in db.query(Staff.email).all()}
        created = False
        for role in ROLES:
            email = f"{role}@mess.rab"
            if email in existing:
                continue
            db.add(
                Staff(
                    id=new_id("st"),
                    email=email,
                    display_name=role.upper(),
                    role=role,
                    password_hash=hash_password(password),
                    active=True,
                )
            )
            created = True
        if created:
            db.commit()
    finally:
        db.close()


def run_migrations() -> None:
    from alembic import command
    from alembic.config import Config

    command.upgrade(Config("alembic.ini"), "head")


@app.on_event("startup")
def on_startup() -> None:
    run_migrations()
    if settings.allow_create_all:
        Base.metadata.create_all(bind=engine)
    seed_staff()
    seed_permissions()
    seed_catalog()
    seed_persist()
    log_event(
        logging.INFO,
        service="api",
        event="startup",
        redis=redis_log_target(),
        env=settings.app_env,
    )


def postgres_up() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@app.get("/health")
def health():
    """Process liveness only — Redis/DB belong on /health/ready."""
    return envelope({"status": "ok"})


@app.get("/health/live")
def health_live():
    return envelope({"status": "ok"})


@app.get("/health/ready")
def health_ready():
    db_ok = postgres_up()
    redis_ok = redis_up()
    payload = {
        "status": "ok" if db_ok and redis_ok else "degraded",
        "database": "up" if db_ok else "down",
        "redis": "up" if redis_ok else "down",
    }
    if not db_ok:
        return fail(503, "Database unavailable", "NOT_READY")
    if settings.is_production and not redis_ok:
        return fail(503, "Redis unavailable", "NOT_READY")
    payload["worker"] = "up" if worker_up() else "down"
    return envelope(payload)


@app.post("/api/v1/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    enforce_login_limits(request, email)
    staff = db.query(Staff).filter(func.lower(Staff.email) == email).first()
    if staff is None or not verify_password(body.password, staff.password_hash):
        write_audit(
            db,
            actor_id="",
            action="LOGIN_FAIL",
            entity="staff",
            entity_id=email,
            ip=client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not staff.active:
        return fail(401, "Account is inactive", "AUTH_INACTIVE")
    mfa_error = verify_login_mfa(staff, body.otp, body.recovery_code)
    if mfa_error:
        code, message = mfa_error
        return fail(401, message, code)
    clear_login_limits(request, email)
    write_audit(
        db,
        actor_id=staff.id,
        action="LOGIN",
        entity="staff",
        entity_id=staff.id,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    raw_refresh, _session = issue_refresh_session(
        db,
        staff,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    token = create_access_token(staff)
    return envelope(
        {
            "access_token": token,
            "refresh_token": raw_refresh,
            "token_type": "bearer",
            "expires_in": JWT_EXPIRES_SECONDS,
            "staff": {
                "id": staff.id,
                "email": staff.email,
                "display_name": staff.display_name,
                "role": staff.role,
                "mfa_enabled": bool(staff.mfa_enabled),
            },
        },
        "Logged in",
    )


@app.post("/api/v1/auth/logout")
def logout(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    if creds is not None:
        revoke_token(creds.credentials, decode_token(creds.credentials))
    revoke_staff_sessions(db, staff.id)
    write_audit(
        db,
        actor_id=staff.id,
        action="LOGOUT",
        entity="staff",
        entity_id=staff.id,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    return envelope(None, "Logged out")


@app.get("/api/v1/members")
def list_members(
    q: str | None = None,
    status: str | None = None,
    approval: str | None = None,
    wing: str | None = None,
    rank: str | None = None,
    member_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    query = db.query(Member)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Member.name.ilike(like),
                Member.rab_id.ilike(like),
                Member.personal_id.ilike(like),
                Member.rfid.ilike(like),
                Member.phone.ilike(like),
                Member.dropdown_no.ilike(like),
            )
        )
    if status and status != "all":
        query = query.filter(Member.status == status)
    if approval and approval != "all":
        query = query.filter(Member.approval_status == normalize_approval(approval, approval))
    if wing and wing != "all":
        query = query.filter(Member.wing == wing)
    if rank and rank != "all":
        query = query.filter(Member.rank == rank)
    if member_type and member_type != "all":
        query = query.filter(Member.member_type == member_type)
    if date_from or date_to:
        start = date_from or date_to
        end = date_to or date_from
        query = query.filter(
            or_(
                (Member.joining_date >= start) & (Member.joining_date <= end),
                (Member.out_date >= start) & (Member.out_date <= end),
            )
        )
    key = cache_key(
        "members",
        q=q,
        status=status,
        approval=approval,
        wing=wing,
        rank=rank,
        member_type=member_type,
        date_from=str(date_from) if date_from else None,
        date_to=str(date_to) if date_to else None,
        page=page,
        page_size=page_size,
    )
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    total = query.count()
    rows = (
        query.order_by(Member.created_at.desc(), Member.updated_at.desc(), Member.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    data = {
        "items": [member_out(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
    cache_set(key, data)
    return envelope(data)


@app.post("/api/v1/members")
def create_member(
    body: MemberIn,
    staff: Staff = Depends(require_roles(*MEMBER_CREATE_ROLES)),
    db: Session = Depends(get_db),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if find_member_by_rab(db, body.rab_id):
        raise HTTPException(status_code=409, detail="A member with this SRB ID already exists")

    row = Member(id=new_id("u"), created_by=staff.id)
    apply_member_fields(row, body)
    if staff.id == row.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")
    row.status = body.status if body.status in ("0", "1") else "1"
    row.approval_status = normalize_approval(body.approval_status, "pending")
    if row.approval_status == "pending":
        row.default_tag = ""
    if row.status == "0":
        row.inactive_spans = [{"from": iso_date(row.joining_date) or "1970-01-01", "to": None}]
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A member with this SRB ID already exists") from exc
    db.refresh(row)
    bust_members()
    return envelope(member_out(row), "Member request sent successfully", 201)


@app.get("/api/v1/members/{member_id}")
def get_member(
    member_id: str,
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    row = db.get(Member, member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return envelope(member_out(row))


@app.put("/api/v1/members/{member_id}")
def update_member(
    member_id: str,
    body: MemberIn,
    staff: Staff = Depends(require_roles(*MEMBER_ROLES)),
    db: Session = Depends(get_db),
):
    row = db.get(Member, member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if find_member_by_rab(db, body.rab_id, exclude_id=member_id):
        raise HTTPException(status_code=409, detail="A member with this SRB ID already exists")
    apply_member_fields(row, body)
    if body.status in ("0", "1"):
        row.status = body.status
    if body.approval_status:
        row.approval_status = normalize_approval(body.approval_status, row.approval_status)
    row.updated_at = utcnow()
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A member with this SRB ID already exists") from exc
    db.refresh(row)
    bust_members()
    return envelope(member_out(row), "Member updated")


@app.patch("/api/v1/members/{member_id}/accept")
def accept_member(
    member_id: str,
    body: AcceptMemberIn | None = None,
    staff: Staff = Depends(require_roles(*MEMBER_ROLES)),
    db: Session = Depends(get_db),
):
    row = db.get(Member, member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if row.approval_status != "pending":
        raise HTTPException(status_code=409, detail="This user is already a member.")
    payload = body or AcceptMemberIn()
    if payload.tag:
        try:
            row.default_tag = normalize_tag(payload.tag)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    row.approval_status = "approved"
    row.status = "1"
    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    bust_members()
    return envelope(member_out(row), "Member request accepted.")


@app.patch("/api/v1/members/{member_id}/reject")
def reject_member(
    member_id: str,
    staff: Staff = Depends(require_roles(*MEMBER_ROLES)),
    db: Session = Depends(get_db),
):
    row = db.get(Member, member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if row.approval_status != "pending":
        raise HTTPException(status_code=409, detail="Request is no longer pending")
    row.approval_status = "rejected"
    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    bust_members()
    return envelope(member_out(row), "Member request rejected.")


@app.patch("/api/v1/members/{member_id}/tag")
def change_member_tag(
    member_id: str,
    body: TagIn,
    staff: Staff = Depends(require_roles("cc", "daily", "admin")),
    db: Session = Depends(get_db),
):
    row = db.get(Member, member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        tag = normalize_tag(body.tag)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row.default_tag = tag
    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    bust_members()
    return envelope(member_out(row), "Tag updated successfully.")


def apply_status_spans(row: Member, status: str) -> None:
    today = date.today()
    spans = [s for s in (row.inactive_spans or []) if isinstance(s, dict)]
    if status == "0":
        if not any(not s.get("to") for s in spans):
            start = (
                row.joining_date.isoformat()
                if row.joining_date and row.joining_date < today
                else today.isoformat()
            )
            spans.append({"from": start, "to": None})
        row.inactive_spans = spans
        return
    yesterday = (today - timedelta(days=1)).isoformat()
    closed = []
    for span in spans:
        if span.get("to"):
            closed.append(span)
            continue
        raw_from = str(span.get("from") or "")
        if raw_from and raw_from > yesterday:
            continue
        closed.append({**span, "to": yesterday})
    row.inactive_spans = closed
    row.jl_end_date = ""


@app.patch("/api/v1/members/{member_id}/status")
def set_member_status(
    member_id: str,
    body: StatusIn,
    staff: Staff = Depends(require_roles(*MEMBER_ROLES)),
    db: Session = Depends(get_db),
):
    row = db.get(Member, member_id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if row.approval_status != "approved":
        raise HTTPException(status_code=409, detail="Only accepted members can change status")
    if row.status != body.status:
        apply_status_spans(row, body.status)
        row.status = body.status
        row.updated_at = utcnow()
        db.commit()
        db.refresh(row)
        bust_members()
    return envelope(member_out(row), "Status updated")


@app.get("/api/v1/tag-requests/counts")
def tag_request_counts(
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    key = cache_key("tag-requests", kind="counts")
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    data = queue_counts(db)
    cache_set(key, data)
    return envelope(data)


@app.get("/api/v1/tag-requests")
def list_tag_requests(
    queue: str = "daily",
    status: str | None = None,
    q: str | None = None,
    wing: str | None = None,
    rank: str | None = None,
    tag: str | None = None,
    member_status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    _staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    if queue not in QUEUE_ROLES:
        raise HTTPException(status_code=400, detail="Invalid queue")
    query = (
        db.query(TagRequest)
        .options(joinedload(TagRequest.member))
        .filter(TagRequest.queue == queue)
    )
    if status and status != "all":
        query = query.filter(TagRequest.status == status)
    if tag and tag != "all":
        query = query.filter(TagRequest.to_tag == tag.upper())
    if date_from:
        query = query.filter(func.date(TagRequest.requested_at) >= date_from)
    if date_to:
        query = query.filter(func.date(TagRequest.requested_at) <= date_to)
    query = query.join(Member, Member.id == TagRequest.user_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Member.name.ilike(like),
                Member.rab_id.ilike(like),
                Member.rank.ilike(like),
                Member.wing.ilike(like),
                TagRequest.to_tag.ilike(like),
            )
        )
    if wing and wing != "all":
        query = query.filter(Member.wing == wing)
    if rank and rank != "all":
        query = query.filter(Member.rank == rank)
    if member_status and member_status != "all":
        query = query.filter(Member.status == member_status)
    key = cache_key(
        "tag-requests",
        kind="list",
        queue=queue,
        status=status,
        q=q,
        wing=wing,
        rank=rank,
        tag=tag,
        member_status=member_status,
        date_from=str(date_from) if date_from else None,
        date_to=str(date_to) if date_to else None,
        page=page,
        page_size=page_size,
    )
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    total = query.count()
    rows = (
        query.order_by(
            func.coalesce(TagRequest.updated_at, TagRequest.requested_at).desc(),
            TagRequest.requested_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    status_rows = (
        db.query(TagRequest.status, func.count(TagRequest.id))
        .filter(TagRequest.queue == queue)
        .group_by(TagRequest.status)
        .all()
    )
    status_counts = {"requested": 0, "updated": 0, "rejected": 0}
    for key, count in status_rows:
        if key in status_counts:
            status_counts[key] = int(count)
    data = {
        "items": [request_out(row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "counts": queue_counts(db),
        "status_counts": {
            **status_counts,
            "all": sum(status_counts.values()),
        },
    }
    cache_set(key, data)
    return envelope(data)


@app.post("/api/v1/tag-requests")
def create_tag_request(
    body: TagRequestIn,
    staff: Staff = Depends(require_roles("cc", "daily", "admin")),
    db: Session = Depends(get_db),
):
    member = db.get(Member, body.user_id)
    if member is None:
        raise HTTPException(status_code=404, detail="User not found")
    if member.id == staff.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")
    if member.approval_status != "approved":
        raise HTTPException(status_code=409, detail="Only accepted members can receive a tag request")
    try:
        to_tag = normalize_tag(body.to_tag)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    start = body.from_date or date.today()
    end = body.to_date or start
    if end < start:
        start, end = end, start
    stored = (
        db.query(Assignment)
        .filter(Assignment.user_id == member.id, Assignment.date == start)
        .first()
    )
    current = ((stored.tag if stored else member.default_tag) or "").upper()
    if current == to_tag:
        raise HTTPException(status_code=400, detail="Requested tag is the same as the current tag")
    pending = (
        db.query(TagRequest)
        .filter(
            TagRequest.user_id == member.id,
            TagRequest.queue == body.queue,
            TagRequest.status == "requested",
        )
        .first()
    )
    if pending and pending.to_tag == to_tag and pending.from_date == start and pending.to_date == end:
        raise HTTPException(status_code=409, detail="A pending request already exists.")

    now = utcnow()
    if pending:
        pending.to_tag = to_tag
        pending.from_tag = current
        pending.date = start
        pending.from_date = start
        pending.to_date = end
        pending.trg_tone = body.trg_tone
        pending.trg_sarda = body.trg_sarda
        pending.requested_by = staff.id
        pending.requested_at = now
        pending.updated_at = now
        row = pending
        message = "Tag request updated"
        status = 200
    else:
        row = TagRequest(
            id=new_id("tr"),
            user_id=member.id,
            date=start,
            from_date=start,
            to_date=end,
            from_tag=current,
            to_tag=to_tag,
            trg_tone=body.trg_tone,
            trg_sarda=body.trg_sarda,
            queue=body.queue,
            status="requested",
            requested_by=staff.id,
            requested_at=now,
            updated_at=now,
        )
        db.add(row)
        message = "Member request sent successfully"
        status = 201
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A pending request already exists.") from exc
    db.refresh(row)
    row.member = member
    bust_tag_requests()
    return envelope(request_out(row), message, status)


@app.patch("/api/v1/tag-requests/{request_id}")
def change_tag_request(
    request_id: str,
    body: TagRequestPatchIn,
    staff: Staff = Depends(require_roles("cc", "daily", "admin")),
    db: Session = Depends(get_db),
):
    row = db.query(TagRequest).options(joinedload(TagRequest.member)).filter(TagRequest.id == request_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if row.status != "requested":
        raise HTTPException(status_code=409, detail="Request is no longer pending")
    if staff.role not in ("cc", "admin") and row.requested_by != staff.id:
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
    try:
        tag = normalize_tag(body.to_tag)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    row.to_tag = tag
    row.updated_by = staff.id
    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    bust_tag_requests()
    return envelope(request_out(row), "Tag updated successfully.")


@app.patch("/api/v1/tag-requests/{request_id}/accept")
def accept_tag_request(
    request_id: str,
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    row = db.query(TagRequest).options(joinedload(TagRequest.member)).filter(TagRequest.id == request_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if staff.role not in QUEUE_ROLES.get(row.queue, ()):
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
    if row.status != "requested":
        raise HTTPException(status_code=409, detail="Request is no longer pending")
    if row.member is None:
        raise HTTPException(status_code=404, detail="User not found")
    row.status = "updated"
    row.updated_by = staff.id
    row.updated_at = utcnow()
    start = row.from_date or row.date
    end = row.to_date or start
    if end < start:
        start, end = end, start
    today = date.today()
    if start < today:
        start = today
    wrote = 0
    for day in each_date(start, end):
        if day < today:
            continue
        if not can_assign(row.member, day):
            continue
        assigned = upsert_assignment(db, row.member, day, row.to_tag, staff)
        assigned.trg_tone = row.trg_tone
        wrote += 1
    if wrote == 0:
        raise HTTPException(status_code=409, detail="No assignable days in this request")
    db.commit()
    db.refresh(row)
    bust_tag_requests()
    bust_members()
    bust_daily()
    return envelope(request_out(row), "Member request accepted.")


@app.patch("/api/v1/tag-requests/{request_id}/reject")
def reject_tag_request(
    request_id: str,
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    row = db.query(TagRequest).options(joinedload(TagRequest.member)).filter(TagRequest.id == request_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if staff.role not in QUEUE_ROLES.get(row.queue, ()):
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
    if row.status != "requested":
        raise HTTPException(status_code=409, detail="Request is no longer pending")
    row.status = "rejected"
    row.updated_by = staff.id
    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    bust_tag_requests()
    return envelope(request_out(row), "Member request rejected.")
