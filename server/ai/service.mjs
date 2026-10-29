import { createHash } from 'node:crypto';
import { decodeJwt } from 'jose';
import { buildStoredRecord, normalizeRecordId, RecordValidationError } from '../../shared/record-schema.mjs';
import { AI_BODY_LIMIT, AIValidationError, normalizeAIInput, validateAIAnswer } from '../../shared/ai-schema.mjs';
import { AI_MAX_INPUT_TOKENS } from '../../shared/ai-options.mjs';
import { AI_PROMPT_VERSION, buildProviderPayload } from './prompt.mjs';
import { AIProviderError } from './provider.mjs';

export class AIStorageNotConfigured extends Error {}
export class AIStorageUnavailable extends Error {}
const PENDING_EXPIRY_MS = 180000;
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const problem = (code, message, status, extra) => json({ error: { code, message } }, status, extra);
const fingerprint = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');

/** Explicit allowlist prevents accidentally publishing private provider/identity metadata. */
export function publicInterpretation(attempt, now = new Date()) {
  const { id, reading, model, effort, maxOutputTokens, createdAt, promptVersion } = attempt;
  const result = { id, status: attempt.status, reading, model, effort, maxOutputTokens, createdAt, promptVersion };
  for (const key of ['completedAt', 'answer', 'usage', 'message', 'inputTokens', 'returnedModel']) if (attempt[key] !== undefined) result[key] = attempt[key];
  // A crashed invocation never becomes permission to run it again. A late
  // terminal write may still be discovered by a later read of the same ID.
  if (result.status === 'pending' && now.valueOf() - new Date(createdAt).valueOf() > PENDING_EXPIRY_MS) {
    result.status = 'unknown'; result.message = '这次调用的结果尚未确认，可以再次查询；系统不会自动重新解读。';
  }
  // The source snapshot belongs with the answer, but verified subject is not
  // needed in the interpretation view or its eventual shared-record attachment.
  result.reading = structuredClone(reading); delete result.reading.createdBy; delete result.reading.randomness;
  return result;
}

async function parseBody(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > AI_BODY_LIMIT)) throw new AIValidationError('请求内容过多，请缩短问题后再试。');
  if (!request.body) throw new AIValidationError('请填写问题并选择牌阵。');
  const reader = request.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > AI_BODY_LIMIT) { await reader.cancel(); throw new AIValidationError('请求内容过多，请缩短问题后再试。'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AIValidationError('请求内容格式不正确。'); }
}

function usageFrom(response, cap) {
  const usage = response?.usage;
  if (!usage || !['input_tokens', 'output_tokens', 'total_tokens'].every(key => Number.isSafeInteger(usage[key]) && usage[key] >= 0) || usage.input_tokens > AI_MAX_INPUT_TOKENS || usage.output_tokens > cap || usage.total_tokens !== usage.input_tokens + usage.output_tokens) throw new AIValidationError('AI 用量信息未通过验证。');
  const detail = (value, ceiling) => {
    if (value === undefined) return null;
    if (!Number.isSafeInteger(value) || value < 0 || value > ceiling) throw new AIValidationError('AI 用量明细未通过验证。');
    return value;
  };
  return {
    inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, totalTokens: usage.total_tokens,
    reasoningTokens: detail(usage.output_tokens_details?.reasoning_tokens, usage.output_tokens),
    cachedInputTokens: detail(usage.input_tokens_details?.cached_tokens, usage.input_tokens),
    cacheWriteTokens: detail(usage.input_tokens_details?.cache_write_tokens, usage.input_tokens),
  };
}

function terminalFromResponse(attempt, response, completedAt) {
  const result = { ...attempt, completedAt };
  if (!response || (response.model !== attempt.model && !String(response.model || '').startsWith(`${attempt.model}-`))) throw new AIValidationError('返回的模型与选择不一致。');
  result.returnedModel = response.model;
  if (response.usage) result.usage = usageFrom(response, attempt.maxOutputTokens);
  if (response.status === 'incomplete') return { ...result, status: 'incomplete', message: '本次回答未完成，可能已达到生成预算。没有自动续写或再次收费。' };
  if (response.status !== 'completed') return { ...result, status: 'unknown', message: '服务未返回完整结果，请查询这次调用的状态。' };
  if (!Array.isArray(response.output)) throw new AIValidationError('AI 返回内容不完整。');
  const parts = response.output.filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content : []);
  if (parts.some(part => part.type === 'refusal')) return { ...result, status: 'failed', message: '模型未提供这次解读。可以调整问题后由你决定是否重新发起。' };
  const content = parts.filter(part => part.type === 'output_text').map(part => part.text);
  if (!content.length || content.some(text => typeof text !== 'string')) throw new AIValidationError('AI 返回内容不完整。');
  let answer;
  try { answer = JSON.parse(content.join('')); } catch { throw new AIValidationError('AI 返回格式未通过验证。'); }
  result.answer = validateAIAnswer(answer, attempt.reading);
  result.usage = usageFrom(response, attempt.maxOutputTokens);
  result.status = 'completed';
  return result;
}

/** Durable claim precedes all provider calls; every read/replay is generation-free. */
export function createInterpretationsHandler({ accessGuard, getStore, getProvider, now = () => new Date(), onError = () => {} }) {
  return async request => {
    let subject;
    try {
      const guarded = await accessGuard(request);
      if (guarded.headers.get('x-middleware-next') !== '1') return problem('ACCESS_REQUIRED', '请从正式入口登录后使用 AI 解读。', guarded.status === 404 ? 404 : 403);
      subject = decodeJwt(request.headers.get('cf-access-jwt-assertion') ?? '').sub;
      if (typeof subject !== 'string' || !subject.trim() || subject.length > 255) throw new Error();
    } catch { return problem('ACCESS_REQUIRED', '请重新登录后使用 AI 解读。', 403); }
    if (!['GET', 'POST'].includes(request.method)) return problem('METHOD_NOT_ALLOWED', '不支持这个操作。', 405, { Allow: 'GET, POST' });
    const url = new URL(request.url);
    try {
      if (request.method === 'GET') {
        if ([...url.searchParams.keys()].join(',') !== 'id') throw new AIValidationError('解读查询格式不正确。');
        const id = normalizeRecordId(url.searchParams.get('id'));
        const store = await getStore(), attempt = await store.get(id);
        if (!attempt) return problem('NOT_FOUND', '没有找到这次解读。', 404);
        const view = publicInterpretation(attempt, now());
        return json({ interpretation: view }, view.status === 'pending' ? 202 : 200);
      }
      if (request.headers.get('origin') !== url.origin) return problem('ORIGIN_MISMATCH', '请在应用内发起解读。', 403);
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return problem('CONTENT_TYPE_REQUIRED', '请使用应用内的解读操作。', 415);
      if ([...url.searchParams].length) throw new AIValidationError('解读地址不正确。');
      const input = normalizeAIInput(await parseBody(request)), hash = fingerprint(input);
      const store = await getStore();
      const existing = await store.get(input.id);
      if (existing) {
        if (existing.requestHash !== hash) return problem('AI_CONFLICT', '这个调用编号已用于其他内容，请读取原结果。', 409);
        const view = publicInterpretation(existing, now()); return json({ interpretation: view }, view.status === 'pending' ? 202 : 200);
      }
      const provider = await getProvider();
      const createdAt = now().toISOString();
      const attempt = {
        id: input.id, status: 'pending', createdAt, createdBy: subject, promptVersion: AI_PROMPT_VERSION, requestHash: hash,
        reading: buildStoredRecord(input.reading, { savedAt: createdAt, createdBy: subject }),
        model: input.model, effort: input.effort, maxOutputTokens: input.maxOutputTokens,
      };
      const claimed = await store.claim(attempt, hash);
      if (claimed.hash !== hash) return problem('AI_CONFLICT', '这个调用编号已用于其他内容，请读取原结果。', 409);
      if (!claimed.inserted) {
        const view = publicInterpretation(claimed.attempt, now()); return json({ interpretation: view }, view.status === 'pending' ? 202 : 200);
      }
      let terminal, providerResponse, generationStarted = false;
      try {
        const payload = buildProviderPayload(attempt);
        const inputTokens = await provider.count(payload);
        if (!Number.isSafeInteger(inputTokens) || inputTokens < 1 || inputTokens > AI_MAX_INPUT_TOKENS) {
          terminal = { ...attempt, status: 'failed', completedAt: now().toISOString(), message: '问题和牌阵内容超过本次输入限制，尚未发起解读。请减少内容后重新提交。' };
        } else {
          attempt.inputTokens = inputTokens;
          generationStarted = true;
          providerResponse = await provider.generate(payload);
          terminal = terminalFromResponse(attempt, providerResponse, now().toISOString());
        }
      } catch (error) {
        const confirmedRejection = error instanceof AIProviderError && error.kind === 'rejected';
        const invalidOutput = error instanceof AIValidationError || (error instanceof AIProviderError && error.kind === 'invalid_response');
        terminal = { ...attempt, completedAt: now().toISOString(), status: generationStarted && !confirmedRejection && !invalidOutput ? 'unknown' : 'failed',
          message: !generationStarted ? '解读前的准备未完成，尚未发起生成。可以稍后重新提交。' : confirmedRejection ? 'AI 服务未接受这次请求，请稍后再试。' : invalidOutput ? '模型返回的内容未通过完整性检查，未作为有效解读保存；本次可能已产生费用。' : '这次调用的结果尚未确认，可能已产生费用。系统不会自动再次解读。' };
        // A malformed answer may still have verified token usage. Preserve that
        // accounting without publishing or accepting the malformed answer.
        if (providerResponse?.usage) {
          try { terminal.usage = usageFrom(providerResponse, attempt.maxOutputTokens); } catch { /* Unverifiable usage remains absent. */ }
        }
        onError(!generationStarted ? 'AI_PREFLIGHT_FAILED' : invalidOutput ? 'AI_INVALID_OUTPUT' : confirmedRejection ? 'AI_PROVIDER_REJECTED' : 'AI_PROVIDER_UNKNOWN');
      }
      const persisted = await store.finish(input.id, terminal);
      return json({ interpretation: publicInterpretation(persisted, now()) }, persisted.status === 'completed' ? 201 : 200);
    } catch (error) {
      if (error instanceof AIValidationError || error instanceof RecordValidationError) return problem('INVALID_AI_REQUEST', error.message, 400);
      if (error instanceof AIStorageNotConfigured || (error instanceof AIProviderError && error.kind === 'not_configured')) return problem('AI_NOT_CONFIGURED', 'AI 解读尚未接通，这次没有调用。', 503);
      onError('AI_STORAGE_UNCERTAIN');
      return problem('AI_STORAGE_UNCERTAIN', '暂时无法确认这次解读的保存状态。请保留当前内容并查询原调用，勿重复发起。', 503);
    }
  };
}
