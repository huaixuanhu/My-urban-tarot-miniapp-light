export class AIProviderError extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}

/** One official request per operation. No redirect, SDK retry, fallback or body logging. */
export function createOpenAIProvider(apiKey, { fetcher = fetch, timeoutMs = 115000 } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new AIProviderError('not_configured');
  async function request(path, payload, requestTimeoutMs = timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetcher(`https://api.openai.com/v1${path}`, {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), redirect: 'error', signal: controller.signal,
      });
      if (!response.ok) { await response.body?.cancel(); throw new AIProviderError(response.status < 500 ? 'rejected' : 'unknown'); }
      const declared = response.headers.get('content-length');
      if (declared && Number(declared) > 512 * 1024) { await response.body?.cancel(); throw new AIProviderError('invalid_response'); }
      if (!response.body) throw new AIProviderError('invalid_response');
      const reader = response.body.getReader(), chunks = []; let length = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          length += value.byteLength;
          if (length > 512 * 1024) { await reader.cancel(); throw new AIProviderError('invalid_response'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new AIProviderError('invalid_response'); }
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError('unknown');
    } finally { clearTimeout(timer); }
  }
  return {
    async count(payload) {
      const body = Object.fromEntries(['model', 'instructions', 'input', 'text', 'reasoning'].map(key => [key, payload[key]]));
      // Leave headroom for generation and the durable terminal write inside the
      // 180-second server invocation. A timeout never triggers a retry.
      const data = await request('/responses/input_tokens', body, Math.min(timeoutMs, 25000));
      if (!Number.isSafeInteger(data?.input_tokens) || data.input_tokens < 1) throw new AIProviderError('invalid_response');
      return data.input_tokens;
    },
    generate(payload) { return request('/responses', payload); },
  };
}
