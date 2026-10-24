import { CARD_COUNT } from './motion.mjs';

const ROLL = -0.10;
const normalX = -Math.sin(ROLL), normalY = Math.cos(ROLL);
const layerDistance = 0.013;

/** One stable, loosely swept fan for the prepared order. Never reroll on hover. */
export function createReadingFan(order) {
  if (!Array.isArray(order) || order.length !== CARD_COUNT || new Set(order).size !== CARD_COUNT || !Array.from(order).every(id => Number.isInteger(id) && id >= 0 && id < CARD_COUNT)) {
    throw new RangeError('Fan requires all 78 unique physical card IDs.');
  }
  let seed = order.reduce((hash, id) => Math.imul(hash ^ (id + 1), 16777619) >>> 0, 2166136261);
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const steps = Array.from({ length: CARD_COUNT - 1 }, () => 0.70 + random() * 0.60);
  const total = steps.reduce((sum, step) => sum + step, 0);
  let distance = 0;
  return Object.freeze(order.map((_, ordinal) => {
    if (ordinal) distance += steps[ordinal - 1];
    const fraction = distance / total, arc = fraction * 2 - 1;
    const x = -4.7 + fraction * 9.4;
    const z = 1.90 + 1.20 * arc * arc + (random() - 0.5) * 0.34;
    const yaw = arc * 0.60 + (random() - 0.5) * 0.12;
    // All faces remain in parallel planes. Uneven x/z/yaw may look relaxed,
    // but the normal separation stays greater than solid paper thickness.
    const y = 0.16 + (ordinal * layerDistance - normalX * (x + 4.7)) / normalY;
    return Object.freeze({ x, y, z,
      rx: Math.atan2(-Math.sin(ROLL) * Math.sin(yaw), Math.cos(yaw)),
      ry: Math.asin(Math.cos(ROLL) * Math.sin(yaw)),
      rz: Math.atan2(Math.sin(ROLL), Math.cos(ROLL) * Math.cos(yaw)),
    });
  }));
}
