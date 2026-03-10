-- Add confidence_label to analysis_history for fast list-level access
-- without parsing result_payload JSON on every request.

ALTER TABLE analysis_history ADD COLUMN IF NOT EXISTS confidence_label VARCHAR(20);
