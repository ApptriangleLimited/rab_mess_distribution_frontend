"""Refresh, password reset, MFA, catalog, files, and notifications."""

from __future__ import annotations

import json
import logging
from datetime import timedelta

import pyotp
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import (
    JWT_EXPIRES_SECONDS,
    create_access_token,
    current_staff,
    find_staff_by_login,
    hash_password,
    issue_refresh_session,
    revoke_staff_sessions,
    rotate_refresh_session,
    set_staff_password,
    staff_login_id_from_body,
    verify_password,
)
from audit import write_audit
from cache import bust_settings, cache_get, cache_key, cache_set, revoke_staff_access
from config import settings
from database import get_db
from jobs import enqueue, send_reset_email
from models import CatalogState, FileObject, Notification, PasswordReset, Staff
from permissions import require_permission, role_permission_codes
from persist import CATALOG_KEYS, apply_catalog
from rate_limit import client_ip, clear_login_limits, enforce_login_limits, enforce_reset_limit
from security import (
    decrypt_secret,
    encrypt_secret,
    hash_recovery_code,
    hash_token,
    new_id,
    new_token,
    recovery_code_matches,
    utcnow,
    validate_password,
)
from storage import (
    IMAGE_MAX_BYTES,
    StorageError,
    checksum,
    delete_key,
    get_bytes,
    put_bytes,
    sniff_image_mime,
)

router = APIRouter()
logger = logging.getLogger("rab.api")


def envelope(data, message: str = "", status: int = 200):
    return JSONResponse(
        {"ok": True, "success": True, "message": message, "data": data},
        status_code=status,
    )


def fail(status: int, message: str, code: str):
    return JSONResponse(
        {
            "ok": False,
            "success": False,
            "message": message,
            "code": code,
            "detail": message,
            "errors": [],
        },
        status_code=status,
    )


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotIn(BaseModel):
    email: str = ""


class ResetIn(BaseModel):
    token: str
    password: str


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str


class LoginPasswordChangeIn(BaseModel):
    srb_id: str = ""
    rab_id: str = ""
    email: str = ""
    username: str = ""
    current_password: str
    new_password: str


class MfaEnableIn(BaseModel):
    otp: str


class MfaDisableIn(BaseModel):
    password: str
    otp: str = ""


class CatalogPutIn(BaseModel):
    payload: dict = Field(default_factory=dict)


def staff_public(staff: Staff, db: Session | None = None) -> dict:
    data = {
        "id": staff.id,
        "email": staff.email,
        "srb_id": staff.email,
        "rab_id": staff.email,
        "display_name": staff.display_name,
        "role": staff.role,
        "avatar": getattr(staff, "avatar", "") or "",
        "mfa_enabled": bool(staff.mfa_enabled),
    }
    if db is not None:
        data["permissions"] = sorted(role_permission_codes(db, staff.role))
    return data


def token_pair(staff: Staff, refresh: str, expires_at=None) -> dict:
    remaining = JWT_EXPIRES_SECONDS
    if expires_at is not None:
        remaining = max(1, int((expires_at - utcnow()).total_seconds()))
    return {
        "access_token": create_access_token(staff, expires_at),
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": remaining,
        "staff": staff_public(staff),
    }


@router.post("/api/v1/auth/refresh")
def refresh_tokens(body: RefreshIn, request: Request, db: Session = Depends(get_db)):
    staff, raw, expires_at = rotate_refresh_session(
        db,
        body.refresh_token,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    return envelope(token_pair(staff, raw, expires_at), "Refreshed")


@router.post("/api/v1/auth/revoke-sessions")
def revoke_sessions(
    request: Request,
    staff: Staff = Depends(require_permission("auth.manage")),
    db: Session = Depends(get_db),
):
    revoke_staff_sessions(db, staff.id)
    revoke_staff_access(staff.id)
    write_audit(
        db,
        actor_id=staff.id,
        action="REVOKE_SESSIONS",
        entity="staff",
        entity_id=staff.id,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    return envelope(None, "Sessions revoked")


@router.post("/api/v1/auth/forgot-password")
def forgot_password(body: ForgotIn, request: Request, db: Session = Depends(get_db)):
    identifier = (body.email or "").strip().lower()
    enforce_reset_limit(request, identifier or client_ip(request))
    staff = db.query(Staff).filter(func.lower(Staff.email) == identifier).first() if identifier else None
    if staff and staff.active:
        raw = new_token()
        db.add(
            PasswordReset(
                id=new_id("pr"),
                staff_id=staff.id,
                token_hash=hash_token(raw),
                expires_at=utcnow() + timedelta(hours=1),
            )
        )
        write_audit(
            db,
            actor_id=staff.id,
            action="PASSWORD_RESET_REQUEST",
            entity="staff",
            entity_id=staff.id,
            ip=client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
        )
        db.commit()
        enqueue(send_reset_email, staff.email, f"{settings.public_app_url}/login?reset={raw}")
    return envelope(None, "If the account exists, a reset message was sent")


@router.post("/api/v1/auth/reset-password")
def reset_password(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    row = db.query(PasswordReset).filter(PasswordReset.token_hash == hash_token(body.token)).first()
    generic = fail(400, "Reset link is invalid or expired", "AUTH_RESET_INVALID")
    if row is None or row.used_at is not None or row.expires_at <= utcnow():
        return generic
    staff = db.get(Staff, row.staff_id)
    if staff is None or not staff.active:
        return generic
    error = validate_password(body.password, staff.email)
    if error:
        return fail(422, error, "AUTH_PASSWORD_WEAK")
    set_staff_password(staff, body.password)
    row.used_at = utcnow()
    db.query(PasswordReset).filter(
        PasswordReset.staff_id == staff.id,
        PasswordReset.used_at.is_(None),
        PasswordReset.id != row.id,
    ).update({"used_at": utcnow()}, synchronize_session=False)
    revoke_staff_sessions(db, staff.id)
    revoke_staff_access(staff.id)
    write_audit(
        db,
        actor_id=staff.id,
        action="PASSWORD_RESET",
        entity="staff",
        entity_id=staff.id,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    return envelope(None, "Password updated")


def _apply_password_change(
    db: Session,
    request: Request,
    staff: Staff,
    current_password: str,
    new_password: str,
    *,
    login_id: str = "",
):
    if not verify_password(current_password, staff.password_hash):
        write_audit(
            db,
            actor_id=staff.id,
            action="PASSWORD_CHANGE_FAIL",
            entity="staff",
            entity_id=login_id or staff.id,
            ip=client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid SRB ID or password")
    if not staff.active:
        return fail(401, "Account is inactive", "AUTH_INACTIVE")
    if current_password == new_password:
        return fail(400, "New password must be different", "AUTH_PASSWORD_SAME")
    error = validate_password(new_password, staff.email)
    if error:
        return fail(422, error, "AUTH_PASSWORD_WEAK")
    set_staff_password(staff, new_password)
    revoke_staff_sessions(db, staff.id)
    revoke_staff_access(staff.id)
    write_audit(
        db,
        actor_id=staff.id,
        action="PASSWORD_CHANGE",
        entity="staff",
        entity_id=staff.id,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    return envelope(None, "Password updated")


@router.post("/api/v1/auth/login-change-password")
def change_password_at_login(
    body: LoginPasswordChangeIn,
    request: Request,
    db: Session = Depends(get_db),
):
    login_id = staff_login_id_from_body(body)
    enforce_login_limits(request, login_id or "unknown")
    staff = find_staff_by_login(db, login_id)
    if staff is None:
        write_audit(
            db,
            actor_id="",
            action="PASSWORD_CHANGE_FAIL",
            entity="staff",
            entity_id=login_id,
            ip=client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid SRB ID or password")
    result = _apply_password_change(
        db,
        request,
        staff,
        body.current_password,
        body.new_password,
        login_id=login_id,
    )
    if getattr(result, "status_code", 200) < 400:
        clear_login_limits(request, login_id)
    return result


@router.post("/api/v1/auth/change-password")
def change_password(
    body: PasswordChangeIn,
    request: Request,
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    return _apply_password_change(
        db,
        request,
        staff,
        body.current_password,
        body.new_password,
        login_id=staff.email,
    )


@router.get("/api/v1/auth/permissions")
def my_permissions(
    staff: Staff = Depends(current_staff),
    db: Session = Depends(get_db),
):
    return envelope({"role": staff.role, "permissions": sorted(role_permission_codes(db, staff.role))})


@router.post("/api/v1/auth/mfa/setup")
def mfa_setup(
    staff: Staff = Depends(require_permission("auth.manage")),
    db: Session = Depends(get_db),
):
    secret = pyotp.random_base32()
    staff.mfa_secret = encrypt_secret(secret)
    staff.mfa_enabled = False
    db.commit()
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=staff.email, issuer_name="SRB Mess")
    return envelope({"otpauth_url": uri, "secret": secret})


@router.post("/api/v1/auth/mfa/enable")
def mfa_enable(
    body: MfaEnableIn,
    request: Request,
    staff: Staff = Depends(require_permission("auth.manage")),
    db: Session = Depends(get_db),
):
    if not staff.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup is required first")
    totp = pyotp.TOTP(decrypt_secret(staff.mfa_secret))
    if not totp.verify(body.otp.strip(), valid_window=1):
        return fail(401, "Invalid authenticator code", "AUTH_MFA_INVALID")
    codes = [new_token(8).upper()[:10] for _ in range(8)]
    staff.mfa_recovery = encrypt_secret(json.dumps([hash_recovery_code(code) for code in codes]))
    staff.mfa_enabled = True
    write_audit(
        db,
        actor_id=staff.id,
        action="MFA_ENABLE",
        entity="staff",
        entity_id=staff.id,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    return envelope({"recovery_codes": codes}, "MFA enabled")


@router.post("/api/v1/auth/mfa/disable")
def mfa_disable(
    body: MfaDisableIn,
    request: Request,
    staff: Staff = Depends(require_permission("auth.manage")),
    db: Session = Depends(get_db),
):
    if not verify_password(body.password, staff.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if staff.mfa_enabled and staff.mfa_secret:
        totp = pyotp.TOTP(decrypt_secret(staff.mfa_secret))
        if body.otp and not totp.verify(body.otp.strip(), valid_window=1):
            return fail(401, "Invalid authenticator code", "AUTH_MFA_INVALID")
    staff.mfa_enabled = False
    staff.mfa_secret = None
    staff.mfa_recovery = None
    write_audit(
        db,
        actor_id=staff.id,
        action="MFA_DISABLE",
        entity="staff",
        entity_id=staff.id,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
    )
    db.commit()
    return envelope(None, "MFA disabled")


@router.post("/api/v1/auth/mfa/recovery-codes")
def mfa_recovery_codes(
    staff: Staff = Depends(require_permission("auth.manage")),
    db: Session = Depends(get_db),
):
    if not staff.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    codes = [new_token(8).upper()[:10] for _ in range(8)]
    staff.mfa_recovery = encrypt_secret(json.dumps([hash_recovery_code(code) for code in codes]))
    db.commit()
    return envelope({"recovery_codes": codes}, "Recovery codes replaced")


def catalog_payload(db: Session) -> dict:
    row = db.get(CatalogState, "default")
    payload = dict(row.payload or {}) if row else {}
    return {key: payload.get(key) for key in CATALOG_KEYS}


@router.get("/api/v1/catalog")
def get_catalog(
    _staff: Staff = Depends(require_permission("snapshot.read", "settings.manage")),
    db: Session = Depends(get_db),
):
    key = cache_key("settings", kind="catalog")
    cached = cache_get(key)
    if cached is not None:
        return envelope(cached)
    data = catalog_payload(db)
    cache_set(key, data)
    return envelope(data)


@router.put("/api/v1/catalog")
def put_catalog(
    body: CatalogPutIn,
    _staff: Staff = Depends(require_permission("settings.manage")),
    db: Session = Depends(get_db),
):
    apply_catalog(db, body.payload or {})
    db.commit()
    bust_settings()
    return envelope(catalog_payload(db), "Saved")


@router.post("/api/v1/files")
async def upload_file(
    upload: UploadFile = File(...),
    entity_type: str = Form(""),
    entity_id: str = Form(""),
    staff: Staff = Depends(require_permission("file.upload")),
    db: Session = Depends(get_db),
):
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
        entity_type=entity_type[:64],
        entity_id=entity_id[:64],
        uploaded_by=staff.id,
    )
    db.add(row)
    db.commit()
    return envelope(file_out(row), "Uploaded", 201)


@router.get("/api/v1/files/{file_id}")
def get_file(
    file_id: str,
    _staff: Staff = Depends(require_permission("file.download")),
    db: Session = Depends(get_db),
):
    row = db.get(FileObject, file_id)
    if row is None or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="File not found")
    return envelope(file_out(row))


@router.get("/api/v1/files/{file_id}/content")
def download_file(
    file_id: str,
    _staff: Staff = Depends(require_permission("file.download")),
    db: Session = Depends(get_db),
):
    row = db.get(FileObject, file_id)
    if row is None or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data = get_bytes(row.storage_key)
    except StorageError as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc
    filename = row.original_name.replace('"', "")
    mime = row.mime_type or "application/octet-stream"
    inline = mime.startswith("image/") or mime == "application/pdf"
    disposition = "inline" if inline else "attachment"
    return StreamingResponse(
        iter([data]),
        media_type=mime,
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


@router.delete("/api/v1/files/{file_id}")
def delete_file(
    file_id: str,
    staff: Staff = Depends(require_permission("file.upload")),
    db: Session = Depends(get_db),
):
    row = db.get(FileObject, file_id)
    if row is None or row.deleted_at is not None:
        raise HTTPException(status_code=404, detail="File not found")
    if staff.role != "admin" and row.uploaded_by != staff.id:
        raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
    row.deleted_at = utcnow()
    delete_key(row.storage_key)
    db.commit()
    return envelope(None, "Deleted")


@router.get("/api/v1/notifications")
def list_notifications(
    staff: Staff = Depends(require_permission("notification.view")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Notification)
        .filter(Notification.recipient_user_id == staff.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )
    return envelope([notification_out(row) for row in rows])


@router.get("/api/v1/notifications/unread-count")
def unread_count(
    staff: Staff = Depends(require_permission("notification.view")),
    db: Session = Depends(get_db),
):
    count = (
        db.query(Notification)
        .filter(Notification.recipient_user_id == staff.id, Notification.is_read.is_(False))
        .count()
    )
    return envelope({"count": count})


@router.post("/api/v1/notifications/{notification_id}/read")
def mark_read(
    notification_id: str,
    staff: Staff = Depends(require_permission("notification.view")),
    db: Session = Depends(get_db),
):
    row = db.get(Notification, notification_id)
    if row is None or row.recipient_user_id != staff.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.is_read = True
    row.read_at = utcnow()
    db.commit()
    return envelope(notification_out(row))


@router.post("/api/v1/notifications/read-all")
def mark_all_read(
    staff: Staff = Depends(require_permission("notification.view")),
    db: Session = Depends(get_db),
):
    now = utcnow()
    db.query(Notification).filter(
        Notification.recipient_user_id == staff.id,
        Notification.is_read.is_(False),
    ).update({"is_read": True, "read_at": now}, synchronize_session=False)
    db.commit()
    return envelope(None, "Updated")


def file_out(row: FileObject) -> dict:
    return {
        "id": row.id,
        "original_name": row.original_name,
        "mime_type": row.mime_type,
        "size": row.size,
        "checksum": row.checksum,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def notification_out(row: Notification) -> dict:
    return {
        "id": row.id,
        "type": row.type,
        "title": row.title,
        "message": row.message,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "is_read": row.is_read,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "read_at": row.read_at.isoformat() if row.read_at else None,
    }


def create_notification(
    db: Session,
    *,
    recipient_user_id: str,
    title: str,
    message: str,
    type: str = "info",
    entity_type: str = "",
    entity_id: str = "",
) -> Notification:
    row = Notification(
        id=new_id("nt"),
        recipient_user_id=recipient_user_id,
        type=type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(row)
    return row
