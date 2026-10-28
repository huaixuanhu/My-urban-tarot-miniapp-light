-- Derived from governance/STATE.md stage2.5.4. No startup migration.
-- Apply separately, only to the dedicated Augurwell database after authorization.
BEGIN;
CREATE TABLE augurwell_ai_interpretations (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 255),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'incomplete', 'failed', 'unknown')),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  CHECK ((document->>'id' = id::text) IS TRUE),
  CHECK ((document->>'createdBy' = created_by) IS TRUE),
  CHECK ((document->>'requestHash' = request_hash) IS TRUE),
  CHECK ((document->>'status' = status) IS TRUE)
);
COMMIT;
