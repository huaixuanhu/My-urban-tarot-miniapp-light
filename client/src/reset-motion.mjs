import { CARD_COUNT, DURATION_MS, samplePose, phaseAt } from './motion.mjs';

export const RESET_PREFIX_MS = 2600;
export const RESET_SHUFFLE_START_MS = 540;
export const RESET_DURATION_MS = RESET_PREFIX_MS + DURATION_MS - RESET_SHUFFLE_START_MS;
export const COLLECT_START_MS = 1600;
export const RESET_PATH_TIME_MS = 1400;
const TAKEOFF_END_MS = 300;
const INCOMING_CLOCK_MS = 650;
const JOIN = INCOMING_CLOCK_MS / RESET_PATH_TIME_MS;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const u = clamp(value); return u * u * u * (u * (u * 6 - 15) + 10); };
const integralSmooth = u => u ** 6 - 3 * u ** 5 + 2.5 * u ** 4;
const mix = (a, b, u) => a + (b - a) * u;
const pose = (x, y, z, rx = 0, ry = 0, rz = 0) => ({ x, y, z, rx, ry, rz });
const cubic = (a, b, c, d, u) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
function finiteTime(ms) { if (!Number.isFinite(ms)) throw new TypeError('Elapsed time must be finite.'); return ms; }

/** Authored virtual-clock rate, not a claim about world-space card velocity. */
export function resetPathRateAt(elapsedMs) {
  const ms = finiteTime(elapsedMs);
  return 0.5 + 0.5 * smooth((ms - COLLECT_START_MS) / (RESET_PREFIX_MS - COLLECT_START_MS));
}

/** Integrate the calm incoming clock, then the smooth gathering acceleration. */
export function resetPathProgressAt(elapsedMs) {
  const ms = Math.max(TAKEOFF_END_MS, Math.min(RESET_PREFIX_MS, finiteTime(elapsedMs)));
  if (ms <= COLLECT_START_MS) return 0.5 * (ms - TAKEOFF_END_MS) / RESET_PATH_TIME_MS;
  const elapsed = ms - COLLECT_START_MS;
  const u = elapsed / (RESET_PREFIX_MS - COLLECT_START_MS);
  return (INCOMING_CLOCK_MS + 0.5 * elapsed + 500 * integralSmooth(u)) / RESET_PATH_TIME_MS;
}

/** Prefix geometry is flat; suffix uses the accepted shuffle's original clock. */
export function shuffleProgressAt(elapsedMs) {
  const ms = finiteTime(elapsedMs);
  if (ms < RESET_PREFIX_MS) return 0;
  return clamp((RESET_SHUFFLE_START_MS + ms - RESET_PREFIX_MS) / DURATION_MS);
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** Author one immutable seeded run. Physical card identities remain fixed. */
export function createResetRun({ seed = 1, order = Array.from({ length: CARD_COUNT }, (_, i) => i), placed = [] } = {}) {
  if (order.length !== CARD_COUNT || new Set(order).size !== CARD_COUNT || order.some(id => !Number.isInteger(id) || id < 0 || id >= CARD_COUNT)) throw new RangeError('Order must contain every physical card ID from 0 through 77 exactly once.');
  const random = seededRandom(seed), slotById = Array(CARD_COUNT), placedById = new Map();
  order.forEach((id, slot) => { slotById[id] = slot; });
  for (const card of placed) {
    if (!Number.isInteger(card.id) || card.id < 0 || card.id >= CARD_COUNT || placedById.has(card.id)) throw new RangeError('Placed card IDs must be unique and belong to the deck.');
    const initial = Object.fromEntries(['x', 'y', 'z', 'rx', 'ry', 'rz'].map(key => [key, card[key] ?? 0]));
    if (Object.values(initial).some(value => !Number.isFinite(value))) throw new TypeError('Placed poses must be finite.');
    placedById.set(card.id, initial);
  }
  const cells = Array.from({ length: CARD_COUNT }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const cards = Array(CARD_COUNT);
  for (let slot = 0; slot < CARD_COUNT; slot += 1) {
    const id = order[slot], cell = cells[slot], laneY = 0.55 + slot * 0.012;
    let x = -4.2 + (cell % 13) * 0.7 + (random() - 0.5) * 0.32;
    let z = -1.25 + Math.floor(cell / 13) * 0.5 + (random() - 0.5) * 0.30;
    // Keep the passing spread loose around the gathering point, avoiding a tiny
    // near-center waypoint that would visually linger despite a nonzero tangent.
    const radius = Math.hypot(x, z);
    if (radius < 1.15) { x *= 1.15 / radius; z *= 1.15 / radius; }
    const target = pose(x, laneY, z, 0, (random() - 0.5) * Math.PI * 2);
    // Approach each waypoint from its outward edge, then continue inward.
    const edge = Math.abs(x) / 4.5 > Math.abs(z) / 1.5 ? (x < 0 ? 0 : 1) : (z < 0 ? 2 : 3);
    const spin = (random() < 0.5 ? -1 : 1) * Math.PI * 2;
    const offEdge = edge === 0 ? pose(-12, laneY, (random() - 0.5) * 4.5, 0, target.ry + spin)
      : edge === 1 ? pose(12, laneY, (random() - 0.5) * 4.5, 0, target.ry + spin)
      : edge === 2 ? pose((random() - 0.5) * 8, laneY, -11, 0, target.ry + spin)
      : pose((random() - 0.5) * 8, laneY, 11, 0, target.ry + spin);
    cards[id] = Object.freeze({ id, slot, edge, isPlaced: placedById.has(id), initial: Object.freeze({ ...(placedById.get(id) ?? offEdge) }), target: Object.freeze(target), laneY });
  }
  return Object.freeze({ seed, order: Object.freeze([...order]), slotById: Object.freeze(slotById), cards: Object.freeze(cards) });
}

export function resetPhaseAt(elapsedMs) {
  const ms = finiteTime(elapsedMs);
  if (ms < COLLECT_START_MS) return 'fly';
  if (ms < RESET_PREFIX_MS) return 'collect';
  return phaseAt(shuffleProgressAt(ms));
}

/** Direct seekable path: no scatter hold, landing stage, or stationary waypoint. */
export function sampleResetPose(id, elapsedMs, run) {
  if (!Number.isInteger(id) || id < 0 || id >= CARD_COUNT || !run?.cards?.[id]) throw new RangeError('Unknown physical card ID.');
  const ms = Math.max(0, finiteTime(elapsedMs)), card = run.cards[id];
  if (ms >= RESET_PREFIX_MS) return samplePose(card.slot, shuffleProgressAt(ms));
  const { initial, target, laneY } = card;
  if (ms < TAKEOFF_END_MS) {
    if (!card.isPlaced) return { ...initial };
    const u = smooth(ms / TAKEOFF_END_MS);
    return pose(initial.x, mix(initial.y, laneY, u) + 1.12 * Math.sin(Math.PI * u), initial.z, initial.rx * (1 - u), initial.ry, initial.rz * (1 - u));
  }
  const progress = resetPathProgressAt(ms);
  if (progress < JOIN) {
    const u = progress / JOIN;
    // The cubic's incoming endpoint tangent exactly matches the accelerating
    // gathering path. It passes through the spread instead of stopping there.
    const approach = (from, waypoint) => {
      const tangent = -waypoint / (1 - JOIN);
      return cubic(from, from, waypoint - tangent * JOIN / 3, waypoint, u);
    };
    return pose(approach(initial.x, target.x), laneY, approach(initial.z, target.z), 0, approach(initial.ry, target.ry));
  }
  const u = (progress - JOIN) / (1 - JOIN);
  // Initial derivative is one; acceleration is felt before the final braking
  // needed to form a stable cuboid and join the original shuffle continuously.
  const collecting = u + u * u - u * u * u;
  const lifted = samplePose(card.slot, RESET_SHUFFLE_START_MS / DURATION_MS);
  return pose(target.x * (1 - collecting), mix(laneY, lifted.y, smooth(u)), target.z * (1 - collecting), 0, target.ry * (1 - collecting));
}
