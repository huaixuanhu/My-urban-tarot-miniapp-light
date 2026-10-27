import { CARD_WIDTH, CARD_THICKNESS } from './motion.mjs';

export const REVEAL_DURATION_MS = 620;
const LIFT = CARD_WIDTH / 2 + 0.06;
const smooth = value => {
  const u = Math.max(0, Math.min(1, value));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

/** Printed underside faces upward after a long-axis turn; yaw owns reversal. */
export function readingTablePose(card, reversed, layer = 0) {
  return {
    x: card.x, y: 0.05 + layer * 0.012 + (card.faceUp ? CARD_THICKNESS : 0), z: card.z,
    rx: 0, ry: reversed ? Math.PI : 0, rz: card.faceUp ? Math.PI : 0,
  };
}

/** Direction is chosen once per reveal; +1/-1 give opposite world-side turns. */
export function sampleSideRevealPose(faceUpPose, progress, direction) {
  if (!Number.isFinite(progress) || ![-1, 1].includes(direction)) throw new RangeError('Reveal requires finite progress and a direction of -1 or 1.');
  const t = smooth(progress);
  const yawSign = Math.cos(faceUpPose.ry) < 0 ? -1 : 1;
  return {
    ...faceUpPose,
    rx: 0,
    rz: direction * yawSign * Math.PI * t,
    // Lift the short edge clear of the cloth while the card turns in place.
    y: faceUpPose.y - CARD_THICKNESS * (1 - t) + LIFT * Math.sin(Math.PI * t),
  };
}
