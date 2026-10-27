/**
 * Renderer-independent, three-second shuffle choreography.
 * X/Z are the table plane, Y is up, and rotations are Euler XYZ in radians.
 * Index is a visual slot; randomized card identities are supplied separately.
 */
export const CARD_COUNT = 78;
export const CARD_WIDTH = 1.24;
export const CARD_LENGTH = 2.04;
export const CARD_THICKNESS = 0.009;
export const DURATION_MS = 3000;
export const RIFFLE_TIMING = Object.freeze({ start: 0.35, end: 0.72, leveling: 0.12, releaseSpan: 0.8, flightSpan: 0.14, moveStart: 0.55 });

const PHASE_ENDS = [0.07, 0.18, 0.35, 0.72, 0.82, 1];
const PHASE_NAMES = ['gather', 'lift', 'split', 'riffle', 'settle', 'spread'];
const TABLE_CLEARANCE = 0.025;
const POSE_KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz'];

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const progress = (t, start, end) => clamp((t - start) / (end - start));
const pose = (x, y, z = 0, rx = 0, ry = 0, rz = 0) => ({ x, y, z, rx, ry, rz });
const mix = (from, to, amount) => Object.fromEntries(
  POSE_KEYS.map(key => [key, from[key] + (to[key] - from[key]) * amount]),
);

// Card centers follow the packet's rotation; independently interpolating their
// positions would compress the solid layers while the packet tilts.
const packetPose = (centerX, centerY, localHeight, angle) => pose(
  centerX - Math.sin(angle) * localHeight,
  centerY + Math.cos(angle) * localHeight,
  0, 0, 0, angle,
);

// Rz(roll) * Ry(yaw), expressed in the renderer's Euler XYZ convention.
// Yaw stays within the shared card plane, keeping all fan normals parallel.
const fanRotation = (roll, yaw) => ({
  rx: Math.atan2(-Math.sin(roll) * Math.sin(yaw), Math.cos(yaw)),
  ry: Math.asin(Math.cos(roll) * Math.sin(yaw)),
  rz: Math.atan2(Math.sin(roll), Math.cos(roll) * Math.cos(yaw)),
});

function normalizedTime(t) {
  if (!Number.isFinite(t)) throw new TypeError('Time must be finite.');
  return clamp(t);
}

export function phaseAt(t) {
  const time = normalizedTime(t);
  if (time === 1) return 'ready';
  return PHASE_NAMES[PHASE_ENDS.findIndex(end => time < end)];
}

/** Small air gap prevents adjacent curved mesh chords crossing at face contact. */
export function flexLayerGapAt(t) {
  const time = normalizedTime(t);
  if (time <= 0.32 || time >= 0.72) return 0;
  return 0.0002 * smooth(progress(time, 0.32, 0.35)) * (1 - smooth(progress(time, 0.70, 0.72)));
}

/** Sample a pose directly at any time, including backward scrubbing. */
function sampleRigidPose(index, t, count = CARD_COUNT) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('Card count must be a positive integer.');
  }
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError('Card index must belong to the deck.');
  }
  const time = normalizedTime(t);
  const [gatherEnd, liftEnd, splitEnd, riffleEnd, settleEnd] = PHASE_ENDS;
  const leftCount = Math.ceil(count / 2);
  const isLeft = index < leftCount;
  const groupSize = isLeft ? leftCount : count - leftCount;
  const localIndex = isLeft ? index : index - leftCount;
  const side = isLeft ? -1 : 1;
  const interleavedIndex = localIndex * 2 + (isLeft ? 0 : 1);

  const initial = pose(0, TABLE_CLEARANCE + index * CARD_THICKNESS);
  const gathered = initial;
  const lifted = pose(0, 0.30 + index * CARD_THICKNESS);

  // Rotate each half as a rigid packet, with its inner edge raised.
  const tilt = -side * 0.21;
  const halfHeight = (groupSize - 1) * CARD_THICKNESS / 2;
  const heightFromCenter = localIndex * CARD_THICKNESS - halfHeight;
  const interleaved = pose(0, 0.12 + interleavedIndex * CARD_THICKNESS);
  const settled = pose(0, TABLE_CLEARANCE + interleavedIndex * CARD_THICKNESS);

  // Keep the interleaved physical order when opening the deck.
  const fanFraction = count === 1 ? 0.5 : interleavedIndex / (count - 1);
  const fanOffset = fanFraction * 2 - 1;
  // Common roll gives adjacent overlapping solid cards clearance in the fan.
  const fan = pose(
    fanOffset * 4.5,
    0.10 + interleavedIndex * 0.0025,
    0.1 + fanOffset * fanOffset * 0.9,
  );
  Object.assign(fan, fanRotation(-0.10, fanOffset * 0.27));

  if (time < gatherEnd) return mix(initial, gathered, smooth(time / gatherEnd));
  if (time < liftEnd) return mix(gathered, lifted, smooth(progress(time, gatherEnd, liftEnd)));
  if (time < splitEnd) {
    const splitting = progress(time, liftEnd, splitEnd);
    const separation = smooth(splitting / 0.60);
    // Move clear of the other packet before lowering the upper half or tilting.
    const lowering = smooth(progress(splitting, 0.60, 1));
    const originalCenterY = 0.30 + (isLeft ? 0 : leftCount * CARD_THICKNESS) + halfHeight;
    return packetPose(
      side * 0.9 * separation,
      originalCenterY + (0.33 + halfHeight - originalCenterY) * lowering,
      heightFromCenter,
      tilt * lowering,
    );
  }

  if (time < riffleEnd) {
    const riffleProgress = progress(time, splitEnd, riffleEnd);
    const levelBase = 0.12 + (isLeft ? 0 : CARD_THICKNESS);
    if (riffleProgress < RIFFLE_TIMING.leveling) {
      const leveling = smooth(riffleProgress / RIFFLE_TIMING.leveling);
      return packetPose(
        side * 0.9,
        0.33 + halfHeight + (levelBase - 0.33) * leveling,
        heightFromCenter,
        tilt * (1 - leveling),
      );
    }
    const riffling = progress(riffleProgress, RIFFLE_TIMING.leveling, 1);
    const interval = leftCount === 1 ? RIFFLE_TIMING.releaseSpan : RIFFLE_TIMING.releaseSpan / (leftCount - 1);
    const release = localIndex * interval + (isLeft ? 0 : interval / 2);
    const flight = progress(riffling, release, release + RIFFLE_TIMING.flightSpan);
    // The held packet rises one layer per release, creating room for the other
    // half. Released cards travel at their final interleaved layer height.
    const rawLayer = riffling / interval;
    const layer = Math.floor(rawLayer) + smooth(rawLayer % 1);
    return pose(
      side * 0.9 * (1 - smooth(progress(flight, RIFFLE_TIMING.moveStart, 1))),
      levelBase + (localIndex + Math.min(localIndex, layer)) * CARD_THICKNESS,
      side * 0.035 * Math.sin(Math.PI * flight) ** 2,
    );
  }

  if (time < settleEnd) {
    return mix(interleaved, settled, smooth(progress(time, riffleEnd, settleEnd)));
  }
  if (time === 1) return fan;
  const spreading = smooth(progress(time, settleEnd, 1));
  const finalRoll = -0.10;
  const roll = finalRoll * spreading;
  // Open in a shared tilted plane. Its layer spacing grows, never compresses,
  // so the solid cards do not cut through one another during the opening.
  const finalLocalX = Math.cos(finalRoll) * fan.x + Math.sin(finalRoll) * fan.y;
  const finalLocalY = -Math.sin(finalRoll) * fan.x + Math.cos(finalRoll) * fan.y;
  const localX = finalLocalX * spreading;
  const localY = settled.y + (finalLocalY - settled.y) * spreading;
  const opening = pose(
    Math.cos(roll) * localX - Math.sin(roll) * localY,
    Math.sin(roll) * localX + Math.cos(roll) * localY + 0.16 * Math.sin(Math.PI * spreading),
    fan.z * spreading,
  );
  return Object.assign(opening, fanRotation(roll, fanOffset * 0.27 * spreading));
}

export function samplePose(index, t, count = CARD_COUNT) {
  const current = sampleRigidPose(index, t, count);
  const leftCount = Math.ceil(count / 2);
  const localIndex = index < leftCount ? index : index - leftCount;
  const gap = localIndex * flexLayerGapAt(t);
  // Flex is active only in the X/Y bend plane; the packet's normal rotates
  // about Z while splitting/leveling. The matching flex offset uses this gap.
  current.x -= Math.sin(current.rz) * gap;
  current.y += Math.cos(current.rz) * gap;
  return current;
}

/** Fisher–Yates permutation; never mutates the caller's identity list. */
export function shuffleDeck(ids, random = Math.random) {
  const result = Array.from(ids);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Random source must return a finite value in [0, 1).');
    }
    const other = Math.floor(value * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
