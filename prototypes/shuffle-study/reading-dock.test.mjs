import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createReadingDock, createReadingDockGeometry, READING_DOCK, READING_DOCK_LABEL_PLANE, planarCssTransform } from './reading-dock.mjs';
import { createReadingFan } from './reading-fan.mjs';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from './motion.mjs';
import { CLOTH_WIDTH, CLOTH_LENGTH, CLOTH_CENTER_Z } from './reading-layout.mjs';

test('control glass stays on the table with its labels on its flat upper face', () => {
  const geometry = createReadingDockGeometry();
  try {
    const b = geometry.boundingBox, d = READING_DOCK, labels = READING_DOCK_LABEL_PLANE;
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
    assert.ok(Math.abs(b.min.y - d.bottom) < 1e-6);
    assert.ok(Math.abs(b.max.y - d.top) < 1e-6);
    assert.ok(Math.abs(b.max.x - b.min.x - d.width) < 1e-4);
    assert.ok(Math.abs(b.max.z - b.min.z - d.length) < 1e-4);
    assert.ok(b.min.y > 0);
    assert.ok(b.min.x + d.x > -CLOTH_WIDTH / 2);
    assert.ok(b.max.x + d.x < CLOTH_WIDTH / 2);
    assert.ok(b.max.z + d.z < CLOTH_CENTER_Z + CLOTH_LENGTH / 2);
    assert.equal(labels.x, d.x);
    assert.equal(labels.z, d.z);
    assert.ok(labels.y > b.max.y && labels.y - b.max.y < 0.004);
    assert.ok(labels.width < d.width - 0.13 && labels.length < d.length - 0.13);
    const flatRadius = d.radius - 0.065;
    const flatCapCenter = d.width / 2 - d.radius;
    assert.ok(Math.hypot(labels.width / 2 - flatCapCenter, labels.length / 2) < flatRadius);
  } finally { geometry.dispose(); }
});

function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const half = points => {
    const out = [];
    for (const p of points) {
      while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
      out.push(p);
    }
    return out;
  };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}

function intersects(a, b) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const nx = q.z - p.z, nz = p.x - q.x;
    const pa = a.map(v => nx * v.x + nz * v.z), pb = b.map(v => nx * v.x + nz * v.z);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

test('capsule footprint clears complete randomized fans with a 0.03 scene-unit margin', () => {
  const d = READING_DOCK, margin = 0.03;
  const dock = Array.from({ length: 96 }, (_, i) => {
    const angle = i / 96 * Math.PI * 2, c = Math.cos(angle);
    return { x: d.x + Math.sign(c) * (d.width / 2 - d.radius) + c * (d.radius + margin),
      z: d.z + Math.sin(angle) * (d.radius + margin) };
  });
  let seed = 101;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let run = 0; run < 128; run++) {
    const order = Array.from({ length: CARD_COUNT }, (_, i) => i);
    for (let i = order.length - 1; i; i--) {
      const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
    }
    for (const p of createReadingFan(order)) {
      const euler = new THREE.Euler(p.rx, p.ry, p.rz);
      const corners = [-CARD_WIDTH / 2, CARD_WIDTH / 2].flatMap(x => [0, CARD_THICKNESS].flatMap(y =>
        [-CARD_LENGTH / 2, CARD_LENGTH / 2].map(z => new THREE.Vector3(x, y, z).applyEuler(euler).add(new THREE.Vector3(p.x, p.y, p.z)))));
      assert.equal(intersects(convexHull(corners), dock), false, `Fan ${run} at x=${p.x} intersects dock.`);
    }
  }
});

function applyCss(transform, x, y) {
  const matrix = transform.slice(9, -1).split(',').map(Number);
  const w = matrix[3] * x + matrix[7] * y + matrix[15];
  return { x: (matrix[0] * x + matrix[4] * y + matrix[12]) / w,
    y: (matrix[1] * x + matrix[5] * y + matrix[13]) / w };
}

test('native control mapping agrees with perspective at all corners and interior, including top-down', () => {
  const plane = READING_DOCK_LABEL_PLANE, viewport = { width: 1440, height: 900 };
  for (const elevation of [34, 48, 73, 90]) for (const yaw of [-18, 0, 18]) for (const zoom of [0.75, 1, 1.8]) {
    const e = THREE.MathUtils.degToRad(elevation), a = THREE.MathUtils.degToRad(yaw);
    const camera = new THREE.PerspectiveCamera(43, viewport.width / viewport.height, 0.1, 100);
    camera.position.set(21 * Math.sin(a) * Math.cos(e), 21 * Math.sin(e), 21 * Math.cos(a) * Math.cos(e));
    camera.up.set(-Math.sin(a) * Math.sin(e), Math.cos(e), -Math.cos(a) * Math.sin(e));
    camera.lookAt(0, 0, 0);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const project = (u, v) => {
      const p = new THREE.Vector3(plane.x + (u - 0.5) * plane.width, plane.y, plane.z + (v - 0.5) * plane.length).project(camera);
      return { x: (p.x + 1) * viewport.width / 2, y: (1 - p.y) * viewport.height / 2 };
    };
    const corners = { topLeft: project(0, 0), topRight: project(1, 0), bottomRight: project(1, 1), bottomLeft: project(0, 1) };
    const transform = planarCssTransform(corners, 680, 72);
    for (const u of [0, 0.13, 0.5, 0.84, 1]) for (const v of [0, 0.27, 0.6, 1]) {
      const actual = applyCss(transform, u * 680, v * 72), expected = project(u, v);
      assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-8, `${elevation}/${yaw}/${zoom} at ${u},${v}`);
    }
  }
});

test('control mapping rejects folded, degenerate and nonfinite planes', () => {
  const corners = { topLeft: { x: 0, y: 0 }, topRight: { x: 2, y: 0 }, bottomRight: { x: 2, y: 1 }, bottomLeft: { x: 0, y: 1 } };
  assert.throws(() => planarCssTransform(corners, 0, 1), RangeError);
  assert.throws(() => planarCssTransform({ ...corners, topLeft: { x: NaN, y: 0 } }, 2, 1), TypeError);
  assert.throws(() => planarCssTransform({ ...corners, bottomRight: corners.bottomLeft, bottomLeft: corners.bottomRight }, 2, 1), RangeError);
  assert.throws(() => planarCssTransform({ ...corners, bottomLeft: corners.topLeft }, 2, 1), RangeError);
});

test('appearance preserves geometry and disposal never takes shared environment ownership', () => {
  const environment = new THREE.Texture();
  let environmentDisposals = 0;
  environment.addEventListener('dispose', () => environmentDisposals++);
  const dock = createReadingDock({ environmentTexture: environment });
  const body = dock.group.getObjectByName('solid-control-glass'), positions = body.geometry.attributes.position.array.slice();
  let bodyDisposals = 0;
  body.geometry.addEventListener('dispose', () => bodyDisposals++);
  dock.applyAppearance('dark');
  assert.equal(body.material[0].envMap, environment);
  assert.deepEqual(body.geometry.attributes.position.array, positions);
  dock.applyAppearance('light');
  dock.dispose(); dock.dispose();
  assert.equal(bodyDisposals, 1);
  assert.equal(environmentDisposals, 0);
});
