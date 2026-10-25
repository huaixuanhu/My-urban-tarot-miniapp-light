import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_VIEW, VIEW_LIMITS, VIEW_TARGET, getViewPosition, fitViewSize } from './reading-view.mjs';
import { createReadingProjection, getReadingPerspectiveFrame, getReadingDockAnchor, READING_PROJECTION_ENVELOPE } from './reading-projection.mjs';
import { createReadingFan } from './reading-fan.mjs';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const project = (camera, x, y, z) => new THREE.Vector3(x, y, z).project(camera);
const widths = camera => {
  const widthAt = z => project(camera, 3, 0, z).x - project(camera, -3, 0, z).x;
  return { near: widthAt(4), far: widthAt(-4) };
};

test('low-angle reading has genuine near-larger perspective, without reversing printed orientation', () => {
  const projection = createReadingProjection();
  const camera = projection.update({ ...DEFAULT_VIEW, elevation: VIEW_LIMITS.elevation.min }, { width: 1440, height: 1000 });
  assert.equal(camera.isPerspectiveCamera, true);
  const sizes = widths(camera);
  assert.ok(sizes.near > sizes.far * 1.2);
  assert.ok(project(camera, 1, 0, 0).x > project(camera, -1, 0, 0).x);
  assert.ok(project(camera, 0, 0, -1).y > project(camera, 0, 0, 1).y);
});

test('glass and elevated cards fit the safe viewport at all accepted orbit extremes', () => {
  const projection = createReadingProjection();
  const b = READING_PROJECTION_ENVELOPE;
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 760, height: 900 }, { width: 390, height: 700 }, { width: 2200, height: 800 }]) {
    for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
      for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, VIEW_LIMITS.elevation.max]) {
        for (const zoom of [0.75, 1]) {
          const view = { yaw, elevation, zoom };
          const frame = getReadingPerspectiveFrame(view, viewport), camera = projection.update(view, viewport);
          for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) {
            const ndc = project(camera, x, y, z);
            assert.ok(ndc.x >= frame.safeBounds.minX - 1e-10 && ndc.x <= frame.safeBounds.maxX + 1e-10);
            assert.ok(ndc.y >= frame.safeBounds.minY - 1e-10 && ndc.y <= frame.safeBounds.maxY + 1e-10);
            assert.ok(ndc.z > -1 && ndc.z < 1);
          }
        }
      }
    }
  }
});

test('optical zoom retains camera position and is bounded by the existing view contract', () => {
  const projection = createReadingProjection(), viewport = { width: 1440, height: 1000 };
  const camera = projection.update(DEFAULT_VIEW, viewport), position = camera.position.clone();
  const before = widths(camera);
  projection.update({ ...DEFAULT_VIEW, zoom: 999 }, viewport);
  assert.deepEqual(camera.position.toArray(), position.toArray());
  near(camera.zoom, 1.8);
  near(widths(camera).near / before.near, 1.8);
  projection.update({ ...DEFAULT_VIEW, zoom: -999 }, viewport);
  near(camera.zoom, 0.75);
});

test('the reset endpoint preserves the accepted orthographic camera and framing exactly', () => {
  const projection = createReadingProjection();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 760, height: 900 }]) {
    const actual = projection.update(DEFAULT_VIEW, viewport, 1), size = fitViewSize(viewport.width / viewport.height);
    const expected = new THREE.OrthographicCamera(-size.width / 2, size.width / 2, size.height / 2, -size.height / 2, 0.1, 100);
    const point = getViewPosition(DEFAULT_VIEW);
    expected.position.set(point.x, point.y, point.z); expected.lookAt(VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z); expected.updateMatrixWorld();
    assert.equal(actual.isOrthographicCamera, true);
    assert.deepEqual(actual.projectionMatrix.elements, expected.projectionMatrix.elements);
    assert.deepEqual(actual.matrixWorld.elements, expected.matrixWorld.elements);
    near(widths(actual).near, widths(actual).far);
  }
});

test('reset projection transitions remain finite, continuous at entry and subpixel at the ortho endpoint', () => {
  const projection = createReadingProjection(), viewport = { width: 1440, height: 1000 };
  const sample = t => project(projection.update(DEFAULT_VIEW, viewport, t), 4, 0.05, 2);
  const screenDistance = (a, b) => Math.hypot((a.x - b.x) * viewport.width / 2, (a.y - b.y) * viewport.height / 2);
  assert.ok(screenDistance(sample(0), sample(1e-8)) < 1e-4);
  const b = READING_PROJECTION_ENVELOPE;
  for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) {
    const before = project(projection.update(DEFAULT_VIEW, viewport, 1 - 1e-8), x, y, z);
    const after = project(projection.update(DEFAULT_VIEW, viewport, 1), x, y, z);
    assert.ok(screenDistance(before, after) < 1);
  }
  for (let i = 0; i <= 100; i++) {
    const camera = projection.update(DEFAULT_VIEW, viewport, i / 100);
    assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
    assert.ok(camera.projectionMatrixInverse.elements.every(Number.isFinite));
    const point = project(camera, 0, 1, 0);
    assert.ok(point.toArray().every(Number.isFinite) && point.z > -1 && point.z < 1);
  }
});

test('native ray casts match the displayed plane in reading and intermediate lenses', () => {
  const projection = createReadingProjection(), raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 760, height: 900 }]) {
    for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
      for (const zoom of [0.75, 1, 1.8]) {
        for (const progress of [0, 0.25, 0.8, 0.999, 1]) {
        const camera = projection.update({ yaw, elevation: VIEW_LIMITS.elevation.min, zoom }, viewport, progress);
        const original = new THREE.Vector3(1.4, 0.05, -0.8), ndc = original.clone().project(camera);
        raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        assert.ok(hit && hit.distanceTo(original) < 1e-7);
        }
      }
    }
  }
});

test('malformed viewports and view values produce finite recoverable cameras', () => {
  const projection = createReadingProjection();
  for (const viewport of [undefined, null, {}, { width: 0, height: 0 }, { width: NaN, height: Infinity }, { width: Number.MIN_VALUE, height: Number.MAX_VALUE }]) {
    const camera = projection.update({ yaw: NaN, elevation: Infinity, zoom: -Infinity }, viewport, NaN);
    assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));
    assert.ok(camera.matrixWorld.elements.every(Number.isFinite));
    assert.equal(camera.zoom, 1);
  }
});

test('floating dock follows the near rim and clears the full fan at desktop overview angles', () => {
  const projection = createReadingProjection(), fan = createReadingFan(Array.from({ length: 78 }, (_, id) => id));
  for (const viewport of [{ width: 1125, height: 954 }, { width: 1440, height: 1000 }, { width: 1024, height: 768 }]) {
    for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, VIEW_LIMITS.elevation.max]) {
      for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
        const camera = projection.update({ ...DEFAULT_VIEW, elevation, yaw }, viewport);
        const anchor = getReadingDockAnchor(camera, viewport, fan, 83, 56);
        assert.ok(anchor.top >= anchor.fanBottom + 12, 'dock blocks the overview fan');
        assert.ok(anchor.bottom >= 25 && anchor.top + 83 <= viewport.height - 25);
        assert.ok(anchor.top > 100);
      }
    }
  }
});

test('dock remains recoverable at bounded inspection zoom and compact viewports', () => {
  const projection = createReadingProjection(), fan = createReadingFan(Array.from({ length: 78 }, (_, id) => id));
  for (const viewport of [{ width: 390, height: 700 }, { width: 1440, height: 620 }]) {
    const camera = projection.update({ ...DEFAULT_VIEW, zoom: 1.8 }, viewport);
    const anchor = getReadingDockAnchor(camera, viewport, fan, 83, 56);
    assert.ok(Number.isFinite(anchor.bottom) && anchor.bottom >= 25);
    assert.ok(anchor.top + 83 <= viewport.height - 25);
  }
});
