"""WR subtype (WR 1–15 / WR S) on assignments and tag requests.

Revision ID: 0010_wr_code
Revises: 0009_pritibhoj_roster
Create Date: 2026-11-24
"""

from alembic import op

revision = "0010_wr_code"
down_revision = "0009_pritibhoj_roster"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql(
        "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS wr_code VARCHAR(8);"
    )
    bind.exec_driver_sql(
        "ALTER TABLE tag_requests ADD COLUMN IF NOT EXISTS wr_code VARCHAR(8);"
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql("ALTER TABLE assignments DROP COLUMN IF EXISTS wr_code;")
    bind.exec_driver_sql("ALTER TABLE tag_requests DROP COLUMN IF EXISTS wr_code;")
