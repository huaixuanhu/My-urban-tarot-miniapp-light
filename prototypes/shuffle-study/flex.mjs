import { CARD_COUNT, CARD_WIDTH, CARD_THICKNESS, RIFFLE_TIMING, flexLayerGapAt } from './motion.mjs';

export const FLEX_SEGMENTS = 24;
const BEND_START = 0.32;
const HELD_ANGLE = 0.48;
const HINGE_X = -0.40;
const SPAN = CARD_WIDTH / 2 - HINGE_X;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const u = clamp(value); return u * u * u * (u * (u * 6 - 15) + 10); };

function releaseAngle(flight) {
  // Successively smaller overshoots give a short damped return. The rigid
  // inward movement waits until this springback has almost finished.
  const keyframes = [[0, HELD_ANGLE], [0.26, 0], [0.38, -0.011], [0.50, 0.002], [0.60, 0]];
  if (flight >= 0.60) return 0;
  for (let i = 1; i < keyframes.length; i += 1) {
    const [end, target] = keyframes[i];
    if (flight <= end) {
      const [start, initial] = keyframes[i - 1];
      return initial + (target - initial) * smooth((flight - start) / (end - start));
    }
  }
  return 0;
}

/** Pure flex state; body and both visible surfaces share this exact mapping. */
export function sampleFlex(index, t, count = CARD_COUNT) {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError('Card index must belong to a nonempty deck.');
  }
  if (!Number.isFinite(t)) throw new TypeError('Time must be finite.');
  const time = clamp(t);
  const leftCount = Math.ceil(count / 2);
  const isLeft = index < leftCount;
  const localIndex = isLeft ? index : index - leftCount;
  let angle = 0;
  if (time > BEND_START && time < RIFFLE_TIMING.end) {
    if (time < RIFFLE_TIMING.start) {
      angle = HELD_ANGLE * smooth((time - BEND_START) / (RIFFLE_TIMING.start - BEND_START));
    } else {
      const phase = (time - RIFFLE_TIMING.start) / (RIFFLE_TIMING.end - RIFFLE_TIMING.start);
      const riffling = clamp((phase - RIFFLE_TIMING.leveling) / (1 - RIFFLE_TIMING.leveling));
      const interval = leftCount === 1 ? RIFFLE_TIMING.releaseSpan : RIFFLE_TIMING.releaseSpan / (leftCount - 1);
      const release = localIndex * interval + (isLeft ? 0 : interval / 2);
      const flight = clamp((riffling - release) / RIFFLE_TIMING.flightSpan);
      angle = releaseAngle(flight);
    }
  }
  if (Math.abs(angle) < 1e-12) angle = 0;
  return { angle, side: isLeft ? 1 : -1, layerOffset: localIndex * (CARD_THICKNESS + flexLayerGapAt(time)), hingeX: HINGE_X, span: SPAN, active: angle !== 0 };
}

/**
 * Bend toward the inner edge using concentric circular offset surfaces.
 * x/y/z are immutable rest coordinates; the extrusion occupies y=[0,thickness].
 * layerOffset carries packet spacing through the bend. Each card uses its own
 * neutral radius, preserving mid-thickness material length across packet layers.
 */
export function deformCardPoint(x, y, z, flex) {
  if (!flex.active || flex.angle === 0) return { x, y, z };
  const along = flex.side * x;
  if (along <= flex.hingeX) return { x, y, z };
  const distance = along - flex.hingeX;
  const curvature = flex.angle / flex.span;
  const neutralY = CARD_THICKNESS / 2;
  const neutralCurvature = curvature / (1 - curvature * (flex.layerOffset + neutralY));
  const theta = neutralCurvature * distance;
  const offset = y - neutralY;
  const sine = Math.sin(theta);
  const cosine = Math.cos(theta);
  return {
    x: flex.side * (flex.hingeX + sine / neutralCurvature - offset * sine),
    y: (2 * Math.sin(theta / 2) ** 2) / neutralCurvature + offset * cosine + neutralY,
    z,
  };
}
