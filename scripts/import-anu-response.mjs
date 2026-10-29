/** Offline restoration of the single retained ANU response. NEVER calls network or reads a key. */
import assert from 'node:assert/strict';
import { readFile, open } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createANUProvider } from '../server/random/provider.mjs';
import { createRandomStoreFromSql } from '../server/random/neon-store.mjs';
import { openLocalPostgres } from './lib/local-postgres.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)), folder = path.join(root, '.local/anu-live');
const bytes = await readFile(path.join(folder, 'response.json'));
const receipt = JSON.parse(await readFile(path.join(folder, 'receipt.json'), 'utf8'));
const attempt = JSON.parse(await readFile(path.join(folder, 'attempt.json'), 'utf8'));
assert.equal(receipt.httpStatus, 200); assert.equal(receipt.provider, 'ANU');
assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.responseSha256);
assert.equal(new Date(receipt.fetchedAt).toISOString(), receipt.fetchedAt);
assert(Date.parse(attempt.startedAt) <= Date.parse(receipt.fetchedAt));
// The injected transport returns exactly the archived bytes; no global fetch.
const values = await createANUProvider('offline-response-validation', async () => new Response(bytes)).collect();
const db = await openLocalPostgres({ directory: path.join(root, '.local/anu-live-pg'), migrations: [
  new URL('../server/records/001-create-records.sql', import.meta.url),
  new URL('../server/random/003-create-random-pool.sql', import.meta.url),
] });
try {
  const store = createRandomStoreFromSql(db.sql);
  const failed = (await db.sql`SELECT document FROM augurwell_random_operations WHERE action = 'collect' AND status = 'failed'`).map(row => row.document);
  assert.equal(failed.length, 1, 'Expected exactly one original rejected-format collection.');
  const original = failed[0];
  assert.equal(original.createdBy, 'local-anu-validation');
  assert(Date.parse(original.createdAt) <= Date.parse(attempt.startedAt));
  const importPath = path.join(folder, 'import.json');
  let manifest;
  try { manifest = JSON.parse(await readFile(importPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    manifest = { version: 1, id: randomUUID(), originalOperationId: original.id, responseSha256: receipt.responseSha256,
      originalFetchedAt: receipt.fetchedAt, importStartedAt: new Date().toISOString() };
    const handle = await open(importPath, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(manifest, null, 2)); await handle.sync(); } finally { await handle.close(); }
    const directory = await open(folder, 'r'); try { await directory.sync(); } finally { await directory.close(); }
  }
  assert.equal(manifest.originalOperationId, original.id); assert.equal(manifest.responseSha256, receipt.responseSha256);
  assert.equal(manifest.originalFetchedAt, receipt.fetchedAt);
  let existing = await store.get(manifest.id);
  if (existing) {
    assert.equal(existing.action, 'collect'); assert.equal(existing.createdBy, original.createdBy);
    assert.equal(existing.localImport?.responseSha256, manifest.responseSha256);
    assert.equal(existing.localImport?.originalOperationId, original.id);
    assert(['pending', 'completed'].includes(existing.status), 'Terminal failed/unknown import requires explicit review.');
  }
  if (existing?.status !== 'completed') {
    const pool = await store.getPool();
    assert.equal(pool.version, '0'); assert.equal(pool.batchId, null); assert.equal(pool.cursor, 0); assert.deepEqual(pool.values, []);
    if (!existing) {
      const claim = await store.claim({ id: manifest.id, action: 'collect', status: 'pending', createdAt: original.createdAt,
        createdBy: original.createdBy, localImport: { ...manifest } });
      assert.equal(claim.inserted, true);
    }
    if (pool.collectId !== manifest.id) assert.equal(await store.startCollection(manifest.id), true);
    existing = await store.completeCollection(manifest.id, values, receipt.fetchedAt);
    assert.equal(existing?.status, 'completed');
  }
  const pool = await store.getPool();
  const completionPath = path.join(folder, 'import-completed.json');
  try {
    const file = await open(completionPath, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify({ id: manifest.id, importCompletedAt: new Date().toISOString(), responseSha256: receipt.responseSha256 })); await file.sync(); } finally { await file.close(); }
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
  console.log(JSON.stringify({ offlineImport: true, externalRequests: 0, originalOperationId: original.id, batchId: existing.batchId,
    fetchedAt: existing.fetchedAt, remaining: pool.values.length - pool.cursor, responseSha256: receipt.responseSha256 }, null, 2));
} finally { await db.close(); }
