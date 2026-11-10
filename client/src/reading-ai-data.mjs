import { aiReadingSignature, AI_DETAILS, AI_FOCUSES } from '../../shared/ai-options.mjs';
import { normalizeSourceUrl } from '../../shared/ai-web.mjs';

const DEFINITE_REJECTIONS = new Set([400, 401, 403, 404, 405, 409, 413, 415]);
const STATUSES = new Set(['pending', 'completed', 'incomplete', 'failed', 'unknown']);
const copy = value => structuredClone(value);

/** No background calls, retries or alternative model. Each method is explicit. */
export function createInterpretationsClient(fetcher = fetch) {
  async function request(query, body) {
    let response;
    try {
      response = await fetcher(`/api/interpretations${query}`, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(150000),
      });
    } catch {
      throw new Error('暂时无法确认解读状态。请保留此页，使用「查询状态」核对；不会自动再次生成。');
    }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('解读服务尚未就绪，或登录已过期。请重新登录后查询状态。'); }
    if (!response.ok) {
      const error = new Error(typeof result?.error?.message === 'string' ? result.error.message : '解读服务暂时不可用，请稍后查询状态。');
      error.code = typeof result?.error?.code === 'string' ? result.error.code : '';
      error.status = response.status;
      // Only a structured API rejection establishes that no new generation was
      // accepted. A login page, proxy body or network error is never such proof.
      error.definite = Boolean(result?.error?.code) && (DEFINITE_REJECTIONS.has(response.status) || error.code === 'AI_NOT_CONFIGURED');
      throw error;
    }
    return result;
  }
  return {
    generate: body => request('', body),
    get: id => request(`?id=${encodeURIComponent(id)}`),
  };
}

function validateReceipt(receipt, payload) {
  const value = receipt?.interpretation;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.id !== payload.id || !STATUSES.has(value.status) ||
      value.model !== payload.model || value.effort !== payload.effort ||
      value.maxOutputTokens !== payload.maxOutputTokens ||
      (payload.detail !== undefined && value.detail !== payload.detail) ||
      (payload.focus !== undefined && value.focus !== payload.focus) ||
      (value.liveCheck === true) !== (payload.liveCheck === true) ||
      (payload.liveCheck === true && value.timeZone !== (payload.timeZone || 'UTC')) ||
      aiReadingSignature(value.reading) !== aiReadingSignature(payload.reading)) {
    throw new Error('返回的解读与这次请求不一致。请查询状态，暂不再次生成。');
  }
  if (value.status === 'completed') {
    const answer = value.answer, cards = [...payload.reading.cards].sort((a, b) => a.drawOrder - b.drawOrder);
    if (!answer || typeof answer.summary !== 'string' || !answer.summary.trim() ||
        !Array.isArray(answer.cards) || answer.cards.length !== cards.length ||
        !answer.cards.every((card, i) => card.sourceCardId === cards[i].sourceCardId && card.reversed === cards[i].reversed && typeof card.interpretation === 'string' && card.interpretation.trim()) ||
        !Array.isArray(answer.reflectionQuestions) || !answer.reflectionQuestions.every(text => typeof text === 'string') ||
        !Array.isArray(answer.limitations) || !answer.limitations.every(text => typeof text === 'string')) {
      throw new Error('这次返回的解读内容不完整。请查询状态，暂不再次生成。');
    }
    if (payload.liveCheck === true) {
      const check = value.webCheck;
      const validSources = Array.isArray(check?.sources) && check.sources.every(source => source && typeof source.title === 'string' && normalizeSourceUrl(source.url));
      const knownUrls = new Set(validSources ? check.sources.map(source => normalizeSourceUrl(source.url)) : []);
      if (check?.status !== 'searched' || !Number.isSafeInteger(check.searchCalls) || check.searchCalls < 1 ||
          typeof check.checkedAt !== 'string' || !Number.isFinite(Date.parse(check.checkedAt)) || !validSources ||
          !Array.isArray(answer.factChecks) || !answer.factChecks.every(fact =>
            fact && typeof fact.claim === 'string' && fact.claim.trim() && typeof fact.finding === 'string' && fact.finding.trim() &&
            ['supported', 'disputed', 'uncertain'].includes(fact.status) && Array.isArray(fact.sourceUrls) &&
            (fact.status === 'uncertain' || fact.sourceUrls.length > 0) && fact.sourceUrls.every(url => normalizeSourceUrl(url) && knownUrls.has(normalizeSourceUrl(url))))) {
        throw new Error('联网核查结果尚未完整确认。请查询本次结果，暂不再次生成。');
      }
    }
  }
  return copy(value);
}

/** Own one immutable request until its outcome is known. UI owns the live draft. */
export function createAIRequestState({ client = createInterpretationsClient(), onChange = () => {} } = {}) {
  let state = { status: 'idle', payload: null, interpretation: null, message: '' };
  let inFlight = false, disposed = false, sequence = 0;
  const unresolved = () => inFlight || ['submitting', 'pending', 'unknown'].includes(state.status);
  const snapshot = () => copy(state);
  const emit = () => { if (!disposed) onChange(snapshot()); };

  async function perform(kind) {
    const currentSequence = ++sequence;
    inFlight = true;
    if (kind === 'generate') state = { ...state, status: 'submitting', message: '正在解读…' };
    else state = { ...state, message: '正在查询本次结果…' };
    emit();
    try {
      // Copies prevent a custom transport from mutating the retained request.
      const result = kind === 'generate' ? await client.generate(copy(state.payload)) : await client.get(state.payload.id);
      if (disposed || currentSequence !== sequence) return snapshot();
      const interpretation = validateReceipt(result, state.payload);
      state = { ...state, status: interpretation.status, interpretation,
        message: interpretation.message || ({
          pending: '解读处理中，可稍后查询。',
          completed: '这次解读已完成。',
          incomplete: '本次解读未完成。可以调整预算后，由你决定是否重新生成。',
          failed: '本次解读未能完成。可调整设置后重新发起。',
          unknown: '本次结果尚未确认。请查询状态，暂不再次生成。',
        })[interpretation.status] };
    } catch (error) {
      if (disposed || currentSequence !== sequence) return snapshot();
      // A GET failure, even 404, cannot prove that the original POST will not
      // reach the durable claim later. Recovery must never unlock a paid retry.
      const definite = kind === 'generate' && error.definite === true;
      state = { ...state, status: definite ? 'failed' : 'unknown', interpretation: null,
        message: error?.message || '暂时无法确认解读状态，请稍后查询。' };
    } finally {
      if (!disposed && currentSequence === sequence) { inFlight = false; emit(); }
    }
    return snapshot();
  }

  return {
    async generate(payload) {
      if (disposed) throw new Error('解读页面已关闭。');
      if (unresolved()) throw new Error('请先确认原来的解读结果，再发起新的解读。');
      if (!payload || typeof payload.id !== 'string' || !payload.id || typeof payload.model !== 'string' ||
          typeof payload.effort !== 'string' || !Number.isInteger(payload.maxOutputTokens)) throw new TypeError('解读请求格式不正确。');
      if ((payload.detail !== undefined && !AI_DETAILS.some(item => item.id === payload.detail)) ||
          (payload.focus !== undefined && !AI_FOCUSES.some(item => item.id === payload.focus))) throw new TypeError('解读选项不正确。');
      if (payload.liveCheck !== undefined && typeof payload.liveCheck !== 'boolean') throw new TypeError('联网选项不正确。');
      if (payload.liveCheck && payload.timeZone !== undefined) {
        try { if (typeof payload.timeZone !== 'string') throw new Error(); new Intl.DateTimeFormat('en', { timeZone: payload.timeZone }); }
        catch { throw new TypeError('本次核查的时区不正确。'); }
      }
      aiReadingSignature(payload.reading); // Reject malformed local input before network activity.
      if (payload.id === state.payload?.id) throw new Error('这个请求编号已经使用，请为新的解读准备新编号。');
      state = { status: 'idle', payload: copy(payload), interpretation: null, message: '' };
      return perform('generate');
    },
    async recover() {
      if (disposed) throw new Error('解读页面已关闭。');
      if (inFlight) throw new Error('这次请求还在进行，请稍候。');
      if (!state.payload) throw new Error('还没有需要查询的解读。');
      return perform('get');
    },
    snapshot,
    get unresolved() { return unresolved(); },
    get inFlight() { return inFlight; },
    reset() {
      if (disposed || unresolved()) return false;
      sequence++; state = { status: 'idle', payload: null, interpretation: null, message: '' }; emit(); return true;
    },
    dispose() { disposed = true; sequence++; inFlight = false; },
  };
}
