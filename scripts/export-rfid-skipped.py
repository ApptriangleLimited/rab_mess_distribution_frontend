"""Write the RFID rows that were not applied, with member wing and phone.

Uses rfid_import_staging plus live members. CSV opens in Excel.

    PYTHONPATH=/app python /tmp/export-rfid-skipped.py /tmp/rfid-not-updated.csv
"""

from __future__ import annotations

import csv
import re
import sys

from sqlalchemy import text

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
    return key.replace("p/no -", "p/no-").replace("p/no ", "p/no-")


def usable_rfid(value: object) -> str:
    digits = clean(value).replace(" ", "")
    if not digits or not re.fullmatch(r"[0-9]+", digits):
        return ""
    return digits


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/rfid-not-updated.csv"
    db = SessionLocal()
    try:
        members = db.query(Member).all()
        by_both: dict[tuple[str, str], list[Member]] = {}
        by_srb: dict[str, list[Member]] = {}
        for member in members:
            both = (norm_srb(member.rab_id), norm_personal(member.personal_id))
            by_both.setdefault(both, []).append(member)
            srb = norm_srb(member.rab_id)
            if srb:
                by_srb.setdefault(srb, []).append(member)

        staged = db.execute(
            text(
                f"""
                SELECT ser, srb_id, personal_no, name_en, rfid, srb_norm, personal_norm
                FROM {STAGING}
                ORDER BY ser
                """
            )
        ).mappings()

        rows = []
        for row in staged:
            rfid = usable_rfid(row["rfid"])
            hits = by_both.get((row["srb_norm"], row["personal_norm"]), [])
            srb_hits = by_srb.get(row["srb_norm"], [])
            member = hits[0] if len(hits) == 1 else (srb_hits[0] if len(srb_hits) == 1 else None)
            if not rfid:
                reason = "No usable RFID"
            elif len(hits) == 1:
                current = clean(hits[0].rfid)
                if current == rfid:
                    continue
                if current:
                    reason = "RFID already set (not overwritten)"
                else:
                    continue
            elif len(hits) > 1:
                reason = "Ambiguous match"
            else:
                reason = "Unmatched SRB ID + personal no"
            rows.append(
                {
                    "SRB ID": clean(member.rab_id if member else row["srb_id"]),
                    "Personal No": clean(member.personal_id if member else row["personal_no"]),
                    "Name": clean(member.name if member else row["name_en"]),
                    "Wing": clean(member.wing if member else ""),
                    "Mobile No": clean(member.phone if member else ""),
                    "RFID No": clean(row["rfid"]),
                    "Status": reason,
                }
            )

        with open(out, "w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=[
                    "SRB ID",
                    "Personal No",
                    "Name",
                    "Wing",
                    "Mobile No",
                    "RFID No",
                    "Status",
                ],
            )
            writer.writeheader()
            writer.writerows(rows)
        print("wrote", out, "rows", len(rows))
    finally:
        db.close()


if __name__ == "__main__":
    main()
