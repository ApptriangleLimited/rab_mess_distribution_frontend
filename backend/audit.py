from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models import AuditLog


def write_audit(
    db: Session,
    *,
    actor_id: str | None,
    action: str,
    entity: str,
    entity_id: str = "",
    ip: str = "",
    user_agent: str = "",
    meta: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id or "",
            action=action,
            entity=entity,
            entity_id=entity_id,
            ip=ip[:64],
            user_agent=user_agent[:255],
            meta=meta or {},
            created_at=datetime.now(timezone.utc),
        )
    )
