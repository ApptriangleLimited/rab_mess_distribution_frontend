from sqlalchemy.orm import Session

from app.domain.ids import new_id
from app.domain.phones import digits_only
from app.errors import AppError, FieldError
from app.models.settings import Sender
from app.models.staff import Staff
from app.services.audit import record_audit
from app.services.cache import bust_settings_cache


def sender_public(row: Sender) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "bank_name": row.bank_name,
        "account_name": row.account_name,
        "account_number": row.account_number,
        "routing": row.routing,
        "branch": row.branch,
        "branch_location": row.branch_location,
        "mapped_tags": [str(t).upper() for t in (row.mapped_tags or [])],
        "active": row.active,
    }


def _apply(row: Sender, body: dict) -> None:
    label = str(body.get("label") or "").strip()
    if not label:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Label required",
            [FieldError("label", "required", "Label is required")],
        )
    row.label = label
    row.bank_name = str(body.get("bank_name") or "").strip()
    row.account_name = str(body.get("account_name") or "").strip()
    row.account_number = digits_only(str(body.get("account_number") or ""))
    row.routing = digits_only(str(body.get("routing") or ""))
    row.branch = str(body.get("branch") or "").strip()
    row.branch_location = str(body.get("branch_location") or "").strip()
    row.mapped_tags = [str(t).strip().upper() for t in (body.get("mapped_tags") or []) if t]
    row.active = body.get("active") is not False


def create_sender(db: Session, body: dict, *, staff: Staff, request) -> Sender:
    row = Sender(id=new_id("s_"))
    _apply(row, body)
    db.add(row)
    record_audit(
        db,
        staff=staff,
        action="sender.create",
        entity_type="sender",
        entity_id=row.id,
        after=sender_public(row),
        request=request,
    )
    bust_settings_cache()
    db.commit()
    db.refresh(row)
    return row


def update_sender(db: Session, sender_id: str, body: dict, *, staff: Staff, request) -> Sender:
    row = db.get(Sender, sender_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Sender not found")
    before = sender_public(row)
    _apply(row, body)
    record_audit(
        db,
        staff=staff,
        action="sender.update",
        entity_type="sender",
        entity_id=row.id,
        before=before,
        after=sender_public(row),
        request=request,
    )
    bust_settings_cache()
    db.commit()
    db.refresh(row)
    return row


def delete_sender(db: Session, sender_id: str, *, staff: Staff, request) -> dict:
    row = db.get(Sender, sender_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Sender not found")
    record_audit(
        db,
        staff=staff,
        action="sender.delete",
        entity_type="sender",
        entity_id=row.id,
        before=sender_public(row),
        request=request,
    )
    db.delete(row)
    bust_settings_cache()
    db.commit()
    return {"id": sender_id}


def seed_default_senders(db: Session) -> int:
    if db.query(Sender).count():
        return 0
    rows = [
        Sender(
            id="s_fr",
            label="FR Pool",
            bank_name="Trust bank",
            account_name="RAB FR Allowance",
            account_number="9001001001",
            routing="000000001",
            branch="Head Office",
            branch_location="Dhaka",
            mapped_tags=["FR"],
            active=True,
        ),
        Sender(
            id="s_ms",
            label="Mess Fund",
            bank_name="Community bank",
            account_name="RAB Mess Fund",
            account_number="9001001002",
            routing="000000002",
            branch="HQ Branch",
            branch_location="Dhaka",
            mapped_tags=["MS"],
            active=True,
        ),
    ]
    db.add_all(rows)
    return len(rows)
