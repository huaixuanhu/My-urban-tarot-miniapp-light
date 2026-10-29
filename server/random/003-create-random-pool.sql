-- Derived from governance/STATE.md stage2.5.5: shared quantum inventory.
-- Explicit local/authorised dedicated-database migration only; never run at startup.
BEGIN;
CREATE TABLE augurwell_random_operations (
  id uuid PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('collect', 'draw')),
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'unknown')),
  created_at timestamptz NOT NULL,
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  CHECK ((document->>'id' = id::text) IS TRUE),
  CHECK ((document->>'action' = action) IS TRUE),
  CHECK ((document->>'status' = status) IS TRUE)
);
CREATE TABLE augurwell_random_pool (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  values_json jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(values_json) = 'array' AND jsonb_array_length(values_json) IN (0, 1024)),
  cursor integer NOT NULL DEFAULT 0 CHECK (cursor >= 0 AND cursor <= jsonb_array_length(values_json)),
  batch_id uuid REFERENCES augurwell_random_operations(id),
  fetched_at timestamptz,
  collect_id uuid REFERENCES augurwell_random_operations(id),
  collect_started timestamptz,
  last_collect_started timestamptz,
  CHECK ((batch_id IS NULL) = (fetched_at IS NULL)),
  CHECK ((batch_id IS NULL) = (jsonb_array_length(values_json) = 0)),
  CHECK ((collect_id IS NULL) = (collect_started IS NULL))
);
INSERT INTO augurwell_random_pool (singleton) VALUES (true);
COMMIT;
