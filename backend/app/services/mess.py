from datetime import date

from sqlalchemy.orm import Session

from app.domain.assign import can_assign_on_date, carry_tag
from app.domain.dates import date_range, today_dhaka
from app.domain.members import member_public
from app.domain.shifts import LEDGER_TAGS, member_sort_key
from app.models.daily import Assignment, BoroKhanaDate, SuppressedCarry
from app.models.member import Member
from app.services.assignments import _filter_members, cockpit_tag


def _mess_reason(tag: str) -> str:
    if tag == "MS":
        return "MS"
    if tag == "FR":
        return "FR"
    return "BK"


def _active_assignable(members: list[Member], day: date) -> list[Member]:
    return [m for m in members if m.status == "1" and can_assign_on_date(m, day)]


def list_eaters(
    db: Session,
    day: date,
    *,
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
) -> dict:
    members = _filter_members(db, member_id=None, rank=rank, wing=wing, q=q)
    boro = db.get(BoroKhanaDate, day) is not None
    stored = {
        r.member_id: r
        for r in db.query(Assignment).filter(Assignment.date == day).all()
    }
    items = []
    if boro:
        for member in _active_assignable(members, day):
            row = stored.get(member.id)
            items.append(
                {
                    **member_public(member),
                    "assignment_id": row.id if row else f"bk-{member.id}-{day.isoformat()}",
                    "mess_reason": _mess_reason(cockpit_tag(db, member, day)),
                }
            )
    else:
        for member in _active_assignable(members, day):
            row = stored.get(member.id)
            if row is None or row.tag != "MS":
                continue
            items.append(
                {
                    **member_public(member),
                    "assignment_id": row.id,
                    "mess_reason": "MS",
                }
            )
    items.sort(key=lambda row: (row.get("name") or "").lower())
    return {
        "date": day.isoformat(),
        "boro_khana": boro,
        "items": items,
        "total": len(items),
    }


def list_ledger(
    db: Session,
    start: date,
    end: date,
    *,
    rank: str | None = None,
    wing: str | None = None,
    q: str | None = None,
    preview_future: bool = True,
) -> dict:
    days = date_range(start, end)
    dates = [d.isoformat() for d in days]
    members = _filter_members(db, member_id=None, rank=rank, wing=wing, q=q)
    ids = [m.id for m in members]
    stored_rows = []
    suppressed: set[tuple[str, date]] = set()
    if ids and days:
        stored_rows = (
            db.query(Assignment)
            .filter(
                Assignment.member_id.in_(ids),
                Assignment.date >= start,
                Assignment.date <= end,
                Assignment.tag.in_(list(LEDGER_TAGS)),
            )
            .all()
        )
        suppressed = {
            (r.member_id, r.date)
            for r in db.query(SuppressedCarry)
            .filter(
                SuppressedCarry.member_id.in_(ids),
                SuppressedCarry.date >= start,
                SuppressedCarry.date <= end,
            )
            .all()
        }
    stored: dict[tuple[str, date], str] = {(r.member_id, r.date): r.tag for r in stored_rows}
    today = today_dhaka()
    rows = []
    for member in sorted(members, key=member_sort_key):
        day_tags: list[str] = []
        counts: dict[str, int] = {}
        for day in days:
            tag = stored.get((member.id, day), "")
            if not tag:
                if member.status == "1" and can_assign_on_date(member, day):
                    if (member.id, day) not in suppressed and (day <= today or preview_future):
                        prior = (carry_tag(member) or "").upper()
                        if prior in LEDGER_TAGS:
                            tag = prior
            day_tags.append(tag)
            if tag:
                counts[tag] = counts.get(tag, 0) + 1
        total = sum(counts.values())
        if total == 0:
            continue
        rows.append(
            {
                "member": member_public(member),
                "days": day_tags,
                "tag_counts": counts,
                "total_days": total,
            }
        )
    boro_days = []
    for day in days:
        if db.get(BoroKhanaDate, day) is None:
            continue
        boro_days.append(
            {
                "date": day.isoformat(),
                "eater_count": len(_active_assignable(members, day)),
            }
        )
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "dates": dates,
        "tag_codes": list(LEDGER_TAGS),
        "rows": rows,
        "boro_khana_days": boro_days,
    }
