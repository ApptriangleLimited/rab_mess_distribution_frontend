"""p2 members, catalog, rates, senders, audit.

Revision ID: 0003_p2
Revises: 0002_p1
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_p2"
down_revision: Union[str, Sequence[str], None] = "0002_p1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "members",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("personal_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("rab_id", postgresql.CITEXT(), nullable=False),
        sa.Column("rfid", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("rank", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("wing", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("force", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("religion", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("member_type", sa.String(length=32), nullable=False, server_default="permanent"),
        sa.Column("dropdown_no", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("phone", sa.String(length=16), nullable=False, server_default=""),
        sa.Column("blood_group", sa.String(length=8), nullable=False, server_default=""),
        sa.Column("documents_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(length=1), nullable=False, server_default="1"),
        sa.Column("approval_status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("default_tag", sa.String(length=8), nullable=False, server_default="MS"),
        sa.Column("jl_end_date", sa.String(length=10), nullable=False, server_default=""),
        sa.Column("bank_name", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("account_name", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("account_number", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("routing", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("branch", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("branch_location", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("joining_date", sa.Date(), nullable=True),
        sa.Column("out_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_members_rab_id", "members", ["rab_id"], unique=True)
    op.execute(
        "CREATE UNIQUE INDEX ix_members_personal_id_nz ON members (personal_id) WHERE personal_id <> ''"
    )
    op.create_index("ix_members_status", "members", ["status"])
    op.create_index("ix_members_approval", "members", ["approval_status"])

    op.create_table(
        "member_documents",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("member_id", sa.String(length=32), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("url", sa.Text(), nullable=True),
    )
    op.create_table(
        "member_emergency",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("member_id", sa.String(length=32), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("relation", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("phone", sa.String(length=16), nullable=False, server_default=""),
    )
    op.create_table(
        "member_inactive_spans",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("member_id", sa.String(length=32), sa.ForeignKey("members.id"), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=True),
    )
    op.create_table(
        "allowance_rates",
        sa.Column("tag", sa.String(length=8), primary_key=True),
        sa.Column("amount_per_day", sa.Numeric(12, 2), nullable=False),
    )
    op.create_table(
        "senders",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("bank_name", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("account_name", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("account_number", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("routing", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("branch", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("branch_location", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("mapped_tags", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "org_ranks",
        sa.Column("label", sa.String(length=64), primary_key=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("elaborate", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("builtin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "org_wings",
        sa.Column("label", sa.String(length=80), primary_key=True),
        sa.Column("parent", sa.String(length=80), nullable=True),
        sa.Column("elaborate", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("builtin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "org_forces",
        sa.Column("label", sa.String(length=64), primary_key=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("builtin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "org_force_ranks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("force", sa.String(length=64), nullable=False),
        sa.Column("rank", sa.String(length=64), nullable=False),
        sa.Column("is_extra", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("elaborate", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "org_rank_equivalents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rab_rank", sa.String(length=64), nullable=False),
        sa.Column("force", sa.String(length=64), nullable=False),
        sa.Column("service_rank", sa.String(length=64), nullable=False),
    )
    op.create_table(
        "org_rank_force_wings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rab_rank", sa.String(length=64), nullable=False),
        sa.Column("force", sa.String(length=64), nullable=False),
        sa.Column("wing", sa.String(length=80), nullable=False),
    )
    op.create_table(
        "org_member_banks",
        sa.Column("label", sa.String(length=80), primary_key=True),
        sa.Column("builtin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "authorized_strength",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wings", sa.JSON(), nullable=False),
        sa.Column("held_wings", sa.JSON(), nullable=False),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=32), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("staff_id", sa.String(length=32), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    for table in (
        "audit_events",
        "authorized_strength",
        "org_member_banks",
        "org_rank_force_wings",
        "org_rank_equivalents",
        "org_force_ranks",
        "org_forces",
        "org_wings",
        "org_ranks",
        "senders",
        "allowance_rates",
        "member_inactive_spans",
        "member_emergency",
        "member_documents",
        "members",
    ):
        op.drop_table(table)
