from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.tag_requests import (
    apply_request,
    create_daily_request,
    create_duty_request,
    list_requests,
    pending_counts,
    reject_request,
    request_public,
)

router = APIRouter(prefix="/tag-requests", tags=["tag-requests"])


@router.get("")
def get_requests(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
    queue: str | None = None,
    status: str | None = None,
    user_id: str | None = None,
    q: str | None = None,
    page: int = Query(1),
    page_size: int = Query(25),
) -> dict:
    items, total, page, page_size = list_requests(
        db, queue=queue, status=status, user_id=user_id, q=q, page=page, page_size=page_size
    )
    return {
        "items": [request_public(r) for r in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/counts")
def get_counts(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return pending_counts(db)


@router.post("", status_code=201)
def post_request(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("cc", "admin"))],
) -> dict:
    return request_public(create_daily_request(db, body, staff, request))


@router.post("/duty", status_code=201)
def post_duty(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(require_roles("daily", "admin"))],
) -> dict:
    return request_public(create_duty_request(db, body, staff, request))


@router.post("/{request_id}/apply")
def post_apply(
    request_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return apply_request(db, request_id, staff, request)


@router.post("/{request_id}/reject")
def post_reject(
    request_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    return request_public(reject_request(db, request_id, staff, request))
