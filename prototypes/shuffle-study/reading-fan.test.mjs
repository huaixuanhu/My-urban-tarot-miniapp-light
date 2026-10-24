import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix4, OrthographicCamera, Vector3 } from 'three';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from './motion.mjs';
import { createReadingFan } from './reading-fan.mjs';
import { DEFAULT_VIEW, VIEW_LIMITS, VIEW_TARGET, getViewPosition, getViewSize } from './reading-view.mjs';

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

test('prepared fan is deterministic, immutable, and varies with a new physical order', () => {
  const order = [...orders[0]], before = [...order], fan = createReadingFan(order);
  assert.deepEqual(order, before);
  assert.deepEqual(fan, createReadingFan(before));
  assert.notDeepEqual(fan, createReadingFan(orders[1]));
  assert.equal(fan.length, CARD_COUNT);
  assert.ok(Object.isFrozen(fan) && fan.every(Object.isFrozen));
  order.reverse();
  assert.deepEqual(fan, createReadingFan(before));
});

test('invalid or sparse physical orders are rejected', () => {
  const sparse = [...orders[0]]; delete sparse[7];
  for (const order of [null, [], Array(CARD_COUNT).fill(0), sparse, [...orders[0].slice(1), CARD_COUNT]]) {
    assert.throws(() => createReadingFan(order), RangeError);
  }
});

test('irregular cards retain parallel planes and a positive solid-paper gap', () => {
  for (const order of orders) {
    const fan = createReadingFan(order);
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

test('full solid corners clear the cloth across 512 prepared orders', t => {
  let minimum = Infinity, maximum = -Infinity;
  for (const order of orders) for (const pose of createReadingFan(order)) for (const corner of solidCorners(pose)) {
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
    for (const order of orders.slice(0, 8)) for (const pose of createReadingFan(order)) for (const corner of solidCorners(pose)) {
      const screen = corner.project(camera);
      assert.ok(Math.abs(screen.x) <= 1 && Math.abs(screen.y) <= 1 && Math.abs(screen.z) <= 1);
    }
  }
});
