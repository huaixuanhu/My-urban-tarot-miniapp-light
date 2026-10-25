import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW, VIEW_LIMITS, VIEW_TARGET, clampView, dragView, getViewPosition, isDefaultView, fitViewSize, getViewSize, getFramedViewSize, ZOOM_LIMITS, wheelZoom } from './reading-view.mjs';
import { READING_ENVELOPE } from './reading-layout.mjs';

const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

test('default view exactly preserves the original camera and target', () => {
  assert.deepEqual(DEFAULT_VIEW, { yaw: 0, elevation: Math.atan2(10.4, 11.4), zoom: 1 });
  assert.deepEqual(VIEW_TARGET, { x: 0, y: 0.1, z: 0.3 });
  assert.deepEqual(getViewPosition(DEFAULT_VIEW), { x: 0, y: 10.5, z: 11.7 });
  assert.deepEqual(dragView(DEFAULT_VIEW, 0, 0), DEFAULT_VIEW);
  assert.equal(isDefaultView(DEFAULT_VIEW), true);
});

test('table grabbing uses documented directions without mutating pointer-down state', () => {
  const start = { ...DEFAULT_VIEW };
  const moved = dragView(start, 40, 20);
  assert.ok(moved.yaw < start.yaw);
  assert.ok(moved.elevation > start.elevation);
  assert.deepEqual(start, DEFAULT_VIEW);
  assert.equal(isDefaultView(moved), false);
  assert.deepEqual(dragView(start, 40, 20), moved);
  assert.deepEqual(dragView(start, 0, 0), DEFAULT_VIEW);
});

test('large drags and absolute view inputs respect both angular limits', () => {
  near(VIEW_LIMITS.yaw.min, -18 * Math.PI / 180);
  near(VIEW_LIMITS.yaw.max, 18 * Math.PI / 180);
  near(VIEW_LIMITS.elevation.min, 34 * Math.PI / 180);
  near(VIEW_LIMITS.elevation.max, 60 * Math.PI / 180);
  assert.deepEqual(dragView(DEFAULT_VIEW, 1e8, 1e8), { zoom: 1, yaw: VIEW_LIMITS.yaw.min, elevation: VIEW_LIMITS.elevation.max });
  assert.deepEqual(dragView(DEFAULT_VIEW, -1e8, -1e8), { zoom: 1, yaw: VIEW_LIMITS.yaw.max, elevation: VIEW_LIMITS.elevation.min });
  assert.deepEqual(clampView({ yaw: 100, elevation: -100 }), { zoom: 1, yaw: VIEW_LIMITS.yaw.max, elevation: VIEW_LIMITS.elevation.min });
});

test('orbit positions preserve radius, remain above the table and mirror horizontally', () => {
  const radius = Math.hypot(10.4, 11.4);
  for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, VIEW_LIMITS.elevation.max]) {
    for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
      const p = getViewPosition({ yaw, elevation });
      near(Math.hypot(p.x - VIEW_TARGET.x, p.y - VIEW_TARGET.y, p.z - VIEW_TARGET.z), radius);
      assert.ok(p.y > VIEW_TARGET.y && p.z > VIEW_TARGET.z);
      const mirror = getViewPosition({ yaw: -yaw, elevation });
      near(p.x, -mirror.x); near(p.y, mirror.y); near(p.z, mirror.z);
    }
  }
});

test('malformed numbers cannot propagate nonfinite camera coordinates', () => {
  for (const view of [undefined, null, {}, { yaw: NaN, elevation: Infinity }, { yaw: -Infinity, elevation: 'bad' }]) {
    const p = getViewPosition(view);
    assert.deepEqual(p, { x: 0, y: 10.5, z: 11.7 });
    assert.ok(Object.values(p).every(Number.isFinite));
  }
  assert.deepEqual(dragView(DEFAULT_VIEW, NaN, Infinity), DEFAULT_VIEW);
});

test('orthographic size keeps the original desktop and portrait fitting rules', () => {
  for (const aspect of [16 / 9, 1440 / 900, 360 / 470, 1]) {
    const size = fitViewSize(aspect);
    near(size.width, Math.max(12.8, aspect * 7.6));
    near(size.height, size.width / aspect);
    assert.ok(size.width >= 12.8 && size.height >= 7.6 - 1e-12);
  }
  for (const invalid of [0, -1, NaN, Infinity, Number.MIN_VALUE, Number.MAX_VALUE]) {
    const size = fitViewSize(invalid);
    near(size.width, 12.8); near(size.height, 7.6);
  }
});

test('reading overview expands while dedicated shuffle framing retains the accepted size', () => {
  for (const aspect of [2, 16 / 9, 1440 / 900, 360 / 470, 1]) {
    const overview = getViewSize(DEFAULT_VIEW, aspect), original = fitViewSize(aspect);
    assert.ok(overview.width > original.width);
    assert.deepEqual(getFramedViewSize(DEFAULT_VIEW, aspect, 0), overview);
    const shuffle = getFramedViewSize(DEFAULT_VIEW, aspect, 1);
    near(shuffle.width, original.width); near(shuffle.height, original.height);
  }
});

test('framing transitions stay bounded, reversible, and aspect-correct', () => {
  for (const aspect of [1.5, 2, 2.4]) {
    const reading = getViewSize(DEFAULT_VIEW, aspect), shuffle = fitViewSize(aspect);
    let previous = reading.width;
    for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const size = getFramedViewSize(DEFAULT_VIEW, aspect, progress);
      near(size.width / size.height, aspect);
      assert.ok(size.width <= previous + 1e-12 && size.width >= shuffle.width - 1e-12);
      previous = size.width;
    }
    assert.deepEqual(getFramedViewSize(DEFAULT_VIEW, aspect, -1), reading);
    assert.deepEqual(getFramedViewSize(DEFAULT_VIEW, aspect, NaN), reading);
    near(getFramedViewSize(DEFAULT_VIEW, aspect, 2).width, shuffle.width);
  }
});

test('all conservative table-card corners fit at extreme views and aspect ratios', () => {
  for (const aspect of [0.5, 360 / 470, 1, 16 / 9, 2, 3]) {
    for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
      for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, VIEW_LIMITS.elevation.max]) {
        const view = { yaw, elevation }, size = getViewSize(view, aspect);
        near(size.width / size.height, aspect);
        assert.ok(size.width >= fitViewSize(aspect).width);
        const camera = getViewPosition(view);
        const direction = [camera.x - VIEW_TARGET.x, camera.y - VIEW_TARGET.y, camera.z - VIEW_TARGET.z];
        const length = Math.hypot(...direction), normal = direction.map(value => value / length);
        // Derive camera right/up independently from its position and world up.
        const rightLength = Math.hypot(normal[0], normal[2]);
        const right = [normal[2] / rightLength, 0, -normal[0] / rightLength];
        const up = [normal[1] * right[2], normal[2] * right[0] - normal[0] * right[2], -normal[1] * right[0]];
        for (const x of [READING_ENVELOPE.minX, READING_ENVELOPE.maxX]) for (const y of [READING_ENVELOPE.minY, READING_ENVELOPE.maxY]) for (const z of [READING_ENVELOPE.minZ, READING_ENVELOPE.maxZ]) {
          const relative = [x - VIEW_TARGET.x, y - VIEW_TARGET.y, z - VIEW_TARGET.z];
          const projectedX = relative.reduce((sum, value, i) => sum + value * right[i], 0);
          const projectedY = relative.reduce((sum, value, i) => sum + value * up[i], 0);
          assert.ok(Math.abs(projectedX) * 1.02 <= size.width / 2 + 1e-10);
          assert.ok(Math.abs(projectedY) * 1.02 <= size.height / 2 + 1e-10);
        }
      }
    }
  }
  assert.ok(getViewSize({ yaw: VIEW_LIMITS.yaw.max, elevation: VIEW_LIMITS.elevation.max }, 2).height > 7.6);
});

test('projection fitting stays finite for malformed and extreme aspect values', () => {
  for (const aspect of [0, -1, NaN, Infinity, Number.MIN_VALUE, Number.MAX_VALUE, 7.2e-308]) {
    const size = getViewSize({ yaw: VIEW_LIMITS.yaw.max, elevation: VIEW_LIMITS.elevation.max }, aspect);
    assert.ok(Object.values(size).every(value => Number.isFinite(value) && value > 0));
  }
});


test('wheel zoom is bounded and reversible away from the bounds', () => {
  assert.ok(wheelZoom(1, -100) > 1);
  assert.ok(wheelZoom(1, 100) < 1);
  near(wheelZoom(wheelZoom(1, -100), 100), 1);
  near(wheelZoom(1, -1e8), ZOOM_LIMITS.max);
  near(wheelZoom(1, 1e8), ZOOM_LIMITS.min);
  near(wheelZoom(ZOOM_LIMITS.max, -100), ZOOM_LIMITS.max);
  near(wheelZoom(ZOOM_LIMITS.min, 100), ZOOM_LIMITS.min);
});

test('pixel, line and page wheels normalize to the same change', () => {
  near(wheelZoom(1, 160, 0), wheelZoom(1, 10, 1));
  near(wheelZoom(1, 160, 0), wheelZoom(1, 0.2, 2, 800));
  near(wheelZoom(1, NaN), 1);
  near(wheelZoom(Infinity, 0), 1);
});

test('orbit preserves zoom, home distinguishes scale, and zoom does not alter camera direction', () => {
  const zoomed = { ...DEFAULT_VIEW, zoom: 1.65 };
  near(dragView(zoomed, 100, 100).zoom, 1.65);
  assert.equal(isDefaultView(zoomed), false);
  assert.deepEqual(getViewPosition(zoomed), getViewPosition(DEFAULT_VIEW));
  assert.deepEqual(getViewSize(zoomed, 2), getViewSize(DEFAULT_VIEW, 2));
  near(clampView({ zoom: 999 }).zoom, ZOOM_LIMITS.max);
  near(clampView({ zoom: -999 }).zoom, ZOOM_LIMITS.min);
});
