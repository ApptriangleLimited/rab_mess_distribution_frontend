from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class AuditUserMixin:
    au_entry_by: Mapped[str] = mapped_column(String(128), nullable=False, default="", server_default="")
    au_update_by: Mapped[str] = mapped_column(String(128), nullable=False, default="", server_default="")


class Staff(AuditUserMixin, Base):
    __tablename__ = "staff"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    password_vault: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mfa_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    mfa_recovery: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    avatar: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Member(AuditUserMixin, Base):
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
    force_rank: Mapped[str] = mapped_column(String(128), nullable=False, default="")
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
    # First Daily RR day (accept). Days before this stay empty.
    duty_start: Mapped[date | None] = mapped_column(Date, nullable=True)
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


class TagRequest(AuditUserMixin, Base):
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


class Assignment(AuditUserMixin, Base):
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


class SuppressedCarry(AuditUserMixin, Base):
    __tablename__ = "suppressed_carries"

    user_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("members.id"), primary_key=True
    )
    date: Mapped[date] = mapped_column(Date, primary_key=True)


class DayLock(AuditUserMixin, Base):
    __tablename__ = "day_locks"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    locked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_by: Mapped[str] = mapped_column(String(40), nullable=False, default="daily")


class BoroKhanaDay(AuditUserMixin, Base):
    __tablename__ = "boro_khana_days"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Rate(AuditUserMixin, Base):
    __tablename__ = "rates"

    tag: Mapped[str] = mapped_column(String(32), primary_key=True)
    amount_per_day: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Sender(AuditUserMixin, Base):
    __tablename__ = "senders"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    bank_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    account_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    account_number: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    routing: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    branch: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    branch_location: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    mapped_tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CatalogState(AuditUserMixin, Base):
    """Org catalogs (ranks, wings, forces, banks) as one durable row."""

    __tablename__ = "catalog_state"

    id: Mapped[str] = mapped_column(String(16), primary_key=True, default="default")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class AuthorizedStrength(AuditUserMixin, Base):
    __tablename__ = "authorized_strength"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    held_wings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ManpowerAbsent(AuditUserMixin, Base):
    __tablename__ = "manpower_officer_absent"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    wing: Mapped[str] = mapped_column(String(128), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class StateReport(AuditUserMixin, Base):
    __tablename__ = "state_reports"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_by: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    boro_khana: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    members: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    totals: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class MealShift(AuditUserMixin, Base):
    __tablename__ = "meal_shifts"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    start_time: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    end_time: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MealPlan(AuditUserMixin, Base):
    __tablename__ = "meal_plans"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    meals: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MealAssign(AuditUserMixin, Base):
    __tablename__ = "meal_assigns"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    member_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    shift_id: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    status: Mapped[int] = mapped_column(nullable=False, default=1)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_in_time: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class GuestMeal(AuditUserMixin, Base):
    __tablename__ = "guest_meals"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    shift_id: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_in_time: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    guest_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    guest_info: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ref_info: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AuditLog(AuditUserMixin, Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(String(40), nullable=False, default="", index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    ip: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    user_agent: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class PritibhojEvent(AuditUserMixin, Base):
    __tablename__ = "pritibhoj_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    occasion: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    org: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    main_rows: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    admin_rows: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RefreshSession(AuditUserMixin, Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    staff_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    family_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    replaced_by: Mapped[str | None] = mapped_column(String(40), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    user_agent: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    ip: Mapped[str] = mapped_column(String(64), nullable=False, default="")


class PasswordReset(AuditUserMixin, Base):
    __tablename__ = "password_resets"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    staff_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Permission(AuditUserMixin, Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(64), primary_key=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")


class RolePermission(AuditUserMixin, Base):
    __tablename__ = "role_permissions"

    role: Mapped[str] = mapped_column(String(32), primary_key=True)
    permission_code: Mapped[str] = mapped_column(
        String(64), ForeignKey("permissions.code", ondelete="CASCADE"), primary_key=True
    )


class FileObject(AuditUserMixin, Base):
    __tablename__ = "file_objects"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    uploaded_by: Mapped[str] = mapped_column(String(40), nullable=False, default="", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Notification(AuditUserMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    recipient_user_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False, default="info")
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
