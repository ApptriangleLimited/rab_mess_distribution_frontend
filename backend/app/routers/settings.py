from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.assignments import parse_window
from app.services.catalog import (
    add_force,
    add_force_rank,
    add_member_bank,
    add_rank,
    add_wing,
    authorized_items,
    build_catalog,
    delete_force,
    delete_force_rank,
    delete_member_bank,
    delete_rank,
    delete_wing,
    patch_force_rank,
    patch_rank,
    patch_wing,
    put_authorized,
    put_equivalents,
    put_rank_force_wings,
)
from app.services.manpower import list_officer_absent, put_officer_absent
from app.services.qr_token import mint_register_token
from app.services.rates import create_rate, delete_rate, list_rate_rows, put_rates

router = APIRouter(prefix="/settings", tags=["settings"])
Write = Annotated[Staff, Depends(require_roles("ration", "admin"))]


@router.get("/rates")
def get_rates(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return {"items": list_rate_rows(db)}


@router.put("/rates")
def replace_rates(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return {"items": put_rates(db, body.get("items") or [], staff=staff, request=request)}


@router.post("/rates", status_code=201)
def post_rate(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return create_rate(db, str(body.get("tag") or ""), body.get("amount_per_day"), staff=staff, request=request)


@router.delete("/rates/{tag}")
def remove_rate(
    tag: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return delete_rate(db, tag, staff=staff, request=request)


@router.get("/catalog")
def get_catalog(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return build_catalog(db)


@router.post("/ranks", status_code=201)
def post_rank(body: dict, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return add_rank(db, str(body.get("label") or ""), str(body.get("elaborate") or ""), staff=staff, request=request)


@router.patch("/ranks/{label}")
def edit_rank(
    label: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return patch_rank(db, label, body.get("elaborate"), staff=staff, request=request)


@router.delete("/ranks/{label}")
def remove_rank(label: str, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return delete_rank(db, label, staff=staff, request=request)


@router.post("/wings", status_code=201)
def post_wing(body: dict, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return add_wing(
        db,
        str(body.get("label") or ""),
        body.get("parent"),
        str(body.get("elaborate") or ""),
        staff=staff,
        request=request,
    )


@router.patch("/wings/{label}")
def edit_wing(
    label: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return patch_wing(db, label, body.get("parent"), body.get("elaborate"), staff=staff, request=request)


@router.delete("/wings/{label}")
def remove_wing(label: str, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return delete_wing(db, label, staff=staff, request=request)


@router.post("/forces", status_code=201)
def post_force(body: dict, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return add_force(db, str(body.get("label") or ""), staff=staff, request=request)


@router.delete("/forces/{label}")
def remove_force(label: str, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return delete_force(db, label, staff=staff, request=request)


@router.post("/forces/{force}/ranks", status_code=201)
def post_force_rank(
    force: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return add_force_rank(
        db, force, str(body.get("label") or ""), str(body.get("elaborate") or ""), staff=staff, request=request
    )


@router.patch("/forces/{force}/ranks/{label}")
def edit_force_rank(
    force: str,
    label: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return patch_force_rank(db, force, label, str(body.get("elaborate") or ""), staff=staff, request=request)


@router.delete("/forces/{force}/ranks/{label}")
def remove_force_rank(
    force: str,
    label: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return delete_force_rank(db, force, label, staff=staff, request=request)


@router.put("/rank-equivalents/{rank}")
def replace_equivalents(
    rank: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return put_equivalents(db, rank, body.get("by_force") or {}, staff=staff, request=request)


@router.put("/rank-force-wings/{rank}")
def replace_rfw(
    rank: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return put_rank_force_wings(db, rank, body.get("by_force") or {}, staff=staff, request=request)


@router.post("/member-banks", status_code=201)
def post_bank(body: dict, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return add_member_bank(db, str(body.get("label") or ""), staff=staff, request=request)


@router.delete("/member-banks/{label}")
def remove_bank(label: str, request: Request, db: Annotated[Session, Depends(get_db)], staff: Write) -> dict:
    return delete_member_bank(db, label, staff=staff, request=request)


@router.get("/authorized")
def get_authorized(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return {"items": authorized_items(db)}


@router.put("/authorized")
def replace_authorized(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return {"items": put_authorized(db, body.get("items") or [], staff=staff, request=request)}


@router.get("/manpower-absent")
def get_manpower_absent(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
) -> dict:
    start, end = parse_window(month=None, start=from_, end=to, one=None)
    return {"items": list_officer_absent(db, start, end)}


@router.put("/manpower-absent")
def replace_manpower_absent(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
) -> dict:
    return put_officer_absent(db, body, staff, request)


@router.get("/register-qr")
def get_register_qr(
    _staff: Annotated[Staff, Depends(require_roles("admin", "cc"))],
) -> dict:
    return mint_register_token()


@router.post("/register-qr")
def post_register_qr(
    _staff: Annotated[Staff, Depends(require_roles("admin", "cc"))],
) -> dict:
    return mint_register_token()
