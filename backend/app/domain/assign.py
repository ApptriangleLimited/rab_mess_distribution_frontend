from datetime import date

from app.models.member import Member


def is_guest(member: Member) -> bool:
    return member.member_type == "guest"


def is_cockpit(member: Member) -> bool:
    return not is_guest(member) and member.approval_status == "approved"


def is_mfr_locked(member: Member) -> bool:
    return (member.default_tag or "").upper() == "MFR"


def is_user_inactive_on_date(member: Member, day: date) -> bool:
    join = member.joining_date
    if join and day < join:
        return True
    for span in member.inactive_spans or []:
        if day < span.from_date:
            continue
        if span.to_date and day > span.to_date:
            continue
        return True
    jl_end = (member.jl_end_date or "").strip()
    if jl_end:
        try:
            if day > date.fromisoformat(jl_end):
                return True
        except ValueError:
            pass
    if member.status != "1":
        return not (member.inactive_spans or [])
    return False


def can_assign_on_date(member: Member, day: date) -> bool:
    if is_guest(member) or member.approval_status != "approved":
        return False
    join = member.joining_date
    if join and day < join:
        return False
    if is_user_inactive_on_date(member, day):
        return False
    out = member.out_date
    if out and day > out:
        return False
    return True


def can_write_tag(member: Member, day: date, tag: str) -> bool:
    if not can_assign_on_date(member, day):
        return False
    code = (tag or "").upper()
    if is_mfr_locked(member) and code not in {"MFR", "FR"}:
        return False
    return True


def _norm_force(force: str) -> str:
    return " ".join(force.strip().lower().replace("-", " ").replace("_", " ").split())


def is_black_trg_force(force: str) -> bool:
    return _norm_force(force) in {"army", "navy", "air force"}


def needs_trg_training_prompt(force: str) -> bool:
    return _norm_force(force) in {"police", "ansar", "bgb"}


def resolve_trg_tone(force: str, training_checked: bool = False) -> str:
    if is_black_trg_force(force):
        return "black"
    if needs_trg_training_prompt(force) and training_checked:
        return "black"
    return "red"


def carry_tag(member: Member) -> str | None:
    tag = (member.default_tag or "").strip().upper()
    if not tag:
        return None
    if is_mfr_locked(member):
        return "MFR"
    return tag


def actor_name(staff) -> str:
    return f"{staff.role}:{staff.display_name}"
