import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, OrthographicCamera, Plane, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from '../../client/src/motion.mjs';
import { createReadingFan } from '../../client/src/reading-fan.mjs';
import { PLACEMENT_BOUNDS } from '../../client/src/reading-layout.mjs';
import { pickFan } from '../../client/src/reading-picking.mjs';
import { DEFAULT_VIEW, VIEW_LIMITS, VIEW_TARGET, ZOOM_LIMITS, getViewPosition, getViewSize } from '../../client/src/reading-view.mjs';

const views = [
  DEFAULT_VIEW,
  ...[VIEW_LIMITS.yaw.min, VIEW_LIMITS.yaw.max].flatMap(yaw =>
    [VIEW_LIMITS.elevation.min, VIEW_LIMITS.elevation.max].map(elevation => ({ yaw, elevation }))),
];
const aspects = [1.5, 2, 2.4];
// Physical IDs deliberately differ from their positions along the actual fan.
const order = Array.from({ length: CARD_COUNT }, (_, ordinal) => (ordinal * 37 + 11) % CARD_COUNT);
const fan = createReadingFan(order);
const candidates = order.map((id, ordinal) => ({ id, pose: fan[ordinal] }));

function cameraAt(view, aspect = 2) {
  const { width, height } = getViewSize(view, aspect);
  const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 100);
  camera.zoom = view.zoom ?? 1;
  camera.updateProjectionMatrix();
  const point = getViewPosition(view);
  camera.position.set(point.x, point.y, point.z);
  camera.lookAt(VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z);
  camera.updateMatrixWorld();
  return camera;
}

function rayThrough(camera, point) {
  const screen = new Vector3(point.x, point.y, point.z).project(camera);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(screen.x, screen.y), camera);
  return raycaster.ray;
}

test('every prepared fan center picks its physical ID at home and all orbit corners', () => {
  for (const aspect of aspects) for (const view of views) {
    const camera = cameraAt(view, aspect);
    for (const card of candidates) {
      const ray = rayThrough(camera, card.pose);
      assert.equal(pickFan(ray, candidates), card.id,
        `Wrong card at aspect ${aspect}, yaw ${view.yaw}, elevation ${view.elevation}, ID ${card.id}`);
    }
  }
});

test('fan ray picking stays correct at both optical zoom limits', () => {
  for (const zoom of [ZOOM_LIMITS.min, ZOOM_LIMITS.max]) for (const view of views) {
    const camera = cameraAt({ ...view, zoom });
    for (const card of candidates) assert.equal(pickFan(rayThrough(camera, card.pose), candidates), card.id);
  }
  // Max zoom intentionally crops the outer fan; offscreen rays check the mapping,
  // while the home/zoom-1 framing tests establish the full visible arrangement.
});

test('removing cards leaves the remaining physical IDs in their original fan positions', () => {
  const available = candidates.filter((_, ordinal) => ![0, 9, 37, 62, 77].includes(ordinal));
  for (const view of views) {
    const camera = cameraAt(view);
    for (const card of available) assert.equal(pickFan(rayThrough(camera, card.pose), available), card.id);
  }
});

test('blank table outside the fan remains available for camera dragging', () => {
  const emptyPoints = [
    { x: 0, y: 0.05, z: -0.7 },
    { x: -5.4, y: 0.05, z: -2.4 },
    { x: 5.4, y: 0.05, z: -2.4 },
    // The organic fan now reaches the former z=0.5 sample's picking footprint.
    { x: 0, y: 0.05, z: -0.2 },
  ];
  for (const view of views) {
    const camera = cameraAt(view);
    for (const point of emptyPoints) {
      assert.equal(pickFan(rayThrough(camera, point), candidates), null);
      assert.equal(pickFan(rayThrough(camera, point), []), null);
    }
  }
});

test('real camera rays recover the world table plane and each tilted fan local frame', () => {
  const table = new Plane(new Vector3(0, 1, 0), -0.05);
  for (const view of views) {
    const camera = cameraAt(view);
    for (const point of [new Vector3(PLACEMENT_BOUNDS.minX, 0.05, PLACEMENT_BOUNDS.minZ), new Vector3(0, 0.05, -0.7), new Vector3(PLACEMENT_BOUNDS.maxX, 0.05, PLACEMENT_BOUNDS.maxZ)]) {
      const recovered = rayThrough(camera, point).intersectPlane(table, new Vector3());
      assert.ok(recovered && recovered.distanceTo(point) < 1e-10);
    }
    for (const ordinal of [0, 17, 39, 60, 77]) {
      const card = candidates[ordinal], { pose } = card;
      const rotation = new Quaternion().setFromEuler(new Euler(pose.rx, pose.ry, pose.rz, 'XYZ'));
      const center = new Vector3(pose.x, pose.y, pose.z);
      const normal = new Vector3(0, 1, 0).applyQuaternion(rotation);
      const plane = new Plane().setFromNormalAndCoplanarPoint(normal, center);
      const point = new Vector3(CARD_WIDTH * 0.30, 0, -CARD_LENGTH * 0.30).applyQuaternion(rotation).add(center);
      const ray = rayThrough(camera, point), recovered = ray.intersectPlane(plane, new Vector3());
      assert.ok(recovered && recovered.distanceTo(point) < 1e-10);
      assert.equal(pickFan(ray, [card]), card.id);
      const outside = new Vector3(CARD_WIDTH / 2 + 0.10, 0, 0).applyQuaternion(rotation).add(center);
      assert.equal(pickFan(rayThrough(camera, outside), [card]), null);
    }
  }
});

test('view padding keeps the complete extreme placed-card bounds inside the frame', () => {
  const xCorners = [PLACEMENT_BOUNDS.minX - CARD_WIDTH / 2, PLACEMENT_BOUNDS.maxX + CARD_WIDTH / 2];
  const zCorners = [PLACEMENT_BOUNDS.minZ - CARD_LENGTH / 2, PLACEMENT_BOUNDS.maxZ + CARD_LENGTH / 2];
  const yCorners = [0.05, 0.05 + (CARD_COUNT - 1) * 0.012 + CARD_THICKNESS];
  for (const aspect of aspects) for (const view of views) {
    const camera = cameraAt(view, aspect);
    for (const x of xCorners) for (const y of yCorners) for (const z of zCorners) {
      const screen = new Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(screen.x) <= 1 + 1e-10 && Math.abs(screen.y) <= 1 + 1e-10 && Math.abs(screen.z) <= 1 + 1e-10,
        `Clipped corner (${x}, ${y}, ${z}) at aspect ${aspect}, yaw ${view.yaw}, elevation ${view.elevation}`);
    }
  }
});
