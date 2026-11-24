"""Mess checker branch on staff, and guest meal branch.

Revision ID: 0011_checker_desk
Revises: 0010_wr_code
Create Date: 2026-11-24
"""

from alembic import op

revision = "0011_checker_desk"
down_revision = "0010_wr_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql(
        "ALTER TABLE staff ADD COLUMN IF NOT EXISTS desk VARCHAR(16) NOT NULL DEFAULT '';"
    )
    bind.exec_driver_sql(
        "ALTER TABLE guest_meals ADD COLUMN IF NOT EXISTS branch VARCHAR(16) NOT NULL DEFAULT '';"
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql("ALTER TABLE staff DROP COLUMN IF EXISTS desk;")
    bind.exec_driver_sql("ALTER TABLE guest_meals DROP COLUMN IF EXISTS branch;")
