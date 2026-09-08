"""Seed six desk staff + P2 catalog. Idempotent. `python -m app.seed`."""

from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import SEED_EMAIL, SEED_STAFF
from app.db import get_session_factory
from app.models.staff import Staff
from app.security.passwords import hash_password
from app.domain.shifts import BUILTIN_SHIFTS
from app.models.kitchen import MealShift
from app.services.catalog import seed_catalog
from app.services.rates import seed_default_rates
from app.services.senders import seed_default_senders


def seed_staff(db: Session | None = None) -> int:
    settings = get_settings()
    own = db is None
    session = db or get_session_factory()()
    created = 0
    try:
        for staff_id, role, display_name in SEED_STAFF:
            email = SEED_EMAIL.format(role=role)
            existing = session.get(Staff, staff_id)
            if existing:
                continue
            by_email = session.query(Staff).filter(Staff.email == email).one_or_none()
            if by_email:
                continue
            session.add(
                Staff(
                    id=staff_id,
                    email=email,
                    password_hash=hash_password(settings.seed_staff_password),
                    display_name=display_name,
                    role=role,
                    active=True,
                )
            )
            created += 1
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        if own:
            session.close()
    return created


def seed_p2(db: Session | None = None) -> int:
    own = db is None
    session = db or get_session_factory()()
    created = 0
    try:
        created += seed_catalog(session)
        created += seed_default_rates(session)
        created += seed_default_senders(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        if own:
            session.close()
    return created


def seed_p5(db: Session | None = None) -> int:
    own = db is None
    session = db or get_session_factory()()
    created = 0
    try:
        for shift_id, name, start, end, description in BUILTIN_SHIFTS:
            if session.get(MealShift, shift_id):
                continue
            session.add(
                MealShift(
                    id=shift_id,
                    name=name,
                    start_time=start,
                    end_time=end,
                    description=description,
                )
            )
            created += 1
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        if own:
            session.close()
    return created


def main() -> None:
    n = seed_staff()
    p2 = seed_p2()
    p5 = seed_p5()
    print(f"seeded {n} staff, {p2} catalog rows, {p5} shifts")


if __name__ == "__main__":
    main()
