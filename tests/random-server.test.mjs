import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRandomHandler, RandomStorageNotConfigured, publicOperation } from '../server/random/service.mjs';
import { createMemoryRandomStore } from '../server/random/memory-store.mjs';
import { createANUProvider, RandomProviderError } from '../server/random/provider.mjs';
const origin = 'https://augurwell.anoriaquant.dev';
const batch = () => Array(1024).fill(0);
const jwt = subject => `e30.${Buffer.from(JSON.stringify({ sub: subject })).toString('base64url')}.signature`;
function fixture(overrides = {}) {
  const store = overrides.store ?? createMemoryRandomStore();
  let clock = Date.parse('2026-10-29T00:00:00Z'), calls = 0;
  const errors = [];
  const handler = createRandomHandler({
    accessGuard: async () => new Response(null, { headers: { 'x-middleware-next': '1' } }),
    getStore: async () => store,
    getProvider: async () => ({ collect: async () => { calls++; return batch(); } }),
    now: () => new Date(clock), onError: code => errors.push(code), ...overrides,
  });
  const request = async (body, options = {}) => {
    const response = await handler(new Request(`${origin}/api/random${options.query ?? ''}`, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers: { 'cf-access-jwt-assertion': jwt(options.subject ?? 'one'), origin, 'content-type': 'application/json', ...options.headers },
      ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  return { store, request, errors, calls: () => calls, advance: milliseconds => { clock += milliseconds; } };
}
const input = action => ({ action, id: randomUUID() });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('empty shared pool, one collection, exact metadata allowlist and privacy headers', async () => {
  const f = fixture();
  assert.deepEqual((await f.request()).body.pool, { batchId: null, fetchedAt: null, total: 0, remaining: 0, collecting: false });
  const request = input('collect'), response = await f.request(request);
  assert.equal(response.status, 201); assert.equal(response.body.pool.remaining, 1024); assert.equal(f.calls(), 1);
  assert.equal(response.body.operation.batchId, request.id);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(JSON.stringify(response.body).includes('createdBy'), false);
  assert.equal(JSON.stringify(response.body).includes('values'), false);
});

test('one full draw is fixed and its replay does not spend more words', async () => {
  const f = fixture(), collect = input('collect'), draw = input('draw');
  await f.request(collect); const response = await f.request(draw);
  const deck = response.body.operation.deck;
  assert.equal(response.status, 201); assert.equal(new Set(deck.order).size, 78); assert.equal(deck.reversed.length, 78);
  assert.deepEqual(deck.randomness, { source: 'anu', requestId: draw.id, batchId: collect.id, fetchedAt: '2026-10-29T00:00:00.000Z', consumed: 155 });
  assert.equal(response.body.pool.remaining, 869);
  const replay = await f.request(draw);
  assert.deepEqual(replay.body.operation.deck, deck); assert.equal(replay.body.pool.remaining, 869); assert.equal(f.calls(), 1);
  const read = await f.request(null, { query: `?id=${draw.id}` }); assert.deepEqual(read.body.operation.deck, deck);
});

test('concurrent draw operations allocate disjoint slices and only six fit', async () => {
  const f = fixture(); await f.request(input('collect'));
  const outcomes = await Promise.all(Array.from({ length: 8 }, (_, i) => f.request(input('draw'), { subject: i % 2 ? 'two' : 'one' })));
  const completed = outcomes.filter(result => result.body.operation.status === 'completed');
  assert.equal(completed.length, 6);
  assert.equal(new Set(completed.map(result => result.body.operation.id)).size, 6);
  assert.equal((await f.store.getPool()).cursor, 930);
  assert.equal((await f.request()).body.pool.remaining, 94);
  assert.equal(f.calls(), 1);
});

test('simultaneous same-ID draws commit once', async () => {
  const f = fixture(); await f.request(input('collect')); const draw = input('draw');
  await Promise.all([f.request(draw), f.request(draw), f.request(draw)]);
  assert.equal((await f.store.getPool()).cursor, 155);
  assert.equal((await f.request(null, { query: `?id=${draw.id}` })).body.operation.status, 'completed');
});

test('concurrent collection is shared, duplicate request is pending, no second provider call', async () => {
  const enter = deferred(), finish = deferred(); let calls = 0;
  const f = fixture({ getProvider: async () => ({ collect: async () => { calls++; enter.resolve(); return finish.promise; } }) });
  const first = input('collect'), pending = f.request(first); await enter.promise;
  assert.equal((await f.request()).body.pool.collecting, true);
  assert.equal((await f.request(first)).status, 202);
  const competitor = await f.request(input('collect'), { subject: 'two' });
  assert.equal(competitor.body.operation.status, 'failed'); assert.equal(calls, 1);
  finish.resolve(batch()); await pending;
  assert.equal((await f.request(first)).body.operation.status, 'completed'); assert.equal(calls, 1);
});

test('new collection replaces remainder only on success; failed collection preserves batch', async () => {
  let broken = false;
  const f = fixture({ getProvider: async () => ({ collect: async () => { if (broken) throw new RandomProviderError('rejected'); return batch(); } }) });
  const first = input('collect'); await f.request(first); await f.request(input('draw')); f.advance(1500);
  broken = true; assert.equal((await f.request(input('collect'))).body.operation.status, 'failed');
  assert.equal((await f.request()).body.pool.batchId, first.id); assert.equal((await f.request()).body.pool.remaining, 869);
  broken = false; f.advance(1500); const next = input('collect'); await f.request(next);
  assert.equal((await f.request()).body.pool.batchId, next.id); assert.equal((await f.request()).body.pool.remaining, 1024);
});

test('1 second provider interval enforced across different operation IDs', async () => {
  const f = fixture(); await f.request(input('collect'));
  assert.equal((await f.request(input('collect'))).body.operation.status, 'failed'); assert.equal(f.calls(), 1);
  f.advance(1000); assert.equal((await f.request(input('collect'))).status, 201); assert.equal(f.calls(), 2);
});

test('stale collection lease is fenced: late old result cannot replace newer batch', async () => {
  const finish = deferred(), enter = deferred(); let calls = 0;
  const f = fixture({ getProvider: async () => ({ collect: async () => { if (++calls === 1) { enter.resolve(); return finish.promise; } return batch(); } }) });
  const old = input('collect'), pending = f.request(old); await enter.promise;
  f.advance(61000); const next = input('collect'); await f.request(next);
  finish.resolve(Array(1024).fill(42)); const late = await pending;
  assert.equal(late.body.operation.status, 'unknown'); assert.equal((await f.request()).body.pool.batchId, next.id);
  assert.equal((await f.store.getPool()).values[0], 0);
});

test('pool replacement between calculation and CAS recomputes against new batch', async () => {
  const store = createMemoryRandomStore(); const originalCommit = store.commitDraw.bind(store); let intercepted = false;
  const f = fixture({ store }); const first = input('collect'); await f.request(first);
  const replacement = input('collect');
  store.commitDraw = async (...args) => {
    if (!intercepted) { intercepted = true; f.advance(2000); await f.request(replacement); }
    return originalCommit(...args);
  };
  const response = await f.request(input('draw'));
  assert.equal(response.body.operation.deck.randomness.batchId, replacement.id);
  assert.equal(response.body.pool.remaining, 869);
});

test('short inventory and rejection exhaustion consume nothing and never fetch', async () => {
  const f = fixture({ getProvider: async () => ({ collect: async () => Array(1024).fill(65535) }) });
  assert.equal((await f.request(input('draw'))).body.operation.status, 'failed');
  await f.request(input('collect'));
  const result = await f.request(input('draw'));
  assert.equal(result.body.operation.status, 'failed'); assert.equal(result.body.pool.remaining, 1024);
  assert.equal((await f.store.getPool()).cursor, 0);
});

test('lost completed draw response is recovered by GET with no second deduction', async () => {
  const store = createMemoryRandomStore(), original = store.commitDraw.bind(store);
  store.commitDraw = async (...args) => { await original(...args); throw new Error('transport lost'); };
  const f = fixture({ store }); await f.request(input('collect')); const draw = input('draw');
  assert.equal((await f.request(draw)).body.error.code, 'RANDOM_STORAGE_UNCERTAIN');
  const read = await f.request(null, { query: `?id=${draw.id}` });
  assert.equal(read.body.operation.status, 'completed'); assert.equal(read.body.pool.remaining, 869);
  assert.equal((await f.request(draw)).body.pool.remaining, 869);
});

test('unknown provider outcome remains unknown on POST replay and GET', async () => {
  let calls = 0; const f = fixture({ getProvider: async () => ({ collect: async () => { calls++; throw new Error('secret must never appear'); } }) });
  const collect = input('collect');
  for (const result of [await f.request(collect), await f.request(collect), await f.request(null, { query: `?id=${collect.id}` })]) {
    assert.equal(result.body.operation.status, 'unknown'); assert.equal(JSON.stringify(result.body).includes('secret must'), false);
  }
  assert.equal(calls, 1); assert.deepEqual(f.errors, ['RANDOM_PROVIDER_UNKNOWN']);
});

test('crashed pending operation ages to unknown without restarting provider', async () => {
  const f = fixture(), request = input('collect');
  await f.store.claim({ ...request, status: 'pending', createdAt: '2026-10-29T00:00:00Z', createdBy: 'one' }); f.advance(61000);
  assert.equal((await f.request(request)).body.operation.status, 'unknown'); assert.equal(f.calls(), 0);
});

test('identity and same-origin checks precede storage/provider access', async () => {
  let touches = 0;
  const f = fixture({ accessGuard: async () => new Response(null, { status: 403 }), getStore: async () => { touches++; throw new Error(); } });
  assert.equal((await f.request(input('collect'))).status, 403); assert.equal(touches, 0);
  const allowed = fixture({ getStore: async () => { touches++; throw new Error(); } });
  assert.equal((await allowed.request(input('collect'), { headers: { origin: 'https://elsewhere.invalid' } })).status, 403);
  assert.equal((await allowed.request(input('collect'), { headers: { 'cf-access-jwt-assertion': 'bad' } })).status, 403);
  assert.equal(touches, 0);
});

test('strict request shape, UUID, method and body limit', async () => {
  const f = fixture();
  for (const body of [{ ...input('collect'), extra: 1 }, { action: 'other', id: randomUUID() }, { action: 'draw', id: 'bad' }, '{', ' '.repeat(513)]) assert.equal((await f.request(body)).status, 400);
  assert.equal((await f.request(input('collect'), { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await f.request(null, { method: 'DELETE' })).status, 405);
  assert.equal((await f.request(null, { query: '?id=a&id=b' })).status, 400);
  assert.equal((await f.request(null, { query: '?other=1' })).status, 400);
  assert.equal(f.calls(), 0);
});

test('operation collision never changes action or owner', async () => {
  const f = fixture(), collect = input('collect'); await f.request(collect);
  assert.equal((await f.request({ ...collect, action: 'draw' })).status, 409);
  assert.equal((await f.request(collect, { subject: 'two' })).status, 409);
  assert.equal(f.calls(), 1);
});

test('missing database or key is explicit and does not claim an operation', async () => {
  const missing = fixture({ getStore: async () => { throw new RandomStorageNotConfigured(); } });
  assert.equal((await missing.request()).body.error.code, 'RANDOM_NOT_CONFIGURED');
  const f = fixture({ getProvider: async () => createANUProvider(undefined) }), collect = input('collect');
  assert.equal((await f.request(collect)).body.error.code, 'RANDOM_NOT_CONFIGURED'); assert.equal(await f.store.get(collect.id), null);
});

const validResponse = () => ({ success: true, type: 'uint16', length: 1024, data: batch() });
test('ANU fixed URL/header, no redirect or retry, validated exact uint16 batch', async () => {
  let calls = 0;
  const provider = createANUProvider('private-example', async (url, options) => {
    calls++; assert.equal(url, 'https://api.quantumnumbers.anu.edu.au?type=uint16&length=1024');
    assert.equal(options.headers['x-api-key'], 'private-example'); assert.equal(options.redirect, 'error');
    assert.equal(options.method, 'GET'); assert.equal(options.cache, 'no-store');
    return Response.json(validResponse());
  });
  assert.equal((await provider.collect()).length, 1024); assert.equal(calls, 1);
});

test('ANU rejects malformed, sparse, overflowing and unsuccessful data', async () => {
  const invalid = [null, {}, ...['01024', '1024 ', '1e3', true, [1024]].map(length => ({ ...validResponse(), length })), { ...validResponse(), success: false }, { ...validResponse(), type: 'uint8' }, { ...validResponse(), length: 1023 }, { ...validResponse(), data: [] }, { ...validResponse(), data: Array(1024).fill(65536) }, { ...validResponse(), data: Array(1024).fill(null) }];
  for (const data of invalid) await assert.rejects(createANUProvider('example', async () => Response.json(data)).collect(), error => error.kind === 'invalid_response');
  await assert.rejects(createANUProvider('example', async () => new Response('x'.repeat(32769))).collect(), error => error.kind === 'invalid_response');
});

test('ANU timeout/network and rejection never retry or echo provider errors', async () => {
  let calls = 0;
  await assert.rejects(createANUProvider('private', async () => { calls++; throw new Error('private'); }).collect(), error => error.kind === 'unknown' && !error.message.includes('private'));
  assert.equal(calls, 1);
  await assert.rejects(createANUProvider('private', async () => new Response('private', { status: 429 })).collect(), error => error.kind === 'rejected' && !error.message.includes('private'));
});

test('expired draw GET fences late commit before terminal recovery is published', async () => {
  const f = fixture(); await f.request(input('collect'));
  const draw = input('draw');
  await f.store.claim({ ...draw, status: 'pending', createdAt: '2026-10-29T00:00:00Z', createdBy: 'one' });
  const pool = await f.store.getPool(); f.advance(61000);
  const response = await f.request(null, { query: `?id=${draw.id}` });
  assert.equal(response.body.operation.terminal, true); assert.equal(response.body.operation.status, 'unknown');
  assert.match(response.body.operation.message, /洗牌/);
  assert.match(response.body.operation.message, /这次未扣除量子库存/);
  assert.doesNotMatch(response.body.operation.message, /采集次数|额度/);
  assert.equal(await f.store.commitDraw(draw.id, pool.version, 155, {}, new Date().toISOString()), null);
  assert.equal((await f.store.getPool()).cursor, 0);
  assert.equal((await f.request(input('draw'))).body.operation.status, 'completed');
});

test('expired collection GET fences late response and allows explicit new collection', async () => {
  const finish = deferred(), enter = deferred(); let calls = 0;
  const f = fixture({ getProvider: async () => ({ collect: async () => { if (++calls === 1) { enter.resolve(); return finish.promise; } return batch(); } }) });
  const old = input('collect'), pending = f.request(old); await enter.promise; f.advance(61000);
  const expired = await f.request(null, { query: `?id=${old.id}` });
  assert.equal(expired.body.operation.terminal, true); assert.equal(expired.body.pool.collecting, false);
  assert.match(expired.body.operation.message, /可能已消耗采集次数/);
  const fresh = input('collect'); assert.equal((await f.request(fresh)).status, 201);
  finish.resolve(Array(1024).fill(123)); await pending;
  assert.equal((await f.store.getPool()).batchId, fresh.id); assert.equal((await f.store.getPool()).values[0], 0);
});

test('expiry racing completion returns completed result from locked finalization', async () => {
  const store = createMemoryRandomStore(), originalFail = store.fail.bind(store);
  const f = fixture({ store }); await f.request(input('collect'));
  const draw = input('draw'); await store.claim({ ...draw, status: 'pending', createdAt: '2026-10-29T00:00:00Z', createdBy: 'one' });
  f.advance(61000); const pool = await store.getPool();
  store.fail = async (...args) => {
    await store.commitDraw(draw.id, pool.version, 155, { marker: 'won' }, '2026-10-29T00:00:59Z');
    return originalFail(...args);
  };
  const response = await f.request(null, { query: `?id=${draw.id}` });
  assert.equal(response.body.operation.status, 'completed'); assert.equal(response.body.operation.terminal, true);
  assert.equal(response.body.operation.deck.marker, 'won'); assert.equal(response.body.pool.remaining, 869);
});

test('unaccepted request lookup followed by explicit same-ID submit executes once', async () => {
  const f = fixture(), collect = input('collect');
  assert.equal((await f.request(null, { query: `?id=${collect.id}` })).status, 404); assert.equal(f.calls(), 0);
  const results = await Promise.all([f.request(collect), f.request(collect)]);
  assert.equal(f.calls(), 1);
  const recovered = await f.request(null, { query: `?id=${collect.id}` });
  assert.equal(recovered.body.operation.status, 'completed'); assert.equal(recovered.body.pool.remaining, 1024);
  assert.ok(results.every(result => [201, 202, 200].includes(result.status)));
});

test('lost collection commit response can be recovered without fetching another batch', async () => {
  const store = createMemoryRandomStore(), complete = store.completeCollection.bind(store);
  store.completeCollection = async (...args) => { await complete(...args); throw new Error('response lost'); };
  const f = fixture({ store }), collect = input('collect');
  assert.equal((await f.request(collect)).body.error.code, 'RANDOM_STORAGE_UNCERTAIN');
  const recovered = await f.request(null, { query: `?id=${collect.id}` });
  assert.equal(recovered.body.operation.status, 'completed'); assert.equal(recovered.body.operation.terminal, true);
  assert.equal(recovered.body.pool.batchId, collect.id); assert.equal(f.calls(), 1);
  await f.request(collect); assert.equal(f.calls(), 1);
});


test('missing required random tables or columns fail definitively before claim or provider access', async () => {
  for (const code of ['42P01', '42703']) for (const action of ['collect', 'draw']) for (const missing of ['get', 'getPool']) {
    const store = createMemoryRandomStore(), originalGet = store.get.bind(store);
    let claims = 0, providers = 0;
    store[missing] = async () => { throw Object.assign(new Error('private database details'), { code }); };
    store.claim = async () => { claims++; throw new Error('must not claim'); };
    const f = fixture({ store, getProvider: async () => { providers++; throw new Error('must not create provider'); } });
    const request = input(action), result = await f.request(request);
    assert.equal(result.status, 503); assert.equal(result.body.error.code, 'RANDOM_NOT_CONFIGURED');
    assert.equal(JSON.stringify(result.body).includes('private database details'), false);
    assert.equal(claims, 0); assert.equal(providers, 0); assert.equal(f.calls(), 0);
    assert.equal(await originalGet(request.id), null); assert.deepEqual(f.errors, []);
  }
});

test('read-only metadata and operation lookups classify missing tables without mutation', async () => {
  for (const query of ['', `?id=${randomUUID()}`]) {
    let writes = 0;
    const missing = async () => { throw Object.assign(new Error('private schema details'), { code: '42P01' }); };
    const f = fixture({ store: { get: missing, getPool: missing, claim: async () => { writes++; }, fail: async () => { writes++; } } });
    const result = await f.request(null, { query });
    assert.equal(result.status, 503); assert.equal(result.body.error.code, 'RANDOM_NOT_CONFIGURED');
    assert.equal(writes, 0); assert.equal(f.calls(), 0);
  }
});

test('non-schema read failures and schema failures after claim stay uncertain', async () => {
  for (const stage of ['read', 'claim', 'commit', 'reply']) {
    const store = createMemoryRandomStore();
    const f = fixture({ store });
    if (stage === 'read') store.get = async () => { throw Object.assign(new Error('network'), { code: '08006' }); };
    if (stage === 'claim') store.claim = async () => { throw Object.assign(new Error('schema changed'), { code: '42P01' }); };
    if (stage === 'commit') store.completeCollection = async () => { throw Object.assign(new Error('schema changed'), { code: '42P01' }); };
    if (stage === 'reply') {
      const originalGetPool = store.getPool.bind(store); let reads = 0;
      store.getPool = async () => { if (++reads === 2) throw Object.assign(new Error('schema changed'), { code: '42P01' }); return originalGetPool(); };
    }
    const result = await f.request(input('collect'));
    assert.equal(result.status, 503); assert.equal(result.body.error.code, 'RANDOM_STORAGE_UNCERTAIN');
    assert.equal(f.calls(), ['commit', 'reply'].includes(stage) ? 1 : 0);
  }
});

test('pending display distinguishes collection from draw without claiming a draw uses provider quota', () => {
  const createdAt = '2026-10-29T00:00:00.000Z', now = new Date('2026-10-29T00:01:01.000Z');
  const draw = publicOperation({ ...input('draw'), status: 'pending', createdAt }, now);
  const collect = publicOperation({ ...input('collect'), status: 'pending', createdAt }, now);
  assert.equal(draw.status, 'unknown'); assert.equal(draw.terminal, false);
  assert.match(draw.message, /洗牌/); assert.doesNotMatch(draw.message, /采集|额度/);
  assert.match(collect.message, /采集/); assert.equal(collect.terminal, false);
});


test('ANU live string length is accepted without weakening the exact 1024-word contract', async () => {
  let calls = 0;
  const provider = createANUProvider('offline-example', async () => { calls++; return Response.json({ ...validResponse(), length: '1024' }); });
  assert.equal((await provider.collect()).length, 1024);
  assert.equal(calls, 1);
  await assert.rejects(createANUProvider('offline-example', async () => Response.json({ ...validResponse(), length: '1024', data: batch().slice(1) })).collect(), { kind: 'invalid_response' });
});
