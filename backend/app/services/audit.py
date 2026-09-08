from fastapi import Request
from sqlalchemy.orm import Session

from app.domain.ids import new_id
from app.models.settings import AuditEvent
from app.models.staff import Staff


def record_audit(
    db: Session,
    *,
    staff: Staff | None,
    action: str,
    entity_type: str,
    entity_id: str,
    before: dict | None = None,
    after: dict | None = None,
    request: Request | None = None,
) -> None:
    rid = None
    ip = None
    if request is not None:
        rid = request.headers.get("x-request-id") or getattr(request.state, "request_id", None)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        elif request.client:
            ip = request.client.host
    db.add(
        AuditEvent(
            id=new_id("ae_"),
            staff_id=staff.id if staff else None,
            role=staff.role if staff else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
            request_id=rid,
            ip=ip,
        )
    )
