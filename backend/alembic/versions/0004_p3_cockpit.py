"""p3 assignments, day locks, boro khana.

Revision ID: 0004_p3
Revises: 0003_p2
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_p3"
down_revision: Union[str, Sequence[str], None] = "0003_p2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assignments",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("member_id", sa.String(length=32), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("tag", sa.String(length=8), nullable=False),
        sa.Column("trg_tone", sa.String(length=8), nullable=True),
        sa.Column("updated_by", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_assignments_member_id", "assignments", ["member_id"])
    op.create_index("ix_assignments_date", "assignments", ["date"])
    op.create_index("uq_assignments_member_date", "assignments", ["member_id", "date"], unique=True)

    op.create_table(
        "suppressed_carries",
        sa.Column("member_id", sa.String(length=32), sa.ForeignKey("members.id"), primary_key=True),
        sa.Column("date", sa.Date(), primary_key=True),
    )
    op.create_table(
        "approved_days",
        sa.Column("date", sa.Date(), primary_key=True),
    )
    op.create_table(
        "boro_khana_dates",
        sa.Column("date", sa.Date(), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("boro_khana_dates")
    op.drop_table("approved_days")
    op.drop_table("suppressed_carries")
    op.drop_index("uq_assignments_member_date", table_name="assignments")
    op.drop_index("ix_assignments_date", table_name="assignments")
    op.drop_index("ix_assignments_member_id", table_name="assignments")
    op.drop_table("assignments")
