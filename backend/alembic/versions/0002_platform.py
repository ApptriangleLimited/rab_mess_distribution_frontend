"""Refresh sessions, MFA, RBAC, files, notifications.

Revision ID: 0002_platform
Revises: 0001_audit
Create Date: 2026-09-13
"""

from alembic import op

revision = "0002_platform"
down_revision = "0001_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().exec_driver_sql(
        """
        ALTER TABLE staff
            ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE staff
            ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
        ALTER TABLE staff
            ADD COLUMN IF NOT EXISTS mfa_recovery TEXT;
        ALTER TABLE staff
            ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

        CREATE TABLE IF NOT EXISTS refresh_sessions (
            id VARCHAR(40) PRIMARY KEY,
            staff_id VARCHAR(40) NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            family_id VARCHAR(40) NOT NULL,
            revoked BOOLEAN NOT NULL DEFAULT FALSE,
            replaced_by VARCHAR(40),
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            user_agent VARCHAR(255) NOT NULL DEFAULT '',
            ip VARCHAR(64) NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS ix_refresh_sessions_staff_id ON refresh_sessions (staff_id);
        CREATE INDEX IF NOT EXISTS ix_refresh_sessions_family_id ON refresh_sessions (family_id);

        CREATE TABLE IF NOT EXISTS password_resets (
            id VARCHAR(40) PRIMARY KEY,
            staff_id VARCHAR(40) NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ix_password_resets_staff_id ON password_resets (staff_id);

        CREATE TABLE IF NOT EXISTS permissions (
            code VARCHAR(64) PRIMARY KEY,
            description VARCHAR(255) NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
            role VARCHAR(32) NOT NULL,
            permission_code VARCHAR(64) NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
            PRIMARY KEY (role, permission_code)
        );

        CREATE TABLE IF NOT EXISTS file_objects (
            id VARCHAR(40) PRIMARY KEY,
            original_name VARCHAR(255) NOT NULL DEFAULT '',
            storage_key VARCHAR(512) NOT NULL UNIQUE,
            mime_type VARCHAR(128) NOT NULL DEFAULT '',
            size INTEGER NOT NULL DEFAULT 0,
            checksum VARCHAR(64) NOT NULL DEFAULT '',
            entity_type VARCHAR(64) NOT NULL DEFAULT '',
            entity_id VARCHAR(64) NOT NULL DEFAULT '',
            uploaded_by VARCHAR(40) NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS ix_file_objects_entity ON file_objects (entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS ix_file_objects_uploaded_by ON file_objects (uploaded_by);

        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(40) PRIMARY KEY,
            recipient_user_id VARCHAR(40) NOT NULL,
            type VARCHAR(64) NOT NULL DEFAULT 'info',
            title VARCHAR(255) NOT NULL DEFAULT '',
            message TEXT NOT NULL DEFAULT '',
            entity_type VARCHAR(64) NOT NULL DEFAULT '',
            entity_id VARCHAR(64) NOT NULL DEFAULT '',
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            read_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS ix_notifications_recipient ON notifications (recipient_user_id, is_read, created_at);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS notifications;
        DROP TABLE IF EXISTS file_objects;
        DROP TABLE IF EXISTS role_permissions;
        DROP TABLE IF EXISTS permissions;
        DROP TABLE IF EXISTS password_resets;
        DROP TABLE IF EXISTS refresh_sessions;
        ALTER TABLE staff DROP COLUMN IF EXISTS password_changed_at;
        ALTER TABLE staff DROP COLUMN IF EXISTS mfa_recovery;
        ALTER TABLE staff DROP COLUMN IF EXISTS mfa_secret;
        ALTER TABLE staff DROP COLUMN IF EXISTS mfa_enabled;
        """
    )
