import re

from sqlalchemy.orm import Session

from app.constants import CACHE_RATES_KEY, CACHE_RATES_TTL
from app.domain.money import as_money, money_json
from app.domain.query import iexact
from app.domain.tags import (
    BUILTIN_CODES,
    DAILY_TAGS,
    RATE_ONLY,
    RATE_ONLY_CODES,
    TAG_RE,
    default_rate,
    is_builtin,
    is_protected,
)
from app.errors import AppError, FieldError
from app.models.settings import AllowanceRate, Sender
from app.models.staff import Staff
from app.services.audit import record_audit
from app.services.cache import bust_settings_cache, cache_get, cache_set


def _row(rate: AllowanceRate) -> dict:
    tag = rate.tag.upper()
    return {
        "tag": tag,
        "amount_per_day": money_json(rate.amount_per_day),
        "is_builtin": is_builtin(tag),
        "is_protected": is_protected(tag),
    }


def _ordered(rates: list[AllowanceRate]) -> list[AllowanceRate]:
    by_tag = {r.tag.upper(): r for r in rates}
    out: list[AllowanceRate] = []
    for code, _allow in DAILY_TAGS:
        if code in by_tag:
            out.append(by_tag.pop(code))
    for code, _amt in RATE_ONLY:
        if code in by_tag:
            out.append(by_tag.pop(code))
    out.extend(sorted(by_tag.values(), key=lambda r: r.tag.upper()))
    return out


def list_rate_rows(db: Session, *, use_cache: bool = True) -> list[dict]:
    if use_cache:
        cached = cache_get(CACHE_RATES_KEY)
        if cached is not None:
            return cached
    rows = [_row(r) for r in _ordered(db.query(AllowanceRate).all())]
    cache_set(CACHE_RATES_KEY, rows, CACHE_RATES_TTL)
    return rows


def ensure_rate_only(db: Session) -> None:
    existing = {r.tag.upper() for r in db.query(AllowanceRate).all()}
    for tag, amount in RATE_ONLY:
        if tag not in existing:
            db.add(AllowanceRate(tag=tag, amount_per_day=as_money(amount)))


def put_rates(db: Session, items: list[dict], *, staff: Staff, request) -> list[dict]:
    for item in items:
        tag = str(item.get("tag") or "").strip().upper()
        if not re.match(TAG_RE, tag):
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid tag",
                [FieldError("tag", "invalid", "Tag must be 2–8 letters or digits")],
            )
        amount = as_money(item.get("amount_per_day"))
        row = db.get(AllowanceRate, tag)
        if row is None:
            row = db.query(AllowanceRate).filter(iexact(AllowanceRate.tag, tag)).one_or_none()
        if row is None:
            db.add(AllowanceRate(tag=tag, amount_per_day=amount))
        else:
            row.tag = tag
            row.amount_per_day = amount
    ensure_rate_only(db)
    record_audit(
        db,
        staff=staff,
        action="rates.put",
        entity_type="rates",
        entity_id="*",
        after={"count": len(items)},
        request=request,
    )
    bust_settings_cache()
    db.commit()
    return list_rate_rows(db, use_cache=False)


def create_rate(db: Session, tag: str, amount, *, staff: Staff, request) -> dict:
    code = tag.strip().upper()
    if not re.match(TAG_RE, code):
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid tag",
            [FieldError("tag", "invalid", "Tag must be 2–8 letters or digits")],
        )
    if is_protected(code):
        raise AppError(
            409,
            "CONFLICT",
            "Tag already exists",
            [FieldError("tag", "taken", "Protected tag")],
        )
    existing = db.query(AllowanceRate).filter(iexact(AllowanceRate.tag, code)).one_or_none()
    if existing:
        raise AppError(
            409,
            "CONFLICT",
            "Tag already exists",
            [FieldError("tag", "taken", "Tag already exists")],
        )
    row = AllowanceRate(tag=code, amount_per_day=as_money(amount))
    db.add(row)
    record_audit(
        db,
        staff=staff,
        action="rates.create",
        entity_type="rate",
        entity_id=code,
        after={"amount_per_day": float(row.amount_per_day)},
        request=request,
    )
    bust_settings_cache()
    db.commit()
    db.refresh(row)
    return _row(row)


def delete_rate(db: Session, tag: str, *, staff: Staff, request) -> dict:
    code = tag.strip().upper()
    if is_protected(code):
        raise AppError(409, "PROTECTED_RATE", "Cannot delete a protected rate")
    row = db.query(AllowanceRate).filter(iexact(AllowanceRate.tag, code)).one_or_none()
    if row is None:
        raise AppError(404, "NOT_FOUND", "Rate not found")
    for sender in db.query(Sender).all():
        tags = [t for t in (sender.mapped_tags or []) if str(t).upper() != code]
        sender.mapped_tags = tags
    db.delete(row)
    record_audit(
        db,
        staff=staff,
        action="rates.delete",
        entity_type="rate",
        entity_id=code,
        request=request,
    )
    bust_settings_cache()
    db.commit()
    return {"tag": code}


def seed_default_rates(db: Session) -> int:
    if db.query(AllowanceRate).count():
        return 0
    created = 0
    for tag, allowance in DAILY_TAGS:
        db.add(AllowanceRate(tag=tag, amount_per_day=as_money(default_rate(tag, allowance))))
        created += 1
    for tag, amount in RATE_ONLY:
        db.add(AllowanceRate(tag=tag, amount_per_day=as_money(amount)))
        created += 1
    return created
