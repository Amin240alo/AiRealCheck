-- Add display_name to users (safe for existing DBs)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
