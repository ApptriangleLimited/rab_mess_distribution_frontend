"""Wipe members and insert a complete 16-person roster. Run: python replace_members.py"""

from __future__ import annotations

from datetime import date, timedelta

from cache import bust_members
from database import SessionLocal
from models import Assignment, MealAssign, Member, SuppressedCarry, TagRequest
from persist import upsert_member

TODAY = date.today()


def months_ago(n: int, day: int) -> str:
    year = TODAY.year
    month = TODAY.month - n
    while month <= 0:
        month += 12
        year -= 1
    last = (date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1) - timedelta(days=1)).day
    return date(year, month, min(day, last)).isoformat()


ROWS = [
    {
        "id": "u_seed_01",
        "name": "Karim Hossain",
        "member_type": "permanent",
        "wing": "Ops Wg",
        "rank": "Constable",
        "force": "Army",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Father",
    },
    {
        "id": "u_seed_02",
        "name": "Nusrat Jahan",
        "member_type": "new",
        "wing": "Int Wg",
        "rank": "ASI",
        "force": "Police",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "FR",
        "contact": "Spouse",
    },
    {
        "id": "u_seed_03",
        "name": "Rafiq Ahmed",
        "member_type": "attached",
        "wing": "L & M Wg",
        "rank": "Attached",
        "force": "BGB",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Brother",
    },
    {
        "id": "u_seed_04",
        "name": "Farhana Akter",
        "member_type": "civilian",
        "wing": "Air Wg",
        "rank": "Civill",
        "force": "Civilian",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Mother",
    },
    {
        "id": "u_seed_05",
        "name": "Jamal Uddin",
        "member_type": "guest",
        "wing": "Comm & MIS Wg",
        "rank": "DAD",
        "force": "Army",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Host",
    },
    {
        "id": "u_seed_06",
        "name": "Tania Rahman",
        "member_type": "permanent",
        "wing": "Inv Wg",
        "rank": "DAD",
        "force": "Police",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "FR",
        "contact": "Spouse",
    },
    {
        "id": "u_seed_07",
        "name": "Hasan Mahmud",
        "member_type": "new",
        "wing": "Trg Wg",
        "rank": "Naik",
        "force": "Ansar",
        "approval_status": "pending",
        "status": "1",
        "default_tag": "TRG",
        "contact": "Father",
    },
    {
        "id": "u_seed_08",
        "name": "Shila Begum",
        "member_type": "attached",
        "wing": "RFTS",
        "rank": "RT",
        "force": "Navy",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Sister",
    },
    {
        "id": "u_seed_09",
        "name": "Mehedi Hasan",
        "member_type": "civilian",
        "wing": "Training School",
        "rank": "Civill",
        "force": "Civilian",
        "approval_status": "pending",
        "status": "1",
        "default_tag": "MS",
        "contact": "Uncle",
    },
    {
        "id": "u_seed_10",
        "name": "Rina Chowdhury",
        "member_type": "permanent",
        "wing": "R & D Cell",
        "rank": "AASI",
        "force": "Air Force",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "CD",
        "contact": "Spouse",
    },
    {
        "id": "u_seed_11",
        "name": "Omar Faruk",
        "member_type": "permanent",
        "wing": "Admin",
        "rank": "DAD",
        "force": "Army",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Father",
    },
    {
        "id": "u_seed_12",
        "name": "Lamia Sultana",
        "member_type": "permanent",
        "wing": "Admin (New)",
        "rank": "Cook",
        "force": "Army",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Mother",
    },
    {
        "id": "u_seed_13",
        "name": "Sajjad Mia",
        "member_type": "permanent",
        "wing": "Admin (Old)",
        "rank": "ASI",
        "force": "Police",
        "approval_status": "ended",
        "status": "0",
        "default_tag": "MS",
        "contact": "Brother",
        "out_date": months_ago(1, 15),
    },
    {
        "id": "u_seed_14",
        "name": "Ayesha Islam",
        "member_type": "new",
        "wing": "Fin Br",
        "rank": "ANCE",
        "force": "Ansar",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "WR",
        "contact": "Spouse",
    },
    {
        "id": "u_seed_15",
        "name": "Babul Karim",
        "member_type": "civilian",
        "wing": "Forces Mess",
        "rank": "Civill",
        "force": "Civilian",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "MS",
        "contact": "Father",
    },
    {
        "id": "u_seed_16",
        "name": "Nazmul Alam",
        "member_type": "attached",
        "wing": "HQ Br",
        "rank": "Attached",
        "force": "BGB",
        "approval_status": "approved",
        "status": "1",
        "default_tag": "CL",
        "contact": "Cousin",
    },
]

BANKS = ("Trust bank", "Community bank", "Sonali Bank")
BRANCHES = ("Mirpur", "Uttara", "Motijheel")
RELIGIONS = ("Islam", "Hinduism", "Buddhism", "Christianity", "Other")
BLOOD = ("A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-")
DISTRICTS = (
    "Dhaka",
    "Chattogram",
    "Rajshahi",
    "Khulna",
    "Sylhet",
    "Barishal",
    "Rangpur",
    "Mymensingh",
    "Gazipur",
    "Narayanganj",
    "Cumilla",
    "Bogura",
    "Cox's Bazar",
    "Dinajpur",
    "Jessore",
    "Tangail",
)


def payload(row: dict, i: int) -> dict:
    n = i + 1
    civilian = row["member_type"] == "civilian"
    guest = row["member_type"] == "guest"
    card = f"CARD-{n:04d}" if civilian else ""
    if civilian:
        rab_id = f"CIV-{card.replace('CARD-', '')}"
        personal_id = f"{1984 + (n % 12)}{str(1000000 + n * 137)[:8]}"
        rfid = f"CIV-RF-{n:04d}"
        docs = [
            {"name": "nid-copy.pdf", "size": 180000 + n * 4200},
            {"name": "birth-certificate.pdf", "size": 96000 + n * 1100},
        ]
    elif guest:
        rab_id = f"GST-{5000 + n}"
        personal_id = f"GST-PN-{n:04d}"
        rfid = f"RFID-{3100 + n}"
        docs = [{"name": "guest-note.pdf", "size": 42000 + n * 800}]
    else:
        rab_id = f"RAB-{3100 + n}"
        personal_id = f"PN-{11000 + n}"
        rfid = f"RFID-{3100 + n}"
        docs = [
            {"name": "posting-order.pdf" if n % 2 == 0 else "joining-order.pdf", "size": 180000 + n * 4200},
            {"name": "id-photo.jpg", "size": 96000 + n * 1100},
        ]
    last = row["name"].split()[-1]
    return {
        "id": row["id"],
        "name": row["name"],
        "personal_id": personal_id,
        "rab_id": rab_id,
        "rfid": rfid,
        "rank": "Civill" if civilian else row["rank"],
        "wing": row["wing"],
        "force": row["force"],
        "religion": RELIGIONS[i % len(RELIGIONS)],
        "member_type": row["member_type"],
        "dropdown_no": card,
        "phone": f"01711{str(200000 + n)[-6:]}",
        "blood_group": BLOOD[i % len(BLOOD)],
        "status": row["status"],
        "approval_status": row["approval_status"],
        "bank_name": BANKS[i % len(BANKS)],
        "account_name": row["name"],
        "account_number": f"{'11' if row['approval_status'] == 'pending' else '22'}02{3100 + n:06d}",
        "routing": f"20027{n:04d}",
        "branch": BRANCHES[i % len(BRANCHES)],
        "branch_location": DISTRICTS[i % len(DISTRICTS)],
        "documents": docs,
        "documents_verified": civilian and row["approval_status"] == "approved",
        "joining_date": months_ago((n % 4) + 1, 2 + (n % 20)),
        "out_date": row.get("out_date") or "",
        "default_tag": row["default_tag"],
        "emergency_contacts": [
            {
                "name": f"{last} {row['contact']}",
                "relation": row["contact"],
                "phone": f"01811{str(300000 + n)[-6:]}",
            }
        ],
        "inactive_spans": (
            [{"from": row.get("out_date") or months_ago(1, 15), "to": None}]
            if row["status"] == "0"
            else []
        ),
    }


def main() -> None:
    db = SessionLocal()
    try:
        db.query(Assignment).delete()
        db.query(TagRequest).delete()
        db.query(SuppressedCarry).delete()
        db.query(MealAssign).delete()
        db.query(Member).delete()
        db.flush()
        for i, row in enumerate(ROWS):
            upsert_member(db, payload(row, i))
        db.commit()
        bust_members()
        print(f"replaced_members={db.query(Member).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
