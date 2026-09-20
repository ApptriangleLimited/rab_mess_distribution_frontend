"""Store a recoverable staff password for admin viewing.

Revision ID: 0005_staff_password_vault
Revises: 0004_member_duty_start
Create Date: 2026-09-20
"""

from alembic import op

revision = "0005_staff_password_vault"
down_revision = "0004_member_duty_start"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().exec_driver_sql(
        """
        ALTER TABLE staff
            ADD COLUMN IF NOT EXISTS password_vault TEXT;
        """
    )


def downgrade() -> None:
    op.get_bind().exec_driver_sql(
        "ALTER TABLE staff DROP COLUMN IF EXISTS password_vault;"
    )
