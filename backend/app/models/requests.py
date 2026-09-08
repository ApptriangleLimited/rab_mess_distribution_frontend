from datetime import date as DateOnly
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TagRequest(Base):
    __tablename__ = "tag_requests"
    __table_args__ = (
        Index(
            "uq_tag_requests_open_queue",
            "user_id",
            "queue",
            unique=True,
            sqlite_where=text("status = 'requested'"),
            postgresql_where=text("status = 'requested'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("members.id"), nullable=False, index=True)
    date: Mapped[DateOnly] = mapped_column(Date, nullable=False)
    from_date: Mapped[DateOnly] = mapped_column(Date, nullable=False)
    to_date: Mapped[DateOnly] = mapped_column(Date, nullable=False)
    from_tag: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    to_tag: Mapped[str] = mapped_column(String(8), nullable=False)
    trg_tone: Mapped[str | None] = mapped_column(String(8), nullable=True)
    trg_sarda: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    queue: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="requested")
    requested_by: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class StateReport(Base):
    __tablename__ = "state_reports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    date: Mapped[DateOnly] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    submitted_by: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    boro_khana: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    totals: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    members: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
