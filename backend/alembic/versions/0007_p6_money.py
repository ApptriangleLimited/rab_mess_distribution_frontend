"""p6 month close, manpower, pritibhoj, document storage.

Revision ID: 0007_p6
Revises: 0006_p5
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_p6"
down_revision: Union[str, Sequence[str], None] = "0006_p5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "closed_months",
        sa.Column("month", sa.String(length=7), primary_key=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("closed_by", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("rates_snapshot", sa.JSON(), nullable=False),
    )
    op.create_table(
        "manpower_officer_absent",
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("wing", sa.String(length=80), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "pritibhoj_events",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("occasion", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("org", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("main_rows", sa.JSON(), nullable=False),
        sa.Column("admin_rows", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pritibhoj_events_date", "pritibhoj_events", ["date"])
    op.add_column("member_documents", sa.Column("storage_path", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("member_documents", "storage_path")
    op.drop_index("ix_pritibhoj_events_date", table_name="pritibhoj_events")
    op.drop_table("pritibhoj_events")
    op.drop_table("manpower_officer_absent")
    op.drop_table("closed_months")
