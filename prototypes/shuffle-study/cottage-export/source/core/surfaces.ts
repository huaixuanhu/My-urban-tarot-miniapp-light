import type { Point2 } from './types.ts';

/** Shared by the visible rug and the characters standing on it (world metres). */
export const WOOD_TOP = .002;
export const COFFEE_RUG = {
  position: [.7, .018, -.54] as [number, number, number],
  size: [4.1, .035, 3.02] as [number, number, number],
  radius: .012,
};
export const RUG_TOP = COFFEE_RUG.position[1] + COFFEE_RUG.size[1] / 2;

function distanceOutsideRug(point: Point2) {
  return Math.hypot(
    Math.max(0, Math.abs(point.x - COFFEE_RUG.position[0]) - COFFEE_RUG.size[0] / 2),
    Math.max(0, Math.abs(point.z - COFFEE_RUG.position[2]) - COFFEE_RUG.size[2] / 2),
  );
}

/** Conservative top surface: the rounded 12 mm rim is never higher than this. */
export function surfaceHeight(point: Point2) {
  return distanceOutsideRug(point) === 0 ? RUG_TOP : WOOD_TOP;
}

/** Raise before the leading foot/paw reaches the edge; avoid a 33.5 mm step-pop. */
export function surfaceLift(point: Point2) {
  const t = Math.min(1, Math.max(0, (distanceOutsideRug(point) - .22) / .12));
  return (RUG_TOP - WOOD_TOP) * (1 - t * t * (3 - 2 * t));
}
