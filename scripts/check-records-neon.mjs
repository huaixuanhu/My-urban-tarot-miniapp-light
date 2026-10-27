/**
 * Explicit local service + real Neon integration check. No DDL or provisioning.
 * Run with: pnpm exec tsx scripts/check-records-neon.mjs --confirm-dedicated-validation-database
 * Required server-only environment variables:
 *   AUGURWELL_RECORDS_TEST_DATABASE_URL
 *   AUGURWELL_RECORDS_TEST_EXPECTED_HOST (exact hostname obtained from the dedicated project)
 * The records table must exist and be empty. This never opens a production-auth
 * bypass: synthetic signing keys are injected only into this local test process.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessConfig } from '../access/config.ts';
import { createAccessGuard } from '../access/guard.ts';
import { normalizeRecordInput } from '../shared/record-schema.mjs';
import { createRecordsHandler } from '../server/records/service.mjs';
import { createNeonRecordStore } from '../server/records/neon-store.mjs';

class SafeFailure extends Error {}
function fail(message) { throw new SafeFailure(message); }

let sql, manifestPath, manifest, writesAttempted = false, baselineVerified = false;
let interrupted = false, cleanupConfirmed = false, failure = null;
const signal = () => { interrupted = true; };
process.once('SIGINT', signal);
process.once('SIGTERM', signal);

async function saveManifest() {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
}

try {
  if (process.argv.length !== 3 || process.argv[2] !== '--confirm-dedicated-validation-database') {
    fail('Opt in with --confirm-dedicated-validation-database. No database request was made.');
  }
  const connection = process.env.AUGURWELL_RECORDS_TEST_DATABASE_URL;
  const expectedHost = process.env.AUGURWELL_RECORDS_TEST_EXPECTED_HOST;
  if (!connection || !expectedHost) fail('Both dedicated test database variables are required. No database request was made.');
  let address;
  try { address = new URL(connection); } catch { fail('The dedicated test connection is not a valid URL.'); }
  if (!['postgres:', 'postgresql:'].includes(address.protocol) ||
      !/^[a-z0-9.-]+\.neon\.tech$/.test(expectedHost) || address.hostname !== expectedHost ||
      !address.username || !address.password || address.pathname.length < 2) {
    fail('The connection must match the exact expected Neon hostname and include database credentials.');
  }

  // Import only after explicit target validation. No connection value is printed
  // or written to the recovery manifest, including on driver failures.
  const { neon } = await import('@neondatabase/serverless');
  sql = neon(connection);
  const schema = await sql`SELECT current_schema() AS schema_name, to_regclass('public.augurwell_records')::text AS table_name`;
  if (schema[0]?.schema_name !== 'public' || schema[0]?.table_name !== 'augurwell_records') {
    fail('Pre-create the records schema in the dedicated database. This check never applies DDL.');
  }
  const before = await sql`SELECT count(*)::int AS count FROM public.augurwell_records`;
  if (before[0]?.count !== 0) fail('The validation table is not empty. No synthetic records were written.');
  baselineVerified = true;

  const runId = randomUUID(), savedAt = new Date().toISOString();
  const subjects = [`records-validation:${runId}:a`, `records-validation:${runId}:b`];
  const fixtures = Array.from({ length: 5 }, () => normalizeRecordInput({
    schemaVersion: 1, id: randomUUID(), startedAt: savedAt,
    question: `Synthetic records validation ${runId}`,
    interpretation: 'Synthetic interpretation; no personal content.', reflection: 'Synthetic reflection.',
    spread: { type: 'free', name: 'Synthetic validation' },
    cards: [
      { physicalId: 0, sourceCardId: 'major-00', faceUp: true, reversed: false, x: -2, z: -0.7, drawOrder: 1, zIndex: 2, positionLabel: 'Synthetic first' },
      { physicalId: 1, sourceCardId: 'major-01', faceUp: true, reversed: true, x: 0, z: -0.7, drawOrder: 2, zIndex: 3, positionLabel: 'Synthetic second' },
    ],
  }));
  const expectedRows = fixtures.map(record => ({
    id: record.id, request_hash: createHash('sha256').update(JSON.stringify(record)).digest('hex'),
  }));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = path.join(root, '.local');
  await mkdir(directory, { recursive: true });
  manifestPath = path.join(directory, `records-neon-validation-${runId}.json`);
  manifest = {
    purpose: 'Synthetic Augurwell records validation recovery; contains no credentials.',
    runId, expectedHost, createdAt: savedAt, baselineCount: 0, subjects, expectedRows,
    cleanupConfirmed: false,
  };
  await saveManifest();

  const keys = await generateKeyPair('RS256');
  const publicKey = await exportJWK(keys.publicKey);
  const guard = createAccessGuard(createLocalJWKSet({ keys: [{ ...publicKey, kid: runId, alg: 'RS256' }] }));
  const store = await createNeonRecordStore(connection);
  let storageCalls = 0;
  const handler = createRecordsHandler({
    accessGuard: guard,
    getStore: async () => { storageCalls += 1; return store; },
    now: () => new Date(savedAt),
  });
  const origin = `https://${accessConfig.hostname}`;
  const jwt = async subject => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      iss: accessConfig.issuer, aud: accessConfig.audience, sub: subject,
      email: 'synthetic@example.test', type: 'app', iat: now, exp: now + 3600,
    }).setProtectedHeader({ alg: 'RS256', kid: runId }).sign(keys.privateKey);
  };
  const tokens = await Promise.all(subjects.map(jwt));
  async function call({ method = 'GET', body, query = '', person = 0 } = {}) {
    if (interrupted) fail('Validation interrupted; cleanup will be attempted.');
    if (method === 'POST') writesAttempted = true;
    const response = await handler(new Request(`${origin}/api/records${query}`, {
      method,
      headers: {
        'cf-access-jwt-assertion': tokens[person],
        ...(method === 'POST' ? { origin, 'content-type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    return { status: response.status, data: await response.json() };
  }
  async function check(name, action) {
    if (interrupted) fail('Validation interrupted; cleanup will be attempted.');
    await action();
    console.log(`PASS: ${name}`);
  }

  let original;
  await check('real database creates one structured snapshot with server-owned original meanings', async () => {
    const result = await call({ method: 'POST', body: fixtures[0] });
    assert.equal(result.status, 201);
    original = result.data.record;
    assert.equal(original.createdBy, subjects[0]);
    assert.equal(original.cards[0].sourceSnapshot.name, 'The Fool');
    assert.equal(original.cards[1].reversed, true);
    assert.equal(original.savedAt, savedAt);
  });
  await check('second synthetic identity sees the same shared list and full detail', async () => {
    const list = await call({ person: 1 });
    assert.equal(list.status, 200);
    assert.equal(list.data.records.length, 1);
    assert.equal(list.data.records[0].id, fixtures[0].id);
    const detail = await call({ person: 1, query: `?id=${fixtures[0].id}` });
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.data.record, original);
  });
  await check('same-ID retry returns the original receipt and changed content conflicts', async () => {
    const retry = await call({ method: 'POST', body: fixtures[0], person: 1 });
    assert.equal(retry.status, 200);
    assert.equal(retry.data.duplicate, true);
    assert.deepEqual(retry.data.record, original);
    const conflict = await call({ method: 'POST', body: { ...fixtures[0], reflection: 'Different synthetic reflection' } });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.error.code, 'RECORD_CONFLICT');
  });
  await check('concurrent same-ID writes have one creation and one duplicate receipt', async () => {
    const responses = await Promise.all([0, 1].map(person => call({ method: 'POST', body: fixtures[1], person })));
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
    assert.deepEqual(responses[0].data.record, responses[1].data.record);
  });
  await check('cursor pages include each record exactly once at equal timestamps', async () => {
    for (const body of fixtures.slice(2)) assert.equal((await call({ method: 'POST', body })).status, 201);
    let cursor = null;
    const found = [];
    for (let page = 0; page < 4; page += 1) {
      const result = await call({ query: `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}` });
      assert.equal(result.status, 200);
      found.push(...result.data.records.map(record => record.id));
      cursor = result.data.nextCursor;
      if (!cursor) break;
    }
    assert.equal(cursor, null);
    assert.deepEqual(found, fixtures.map(record => record.id).sort().reverse());
  });
  await check('a fresh adapter reads the persisted snapshot', async () => {
    const secondStore = await createNeonRecordStore(connection);
    assert.deepEqual(await secondStore.get(fixtures[0].id), original);
  });
  await check('anonymous request is rejected before storage access', async () => {
    const beforeCalls = storageCalls;
    const response = await handler(new Request(`${origin}/api/records`));
    assert.equal(response.status, 403);
    assert.equal(storageCalls, beforeCalls);
  });
} catch (error) {
  failure = error;
} finally {
  if (baselineVerified && writesAttempted && manifest) {
    try {
      // Exact UUID/hash pairs and run-specific authors are the only cleanup
      // targets. Unexpected or concurrently added rows are never deleted.
      await sql`
        DELETE FROM public.augurwell_records AS records
        USING jsonb_to_recordset(${JSON.stringify(manifest.expectedRows)}::jsonb) AS expected(id uuid, request_hash text)
        WHERE records.id = expected.id
          AND records.request_hash = expected.request_hash
          AND records.created_by = ANY(${manifest.subjects}::text[])
      `;
      const remaining = await sql`SELECT count(*)::int AS count FROM public.augurwell_records`;
      if (remaining[0]?.count !== manifest.baselineCount) throw new SafeFailure('Record count did not return to the empty baseline; unexpected records were preserved.');
      cleanupConfirmed = true;
      console.log('PASS: exact synthetic records removed and empty baseline restored');
    } catch {
      failure ??= new SafeFailure('Cleanup could not be confirmed. Use the local recovery manifest; do not repeat broad cleanup.');
    }
  } else if (manifest) {
    cleanupConfirmed = true; // A manifest was prepared, but no write was attempted.
  }
  if (manifestPath) {
    if (cleanupConfirmed) await rm(manifestPath, { force: true });
    else {
      manifest.cleanupConfirmed = false;
      await saveManifest();
      console.error(`Recovery manifest: ${manifestPath}`);
    }
  }
  process.removeListener('SIGINT', signal);
  process.removeListener('SIGTERM', signal);
}

if (failure) {
  console.error(failure instanceof SafeFailure ? `FAIL: ${failure.message}` : 'FAIL: real-Neon validation did not complete. Connection details and raw errors are intentionally omitted.');
  process.exitCode = 1;
} else {
  console.log('PASS: local service with real Neon storage validated; hosted Cloudflare login remains a separate check.');
}
