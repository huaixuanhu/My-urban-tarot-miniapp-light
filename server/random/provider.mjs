export class RandomProviderError extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}
export function createANUProvider(key, fetcher = fetch) {
  if (typeof key !== 'string' || !key.trim()) throw new RandomProviderError('not_configured');
  return {
    async collect() {
      let response;
      try {
        response = await fetcher('https://api.quantumnumbers.anu.edu.au?type=uint16&length=1024', {
          method: 'GET', headers: { 'x-api-key': key.trim(), Accept: 'application/json' },
          cache: 'no-store', signal: AbortSignal.timeout(10000), redirect: 'error',
        });
      } catch { throw new RandomProviderError('unknown'); }
      if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new RandomProviderError('rejected'); }
      const chunks = []; let size = 0;
      if (!response.body) throw new RandomProviderError('invalid_response');
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 32768) { await reader.cancel(); throw new RandomProviderError('invalid_response'); }
          chunks.push(value);
        }
      } catch (error) {
        if (error instanceof RandomProviderError) throw error;
        throw new RandomProviderError('unknown');
      } finally { reader.releaseLock(); }
      let result;
      try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new RandomProviderError('invalid_response'); }
      if (result?.success !== true || result.type !== 'uint16' || result.length !== 1024 || !validBatch(result.data)) throw new RandomProviderError('invalid_response');
      return result.data;
    },
  };
}
export function validBatch(values) {
  return Array.isArray(values) && values.length === 1024 && Array.from(values).every(value => Number.isInteger(value) && value >= 0 && value <= 65535);
}
