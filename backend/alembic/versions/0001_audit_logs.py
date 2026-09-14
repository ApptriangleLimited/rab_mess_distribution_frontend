"""Baseline application schema.

Revision ID: 0001_audit
Revises:
Create Date: 2026-09-13
"""

from pathlib import Path

from alembic import op

revision = "0001_audit"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = (Path(__file__).resolve().parents[2] / "schema.sql").read_text(encoding="utf-8")
    op.get_bind().exec_driver_sql(schema)


def downgrade() -> None:
    # Baseline is not safely reversible on a populated database.
    pass
