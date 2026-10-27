-- Derived from governance/STATE.md stage2.5: shared, immutable reading snapshots.
-- Apply explicitly to a dedicated Augurwell database. Application startup never
-- runs this migration. Do not point this migration at another product's database.
BEGIN;
CREATE TABLE augurwell_records (
  id uuid PRIMARY KEY,
  saved_at timestamptz NOT NULL,
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 255),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  CHECK (document->>'id' = id::text),
  CHECK (document->>'schemaVersion' = '1'),
  CHECK (document->>'createdBy' = created_by)
);
CREATE INDEX augurwell_records_saved_order ON augurwell_records (saved_at DESC, id DESC);
COMMIT;
