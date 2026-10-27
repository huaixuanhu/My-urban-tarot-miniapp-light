import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessConfig } from '../access/config.ts';
import { createAccessGuard } from '../access/guard.ts';
import { normalizeRecordInput, buildStoredRecord, RECORD_BODY_LIMIT } from '../shared/record-schema.mjs';
import { createRecordsHandler, RecordStorageUnavailable, RecordStorageNotConfigured } from '../server/records/service.mjs';

let privateKey, accessGuard;
before(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  const publicKey = await exportJWK(keys.publicKey);
  accessGuard = createAccessGuard(createLocalJWKSet({ keys: [{ ...publicKey, kid: 'records-test', alg: 'RS256' }] }));
});
const host = `https://${accessConfig.hostname}`;
const savedAt = '2026-10-28T01:02:03.000Z';
function input(overrides = {}) {
  return {
    schemaVersion: 1, id: randomUUID(), startedAt: '2026-10-28T01:00:00.000Z',
    question: '怎样看待这次选择？', interpretation: '我注意到开始与选择。', reflection: '留一点时间再回看。',
    spread: { type: 'free', name: '自由摆牌' },
    cards: [
      { physicalId: 0, sourceCardId: 'major-00', faceUp: true, reversed: false, x: -2, z: -0.7, drawOrder: 1, zIndex: 2, positionLabel: '当下' },
      { physicalId: 1, sourceCardId: 'major-01', faceUp: true, reversed: true, x: 0, z: -0.7, drawOrder: 2, zIndex: 3, positionLabel: '' },
    ], ...overrides,
  };
}
async function token(subject = 'synthetic-user-a', overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: accessConfig.issuer, aud: accessConfig.audience, sub: subject,
    email: 'synthetic@example.test', type: 'app', iat: now, exp: now + 3600, ...overrides,
  }).setProtectedHeader({ alg: 'RS256', kid: 'records-test' }).sign(privateKey);
}
async function request({ method = 'GET', query = '', body, subject, jwt, origin = host, headers = {}, hostname = host } = {}) {
  return new Request(`${hostname}/api/records${query}`, {
    method,
    headers: {
      'cf-access-jwt-assertion': jwt ?? await token(subject),
      ...(method === 'POST' ? { origin, 'content-type': 'application/json' } : {}), ...headers,
    }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}
function memoryStore() {
  const entries = new Map();
  return {
    entries,
    async create(record, hash) {
      const found = entries.get(record.id);
      if (found) return { ...structuredClone(found), inserted: false };
      const entry = { record: structuredClone(record), hash };
      entries.set(record.id, entry);
      return { ...structuredClone(entry), inserted: true };
    },
    async get(id) { return structuredClone(entries.get(id)?.record ?? null); },
    async list({ limit, cursor }) {
      return [...entries.values()].map(entry => structuredClone(entry.record))
        .filter(record => !cursor || record.savedAt < cursor.savedAt || (record.savedAt === cursor.savedAt && record.id < cursor.id))
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id)).slice(0, limit);
    },
  };
}
function fixture(options = {}) {
  const store = memoryStore();
  let calls = 0;
  const handler = createRecordsHandler({ accessGuard, getStore: async () => { calls += 1; return store; }, now: () => new Date(savedAt), ...options });
  return { store, handler, calls: () => calls };
}

test('shared cloud contract preserves physical arrangement and separates original content from human interpretation', async () => {
  const { handler } = fixture(), payload = input();
  const response = await handler(await request({ method: 'POST', body: payload }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const { record, duplicate } = await response.json();
  assert.equal(duplicate, false);
  assert.equal(record.createdBy, 'synthetic-user-a');
  assert.equal(record.savedAt, savedAt);
  assert.equal(record.interpretation, payload.interpretation);
  assert.equal(record.cards[0].sourceSnapshot.name, 'The Fool');
  assert.notEqual(record.cards[0].sourceSnapshot.interpretation, payload.interpretation);
  assert.equal(record.cards[1].reversed, true);
  assert.equal(record.cards[1].sourceSnapshot.reversedInterpretation, null);
  assert.deepEqual(record.cards.map(({ x, z, drawOrder, zIndex }) => ({ x, z, drawOrder, zIndex })), payload.cards.map(({ x, z, drawOrder, zIndex }) => ({ x, z, drawOrder, zIndex })));
});

test('second authorized subject sees the same records without person filtering', async () => {
  const { handler } = fixture(), payload = input();
  await handler(await request({ method: 'POST', body: payload }));
  const list = await handler(await request({ subject: 'synthetic-user-b' }));
  assert.equal((await list.json()).records[0].id, payload.id);
  const detail = await handler(await request({ query: `?id=${payload.id}`, subject: 'synthetic-user-b' }));
  assert.equal((await detail.json()).record.createdBy, 'synthetic-user-a');
});

test('stable ID retry returns the original saved record even after the network response was lost', async () => {
  const { handler, store } = fixture(), payload = input();
  const first = await (await handler(await request({ method: 'POST', body: payload }))).json();
  const response = await handler(await request({ method: 'POST', body: payload, subject: 'synthetic-user-b' }));
  assert.equal(response.status, 200);
  const retry = await response.json();
  assert.equal(retry.duplicate, true);
  assert.deepEqual(retry.record, first.record);
  assert.equal(store.entries.size, 1);
});

test('same ID with different content conflicts without changing the first snapshot', async () => {
  const { handler, store } = fixture(), payload = input();
  await handler(await request({ method: 'POST', body: payload }));
  const conflict = await handler(await request({ method: 'POST', body: { ...payload, interpretation: 'different' } }));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.code, 'RECORD_CONFLICT');
  assert.equal(store.entries.get(payload.id).record.interpretation, payload.interpretation);
});

test('concurrent duplicate service calls have one creation and one retry receipt', async () => {
  const { handler, store } = fixture(), payload = input();
  const requests = await Promise.all([request({ method: 'POST', body: payload }), request({ method: 'POST', body: payload })]);
  const responses = await Promise.all(requests.map(handler));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
  assert.equal(store.entries.size, 1);
});

test('invalid, expired and identity-only authentication never reaches storage', async () => {
  const { handler, calls } = fixture();
  for (const jwt of ['', 'fake', await token('synthetic-user-a', { exp: 1 }), await token('synthetic-user-a', { aud: 'wrong' })]) {
    assert.equal((await handler(await request({ jwt }))).status, 403);
  }
  assert.equal((await handler(new Request(`${host}/api/records`, { headers: { 'cf-access-authenticated-user-email': 'synthetic@example.test' } }))).status, 403);
  assert.equal((await handler(await request({ hostname: 'https://another.vercel.app' }))).status, 403);
  assert.equal(calls(), 0);
});

test('cross-origin and non-JSON writes reject before storage', async () => {
  const { handler, calls } = fixture(), body = input();
  assert.equal((await handler(await request({ method: 'POST', body, origin: 'https://other.example.test' }))).status, 403);
  assert.equal((await handler(await request({ method: 'POST', body, origin: '' }))).status, 403);
  assert.equal((await handler(await request({ method: 'POST', body, headers: { 'content-type': 'text/plain' } }))).status, 415);
  assert.equal(calls(), 0);
});

test('client cannot forge author, time, deck metadata or original card interpretation', () => {
  for (const extra of [{ createdBy: 'forged' }, { savedAt }, { deck: { id: 'other' } }]) assert.throws(() => normalizeRecordInput(input(extra)));
  const payload = input(); payload.cards[0].sourceSnapshot = { interpretation: 'invented' };
  assert.throws(() => normalizeRecordInput(payload));
});

for (const [name, mutate] of [
  ['hidden card', value => { value.cards[0].faceUp = false; }],
  ['wrong source ID', value => { value.cards[0].sourceCardId = 'major-01'; }],
  ['unknown physical ID', value => { value.cards[0].physicalId = 78; }],
  ['duplicate physical card', value => { value.cards[1] = { ...value.cards[0], drawOrder: 2, zIndex: 3 }; }],
  ['duplicate draw order', value => { value.cards[1].drawOrder = 1; }],
  ['duplicate stacking order', value => { value.cards[1].zIndex = 2; }],
  ['outside position', value => { value.cards[0].x = 50; }],
  ['nonfinite position', value => { value.cards[0].z = NaN; }],
  ['invalid reversal', value => { value.cards[0].reversed = 'false'; }],
  ['excessive question', value => { value.question = 'x'.repeat(1501); }],
  ['excessive interpretation', value => { value.interpretation = 'x'.repeat(8001); }],
  ['excessive reflection', value => { value.reflection = 'x'.repeat(8001); }],
  ['excessive position label', value => { value.cards[0].positionLabel = 'x'.repeat(81); }],
  ['invalid date', value => { value.startedAt = '2026-02-31T01:00:00.000Z'; }],
  ['unknown version', value => { value.schemaVersion = 2; }],
  ['empty spread', value => { value.cards = []; }],
]) test(`record schema rejects ${name}`, () => {
  const payload = input(); mutate(payload);
  assert.throws(() => normalizeRecordInput(payload));
});

test('validation and actual body size limits run before storage', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(await request({ method: 'POST', body: '{broken' }))).status, 400);
  assert.equal((await handler(await request({ method: 'POST', body: 'x'.repeat(RECORD_BODY_LIMIT + 1) }))).status, 413);
  assert.equal((await handler(await request({ method: 'POST', body: input(), headers: { 'content-length': String(RECORD_BODY_LIMIT + 1) } }))).status, 413);
  assert.equal(calls(), 0);
});

test('canonical ordering makes an equivalent shuffled card array a safe retry', async () => {
  const { handler } = fixture(), payload = input();
  await handler(await request({ method: 'POST', body: payload }));
  const response = await handler(await request({ method: 'POST', body: { ...payload, cards: [...payload.cards].reverse() } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
});

test('database failure reports an uncertain result without success or secret leakage', async () => {
  for (const error of [new RecordStorageUnavailable(), new Error('password=do-not-leak')]) {
    const logged = [], { handler } = fixture({ getStore: async () => { throw error; }, onError: code => logged.push(code) });
    const response = await handler(await request({ method: 'POST', body: input() }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const text = await response.text();
    assert.ok(!text.includes('do-not-leak'));
    assert.ok(!JSON.stringify(logged).includes('do-not-leak'));
    assert.equal(JSON.parse(text).error.code, 'STORAGE_UNAVAILABLE');
  }
});

test('missing configuration is distinguished as a definitive no-write result', async () => {
  const logged = [], { handler, store } = fixture({
    getStore: async () => { throw new RecordStorageNotConfigured(); },
    onError: code => logged.push(code),
  });
  const response = await handler(await request({ method: 'POST', body: input() }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).error.code, 'RECORDS_NOT_CONFIGURED');
  assert.equal(store.entries.size, 0);
  assert.deepEqual(logged, ['RECORDS_NOT_CONFIGURED']);
});

test('paged shared summaries have stable cursors at equal timestamps and complete detail remains unchanged', async () => {
  const { handler } = fixture(), ids = [];
  for (let i = 0; i < 5; i += 1) {
    const payload = input(); ids.push(payload.id);
    await handler(await request({ method: 'POST', body: payload }));
  }
  let cursor = null, found = [];
  do {
    const page = await (await handler(await request({ query: `?limit=2${cursor ? `&cursor=${cursor}` : ''}` }))).json();
    found.push(...page.records.map(record => record.id));
    assert.ok(page.records.every(record => !Object.hasOwn(record, 'interpretation')));
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(found, ids.sort().reverse());
  assert.equal(new Set(found).size, 5);
});

test('unsupported methods, unknown IDs and malformed queries return explicit no-store responses', async () => {
  const { handler } = fixture();
  const unsupported = await handler(await request({ method: 'DELETE' }));
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.get('allow'), 'GET, POST');
  assert.equal((await handler(await request({ query: `?id=${randomUUID()}` }))).status, 404);
  for (const query of ['?id=bad', '?limit=0', '?limit=51', '?limit=2&limit=3', '?cursor=bad', '?owner=someone']) {
    const response = await handler(await request({ query }));
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('stored record cannot be built with unverified author data', () => {
  assert.throws(() => buildStoredRecord(input(), { savedAt, createdBy: '' }));
});
