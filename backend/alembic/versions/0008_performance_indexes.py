"""Indexes for Daily RR, member lists, assignments, and tag requests.

Revision ID: 0008_performance_indexes
Revises: 0007_sender_kind
Create Date: 2026-10-21
"""

from alembic import op

revision = "0008_performance_indexes"
down_revision = "0007_sender_kind"
branch_labels = None
depends_on = None


INDEXES = (
    "CREATE INDEX IF NOT EXISTS ix_members_approval_status ON members (approval_status)",
    "CREATE INDEX IF NOT EXISTS ix_members_status ON members (status)",
    "CREATE INDEX IF NOT EXISTS ix_members_member_type ON members (member_type)",
    "CREATE INDEX IF NOT EXISTS ix_members_rank ON members (rank)",
    "CREATE INDEX IF NOT EXISTS ix_members_wing_lower ON members (lower(wing))",
    "CREATE INDEX IF NOT EXISTS ix_members_approval_status_status ON members (approval_status, status)",
    "CREATE INDEX IF NOT EXISTS ix_members_approval_roster ON members (approval_status, status, member_type)",
    "CREATE INDEX IF NOT EXISTS ix_members_created_updated ON members (created_at DESC, updated_at DESC, id DESC)",
    "CREATE INDEX IF NOT EXISTS ix_members_rfid ON members (rfid) WHERE rfid <> ''",
    "CREATE INDEX IF NOT EXISTS ix_members_personal_id_lower ON members (lower(personal_id)) WHERE personal_id <> ''",
    "CREATE INDEX IF NOT EXISTS ix_assignments_date ON assignments (date)",
    "CREATE INDEX IF NOT EXISTS ix_assignments_date_user ON assignments (date, user_id)",
    "CREATE INDEX IF NOT EXISTS ix_suppressed_carries_date ON suppressed_carries (date)",
    "CREATE INDEX IF NOT EXISTS ix_tag_requests_status_queue ON tag_requests (status, queue)",
    "CREATE INDEX IF NOT EXISTS ix_tag_requests_queue_status ON tag_requests (queue, status)",
    "CREATE INDEX IF NOT EXISTS ix_tag_requests_date ON tag_requests (date)",
)

DROPS = (
    "ix_tag_requests_date",
    "ix_tag_requests_queue_status",
    "ix_tag_requests_status_queue",
    "ix_suppressed_carries_date",
    "ix_assignments_date_user",
    "ix_assignments_date",
    "ix_members_personal_id_lower",
    "ix_members_rfid",
    "ix_members_created_updated",
    "ix_members_approval_roster",
    "ix_members_approval_status_status",
    "ix_members_wing_lower",
    "ix_members_rank",
    "ix_members_member_type",
    "ix_members_status",
    "ix_members_approval_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    for sql in INDEXES:
        bind.exec_driver_sql(sql)


def downgrade() -> None:
    bind = op.get_bind()
    for name in DROPS:
        bind.exec_driver_sql(f"DROP INDEX IF EXISTS {name}")
