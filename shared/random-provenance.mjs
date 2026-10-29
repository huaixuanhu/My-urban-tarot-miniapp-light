/** Source descriptions are metadata, not a cryptographic proof of physical entropy. */
export function randomSourceLabel(value) {
  return value?.source === 'anu' ? 'ANU 量子随机' : value?.source === 'local' ? '普通随机 · 本地' : '来源未记录';
}
export function verifiedRandomProvenance(input, operation) {
  if (!input.randomness || input.randomness.source !== 'anu') return input.randomness;
  const deck = operation?.deck, expected = deck?.randomness;
  if (operation?.status !== 'completed' || operation.action !== 'draw' || operation.id !== input.randomness.requestId ||
      !expected || expected.source !== 'anu' || expected.requestId !== operation.id ||
      expected.batchId !== input.randomness.batchId || expected.fetchedAt !== input.randomness.fetchedAt || expected.consumed !== input.randomness.consumed ||
      !Array.isArray(deck.order) || deck.order.length !== 78 || new Set(deck.order).size !== 78 || !deck.order.every(id => Number.isInteger(id) && id >= 0 && id < 78) || !Array.isArray(deck.reversed) || deck.reversed.length !== 78 || !deck.reversed.every(value => typeof value === 'boolean') ||
      input.cards.some(card => !deck.order.includes(card.physicalId) || deck.reversed[card.physicalId] !== card.reversed)) {
    throw new Error('这份量子来源与后台牌局不一致，请保留当前内容并重新检查。');
  }
  return structuredClone(expected);
}
