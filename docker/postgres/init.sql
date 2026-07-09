-- Create role enum type
CREATE TYPE role AS ENUM ('superadmin', 'admin', 'operator', 'viewer');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    full_name   VARCHAR(255) NOT NULL,
    hashed_password VARCHAR NOT NULL,
    role        role NOT NULL DEFAULT 'operator',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

-- Default admin user  (password: changeme)
INSERT INTO users (id, email, full_name, hashed_password, role, is_active)
VALUES (
    gen_random_uuid()::text,
    'admin@example.com',
    'Admin',
    '$2b$12$dbZaAFJIdPLO4TipVL5hOeJsIcg/xtkbHZ.iNSm6j2ao/zrQgeRwW',
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;
