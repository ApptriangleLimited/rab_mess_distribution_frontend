from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Role = Literal["cc", "daily", "mess", "consume", "ration", "admin"]
ApprovalStatus = Literal["pending", "approved", "rejected", "ended"]
MemberType = Literal["new", "attached", "permanent", "guest", "civilian"]
TagQueue = Literal["daily", "ration", "consume"]
TagRequestStatus = Literal["requested", "updated", "rejected"]

DUTY_TAGS = {
    "FR",
    "CL",
    "PL",
    "WR",
    "CD",
    "WIT",
    "MED",
    "TRG",
    "MS",
    "MOL",
    "CMH",
    "RBH",
    "BGH",
    "AWL",
    "OSL",
    "RL",
    "JL",
    "PE",
    "LNK",
    "MFR",
}


def normalize_tag(value: str) -> str:
    tag = (value or "").strip().upper()
    if not tag:
        raise ValueError("Tag is required")
    if tag in DUTY_TAGS:
        return tag
    if len(tag) > 16 or not tag.replace("_", "").isalnum():
        raise ValueError("Invalid tag")
    return tag


class DocumentIn(BaseModel):
    name: str = ""
    size: int = 0
    url: str | None = None


class EmergencyContactIn(BaseModel):
    name: str = ""
    relation: str = ""
    phone: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class StaffPublic(BaseModel):
    id: str
    email: str
    display_name: str
    role: str


class LoginData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    staff: StaffPublic


class MemberIn(BaseModel):
    name: str
    rab_id: str = ""
    personal_id: str = ""
    rfid: str = ""
    rank: str = ""
    wing: str = ""
    force: str = ""
    religion: str = ""
    member_type: MemberType = "permanent"
    dropdown_no: str = ""
    phone: str = ""
    blood_group: str = ""
    bank_name: str = ""
    account_name: str = ""
    account_number: str = ""
    routing: str = ""
    branch: str = ""
    branch_location: str = ""
    joining_date: date | None = None
    out_date: date | None = None
    default_tag: str = "MS"
    documents: list[DocumentIn] = Field(default_factory=list)
    documents_verified: bool = False
    emergency_contacts: list[EmergencyContactIn] = Field(default_factory=list)
    status: Literal["0", "1"] | None = None
    approval_status: ApprovalStatus | Literal["accepted"] | None = None


class TagIn(BaseModel):
    tag: str


class StatusIn(BaseModel):
    status: Literal["0", "1"]


class AcceptMemberIn(BaseModel):
    tag: str | None = None


class TagRequestIn(BaseModel):
    user_id: str
    to_tag: str
    from_date: date | None = None
    to_date: date | None = None
    queue: TagQueue = "daily"
    trg_tone: Literal["black", "red"] | None = None
    trg_sarda: bool | None = None


class TagRequestPatchIn(BaseModel):
    to_tag: str


class MemberOut(BaseModel):
    id: str
    name: str
    personal_id: str
    rab_id: str
    rfid: str
    rank: str
    wing: str
    force: str
    religion: str
    member_type: str
    dropdown_no: str
    phone: str
    blood_group: str
    documents: list[dict[str, Any]]
    documents_verified: bool
    status: str
    approval_status: str
    bank_name: str
    account_name: str
    account_number: str
    routing: str
    branch: str
    branch_location: str
    joining_date: str | None
    out_date: str | None
    default_tag: str
    emergency_contacts: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class MemberListOut(BaseModel):
    items: list[MemberOut]
    total: int
    page: int
    page_size: int


class TagRequestOut(BaseModel):
    id: str
    user_id: str
    date: str
    from_date: str
    to_date: str
    from_tag: str
    to_tag: str
    trg_tone: str | None = None
    trg_sarda: bool | None = None
    queue: str
    status: str
    requested_by: str
    requested_at: datetime
    updated_by: str | None = None
    updated_at: datetime | None = None
    member: MemberOut | None = None


class TagRequestListOut(BaseModel):
    items: list[TagRequestOut]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


class TagRequestCountsOut(BaseModel):
    daily: int
    ration: int
    consume: int
