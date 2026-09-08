from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff
from app.services.assignments import parse_window, require_date
from app.services.mess import list_eaters, list_ledger

router = APIRouter(prefix="/mess", tags=["mess"])


def _preview_on(value: str | None) -> bool:
    if value is None:
        return True
    return value.strip().lower() not in {"0", "false", "no", "off"}


@router.get("/eaters")
def get_eaters(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    date: str,
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
) -> dict:
    return list_eaters(db, require_date(date), rank=rank, wing=wing, q=q)


@router.get("/ledger")
def get_ledger(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
    preview_future: str | None = None,
) -> dict:
    start, end = parse_window(month=None, start=from_, end=to, one=None)
    return list_ledger(
        db,
        start,
        end,
        rank=rank,
        wing=wing,
        q=q,
        preview_future=_preview_on(preview_future),
    )
