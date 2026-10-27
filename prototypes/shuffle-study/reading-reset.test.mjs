import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix3, Matrix4, OrthographicCamera, Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from '../../client/src/motion.mjs';
import { createReadingFan } from '../../client/src/reading-fan.mjs';
import { readingTablePose, sampleSideRevealPose } from '../../client/src/reading-reveal.mjs';
import { PLACEMENT_BOUNDS } from '../../client/src/reading-layout.mjs';
import { DEFAULT_VIEW, VIEW_TARGET, getViewPosition, getFramedViewSize } from '../../client/src/reading-view.mjs';
import { RESET_DURATION_MS, sampleResetPose, shuffleProgressAt } from '../../client/src/reset-motion.mjs';
import { READING_RESET_PRELUDE_MS, READING_RESET_DURATION_MS, READING_RESET_SWEEP_Z, createReadingReset, sampleReadingResetPose, readingShuffleProgressAt } from '../../client/src/reading-reset.mjs';

const ids = Array.from({ length: CARD_COUNT }, (_, id) => id);
const order = ids.map(id => (id * 17 + 23) % CARD_COUNT);
const placedIds = [10, 25, 62];
function snapshotFor(positions = [{ x: -2, z: 0 }, { x: 0, z: 0.3 }, { x: 2, z: -0.2 }]) {
  const fan = createReadingFan(ids);
  return ids.map(id => {
    const placedIndex = placedIds.indexOf(id);
    return placedIndex < 0 ? { id, ...fan[id] }
      : { id, ...readingTablePose({ ...positions[placedIndex], faceUp: placedIndex !== 1 }, placedIndex === 2, placedIndex) };
  });
}
const deckIds = ids.filter(id => !placedIds.includes(id));
const makeRun = (seed = 'reading', positions) => createReadingReset({ seed, snapshot: snapshotFor(positions), deckIds, order });
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
function rotation(p) { return new Matrix4().makeRotationFromEuler(new Euler(p.rx, p.ry, p.rz, 'XYZ')); }
function body(p) {
  const matrix = rotation(p);
  return new OBB(new Vector3(0, CARD_THICKNESS / 2, 0).applyMatrix4(matrix).add(new Vector3(p.x, p.y, p.z)), new Vector3(CARD_WIDTH / 2, CARD_THICKNESS / 2 - 0.00001, CARD_LENGTH / 2), new Matrix3().setFromMatrix4(matrix));
}
function corners(p) {
  const matrix = rotation(p), result = [];
  for (const x of [-CARD_WIDTH / 2, CARD_WIDTH / 2]) for (const y of [0, CARD_THICKNESS]) for (const z of [-CARD_LENGTH / 2, CARD_LENGTH / 2]) result.push(new Vector3(x, y, z).applyMatrix4(matrix).add(new Vector3(p.x, p.y, p.z)));
  return result;
}

test('first frame preserves every identity and pose; only actual table cards become placed inputs', () => {
  const snapshot = snapshotFor(), original = structuredClone(snapshot);
  const run = createReadingReset({ snapshot, deckIds, order, seed: 12 });
  assert.deepEqual(snapshot, original);
  for (const { id, ...pose } of original) assert.deepEqual(sampleReadingResetPose(id, 0, run), pose);
  assert.deepEqual(run.motion.cards.filter(card => card.isPlaced).map(card => card.id).sort((a, b) => a - b), placedIds);
  assert.equal(new Set(run.motion.cards.map(card => card.id)).size, 78);
  snapshot[0].x = 999;
  assert.notEqual(sampleReadingResetPose(0, 0, run).x, 999);
});

test('prelude preserves all fan-relative positions and rotations while placed cards remain fixed', () => {
  const run = makeRun();
  for (const ms of [80, 200, 350, 449.999]) {
    const dz = sampleReadingResetPose(deckIds[0], ms, run).z - run.poseById[deckIds[0]].z;
    for (const id of deckIds) {
      const p = sampleReadingResetPose(id, ms, run), initial = run.poseById[id];
      for (const key of ['x', 'y', 'rx', 'ry', 'rz']) assert.equal(p[key], initial[key]);
      near(p.z - initial.z, dz);
    }
    for (const id of placedIds) assert.deepEqual(sampleReadingResetPose(id, ms, run), run.poseById[id]);
  }
  near(sampleReadingResetPose(0, 449.999, run).z - run.poseById[0].z, READING_RESET_SWEEP_Z, 1e-8);
});

test('separated ordinary, lower-edge and expanded back/side layouts clear sweep and takeoff', () => {
  const b = PLACEMENT_BOUNDS;
  const layouts = [undefined, [{ x: -4.6, z: 0.85 }, { x: 0, z: 0.85 }, { x: 4.6, z: 0.85 }],
    [{ x: b.minX, z: b.minZ }, { x: 0, z: b.minZ }, { x: b.maxX, z: b.minZ }],
    [{ x: b.minX, z: b.minZ }, { x: b.maxX, z: -3 }, { x: 0, z: b.maxZ }]];
  for (const positions of layouts) {
    const run = makeRun('edge', positions);
    for (let frame = 0; frame <= 150; frame += 1) {
      const ms = frame * 5, bodies = ids.map(id => body(sampleReadingResetPose(id, ms, run)));
      for (let i = 0; i < CARD_COUNT; i += 1) for (let j = i + 1; j < CARD_COUNT; j += 1) assert.equal(bodies[i].intersectsOBB(bodies[j], 0), false, `Cards${i}/${j} intersect at${ms}ms`);
    }
  }
});

test('hidden handoff stays outside the actual dedicated shuffle frame', () => {
  const run = makeRun('camera');
  for (const aspect of [1.5, 2, 2.4]) {
    const { width, height } = getFramedViewSize(DEFAULT_VIEW, aspect, 1), position = getViewPosition(DEFAULT_VIEW);
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 100);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z); camera.updateMatrixWorld();
    for (const id of deckIds) for (const ms of [449.999, 450]) {
      const points = corners(sampleReadingResetPose(id, ms, run)).map(point => point.project(camera));
      const outside = ['x', 'y', 'z'].some(axis => points.every(point => point[axis] < -1) || points.every(point => point[axis] > 1));
      assert.ok(outside, `Card${id} visible at dedicated handoff${ms}ms,aspect${aspect}`);
    }
  }
});

test('accepted reset suffix and its shuffle clock are delegated exactly, with fixed seeded identity mapping', () => {
  const run = makeRun('suffix');
  assert.equal(READING_RESET_PRELUDE_MS, 450);
  assert.equal(READING_RESET_DURATION_MS, 5510);
  assert.equal(READING_RESET_DURATION_MS, READING_RESET_PRELUDE_MS + RESET_DURATION_MS);
  for (const id of ids) for (const ms of [0, 150, 300, 900, 1600, 2600, 3110, 3650, 5060]) {
    assert.deepEqual(sampleReadingResetPose(id, ms + 450, run), sampleResetPose(id, ms, run.motion));
    assert.equal(readingShuffleProgressAt(ms + 450), shuffleProgressAt(ms));
  }
  for (const id of placedIds) assert.deepEqual(sampleReadingResetPose(id, 450, run), run.poseById[id]);
  assert.equal(readingShuffleProgressAt(0), 0);
  assert.deepEqual(makeRun('suffix'), run);
  const target = ids.map(id => sampleReadingResetPose(id, 1672, run));
  ids.forEach(id => { sampleReadingResetPose(id, 5510, run); sampleReadingResetPose(id, 0, run); });
  assert.deepEqual(ids.map(id => sampleReadingResetPose(id, 1672, run)), target);
});

test('invalid snapshots, deck membership and elapsed values are rejected', () => {
  assert.throws(() => createReadingReset({ snapshot: [], deckIds }), RangeError);
  const duplicate = snapshotFor(); duplicate[1] = duplicate[0];
  assert.throws(() => createReadingReset({ snapshot: duplicate, deckIds }), RangeError);
  assert.throws(() => createReadingReset({ snapshot: snapshotFor(), deckIds: [1, 1] }), RangeError);
  const run = makeRun();
  assert.throws(() => sampleReadingResetPose(78, 0, run), RangeError);
  assert.throws(() => sampleReadingResetPose(0, NaN, run), TypeError);
});

test('interrupted side turns retain the exact rendered pose through prelude and delegate the accepted suffix unchanged', () => {
  const id = placedIds[0];
  for (const reversed of [false, true]) for (const direction of [-1, 1]) for (const progress of [0.13, 0.5, 0.87]) {
    const snapshot = snapshotFor();
    const partial = sampleSideRevealPose(readingTablePose({ x: -2, z: 0, faceUp: true }, reversed), progress, direction);
    snapshot[id] = { id, ...partial };
    const original = structuredClone(snapshot);
    const run = createReadingReset({ snapshot, deckIds, order, seed: 'interrupted-reveal' });
    assert.deepEqual(snapshot, original);
    for (const ms of [0, 170, 449.999, 450]) assert.deepEqual(sampleReadingResetPose(id, ms, run), partial);
    // A tiny advance must not re-encode a signed roll through another Euler
    // branch. Check world corners and the authored numeric angle continuity.
    const after = sampleReadingResetPose(id, 450.001, run);
    near(after.rz, partial.rz, 1e-6);
    const initialCorners = corners(partial), afterCorners = corners(after);
    initialCorners.forEach((corner, index) => assert.ok(corner.distanceTo(afterCorners[index]) < 1e-6));
    for (let ms = 450; ms <= 750; ms += 5) for (const corner of corners(sampleReadingResetPose(id, ms, run))) assert.ok(corner.y > 0.025, `Interrupted reveal below table at ${ms}ms`);
    for (const physicalId of ids) for (const ms of [0, 150, 300, 2600, 3650, 5060]) {
      assert.deepEqual(sampleReadingResetPose(physicalId, ms + 450, run), sampleResetPose(physicalId, ms, run.motion));
      assert.equal(readingShuffleProgressAt(ms + 450), shuffleProgressAt(ms));
    }
  }
});
