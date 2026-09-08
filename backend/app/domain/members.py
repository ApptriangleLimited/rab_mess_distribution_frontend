import re

from app.domain.dates import date_str, iso_z
from app.domain.tags import TAG_RE
from app.errors import AppError, FieldError
from app.models.member import Member

MEMBER_TYPES = frozenset({"new", "attached", "permanent", "guest", "civilian"})
APPROVALS = frozenset({"pending", "approved", "rejected", "ended"})
BLOOD = frozenset({"A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", ""})
RELIGIONS = frozenset({"Islam", "Hinduism", "Buddhism", "Christianity", "Other", ""})
REQUIRED_FIELD_MAP = {
    "name": "name",
    "personal_no": "personal_id",
    "card_number": "dropdown_no",
    "nid": "personal_id",
    "rank": "rank",
    "wing": "wing",
    "documents": "documents",
}


def normalize_approval(value: str | None) -> str:
    raw = (value or "pending").strip().lower()
    if raw == "accepted":
        return "approved"
    if raw in APPROVALS:
        return raw
    raise AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid approval_status",
        [FieldError("approval_status", "invalid", "Unknown approval status")],
    )


def normalize_status(value: str | None, *, default: str) -> str:
    raw = default if value is None else str(value).strip()
    if raw in {"0", "1"}:
        return raw
    raise AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid status",
        [FieldError("status", "invalid", "Must be 0 or 1")],
    )


def normalize_tag(value: str | None, *, default: str = "MS") -> str:
    tag = (value or default).strip().upper() or default
    if not re.match(TAG_RE, tag):
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid tag",
            [FieldError("default_tag", "invalid", "Tag must be 2–8 letters or digits")],
        )
    return tag


def derive_civilian_rab_id(dropdown_no: str, personal_id: str) -> str:
    card = dropdown_no.strip().replace(" ", "").upper()
    if card:
        return f"CIV-{card}"
    nid = personal_id.strip().replace(" ", "")
    if nid:
        return f"CIV-NID-{nid}"
    return ""


def missing_required(
    *,
    member_type: str,
    name: str,
    personal_id: str,
    rank: str,
    wing: str,
    dropdown_no: str,
    documents: list,
) -> str | None:
    if member_type == "guest":
        return "name" if not name.strip() else None
    if member_type == "civilian":
        if not dropdown_no.strip():
            return "card_number"
        if not personal_id.strip():
            return "nid"
    elif not personal_id.strip():
        return "personal_no"
    if not name.strip():
        return "name"
    if not rank.strip():
        return "rank"
    if not wing.strip():
        return "wing"
    if not documents:
        return "documents"
    return None


def member_public(member: Member) -> dict:
    return {
        "id": member.id,
        "name": member.name,
        "personal_id": member.personal_id,
        "rab_id": member.rab_id,
        "rfid": member.rfid,
        "rank": member.rank,
        "wing": member.wing,
        "force": member.force,
        "religion": member.religion,
        "member_type": member.member_type,
        "dropdown_no": member.dropdown_no,
        "phone": member.phone,
        "blood_group": member.blood_group,
        "documents": [
            {"id": d.id, "name": d.name, "size": d.size, "url": d.url} for d in member.documents
        ],
        "documents_verified": member.documents_verified,
        "status": member.status,
        "approval_status": member.approval_status,
        "inactive_spans": [
            {"from": date_str(s.from_date), "to": date_str(s.to_date)}
            for s in member.inactive_spans
        ],
        "jl_end_date": member.jl_end_date,
        "bank_name": member.bank_name,
        "account_name": member.account_name,
        "account_number": member.account_number,
        "routing": member.routing,
        "branch": member.branch,
        "branch_location": member.branch_location,
        "joining_date": date_str(member.joining_date),
        "out_date": date_str(member.out_date),
        "default_tag": member.default_tag,
        "emergency_contacts": [
            {"name": c.name, "relation": c.relation, "phone": c.phone}
            for c in member.emergency_contacts
        ],
        "created_at": iso_z(member.created_at),
        "updated_at": iso_z(member.updated_at),
    }


def register_public(member: Member) -> dict:
    return {
        "id": member.id,
        "name": member.name,
        "rab_id": member.rab_id,
        "approval_status": member.approval_status,
        "status": member.status,
    }
