"""Load RFID Excel rows into rfid_import_staging, then copy RFID onto members.

Match only when both SRB ID and personal number hit the same member.
Never inserts or deletes members. Does not overwrite a different existing RFID.

    PYTHONPATH=/app python /tmp/apply-rfid-from-excel.py /tmp/rfid-import.json
    PYTHONPATH=/app python /tmp/apply-rfid-from-excel.py /tmp/rfid-import.json --dry-run
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone

from sqlalchemy import text

from cache import bust_members
from database import SessionLocal
from models import Member

STAGING = "rfid_import_staging"


def clean(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def norm(value: object) -> str:
    return clean(value).lower()


def norm_srb(value: object) -> str:
    key = norm(value)
    if key.startswith("srb-"):
        key = key[4:].strip()
    return key


def norm_personal(value: object) -> str:
    key = norm(value)
    key = key.replace("p/no -", "p/no-").replace("p/no ", "p/no-")
    return key


def usable_rfid(value: object) -> str:
    raw = clean(value)
    digits = raw.replace(" ", "")
    if not digits or not re.fullmatch(r"[0-9]+", digits):
        return ""
    return digits


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(
            "usage: python apply-rfid-from-excel.py rfid-import.json [--dry-run]"
        )
    path = sys.argv[1]
    dry_run = "--dry-run" in sys.argv[2:]
    with open(path, encoding="utf-8") as handle:
        rows = json.load(handle)
    if not isinstance(rows, list) or len(rows) < 50:
        raise SystemExit("refusing: RFID import file is too small")

    db = SessionLocal()
    try:
        db.execute(text(f"DROP TABLE IF EXISTS {STAGING}"))
        db.execute(
            text(
                f"""
                CREATE TABLE {STAGING} (
                  id serial PRIMARY KEY,
                  ser integer,
                  srb_id text NOT NULL DEFAULT '',
                  personal_no text NOT NULL DEFAULT '',
                  name_en text NOT NULL DEFAULT '',
                  name_bn text NOT NULL DEFAULT '',
                  designation text NOT NULL DEFAULT '',
                  unit text NOT NULL DEFAULT '',
                  rfid text NOT NULL DEFAULT '',
                  srb_norm text NOT NULL DEFAULT '',
                  personal_norm text NOT NULL DEFAULT '',
                  loaded_at timestamptz NOT NULL DEFAULT now()
                )
                """
            )
        )
        insert = text(
            f"""
            INSERT INTO {STAGING} (
              ser, srb_id, personal_no, name_en, name_bn, designation, unit,
              rfid, srb_norm, personal_norm
            ) VALUES (
              :ser, :srb_id, :personal_no, :name_en, :name_bn, :designation, :unit,
              :rfid, :srb_norm, :personal_norm
            )
            """
        )
        for raw in rows:
            srb = clean(raw.get("srb_id"))
            personal = clean(raw.get("personal_no"))
            db.execute(
                insert,
                {
                    "ser": int(raw.get("ser") or 0),
                    "srb_id": srb,
                    "personal_no": personal,
                    "name_en": clean(raw.get("name_en")),
                    "name_bn": clean(raw.get("name_bn")),
                    "designation": clean(raw.get("designation")),
                    "unit": clean(raw.get("unit")),
                    "rfid": clean(raw.get("rfid")),
                    "srb_norm": norm_srb(srb),
                    "personal_norm": norm_personal(personal),
                },
            )
        db.commit()
        staged = db.execute(text(f"SELECT count(*) FROM {STAGING}")).scalar_one()
        print("staging_rows", staged)

        members = db.query(Member).all()
        by_key: dict[tuple[str, str], list[Member]] = {}
        for member in members:
            key = (norm_srb(member.rab_id), norm_personal(member.personal_id))
            if key[0] or key[1]:
                by_key.setdefault(key, []).append(member)

        staged_rows = db.execute(
            text(
                f"""
                SELECT ser, srb_id, personal_no, name_en, rfid, srb_norm, personal_norm
                FROM {STAGING}
                ORDER BY ser
                """
            )
        ).mappings()

        updated = 0
        same = 0
        skipped_rfid = 0
        unmatched = 0
        ambiguous = 0
        conflict = 0
        now = datetime.now(timezone.utc)
        for row in staged_rows:
            rfid = usable_rfid(row["rfid"])
            if not rfid:
                skipped_rfid += 1
                continue
            key = (row["srb_norm"], row["personal_norm"])
            hits = by_key.get(key, [])
            if len(hits) == 0:
                unmatched += 1
                print("unmatched", row["srb_id"], row["personal_no"], row["name_en"])
                continue
            if len(hits) != 1:
                ambiguous += 1
                print("ambiguous", row["srb_id"], row["personal_no"], row["name_en"])
                continue
            member = hits[0]
            current = clean(member.rfid)
            if current == rfid:
                same += 1
                continue
            if current:
                conflict += 1
                print(
                    "conflict",
                    member.rab_id,
                    member.personal_id,
                    "have",
                    current,
                    "excel",
                    rfid,
                )
                continue
            if dry_run:
                updated += 1
                continue
            member.rfid = rfid
            member.updated_at = now
            updated += 1

        if dry_run:
            db.rollback()
            print("dry_run_no_member_changes")
        else:
            db.commit()
            bust_members()
        print(
            "members",
            len(members),
            "updated",
            updated,
            "already_same",
            same,
            "no_usable_rfid",
            skipped_rfid,
            "unmatched",
            unmatched,
            "ambiguous",
            ambiguous,
            "conflict",
            conflict,
            "dry_run" if dry_run else "applied",
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
