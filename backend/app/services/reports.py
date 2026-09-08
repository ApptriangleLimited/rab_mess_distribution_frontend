from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.assign import can_assign_on_date, carry_tag
from app.domain.dates import date_range, month_bounds, today_dhaka
from app.domain.members import member_public
from app.domain.money import money_days, money_json
from app.domain.reports_meta import CLFR_FALLBACK, FUEL_FALLBACK, RATION_REPORT_META, duty_tag_codes
from app.domain.shifts import member_sort_key
from app.errors import AppError
from app.models.daily import Assignment, SuppressedCarry
from app.models.member import Member
from app.models.settings import Sender
from app.services.assignments import _filter_members
from app.services.month_close import rate_map_for_month, require_closed_month, require_month
from app.services.senders import sender_public


def _rate(rates: dict, tag: str, fallback: Decimal = Decimal("0")) -> Decimal:
    return rates.get(tag.upper(), fallback)


def _fuel_rate(rates: dict) -> Decimal:
    return max(Decimal("0"), _rate(rates, "FUEL", FUEL_FALLBACK))


def _clfr_amount(rates: dict) -> Decimal:
    return max(Decimal("0"), _rate(rates, "CLFR", CLFR_FALLBACK))


def _assignments(db: Session, start: date, end: date) -> list[Assignment]:
    return (
        db.query(Assignment)
        .filter(Assignment.date >= start, Assignment.date <= end)
        .all()
    )


def _members_by_id(db: Session, ids: set[str]) -> dict[str, Member]:
    if not ids:
        return {}
    return {m.id: m for m in db.query(Member).filter(Member.id.in_(list(ids))).all()}


def _sort_members(a: Member, b: Member) -> int:
    ka, kb = member_sort_key(a), member_sort_key(b)
    return (ka > kb) - (ka < kb)


def _sort_bank_wise(a: Member, b: Member) -> int:
    ba = (a.bank_name or "").strip().lower() or "\uffff"
    bb = (b.bank_name or "").strip().lower() or "\uffff"
    if ba != bb:
        return (ba > bb) - (ba < bb)
    return _sort_members(a, b)


def consume_month(db: Session, month: str) -> dict:
    month = require_month(month)
    start, end = month_bounds(month)
    rates = rate_map_for_month(db, month)
    rows_asg = _assignments(db, start, end)
    by_user: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in rows_asg:
        by_user[row.member_id][row.tag] += 1
    members = _members_by_id(db, set(by_user))
    out_rows = []
    for member_id, tags in by_user.items():
        member = members.get(member_id)
        if member is None:
            continue
        total_days = 0
        allowance_days = 0
        amount = Decimal("0")
        tag_days = {}
        for tag, days in tags.items():
            tag_days[tag] = days
            total_days += days
            rate = _rate(rates, tag)
            if rate > 0:
                allowance_days += days
                amount += money_days(days, rate)
        out_rows.append(
            {
                "member": member,
                "user": member_public(member),
                "tag_days": tag_days,
                "total_days": total_days,
                "allowance_days": allowance_days,
                "amount": amount,
            }
        )
    out_rows.sort(key=lambda r: member_sort_key(r["member"]))
    tag_agg: dict[str, dict] = {}
    for row in rows_asg:
        cur = tag_agg.setdefault(row.tag, {"days": 0, "users": set()})
        cur["days"] += 1
        cur["users"].add(row.member_id)
    by_tag = [
        {
            "tag": tag,
            "days": info["days"],
            "users": len(info["users"]),
            "amount": money_json(money_days(info["days"], _rate(rates, tag))),
        }
        for tag, info in tag_agg.items()
    ]
    by_tag.sort(key=lambda r: (-r["days"], r["tag"]))
    return {
        "month": month,
        "assignment_count": len(rows_asg),
        "rows": [
            {
                "user": r["user"],
                "tag_days": r["tag_days"],
                "total_days": r["total_days"],
                "allowance_days": r["allowance_days"],
                "amount": money_json(r["amount"]),
            }
            for r in out_rows
        ],
        "_internal_rows": out_rows,
        "by_tag": by_tag,
        "total_amount": money_json(sum((r["amount"] for r in out_rows), Decimal("0"))),
    }


def consume_tag_bill(db: Session, month: str, tag: str) -> dict:
    month = require_month(month)
    tag = tag.strip().upper()
    if not tag:
        raise AppError(400, "VALIDATION_ERROR", "Tag required")
    consume = consume_month(db, month)
    rates = rate_map_for_month(db, month)
    rate = _rate(rates, tag)
    fuel_rate = _fuel_rate(rates) if tag == "FR" else Decimal("0")
    rows = []
    sl = 0
    for raw in consume["_internal_rows"]:
        days = int(raw["tag_days"].get(tag) or 0)
        if not days:
            continue
        sl += 1
        amount = money_days(days, rate)
        fuel_amount = money_days(days, fuel_rate)
        rows.append(
            {
                "sl": sl,
                "user": raw["user"],
                "days": days,
                "rate": money_json(rate),
                "amount": money_json(amount),
                "fuel_rate": money_json(fuel_rate),
                "fuel_amount": money_json(fuel_amount),
                "grand_total": money_json(amount + fuel_amount),
                "remarks": "",
            }
        )
    return {
        "month": month,
        "tag": tag,
        "rate": money_json(rate),
        "fuel_rate": money_json(fuel_rate),
        "rows": rows,
        "total_days": sum(r["days"] for r in rows),
        "total_amount": money_json(sum((Decimal(str(r["amount"])) for r in rows), Decimal("0"))),
        "total_fuel": money_json(sum((Decimal(str(r["fuel_amount"])) for r in rows), Decimal("0"))),
        "grand_total": money_json(sum((Decimal(str(r["grand_total"])) for r in rows), Decimal("0"))),
    }


def consume_wings(db: Session, month: str) -> dict:
    consume = consume_month(db, month)
    rates = rate_map_for_month(db, month)
    tag_codes = duty_tag_codes(list(rates))
    by_wing: dict[str, dict] = {}
    for raw in consume["_internal_rows"]:
        wing = raw["member"].wing or "—"
        cur = by_wing.setdefault(wing, {"user_ids": set(), "tag_days": {}})
        cur["user_ids"].add(raw["member"].id)
        for tag, days in raw["tag_days"].items():
            cur["tag_days"][tag] = cur["tag_days"].get(tag, 0) + days
    rows = []
    for wing, info in sorted(by_wing.items(), key=lambda item: item[0]):
        total_days = sum(info["tag_days"].values())
        rows.append(
            {
                "wing": wing,
                "manpower": len(info["user_ids"]),
                "tag_days": info["tag_days"],
                "total_days": total_days,
            }
        )
    totals_tags: dict[str, int] = {}
    manpower = 0
    total_days = 0
    for row in rows:
        manpower += row["manpower"]
        total_days += row["total_days"]
        for tag, days in row["tag_days"].items():
            totals_tags[tag] = totals_tags.get(tag, 0) + days
    return {
        "month": month,
        "tag_codes": tag_codes,
        "rows": rows,
        "totals": {"manpower": manpower, "tag_days": totals_tags, "total_days": total_days},
    }


def consume_ledger(
    db: Session,
    month: str,
    *,
    tags: list[str] | None = None,
    carry: bool = False,
    preview_future: bool = False,
) -> dict:
    month = require_month(month)
    start, end = month_bounds(month)
    days = date_range(start, end)
    tag_filter = [t.strip().upper() for t in (tags or []) if t.strip()]
    rates = rate_map_for_month(db, month)
    tag_codes = tag_filter or duty_tag_codes(list(rates))
    allowed = set(tag_codes)
    members = _filter_members(db, member_id=None, rank=None, wing=None, q=None)
    ids = [m.id for m in members]
    stored = {}
    suppressed = set()
    if ids:
        stored = {
            (r.member_id, r.date): r.tag
            for r in db.query(Assignment)
            .filter(Assignment.member_id.in_(ids), Assignment.date >= start, Assignment.date <= end)
            .all()
            if r.tag in allowed
        }
        suppressed = {
            (r.member_id, r.date)
            for r in db.query(SuppressedCarry)
            .filter(SuppressedCarry.member_id.in_(ids), SuppressedCarry.date >= start, SuppressedCarry.date <= end)
            .all()
        }
    today = today_dhaka()
    rows = []
    for member in sorted(members, key=member_sort_key):
        cells = []
        counts: dict[str, int] = {}
        for day in days:
            tag = stored.get((member.id, day), "")
            if not tag and carry and member.status == "1" and can_assign_on_date(member, day):
                if (member.id, day) not in suppressed and (day <= today or preview_future):
                    prior = (carry_tag(member) or "").upper()
                    if prior in allowed:
                        tag = prior
            cells.append(tag)
            if tag:
                counts[tag] = counts.get(tag, 0) + 1
        total = sum(counts.values())
        if carry and total == 0:
            continue
        if not carry and total == 0:
            continue
        rows.append(
            {
                "user": member_public(member),
                "days": cells,
                "tag_counts": counts,
                "total_days": total,
            }
        )
    return {
        "month": month,
        "day_count": len(days),
        "tag_codes": tag_codes,
        "rows": rows,
    }


def _clfr_lines(db: Session, month: str, rates: dict) -> list[dict]:
    monthly = _clfr_amount(rates)
    if monthly <= 0:
        return []
    start, end = month_bounds(month)
    by_user: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in _assignments(db, start, end):
        by_user[row.member_id][row.tag] += 1
    members = _members_by_id(db, set(by_user))
    lines = []
    for member_id, tags in by_user.items():
        member = members.get(member_id)
        if member is None:
            continue
        if tags.get("CL", 0) <= 0 or tags.get("MS", 0) <= 0 or tags.get("FR", 0) > 0:
            continue
        lines.append(
            {
                "member": member,
                "user": member_public(member),
                "tag": "CL",
                "days": tags["CL"],
                "rate": monthly,
                "amount": monthly,
            }
        )
    lines.sort(key=lambda r: _sort_bank_wise(r["member"], r["member"]) or member_sort_key(r["member"]))
    lines.sort(key=lambda r: ((r["member"].bank_name or "").lower() or "\uffff", member_sort_key(r["member"])))
    return lines


def _ration_lines(db: Session, month: str, rates: dict) -> list[dict]:
    start, end = month_bounds(month)
    days_map: dict[tuple[str, str], int] = defaultdict(int)
    for row in _assignments(db, start, end):
        if _rate(rates, row.tag) <= 0:
            continue
        days_map[(row.member_id, row.tag)] += 1
    members = _members_by_id(db, {mid for mid, _tag in days_map})
    lines = []
    for (member_id, tag), days in days_map.items():
        member = members.get(member_id)
        if member is None:
            continue
        rate = _rate(rates, tag)
        lines.append(
            {
                "member": member,
                "user": member_public(member),
                "tag": tag,
                "days": days,
                "rate": rate,
                "amount": money_days(days, rate),
            }
        )
    lines.extend(_clfr_lines(db, month, rates))
    return lines


def _active_senders(db: Session) -> list[Sender]:
    return db.query(Sender).filter(Sender.active.is_(True)).all()


def _public_line(line: dict) -> dict:
    return {
        "user": line["user"],
        "tag": line["tag"],
        "days": line["days"],
        "rate": money_json(line["rate"]),
        "amount": money_json(line["amount"]),
    }


def ration_report(db: Session, month: str) -> dict:
    month = require_month(month)
    require_closed_month(db, month)
    rates = rate_map_for_month(db, month)
    lines = _ration_lines(db, month, rates)
    senders = _active_senders(db)
    groups = []
    for sender in senders:
        mapped = {str(t).upper() for t in (sender.mapped_tags or [])}
        sender_lines = [l for l in lines if l["tag"] in mapped]
        if not sender_lines:
            continue
        sender_lines.sort(key=lambda l: (l["member"].name or "").lower())
        groups.append(
            {
                "sender": sender_public(sender),
                "lines": [_public_line(l) for l in sender_lines],
                "total": money_json(sum((l["amount"] for l in sender_lines), Decimal("0"))),
            }
        )
    mapped_tags = {str(t).upper() for s in senders for t in (s.mapped_tags or [])}
    unmapped = [_public_line(l) for l in lines if l["tag"] not in mapped_tags]
    return {
        "month": month,
        "groups": groups,
        "unmapped": unmapped,
        "total": money_json(sum((l["amount"] for l in lines), Decimal("0"))),
    }


def _missing_bank(member: Member) -> bool:
    return not (member.account_number or "").strip() or not (member.routing or "").strip()


def _bank_label(member: Member) -> str:
    return (member.bank_name or "").strip() or "—"


def _split_staff_sheets(month: str, sender: Sender, rolled: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    for row in rolled:
        groups.setdefault(_bank_label(row["member"]), []).append(row)
    sheets = []
    for bank, rows in sorted(groups.items(), key=lambda item: (item[0] == "—", item[0].lower())):
        lines = []
        for i, row in enumerate(rows, start=1):
            lines.append(
                {
                    "ser": i,
                    "user": row["user"],
                    "amount": money_json(row["amount"]),
                    "tags": row["tags"],
                    "days": row["days"],
                    "missing_bank": _missing_bank(row["member"]),
                    "remarks": row.get("remarks", ""),
                }
            )
        sheets.append(
            {
                "month": month,
                "sender": sender_public(sender),
                "member_bank": bank,
                "lines": lines,
                "total": money_json(sum((row["amount"] for row in rows), Decimal("0"))),
            }
        )
    return sheets


def _roll_per_user(lines: list[dict]) -> list[dict]:
    rolled: dict[str, dict] = {}
    for line in lines:
        cur = rolled.setdefault(
            line["member"].id,
            {"member": line["member"], "user": line["user"], "amount": Decimal("0"), "tags": [], "days": 0},
        )
        cur["amount"] += line["amount"]
        cur["days"] += line["days"]
        if line["tag"] not in cur["tags"]:
            cur["tags"].append(line["tag"])
    out = list(rolled.values())
    out.sort(key=lambda r: ((r["member"].bank_name or "").lower() or "\uffff", member_sort_key(r["member"])))
    return out


def ration_staff(db: Session, month: str, *, sender_id: str | None, tag: str | None) -> dict:
    month = require_month(month)
    require_closed_month(db, month)
    rates = rate_map_for_month(db, month)
    tag = tag.strip().upper() if tag else None
    if tag and sender_id:
        sender = db.get(Sender, sender_id)
        if sender is None or not sender.active:
            return {"sheets": []}
        if tag == "CL":
            lines = _clfr_lines(db, month, rates)
            rolled = [
                {
                    "member": l["member"],
                    "user": l["user"],
                    "amount": l["amount"],
                    "tags": ["CL"],
                    "days": l["days"],
                    "remarks": "CL→FR monthly (MS)",
                }
                for l in lines
            ]
            return {"sheets": _split_staff_sheets(month, sender, rolled)}
        start, end = month_bounds(month)
        days_map: dict[str, int] = defaultdict(int)
        for row in _assignments(db, start, end):
            if row.tag == tag:
                days_map[row.member_id] += 1
        members = _members_by_id(db, set(days_map))
        day_rate = _rate(rates, tag) + (_fuel_rate(rates) if tag == "FR" else Decimal("0"))
        rolled = []
        for member_id, days in days_map.items():
            member = members.get(member_id)
            if member is None:
                continue
            rolled.append(
                {
                    "member": member,
                    "user": member_public(member),
                    "amount": money_days(days, day_rate),
                    "tags": [tag],
                    "days": days,
                    "remarks": "",
                }
            )
        rolled.sort(key=lambda r: ((r["member"].bank_name or "").lower() or "\uffff", member_sort_key(r["member"])))
        return {"sheets": _split_staff_sheets(month, sender, rolled)}

    report_lines = _ration_lines(db, month, rates)
    senders = _active_senders(db)
    if sender_id:
        senders = [s for s in senders if s.id == sender_id]
    sheets = []
    for sender in senders:
        mapped = {str(t).upper() for t in (sender.mapped_tags or [])}
        scoped = [l for l in report_lines if l["tag"] in mapped]
        if tag:
            scoped = [l for l in scoped if l["tag"] == tag]
        rolled = _roll_per_user(scoped)
        if not rolled:
            continue
        lines = [
            {
                "ser": i,
                "user": row["user"],
                "amount": money_json(row["amount"]),
                "tags": row["tags"],
                "days": row["days"],
                "missing_bank": _missing_bank(row["member"]),
                "remarks": "",
            }
            for i, row in enumerate(rolled, start=1)
        ]
        sheets.append(
            {
                "month": month,
                "sender": sender_public(sender),
                "lines": lines,
                "total": money_json(sum((row["amount"] for row in rolled), Decimal("0"))),
            }
        )
    return {"sheets": sheets}


def ration_transfers(
    db: Session,
    month: str,
    *,
    sender_id: str,
    mode: str = "grouped",
    tag: str | None = None,
) -> dict:
    month = require_month(month)
    require_closed_month(db, month)
    if not sender_id:
        raise AppError(400, "VALIDATION_ERROR", "sender_id required")
    staff = ration_staff(db, month, sender_id=sender_id, tag=tag)
    sheets = staff["sheets"]
    if not sheets:
        sender = db.get(Sender, sender_id)
        return {
            "month": month,
            "sender": sender_public(sender) if sender else {},
            "report_date": today_dhaka().isoformat(),
            "lines": [],
            "total": 0.0,
        }
    report_date = today_dhaka().isoformat()
    compact = report_date.replace("-", "")
    if mode == "per_user":
        merged = [line for sheet in sheets for line in sheet["lines"]]
        source_sender = sheets[0]["sender"]
        lines = []
        for i, row in enumerate(merged, start=1):
            user = row["user"]
            lines.append(_transfer_line(i, report_date, compact, source_sender, user, row["amount"], row["missing_bank"]))
        return {
            "month": month,
            "sender": source_sender,
            "report_date": report_date,
            "lines": lines,
            "total": money_json(sum((Decimal(str(r["amount"])) for r in merged), Decimal("0"))),
        }
    # grouped: first sheet (bank-split already) or flatten all sheets into one payload
    # API returns a single sheet-shaped object; concatenate bank groups in order
    merged = []
    for sheet in sheets:
        merged.extend(sheet["lines"])
    source_sender = sheets[0]["sender"]
    lines = []
    for i, row in enumerate(merged, start=1):
        lines.append(
            _transfer_line(i, report_date, compact, source_sender, row["user"], row["amount"], row["missing_bank"])
        )
    return {
        "month": month,
        "sender": source_sender,
        "report_date": report_date,
        "lines": lines,
        "total": money_json(sum((Decimal(str(r["amount"])) for r in merged), Decimal("0"))),
    }


def _transfer_line(ser: int, report_date: str, compact: str, sender: dict, user: dict, amount, missing: bool) -> dict:
    return {
        "ser": ser,
        "date": report_date,
        "ref_no": f"{RATION_REPORT_META['refPrefix']}/{compact}{ser:06d}",
        "sender_account_no": sender.get("account_number") or "0",
        "receiver_routing": (user.get("routing") or "").strip() or "0",
        "sender_routing": sender.get("routing") or "0",
        "type": RATION_REPORT_META["transferType"],
        "customer_account_name": (user.get("account_name") or "").strip() or user.get("name"),
        "customer_account_no": (user.get("account_number") or "").strip() or "0",
        "amount": amount if isinstance(amount, float) else money_json(amount),
        "institute": RATION_REPORT_META["institute"],
        "entry_description": RATION_REPORT_META["entryDescription"],
        "payment_info": RATION_REPORT_META["paymentInfo"],
        "currency": RATION_REPORT_META["currency"],
        "user": user,
        "missing_bank": missing,
    }


def consume_public(data: dict) -> dict:
    return {k: v for k, v in data.items() if k != "_internal_rows"}
