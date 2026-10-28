import { createHash } from 'node:crypto';
import { decodeJwt } from 'jose';
import { buildStoredRecord, normalizeRecordId, normalizeRecordInput, RECORD_BODY_LIMIT, RecordValidationError, summarizeRecord } from '../../shared/record-schema.mjs';
import { aiReadingSignature } from '../../shared/ai-options.mjs';
import { publicInterpretation } from '../ai/service.mjs';

export class RecordStorageUnavailable extends Error {}
export class RecordStorageNotConfigured extends Error {}
export class RecordConflict extends Error {}

function json(value, status = 200, extraHeaders = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders } });
}
function problem(code, message, status, headers) { return json({ error: { code, message } }, status, headers); }
function fingerprint(input) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }

function encodeCursor(record) {
  return Buffer.from(JSON.stringify([record.savedAt, record.id])).toString('base64url');
}
function decodeCursor(value) {
  if (value === null) return null;
  if (!value || value.length > 200 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new RecordValidationError('记录页码不正确。');
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed[0]) || new Date(parsed[0]).toISOString() !== parsed[0]) throw new Error();
    return { savedAt: parsed[0], id: normalizeRecordId(parsed[1]) };
  } catch { throw new RecordValidationError('记录页码不正确。'); }
}

async function boundedJson(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > RECORD_BODY_LIMIT)) return { response: problem('BODY_TOO_LARGE', '这份记录内容过多，请缩短文字后重试。', 413) };
  if (!request.body) throw new RecordValidationError('记录内容为空。');
  const reader = request.body.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > RECORD_BODY_LIMIT) {
        await reader.cancel();
        return { response: problem('BODY_TOO_LARGE', '这份记录内容过多，请缩短文字后重试。', 413) };
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; }
  catch { throw new RecordValidationError('记录内容格式不正确。'); }
}

/** Inject storage for tests; the production entry only supplies a durable store. */
export function createRecordsHandler({ accessGuard, getStore, now = () => new Date(), onError = () => {} }) {
  return async function records(request) {
    // Reuse the exact page/asset policy. A decoded identity is consumed only after
    // the existing guard has verified the token's signature and all claims.
    let subject;
    try {
      const guarded = await accessGuard(request);
      if (guarded.headers.get('x-middleware-next') !== '1') return problem('ACCESS_REQUIRED', '请从正式入口登录后使用占卜记录。', guarded.status === 404 ? 404 : 403);
      subject = decodeJwt(request.headers.get('cf-access-jwt-assertion') ?? '').sub;
      if (typeof subject !== 'string' || !subject.trim() || subject.length > 255) return problem('ACCESS_REQUIRED', '请重新登录后使用占卜记录。', 403);
    } catch { return problem('ACCESS_REQUIRED', '请重新登录后使用占卜记录。', 403); }

    if (!['GET', 'POST'].includes(request.method)) return problem('METHOD_NOT_ALLOWED', '暂不支持这个操作。', 405, { Allow: 'GET, POST' });
    const url = new URL(request.url);
    try {
      if (request.method === 'POST') {
        if (request.headers.get('origin') !== url.origin) return problem('ORIGIN_MISMATCH', '请在应用内保存记录。', 403);
        if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return problem('CONTENT_TYPE_REQUIRED', '请用应用内的保存操作。', 415);
        if ([...url.searchParams].length) throw new RecordValidationError('保存地址不正确。');
        const parsed = await boundedJson(request);
        if (parsed.response) return parsed.response;
        const input = normalizeRecordInput(parsed.value), hash = fingerprint(input);
        const store = await getStore();
        const record = buildStoredRecord(input, { savedAt: now().toISOString(), createdBy: subject });
        if (input.aiInterpretationIds?.length) {
          if (typeof store.getAIInterpretations !== 'function') throw new RecordStorageUnavailable();
          const found = await store.getAIInterpretations(input.aiInterpretationIds);
          const signature = aiReadingSignature(input);
          record.aiInterpretations = input.aiInterpretationIds.map(id => {
            const result = found.find(item => item.id === id);
            if (!result || result.status !== 'completed' || !result.answer || aiReadingSignature(result.reading) !== signature) throw new RecordValidationError('AI 解读与这次问题或牌阵不一致，请取消附带旧结果或重新解读。');
            return publicInterpretation(result, now());
          });
        }
        const result = await store.create(record, hash);
        if (result.hash !== hash) throw new RecordConflict();
        return json({ record: result.record, duplicate: !result.inserted }, result.inserted ? 201 : 200);
      }
      const names = [...url.searchParams.keys()];
      if (names.some(name => !['id', 'limit', 'cursor'].includes(name)) || new Set(names).size !== names.length) throw new RecordValidationError('记录查询格式不正确。');
      if (url.searchParams.has('id')) {
        if (names.length !== 1) throw new RecordValidationError('记录查询格式不正确。');
        const id = normalizeRecordId(url.searchParams.get('id'));
        const store = await getStore(), record = await store.get(id);
        return record ? json({ record }) : problem('NOT_FOUND', '没有找到这条记录。', 404);
      }
      const value = url.searchParams.get('limit') ?? '20';
      if (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > 50) throw new RecordValidationError('每页记录数量不正确。');
      const limit = Number(value), cursor = decodeCursor(url.searchParams.get('cursor'));
      const store = await getStore(), found = await store.list({ limit: limit + 1, cursor });
      const page = found.slice(0, limit);
      return json({ records: page.map(summarizeRecord), nextCursor: found.length > limit ? encodeCursor(page.at(-1)) : null });
    } catch (error) {
      if (error instanceof RecordValidationError) return problem('INVALID_RECORD', error.message, 400);
      if (error instanceof RecordConflict) return problem('RECORD_CONFLICT', '这个编号已经保存了不同内容，请重新读取记录或另存一条。', 409);
      // Log a stable code only: database errors may contain connection strings
      // or user text, neither belongs in application logs.
      if (error instanceof RecordStorageNotConfigured) {
        onError('RECORDS_NOT_CONFIGURED');
        return problem('RECORDS_NOT_CONFIGURED', '云端记录尚未接通，这次没有提交。你可以继续修改内容。', 503);
      }
      onError('RECORDS_STORAGE_FAILURE');
      return problem('STORAGE_UNAVAILABLE', '云端记录暂时不可用，内容尚未确认保存。请保留当前内容并稍后重试。', 503);
    }
  };
}
