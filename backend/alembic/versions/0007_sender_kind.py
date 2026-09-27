"""Split payout bank accounts into SRB Bank and Mess Bank.

Revision ID: 0007_sender_kind
Revises: 0006_audit_user_and_avatar
Create Date: 2026-09-27
"""

from alembic import op

revision = "0007_sender_kind"
down_revision = "0006_audit_user_and_avatar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql(
        """
        ALTER TABLE senders
            ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'srb';
        """
    )
    # Demo Fresh Money / Firewood rows are the mess payout accounts.
    # Real SRB accounts (for example Director Admin & Finance) stay kind=srb.
    bind.exec_driver_sql(
        """
        UPDATE senders
           SET kind = 'mess'
         WHERE lower(coalesce(label, '')) LIKE 'fresh money%'
            OR lower(coalesce(label, '')) LIKE 'firewood fr%'
            OR lower(coalesce(label, '')) LIKE 'fr fuel%'
            OR lower(coalesce(account_name, '')) IN ('fresh money', 'firewood fr', 'fr fuel');
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.exec_driver_sql("ALTER TABLE senders DROP COLUMN IF EXISTS kind;")
