"""p5 mess kitchen + zk.

Revision ID: 0006_p5
Revises: 0005_p4
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_p5"
down_revision: Union[str, Sequence[str], None] = "0005_p4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meal_shifts",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("end_time", sa.String(length=5), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "meal_plans",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("meals", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_meal_plans_date", "meal_plans", ["date"], unique=True)
    op.create_table(
        "meal_assigns",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("member_id", sa.String(length=32), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("shift_id", sa.String(length=32), sa.ForeignKey("meal_shifts.id"), nullable=False),
        sa.Column("status", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "member_id",
            "shift_id",
            "date",
            "check_in_time",
            name="uq_meal_assigns_punch",
        ),
    )
    op.create_index("ix_meal_assigns_member_id", "meal_assigns", ["member_id"])
    op.create_index("ix_meal_assigns_shift_id", "meal_assigns", ["shift_id"])
    op.create_index("ix_meal_assigns_date", "meal_assigns", ["date"])
    op.create_table(
        "guest_meals",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("shift_id", sa.String(length=32), sa.ForeignKey("meal_shifts.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("guest_name", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("guest_info", sa.Text(), nullable=False, server_default=""),
        sa.Column("ref_info", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_guest_meals_shift_id", "guest_meals", ["shift_id"])
    op.create_index("ix_guest_meals_date", "guest_meals", ["date"])


def downgrade() -> None:
    op.drop_index("ix_guest_meals_date", table_name="guest_meals")
    op.drop_index("ix_guest_meals_shift_id", table_name="guest_meals")
    op.drop_table("guest_meals")
    op.drop_index("ix_meal_assigns_date", table_name="meal_assigns")
    op.drop_index("ix_meal_assigns_shift_id", table_name="meal_assigns")
    op.drop_index("ix_meal_assigns_member_id", table_name="meal_assigns")
    op.drop_table("meal_assigns")
    op.drop_index("ix_meal_plans_date", table_name="meal_plans")
    op.drop_table("meal_plans")
    op.drop_table("meal_shifts")
