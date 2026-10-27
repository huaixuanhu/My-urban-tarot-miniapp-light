import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix3, Matrix4, Vector3 } from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import {
  CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS, DURATION_MS,
  samplePose, phaseAt, shuffleDeck, flexLayerGapAt,
} from '../../client/src/motion.mjs';

const keys = ['x', 'y', 'z', 'rx', 'ry', 'rz'];
const near = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
};

test('study dimensions and duration match the scene contract', () => {
  assert.deepEqual(
    [CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS, DURATION_MS],
    [78, 1.24, 2.04, 0.009, 3000],
  );
});

test('starts as a complete aligned stack and finishes in a stable shallow fan', () => {
  const finalCards = [];
  for (let index = 0; index < CARD_COUNT; index += 1) {
    const start = samplePose(index, 0);
    assert.deepEqual(start, { x: 0, y: 0.025 + index * CARD_THICKNESS, z: 0, rx: 0, ry: 0, rz: 0 });
    assert.deepEqual(samplePose(index, -1), start);
    const end = samplePose(index, 1);
    assert.deepEqual(samplePose(index, 4), end);
    finalCards.push(end);
    assert.ok(end.z >= 0.1 && end.z <= 1);
  }
  finalCards.sort((a, b) => a.x - b.x);
  for (let order = 0; order < finalCards.length; order += 1) {
    near(finalCards[order].y, 0.10 + order * 0.0025);
    if (order > 0) assert.ok(finalCards[order].x > finalCards[order - 1].x);
  }
  near(samplePose(0, 1).x, -4.5);
  near(samplePose(CARD_COUNT - 1, 1).x, 4.5);
});

test('each half splits as a rigid packet with raised inner edges', () => {
  const left = samplePose(0, 0.35);
  const right = samplePose(39, 0.35);
  assert.ok(left.x < -0.8 && right.x > 0.8);
  assert.ok(left.rz > 0 && right.rz < 0);
  for (const offset of [0, 39]) {
    for (let index = offset + 1; index < offset + 39; index += 1) {
      const a = samplePose(index - 1, 0.35);
      const b = samplePose(index, 0.35);
      near(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), CARD_THICKNESS + flexLayerGapAt(0.35));
    }
  }
});

test('riffle releases bottom cards first and interleaves both halves completely', () => {
  const during = 0.35 + (0.72 - 0.35) * 0.30;
  assert.ok(Math.abs(samplePose(0, during).x) < Math.abs(samplePose(38, during).x));
  assert.ok(Math.abs(samplePose(39, during).x) < Math.abs(samplePose(77, during).x));
  const heights = [];
  for (let local = 0; local < 39; local += 1) {
    const left = samplePose(local, 0.72);
    const right = samplePose(local + 39, 0.72);
    near(left.x, 0);
    near(right.x, 0);
    near(right.y - left.y, CARD_THICKNESS);
    heights.push(left.y, right.y);
  }
  for (let index = 1; index < heights.length; index += 1) {
    near(heights[index] - heights[index - 1], CARD_THICKNESS);
  }
});

test('all sampled poses stay finite and within the bounded tabletop choreography', () => {
  for (let step = 0; step <= 600; step += 1) {
    for (let index = 0; index < CARD_COUNT; index += 1) {
      const current = samplePose(index, step / 600);
      for (const key of keys) assert.ok(Number.isFinite(current[key]), `${key} is finite`);
      assert.ok(Math.abs(current.x) <= 4.5 + 1e-12);
      assert.ok(current.y >= 0.025 - 1e-12 && current.y < 1.1);
      assert.ok(current.z >= -0.04 && current.z <= 1);
      assert.ok(Math.abs(current.rx) <= 0.3 && Math.abs(current.ry) <= 0.3 && Math.abs(current.rz) <= 0.3);
    }
  }
});

function solidCardBounds(current) {
  const rotation = new Matrix4().makeRotationFromEuler(new Euler(current.rx, current.ry, current.rz, 'XYZ'));
  // The actual extrusion occupies local y=[0, thickness], not +/- thickness/2.
  const center = new Vector3(0, CARD_THICKNESS / 2, 0).applyMatrix4(rotation)
    .add(new Vector3(current.x, current.y, current.z));
  // Retain the entire width/length; the tiny thickness tolerance only excludes
  // face contact and floating-point noise, not material card penetration.
  return new OBB(center, new Vector3(CARD_WIDTH / 2, CARD_THICKNESS / 2 - 0.00001, CARD_LENGTH / 2), new Matrix3().setFromMatrix4(rotation));
}

test('rigid pose skeleton remains separate throughout a 60 fps three-second sweep', () => {
  for (let frame = 0; frame <= 180; frame += 1) {
    const t = frame / 180;
    const cards = Array.from({ length: CARD_COUNT }, (_, index) => solidCardBounds(samplePose(index, t)));
    for (let first = 0; first < cards.length; first += 1) {
      for (let second = first + 1; second < cards.length; second += 1) {
        assert.equal(cards[first].intersectsOBB(cards[second], 0), false, `Cards ${first}/${second} intersect at t=${t}`);
      }
    }
  }
});

test('fan preserves the settled stack order and keeps every card in parallel layers', () => {
  const settledOrder = Array.from({ length: CARD_COUNT }, (_, index) => ({ index, y: samplePose(index, 0.82).y }))
    .sort((a, b) => a.y - b.y).map(card => card.index);
  const fanOrder = Array.from({ length: CARD_COUNT }, (_, index) => ({ index, x: samplePose(index, 1).x }))
    .sort((a, b) => a.x - b.x).map(card => card.index);
  assert.deepEqual(fanOrder, settledOrder);
  for (const t of [0.83, 0.86, 0.9, 0.95, 1]) {
    const normal = new Vector3(0, 1, 0);
    let previous;
    for (const index of settledOrder) {
      const current = samplePose(index, t);
      const rotation = new Matrix4().makeRotationFromEuler(new Euler(current.rx, current.ry, current.rz, 'XYZ'));
      const transformed = normal.clone().transformDirection(rotation);
      if (previous) near(transformed.distanceTo(previous), 0, 1e-12);
      previous = transformed;
    }
  }
});

test('phase boundaries are continuous for every card', () => {
  for (const boundary of [0, 0.07, 0.18, 0.35, 0.72, 0.82, 1]) {
    for (let index = 0; index < CARD_COUNT; index += 1) {
      const before = samplePose(index, boundary - 1e-7);
      const after = samplePose(index, boundary + 1e-7);
      for (const key of keys) near(before[key], after[key], 1e-6);
    }
  }
  assert.deepEqual(
    [-1, 0.1, 0.2, 0.4, 0.75, 0.9, 1, 2].map(phaseAt),
    ['gather', 'lift', 'split', 'riffle', 'settle', 'spread', 'ready', 'ready'],
  );
});

test('sampling is deterministic, stateless, and supports odd or single-card decks', () => {
  for (const count of [1, 3, 77, 79]) {
    for (let index = 0; index < count; index += 1) {
      const expected = samplePose(index, 0.63, count);
      samplePose(index, 1, count);
      samplePose(index, 0, count);
      assert.deepEqual(samplePose(index, 0.63, count), expected);
      for (const time of [0, 0.35, 0.6, 0.72, 1]) {
        for (const value of Object.values(samplePose(index, time, count))) assert.ok(Number.isFinite(value));
      }
    }
  }
  assert.throws(() => samplePose(-1, 0), RangeError);
  assert.throws(() => samplePose(78, 0), RangeError);
  assert.throws(() => samplePose(0, 0, 0), RangeError);
  assert.throws(() => samplePose(0, NaN), TypeError);
});

test('shuffle preserves all identities, never mutates input, and uses one random choice per swap', () => {
  const ids = Object.freeze(Array.from({ length: CARD_COUNT }, (_, index) => `card-${index}`));
  let calls = 0;
  const shuffled = shuffleDeck(ids, () => { calls += 1; return 0; });
  assert.equal(calls, CARD_COUNT - 1);
  assert.deepEqual([...shuffled].sort(), [...ids].sort());
  assert.equal(new Set(shuffled).size, CARD_COUNT);
  assert.notDeepEqual(shuffled, ids);
  assert.deepEqual(ids, Array.from({ length: CARD_COUNT }, (_, index) => `card-${index}`));
  assert.deepEqual(shuffleDeck([], () => { throw new Error('unused'); }), []);
  assert.deepEqual(shuffleDeck(['one'], () => { throw new Error('unused'); }), ['one']);
  assert.deepEqual(shuffleDeck(ids, () => 0.999999), ids);
});

test('three-card Fisher–Yates choices cover every permutation exactly once', () => {
  const outcomes = new Set();
  for (let first = 0; first < 3; first += 1) {
    for (let second = 0; second < 2; second += 1) {
      const choices = [(first + 0.5) / 3, (second + 0.5) / 2];
      outcomes.add(shuffleDeck(['a', 'b', 'c'], () => choices.shift()).join(''));
    }
  }
  assert.deepEqual([...outcomes].sort(), ['abc', 'acb', 'bac', 'bca', 'cab', 'cba']);
  for (const invalid of [-0.1, 1, NaN, Infinity]) {
    assert.throws(() => shuffleDeck(['a', 'b'], () => invalid), RangeError);
  }
});
