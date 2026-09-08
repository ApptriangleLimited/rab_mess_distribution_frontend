from datetime import date as DateOnly
from datetime import datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MealShift(Base):
    __tablename__ = "meal_shifts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    date: Mapped[DateOnly] = mapped_column(Date, unique=True, nullable=False, index=True)
    meals: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MealAssign(Base):
    __tablename__ = "meal_assigns"
    __table_args__ = (
        UniqueConstraint(
            "member_id",
            "shift_id",
            "date",
            "check_in_time",
            name="uq_meal_assigns_punch",
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), nullable=False, index=True)
    shift_id: Mapped[str] = mapped_column(ForeignKey("meal_shifts.id"), nullable=False, index=True)
    status: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[DateOnly] = mapped_column(Date, nullable=False, index=True)
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class GuestMeal(Base):
    __tablename__ = "guest_meals"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    shift_id: Mapped[str] = mapped_column(ForeignKey("meal_shifts.id"), nullable=False, index=True)
    date: Mapped[DateOnly] = mapped_column(Date, nullable=False, index=True)
    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    guest_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    guest_info: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ref_info: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
