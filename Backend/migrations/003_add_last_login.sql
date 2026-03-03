-- Add last_login to users (safe for existing DBs)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
