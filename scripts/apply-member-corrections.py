"""Update existing members to match corrected Excel rows. Never inserts or deletes.

Match the stored SRB ID exactly, including a " (2)" copy. A second person who only
shares the base SRB ID is left alone.

    PYTHONPATH=/app python /tmp/apply-member-corrections.py /tmp/member-corrections.json
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timezone

from cache import bust_members
from database import SessionLocal
from models import Member

ALLOWED = {
    "rab_id",
    "name",
    "personal_id",
    "rank",
    "wing",
    "force",
    "force_rank",
    "phone",
    "blood_group",
    "religion",
    "member_type",
    "rfid",
    "bank_name",
    "account_name",
    "account_number",
    "routing",
    "branch",
    "branch_location",
    "joining_date",
    "out_date",
    "emergency_contacts",
}
DATE_FIELDS = {"joining_date", "out_date"}


def norm(value: str) -> str:
    return " ".join(str(value or "").strip().split()).lower()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python apply-member-corrections.py corrections.json")
    with open(sys.argv[1], encoding="utf-8") as handle:
        rows = json.load(handle)
    if not isinstance(rows, list) or len(rows) < 50:
        raise SystemExit("refusing: correction file is too small")

    db = SessionLocal()
    try:
        before = db.query(Member).count()
        members = db.query(Member).all()
        by_rab: dict[str, list[Member]] = {}
        for member in members:
            key = norm(member.rab_id)
            if key:
                by_rab.setdefault(key, []).append(member)

        updated = 0
        skipped = 0
        for raw in rows:
            lookup = norm(raw.get("rab_id"))
            hits = by_rab.get(lookup, [])
            if len(hits) != 1:
                skipped += 1
                print("not updated", raw.get("rab_id"), raw.get("name", ""))
                continue
            member = hits[0]
            patch = raw.get("patch") or {}
            if not isinstance(patch, dict) or not patch:
                skipped += 1
                continue
            new_rab = str(patch.get("rab_id") or "").strip()
            if new_rab and norm(new_rab) != lookup:
                clash = by_rab.get(norm(new_rab), [])
                if any(other.id != member.id for other in clash):
                    print("kept SRB ID", member.rab_id, "because", new_rab, "is already used")
                    patch = {key: value for key, value in patch.items() if key != "rab_id"}
            changed = False
            for key, value in patch.items():
                if key not in ALLOWED:
                    continue
                if key in DATE_FIELDS:
                    text = str(value or "").strip()
                    if not text:
                        continue
                    parsed = date.fromisoformat(text)
                    if getattr(member, key) != parsed:
                        setattr(member, key, parsed)
                        changed = True
                    continue
                if key == "emergency_contacts":
                    if not isinstance(value, list):
                        continue
                    if member.emergency_contacts != value:
                        member.emergency_contacts = value
                        changed = True
                    continue
                text = str(value if value is not None else "").strip()
                if getattr(member, key) != text:
                    setattr(member, key, text)
                    changed = True
            if not changed:
                continue
            member.updated_at = datetime.now(timezone.utc)
            updated += 1

        after = db.query(Member).count()
        if after != before:
            db.rollback()
            raise SystemExit(f"refusing: member count changed {before} -> {after}")
        db.commit()
        bust_members()
        print("updated", updated)
        print("not updated", skipped)
        print("members still", after)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
