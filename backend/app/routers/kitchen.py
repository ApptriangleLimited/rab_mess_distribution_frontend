from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.assignments import parse_window, require_date
from app.services.kitchen import (
    assign_public,
    create_plan,
    create_shift,
    delete_plan,
    delete_shift,
    get_plan,
    guest_public,
    ingest_assign,
    list_assigns,
    list_guests,
    list_plans,
    list_shifts,
    plan_public,
    shift_public,
    update_plan,
    update_shift,
)

KitchenWrite = Annotated[Staff, Depends(require_roles("mess", "admin"))]

shifts_router = APIRouter(prefix="/meal-shifts", tags=["meal-shifts"])
plans_router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])
assigns_router = APIRouter(prefix="/meal-assigns", tags=["meal-assigns"])
guests_router = APIRouter(prefix="/guest-meals", tags=["guest-meals"])


@shifts_router.get("")
def get_shifts(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return {"items": [shift_public(s) for s in list_shifts(db)]}


@shifts_router.post("", status_code=201)
def post_shift(
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
) -> dict:
    return shift_public(create_shift(db, body))


@shifts_router.put("/{shift_id}")
def put_shift(
    shift_id: str,
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
) -> dict:
    return shift_public(update_shift(db, shift_id, body))


@shifts_router.delete("/{shift_id}")
def remove_shift(
    shift_id: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
) -> dict:
    delete_shift(db, shift_id)
    return {"id": shift_id}


@plans_router.get("")
def get_plans(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
) -> dict:
    start, end = parse_window(month=None, start=from_, end=to, one=None)
    return {"items": [plan_public(p) for p in list_plans(db, start, end)]}


@plans_router.get("/{day}")
def get_plan_day(
    day: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return plan_public(get_plan(db, require_date(day)))


@plans_router.post("", status_code=201)
def post_plan(
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
) -> dict:
    return plan_public(create_plan(db, body))


@plans_router.put("/{day}")
def put_plan(
    day: str,
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
) -> dict:
    return plan_public(update_plan(db, require_date(day), body))


@plans_router.delete("/{day}")
def remove_plan(
    day: str,
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
) -> dict:
    return {"date": delete_plan(db, require_date(day))}


@assigns_router.get("")
def get_assigns(
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    shift_id: str | None = None,
    status: str | None = None,
    member_id: str | None = None,
    page: int = Query(1),
    page_size: int = Query(25),
) -> dict:
    start, end = parse_window(month=None, start=from_, end=to, one=None)
    items, total, page, page_size = list_assigns(
        db,
        start=start,
        end=end,
        shift_id=shift_id,
        status=status,
        member_id=member_id,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [assign_public(r) for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "from": start.isoformat(),
        "to": end.isoformat(),
    }


@assigns_router.post("/ingest", status_code=201)
def post_ingest(
    body: dict,
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
) -> dict:
    return assign_public(ingest_assign(db, body))


@guests_router.get("")
def get_guests(
    db: Annotated[Session, Depends(get_db)],
    _staff: KitchenWrite,
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    shift_id: str | None = None,
    page: int = Query(1),
    page_size: int = Query(25),
) -> dict:
    start, end = parse_window(month=None, start=from_, end=to, one=None)
    items, total, page, page_size = list_guests(
        db, start=start, end=end, shift_id=shift_id, page=page, page_size=page_size
    )
    return {
        "items": [guest_public(r) for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "from": start.isoformat(),
        "to": end.isoformat(),
    }
