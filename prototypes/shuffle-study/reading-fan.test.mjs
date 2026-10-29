import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix4, OrthographicCamera, Raycaster, Vector2, Vector3 } from 'three';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from '../../client/src/motion.mjs';
import { createReadingFan } from '../../client/src/reading-fan.mjs';
import { createReadingProjection } from '../../client/src/reading-projection.mjs';
import { pickFan } from '../../client/src/reading-picking.mjs';
import { DEFAULT_VIEW, VIEW_LIMITS, VIEW_TARGET, getViewPosition, getViewSize } from '../../client/src/reading-view.mjs';

function preparedOrders(count) {
  let seed = 0x1a2b3c4d;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: count }, () => {
    const order = Array.from({ length: CARD_COUNT }, (_, id) => id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  });
}

const orders = preparedOrders(512);
// Keep the existing geometry coverage varied after decoupling layout from order.
const layoutSeeds = orders.map((_, index) => Math.imul(index + 1, 0x9e3779b9) >>> 0);
function matrixFor(pose) {
  const matrix = new Matrix4().makeRotationFromEuler(new Euler(pose.rx, pose.ry, pose.rz, 'XYZ'));
  return matrix.setPosition(pose.x, pose.y, pose.z);
}
function solidCorners(pose) {
  const matrix = matrixFor(pose), corners = [];
  for (const x of [-CARD_WIDTH / 2, CARD_WIDTH / 2]) {
    for (const y of [0, CARD_THICKNESS]) for (const z of [-CARD_LENGTH / 2, CARD_LENGTH / 2]) {
      corners.push(new Vector3(x, y, z).applyMatrix4(matrix));
    }
  }
  return corners;
}

test('prepared fan is deterministic, immutable, and varies with an independent presentation seed', () => {
  const order = [...orders[0]], before = [...order], seed = layoutSeeds[0];
  const fan = createReadingFan(order, seed);
  assert.deepEqual(order, before);
  assert.deepEqual(fan, createReadingFan(before, seed));
  assert.notDeepEqual(fan, createReadingFan(before, layoutSeeds[1]));
  assert.equal(fan.length, CARD_COUNT);
  assert.ok(Object.isFrozen(fan) && fan.every(Object.isFrozen));
  order.reverse();
  assert.deepEqual(fan, createReadingFan(before, seed));
});

test('fan geometry is invariant under physical-card relabeling', () => {
  const canonical = Array.from({ length: CARD_COUNT }, (_, id) => id);
  const swapped = [...canonical]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const relabeled = [swapped, [...canonical].reverse(), ...orders.slice(0, 8)];
  for (const seed of [0, 1, 2196374898, 0xffffffff]) {
    const expected = createReadingFan(canonical, seed);
    for (const order of relabeled) assert.deepEqual(createReadingFan(order, seed), expected);
  }
  // Omitting the seed gives one fixed staging layout for every physical order.
  const staging = createReadingFan(canonical);
  assert.deepEqual(staging, createReadingFan(canonical, 2196374898));
  for (const order of relabeled) assert.deepEqual(createReadingFan(order), staging);
});

test('the same screen coordinates pick the same ordinal after physical-card relabeling', () => {
  const canonical = Array.from({ length: CARD_COUNT }, (_, id) => id);
  const swapped = [...canonical]; [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const relabeled = [swapped, [...canonical].reverse(), orders[0]];
  const projection = createReadingProjection(), raycaster = new Raycaster();
  const views = [DEFAULT_VIEW,
    { yaw: Math.PI / 2, elevation: DEFAULT_VIEW.elevation, zoom: 1 },
    { yaw: 0, elevation: VIEW_LIMITS.elevation.max, zoom: 1 }];
  for (const seed of [0, 0xffffffff]) {
    const fan = createReadingFan(canonical, seed);
    for (const removed of [[], [0, 9, 37, 62, 77]]) {
      const candidates = order => createReadingFan(order, seed).map((pose, ordinal) => ({ id: order[ordinal], ordinal, pose }))
        .filter(card => !removed.includes(card.ordinal));
      const base = candidates(canonical);
      const variants = relabeled.map(order => ({ order, cards: candidates(order) }));
      // Cover card centers, a gap boundary and empty table, with and without prior draws.
      const points = [5, 17, 38, 55, 70].map(ordinal => fan[ordinal]);
      points.push({ x: (fan[5].x + fan[6].x) / 2, y: (fan[5].y + fan[6].y) / 2, z: (fan[5].z + fan[6].z) / 2 });
      points.push({ x: 0, y: 0.05, z: -0.7 });
      for (const view of views) {
        const camera = projection.update(view, { width: 1440, height: 1000 });
        for (const [index, point] of points.entries()) {
          const screen = new Vector3(point.x, point.y, point.z).project(camera);
          raycaster.setFromCamera(new Vector2(screen.x, screen.y), camera);
          const expected = canonical.indexOf(pickFan(raycaster.ray, base));
          if (index < 5) assert.equal(expected, [5, 17, 38, 55, 70][index]);
          for (const { order, cards } of variants) {
            assert.equal(order.indexOf(pickFan(raycaster.ray, cards)), expected);
          }
        }
      }
    }
  }
});

test('invalid presentation seeds are rejected without coercion', () => {
  for (const seed of [-1, 0x100000000, 0.5, NaN, Infinity, null, '12', {}, 12n]) {
    assert.throws(() => createReadingFan(orders[0], seed), RangeError);
  }
  for (const seed of [0, 0xffffffff]) assert.doesNotThrow(() => createReadingFan(orders[0], seed));
});

test('invalid or sparse physical orders are rejected', () => {
  const sparse = [...orders[0]]; delete sparse[7];
  for (const order of [null, [], Array(CARD_COUNT).fill(0), sparse, [...orders[0].slice(1), CARD_COUNT]]) {
    assert.throws(() => createReadingFan(order), RangeError);
  }
});

test('irregular cards retain parallel planes and a positive solid-paper gap', () => {
  for (const [index, order] of orders.entries()) {
    const fan = createReadingFan(order, layoutSeeds[index]);
    const first = fan[0], normal = new Vector3(0, 1, 0).applyEuler(new Euler(first.rx, first.ry, first.rz, 'XYZ'));
    for (let i = 0; i < fan.length; i++) {
      const pose = fan[i];
      assert.ok(Object.values(pose).every(Number.isFinite));
      const currentNormal = new Vector3(0, 1, 0).applyEuler(new Euler(pose.rx, pose.ry, pose.rz, 'XYZ'));
      assert.ok(currentNormal.distanceTo(normal) < 1e-12);
      if (!i) continue;
      const previous = fan[i - 1];
      assert.ok(pose.x > previous.x);
      const separation = new Vector3(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z).dot(normal);
      assert.ok(separation >= 0.013 - 1e-12);
      assert.ok(separation - CARD_THICKNESS >= 0.004 - 1e-12);
    }
  }
});

test('full solid corners clear the cloth across 512 independent presentation seeds', t => {
  let minimum = Infinity, maximum = -Infinity;
  for (const [index, order] of orders.entries()) for (const pose of createReadingFan(order, layoutSeeds[index])) for (const corner of solidCorners(pose)) {
    minimum = Math.min(minimum, corner.y); maximum = Math.max(maximum, corner.y);
    // 0.015 conservatively exceeds the cloth's current highest point.
    assert.ok(corner.y - 0.015 > 0.025, `Insufficient cloth clearance: ${corner.y}`);
    assert.ok(corner.y < 1.10, 'Resting fan exceeds the camera fitting envelope.');
  }
  t.diagnostic(`Solid corner y range: ${minimum.toFixed(6)} to ${maximum.toFixed(6)}; cloth clearance >= ${(minimum - 0.015).toFixed(6)}.`);
});

test('complete prepared fans fit the home view and four orbit corners at normal zoom', () => {
  const views = [DEFAULT_VIEW, ...[VIEW_LIMITS.yaw.min, VIEW_LIMITS.yaw.max].flatMap(yaw =>
    [VIEW_LIMITS.elevation.min, VIEW_LIMITS.elevation.max].map(elevation => ({ yaw, elevation })))];
  for (const aspect of [1.5, 2, 2.4]) for (const view of views) {
    const { width, height } = getViewSize(view, aspect), position = getViewPosition(view);
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 100);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z); camera.updateMatrixWorld();
    for (const [index, order] of orders.slice(0, 8).entries()) for (const pose of createReadingFan(order, layoutSeeds[index])) for (const corner of solidCorners(pose)) {
      const screen = corner.project(camera);
      assert.ok(Math.abs(screen.x) <= 1 && Math.abs(screen.y) <= 1 && Math.abs(screen.z) <= 1);
    }
  }
});
