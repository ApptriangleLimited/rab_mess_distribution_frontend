"""Fill empty bank fields from an Excel export. Does not overwrite a bank already saved.

Match personal number first, then SRB ID. Other member fields stay as they are.

    PYTHONPATH=/app python /tmp/apply-empty-banks.py /tmp/sybr-bank-updates.json
"""

from __future__ import annotations

import json
import sys

from cache import bust_members
from database import SessionLocal
from models import Member


def norm(value: str) -> str:
    return str(value or "").strip().lower()


def rab_key(value: str) -> str:
    text = norm(value)
    if " (" in text:
        text = text.split(" (", 1)[0]
    return text


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python apply-empty-banks.py banks.json")
    with open(sys.argv[1], encoding="utf-8") as handle:
        rows = json.load(handle)
    if not isinstance(rows, list) or not rows:
        raise SystemExit("refusing: bank file is empty")

    db = SessionLocal()
    try:
        members = db.query(Member).all()
        by_personal: dict[str, list[Member]] = {}
        by_rab: dict[str, list[Member]] = {}
        for member in members:
            personal = norm(member.personal_id)
            rab = rab_key(member.rab_id)
            if personal:
                by_personal.setdefault(personal, []).append(member)
            if rab:
                by_rab.setdefault(rab, []).append(member)

        filled = 0
        kept = 0
        missing = 0
        for raw in rows:
            personal = norm(raw.get("personal_id"))
            rab = rab_key(raw.get("rab_id"))
            hits = by_personal.get(personal, []) if personal else []
            if not hits and rab:
                hits = by_rab.get(rab, [])
            if len(hits) != 1:
                missing += 1
                print("not updated", raw.get("personal_id"), raw.get("rab_id"), raw.get("name", ""))
                continue
            member = hits[0]
            if (member.bank_name or "").strip():
                kept += 1
                print("kept existing", member.personal_id, member.name, member.bank_name)
                continue
            member.bank_name = str(raw.get("bank_name") or "")
            member.account_name = str(raw.get("account_name") or "")
            member.account_number = str(raw.get("account_number") or "")
            member.routing = str(raw.get("routing") or "")
            member.branch = str(raw.get("branch") or "")
            member.branch_location = str(raw.get("branch_location") or "")
            filled += 1
        db.commit()
        bust_members()
        print("filled", filled)
        print("kept existing bank", kept)
        print("not matched", missing)
        print("members still", db.query(Member).count())
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
