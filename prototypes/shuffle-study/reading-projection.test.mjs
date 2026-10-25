import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_VIEW, VIEW_LIMITS } from './reading-view.mjs';
import { createReadingProjection, getReadingPerspectiveFrame, projectReadingPlane, READING_PROJECTION_VOLUMES, DEFAULT_READING_PADDING } from './reading-projection.mjs';
import { createReadingFan } from './reading-fan.mjs';
import { pickFan } from './reading-picking.mjs';
import { CARD_WIDTH, CARD_LENGTH } from './motion.mjs';
import { createReadingGlassGeometry } from './reading-glass.mjs';
import { createReadingDockGeometry, READING_DOCK, READING_DOCK_LABEL_PLANE } from './reading-dock.mjs';

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
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 760, height: 900 }, { width: 390, height: 700 }, { width: 2200, height: 800 }]) {
    for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
      for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, VIEW_LIMITS.elevation.max]) {
        for (const zoom of [0.75, 1]) {
          const view = { yaw, elevation, zoom };
          const frame = getReadingPerspectiveFrame(view, viewport), camera = projection.update(view, viewport);
          for (const b of READING_PROJECTION_VOLUMES) for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) {
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

test('exact90 flat cards remain rectangles with their actual aspect ratio at every yaw', () => {
  const projection = createReadingProjection(), viewport = { width: 1440, height: 1000 };
  const vector = (a, b) => new THREE.Vector2(b.x - a.x, b.y - a.y);
  for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
    const camera = projection.update({ ...DEFAULT_VIEW, yaw, elevation: Math.PI / 2 }, viewport);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    near(direction.x, 0); near(direction.y, -1); near(direction.z, 0);
    for (const [x, z] of [[-3, -2], [0, 0], [3, 0.5]]) {
      const points = projectReadingPlane(camera, viewport, { x, y: 0.08, z, width: CARD_WIDTH, length: CARD_LENGTH });
      const top = vector(points.topLeft, points.topRight), side = vector(points.topLeft, points.bottomLeft);
      const bottom = vector(points.bottomLeft, points.bottomRight), otherSide = vector(points.topRight, points.bottomRight);
      near(top.dot(side), 0, 1e-8);
      near(top.length() / side.length(), CARD_WIDTH / CARD_LENGTH);
      assert.ok(top.distanceTo(bottom) < 1e-9 && side.distanceTo(otherSide) < 1e-9);
      assert.ok(Object.values(points).every(point => point.visible));
    }
  }
});

test('camera orientation approaches exact90 continuously without a pole flip', () => {
  const projection = createReadingProjection(), viewport = { width: 1440, height: 1000 };
  for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
    const before = project(projection.update({ ...DEFAULT_VIEW, yaw, elevation: Math.PI / 2 - 1e-7 }, viewport), 4, 0.08, 2);
    const after = project(projection.update({ ...DEFAULT_VIEW, yaw, elevation: Math.PI / 2 }, viewport), 4, 0.08, 2);
    const pixelDelta = Math.hypot((before.x - after.x) * viewport.width / 2, (before.y - after.y) * viewport.height / 2);
    assert.ok(pixelDelta < 0.001);
  }
});

test('reset progress cannot change the perspective camera, framing or chosen angle', () => {
  const projection = createReadingProjection();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 760, height: 900 }]) {
    for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, Math.PI / 2]) {
      const view = { yaw: VIEW_LIMITS.yaw.max, elevation, zoom: 1.3 };
      const camera = projection.update(view, viewport, 0);
      const matrix = camera.projectionMatrix.clone(), world = camera.matrixWorld.clone();
      for (const progress of [0, 0.1, 0.25, 0.5, 0.8, 0.999, 1]) {
        const next = projection.update(view, viewport, progress);
        assert.equal(next, camera);
        assert.equal(next.isPerspectiveCamera, true);
        assert.deepEqual(next.projectionMatrix.elements, matrix.elements);
        assert.deepEqual(next.matrixWorld.elements, world.elements);
      }
      assert.deepEqual(view, { yaw: VIEW_LIMITS.yaw.max, elevation, zoom: 1.3 });
    }
  }
});

test('native rays and all fan IDs stay correct through exact90 and both zoom limits', () => {
  const projection = createReadingProjection(), raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
  const order = Array.from({ length: 78 }, (_, ordinal) => (ordinal * 37 + 11) % 78);
  const fan = createReadingFan(order), candidates = order.map((id, ordinal) => ({ id, pose: fan[ordinal] }));
  const rayThrough = (camera, point) => {
    const ndc = point.clone().project(camera);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    return raycaster.ray;
  };
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 760, height: 900 }]) {
    for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
      for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, Math.PI / 2 - 1e-7, Math.PI / 2]) {
        for (const zoom of [0.75, 1, 1.8]) {
          const camera = projection.update({ yaw, elevation, zoom }, viewport);
          const original = new THREE.Vector3(1.4, 0.05, -0.8);
          const hit = rayThrough(camera, original).intersectPlane(plane, new THREE.Vector3());
          assert.ok(hit && hit.distanceTo(original) < 1e-7);
          for (const card of candidates) {
            const point = new THREE.Vector3(card.pose.x, card.pose.y, card.pose.z);
            assert.equal(pickFan(rayThrough(camera, point), candidates), card.id);
          }
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

test('actual glass and physical dock geometry plus labels remain visible at overview angles', () => {
  const projection = createReadingProjection();
  const glass = createReadingGlassGeometry(), dock = createReadingDockGeometry();
  const point = new THREE.Vector3();
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 1000 }, { width: 760, height: 900 }]) {
    for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, Math.PI / 2]) {
      for (const yaw of [VIEW_LIMITS.yaw.min, 0, VIEW_LIMITS.yaw.max]) {
        const camera = projection.update({ ...DEFAULT_VIEW, elevation, yaw }, viewport);
        for (const [geometry, x, z] of [[glass, 0, 0], [dock, READING_DOCK.x, READING_DOCK.z]]) {
          const positions = geometry.attributes.position;
          for (let index = 0; index < positions.count; index++) {
            point.fromBufferAttribute(positions, index); point.x += x; point.z += z; point.project(camera);
            assert.ok(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1);
          }
        }
        const labels = projectReadingPlane(camera, viewport, READING_DOCK_LABEL_PLANE);
        assert.ok(Object.values(labels).every(point => point.visible));
      }
    }
  }
  glass.dispose(); dock.dispose();
});

test('overhead framing uses safe vertical space without shrinking around the old off-center target', () => {
  const projection = createReadingProjection();
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 1000 }]) {
    const camera = projection.update({ ...DEFAULT_VIEW, elevation: Math.PI / 2 }, viewport);
    const surface = Object.values(projectReadingPlane(camera, viewport, { x: 0, y: -0.008, z: -0.6, width: 14.8, length: 11.2 }));
    const top = Math.min(...surface.map(point => point.y)), bottom = Math.max(...surface.map(point => point.y));
    const usable = viewport.height - DEFAULT_READING_PADDING.top - DEFAULT_READING_PADDING.bottom;
    assert.ok(bottom - top > usable * 0.94);
    assert.ok(top >= DEFAULT_READING_PADDING.top && bottom <= viewport.height - DEFAULT_READING_PADDING.bottom);
    assert.ok(Math.abs((top - DEFAULT_READING_PADDING.top) - (viewport.height - DEFAULT_READING_PADDING.bottom - bottom)) < 12);
  }
});

test('physical toolbar plane projects far edge first with finite screen coordinates', () => {
  const projection = createReadingProjection(), viewport = { width: 1440, height: 1000 };
  const body = { x: 0, y: 0.22, z: 4.45, width: 7.4, length: 1 };
  const width = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const elevation of [VIEW_LIMITS.elevation.min, DEFAULT_VIEW.elevation, Math.PI / 2]) {
    const camera = projection.update({ ...DEFAULT_VIEW, elevation }, viewport);
    const points = projectReadingPlane(camera, viewport, body);
    assert.ok(points.topLeft.x < points.topRight.x && points.bottomLeft.x < points.bottomRight.x);
    assert.ok(points.topLeft.y < points.bottomLeft.y && points.topRight.y < points.bottomRight.y);
    assert.ok(Object.values(points).every(point => [point.x, point.y, point.depth].every(Number.isFinite)));
    const nearWidth = width(points.bottomLeft, points.bottomRight), farWidth = width(points.topLeft, points.topRight);
    if (elevation === Math.PI / 2) near(nearWidth, farWidth);
    else assert.ok(nearWidth > farWidth);
    const ndc = project(camera, -body.width / 2, body.y, body.z - body.length / 2);
    near(points.topLeft.x, (ndc.x + 1) * viewport.width / 2);
    near(points.topLeft.y, (1 - ndc.y) * viewport.height / 2);
  }
  assert.throws(() => projectReadingPlane(projection.camera, viewport, { ...body, width: -1 }), RangeError);
  assert.throws(() => projectReadingPlane(projection.camera, viewport, { ...body, y: NaN }), RangeError);
});
