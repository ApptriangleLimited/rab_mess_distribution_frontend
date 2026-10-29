"""Update corrected members and add the people who were missing.

Never deletes a member. An SRB ID that already belongs to a different person
is saved with " (2)" so the existing row stays.

    PYTHONPATH=/app python /tmp/apply-member-roster-sync.py \
      /tmp/member-corrections.json /tmp/member-additions.json
"""

from __future__ import annotations

import json
import sys
import uuid
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
    "status",
}
DATE_FIELDS = {"joining_date", "out_date"}
SKIP_TOKENS = {"md", "mst", "mrs", "miss", "mr"}


def norm(value: str) -> str:
    return " ".join(str(value or "").strip().split()).lower()


def new_id() -> str:
    return f"u_{uuid.uuid4().hex[:12]}"


def tokens(name: str) -> set[str]:
    return {part for part in norm(name).split() if part not in SKIP_TOKENS and len(part) > 1}


def same_person(left: str, right: str) -> bool:
    a, b = tokens(left), tokens(right)
    if not a or not b:
        return False
    shared = a & b
    return len(shared) >= 1 and len(shared) / min(len(a), len(b)) >= 0.5


def apply_fields(member: Member, patch: dict) -> bool:
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
            if not isinstance(value, list) or not value:
                continue
            if member.emergency_contacts != value:
                member.emergency_contacts = value
                changed = True
            continue
        text = str(value if value is not None else "").strip()
        if not text:
            continue
        if getattr(member, key) != text:
            setattr(member, key, text)
            changed = True
    if changed:
        member.updated_at = datetime.now(timezone.utc)
    return changed


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python apply-member-roster-sync.py corrections.json additions.json")
    with open(sys.argv[1], encoding="utf-8") as handle:
        corrections = json.load(handle)
    with open(sys.argv[2], encoding="utf-8") as handle:
        additions = json.load(handle)
    if not isinstance(corrections, list) or len(corrections) < 50:
        raise SystemExit("refusing: correction file is too small")
    if not isinstance(additions, list) or len(additions) < 40:
        raise SystemExit("refusing: addition file is too small")

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
        for raw in corrections:
            lookup = norm(raw.get("rab_id"))
            hits = by_rab.get(lookup, [])
            if len(hits) != 1:
                skipped += 1
                print("not updated", raw.get("rab_id"), raw.get("name", ""))
                continue
            member = hits[0]
            patch = dict(raw.get("patch") or {})
            if not patch:
                skipped += 1
                continue
            new_rab = str(patch.get("rab_id") or "").strip()
            if new_rab and norm(new_rab) != lookup:
                clash = by_rab.get(norm(new_rab), [])
                if any(other.id != member.id for other in clash):
                    print("kept SRB ID", member.rab_id, "because", new_rab, "is already used")
                    patch.pop("rab_id", None)
            if apply_fields(member, patch):
                updated += 1

        inserted = 0
        refreshed = 0
        for raw in additions:
            rab_id = str(raw.get("rab_id") or "").strip()
            name = str(raw.get("name") or "").strip()
            if not rab_id or not name:
                print("skipped blank", rab_id, name)
                continue
            hits = by_rab.get(norm(rab_id), [])
            same = [hit for hit in hits if same_person(hit.name, name)]
            if same:
                if apply_fields(same[0], raw):
                    refreshed += 1
                print("already on server", rab_id, name)
                continue
            stored_id = rab_id
            if hits:
                stored_id = f"{rab_id} (2)"
                while by_rab.get(norm(stored_id)):
                    stored_id = stored_id + " (2)"
                print("added beside", rab_id, "as", stored_id)
            row = Member(
                id=new_id(),
                name=name,
                personal_id=str(raw.get("personal_id") or ""),
                rab_id=stored_id,
                rfid=str(raw.get("rfid") or ""),
                rank=str(raw.get("rank") or ""),
                wing=str(raw.get("wing") or ""),
                force=str(raw.get("force") or ""),
                force_rank=str(raw.get("force_rank") or ""),
                religion=str(raw.get("religion") or ""),
                member_type=str(raw.get("member_type") or "permanent"),
                dropdown_no="",
                phone=str(raw.get("phone") or ""),
                blood_group=str(raw.get("blood_group") or ""),
                documents=[],
                documents_verified=False,
                status="0" if raw.get("out_date") else "1",
                approval_status="approved",
                bank_name=str(raw.get("bank_name") or ""),
                account_name=str(raw.get("account_name") or ""),
                account_number=str(raw.get("account_number") or ""),
                routing=str(raw.get("routing") or ""),
                branch=str(raw.get("branch") or ""),
                branch_location=str(raw.get("branch_location") or ""),
                joining_date=date.fromisoformat(raw["joining_date"]) if raw.get("joining_date") else None,
                out_date=date.fromisoformat(raw["out_date"]) if raw.get("out_date") else None,
                default_tag="MS",
                jl_end_date="",
                inactive_spans=[],
                emergency_contacts=raw.get("emergency_contacts") or [],
            )
            db.add(row)
            by_rab.setdefault(norm(stored_id), []).append(row)
            inserted += 1
            print("added", stored_id, name, row.wing)

        db.flush()
        after = db.query(Member).count()
        if after < before or after > before + len(additions):
            db.rollback()
            raise SystemExit(f"refusing: member count {before} -> {after}")
        db.commit()
        bust_members()
        print("updated", updated)
        print("already updated", refreshed)
        print("not updated", skipped)
        print("added", inserted)
        print("members now", after)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
