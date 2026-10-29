import { generateLocalDeck } from '../../shared/randomness.mjs';

export const RANDOM_MODE_KEY = 'augurwell.random-mode';
export const RANDOM_OPERATION_KEY = 'augurwell.random-operation';
const modes = new Set(['quantum', 'local']);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const read = (storage, key) => { try { return storage?.getItem(key); } catch { return null; } };
const write = (storage, key, value) => { try { value === null ? storage?.removeItem(key) : storage?.setItem(key, value); } catch { /* Current session remains usable. */ } };

export function validateRandomDeck(deck) {
  if (!deck || !Array.isArray(deck.order) || deck.order.length !== 78 || new Set(deck.order).size !== 78 || !deck.order.every(id => Number.isInteger(id) && id >= 0 && id < 78)
    || !Array.isArray(deck.reversed) || deck.reversed.length !== 78 || !deck.reversed.every(value => typeof value === 'boolean')
    || deck.randomness?.source !== 'anu' || !uuid(deck.randomness.requestId) || !uuid(deck.randomness.batchId)
    || !Number.isFinite(Date.parse(deck.randomness.fetchedAt)) || !Number.isInteger(deck.randomness.consumed) || deck.randomness.consumed < 155 || deck.randomness.consumed > 1024) throw new Error('随机服务返回的牌组不完整，当前牌桌已保留。');
  return structuredClone(deck);
}

export function createRandomClient(fetcher = fetch) {
  async function request(query = '', body) {
    let response, data;
    try {
      response = await fetcher(`/api/random${query}`, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
      });
      data = await response.json();
    } catch { throw new Error('暂时无法确认结果。请查询这次操作，当前牌桌已保留。'); }
    if (!response.ok) {
      const error = new Error(data.error?.message || '随机服务暂不可用，当前牌桌已保留。');
      // Only a definite refusal can safely release the operation handle.
      error.definite = (response.status >= 400 && response.status < 500) || (response.status === 503 && data.error?.code === 'RANDOM_NOT_CONFIGURED');
      error.status = response.status;
      error.code = data.error?.code;
      throw error;
    }
    return data;
  }
  return { metadata: () => request(), operation: id => request(`?id=${encodeURIComponent(id)}`), run: (action, id) => request('', { action, id }) };
}

/** No mount, mode switch or metadata read can collect entropy or create a deck. */
export function createRandomSession({ client = createRandomClient(), storage, operationStorage, localDeck = generateLocalDeck, newId = () => crypto.randomUUID(), onChange = () => {} } = {}) {
  let mode = read(storage, RANDOM_MODE_KEY) === 'local' ? 'local' : 'quantum';
  let pending = null, pool = null, busy = false, prepared = null, message = '', disposed = false, revision = 0;
  try {
    const saved = JSON.parse(read(operationStorage, RANDOM_OPERATION_KEY));
    if (saved && uuid(saved.id) && ['collect', 'draw'].includes(saved.action)) pending = { id: saved.id, action: saved.action, status: 'unknown' };
  } catch { /* Invalid or missing saved handle does not authorize a request. */ }
  const snapshot = () => ({ mode, pending: pending && { ...pending }, pool: pool && { ...pool }, busy, prepared: !!prepared, message });
  const publish = () => { if (!disposed) onChange(snapshot()); };
  function setPending(value) { pending = value; write(operationStorage, RANDOM_OPERATION_KEY, value ? JSON.stringify({ id: value.id, action: value.action }) : null); }
  function acceptPool(value) {
    if (!value || !Number.isInteger(value.remaining) || value.remaining < 0 || value.remaining > 1024 || ![0,1024].includes(value.total) || value.remaining > value.total) throw new Error('随机库存信息不完整。');
    pool = { batchId: value.batchId, fetchedAt: value.fetchedAt, total: value.total, remaining: value.remaining, collecting: !!value.collecting };
  }
  function acceptResult(result, attempt, recovering = false) {
    const operation = result?.operation;
    if (!operation || operation.id !== attempt.id || operation.action !== attempt.action || !['pending', 'completed', 'failed', 'unknown'].includes(operation.status)) throw new Error('无法确认这次随机操作，请查询结果。');
    acceptPool(result.pool);
    if (operation.status === 'completed') {
      const deck = attempt.action === 'draw' ? validateRandomDeck(operation.deck) : null;
      if (deck && deck.randomness.requestId !== attempt.id) throw new Error('牌组与本次操作不匹配，请查询结果。');
      setPending(null);
      message = '';
      if (recovering && deck) { prepared = deck; message = '已找回本次牌组。下一次量子洗牌将使用它，不重复扣库存。'; }
      return deck;
    }
    if (operation.status === 'failed' || (operation.status === 'unknown' && operation.terminal === true)) {
      setPending(null);
      throw Object.assign(new Error(operation.message || '这次操作已结束，当前牌桌和旧库存已保留。可手动重新采集。'), { definite: true, terminal: true });
    }
    setPending({ ...attempt, status: operation.status });
    throw new Error(operation.message || '这次操作尚未确认，请稍后查询结果。');
  }
  async function execute(action, recovering = false, resuming = false) {
    if (disposed || busy) throw new Error('正在处理，请稍候。');
    const reusing = recovering || resuming;
    if (!reusing && pending) throw new Error('请先查询上一笔量子操作，避免重复消耗。');
    if (recovering && !pending) return null;
    if (resuming && !pending?.canResume) throw new Error('请先查询这次操作的状态。');
    const attempt = reusing ? { ...pending, canResume: false } : { id: newId(), action, status: 'pending' };
    if (!recovering) setPending(attempt);
    busy = true; message = ''; revision += 1; publish();
    try {
      const result = await (recovering ? client.operation(attempt.id) : client.run(action, attempt.id));
      if (disposed) return null;
      return acceptResult(result, attempt, reusing);
    } catch (error) {
      if (!disposed) {
        const canResume = recovering && error.status === 404 && error.code === 'NOT_FOUND';
        if (error.terminal || (error.definite && !reusing)) setPending(null);
        else setPending({ ...attempt, status: 'unknown', canResume });
        message = canResume ? '服务器暂未找到这次操作。可以继续提交同一次操作；当前牌桌会保留。' : error.message || '随机操作尚未确认。';
      }
      throw error;
    } finally { busy = false; revision += 1; publish(); }
  }
  return {
    get state() { return snapshot(); },
    setMode(value) { if (disposed || !modes.has(value)) return; mode = value; write(storage, RANDOM_MODE_KEY, mode); publish(); },
    async refresh() {
      if (disposed || busy) return;
      const at = revision;
      try { const result = await client.metadata(); if (!disposed && at === revision && !busy) { acceptPool(result.pool); publish(); } }
      catch (error) { if (!disposed && at === revision) { message = error.message; publish(); } }
    },
    collect() { return execute('collect'); },
    async prepareDeck() {
      if (disposed || busy) throw new Error('正在处理，请稍候。');
      // Capture this operation's selected mode before awaiting anything.
      if (mode === 'local') return { ...localDeck(), randomness: { source: 'local' } };
      if (prepared) { const result = prepared; prepared = null; message = ''; publish(); return structuredClone(result); }
      return execute('draw');
    },
    recover() { return execute(pending?.action, true); },
    resume() { return execute(pending?.action, false, true); },
    dispose() { disposed = true; },
  };
}
