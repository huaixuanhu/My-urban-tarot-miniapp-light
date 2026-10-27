import { CARD_COUNT } from './motion.mjs';
import { RESET_DURATION_MS, createResetRun, sampleResetPose, shuffleProgressAt } from './reset-motion.mjs';

export const READING_RESET_PRELUDE_MS = 450;
export const READING_RESET_SWEEP_Z = 30;
export const READING_RESET_DURATION_MS = READING_RESET_PRELUDE_MS + RESET_DURATION_MS;
const fields = ['x', 'y', 'z', 'rx', 'ry', 'rz'];
const validId = id => Number.isInteger(id) && id >= 0 && id < CARD_COUNT;
const smooth = value => { const u = Math.max(0, Math.min(1, value)); return u * u * u * (u * (u * 6 - 15) + 10); };

/**
 * Reading-only reset adapter. The remaining fan first sweeps away as one rigid
 * arrangement. Only actually placed cards enter the accepted reset as placed.
 * At the handoff, hidden deck cards change to the accepted off-edge paths; this
 * is an authored offscreen transition, not continuous paper physics.
 * Offscreen framing is verified for the desktop reading camera. Taller portrait
 * framing may require a controller visibility mask at the hidden handoff.
 */
export function createReadingReset({ snapshot, deckIds, order, seed } = {}) {
  if (!Array.isArray(snapshot) || snapshot.length !== CARD_COUNT || new Set(snapshot.map(card => card?.id)).size !== CARD_COUNT || !Array.from(snapshot).every(card => validId(card?.id) && fields.every(key => Number.isFinite(card[key])))) {
    throw new RangeError('Snapshot must contain all 78 physical IDs with complete finite poses.');
  }
  if (!Array.isArray(deckIds) || new Set(deckIds).size !== deckIds.length || !Array.from(deckIds).every(validId)) throw new RangeError('Deck IDs must be unique physical card IDs.');
  if (order !== undefined && (!Array.isArray(order) || order.length !== CARD_COUNT || new Set(order).size !== CARD_COUNT || !Array.from(order).every(validId))) throw new RangeError('Order must be a complete physical card permutation.');
  const deckMask = Array(CARD_COUNT).fill(false);
  for (const id of deckIds) deckMask[id] = true;
  const poseById = Array(CARD_COUNT);
  const copiedSnapshot = snapshot.map(card => {
    const copied = Object.freeze({ id: card.id, ...Object.fromEntries(fields.map(key => [key, card[key]])) });
    poseById[card.id] = Object.freeze(Object.fromEntries(fields.map(key => [key, card[key]])));
    return copied;
  });
  const placed = copiedSnapshot.filter(card => !deckMask[card.id]);
  return Object.freeze({
    snapshot: Object.freeze(copiedSnapshot), deckIds: Object.freeze([...deckIds]),
    deckMask: Object.freeze(deckMask), poseById: Object.freeze(poseById),
    motion: createResetRun({ seed, order, placed }),
  });
}

export function sampleReadingResetPose(id, elapsedMs, run) {
  if (!validId(id) || !run?.poseById?.[id]) throw new RangeError('Unknown physical card ID.');
  if (!Number.isFinite(elapsedMs)) throw new TypeError('Elapsed time must be finite.');
  if (elapsedMs >= READING_RESET_PRELUDE_MS) return sampleResetPose(id, elapsedMs - READING_RESET_PRELUDE_MS, run.motion);
  const initial = run.poseById[id];
  if (!run.deckMask[id]) return { ...initial };
  return { ...initial, z: initial.z + READING_RESET_SWEEP_Z * smooth(elapsedMs / READING_RESET_PRELUDE_MS) };
}

export function readingShuffleProgressAt(elapsedMs) {
  return shuffleProgressAt(elapsedMs - READING_RESET_PRELUDE_MS);
}
