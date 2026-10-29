import { readingCard } from './reading-content.mjs';

/** A completed spread is copied; record browsing never mutates the live table. */
export function captureRecord(reading, { id, startedAt, question = '', interpretation = '', reflection = '', labels = {} }) {
  const cards = Object.values(reading.placed).sort((a, b) => a.drawOrder - b.drawOrder);
  if (!cards.length || cards.some(card => !card.faceUp)) throw new Error('请先翻开桌上的牌，再保存这次占卜。');
  return {
    schemaVersion: 1, id, startedAt, question, interpretation, reflection,
    ...(reading.randomness ? { randomness: structuredClone(reading.randomness) } : {}),
    spread: { type: 'free', name: '自由摆牌' },
    cards: cards.map(card => ({
      physicalId: card.id, sourceCardId: readingCard(card.id).id, faceUp: true,
      reversed: reading.reversed[card.id], x: card.x, z: card.z,
      drawOrder: card.drawOrder, zIndex: card.zIndex, positionLabel: labels[card.id] || '',
    })),
  };
}

/** Keep the same id AND payload after an uncertain result, until confirmed. */
export function createSaveAttempt() {
  let pending = null;
  return {
    prepare(snapshot) { if (!pending) pending = structuredClone(snapshot); return structuredClone(pending); },
    complete() { pending = null; },
    snapshot() { return pending ? structuredClone(pending) : null; },
    get pending() { return !!pending; },
  };
}

export function createRecordsClient(fetcher = fetch) {
  async function request(query = '', body) {
    let response;
    try {
      response = await fetcher(`/api/records${query}`, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
      });
    } catch { throw new Error('暂时无法确认云端状态。内容仍在这里，可重试；请先不要刷新页面。'); }
    let result;
    try { result = await response.json(); } catch { throw new Error('记录服务尚未就绪，或登录已过期。请重新登录后重试。'); }
    if (!response.ok) {
      const error = new Error(result.error?.message || '记录暂时无法读取，请稍后重试。');
      error.definite = response.status < 500 || result.error?.code === 'RECORDS_NOT_CONFIGURED';
      throw error;
    }
    return result;
  }
  return {
    list: cursor => request(`?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
    get: id => request(`?id=${encodeURIComponent(id)}`),
    save: body => request('', body),
  };
}
