from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Member(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    personal_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    rab_id: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    rfid: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    rank: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    wing: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    force: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    religion: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    member_type: Mapped[str] = mapped_column(String(32), nullable=False, default="permanent")
    dropdown_no: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    blood_group: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    documents_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(1), nullable=False, default="1")
    approval_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    default_tag: Mapped[str] = mapped_column(String(8), nullable=False, default="MS")
    jl_end_date: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    bank_name: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    account_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    account_number: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    routing: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    branch: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    branch_location: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    out_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    documents: Mapped[list["MemberDocument"]] = relationship(
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    emergency_contacts: Mapped[list["MemberEmergency"]] = relationship(
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    inactive_spans: Mapped[list["MemberInactiveSpan"]] = relationship(
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class MemberDocument(Base):
    __tablename__ = "member_documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)


class MemberEmergency(Base):
    __tablename__ = "member_emergency"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    relation: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(16), nullable=False, default="")


class MemberInactiveSpan(Base):
    __tablename__ = "member_inactive_spans"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date | None] = mapped_column(Date, nullable=True)
