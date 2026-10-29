import { decodeJwt } from 'jose';
import { normalizeRecordId, RecordValidationError } from '../../shared/record-schema.mjs';
import { generateDeck, RandomDataExhausted } from '../../shared/randomness.mjs';
import { RandomProviderError, validBatch } from './provider.mjs';
export class RandomStorageNotConfigured extends Error {}
export const COLLECTION_LEASE_MS = 60000;
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const problem = (code, message, status, extra) => json({ error: { code, message } }, status, extra);
export function poolMetadata(pool, now = new Date()) {
  return { batchId: pool.batchId, fetchedAt: pool.fetchedAt, total: pool.values.length, remaining: pool.values.length - pool.cursor,
    collecting: !!pool.collectId && now.valueOf() - Date.parse(pool.collectStarted) < COLLECTION_LEASE_MS };
}
export function publicOperation(operation, now = new Date()) {
  const result = { id: operation.id, action: operation.action, status: operation.status, terminal: operation.status !== 'pending', createdAt: operation.createdAt };
  for (const key of ['completedAt', 'message', 'deck', 'batchId', 'fetchedAt']) if (operation[key] !== undefined) result[key] = structuredClone(operation[key]);
  if (result.status === 'pending' && now.valueOf() - Date.parse(result.createdAt) >= COLLECTION_LEASE_MS) {
    result.status = 'unknown'; result.message = '这次操作尚未确认，请查询原操作。不会自动重新采集或扣除库存。';
  }
  return result;
}
async function readInput(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 512)) throw new RecordValidationError('随机请求过大。');
  if (!request.body) throw new RecordValidationError('随机请求为空。');
  const reader = request.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 512) { await reader.cancel(); throw new RecordValidationError('随机请求过大。'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RecordValidationError('随机请求格式不正确。'); }
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).sort().join(',') !== 'action,id' || !['collect', 'draw'].includes(input.action)) throw new RecordValidationError('随机操作不正确。');
  return { id: normalizeRecordId(input.id), action: input.action };
}
/** Pending operation ownership is durable: HTTP retries and GETs never re-run work. */
export function createRandomHandler({ accessGuard, getStore, getProvider, now = () => new Date(), onError = () => {} }) {
  return async request => {
    let subject;
    try {
      const guarded = await accessGuard(request);
      if (guarded.headers.get('x-middleware-next') !== '1') return problem('ACCESS_REQUIRED', '请从正式入口登录后使用共享量子数据。', guarded.status === 404 ? 404 : 403);
      subject = decodeJwt(request.headers.get('cf-access-jwt-assertion') ?? '').sub;
      if (typeof subject !== 'string' || !subject.trim() || subject.length > 255) throw new Error();
    } catch { return problem('ACCESS_REQUIRED', '请重新登录后使用共享量子数据。', 403); }
    if (!['GET', 'POST'].includes(request.method)) return problem('METHOD_NOT_ALLOWED', '不支持这个操作。', 405, { Allow: 'GET, POST' });
    const url = new URL(request.url);
    try {
      const keys = [...url.searchParams.keys()];
      const reconcile = async (store, operation) => {
        if (operation?.status === 'pending' && now().valueOf() - Date.parse(operation.createdAt) >= COLLECTION_LEASE_MS) {
          // Fence before exposing a terminal result. A late owner can no longer
          // publish a collection or deduct inventory. No provider call occurs.
          return store.fail(operation.id, 'unknown', '这次操作已超时并停止继续写入；可能已消耗采集次数，可手动开始新操作。', now().toISOString());
        }
        return operation;
      };
      if (request.method === 'GET') {
        if (keys.length && (keys.length !== 1 || keys[0] !== 'id')) throw new RecordValidationError('查询地址不正确。');
        const id = keys.length ? normalizeRecordId(url.searchParams.get('id')) : null;
        const store = await getStore();
        if (!id) return json({ pool: poolMetadata(await store.getPool(), now()) });
        const operation = await reconcile(store, await store.get(id));
        if (!operation) return problem('NOT_FOUND', '尚未找到这个操作；不要自动重复提交。', 404);
        const view = publicOperation(operation, now());
        return json({ operation: view, pool: poolMetadata(await store.getPool(), now()) }, ['pending', 'unknown'].includes(view.status) ? 202 : 200);
      }
      if (request.headers.get('origin') !== url.origin) return problem('ORIGIN_MISMATCH', '请在应用内操作共享量子数据。', 403);
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return problem('CONTENT_TYPE_REQUIRED', '请使用应用内的随机来源面板。', 415);
      if (keys.length) throw new RecordValidationError('操作地址不正确。');
      const input = await readInput(request), store = await getStore();
      const reply = async (operation, fresh = false) => {
        const view = publicOperation(operation, now());
        return json({ operation: view, pool: poolMetadata(await store.getPool(), now()) }, ['pending', 'unknown'].includes(view.status) ? 202 : fresh && view.status === 'completed' ? 201 : 200);
      };
      const existing = await store.get(input.id);
      if (existing) {
        if (existing.action !== input.action || existing.createdBy !== subject) return problem('RANDOM_CONFLICT', '这个操作编号已被使用，请查询原操作。', 409);
        return reply(await reconcile(store, existing));
      }
      // Detect absent credentials before claiming an operation or changing the pool.
      const provider = input.action === 'collect' ? await getProvider() : null;
      const claimed = await store.claim({ ...input, status: 'pending', createdAt: now().toISOString(), createdBy: subject });
      if (!claimed.inserted) {
        if (claimed.operation.action !== input.action || claimed.operation.createdBy !== subject) return problem('RANDOM_CONFLICT', '这个操作编号已被使用，请查询原操作。', 409);
        return reply(await reconcile(store, claimed.operation));
      }
      const fail = (status, message) => store.fail(input.id, status, message, now().toISOString());
      if (input.action === 'collect') {
        if (!await store.startCollection(input.id, now().toISOString())) return reply(await fail('failed', '共享数据正在采集或请求间隔过短，请稍后手动再试。'));
        let values;
        try {
          values = await provider.collect();
          if (!validBatch(values)) throw new RandomProviderError('invalid_response');
        } catch (error) {
          const unknown = !(error instanceof RandomProviderError) || error.kind === 'unknown';
          onError(unknown ? 'RANDOM_PROVIDER_UNKNOWN' : 'RANDOM_PROVIDER_FAILED');
          return reply(await fail(unknown ? 'unknown' : 'failed', unknown ? '采集结果尚未确认，旧库存已保留；系统不会自动重试。' : 'ANU 未返回有效数据，请检查额度或稍后再试。旧库存已保留。'));
        }
        const completed = await store.completeCollection(input.id, values, now().toISOString());
        if (!completed) return reply(await fail('unknown', '这次采集已被更新的操作取代，没有覆盖新库存。'));
        return reply(completed, true);
      }
      // CAS failures mean another authorised operation won; recompute solely from
      // its new cursor. Never return a candidate before the atomic commit succeeds.
      for (let retry = 0; retry < 8; retry++) {
        const pool = await store.getPool();
        let generated;
        try { generated = generateDeck(pool.values, pool.cursor); }
        catch (error) {
          if (error instanceof RandomDataExhausted) return reply(await fail('failed', '量子数据不足以再洗一副牌，请先手动采集。当前牌桌没有改变。'));
          throw error;
        }
        const deck = { order: generated.order, reversed: generated.reversed,
          randomness: { source: 'anu', requestId: input.id, batchId: pool.batchId, fetchedAt: pool.fetchedAt, consumed: generated.consumed } };
        const committed = await store.commitDraw(input.id, pool.version, generated.consumed, deck, now().toISOString());
        if (committed) return reply(committed, true);
      }
      return reply(await fail('failed', '共享库存正在变化，请稍后手动再试。当前牌桌没有改变。'));
    } catch (error) {
      if (error instanceof RecordValidationError) return problem('INVALID_RANDOM_REQUEST', error.message, 400);
      if (error instanceof RandomStorageNotConfigured || (error instanceof RandomProviderError && error.kind === 'not_configured')) return problem('RANDOM_NOT_CONFIGURED', '共享量子数据尚未接通，这次没有采集或洗牌。', 503);
      onError('RANDOM_STORAGE_UNCERTAIN');
      return problem('RANDOM_STORAGE_UNCERTAIN', '暂时无法确认操作结果，请查询原操作，勿重复发起。', 503);
    }
  };
}
