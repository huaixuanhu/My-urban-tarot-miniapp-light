import { RandomStorageNotConfigured } from './service.mjs';
/** No startup migrations. The injectable SQL surface lets local PG verify the exact production queries. */
export async function createNeonRandomStore(connectionString) {
  if (typeof connectionString !== 'string' || !connectionString.trim()) throw new RandomStorageNotConfigured();
  const { neon } = await import('@neondatabase/serverless');
  return createRandomStoreFromSql(neon(connectionString));
}
export function createRandomStoreFromSql(sql) {
  const date = value => value == null ? null : new Date(value).toISOString();
  const get = async id => (await sql`SELECT document FROM augurwell_random_operations WHERE id = ${id}::uuid`)[0]?.document ?? null;
  return {
    get,
    async getPool() {
      const rows = await sql`SELECT * FROM augurwell_random_pool WHERE singleton = true`;
      if (!rows.length) throw new Error('pool missing');
      const row = rows[0];
      return { version: String(row.version), values: row.values_json, cursor: row.cursor, batchId: row.batch_id, fetchedAt: date(row.fetched_at),
        collectId: row.collect_id, collectStarted: date(row.collect_started), lastCollectStarted: date(row.last_collect_started) };
    },
    async claim(operation) {
      const rows = await sql`INSERT INTO augurwell_random_operations (id, action, status, created_at, document)
        VALUES (${operation.id}::uuid, ${operation.action}, 'pending', ${operation.createdAt}::timestamptz, ${JSON.stringify(operation)}::jsonb)
        ON CONFLICT (id) DO NOTHING RETURNING document`;
      if (rows.length) return { operation: rows[0].document, inserted: true };
      const existing = await get(operation.id);
      if (!existing) throw new Error('operation missing');
      return { operation: existing, inserted: false };
    },
    async startCollection(id) {
      // DB time enforces the key-wide interval and fenced lease across hosts.
      const rows = await sql`UPDATE augurwell_random_pool SET collect_id = ${id}::uuid,
        collect_started = CURRENT_TIMESTAMP, last_collect_started = CURRENT_TIMESTAMP
        WHERE singleton = true
          AND (collect_id IS NULL OR collect_started <= CURRENT_TIMESTAMP - interval '60 seconds')
          AND (last_collect_started IS NULL OR last_collect_started <= CURRENT_TIMESTAMP - interval '1 second')
          AND EXISTS (SELECT 1 FROM augurwell_random_operations WHERE id = ${id}::uuid AND action = 'collect' AND status = 'pending')
        RETURNING singleton`;
      return rows.length > 0;
    },
    async completeCollection(id, values, fetchedAt) {
      const patch = JSON.stringify({ status: 'completed', completedAt: fetchedAt, batchId: id, fetchedAt });
      const results = await sql.transaction([
        sql`SELECT id FROM augurwell_random_operations WHERE id = ${id}::uuid FOR UPDATE`,
        sql`WITH replaced AS (
          UPDATE augurwell_random_pool SET version = version + 1, values_json = ${JSON.stringify(values)}::jsonb,
            cursor = 0, batch_id = ${id}::uuid, fetched_at = ${fetchedAt}::timestamptz, collect_id = NULL, collect_started = NULL
          WHERE singleton = true AND collect_id = ${id}::uuid
            AND EXISTS (SELECT 1 FROM augurwell_random_operations WHERE id = ${id}::uuid AND action = 'collect' AND status = 'pending')
          RETURNING singleton
        ) UPDATE augurwell_random_operations SET status = 'completed', document = document || ${patch}::jsonb
          WHERE id = ${id}::uuid AND status = 'pending' AND EXISTS (SELECT 1 FROM replaced) RETURNING document`,
      ]);
      return results[1][0]?.document ?? null;
    },
    async fail(id, status, message, completedAt) {
      const patch = JSON.stringify({ status, message, completedAt });
      const results = await sql.transaction([
        sql`SELECT id FROM augurwell_random_operations WHERE id = ${id}::uuid FOR UPDATE`,
        sql`UPDATE augurwell_random_operations SET status = ${status}, document = document || ${patch}::jsonb
          WHERE id = ${id}::uuid AND status = 'pending' RETURNING document`,
        sql`UPDATE augurwell_random_pool SET collect_id = NULL, collect_started = NULL WHERE singleton = true AND collect_id = ${id}::uuid`,
      ]);
      const result = results[1][0]?.document ?? await get(id);
      if (!result) throw new Error('operation missing');
      return result;
    },
    async commitDraw(id, expectedVersion, consumed, deck, completedAt) {
      const patch = JSON.stringify({ status: 'completed', completedAt, deck });
      const results = await sql.transaction([
        sql`SELECT id FROM augurwell_random_operations WHERE id = ${id}::uuid FOR UPDATE`,
        sql`WITH moved AS (
          UPDATE augurwell_random_pool SET cursor = cursor + ${consumed}::integer, version = version + 1
          WHERE singleton = true AND version = ${expectedVersion}::bigint AND ${consumed}::integer >= 155
            AND cursor + ${consumed}::integer <= jsonb_array_length(values_json)
            AND EXISTS (SELECT 1 FROM augurwell_random_operations WHERE id = ${id}::uuid AND action = 'draw' AND status = 'pending')
          RETURNING singleton
        ) UPDATE augurwell_random_operations SET status = 'completed', document = document || ${patch}::jsonb
          WHERE id = ${id}::uuid AND status = 'pending' AND EXISTS (SELECT 1 FROM moved) RETURNING document`,
      ]);
      return results[1][0]?.document ?? null;
    },
  };
}
