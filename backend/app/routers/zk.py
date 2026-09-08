from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff
from app.services.zk import demo_attendance, demo_status, demo_users

router = APIRouter(prefix="/zk/demo", tags=["zk-demo"])


@router.get("/status")
def get_status(_staff: Annotated[Staff, Depends(get_current_staff)]) -> dict:
    return demo_status()


@router.get("/users")
def get_users(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return demo_users(db)


@router.get("/attendance")
def get_attendance(
    _staff: Annotated[Staff, Depends(get_current_staff)],
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    limit: int | None = None,
) -> dict:
    return demo_attendance(start=from_, end=to, limit=limit)
