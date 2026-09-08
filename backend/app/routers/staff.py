from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.staff_admin import create_staff, list_staff, patch_staff, set_password, staff_public

router = APIRouter(prefix="/staff", tags=["staff"])
Admin = Annotated[Staff, Depends(require_roles("admin"))]


@router.get("")
def get_staff(
    db: Annotated[Session, Depends(get_db)],
    _staff: Admin,
    q: str | None = None,
    role: str | None = None,
    active: str | None = None,
) -> dict:
    return {"items": [staff_public(s, with_active=True) for s in list_staff(db, q=q, role=role, active=active)]}


@router.post("", status_code=201)
def post_staff(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Admin,
) -> dict:
    return staff_public(create_staff(db, body, staff=staff, request=request), with_active=True)


@router.patch("/{staff_id}")
def patch_one(
    staff_id: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Admin,
) -> dict:
    return staff_public(patch_staff(db, staff_id, body, actor=staff, request=request), with_active=True)


@router.post("/{staff_id}/password")
def post_password(
    staff_id: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    actor: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return set_password(db, staff_id, body, actor=actor, request=request)
