import { RecordStorageUnavailable, RecordStorageNotConfigured } from './service.mjs';

/** No DDL, credentials, local fallback or per-user filter belongs in this adapter. */
export async function createNeonRecordStore(connectionString) {
  if (typeof connectionString !== 'string' || !connectionString.trim()) throw new RecordStorageNotConfigured();
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  return {
    async getAIInterpretations(ids) {
      const rows = await sql`SELECT document FROM augurwell_ai_interpretations WHERE id = ANY(${ids}::uuid[])`;
      return rows.map(row => row.document);
    },
    async create(record, hash) {
      const rows = await sql`
        INSERT INTO augurwell_records (id, saved_at, created_by, request_hash, document)
        VALUES (${record.id}::uuid, ${record.savedAt}::timestamptz, ${record.createdBy}, ${hash}, ${JSON.stringify(record)}::jsonb)
        ON CONFLICT (id) DO NOTHING
        RETURNING document, request_hash
      `;
      if (rows.length) return { record: rows[0].document, hash: rows[0].request_hash, inserted: true };
      // A separate statement sees a concurrent winning INSERT after its commit;
      // a single INSERT/SELECT CTE can miss that row at its original snapshot.
      const existing = await sql`SELECT document, request_hash FROM augurwell_records WHERE id = ${record.id}::uuid`;
      if (!existing.length) throw new RecordStorageUnavailable();
      return { record: existing[0].document, hash: existing[0].request_hash, inserted: false };
    },
    async get(id) {
      const rows = await sql`SELECT document FROM augurwell_records WHERE id = ${id}::uuid`;
      return rows[0]?.document ?? null;
    },
    async list({ limit, cursor }) {
      const rows = cursor
        ? await sql`SELECT document FROM augurwell_records WHERE (saved_at, id) < (${cursor.savedAt}::timestamptz, ${cursor.id}::uuid) ORDER BY saved_at DESC, id DESC LIMIT ${limit}`
        : await sql`SELECT document FROM augurwell_records ORDER BY saved_at DESC, id DESC LIMIT ${limit}`;
      return rows.map(row => row.document);
    },
  };
}
