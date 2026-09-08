from datetime import date as DateOnly
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AllowanceRate(Base):
    __tablename__ = "allowance_rates"

    tag: Mapped[str] = mapped_column(String(8), primary_key=True)
    amount_per_day: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class Sender(Base):
    __tablename__ = "senders"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    account_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    account_number: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    routing: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    branch: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    branch_location: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    mapped_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class OrgRank(Base):
    __tablename__ = "org_ranks"

    label: Mapped[str] = mapped_column(String(64), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    elaborate: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class OrgWing(Base):
    __tablename__ = "org_wings"

    label: Mapped[str] = mapped_column(String(80), primary_key=True)
    parent: Mapped[str | None] = mapped_column(String(80), nullable=True)
    elaborate: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class OrgForce(Base):
    __tablename__ = "org_forces"

    label: Mapped[str] = mapped_column(String(64), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class OrgForceRank(Base):
    __tablename__ = "org_force_ranks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    force: Mapped[str] = mapped_column(String(64), nullable=False)
    rank: Mapped[str] = mapped_column(String(64), nullable=False)
    is_extra: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_removed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    elaborate: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class OrgRankEquivalent(Base):
    __tablename__ = "org_rank_equivalents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rab_rank: Mapped[str] = mapped_column(String(64), nullable=False)
    force: Mapped[str] = mapped_column(String(64), nullable=False)
    service_rank: Mapped[str] = mapped_column(String(64), nullable=False)


class OrgRankForceWing(Base):
    __tablename__ = "org_rank_force_wings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rab_rank: Mapped[str] = mapped_column(String(64), nullable=False)
    force: Mapped[str] = mapped_column(String(64), nullable=False)
    wing: Mapped[str] = mapped_column(String(80), nullable=False)


class OrgMemberBank(Base):
    __tablename__ = "org_member_banks"

    label: Mapped[str] = mapped_column(String(80), primary_key=True)
    builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class AuthorizedStrength(Base):
    __tablename__ = "authorized_strength"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    held_wings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class ClosedMonth(Base):
    __tablename__ = "closed_months"

    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    closed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    closed_by: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    rates_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class ManpowerOfficerAbsent(Base):
    __tablename__ = "manpower_officer_absent"

    date: Mapped[DateOnly] = mapped_column(Date, primary_key=True)
    wing: Mapped[str] = mapped_column(String(80), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PritibhojEvent(Base):
    __tablename__ = "pritibhoj_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    occasion: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    date: Mapped[DateOnly] = mapped_column(Date, nullable=False, index=True)
    org: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    main_rows: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    admin_rows: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    staff_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
