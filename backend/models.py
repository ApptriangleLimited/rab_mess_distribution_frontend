from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (
        Index(
            "uq_members_rab_id_lower",
            text("lower(rab_id)"),
            unique=True,
            postgresql_where=text("rab_id <> ''"),
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    personal_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    rab_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    rfid: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    rank: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    wing: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    force: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    religion: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    member_type: Mapped[str] = mapped_column(String(32), nullable=False, default="permanent")
    dropdown_no: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    blood_group: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    documents: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    documents_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(8), nullable=False, default="1")
    approval_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    bank_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    account_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    account_number: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    routing: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    branch: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    branch_location: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    out_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    default_tag: Mapped[str] = mapped_column(String(32), nullable=False, default="MS")
    jl_end_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    inactive_spans: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    emergency_contacts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_by: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    tag_requests = relationship("TagRequest", back_populates="member")


class TagRequest(Base):
    __tablename__ = "tag_requests"
    __table_args__ = (
        Index(
            "uq_tag_requests_pending",
            "user_id",
            "queue",
            unique=True,
            postgresql_where=text("status = 'requested'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("members.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    from_tag: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    to_tag: Mapped[str] = mapped_column(String(32), nullable=False)
    trg_tone: Mapped[str | None] = mapped_column(String(16), nullable=True)
    trg_sarda: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    queue: Mapped[str] = mapped_column(String(16), nullable=False, default="daily")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="requested")
    requested_by: Mapped[str] = mapped_column(String(40), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_by: Mapped[str | None] = mapped_column(String(40), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    member = relationship("Member", back_populates="tag_requests")


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        Index("uq_assignments_member_date", "user_id", "date", unique=True),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("members.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    tag: Mapped[str] = mapped_column(String(32), nullable=False)
    trg_tone: Mapped[str | None] = mapped_column(String(16), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(40), nullable=False, default="daily")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SuppressedCarry(Base):
    __tablename__ = "suppressed_carries"

    user_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("members.id"), primary_key=True
    )
    date: Mapped[date] = mapped_column(Date, primary_key=True)


class DayLock(Base):
    __tablename__ = "day_locks"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    locked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_by: Mapped[str] = mapped_column(String(40), nullable=False, default="daily")


class BoroKhanaDay(Base):
    __tablename__ = "boro_khana_days"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
