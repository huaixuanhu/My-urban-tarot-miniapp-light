import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAIRequestState, createInterpretationsClient } from '../client/src/reading-ai-data.mjs';

const firstId = '6f0ef515-3475-4cb2-a58a-602496dc6455';
const nextId = '6f0ef515-3475-4cb2-a58a-602496dc6456';
function payload(id = firstId) {
  return { id, model: 'gpt-6.1-terra', effort: 'low', maxOutputTokens: 3000, reading: {
    schemaVersion: 1, id, startedAt: '2026-10-29T01:00:00.000Z', question: '一个虚构的问题', interpretation: '', reflection: '',
    spread: { type: 'free', name: '自由摆牌' },
    cards: [{ physicalId: 1, sourceCardId: 'major-01', reversed: true, faceUp: true, drawOrder: 1, zIndex: 1, x: 0, z: 0, positionLabel: '当下' }],
  } };
}
function receipt(input, status = 'completed') {
  return { interpretation: { ...structuredClone(input), status, createdAt: '2026-10-29T01:00:01.000Z',
    ...(status === 'completed' ? { answer: { summary: '围绕这个问题的整体观察。', cards: [{ sourceCardId: 'major-01', reversed: true, positionLabel: '当下', basis: 'generated_reversal_extension', interpretation: '这是明确标记的逆位延伸。' }], reflectionQuestions: ['你愿意先关注什么？'], limitations: ['逆位为延伸解释。'] } } : {}),
  } };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('transport is idle until explicit invocation and sends only the selected request', async () => {
  const requests = [], input = payload(), client = createInterpretationsClient(async (url, options) => {
    requests.push({ url, options }); return Response.json(receipt(input), { status: 201 });
  });
  assert.equal(requests.length, 0);
  await client.generate(input);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/interpretations');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(requests[0].options.body), input);
  await client.get('opaque&id=else');
  assert.equal(requests[1].url, '/api/interpretations?id=opaque%26id%3Delse');
  assert.equal(requests[1].options.method, 'GET');
  assert.equal(requests[1].options.body, undefined);
});

test('transport preserves uncertainty for lost response and HTML login without retries', async () => {
  for (const fetcher of [async () => { throw new TypeError('private diagnostic'); }, async () => new Response('<html>login</html>')]) {
    let calls = 0;
    const client = createInterpretationsClient((...args) => { calls++; return fetcher(...args); });
    await assert.rejects(client.generate(payload()), error => {
      assert.notEqual(error.definite, true); assert.doesNotMatch(error.message, /private diagnostic|<html>/); return true;
    });
    assert.equal(calls, 1);
  }
});

test('only structured pre-generation rejection establishes a definite transport failure', async () => {
  for (const status of [400, 401, 403, 404, 405, 409, 413, 415]) {
    const client = createInterpretationsClient(async () => Response.json({ error: { code: 'REJECTED', message: '请求未接受' } }, { status }));
    await assert.rejects(client.generate(payload()), error => error.definite === true && error.status === status);
  }
  for (const [status, body, definite] of [[503, { error: { code: 'AI_NOT_CONFIGURED', message: '未配置' } }, true], [503, { error: { code: 'UNAVAILABLE' } }, false], [403, { unrelated: 'proxy body' }, false]]) {
    const client = createInterpretationsClient(async () => Response.json(body, { status }));
    await assert.rejects(client.generate(payload()), error => error.definite === definite);
  }
});

test('state freezes input and exposes copies; closing or observing never makes a call', async () => {
  const wait = deferred(), input = payload(), changes = []; let calls = 0, sent;
  const state = createAIRequestState({ client: { generate: async value => { calls++; sent = value; return wait.promise; } }, onChange: value => changes.push(value) });
  assert.equal(state.snapshot().status, 'idle'); assert.equal(calls, 0);
  const operation = state.generate(input);
  input.reading.question = '后来的编辑'; sent.reading.cards[0].x = 99;
  const leaked = state.snapshot(); leaked.payload.reading.question = '外部篡改';
  assert.equal(state.snapshot().payload.reading.question, '一个虚构的问题');
  assert.equal(state.snapshot().payload.reading.cards[0].x, 0);
  assert.equal(state.inFlight, true); assert.equal(state.unresolved, true); assert.equal(state.reset(), false);
  await assert.rejects(state.generate(payload(nextId)), /先确认/);
  await assert.rejects(state.recover(), /还在进行/);
  assert.equal(calls, 1);
  wait.resolve(receipt(payload())); await operation;
  assert.equal(state.snapshot().status, 'completed'); assert.equal(state.unresolved, false);
  assert.equal(changes[0].status, 'submitting'); assert.equal(changes.at(-1).status, 'completed');
  assert.equal(state.reset(), true); assert.equal(state.snapshot().payload, null); assert.equal(calls, 1);
});

test('uncertain generation can only recover by GET until its original receipt resolves', async () => {
  let posts = 0, gets = 0;
  const input = payload(), state = createAIRequestState({ client: {
    generate: async () => { posts++; throw new Error('网络中断'); },
    get: async id => { gets++; assert.equal(id, firstId); return receipt(input); },
  } });
  await state.generate(input);
  assert.equal(state.snapshot().status, 'unknown'); assert.equal(state.unresolved, true);
  await assert.rejects(state.generate(payload(nextId)), /先确认/);
  await state.recover();
  assert.equal(posts, 1); assert.equal(gets, 1); assert.equal(state.snapshot().status, 'completed');
});

test('pending and server unknown remain unresolved without automatic polling', async () => {
  for (const status of ['pending', 'unknown']) {
    let calls = 0;
    const input = payload(), state = createAIRequestState({ client: { generate: async () => { calls++; return receipt(input, status); } } });
    await state.generate(input);
    assert.equal(state.snapshot().status, status); assert.equal(state.unresolved, true); assert.equal(state.inFlight, false);
    assert.equal(state.reset(), false); assert.equal(calls, 1);
    await assert.rejects(state.generate(payload(nextId)), /先确认/);
    assert.equal(calls, 1);
  }
});

test('incomplete and failed are terminal outcomes, never silently promoted or regenerated', async () => {
  for (const status of ['incomplete', 'failed']) {
    let calls = 0;
    const state = createAIRequestState({ client: { generate: async input => { calls++; return receipt(input, status); } } });
    await state.generate(payload());
    assert.equal(state.snapshot().status, status); assert.equal(state.snapshot().interpretation.answer, undefined);
    assert.equal(state.unresolved, false); assert.equal(calls, 1);
    await assert.rejects(state.generate(payload()), /编号已经使用/);
    await state.generate(payload(nextId)); assert.equal(calls, 2);
  }
});

test('verified not-configured rejection allows a new explicit attempt and preserves draft', async () => {
  const error = Object.assign(new Error('本地尚未配置'), { definite: true, status: 503, code: 'AI_NOT_CONFIGURED' });
  const state = createAIRequestState({ client: { generate: async () => { throw error; } } });
  await state.generate(payload());
  assert.equal(state.snapshot().status, 'failed'); assert.equal(state.unresolved, false);
  assert.equal(state.snapshot().payload.reading.question, '一个虚构的问题');
});

test('auth rejection and missing-ID recovery never prove a delayed original POST failed', async () => {
  let status = 403;
  const state = createAIRequestState({ client: {
    generate: async () => { throw new Error('lost response'); },
    get: async () => { throw Object.assign(new Error('查询失败'), { definite: true, status }); },
  } });
  await state.generate(payload()); await state.recover();
  assert.equal(state.snapshot().status, 'unknown'); assert.equal(state.unresolved, true);
  status = 404; await state.recover();
  assert.equal(state.snapshot().status, 'unknown'); assert.equal(state.unresolved, true);
});

test('receipt must match immutable identity, settings and semantic reading', async () => {
  const mutate = [
    value => { value.id = nextId; }, value => { value.model = 'gpt-6.1-sol'; },
    value => { value.effort = 'high'; }, value => { value.maxOutputTokens = 12000; },
    value => { value.reading.question = '不同问题'; }, value => { value.reading.cards[0].x = 2; },
    value => { value.reading.cards[0].reversed = false; }, value => { value.reading.cards[0].positionLabel = '不同牌位'; },
  ];
  for (const change of mutate) {
    const input = payload(), response = receipt(input); change(response.interpretation);
    const state = createAIRequestState({ client: { generate: async () => response } });
    await state.generate(input);
    assert.equal(state.snapshot().status, 'unknown'); assert.equal(state.snapshot().interpretation, null); assert.equal(state.unresolved, true);
  }
});

test('receipt ignores selection-only stacking changes but checks completed answer card facts', async () => {
  const input = payload(), response = receipt(input); response.interpretation.reading.cards[0].zIndex = 9;
  const good = createAIRequestState({ client: { generate: async () => response } });
  await good.generate(input); assert.equal(good.snapshot().status, 'completed');
  for (const mutate of [answer => { answer.cards[0].reversed = false; }, answer => { answer.cards[0].sourceCardId = 'major-02'; }, answer => { answer.summary = ''; }, answer => { answer.cards = []; }]) {
    const broken = receipt(input); mutate(broken.interpretation.answer);
    const state = createAIRequestState({ client: { generate: async () => broken } });
    await state.generate(input); assert.equal(state.snapshot().status, 'unknown');
  }
});

test('disposing ignores late results and callbacks without pretending network cancellation', async () => {
  const wait = deferred(), input = payload(), changes = [];
  const state = createAIRequestState({ client: { generate: async () => wait.promise }, onChange: value => changes.push(value) });
  const operation = state.generate(input); assert.equal(changes.length, 1);
  state.dispose(); wait.resolve(receipt(input)); await operation;
  assert.equal(changes.length, 1); assert.equal(state.snapshot().status, 'submitting');
  await assert.rejects(state.generate(payload(nextId)), /页面已关闭/);
});
