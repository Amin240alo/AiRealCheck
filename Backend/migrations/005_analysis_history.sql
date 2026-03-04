-- Analysis history table for user-visible history entries

CREATE TABLE IF NOT EXISTS analysis_history (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type TEXT,
    file_ref TEXT,
    thumb_ref TEXT,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    final_score REAL,
    verdict_label TEXT,
    engine_breakdown TEXT,
    result_payload TEXT,
    credits_charged INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_analysis_history_user_created
    ON analysis_history(user_id, created_at DESC);
