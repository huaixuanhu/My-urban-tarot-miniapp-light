import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix3, Matrix4, Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS, samplePose } from '../../client/src/motion.mjs';
import { RESET_PREFIX_MS, RESET_SHUFFLE_START_MS, RESET_DURATION_MS, COLLECT_START_MS, RESET_PATH_TIME_MS, createResetRun, sampleResetPose, resetPhaseAt, shuffleProgressAt, resetPathProgressAt, resetPathRateAt } from '../../client/src/reset-motion.mjs';

const order = Array.from({ length: CARD_COUNT }, (_, i) => (i * 17 + 23) % CARD_COUNT);
const placed = [-1.9, 0, 1.9].map((x, id) => ({ id, x, y: 0.045, z: [0.10, -0.12, 0.10][id], rx: Math.PI, ry: [-0.10, 0.02, 0.12][id], rz: 0 }));
const makeRun = seed => createResetRun({ seed, order, placed });
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
function bodyBounds(p) {
  const rotation = new Matrix4().makeRotationFromEuler(new Euler(p.rx, p.ry, p.rz, 'XYZ'));
  const center = new Vector3(0, CARD_THICKNESS / 2, 0).applyMatrix4(rotation).add(new Vector3(p.x, p.y, p.z));
  return new OBB(center, new Vector3(CARD_WIDTH / 2, CARD_THICKNESS / 2 - 0.00001, CARD_LENGTH / 2), new Matrix3().setFromMatrix4(rotation));
}

test('run preserves all physical identities and supplied face-up poses', () => {
  const inputOrder = [...order], inputPlaced = structuredClone(placed);
  const run = createResetRun({ seed: 42, order: inputOrder, placed: inputPlaced });
  assert.deepEqual(inputOrder, order); assert.deepEqual(inputPlaced, placed);
  assert.equal(new Set(run.cards.map(card => card.id)).size, CARD_COUNT);
  for (let slot = 0; slot < CARD_COUNT; slot += 1) assert.equal(run.slotById[order[slot]], slot);
  for (const { id, ...pose } of placed) assert.deepEqual(sampleResetPose(id, 0, run), pose);
  assert.deepEqual(new Set(run.cards.filter(card => !card.isPlaced).map(card => card.edge)), new Set([0, 1, 2, 3]));
  inputOrder.reverse(); inputPlaced[0].x = 99;
  assert.deepEqual(run.order, order); assert.equal(sampleResetPose(0, 0, run).x, -1.9);
});

test('same seed reproduces paths and scrubbing preserves the run', () => {
  const first = makeRun('one'), second = makeRun('one'), different = makeRun('two');
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.cards.map(card => card.target), different.cards.map(card => card.target));
  for (let id = 0; id < CARD_COUNT; id += 1) {
    const middle = sampleResetPose(id, 1850, first);
    sampleResetPose(id, RESET_DURATION_MS, first); sampleResetPose(id, 0, first);
    assert.deepEqual(sampleResetPose(id, 1850, first), middle);
    assert.deepEqual(middle, sampleResetPose(id, 1850, second));
  }
});

test('cards pass through the airborne spread without stopping or descending to the table', () => {
  const run = makeRun('continuous');
  for (let id = 0; id < CARD_COUNT; id += 1) {
    for (const ms of [900, 1400, 1550, 1600, 1650, 1900, 2200, 2450]) {
      const a = sampleResetPose(id, ms - 10, run), b = sampleResetPose(id, ms + 10, run);
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > 1e-4, `Card${id} stalls near${ms}ms`);
    }
    for (let ms = 300; ms <= RESET_PREFIX_MS; ms += 25) {
      const pose = sampleResetPose(id, ms, run);
      assert.ok(pose.y >= 0.30 - 1e-8);
      near(pose.rx, 0); near(pose.rz, 0);
    }
    const before = sampleResetPose(id, 1599.9, run), at = sampleResetPose(id, 1600, run), after = sampleResetPose(id, 1600.1, run);
    for (const key of ['x', 'y', 'z', 'ry']) near((at[key] - before[key]) / 0.1, (after[key] - at[key]) / 0.1, 3e-6);
  }
});

test('incoming clock is calm and gathering rate increases smoothly to normal speed', () => {
  assert.equal(resetPathRateAt(600), 0.5);
  assert.equal(resetPathRateAt(1500), 0.5);
  let previous = 0.5;
  for (let ms = COLLECT_START_MS; ms <= RESET_PREFIX_MS; ms += 10) {
    const rate = resetPathRateAt(ms);
    assert.ok(rate >= previous && rate <= 1);
    previous = rate;
  }
  assert.equal(resetPathRateAt(RESET_PREFIX_MS), 1);
  assert.equal(resetPathRateAt(RESET_PREFIX_MS + 500), 1);
  near(resetPathProgressAt(300), 0); near(resetPathProgressAt(RESET_PREFIX_MS), 1);
  for (const ms of [800, 1500, 1700, 2100, 2500]) {
    const numericalRate = (resetPathProgressAt(ms + 0.01) - resetPathProgressAt(ms - 0.01)) * RESET_PATH_TIME_MS / 0.02;
    near(numericalRate, resetPathRateAt(ms), 1e-8);
  }
  const run = makeRun('acceleration');
  const speed = ms => {
    const a = sampleResetPose(20, ms - 5, run), b = sampleResetPose(20, ms + 5, run);
    return Math.hypot(b.x - a.x, b.z - a.z) / 10;
  };
  assert.ok(speed(2100) > speed(1650) * 1.5, 'Visible convergence accelerates before final braking.');
});

test('aerial cuboid joins original lifted pose and suffix clock remains exactly unchanged', () => {
  const run = makeRun('handoff');
  assert.equal(RESET_PREFIX_MS, 2600); assert.equal(RESET_SHUFFLE_START_MS, 540); assert.equal(RESET_DURATION_MS, 5060);
  assert.equal(shuffleProgressAt(2599), 0); near(shuffleProgressAt(2600), 0.18);
  for (let id = 0; id < CARD_COUNT; id += 1) {
    for (const oldMs of [540, 700, 1050, 1590, 2160, 2460, 3000]) {
      const ms = RESET_PREFIX_MS + oldMs - RESET_SHUFFLE_START_MS;
      near(shuffleProgressAt(ms), oldMs / 3000);
      assert.deepEqual(sampleResetPose(id, ms, run), samplePose(run.slotById[id], oldMs / 3000));
    }
  }
  near((shuffleProgressAt(3651) - shuffleProgressAt(3650)) * 3000, 1);
  assert.deepEqual([0, 1600, 2600, 3110, 3650, 5060].map(resetPhaseAt), ['fly', 'collect', 'split', 'riffle', 'riffle', 'ready']);
});

test('all prefix boundaries and the handoff are continuous', () => {
  const run = makeRun('boundaries');
  for (let id = 0; id < CARD_COUNT; id += 1) {
    for (const time of [0, 300, COLLECT_START_MS, RESET_PREFIX_MS]) {
      const a = sampleResetPose(id, time - 1e-5, run), b = sampleResetPose(id, time + 1e-5, run);
      for (const key of ['x', 'y', 'z', 'rx', 'ry', 'rz']) near(a[key], b[key], 1e-5);
    }
  }
});

test('aerial paths and convergence avoid solid intersections for multiple seeded runs', () => {
  for (const seed of ['flight-one', 'flight-two', 'flight-three']) {
    const run = makeRun(seed);
    const times = new Set(Array.from({ length: 313 }, (_, frame) => frame * RESET_PREFIX_MS / 312));
    for (const boundary of [300, COLLECT_START_MS, RESET_PREFIX_MS]) for (const offset of [-0.173, 0, 0.173]) times.add(Math.min(RESET_PREFIX_MS, boundary + offset));
    for (const ms of times) {
      const poses = Array.from({ length: CARD_COUNT }, (_, id) => sampleResetPose(id, ms, run));
      const cards = poses.map(bodyBounds);
      for (const p of poses) {
        for (const value of Object.values(p)) assert.ok(Number.isFinite(value));
        assert.ok(Math.abs(p.x) <= 12.3 && Math.abs(p.z) <= 11.2);
        assert.ok(p.y >= 0.025 - 1e-8 && p.y < 2.2);
      }
      for (let i = 0; i < CARD_COUNT; i += 1) for (let j = i + 1; j < CARD_COUNT; j += 1) {
        assert.equal(cards[i].intersectsOBB(cards[j], 0), false, `Cards${i}/${j} intersect at${ms}ms, seed=${seed}`);
      }
    }
  }
});

test('invalid identity maps and nonfinite times are rejected', () => {
  assert.throws(() => createResetRun({ order: Array(CARD_COUNT).fill(0) }), RangeError);
  assert.throws(() => createResetRun({ placed: [placed[0], placed[0]] }), RangeError);
  const run = makeRun(1);
  assert.throws(() => sampleResetPose(78, 0, run), RangeError);
  assert.throws(() => sampleResetPose(0, NaN, run), TypeError);
  assert.throws(() => resetPhaseAt(Infinity), TypeError);
});
