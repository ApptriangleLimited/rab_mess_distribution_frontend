"""Store Pritibhoj per-count member lists.

Revision ID: 0009_pritibhoj_roster
Revises: 0008_performance_indexes
Create Date: 2026-10-30
"""

from alembic import op

revision = "0009_pritibhoj_roster"
down_revision = "0008_performance_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql(
        """
        ALTER TABLE pritibhoj_events
            ADD COLUMN IF NOT EXISTS roster JSONB NOT NULL DEFAULT '{}'::jsonb;
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql(
        "ALTER TABLE pritibhoj_events DROP COLUMN IF EXISTS roster;"
    )
