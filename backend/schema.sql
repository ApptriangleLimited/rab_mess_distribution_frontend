-- CC members + tag requests. Applied automatically on backend startup
-- via SQLAlchemy create_all. Keep this file as the documented schema.

CREATE TABLE IF NOT EXISTS staff (
    id VARCHAR(40) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    password_hash TEXT NOT NULL,
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
