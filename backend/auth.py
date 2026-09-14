import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from cache import is_revoked
from config import settings
from database import get_db
from models import RefreshSession, Staff
from security import hash_token, new_id, new_token, utcnow

JWT_SECRET = settings.jwt_secret
JWT_EXPIRES_SECONDS = settings.jwt_expires_seconds
JWT_REFRESH_EXPIRES_SECONDS = settings.jwt_refresh_expires_seconds
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(staff: Staff, expires_at: datetime | None = None) -> str:
    now = datetime.now(timezone.utc)
    expiry = expires_at or (now + timedelta(seconds=JWT_EXPIRES_SECONDS))
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= now:
        expiry = now + timedelta(seconds=1)
    payload = {
        "sub": staff.id,
        "email": staff.email,
        "role": staff.role,
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int(expiry.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def issue_refresh_session(
    db: Session,
    staff: Staff,
    *,
    family_id: str | None = None,
    ip: str = "",
    user_agent: str = "",
    expires_at: datetime | None = None,
) -> tuple[str, RefreshSession]:
    raw = new_token()
    row = RefreshSession(
        id=new_id("rs"),
        staff_id=staff.id,
        token_hash=hash_token(raw),
        family_id=family_id or new_id("rf"),
        revoked=False,
        expires_at=expires_at or (utcnow() + timedelta(seconds=JWT_REFRESH_EXPIRES_SECONDS)),
        user_agent=(user_agent or "")[:255],
        ip=(ip or "")[:64],
    )
    db.add(row)
    db.flush()
    return raw, row


def revoke_refresh_family(db: Session, family_id: str) -> None:
    db.query(RefreshSession).filter(RefreshSession.family_id == family_id).update(
        {"revoked": True},
        synchronize_session=False,
    )


def revoke_staff_sessions(db: Session, staff_id: str) -> None:
    db.query(RefreshSession).filter(RefreshSession.staff_id == staff_id).update(
        {"revoked": True},
        synchronize_session=False,
    )


def rotate_refresh_session(
    db: Session,
    raw_token: str,
    *,
    ip: str = "",
    user_agent: str = "",
) -> tuple[Staff, str, datetime]:
    row = db.query(RefreshSession).filter(RefreshSession.token_hash == hash_token(raw_token)).first()
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    staff = db.get(Staff, row.staff_id)
    if row.revoked:
        revoke_refresh_family(db, row.family_id)
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token reused")
    if row.expires_at <= utcnow() or staff is None or not staff.active:
        row.revoked = True
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")
    raw, nxt = issue_refresh_session(
        db,
        staff,
        family_id=row.family_id,
        ip=ip,
        user_agent=user_agent,
        expires_at=row.expires_at,
    )
    row.revoked = True
    row.replaced_by = nxt.id
    db.flush()
    return staff, raw, nxt.expires_at


def current_staff(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Staff:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    if is_revoked(creds.credentials, payload):
        raise HTTPException(status_code=401, detail="Not authenticated")
    staff = db.get(Staff, payload.get("sub"))
    if staff is None or not staff.active:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return staff


def require_roles(*roles: str):
    def _inner(staff: Staff = Depends(current_staff)) -> Staff:
        if staff.role not in roles:
            raise HTTPException(
                status_code=403, detail="You do not have permission to perform this action."
            )
        return staff

    return _inner
