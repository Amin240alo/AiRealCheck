-- Credits system v1 (plans + transactions)

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    analysis_id VARCHAR(36),
    media_type VARCHAR(20),
    idempotency_key VARCHAR(64) UNIQUE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_credit_transactions_user_created
    ON credit_transactions(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_credit_transactions_idempotency_key
    ON credit_transactions(idempotency_key);

-- Backfill credits_total from legacy credit_ledger balances (if any)
UPDATE users
SET credits_total = GREATEST(COALESCE(ledger.total, 0), 0),
    credits_used = 0
FROM (
    SELECT user_id, SUM(delta) AS total
    FROM credit_ledger
    GROUP BY user_id
) AS ledger
WHERE users.id = ledger.user_id
  AND users.credits_total = 0;

UPDATE users
SET last_credit_reset = NOW()
WHERE last_credit_reset IS NULL;
