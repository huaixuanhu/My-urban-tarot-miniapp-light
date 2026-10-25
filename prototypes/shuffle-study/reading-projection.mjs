import * as THREE from 'three';
import { CLOTH_WIDTH, CLOTH_LENGTH, CLOTH_CENTER_Z, READING_ENVELOPE } from './reading-layout.mjs';
import { DEFAULT_VIEW, VIEW_TARGET, clampView, getViewPosition, fitViewSize } from './reading-view.mjs';
import { CARD_WIDTH, CARD_LENGTH } from './motion.mjs';

export const READING_FOV = 42;
export const DEFAULT_READING_PADDING = Object.freeze({ top: 96, right: 28, bottom: 140, left: 28 });
export const READING_PROJECTION_ENVELOPE = Object.freeze({
  minX: Math.min(READING_ENVELOPE.minX, -CLOTH_WIDTH / 2),
  maxX: Math.max(READING_ENVELOPE.maxX, CLOTH_WIDTH / 2),
  minY: Math.min(READING_ENVELOPE.minY, -0.14),
  maxY: READING_ENVELOPE.maxY,
  minZ: Math.min(READING_ENVELOPE.minZ, CLOTH_CENTER_Z - CLOTH_LENGTH / 2),
  maxZ: Math.max(READING_ENVELOPE.maxZ, CLOTH_CENTER_Z + CLOTH_LENGTH / 2),
});

const target = new THREE.Vector3(VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z);
const corners = [];
for (const x of [READING_PROJECTION_ENVELOPE.minX, READING_PROJECTION_ENVELOPE.maxX]) {
  for (const y of [READING_PROJECTION_ENVELOPE.minY, READING_PROJECTION_ENVELOPE.maxY]) {
    for (const z of [READING_PROJECTION_ENVELOPE.minZ, READING_PROJECTION_ENVELOPE.maxZ]) corners.push(new THREE.Vector3(x, y, z));
  }
}

function viewportSize(viewport) {
  const valid = value => Number.isFinite(value) && value >= 1 && value <= 1e6;
  return { width: valid(viewport?.width) ? viewport.width : 1440, height: valid(viewport?.height) ? viewport.height : 1000 };
}

/** Fit the whole accepted table/card envelope at 100%; closer zoom may crop. */
export function getReadingPerspectiveFrame(view = DEFAULT_VIEW, viewport, padding = DEFAULT_READING_PADDING) {
  const current = clampView(view), size = viewportSize(viewport);
  const aspect = size.width / size.height;
  const inset = (key, axis) => {
    const value = padding?.[key] ?? DEFAULT_READING_PADDING[key];
    return Math.min(axis * 0.3, Math.max(0, Number.isFinite(value) ? value : 0));
  };
  const left = inset('left', size.width), right = inset('right', size.width);
  const top = inset('top', size.height), bottom = inset('bottom', size.height);
  const spanX = (size.width - left - right) / size.width;
  const spanY = (size.height - top - bottom) / size.height;
  const centerX = (left - right) / size.width, centerY = (bottom - top) / size.height;
  const original = getViewPosition(current);
  const back = new THREE.Vector3(original.x, original.y, original.z).sub(target);
  let distance = back.length();
  back.normalize();
  const cameraRight = new THREE.Vector3(back.z, 0, -back.x).normalize();
  const cameraUp = new THREE.Vector3().crossVectors(back, cameraRight);
  const tangent = Math.tan(READING_FOV * Math.PI / 360);
  for (const corner of corners) {
    const relative = corner.clone().sub(target), depthOffset = relative.dot(back);
    // Solve the perspective inequalities directly; the near edge is not fitted
    // as if it were at the target's depth. A small margin covers roundoff/edges.
    distance = Math.max(distance,
      depthOffset + Math.abs(relative.dot(cameraRight)) * 1.025 / (tangent * aspect * spanX),
      depthOffset + Math.abs(relative.dot(cameraUp)) * 1.025 / (tangent * spanY),
      depthOffset + 1);
  }
  return {
    view: current, aspect, width: size.width, height: size.height,
    fov: READING_FOV, near: 0.1, far: Math.max(100, distance + 40), distance,
    position: target.clone().addScaledVector(back, distance),
    centerX, centerY,
    safeBounds: { minX: -1 + 2 * left / size.width, maxX: 1 - 2 * right / size.width,
      minY: -1 + 2 * bottom / size.height, maxY: 1 - 2 * top / size.height },
  };
}

function pointCamera(camera, position) {
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

/** Keep the floating dock attached to the near rim, below the fan's pick area. */
export function getReadingDockAnchor(camera, viewport, fanPoses, controlsHeight, dockHeight) {
  const size = viewportSize(viewport);
  const screenY = point => (1 - point.project(camera).y) * size.height / 2;
  const edgeY = screenY(new THREE.Vector3(0, 0, CLOTH_CENTER_Z + CLOTH_LENGTH / 2));
  const rotation = new THREE.Quaternion(), point = new THREE.Vector3();
  let fanBottom = 0;
  // Include every original fan slot, even when drawn, so selecting/revealing a
  // card cannot move the permanent controls under an ongoing pointer click.
  for (const pose of fanPoses) {
    rotation.setFromEuler(new THREE.Euler(pose.rx, pose.ry, pose.rz, 'XYZ'));
    for (const x of [-CARD_WIDTH / 2 - 0.06, CARD_WIDTH / 2 + 0.06]) {
      for (const z of [-CARD_LENGTH / 2 - 0.06, CARD_LENGTH / 2 + 0.06]) {
        point.set(x, 0, z).applyQuaternion(rotation).add(new THREE.Vector3(pose.x, pose.y, pose.z));
        fanBottom = Math.max(fanBottom, screenY(point));
      }
    }
  }
  const desiredTop = Math.max(edgeY - dockHeight / 2, fanBottom + 36);
  const top = Math.min(Math.max(100, desiredTop), size.height - controlsHeight - 25);
  return { bottom: Math.max(25, size.height - top - controlsHeight), top, fanBottom, edgeY };
}

/**
 * Reading uses a true perspective camera, including its native ray casting.
 * The reset choreography retains its exact original orthographic endpoint.
 * A native perspective dolly/long-lens transition approaches that endpoint,
 * keeping physical-material view directions consistent with the actual lens.
 * The caller still keeps reset picking disabled as in the existing reader.
 */
export function createReadingProjection({ padding = DEFAULT_READING_PADDING } = {}) {
  const perspective = new THREE.PerspectiveCamera(READING_FOV, 1, 0.1, 100);
  const orthographic = new THREE.OrthographicCamera(-6.4, 6.4, 3.8, -3.8, 0.1, 100);
  const transition = new THREE.PerspectiveCamera(READING_FOV, 1, 0.1, 100);
  let camera = perspective;

  return {
    get camera() { return camera; },
    update(view = DEFAULT_VIEW, viewport, shuffleFraming = 0) {
      const frame = getReadingPerspectiveFrame(view, viewport, padding);
      const t = Number.isFinite(shuffleFraming) ? Math.max(0, Math.min(1, shuffleFraming)) : 0;
      perspective.aspect = frame.aspect; perspective.zoom = frame.view.zoom;
      perspective.near = frame.near; perspective.far = frame.far;
      pointCamera(perspective, frame.position);
      perspective.updateProjectionMatrix();
      // Shift the optical center up from the bottom dock without tilting or
      // moving the table. Native PerspectiveCamera unprojection still applies.
      perspective.projectionMatrix.elements[8] = -frame.centerX;
      perspective.projectionMatrix.elements[9] = -frame.centerY;
      perspective.projectionMatrixInverse.copy(perspective.projectionMatrix).invert();
      if (t === 0) { camera = perspective; return camera; }

      const shuffle = fitViewSize(frame.aspect), original = getViewPosition(frame.view);
      orthographic.left = -shuffle.width / 2; orthographic.right = shuffle.width / 2;
      orthographic.top = shuffle.height / 2; orthographic.bottom = -shuffle.height / 2;
      orthographic.zoom = frame.view.zoom;
      pointCamera(orthographic, new THREE.Vector3(original.x, original.y, original.z));
      orthographic.updateProjectionMatrix();
      if (t === 1) { camera = orthographic; return camera; }

      // Approach parallel projection by moving away while narrowing the lens.
      // Keep a finite ceiling to avoid floating-point depth loss. At the ceiling
      // the endpoint's residual perspective is below one desktop pixel; switching
      // to the exact original ortho camera also restores its original clip range.
      const distance = Math.min(6000, frame.distance / (1 - t));
      const direction = frame.position.clone().sub(target).normalize();
      const position = target.clone().addScaledVector(direction, distance);
      const halfHeight = frame.distance * Math.tan(READING_FOV * Math.PI / 360) * (1 - t) + shuffle.height / 2 * t;
      transition.fov = 2 * Math.atan(halfHeight / distance) * 180 / Math.PI;
      transition.near = Math.max(0.1, distance - 40); transition.far = distance + 40;
      transition.aspect = frame.aspect; transition.zoom = frame.view.zoom;
      pointCamera(transition, position);
      transition.updateProjectionMatrix();
      transition.projectionMatrix.elements[8] = -frame.centerX * (1 - t);
      transition.projectionMatrix.elements[9] = -frame.centerY * (1 - t);
      transition.projectionMatrixInverse.copy(transition.projectionMatrix).invert();
      camera = transition;
      return camera;
    },
  };
}
