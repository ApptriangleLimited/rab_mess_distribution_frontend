"""Stamp au_entry_by / au_update_by with the acting staff SRB ID."""

from __future__ import annotations

from contextvars import ContextVar

from sqlalchemy import event
from sqlalchemy.orm import Session

current_actor_srb: ContextVar[str] = ContextVar("current_actor_srb", default="")


def set_actor_srb(value: str) -> None:
    current_actor_srb.set((value or "").strip())


def actor_srb() -> str:
    return current_actor_srb.get() or ""


def stamp_audit_fields(target, creating: bool) -> None:
    actor = actor_srb()
    if not actor or not hasattr(target, "au_entry_by"):
        return
    if creating and not getattr(target, "au_entry_by", None):
        target.au_entry_by = actor
    target.au_update_by = actor


@event.listens_for(Session, "before_flush")
def apply_audit_on_flush(session, _flush_context, _instances) -> None:
    for obj in session.new:
        stamp_audit_fields(obj, True)
    for obj in session.dirty:
        stamp_audit_fields(obj, False)
