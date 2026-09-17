"""Add members.duty_start.

Revision ID: 0004_member_duty_start
Revises: 0003_member_force_rank
Create Date: 2026-09-17
"""

from alembic import op

revision = "0004_member_duty_start"
down_revision = "0003_member_force_rank"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().exec_driver_sql(
        """
        ALTER TABLE members
            ADD COLUMN IF NOT EXISTS duty_start DATE;
        """
    )


def downgrade() -> None:
    op.get_bind().exec_driver_sql(
        "ALTER TABLE members DROP COLUMN IF EXISTS duty_start;"
    )
