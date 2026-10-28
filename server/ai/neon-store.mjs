import { AIStorageNotConfigured, AIStorageUnavailable } from './service.mjs';

/** Durable request ownership; no fallback storage or runtime DDL. */
export async function createNeonAIStore(connectionString) {
  if (typeof connectionString !== 'string' || !connectionString.trim()) throw new AIStorageNotConfigured();
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  return {
    async get(id) {
      const rows = await sql`SELECT document FROM augurwell_ai_interpretations WHERE id = ${id}::uuid`;
      return rows[0]?.document ?? null;
    },
    async claim(attempt, hash) {
      const rows = await sql`
        INSERT INTO augurwell_ai_interpretations (id, created_at, created_by, request_hash, status, document)
        VALUES (${attempt.id}::uuid, ${attempt.createdAt}::timestamptz, ${attempt.createdBy}, ${hash}, 'pending', ${JSON.stringify(attempt)}::jsonb)
        ON CONFLICT (id) DO NOTHING RETURNING document, request_hash
      `;
      if (rows.length) return { attempt: rows[0].document, hash: rows[0].request_hash, inserted: true };
      const found = await sql`SELECT document, request_hash FROM augurwell_ai_interpretations WHERE id = ${attempt.id}::uuid`;
      if (!found.length) throw new AIStorageUnavailable();
      return { attempt: found[0].document, hash: found[0].request_hash, inserted: false };
    },
    async finish(id, attempt) {
      const rows = await sql`
        UPDATE augurwell_ai_interpretations SET status = ${attempt.status}, document = ${JSON.stringify(attempt)}::jsonb
        WHERE id = ${id}::uuid AND status = 'pending' AND request_hash = ${attempt.requestHash}
        RETURNING document
      `;
      if (rows.length) return rows[0].document;
      const found = await sql`SELECT document FROM augurwell_ai_interpretations WHERE id = ${id}::uuid AND request_hash = ${attempt.requestHash}`;
      if (!found.length) throw new AIStorageUnavailable();
      return found[0].document;
    },
  };
}
