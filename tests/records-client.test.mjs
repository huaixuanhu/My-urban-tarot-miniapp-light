import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureRecord, createSaveAttempt, createRecordsClient } from '../client/src/reading-record-data.mjs';
import { createReading, reduceReading } from '../client/src/reading-state.mjs';

const recordId = '6f0ef515-3475-4cb2-a58a-602496dc6455';
const startedAt = '2026-10-28T01:00:00.000Z';
function completedSpread() {
  const reversed = Array(78).fill(false); reversed[1] = true;
  let state = createReading({ reversed });
  // Drawing out of physical-ID order checks that capture preserves draw order.
  for (const card of [{ id: 1, x: -2, z: -1.2 }, { id: 0, x: 1.5, z: -.3 }]) {
    state = reduceReading(state, { type: 'draw', ...card });
    state = reduceReading(state, { type: 'reveal', id: card.id });
  }
  return state;
}
function capture(state = completedSpread(), extra = {}) {
  return captureRecord(state, { id: recordId, startedAt, question: '一个合成测试问题', interpretation: '我的测试解读', reflection: '之后回看', labels: { 1: '当下', 0: '可能性' }, ...extra });
}

test('record capture copies original identities, drawing order, orientation, positions and human text independently', () => {
  const state = completedSpread(), labels = { 1: '当下', 0: '可能性' };
  const snapshot = capture(state, { labels });
  assert.deepEqual(snapshot.cards.map(card => ({
    physicalId: card.physicalId, sourceCardId: card.sourceCardId, reversed: card.reversed,
    x: card.x, z: card.z, drawOrder: card.drawOrder, positionLabel: card.positionLabel,
  })), [
    { physicalId: 1, sourceCardId: 'major-01', reversed: true, x: -2, z: -1.2, drawOrder: 1, positionLabel: '当下' },
    { physicalId: 0, sourceCardId: 'major-00', reversed: false, x: 1.5, z: -.3, drawOrder: 2, positionLabel: '可能性' },
  ]);
  assert.equal(snapshot.interpretation, '我的测试解读');
  assert.equal(snapshot.reflection, '之后回看');
  assert.ok(snapshot.cards.every(card => card.faceUp === true && !Object.hasOwn(card, 'sourceSnapshot')));
  const frozen = structuredClone(snapshot);
  state.placed[1].x = 4; state.reversed[1] = false; labels[1] = '后改的文字';
  assert.deepEqual(snapshot, frozen);
});

test('empty and partially revealed spreads cannot silently enter saved history', () => {
  assert.throws(() => capture(createReading()), /请先翻开/);
  const state = reduceReading(completedSpread(), { type: 'draw', id: 2, x: 3, z: 0 });
  assert.throws(() => capture(state), /请先翻开/);
});

test('uncertain retry reuses the frozen snapshot even when the live table gains a hidden card', () => {
  const attempt = createSaveAttempt(), original = capture();
  const firstRequest = attempt.prepare(original);
  original.question = '这个编辑不能改变正在确认的保存';
  firstRequest.cards[0].x = 99;
  const changedTable = reduceReading(completedSpread(), { type: 'draw', id: 2, x: 3, z: 0 });
  let captures = 0;
  const retry = attempt.snapshot() || attempt.prepare((() => { captures++; return capture(changedTable); })());
  assert.equal(captures, 0);
  assert.equal(retry.id, recordId);
  assert.equal(retry.question, '一个合成测试问题');
  assert.equal(retry.cards[0].x, -2);
  assert.equal(retry.cards.length, 2);
  retry.cards[0].positionLabel = '外部修改';
  assert.equal(attempt.snapshot().cards[0].positionLabel, '当下');
  attempt.complete();
  assert.equal(attempt.pending, false);
  assert.equal(attempt.snapshot(), null);
});

test('successful save sends the captured payload through the same-origin no-cache JSON endpoint', async () => {
  const payload = capture(), requests = [];
  const client = createRecordsClient(async (url, options) => {
    requests.push({ url, options });
    return Response.json({ record: { ...payload, savedAt: startedAt }, duplicate: false }, { status: 201 });
  });
  const receipt = await client.save(payload);
  assert.equal(receipt.record.id, recordId);
  assert.equal(requests[0].url, '/api/records');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(requests[0].options.body), payload);
});

test('unconfigured storage is a definite rejection while a generic storage failure remains uncertain', async () => {
  for (const [code, definite] of [['RECORDS_NOT_CONFIGURED', true], ['STORAGE_UNAVAILABLE', false]]) {
    const client = createRecordsClient(async () => Response.json({ error: { code, message: '合成服务错误' } }, { status: 503 }));
    await assert.rejects(client.save(capture()), error => {
      assert.equal(error.definite, definite);
      assert.equal(error.message, '合成服务错误');
      return true;
    });
  }
});

test('explicit input and authentication rejections can be corrected without claiming a cloud save', async () => {
  for (const status of [400, 403, 409, 413, 415]) {
    const client = createRecordsClient(async () => Response.json({ error: { code: 'REJECTED', message: '请求未接受' } }, { status }));
    await assert.rejects(client.save(capture()), error => error.definite === true && error.message === '请求未接受');
  }
});

test('lost network response does not discard or replace the save attempt payload', async () => {
  const attempt = createSaveAttempt(), payload = attempt.prepare(capture());
  const client = createRecordsClient(async () => { throw new TypeError('synthetic network interruption'); });
  await assert.rejects(client.save(payload), error => {
    assert.notEqual(error.definite, true);
    assert.match(error.message, /无法确认云端状态/);
    assert.doesNotMatch(error.message, /synthetic/);
    return true;
  });
  assert.equal(attempt.pending, true);
  assert.deepEqual(attempt.snapshot(), payload);
});

test('HTML login or SPA fallback is never reported as saved and leaves the pending snapshot recoverable', async () => {
  const attempt = createSaveAttempt(), payload = attempt.prepare(capture());
  const client = createRecordsClient(async () => new Response('<html>synthetic login page</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(client.save(payload), error => {
    assert.notEqual(error.definite, true);
    assert.match(error.message, /登录已过期/);
    assert.doesNotMatch(error.message, /<html>|synthetic/);
    return true;
  });
  assert.deepEqual(attempt.snapshot(), payload);
});

test('history pagination passes opaque cursors without treating them as query syntax', async () => {
  const requested = [], client = createRecordsClient(async url => {
    requested.push(url); return Response.json({ records: [], nextCursor: null });
  });
  await client.list('opaque+cursor&limit=99');
  await client.get(recordId);
  assert.equal(requested[0], '/api/records?limit=20&cursor=opaque%2Bcursor%26limit%3D99');
  assert.equal(requested[1], `/api/records?id=${recordId}`);
});
