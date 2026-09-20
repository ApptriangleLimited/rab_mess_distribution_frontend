-- Canonical application schema. Applied by Alembic revision 0001.
-- Production deployments must use: alembic upgrade head

CREATE TABLE IF NOT EXISTS staff (
    id VARCHAR(40) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    password_hash TEXT NOT NULL,
    password_vault TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    personal_id VARCHAR(128) NOT NULL DEFAULT '',
    rab_id VARCHAR(128) NOT NULL DEFAULT '',
    rfid VARCHAR(128) NOT NULL DEFAULT '',
    rank VARCHAR(128) NOT NULL DEFAULT '',
    wing VARCHAR(128) NOT NULL DEFAULT '',
    force VARCHAR(128) NOT NULL DEFAULT '',
    religion VARCHAR(64) NOT NULL DEFAULT '',
    member_type VARCHAR(32) NOT NULL DEFAULT 'permanent',
    dropdown_no VARCHAR(128) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    blood_group VARCHAR(8) NOT NULL DEFAULT '',
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    documents_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(8) NOT NULL DEFAULT '1',
    approval_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    bank_name VARCHAR(128) NOT NULL DEFAULT '',
    account_name VARCHAR(255) NOT NULL DEFAULT '',
    account_number VARCHAR(64) NOT NULL DEFAULT '',
    routing VARCHAR(64) NOT NULL DEFAULT '',
    branch VARCHAR(128) NOT NULL DEFAULT '',
    branch_location VARCHAR(255) NOT NULL DEFAULT '',
    joining_date DATE,
    out_date DATE,
    default_tag VARCHAR(32) NOT NULL DEFAULT 'MS',
    jl_end_date VARCHAR(16) NOT NULL DEFAULT '',
    inactive_spans JSONB NOT NULL DEFAULT '[]'::jsonb,
    emergency_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_members_rab_id_lower
    ON members (lower(rab_id))
    WHERE rab_id <> '';

CREATE TABLE IF NOT EXISTS tag_requests (
    id VARCHAR(40) PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL REFERENCES members(id),
    date DATE NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    from_tag VARCHAR(32) NOT NULL DEFAULT '',
    to_tag VARCHAR(32) NOT NULL,
    trg_tone VARCHAR(16),
    trg_sarda BOOLEAN,
    queue VARCHAR(16) NOT NULL DEFAULT 'daily',
    status VARCHAR(16) NOT NULL DEFAULT 'requested',
    requested_by VARCHAR(40) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(40),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_tag_requests_user_id ON tag_requests (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_requests_pending
    ON tag_requests (user_id, queue)
    WHERE status = 'requested';

CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(40) PRIMARY KEY,
    user_id VARCHAR(40) NOT NULL REFERENCES members(id),
    date DATE NOT NULL,
    tag VARCHAR(32) NOT NULL,
    trg_tone VARCHAR(16),
    updated_by VARCHAR(40) NOT NULL DEFAULT 'daily',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assignments_member_date
    ON assignments (user_id, date);

CREATE INDEX IF NOT EXISTS ix_assignments_user_id ON assignments (user_id);

CREATE TABLE IF NOT EXISTS suppressed_carries (
    user_id VARCHAR(40) NOT NULL REFERENCES members(id),
    date DATE NOT NULL,
    PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS day_locks (
    date DATE PRIMARY KEY,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by VARCHAR(40) NOT NULL DEFAULT 'daily'
);

CREATE TABLE IF NOT EXISTS boro_khana_days (
    date DATE PRIMARY KEY,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rates (
    tag VARCHAR(32) PRIMARY KEY,
    amount_per_day DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    is_protected BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS senders (
    id VARCHAR(40) PRIMARY KEY,
    label VARCHAR(255) NOT NULL DEFAULT '',
    bank_name VARCHAR(128) NOT NULL DEFAULT '',
    account_name VARCHAR(255) NOT NULL DEFAULT '',
    account_number VARCHAR(64) NOT NULL DEFAULT '',
    routing VARCHAR(64) NOT NULL DEFAULT '',
    branch VARCHAR(128) NOT NULL DEFAULT '',
    branch_location VARCHAR(255) NOT NULL DEFAULT '',
    mapped_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS catalog_state (
    id VARCHAR(16) PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS authorized_strength (
    id VARCHAR(40) PRIMARY KEY,
    label VARCHAR(255) NOT NULL DEFAULT '',
    count INTEGER NOT NULL DEFAULT 0,
    wings JSONB NOT NULL DEFAULT '{}'::jsonb,
    held_wings JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS manpower_officer_absent (
    date DATE NOT NULL,
    wing VARCHAR(128) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, wing)
);

CREATE TABLE IF NOT EXISTS state_reports (
    id VARCHAR(40) PRIMARY KEY,
    date DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMPTZ NOT NULL,
    submitted_by VARCHAR(128) NOT NULL DEFAULT '',
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(128) NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    boro_khana BOOLEAN NOT NULL DEFAULT FALSE,
    members JSONB NOT NULL DEFAULT '[]'::jsonb,
    totals JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS meal_shifts (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(128) NOT NULL DEFAULT '',
    start_time VARCHAR(16) NOT NULL DEFAULT '',
    end_time VARCHAR(16) NOT NULL DEFAULT '',
    description VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_plans (
    id VARCHAR(40) PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    meals JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_assigns (
    id VARCHAR(40) PRIMARY KEY,
    member_id VARCHAR(40) NOT NULL,
    shift_id VARCHAR(40) NOT NULL DEFAULT '',
    status INTEGER NOT NULL DEFAULT 1,
    date DATE NOT NULL,
    check_in_time VARCHAR(32) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guest_meals (
    id VARCHAR(40) PRIMARY KEY,
    shift_id VARCHAR(40) NOT NULL DEFAULT '',
    date DATE NOT NULL,
    check_in_time VARCHAR(32) NOT NULL DEFAULT '',
    guest_name VARCHAR(255) NOT NULL DEFAULT '',
    guest_info TEXT NOT NULL DEFAULT '',
    ref_info TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id VARCHAR(40) NOT NULL DEFAULT '',
    action VARCHAR(64) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL DEFAULT '',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs (entity);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS pritibhoj_events (
    id VARCHAR(40) PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT '',
    occasion VARCHAR(255) NOT NULL DEFAULT '',
    date DATE NOT NULL,
    org VARCHAR(255) NOT NULL DEFAULT '',
    main_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    admin_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform tables are added in Alembic 0002 (refresh, MFA, RBAC, files, notifications).
