"""Add au_entry_by / au_update_by on every table, plus staff.avatar.

Revision ID: 0006_audit_user_and_avatar
Revises: 0005_staff_password_vault
Create Date: 2026-09-21
"""

from alembic import op

revision = "0006_audit_user_and_avatar"
down_revision = "0005_staff_password_vault"
branch_labels = None
depends_on = None

TABLES = (
    "staff",
    "members",
    "tag_requests",
    "assignments",
    "suppressed_carries",
    "day_locks",
    "boro_khana_days",
    "rates",
    "senders",
    "catalog_state",
    "authorized_strength",
    "manpower_officer_absent",
    "state_reports",
    "meal_shifts",
    "meal_plans",
    "meal_assigns",
    "guest_meals",
    "audit_logs",
    "pritibhoj_events",
    "refresh_sessions",
    "password_resets",
    "permissions",
    "role_permissions",
    "file_objects",
    "notifications",
)


def upgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql(
        """
        ALTER TABLE staff
            ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT '';
        """
    )
    for table in TABLES:
        bind.exec_driver_sql(
            f"""
            ALTER TABLE {table}
                ADD COLUMN IF NOT EXISTS au_entry_by VARCHAR(128) NOT NULL DEFAULT '';
            ALTER TABLE {table}
                ADD COLUMN IF NOT EXISTS au_update_by VARCHAR(128) NOT NULL DEFAULT '';
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql("ALTER TABLE staff DROP COLUMN IF EXISTS avatar;")
    for table in TABLES:
        bind.exec_driver_sql(
            f"""
            ALTER TABLE {table} DROP COLUMN IF EXISTS au_entry_by;
            ALTER TABLE {table} DROP COLUMN IF EXISTS au_update_by;
            """
        )
