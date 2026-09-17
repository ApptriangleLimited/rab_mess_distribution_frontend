"""Add members.force_rank.

Revision ID: 0003_member_force_rank
Revises: 0002_platform
Create Date: 2026-09-17
"""

from alembic import op

revision = "0003_member_force_rank"
down_revision = "0002_platform"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().exec_driver_sql(
        """
        ALTER TABLE members
            ADD COLUMN IF NOT EXISTS force_rank VARCHAR(128) NOT NULL DEFAULT '';
        """
    )


def downgrade() -> None:
    op.get_bind().exec_driver_sql(
        "ALTER TABLE members DROP COLUMN IF EXISTS force_rank;"
    )
