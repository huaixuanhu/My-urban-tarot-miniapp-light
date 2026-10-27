import source from '../client/src/data/tarotData.json' with { type: 'json' };
import { PLACEMENT_BOUNDS } from '../client/src/reading-layout.mjs';

export const RECORD_SCHEMA_VERSION = 1;
export const RECORD_BODY_LIMIT = 64 * 1024;
export const RECORD_LIMITS = Object.freeze({ question: 1500, interpretation: 8000, reflection: 8000, positionLabel: 80, spreadName: 80 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sourceCards = [
  ...source.majorArcana,
  ...['wands', 'cups', 'swords', 'disks'].flatMap(suit => source.minorArcana[suit].cards),
];

export class RecordValidationError extends Error {
  constructor(message) { super(message); this.name = 'RecordValidationError'; }
}
const invalid = message => { throw new RecordValidationError(message); };

function object(value, allowed, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(`${name}格式不正确。`);
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid(`${name}含有不支持的字段。`);
}
function text(value, max, name, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max) invalid(`${name}过长或格式不正确。`);
  return value.trim();
}
function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000) invalid(`${name}格式不正确。`);
  return value;
}
export function normalizeRecordId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) invalid('记录编号不正确。');
  return value.toLowerCase();
}
function dateTime(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) invalid(`${name}格式不正确。`);
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== value) invalid(`${name}格式不正确。`);
  return value;
}

/** Strict client input; canonical source content and authorship are server-owned. */
export function normalizeRecordInput(value) {
  object(value, ['schemaVersion', 'id', 'startedAt', 'question', 'interpretation', 'reflection', 'spread', 'cards'], '记录');
  if (value.schemaVersion !== RECORD_SCHEMA_VERSION) invalid('暂不支持这个记录版本。');
  object(value.spread, ['type', 'name'], '牌阵');
  if (value.spread.type !== 'free') invalid('当前只支持自由摆牌记录。');
  if (!Array.isArray(value.cards) || value.cards.length < 1 || value.cards.length > 78) invalid('请先抽牌并全部翻开，再保存记录。');
  const cards = value.cards.map(card => {
    object(card, ['physicalId', 'sourceCardId', 'faceUp', 'reversed', 'x', 'z', 'drawOrder', 'zIndex', 'positionLabel'], '牌');
    if (!Number.isInteger(card.physicalId) || card.physicalId < 0 || card.physicalId >= sourceCards.length || sourceCards[card.physicalId].id !== card.sourceCardId) invalid('牌的编号与原始牌组不一致。');
    if (card.faceUp !== true) invalid('请先把桌上的牌全部翻开，再保存记录。');
    if (typeof card.reversed !== 'boolean') invalid('牌的正逆位格式不正确。');
    const b = PLACEMENT_BOUNDS;
    if (!Number.isFinite(card.x) || !Number.isFinite(card.z) || card.x < b.minX || card.x > b.maxX || card.z < b.minZ || card.z > b.maxZ) invalid('牌的位置超出了牌桌范围。');
    return {
      physicalId: card.physicalId, sourceCardId: card.sourceCardId,
      faceUp: true, reversed: card.reversed, x: card.x, z: card.z,
      drawOrder: positiveInteger(card.drawOrder, '抽牌顺序'), zIndex: positiveInteger(card.zIndex, '摆放顺序'),
      positionLabel: text(card.positionLabel, RECORD_LIMITS.positionLabel, '牌位说明'),
    };
  }).sort((a, b) => a.drawOrder - b.drawOrder);
  for (const key of ['physicalId', 'sourceCardId', 'drawOrder', 'zIndex']) {
    if (new Set(cards.map(card => card[key])).size !== cards.length) invalid('记录中有重复的牌或顺序。');
  }
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    id: normalizeRecordId(value.id), startedAt: dateTime(value.startedAt, '开始时间'),
    question: text(value.question, RECORD_LIMITS.question, '问题'),
    interpretation: text(value.interpretation, RECORD_LIMITS.interpretation, '我的解读'),
    reflection: text(value.reflection, RECORD_LIMITS.reflection, '补充想法'),
    spread: { type: 'free', name: text(value.spread.name, RECORD_LIMITS.spreadName, '牌阵名称', '自由摆牌') || '自由摆牌' },
    cards,
  };
}

/** Preserve the original meaning as it existed at save time, separately from commentary. */
export function buildStoredRecord(input, { savedAt, createdBy }) {
  const normalized = normalizeRecordInput(input);
  if (typeof createdBy !== 'string' || !createdBy.trim() || createdBy.length > 255) throw new TypeError('A verified subject is required.');
  return {
    ...normalized, savedAt: dateTime(savedAt, '保存时间'), createdBy,
    deck: { id: 'urban-tarot', name: source.deck.name, creator: source.deck.creator },
    cards: normalized.cards.map(card => {
      const original = sourceCards[card.physicalId];
      return { ...card, sourceSnapshot: {
        name: original.name, theme: original.theme ?? '', interpretation: original.interpretation ?? '',
        urbanImagery: original.urbanImagery ?? '', image: original.image,
        reversedInterpretation: original.reversedInterpretation ?? null,
      } };
    }),
  };
}

export function summarizeRecord(record) {
  return {
    id: record.id, startedAt: record.startedAt, savedAt: record.savedAt,
    question: record.question, spread: record.spread, cardCount: record.cards.length,
    cards: record.cards.map(card => ({ physicalId: card.physicalId, sourceCardId: card.sourceCardId, reversed: card.reversed, name: card.sourceSnapshot.name })),
  };
}
