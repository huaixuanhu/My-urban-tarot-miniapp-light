import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix3, Matrix4, OrthographicCamera, Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from './motion.mjs';
import { createReadingFan } from './reading-fan.mjs';
import { RESET_DURATION_MS, sampleResetPose, shuffleProgressAt } from './reset-motion.mjs';
import { READING_RESET_PRELUDE_MS, READING_RESET_DURATION_MS, READING_RESET_SWEEP_Z, createReadingReset, sampleReadingResetPose, readingShuffleProgressAt } from './reading-reset.mjs';

const ids = Array.from({ length: CARD_COUNT }, (_, id) => id);
const order = ids.map(id => (id * 17 + 23) % CARD_COUNT);
const placedIds = [10, 25, 62];
function snapshotFor(positions = [{ x: -2, z: 0 }, { x: 0, z: 0.3 }, { x: 2, z: -0.2 }]) {
  const fan = createReadingFan(ids);
  return ids.map(id => {
    const placedIndex = placedIds.indexOf(id);
    return placedIndex < 0 ? { id, ...fan[id] }
      : { id, ...positions[placedIndex], y: 0.055 + placedIndex * 0.012, rx: placedIndex === 1 ? 0 : Math.PI, ry: placedIndex === 2 ? Math.PI : 0, rz: 0 };
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

test('separated ordinary and lower-edge table layouts remain clear during sweep and takeoff', () => {
  const layouts = [undefined, [{ x: -4.6, z: 0.85 }, { x: 0, z: 0.85 }, { x: 4.6, z: 0.85 }]];
  for (const positions of layouts) {
    const run = makeRun('edge', positions);
    for (let frame = 0; frame <= 150; frame += 1) {
      const ms = frame * 5, bodies = ids.map(id => body(sampleReadingResetPose(id, ms, run)));
      for (let i = 0; i < CARD_COUNT; i += 1) for (let j = i + 1; j < CARD_COUNT; j += 1) assert.equal(bodies[i].intersectsOBB(bodies[j], 0), false, `Cards${i}/${j} intersect at${ms}ms`);
    }
  }
});

test('hidden handoff is outside the verified desktop camera framing', () => {
  const run = makeRun('camera');
  for (const width of [12.8, 17]) {
    const camera = new OrthographicCamera(-width / 2, width / 2, 3.8, -3.8, 0.1, 100);
    camera.position.set(0, 10.5, 11.7); camera.lookAt(0, 0.1, 0.3); camera.updateMatrixWorld();
    for (const id of deckIds) for (const ms of [449.999, 450]) {
      const points = corners(sampleReadingResetPose(id, ms, run)).map(point => point.project(camera));
      const outside = ['x', 'y', 'z'].some(axis => points.every(point => point[axis] < -1) || points.every(point => point[axis] > 1));
      assert.ok(outside, `Card${id} visible at desktop handoff${ms}ms,width${width}`);
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
