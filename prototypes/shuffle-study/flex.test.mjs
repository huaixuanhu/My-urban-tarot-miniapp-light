import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_COUNT, CARD_WIDTH, CARD_THICKNESS, RIFFLE_TIMING, samplePose } from '../../client/src/motion.mjs';
import { FLEX_SEGMENTS, sampleFlex, deformCardPoint } from '../../client/src/flex.mjs';

const xs = Array.from({ length: FLEX_SEGMENTS + 1 }, (_, i) => Math.fround(-CARD_WIDTH / 2 + i * CARD_WIDTH / FLEX_SEGMENTS));
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

function crossSection(index, t) {
  const flex = sampleFlex(index, t);
  const pose = samplePose(index, t);
  assert.equal(pose.rx, 0);
  assert.equal(pose.ry, 0);
  const c = Math.cos(pose.rz), s = Math.sin(pose.rz);
  const rows = [0, Math.fround(CARD_THICKNESS)].map(y => xs.map(x => {
    const p = deformCardPoint(x, y, 0, flex);
    // Match the actual Float32 mesh vertices before the rigid group transform.
    const px = Math.fround(p.x), py = Math.fround(p.y);
    return [pose.x + c * px - s * py, pose.y + s * px + c * py];
  }));
  const strips = xs.slice(1).map((_, i) => bounds([rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]]));
  return { ...bounds(rows.flat()), strips };
}

function bounds(points) {
  return { points, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
}
function overlaps(a, b) {
  const e = 2e-7;
  return a.minX < b.maxX - e && b.minX < a.maxX - e && a.minY < b.maxY - e && b.minY < a.maxY - e;
}
function penetrates(a, b) {
  if (!overlaps(a, b)) return false;
  for (const polygon of [a.points, b.points]) {
    for (let i = 0; i < polygon.length; i += 1) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const length = Math.hypot(dx, dy);
      const project = point => (-dy * point[0] + dx * point[1]) / length;
      const pa = a.points.map(project), pb = b.points.map(project);
      if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= 2e-7) return false;
    }
  }
  return true;
}

test('flex is exactly flat outside the riffle and deterministic when scrubbing', () => {
  for (let index = 0; index < CARD_COUNT; index += 1) {
    for (const t of [-1, 0, 0.32, 0.72, 1, 2]) {
      const flex = sampleFlex(index, t);
      assert.equal(flex.active, false);
      assert.equal(flex.angle, 0);
      assert.deepEqual(deformCardPoint(0.3, CARD_THICKNESS, 0.5, flex), { x: 0.3, y: CARD_THICKNESS, z: 0.5 });
    }
    const target = sampleFlex(index, 0.53);
    sampleFlex(index, 1); sampleFlex(index, 0);
    assert.deepEqual(sampleFlex(index, 0.53), target);
  }
});

test('held card curvature is visible, mirrored, and preserves solid thickness', () => {
  for (const index of [0, 10, 38, 39, 49, 77]) {
    const flex = sampleFlex(index, 0.35);
    assert.ok(flex.active && flex.angle > 0.40 && flex.angle < 0.55);
    const inner = deformCardPoint(flex.side * CARD_WIDTH / 2, 0, 0, flex);
    assert.ok(inner.y > 0.15 && inner.y < 0.3);
    for (const x of xs) {
      const a = deformCardPoint(x, 0, 0, flex), b = deformCardPoint(x, CARD_THICKNESS, 0, flex);
      close(Math.hypot(b.x - a.x, b.y - a.y), CARD_THICKNESS);
    }
  }
  const left = deformCardPoint(0.5, 0, 0, sampleFlex(0, 0.35));
  const right = deformCardPoint(-0.5, 0, 0, sampleFlex(39, 0.35));
  close(left.x, -right.x); close(left.y, right.y);
});

test('rendered neutral-line length is preserved across all packet layers', () => {
  const lengths = [];
  for (let index = 0; index < CARD_COUNT; index += 1) {
    const flex = sampleFlex(index, 0.35);
    const points = xs.map(x => deformCardPoint(x, CARD_THICKNESS / 2, 0, flex));
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    lengths.push(length);
    // The rendered strips approximate a circular arc with short straight chords.
    // At24segments the small chord error stays under0.01%, including the hinge.
    close(length, CARD_WIDTH, CARD_WIDTH * 0.0001);
  }
  assert.ok(Math.max(...lengths) - Math.min(...lengths) < CARD_WIDTH * 0.00003);
});

test('release returns through diminishing overshoots and ends flat before crossing the other packet', () => {
  const { start, end, leveling, flightSpan } = RIFFLE_TIMING;
  const releaseStart = start + (end - start) * leveling;
  const toTime = flight => releaseStart + (end - start) * (1 - leveling) * flightSpan * flight;
  assert.ok(sampleFlex(0, toTime(0.38)).angle < 0);
  assert.ok(sampleFlex(0, toTime(0.50)).angle > 0);
  assert.ok(Math.abs(sampleFlex(0, toTime(0.50)).angle) < Math.abs(sampleFlex(0, toTime(0.38)).angle));
  assert.equal(sampleFlex(0, toTime(0.60)).active, false);
  for (const fraction of [0.26, 0.38, 0.50, 0.60]) {
    assert.ok(Math.abs(samplePose(0, toTime(fraction)).x) > 0.8);
  }
});

test('deformation remains continuous through bend, release, recoil, and flat boundaries', () => {
  const { start, end, leveling, releaseSpan, flightSpan } = RIFFLE_TIMING;
  for (const index of [0, 19, 38, 39, 58, 77]) {
    const local = index < 39 ? index : index - 39;
    const release = local * releaseSpan / 38 + (index < 39 ? 0 : releaseSpan / 76);
    const boundaries = [0.32, start, end, ...[0, 0.26, 0.38, 0.50, 0.60, 1].map(flight =>
      start + (end - start) * (leveling + (1 - leveling) * (release + flightSpan * flight)))];
    for (const t of boundaries) {
      for (const x of [-CARD_WIDTH / 2, 0, CARD_WIDTH / 2]) {
        const before = deformCardPoint(x, CARD_THICKNESS, 0.8, sampleFlex(index, t - 1e-8));
        const after = deformCardPoint(x, CARD_THICKNESS, 0.8, sampleFlex(index, t + 1e-8));
        for (const key of ['x', 'y', 'z']) close(before[key], after[key], 1e-6);
      }
    }
  }
  assert.throws(() => sampleFlex(0, NaN), TypeError);
  assert.throws(() => sampleFlex(-1, 0), RangeError);
  for (const count of [1, 3, 77, 79]) {
    for (let index = 0; index < count; index += 1) {
      for (const t of [0.32, 0.35, 0.53, 0.72]) {
        const point = deformCardPoint(CARD_WIDTH / 2, CARD_THICKNESS, 0, sampleFlex(index, t, count));
        for (const value of Object.values(point)) assert.ok(Number.isFinite(value));
      }
    }
  }
});

test('rendered curved strips are finite, convex, and do not penetrate other cards', () => {
  const times = new Set(Array.from({ length: 73 }, (_, i) => 0.32 + i * (0.40 / 72)));
  const { start, end, leveling, releaseSpan, flightSpan } = RIFFLE_TIMING;
  const interval = releaseSpan / 38;
  for (let index = 0; index < CARD_COUNT; index += 1) {
    const local = index < 39 ? index : index - 39;
    const release = local * interval + (index < 39 ? 0 : interval / 2);
    for (const flight of [0, 0.13, 0.26, 0.38, 0.50, 0.60, 0.80, 1]) {
      times.add(start + (end - start) * (leveling + (1 - leveling) * (release + flightSpan * flight)));
    }
  }
  for (const t of [...times].sort((a, b) => a - b)) {
    const cards = Array.from({ length: CARD_COUNT }, (_, i) => crossSection(i, t));
    for (let i = 0; i < CARD_COUNT; i += 1) {
      for (const strip of cards[i].strips) {
        let sign;
        for (let corner = 0; corner < 4; corner += 1) {
          const a = strip.points[corner], b = strip.points[(corner + 1) % 4], c = strip.points[(corner + 2) % 4];
          for (const value of a) assert.ok(Number.isFinite(value));
          const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
          assert.ok(Math.abs(cross) > 1e-8);
          if (sign !== undefined) assert.equal(Math.sign(cross), sign);
          sign = Math.sign(cross);
        }
      }
      for (let j = i + 1; j < CARD_COUNT; j += 1) {
        if (!overlaps(cards[i], cards[j])) continue;
        for (const a of cards[i].strips) for (const b of cards[j].strips) {
          assert.equal(penetrates(a, b), false, `Curved cards ${i}/${j} penetrate at t=${t}`);
        }
      }
    }
  }
});
