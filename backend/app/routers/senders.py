from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.settings import Sender
from app.models.staff import Staff
from app.security.deps import get_current_staff, require_roles
from app.services.senders import create_sender, delete_sender, sender_public, update_sender

router = APIRouter(prefix="/senders", tags=["senders"])
Write = Annotated[Staff, Depends(require_roles("ration", "admin"))]


@router.get("")
def list_senders(
    db: Annotated[Session, Depends(get_db)],
    _staff: Annotated[Staff, Depends(get_current_staff)],
) -> dict:
    rows = db.query(Sender).order_by(Sender.label).all()
    return {"items": [sender_public(r) for r in rows]}


@router.post("", status_code=201)
def post_sender(
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return sender_public(create_sender(db, body, staff=staff, request=request))


@router.put("/{sender_id}")
def put_sender(
    sender_id: str,
    body: dict,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return sender_public(update_sender(db, sender_id, body, staff=staff, request=request))


@router.delete("/{sender_id}")
def remove_sender(
    sender_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    staff: Write,
) -> dict:
    return delete_sender(db, sender_id, staff=staff, request=request)
