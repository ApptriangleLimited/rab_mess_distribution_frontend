from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.dates import parse_date
from app.domain.ids import new_id
from app.domain.members import (
    MEMBER_TYPES,
    REQUIRED_FIELD_MAP,
    derive_civilian_rab_id,
    missing_required,
    normalize_approval,
    normalize_status,
    normalize_tag,
)
from app.domain.phones import digits_only, normalize_bd_phone
from app.domain.spans import apply_status_to_spans
from app.errors import AppError, FieldError
from app.models.member import Member, MemberDocument, MemberEmergency, MemberInactiveSpan
from app.models.settings import OrgMemberBank, OrgRank
from app.models.staff import Staff
from app.services.audit import record_audit

PAGE_SIZES = {10, 25, 50, 100}


def _clamp_bank(db: Session, name: str) -> str:
    trimmed = name.strip()
    if not trimmed:
        return ""
    banks = db.query(OrgMemberBank).all()
    hit = next((b.label for b in banks if b.label.lower() == trimmed.lower()), None)
    return hit or ""


def _assert_unique(db: Session, *, rab_id: str, personal_id: str, exclude_id: str | None = None) -> None:
    q = db.query(Member).filter(func.lower(Member.rab_id) == rab_id.lower())
    if exclude_id:
        q = q.filter(Member.id != exclude_id)
    if q.one_or_none():
        raise AppError(
            409,
            "CONFLICT",
            "RAB ID already exists",
            [FieldError("rab_id", "taken", "RAB ID already exists")],
        )
    if personal_id:
        q2 = db.query(Member).filter(Member.personal_id == personal_id)
        if exclude_id:
            q2 = q2.filter(Member.id != exclude_id)
        if q2.one_or_none():
            raise AppError(
                409,
                "CONFLICT",
                "Personal ID already exists",
                [FieldError("personal_id", "taken", "Personal ID already exists")],
            )


def _docs(raw: list | None) -> list[dict]:
    out = []
    for item in raw or []:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            out.append(
                {
                    "name": name,
                    "size": int(item.get("size") or 0),
                    "url": item.get("url"),
                }
            )
    return out


def _contacts(raw: list | None) -> list[dict]:
    out = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        row = {
            "name": str(item.get("name") or "").strip(),
            "relation": str(item.get("relation") or "").strip(),
            "phone": normalize_bd_phone(str(item.get("phone") or "")),
        }
        if row["name"] or row["relation"] or row["phone"]:
            out.append(row)
    return out


def normalize_entry(db: Session, body: dict, *, public: bool, existing: Member | None = None) -> dict:
    member_type = str(body.get("member_type") or (existing.member_type if existing else "permanent")).strip()
    if member_type not in MEMBER_TYPES:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Invalid member_type",
            [FieldError("member_type", "invalid", "Unknown member type")],
        )
    name = str(body.get("name") or "").strip()
    personal_id = str(body.get("personal_id") or "").strip()
    rab_id = str(body.get("rab_id") or "").strip()
    rank = str(body.get("rank") or "").strip()
    wing = str(body.get("wing") or "").strip()
    dropdown_no = str(body.get("dropdown_no") or "").strip()
    documents = _docs(body.get("documents"))
    contacts = _contacts(body.get("emergency_contacts"))

    if member_type == "guest":
        personal_id = ""
        rank = ""
        wing = ""
        force = ""
        religion = ""
        joining = None
        out_date = None
        bank_name = ""
        account_name = ""
        account_number = ""
        routing = ""
        branch = ""
        branch_location = ""
        documents = []
        contacts = []
        documents_verified = False
        if not rab_id:
            rab_id = f"GST-{new_id('')[:8].upper()}"
    else:
        force = str(body.get("force") or "").strip()
        religion = str(body.get("religion") or "").strip()
        joining = parse_date(body.get("joining_date"))
        out_date = parse_date(body.get("out_date"))
        if body.get("joining_date") not in (None, "") and joining is None:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid joining_date",
                [FieldError("joining_date", "invalid", "Use YYYY-MM-DD")],
            )
        if body.get("out_date") not in (None, "") and out_date is None:
            raise AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid out_date",
                [FieldError("out_date", "invalid", "Use YYYY-MM-DD")],
            )
        bank_name = _clamp_bank(db, str(body.get("bank_name") or ""))
        account_name = str(body.get("account_name") or "").strip()
        account_number = digits_only(str(body.get("account_number") or ""))
        routing = digits_only(str(body.get("routing") or ""))
        branch = str(body.get("branch") or "").strip()
        branch_location = str(body.get("branch_location") or "").strip()
        documents_verified = bool(body.get("documents_verified")) if member_type == "civilian" else False
        if member_type == "civilian":
            rab_id = rab_id or derive_civilian_rab_id(dropdown_no, personal_id)

    missing = missing_required(
        member_type=member_type,
        name=name,
        personal_id=personal_id,
        rank=rank,
        wing=wing,
        dropdown_no=dropdown_no,
        documents=documents,
    )
    if missing:
        field = REQUIRED_FIELD_MAP.get(missing, missing)
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Missing required field",
            [FieldError(field, "required", f"{missing} is required")],
        )

    default_tag = normalize_tag(body.get("default_tag"))
    if existing and existing.default_tag.upper() == "MFR":
        default_tag = "FR" if default_tag == "FR" else "MFR"

    if public:
        status = "0"
        approval = "pending"
    else:
        status = normalize_status(body.get("status"), default=existing.status if existing else "1")
        approval = normalize_approval(
            body.get("approval_status") or (existing.approval_status if existing else "pending")
        )

    return {
        "name": name,
        "personal_id": personal_id,
        "rab_id": rab_id,
        "rfid": str(body.get("rfid") or "").strip(),
        "rank": rank,
        "wing": wing,
        "force": force,
        "religion": religion,
        "member_type": member_type,
        "dropdown_no": dropdown_no,
        "phone": normalize_bd_phone(str(body.get("phone") or "")),
        "blood_group": str(body.get("blood_group") or "").strip(),
        "documents": documents,
        "documents_verified": documents_verified,
        "status": status,
        "approval_status": approval,
        "default_tag": default_tag,
        "bank_name": bank_name,
        "account_name": account_name,
        "account_number": account_number,
        "routing": routing,
        "branch": branch,
        "branch_location": branch_location,
        "joining_date": joining,
        "out_date": out_date,
        "emergency_contacts": contacts,
    }


def _replace_children(db: Session, member: Member, data: dict) -> None:
    member.documents.clear()
    member.emergency_contacts.clear()
    db.flush()
    for doc in data["documents"]:
        member.documents.append(
            MemberDocument(id=new_id("d_"), name=doc["name"], size=doc["size"], url=doc.get("url"))
        )
    for contact in data["emergency_contacts"]:
        member.emergency_contacts.append(
            MemberEmergency(
                id=new_id("e_"),
                name=contact["name"],
                relation=contact["relation"],
                phone=contact["phone"],
            )
        )


def _set_spans(member: Member, spans: list[tuple]) -> None:
    member.inactive_spans.clear()
    for start, end in spans:
        member.inactive_spans.append(
            MemberInactiveSpan(id=new_id("sp_"), from_date=start, to_date=end)
        )


def create_member(
    db: Session,
    body: dict,
    *,
    public: bool,
    staff: Staff | None,
    request,
) -> Member:
    data = normalize_entry(db, body, public=public)
    _assert_unique(db, rab_id=data["rab_id"], personal_id=data["personal_id"])
    member = Member(
        id=new_id("u_"),
        name=data["name"],
        personal_id=data["personal_id"],
        rab_id=data["rab_id"],
        rfid=data["rfid"],
        rank=data["rank"],
        wing=data["wing"],
        force=data["force"],
        religion=data["religion"],
        member_type=data["member_type"],
        dropdown_no=data["dropdown_no"],
        phone=data["phone"],
        blood_group=data["blood_group"],
        documents_verified=data["documents_verified"],
        status=data["status"],
        approval_status=data["approval_status"],
        default_tag=data["default_tag"],
        jl_end_date="",
        bank_name=data["bank_name"],
        account_name=data["account_name"],
        account_number=data["account_number"],
        routing=data["routing"],
        branch=data["branch"],
        branch_location=data["branch_location"],
        joining_date=data["joining_date"],
        out_date=data["out_date"],
    )
    if data["status"] == "0":
        from_date = data["joining_date"] or parse_date("1970-01-01")
        member.inactive_spans.append(
            MemberInactiveSpan(id=new_id("sp_"), from_date=from_date, to_date=None)
        )
    db.add(member)
    _replace_children(db, member, data)
    record_audit(
        db,
        staff=staff,
        action="member.create",
        entity_type="member",
        entity_id=member.id,
        after={"rab_id": member.rab_id, "status": member.status},
        request=request,
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(
            409,
            "CONFLICT",
            "RAB ID already exists",
            [FieldError("rab_id", "taken", "RAB ID already exists")],
        ) from exc
    db.refresh(member)
    return member


def update_member(db: Session, member: Member, body: dict, *, staff: Staff, request) -> Member:
    data = normalize_entry(db, body, public=False, existing=member)
    _assert_unique(db, rab_id=data["rab_id"], personal_id=data["personal_id"], exclude_id=member.id)
    status_changed = data["status"] != member.status
    before = {"status": member.status, "rab_id": member.rab_id}
    member.name = data["name"]
    member.personal_id = data["personal_id"]
    member.rab_id = data["rab_id"]
    member.rfid = data["rfid"]
    member.rank = data["rank"]
    member.wing = data["wing"]
    member.force = data["force"]
    member.religion = data["religion"]
    member.member_type = data["member_type"]
    member.dropdown_no = data["dropdown_no"]
    member.phone = data["phone"]
    member.blood_group = data["blood_group"]
    member.documents_verified = data["documents_verified"]
    member.status = data["status"]
    member.approval_status = data["approval_status"]
    member.default_tag = data["default_tag"]
    member.bank_name = data["bank_name"]
    member.account_name = data["account_name"]
    member.account_number = data["account_number"]
    member.routing = data["routing"]
    member.branch = data["branch"]
    member.branch_location = data["branch_location"]
    member.joining_date = data["joining_date"]
    member.out_date = data["out_date"]
    if data["status"] == "1":
        member.jl_end_date = ""
    if status_changed:
        current = [(s.from_date, s.to_date) for s in member.inactive_spans]
        _set_spans(member, apply_status_to_spans(current, data["status"], member.joining_date))
        from app.services.assignments import purge_unassignable

        purge_unassignable(db, member)
    _replace_children(db, member, data)
    record_audit(
        db,
        staff=staff,
        action="member.update",
        entity_type="member",
        entity_id=member.id,
        before=before,
        after={"status": member.status, "rab_id": member.rab_id},
        request=request,
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError(
            409,
            "CONFLICT",
            "RAB ID already exists",
            [FieldError("rab_id", "taken", "RAB ID already exists")],
        ) from exc
    db.refresh(member)
    return member


def get_member(db: Session, member_id: str) -> Member:
    member = db.get(Member, member_id)
    if member is None:
        raise AppError(404, "NOT_FOUND", "Member not found")
    return member


def list_members(
    db: Session,
    *,
    q: str | None,
    status: str | None,
    approval: str | None,
    wing: str | None,
    rank: str | None,
    date_from: str | None,
    date_to: str | None,
    page: int,
    page_size: int,
) -> tuple[list[Member], int, int, int]:
    if page < 1:
        page = 1
    if page_size not in PAGE_SIZES:
        page_size = 25
    query = db.query(Member)
    if q and q.strip() and q.strip().lower() != "all":
        like = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Member.name).like(like),
                func.lower(Member.personal_id).like(like),
                func.lower(Member.rab_id).like(like),
                func.lower(Member.rfid).like(like),
                func.lower(Member.phone).like(like),
                func.lower(Member.dropdown_no).like(like),
            )
        )
    if status in {"0", "1"}:
        query = query.filter(Member.status == status)
    if approval and approval.lower() != "all":
        query = query.filter(Member.approval_status == normalize_approval(approval))
    if wing and wing.lower() != "all":
        query = query.filter(Member.wing == wing)
    if rank and rank.lower() != "all":
        query = query.filter(Member.rank == rank)

    start = parse_date(date_from)
    end = parse_date(date_to)
    if date_from and start is None:
        raise AppError(400, "VALIDATION_ERROR", "Invalid date_from")
    if date_to and end is None:
        raise AppError(400, "VALIDATION_ERROR", "Invalid date_to")
    if start and not end:
        end = start
    if end and not start:
        start = end
    if start and end:
        query = query.filter(
            or_(
                (Member.joining_date >= start) & (Member.joining_date <= end),
                (Member.out_date >= start) & (Member.out_date <= end),
            )
        )

    rows = query.all()
    rank_order = {r.label: r.sort_order for r in db.query(OrgRank).all()}

    def rab_key(rab_id: str) -> tuple:
        digits = "".join(c for c in rab_id if c.isdigit())
        return (int(digits) if digits else 10**18, rab_id.lower())

    rows.sort(
        key=lambda m: (
            rab_key(m.rab_id),
            rank_order.get(m.rank, 10_000),
            m.name.lower(),
        )
    )
    total = len(rows)
    offset = (page - 1) * page_size
    return rows[offset : offset + page_size], total, page, page_size
