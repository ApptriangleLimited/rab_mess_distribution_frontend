from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.constants import ROLES
from app.domain.ids import new_id
from app.errors import AppError, FieldError
from app.models.staff import Staff
from app.security.passwords import hash_password
from app.services.audit import record_audit


def staff_public(staff: Staff, *, with_active: bool = False) -> dict:
    row = {
        "id": staff.id,
        "email": staff.email,
        "display_name": staff.display_name,
        "role": staff.role,
    }
    if with_active:
        row["active"] = staff.active
    return row


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _require_password(value: str | None) -> str:
    password = str(value or "")
    if len(password) < 8:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Password too short",
            [FieldError("password", "invalid", "Must be at least 8 characters")],
        )
    return password


def _require_role(value: str | None) -> str:
    role = (value or "").strip().lower()
    if role not in ROLES:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid role",
            [FieldError("role", "invalid", f"Must be one of {', '.join(ROLES)}")],
        )
    return role


def _active_admins(db: Session) -> int:
    return db.query(Staff).filter(Staff.role == "admin", Staff.active.is_(True)).count()


def _guard_last_admin(db: Session, target: Staff, *, next_role: str, next_active: bool) -> None:
    if target.role != "admin" or not target.active:
        return
    loses_admin = next_role != "admin" or not next_active
    if loses_admin and _active_admins(db) <= 1:
        raise AppError(409, "LAST_ADMIN", "Cannot deactivate or demote the last admin")


def list_staff(
    db: Session,
    *,
    q: str | None = None,
    role: str | None = None,
    active: str | None = None,
) -> list[Staff]:
    query = db.query(Staff)
    if role and role.lower() != "all":
        query = query.filter(Staff.role == role.strip().lower())
    if active is not None and str(active).strip() != "":
        flag = str(active).strip().lower() not in {"0", "false", "no", "off"}
        query = query.filter(Staff.active.is_(flag))
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Staff.email).like(like),
                func.lower(Staff.display_name).like(like),
                func.lower(Staff.role).like(like),
            )
        )
    return query.order_by(Staff.role, Staff.email).all()


def create_staff(db: Session, body: dict, *, staff: Staff, request) -> Staff:
    email = _normalize_email(body.get("email"))
    if not email or "@" not in email:
        raise AppError(400, "VALIDATION_ERROR", "Valid email required", [FieldError("email", "invalid", "Valid email required")])
    if db.query(Staff).filter(func.lower(Staff.email) == email).one_or_none():
        raise AppError(409, "CONFLICT", "Email already exists", [FieldError("email", "taken", "Email already exists")])
    row = Staff(
        id=new_id("st_"),
        email=email,
        password_hash=hash_password(_require_password(body.get("password"))),
        display_name=str(body.get("display_name") or "").strip() or email.split("@")[0],
        role=_require_role(body.get("role")),
        active=body.get("active") is not False,
    )
    db.add(row)
    record_audit(
        db,
        staff=staff,
        action="staff.create",
        entity_type="staff",
        entity_id=row.id,
        after=staff_public(row, with_active=True),
        request=request,
    )
    db.commit()
    db.refresh(row)
    return row


def patch_staff(db: Session, staff_id: str, body: dict, *, actor: Staff, request) -> Staff:
    row = db.get(Staff, staff_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Staff not found")
    before = staff_public(row, with_active=True)
    next_role = _require_role(body["role"]) if "role" in body and body.get("role") is not None else row.role
    next_active = row.active
    if "active" in body:
        next_active = bool(body.get("active"))
    _guard_last_admin(db, row, next_role=next_role, next_active=next_active)
    if "display_name" in body:
        name = str(body.get("display_name") or "").strip()
        if not name:
            raise AppError(400, "VALIDATION_ERROR", "display_name required")
        row.display_name = name
    row.role = next_role
    row.active = next_active
    record_audit(
        db,
        staff=actor,
        action="staff.patch",
        entity_type="staff",
        entity_id=row.id,
        before=before,
        after=staff_public(row, with_active=True),
        request=request,
    )
    db.commit()
    db.refresh(row)
    return row


def set_password(db: Session, staff_id: str, body: dict, *, actor: Staff, request) -> dict:
    row = db.get(Staff, staff_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Staff not found")
    if actor.role != "admin" and actor.id != row.id:
        raise AppError(403, "FORBIDDEN", "Role not allowed")
    row.password_hash = hash_password(_require_password(body.get("password")))
    record_audit(
        db,
        staff=actor,
        action="staff.password",
        entity_type="staff",
        entity_id=row.id,
        request=request,
    )
    db.commit()
    return {"id": row.id}
