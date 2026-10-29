"""Add local members and the new force ranks. Does not delete anyone.

Existing production members, duty tags, and meal check-ins stay.
A new row whose SRB ID is already used keeps a distinct SRB ID so both rows remain.

Run inside the mess API container:

    PYTHONPATH=/app python /tmp/apply-members-and-ranks.py /tmp/production-members.json
"""

from __future__ import annotations

import json
import sys

from cache import bust_members
from database import SessionLocal
from models import AuthorizedStrength, CatalogState, Member, Rate, Staff
from persist import upsert_member
from sqlalchemy.orm.attributes import flag_modified

# Ranks added in local settings. Existing production ranks are not removed or renumbered.
NEW_RANKS = {
    "Army": [
        ("SI", "Sub-Inspector", "সাব-ইন্সপেক্টর"),
        ("NCE", "Non-Combatant Employee", "এনসিই"),
    ],
    "Navy": [
        ("CEA", "CEA", "সিইএ"),
        ("REA-IV", "REA-IV", "আরইএ-৪"),
        ("LEN", "LEN", "এলইএন"),
        ("LREN", "LREN", "এলআরইএন"),
        ("LRO(G)", "LRO(G)", "এলআরও(জি)"),
        ("LSA", "LSA", "এলএসএ"),
        ("LNP/LPM", "LNP/LPM", "এলএনপি/এলপিএম"),
        ("SA-I", "SA-I", "এসএ-১"),
        ("LME", "LME", "এলএমই"),
        ("PM-1", "PM-1", "পিএম-১"),
    ],
    "Civilian": [
        ("Office Assistant", "Office Assistant", "অফিস সহকারী"),
        ("UDC", "UDC", "ইউডিসি"),
    ],
    "BGB": [
        ("NCE", "Non-Combatant Employee", "এনসিই"),
    ],
}


def has_code(items, code: str) -> bool:
    want = code.lower()
    return any(str(item).strip().lower() == want for item in items or [])


def add_ranks(payload: dict) -> list[str]:
    added = []
    force_ranks = payload.setdefault("force_ranks", {})
    extras = payload.setdefault("force_rank_extras", {})
    labels = payload.setdefault("force_rank_labels", {})
    labels_bn = payload.setdefault("force_rank_labels_bn", {})
    serials = payload.setdefault("force_rank_serials", {})
    for force, ranks in NEW_RANKS.items():
        ladder = list(force_ranks.get(force) or [])
        extra = list(extras.get(force) or [])
        label_map = dict(labels.get(force) or {})
        bn_map = dict(labels_bn.get(force) or {})
        serial_map = dict(serials.get(force) or {})
        for code, label, bangla in ranks:
            if not has_code(ladder, code):
                ladder.append(code)
                added.append(f"{force} {code}")
            if not has_code(extra, code):
                extra.append(code)
            label_map.setdefault(code, label)
            bn_map.setdefault(code, bangla)
            if code not in serial_map:
                nums = [
                    int(value)
                    for value in serial_map.values()
                    if isinstance(value, (int, float)) and int(value) > 0
                ]
                serial_map[code] = (max(nums) if nums else 0) + 1 
        force_ranks[force] = ladder
        extras[force] = extra
        labels[force] = label_map
        labels_bn[force] = bn_map
        serials[force] = serial_map
    return added


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python apply-members-and-ranks.py members.json")
    with open(sys.argv[1], encoding="utf-8") as handle:
        rows = json.load(handle)
    if not isinstance(rows, list) or len(rows) < 1000:
        raise SystemExit(f"refusing: expected the full member list, got {len(rows) if isinstance(rows, list) else type(rows)}")

    db = SessionLocal()
    try:
        before_members = db.query(Member).count()
        before_rates = db.query(Rate).count()
        before_staff = db.query(Staff).count()
        before_auth = db.query(AuthorizedStrength).count()
        catalog = db.get(CatalogState, "default")
        if catalog is None or not isinstance(catalog.payload, dict):
            raise SystemExit("refusing: production catalog settings row is missing")
        before_wings = list(catalog.payload.get("wings") or [])
        before_banks = list(catalog.payload.get("member_banks") or [])
        before_srb_ranks = list(catalog.payload.get("ranks") or [])
        existing_ids = {row[0] for row in db.query(Member.id).all()}
        taken_rab = {
            (row[0] or "").strip().lower()
            for row in db.query(Member.rab_id).all()
            if (row[0] or "").strip()
        }
        inserted = 0
        skipped = 0
        for raw in rows:
            member_id = str(raw.get("id") or "")
            if member_id and member_id in existing_ids:
                skipped += 1
                continue
            rab_id = str(raw.get("rab_id") or "").strip()
            key = rab_id.lower()
            if key and key in taken_rab:
                n = 2
                while f"{rab_id} ({n})".lower() in taken_rab:
                    n += 1
                rab_id = f"{rab_id} ({n})"
                raw["rab_id"] = rab_id
                key = rab_id.lower()
            upsert_member(db, raw)
            if member_id:
                existing_ids.add(member_id)
            if key:
                taken_rab.add(key)
            inserted += 1
        db.flush()
        if db.query(Member).count() < before_members:
            raise SystemExit("member count dropped; rolling back")

        added = add_ranks(catalog.payload)
        flag_modified(catalog, "payload")
        db.flush()
        payload = catalog.payload
        if list(payload.get("wings") or []) != before_wings:
            raise SystemExit("wings changed; rolling back")
        if list(payload.get("member_banks") or []) != before_banks:
            raise SystemExit("banks changed; rolling back")
        if list(payload.get("ranks") or []) != before_srb_ranks:
            raise SystemExit("SRB rank list changed; rolling back")
        if db.query(Rate).count() != before_rates:
            raise SystemExit("rates changed; rolling back")
        if db.query(Staff).count() != before_staff:
            raise SystemExit("staff changed; rolling back")
        if db.query(AuthorizedStrength).count() != before_auth:
            raise SystemExit("authorized strength changed; rolling back")
        db.commit()
        bust_members()
        print("members before", before_members)
        print("members added", inserted)
        print("members already there", skipped)
        print("members now", db.query(Member).count())
        print("ranks added", ", ".join(added) if added else "(already present)")
        print("unchanged rates", before_rates, "staff", before_staff, "authorized", before_auth, "wings", len(before_wings), "banks", len(before_banks))
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
