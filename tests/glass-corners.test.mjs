import test from 'node:test';
import assert from 'node:assert/strict';
import { cornerExponentFromStyle, createCornerField, opticalShapeKey } from '../client/src/vendor/fluid-glass/corner-geometry.mjs';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const names = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
function style(shape = 'superellipse(1.5)', radius = '35.2px', overrides = {}) {
  const values = Object.fromEntries(names.flatMap(name => [[`corner-${name}-shape`, shape], [`border-${name}-radius`, radius]]));
  Object.assign(values, overrides);
  return { getPropertyValue: name => values[name] || '' };
}

test('computed corner geometry preserves browser fallback and rejects unsupported mixed shapes', () => {
  assert.equal(cornerExponentFromStyle(style('')), 1);
  assert.equal(cornerExponentFromStyle(style('round', '999px')), 1);
  assert.equal(cornerExponentFromStyle(style()), 1.5);
  assert.equal(cornerExponentFromStyle(style('squircle')), 2);
  assert.equal(cornerExponentFromStyle(style('superellipse(1.8)', '28px 28px')), 1.8);
  assert.equal(cornerExponentFromStyle(style('superellipse(1.5)', '35.2px', { 'corner-bottom-left-shape': 'round' })), 1);
  assert.equal(cornerExponentFromStyle(style('superellipse(1.5)', '35.2px', { 'border-bottom-left-radius': '8px' })), 1);
  assert.equal(cornerExponentFromStyle(style('superellipse(1.5)', '35px 28px')), 1);
  assert.equal(cornerExponentFromStyle(style('superellipse(1.5)', '50%')), 1);
  for (const shape of ['bevel', 'scoop', 'square', 'superellipse(infinity)', 'superellipse(NaN)', 'superellipse(-1)', 'superellipse(9)']) {
    assert.equal(cornerExponentFromStyle(style(shape)), 1);
  }
  assert.equal(cornerExponentFromStyle(style('', '35.2px', { 'corner-shape': 'superellipse(1.5)' })), 1.5);
});

test('fractional radius and shape produce distinct selector-safe optical cache identities', () => {
  const keys = [opticalShapeKey(35.2, 1), opticalShapeKey(35.2, 1.5), opticalShapeKey(35.3, 1.5)];
  assert.equal(new Set(keys).size, 3);
  for (const key of keys) assert.match(key, /^[a-z0-9_-]+$/);
});

test('round rectangles and capsules retain exact circular distances and flat-side normals', () => {
  const field = createCornerField(200, 100, 20);
  const diagonal = field(80 + 10 * Math.SQRT2, 30 + 10 * Math.SQRT2);
  close(diagonal.s, 0);
  close(diagonal.nx, Math.SQRT1_2); close(diagonal.ny, Math.SQRT1_2);
  assert.deepEqual(field(0, 40), { nx: 0, ny: 1, s: 10, inside: true });
  assert.deepEqual(field(110, 0), { nx: 1, ny: 0, s: -10, inside: false });
  const capsule = createCornerField(200, 40, 999);
  close(capsule(80 + 10 * Math.SQRT2, 10 * Math.SQRT2).s, 0);
  close(capsule(90, 0).s, 10);
});

test('superellipse map contour coincides with the CSS exponent and uses its unit normal', () => {
  for (const k of [1.5, 1.8, 2, 3]) {
    const p = 2 ** k, r = 35.2, field = createCornerField(480, 360, r, k);
    for (let step = 1; step < 40; step += 1) {
      const t = step / 40 * Math.PI / 2;
      const a = Math.cos(t) ** (2 / p), b = Math.sin(t) ** (2 / p);
      const q = field(240 - r + r * a, 180 - r + r * b);
      close(q.s, 0, 1e-11);
      close(Math.hypot(q.nx, q.ny), 1);
      // The parametric curve tangent must be perpendicular to the map normal.
      const tx = -Math.sin(t) * Math.cos(t) ** (2 / p - 1);
      const ty = Math.cos(t) * Math.sin(t) ** (2 / p - 1);
      close(q.nx * tx + q.ny * ty, 0, 1e-10);
      assert.equal(field(240 - r + (r + .01) * a, 180 - r + (r + .01) * b).inside, false);
      assert.equal(field(240 - r + (r - .01) * a, 180 - r + (r - .01) * b).inside, true);
    }
  }
});

test('corner field remains finite and symmetric across axes and joins straight edges smoothly', () => {
  const field = createCornerField(200, 120, 30, 1.5);
  for (let x = 0; x <= 112; x += 7) for (let y = 0; y <= 72; y += 6) {
    const q = field(x, y), mirror = field(-x, -y);
    assert.ok([q.s, q.nx, q.ny].every(Number.isFinite));
    close(q.s, mirror.s); assert.equal(q.inside, mirror.inside);
    if (x) close(q.nx, -mirror.nx);
    if (y) close(q.ny, -mirror.ny);
  }
  const axis = field(100, 30), beside = field(100, 30 + 1e-7);
  close(axis.s, beside.s); close(axis.nx, beside.nx); close(axis.ny, beside.ny, 1e-12);
});

test('adopted soft corner bevel approximation stays within half a pixel of a dense Euclidean oracle', () => {
  const r = 35.2, k = 1.5, p = 2 ** k;
  const field = createCornerField(480, 360, r, k);
  const curve = Array.from({ length: 4097 }, (_, i) => {
    const t = i / 4096 * Math.PI / 2;
    return [r * Math.cos(t) ** (2 / p), r * Math.sin(t) ** (2 / p)];
  });
  let samples = 0;
  for (let x = .5; x < r; x += 1) for (let y = .5; y < r; y += 1) {
    const q = field(240 - r + x, 180 - r + y);
    if (!q.inside || q.s > 20) continue;
    let distanceSquared = Infinity;
    for (const [a, b] of curve) distanceSquared = Math.min(distanceSquared, (a - x) ** 2 + (b - y) ** 2);
    close(q.s, Math.sqrt(distanceSquared), .5);
    samples += 1;
  }
  assert.ok(samples > 500);
});
