from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import require_roles
from app.services.assignments import require_date
from app.services.manpower import manpower_report
from app.services.reports import (
    consume_ledger,
    consume_month,
    consume_public,
    consume_tag_bill,
    consume_wings,
    ration_report,
    ration_staff,
    ration_transfers,
)

router = APIRouter(prefix="/reports", tags=["reports"])
MoneyRead = Annotated[Staff, Depends(require_roles("consume", "ration", "admin"))]
RationRead = Annotated[Staff, Depends(require_roles("ration", "admin"))]
ManpowerRead = Annotated[Staff, Depends(require_roles("daily", "admin"))]


def _preview_on(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() not in {"0", "false", "no", "off"}


@router.get("/consume/{month}")
def get_consume(month: str, db: Annotated[Session, Depends(get_db)], _staff: MoneyRead) -> dict:
    return consume_public(consume_month(db, month))


@router.get("/consume/{month}/tag/{tag}")
def get_consume_tag(month: str, tag: str, db: Annotated[Session, Depends(get_db)], _staff: MoneyRead) -> dict:
    return consume_tag_bill(db, month, tag)


@router.get("/consume/{month}/wings")
def get_consume_wings(month: str, db: Annotated[Session, Depends(get_db)], _staff: MoneyRead) -> dict:
    return consume_wings(db, month)


@router.get("/consume/{month}/ledger")
def get_consume_ledger(
    month: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: MoneyRead,
    tags: str | None = None,
    carry: str | None = None,
    preview_future: str | None = None,
) -> dict:
    tag_list = [p for p in (tags or "").split(",") if p.strip()] or None
    return consume_ledger(
        db,
        month,
        tags=tag_list,
        carry=_preview_on(carry),
        preview_future=_preview_on(preview_future),
    )


@router.get("/ration/{month}")
def get_ration(month: str, db: Annotated[Session, Depends(get_db)], _staff: RationRead) -> dict:
    return ration_report(db, month)


@router.get("/ration/{month}/staff")
def get_ration_staff(
    month: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: RationRead,
    sender_id: str | None = None,
    tag: str | None = None,
) -> dict:
    return ration_staff(db, month, sender_id=sender_id, tag=tag)


@router.get("/ration/{month}/transfers")
def get_ration_transfers(
    month: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: RationRead,
    sender_id: str = Query(...),
    mode: str = "grouped",
    tag: str | None = None,
) -> dict:
    return ration_transfers(db, month, sender_id=sender_id, mode=mode, tag=tag)


@router.get("/manpower")
def get_manpower(
    db: Annotated[Session, Depends(get_db)],
    _staff: ManpowerRead,
    date: str,
) -> dict:
    return manpower_report(db, require_date(date))
