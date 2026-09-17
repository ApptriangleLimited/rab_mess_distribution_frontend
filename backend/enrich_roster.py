"""Add more members, fill Daily tags, and seed request queues.

Keeps the existing 16-person roster. Run:
  docker exec srb_backend python enrich_roster.py
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from cache import bust_members, bust_tag_requests
from database import SessionLocal
from models import Assignment, Member, TagRequest
from persist import upsert_assignment, upsert_member, upsert_tag_request
from replace_members import ROWS as EXISTING_ROWS
from replace_members import payload

TODAY = date.today()
MONTH_START = date(TODAY.year, TODAY.month, 1)

DAILY_TAGS = (
    "FR",
    "CL",
    "PL",
    "WR",
    "CD",
    "WIT",
    "MED",
    "ML",
    "TRG",
    "MS",
    "MOL",
    "CMH",
    "RBH",
    "BGH",
    "AWL",
    "OSL",
    "RL",
    "JL",
    "PE",
    "LNK",
    "MFR",
)

OVERLAY_TAGS = (
    "CL",
    "TRG",
    "WIT",
    "MED",
    "PL",
    "CD",
    "MS",
    "WR",
    "MOL",
    "CMH",
    "RBH",
    "BGH",
    "AWL",
    "OSL",
    "RL",
    "PE",
    "LNK",
)

EXTRA_ROWS = [
    {"id": "u_seed_17", "name": "Imran Kabir", "member_type": "permanent", "wing": "Per Br", "rank": "Constable", "force": "Army", "approval_status": "approved", "status": "1", "default_tag": "FR", "contact": "Father"},
    {"id": "u_seed_18", "name": "Sadia Noor", "member_type": "new", "wing": "Gen Br", "rank": "ASI", "force": "Police", "approval_status": "approved", "status": "1", "default_tag": "CL", "contact": "Spouse"},
    {"id": "u_seed_19", "name": "Kamal Sheikh", "member_type": "attached", "wing": "Sup Br", "rank": "Attached", "force": "BGB", "approval_status": "approved", "status": "1", "default_tag": "PL", "contact": "Brother"},
    {"id": "u_seed_20", "name": "Rehana Parvin", "member_type": "civilian", "wing": "Med Br", "rank": "Civill", "force": "Civilian", "approval_status": "approved", "status": "1", "default_tag": "WR", "contact": "Mother"},
    {"id": "u_seed_21", "name": "Anwar Hossain", "member_type": "permanent", "wing": "Rec Br", "rank": "Naik", "force": "Army", "approval_status": "approved", "status": "1", "default_tag": "CD", "contact": "Father"},
    {"id": "u_seed_22", "name": "Mitu Akter", "member_type": "new", "wing": "Proc Br", "rank": "AASI", "force": "Air Force", "approval_status": "approved", "status": "1", "default_tag": "WIT", "contact": "Sister"},
    {"id": "u_seed_23", "name": "Sohel Rana", "member_type": "attached", "wing": "Budget Br", "rank": "Attached", "force": "Navy", "approval_status": "approved", "status": "1", "default_tag": "MED", "contact": "Uncle"},
    {"id": "u_seed_24", "name": "Nasrin Sultana", "member_type": "civilian", "wing": "Dev Br", "rank": "Civill", "force": "Civilian", "approval_status": "approved", "status": "1", "default_tag": "TRG", "contact": "Spouse"},
    {"id": "u_seed_25", "name": "Jahangir Alam", "member_type": "permanent", "wing": "Wksp Br", "rank": "DAD", "force": "Police", "approval_status": "approved", "status": "1", "default_tag": "MS", "contact": "Father"},
    {"id": "u_seed_26", "name": "Popy Das", "member_type": "new", "wing": "MT Br", "rank": "ANCE", "force": "Ansar", "approval_status": "approved", "status": "1", "default_tag": "MOL", "contact": "Mother"},
    {"id": "u_seed_27", "name": "Liton Miah", "member_type": "attached", "wing": "Rat Br", "rank": "Attached", "force": "BGB", "approval_status": "approved", "status": "1", "default_tag": "CMH", "contact": "Brother"},
    {"id": "u_seed_28", "name": "Sharmin Nahar", "member_type": "civilian", "wing": "Proj Br", "rank": "Civill", "force": "Civilian", "approval_status": "approved", "status": "1", "default_tag": "RBH", "contact": "Sister"},
    {"id": "u_seed_29", "name": "Faisal Ahmed", "member_type": "permanent", "wing": "Security Branch - IEC Cell", "rank": "RT", "force": "Navy", "approval_status": "approved", "status": "1", "default_tag": "BGH", "contact": "Spouse"},
    {"id": "u_seed_30", "name": "Rubina Yasmin", "member_type": "new", "wing": "Headquarters Branch", "rank": "ASI", "force": "Police", "approval_status": "approved", "status": "1", "default_tag": "AWL", "contact": "Father"},
    {"id": "u_seed_31", "name": "Shahidul Islam", "member_type": "attached", "wing": "Headquarters Office", "rank": "Attached", "force": "Army", "approval_status": "approved", "status": "1", "default_tag": "OSL", "contact": "Cousin"},
    {"id": "u_seed_32", "name": "Jannatul Ferdous", "member_type": "civilian", "wing": "Security Branch", "rank": "Civill", "force": "Civilian", "approval_status": "approved", "status": "1", "default_tag": "RL", "contact": "Mother"},
    {"id": "u_seed_33", "name": "Mamun Reza", "member_type": "permanent", "wing": "Record Branch", "rank": "Cook", "force": "Army", "approval_status": "approved", "status": "1", "default_tag": "PE", "contact": "Brother"},
    {"id": "u_seed_34", "name": "Sumaiya Khan", "member_type": "new", "wing": "Field Mess", "rank": "Constable", "force": "Ansar", "approval_status": "approved", "status": "1", "default_tag": "LNK", "contact": "Spouse"},
    {"id": "u_seed_35", "name": "Arif Chowdhury", "member_type": "attached", "wing": "MT Branch", "rank": "Attached", "force": "BGB", "approval_status": "approved", "status": "1", "default_tag": "MFR", "contact": "Uncle"},
    {"id": "u_seed_36", "name": "Dilara Begum", "member_type": "civilian", "wing": "New / Temporary Attached", "rank": "Civill", "force": "Civilian", "approval_status": "approved", "status": "1", "default_tag": "JL", "contact": "Sister"},
    {"id": "u_seed_37", "name": "Rashid Khan", "member_type": "new", "wing": "DG Office", "rank": "Naik", "force": "Army", "approval_status": "pending", "status": "1", "default_tag": "TRG", "contact": "Father"},
    {"id": "u_seed_38", "name": "Mini Roy", "member_type": "civilian", "wing": "ADG (Ops) Office", "rank": "Civill", "force": "Civilian", "approval_status": "pending", "status": "1", "default_tag": "MS", "contact": "Mother"},
    {"id": "u_seed_39", "name": "Tanvir Hasan", "member_type": "guest", "wing": "ADG (Admin) Office", "rank": "DAD", "force": "Army", "approval_status": "approved", "status": "1", "default_tag": "MS", "contact": "Host"},
    {"id": "u_seed_40", "name": "Khaled Mostafa", "member_type": "permanent", "wing": "Ops Wg", "rank": "ASI", "force": "Police", "approval_status": "ended", "status": "0", "default_tag": "MS", "contact": "Brother", "out_date": (TODAY - timedelta(days=20)).isoformat()},
    {"id": "u_seed_41", "name": "Rashedul Islam", "member_type": "permanent", "wing": "Ops Wg", "rank": "ASI", "force": "Police", "approval_status": "approved", "status": "1", "default_tag": "MS", "contact": "Father"},
    {"id": "u_seed_42", "name": "Farzana Akter", "member_type": "permanent", "wing": "Int Wg", "rank": "Constable", "force": "Police", "approval_status": "approved", "status": "1", "default_tag": "FR", "contact": "Spouse"},
]

REQUEST_SPECS = [
    # Daily queue — CC → Daily (board defaults to pending)
    {"queue": "daily", "to_tag": "FR", "from_tag": "MS", "status": "requested", "days_ago": 0, "by": "cc"},
    {"queue": "daily", "to_tag": "TRG", "from_tag": "MS", "status": "requested", "days_ago": 0, "by": "cc"},
    {"queue": "daily", "to_tag": "CL", "from_tag": "FR", "status": "requested", "days_ago": 1, "by": "cc"},
    {"queue": "daily", "to_tag": "MED", "from_tag": "MS", "status": "requested", "days_ago": 1, "by": "cc"},
    {"queue": "daily", "to_tag": "WIT", "from_tag": "TRG", "status": "requested", "days_ago": 2, "by": "cc"},
    {"queue": "daily", "to_tag": "CD", "from_tag": "MS", "status": "requested", "days_ago": 2, "by": "cc"},
    {"queue": "daily", "to_tag": "PL", "from_tag": "MS", "status": "requested", "days_ago": 3, "by": "cc"},
    {"queue": "daily", "to_tag": "WR", "from_tag": "FR", "status": "requested", "days_ago": 3, "by": "cc"},
    {"queue": "daily", "to_tag": "MOL", "from_tag": "MS", "status": "updated", "days_ago": 4, "by": "cc", "updated_by": "daily"},
    {"queue": "daily", "to_tag": "CMH", "from_tag": "MED", "status": "updated", "days_ago": 4, "by": "cc", "updated_by": "daily"},
    {"queue": "daily", "to_tag": "AWL", "from_tag": "MS", "status": "rejected", "days_ago": 5, "by": "cc", "updated_by": "daily"},
    # Ration queue — Daily → Ration (FR / CD)
    {"queue": "ration", "to_tag": "FR", "from_tag": "MS", "status": "requested", "days_ago": 0, "by": "daily"},
    {"queue": "ration", "to_tag": "CD", "from_tag": "MS", "status": "requested", "days_ago": 0, "by": "daily"},
    {"queue": "ration", "to_tag": "FR", "from_tag": "CL", "status": "requested", "days_ago": 1, "by": "daily"},
    {"queue": "ration", "to_tag": "CD", "from_tag": "FR", "status": "requested", "days_ago": 1, "by": "daily"},
    {"queue": "ration", "to_tag": "FR", "from_tag": "MS", "status": "requested", "days_ago": 2, "by": "daily"},
    {"queue": "ration", "to_tag": "CD", "from_tag": "MS", "status": "requested", "days_ago": 2, "by": "daily"},
    {"queue": "ration", "to_tag": "FR", "from_tag": "TRG", "status": "updated", "days_ago": 3, "by": "daily", "updated_by": "ration"},
    {"queue": "ration", "to_tag": "CD", "from_tag": "MS", "status": "updated", "days_ago": 3, "by": "daily", "updated_by": "ration"},
    {"queue": "ration", "to_tag": "FR", "from_tag": "MS", "status": "rejected", "days_ago": 4, "by": "daily", "updated_by": "ration"},
    # Consume queue — Daily → Consume (other tags)
    {"queue": "consume", "to_tag": "TRG", "from_tag": "MS", "status": "requested", "days_ago": 0, "by": "daily"},
    {"queue": "consume", "to_tag": "MED", "from_tag": "MS", "status": "requested", "days_ago": 0, "by": "daily"},
    {"queue": "consume", "to_tag": "WIT", "from_tag": "FR", "status": "requested", "days_ago": 1, "by": "daily"},
    {"queue": "consume", "to_tag": "CL", "from_tag": "MS", "status": "requested", "days_ago": 1, "by": "daily"},
    {"queue": "consume", "to_tag": "PL", "from_tag": "MS", "status": "requested", "days_ago": 2, "by": "daily"},
    {"queue": "consume", "to_tag": "WR", "from_tag": "TRG", "status": "requested", "days_ago": 2, "by": "daily"},
    {"queue": "consume", "to_tag": "MOL", "from_tag": "MS", "status": "updated", "days_ago": 3, "by": "daily", "updated_by": "consume"},
    {"queue": "consume", "to_tag": "CMH", "from_tag": "MED", "status": "updated", "days_ago": 3, "by": "daily", "updated_by": "consume"},
    {"queue": "consume", "to_tag": "AWL", "from_tag": "MS", "status": "rejected", "days_ago": 4, "by": "daily", "updated_by": "consume"},
]


def each_date(start: date, end: date):
    day = start
    while day <= end:
        yield day
        day += timedelta(days=1)


def stamp(day: date, hour: int) -> str:
    return datetime(day.year, day.month, day.day, hour, 18, 0, tzinfo=timezone.utc).isoformat()


def tag_for_day(index: int, default: str, day: date) -> str:
    if default == "MFR":
        return "MFR"
    overlay = OVERLAY_TAGS[index % len(OVERLAY_TAGS)]
    if overlay != default and 3 <= day.day <= 6 + (index % 3):
        return overlay
    if index % 4 == 0 and default in ("MS", "FR") and day.day >= max(1, TODAY.day - 3):
        return "CL" if default == "MS" else "TRG"
    return default


def seed_assignments(db, members: list[Member]) -> int:
    roster = [
        m
        for m in members
        if m.approval_status == "approved" and m.status == "1"
    ]
    written = 0
    for i, member in enumerate(roster):
        default = (member.default_tag or "MS").upper()
        for day in each_date(MONTH_START, TODAY):
            tag = tag_for_day(i, default, day)
            suffix = member.id.replace("u_seed_", "")
            upsert_assignment(
                db,
                {
                    "id": f"a_seed_{suffix}_{day.strftime('%Y%m%d')}",
                    "user_id": member.id,
                    "date": day.isoformat(),
                    "tag": tag,
                    "updated_by": "daily",
                    "updated_at": stamp(day, 9),
                },
            )
            written += 1
    return written


def seed_requests(db, members: list[Member]) -> int:
    db.query(TagRequest).filter(TagRequest.id.like("tr_seed_%")).delete(
        synchronize_session=False
    )
    db.flush()
    roster = [
        m
        for m in members
        if m.approval_status == "approved" and m.status == "1" and m.member_type not in ("guest", "civilian")
    ]
    by_queue: dict[str, list[Member]] = {"daily": [], "ration": [], "consume": []}
    for i, member in enumerate(roster):
        by_queue[("daily", "ration", "consume")[i % 3]].append(member)

    used: set[tuple[str, str]] = set()
    written = 0
    queue_index = {"daily": 0, "ration": 0, "consume": 0}
    for i, spec in enumerate(REQUEST_SPECS):
        queue = spec["queue"]
        pool = by_queue[queue] or roster
        member = None
        start = queue_index[queue]
        for offset in range(len(pool)):
            candidate = pool[(start + offset) % len(pool)]
            key = (candidate.id, queue)
            if spec["status"] == "requested" and key in used:
                continue
            member = candidate
            queue_index[queue] = (start + offset + 1) % max(len(pool), 1)
            if spec["status"] == "requested":
                used.add(key)
            break
        if member is None:
            continue
        day = TODAY - timedelta(days=int(spec["days_ago"]))
        raw = {
            "id": f"tr_seed_{queue}_{i:02d}",
            "user_id": member.id,
            "date": day.isoformat(),
            "from_date": day.isoformat(),
            "to_date": day.isoformat(),
            "from_tag": spec["from_tag"],
            "to_tag": spec["to_tag"],
            "queue": queue,
            "status": spec["status"],
            "requested_by": spec["by"],
            "requested_at": stamp(day, 8 + (i % 8)),
        }
        if spec["status"] != "requested":
            raw["updated_by"] = spec.get("updated_by") or queue
            raw["updated_at"] = stamp(day, 14 + (i % 4))
        upsert_tag_request(db, raw)
        written += 1
    return written


def main() -> None:
    db = SessionLocal()
    try:
        for i, row in enumerate(EXTRA_ROWS, start=len(EXISTING_ROWS)):
            upsert_member(db, payload(row, i))
        db.flush()

        members = db.query(Member).order_by(Member.id).all()
        assignments = seed_assignments(db, members)
        requests = seed_requests(db, members)
        db.commit()
        bust_members()
        bust_tag_requests()

        approved = sum(1 for m in members if m.approval_status == "approved")
        types = sorted({m.member_type for m in members})
        tags = sorted({(m.default_tag or "").upper() for m in members if m.default_tag})
        print(
            f"members={len(members)} approved={approved} types={','.join(types)} "
            f"default_tags={len(tags)} assignments={assignments} tag_requests={requests}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
