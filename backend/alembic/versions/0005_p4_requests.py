"""p4 tag requests, state reports.

Revision ID: 0005_p4
Revises: 0004_p3
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_p4"
down_revision: Union[str, Sequence[str], None] = "0004_p3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tag_requests",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("user_id", sa.String(length=32), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=False),
        sa.Column("from_tag", sa.String(length=8), nullable=False, server_default=""),
        sa.Column("to_tag", sa.String(length=8), nullable=False),
        sa.Column("trg_tone", sa.String(length=8), nullable=True),
        sa.Column("trg_sarda", sa.Boolean(), nullable=True),
        sa.Column("queue", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="requested"),
        sa.Column("requested_by", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.String(length=160), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tag_requests_user_id", "tag_requests", ["user_id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_tag_requests_open_queue "
        "ON tag_requests (user_id, queue) WHERE status = 'requested'"
    )
    op.create_table(
        "state_reports",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("submitted_by", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.String(length=160), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("boro_khana", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("totals", sa.JSON(), nullable=False),
        sa.Column("members", sa.JSON(), nullable=False),
    )
    op.create_index("ix_state_reports_date", "state_reports", ["date"])


def downgrade() -> None:
    op.drop_index("ix_state_reports_date", table_name="state_reports")
    op.drop_table("state_reports")
    op.execute("DROP INDEX IF EXISTS uq_tag_requests_open_queue")
    op.drop_index("ix_tag_requests_user_id", table_name="tag_requests")
    op.drop_table("tag_requests")
