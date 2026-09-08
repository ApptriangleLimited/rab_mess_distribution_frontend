from datetime import date as DateOnly
from datetime import datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("member_id", "date", name="uq_assignments_member_date"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), nullable=False, index=True)
    date: Mapped[DateOnly] = mapped_column(Date, nullable=False, index=True)
    tag: Mapped[str] = mapped_column(String(8), nullable=False)
    trg_tone: Mapped[str | None] = mapped_column(String(8), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SuppressedCarry(Base):
    __tablename__ = "suppressed_carries"

    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), primary_key=True)
    date: Mapped[DateOnly] = mapped_column(Date, primary_key=True)


class ApprovedDay(Base):
    __tablename__ = "approved_days"

    date: Mapped[DateOnly] = mapped_column(Date, primary_key=True)


class BoroKhanaDate(Base):
    __tablename__ = "boro_khana_dates"

    date: Mapped[DateOnly] = mapped_column(Date, primary_key=True)
