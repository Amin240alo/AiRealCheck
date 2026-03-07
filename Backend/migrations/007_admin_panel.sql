-- Admin panel additions: ban flag + admin logs

ALTER TABLE users ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    event VARCHAR(80) NOT NULL,
    meta_json JSONB
);

CREATE INDEX IF NOT EXISTS ix_admin_logs_ts ON admin_logs(ts DESC);
