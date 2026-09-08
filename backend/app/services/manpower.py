from datetime import date

from sqlalchemy.orm import Session

from app.domain.assign import can_assign_on_date, is_cockpit
from app.domain.manpower import (
    ABSENT_TAGS,
    AUTHORIZED_ROOT_WINGS,
    authorized_wing_count,
    category_id_for_rank,
    is_admin_authorized_root,
    is_banned_wing,
    is_officer_category,
    root_wing,
)
from app.errors import AppError
from app.models.member import Member
from app.models.settings import ManpowerOfficerAbsent, OrgWing
from app.models.staff import Staff
from app.services.assignments import cockpit_tag, require_date
from app.services.audit import record_audit
from app.services.catalog import authorized_items


def _empty(categories: list[dict]) -> dict[str, int]:
    return {c["id"]: 0 for c in categories}


def _add(a: dict[str, int], b: dict[str, int], categories: list[dict]) -> dict[str, int]:
    return {c["id"]: (a.get(c["id"], 0) + b.get(c["id"], 0)) for c in categories}


def _present(held: dict[str, int], absent: dict[str, int], categories: list[dict]) -> dict[str, int]:
    return {c["id"]: max(0, (held.get(c["id"], 0) - absent.get(c["id"], 0))) for c in categories}


def _auth_wings(db: Session) -> list[str]:
    live = {w.label.lower() for w in db.query(OrgWing).all()}
    has_admin = any(k in {"admin", "admin (new)", "admin (old)"} for k in live)
    out = []
    for wing in AUTHORIZED_ROOT_WINGS:
        if wing == "Admin":
            if has_admin or "admin" in live:
                out.append("Admin")
            continue
        if wing.lower() in live:
            out.append(wing)
    return out


def _wing_parents(db: Session) -> dict[str, str]:
    return {w.label: w.parent for w in db.query(OrgWing).all() if w.parent}


def _to_auth_wing(root: str, auth_wings: list[str]) -> str | None:
    if not root or root == "—" or is_banned_wing(root):
        return None
    auth_set = {w.lower() for w in auth_wings}
    if is_admin_authorized_root(root) or root == "Admin":
        return "Admin" if "admin" in auth_set else None
    return root if root.lower() in auth_set else None


def _bucket(categories: list[dict]) -> dict:
    return {
        "held": _empty(categories),
        "present": _empty(categories),
        "absent": _empty(categories),
        "absence": {
            "cl": 0,
            "pl": 0,
            "rl": 0,
            "ml": 0,
            "maternity": 0,
            "training": 0,
            "witness": 0,
            "exam": 0,
            "other": 0,
            "hospital": 0,
            "avg_present": 0,
        },
    }


def _tick_absence(bucket: dict, tag: str) -> None:
    row = bucket["absence"]
    if tag == "CL":
        row["cl"] += 1
    elif tag == "PL":
        row["pl"] += 1
    elif tag in {"WR", "RL"}:
        row["rl"] += 1
    elif tag == "MED":
        row["ml"] += 1
    elif tag == "MOL":
        row["maternity"] += 1
    elif tag == "TRG":
        row["training"] += 1
    elif tag == "WIT":
        row["witness"] += 1
    elif tag in {"CD", "PE"}:
        row["exam"] += 1
    elif tag in {"CMH", "RBH", "BGH"}:
        row["hospital"] += 1
    elif tag in {"AWL", "OSL"}:
        row["avg_present"] += 1
    else:
        row["other"] += 1


def manpower_report(db: Session, day: date) -> dict:
    categories = authorized_items(db)
    officer_id = next((c["id"] for c in categories if is_officer_category(c["label"])), None)
    officer_cat = next((c for c in categories if c["id"] == officer_id), None) if officer_id else None
    auth_wings = _auth_wings(db)
    parents = _wing_parents(db)
    hq_auth = {c["id"]: int(c.get("count") or 0) for c in categories}
    hq_held = _empty(categories)
    hq_absent = _empty(categories)
    wing_map = {w: _bucket(categories) for w in auth_wings}

    members = (
        db.query(Member)
        .filter(Member.approval_status == "approved", Member.status == "1", Member.member_type != "guest")
        .all()
    )
    for member in members:
        if not is_cockpit(member) or not can_assign_on_date(member, day):
            continue
        cat_id = category_id_for_rank(member.rank, categories)
        if not cat_id:
            continue
        tag = cockpit_tag(db, member, day)
        root = root_wing(member.wing, parents)
        auth_wing = _to_auth_wing(root, auth_wings)
        hq_held[cat_id] = hq_held.get(cat_id, 0) + 1
        wing = wing_map.get(auth_wing) if auth_wing else None
        if wing:
            wing["held"][cat_id] = wing["held"].get(cat_id, 0) + 1
        if tag not in ABSENT_TAGS:
            continue
        hq_absent[cat_id] = hq_absent.get(cat_id, 0) + 1
        if not wing:
            continue
        wing["absent"][cat_id] = wing["absent"].get(cat_id, 0) + 1
        _tick_absence(wing, tag)

    officer_absent = {
        r.wing: r.count
        for r in db.query(ManpowerOfficerAbsent).filter(ManpowerOfficerAbsent.date == day).all()
    }
    if officer_id and officer_cat:
        hq_officer_held = 0
        hq_officer_absent = 0
        for wing_name in auth_wings:
            held_n = authorized_wing_count(officer_cat.get("held_wings"), wing_name)
            abs_n = authorized_wing_count(officer_absent, wing_name)
            hq_officer_held += held_n
            hq_officer_absent += abs_n
            bucket = wing_map.get(wing_name)
            if bucket:
                bucket["held"][officer_id] = held_n
                bucket["absent"][officer_id] = abs_n
                bucket["present"][officer_id] = max(0, held_n - abs_n)
        hq_held[officer_id] = hq_officer_held
        hq_absent[officer_id] = hq_officer_absent

    hq_present = _present(hq_held, hq_absent, categories)
    for block in wing_map.values():
        block["present"] = _present(block["held"], block["absent"], categories)
        if officer_id:
            block["present"][officer_id] = max(0, block["held"].get(officer_id, 0) - block["absent"].get(officer_id, 0))

    wings = []
    for wing in auth_wings:
        block = wing_map[wing]
        authorized = {c["id"]: authorized_wing_count(c.get("wings"), wing) for c in categories}
        wings.append(
            {
                "wing": wing,
                "authorized": authorized,
                "held": block["held"],
                "present": block["present"],
                "absent": block["absent"],
            }
        )

    grand_auth = _empty(categories)
    grand_held = _empty(categories)
    grand_present = _empty(categories)
    grand_absent = _empty(categories)
    for block in wings:
        grand_auth = _add(grand_auth, block["authorized"], categories)
        grand_held = _add(grand_held, block["held"], categories)
        grand_present = _add(grand_present, block["present"], categories)
        grand_absent = _add(grand_absent, block["absent"], categories)

    absence = []
    for wing in auth_wings:
        row = wing_map[wing]["absence"]
        total = sum(row.values())
        absence.append({"wing": wing, **row, "total": total})

    return {
        "date": day.isoformat(),
        "officer_category_id": officer_id or "auth_officer",
        "categories": categories,
        "hq": {
            "authorized": hq_auth,
            "held": hq_held,
            "shortfall": {c["id"]: hq_auth.get(c["id"], 0) - hq_held.get(c["id"], 0) for c in categories},
            "present": hq_present,
            "absent": hq_absent,
        },
        "wings": wings,
        "grand_total": {
            "wing": "Total",
            "authorized": grand_auth,
            "held": grand_held,
            "present": grand_present,
            "absent": grand_absent,
        },
        "absence": absence,
    }


def list_officer_absent(db: Session, start: date, end: date) -> list[dict]:
    rows = (
        db.query(ManpowerOfficerAbsent)
        .filter(ManpowerOfficerAbsent.date >= start, ManpowerOfficerAbsent.date <= end)
        .order_by(ManpowerOfficerAbsent.date, ManpowerOfficerAbsent.wing)
        .all()
    )
    return [{"date": r.date.isoformat(), "wing": r.wing, "count": r.count} for r in rows]


def put_officer_absent(db: Session, body: dict, staff: Staff, request) -> dict:
    day = require_date(body.get("date"))
    wing = str(body.get("wing") or "").strip()
    if not wing:
        raise AppError(400, "VALIDATION_ERROR", "wing required")
    try:
        count = int(body.get("count") or 0)
    except (TypeError, ValueError) as exc:
        raise AppError(400, "VALIDATION_ERROR", "count must be an integer") from exc
    if count < 0:
        count = 0
    row = db.get(ManpowerOfficerAbsent, {"date": day, "wing": wing})
    if count == 0:
        if row is not None:
            db.delete(row)
        record_audit(
            db,
            staff=staff,
            action="manpower.absent.clear",
            entity_type="manpower_absent",
            entity_id=f"{day.isoformat()}|{wing}",
            request=request,
        )
        db.commit()
        return {"date": day.isoformat(), "wing": wing, "count": 0}
    if row is None:
        row = ManpowerOfficerAbsent(date=day, wing=wing, count=count)
        db.add(row)
    else:
        row.count = count
    record_audit(
        db,
        staff=staff,
        action="manpower.absent.put",
        entity_type="manpower_absent",
        entity_id=f"{day.isoformat()}|{wing}",
        after={"count": count},
        request=request,
    )
    db.commit()
    return {"date": day.isoformat(), "wing": wing, "count": count}
