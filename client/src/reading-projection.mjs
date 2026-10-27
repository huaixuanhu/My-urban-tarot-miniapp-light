import * as THREE from 'three';
import { CLOTH_WIDTH, CLOTH_LENGTH, CLOTH_CENTER_Z, READING_ENVELOPE } from './reading-layout.mjs';
import { DEFAULT_VIEW, VIEW_TARGET, clampView, getViewPosition, getViewBasis } from './reading-view.mjs';
import { READING_DOCK } from './reading-dock.mjs';

export const READING_FOV = 42;
export const DEFAULT_READING_PADDING = Object.freeze({ top: 96, right: 28, bottom: 80, left: 28 });
// Keep the real volumes separate. A high card at the outer glass edge is not
// part of the accepted scene; merging everything into one box wastes framing.
export const READING_PROJECTION_VOLUMES = Object.freeze([
  READING_ENVELOPE,
  Object.freeze({ minX: -CLOTH_WIDTH / 2, maxX: CLOTH_WIDTH / 2, minY: -0.18, maxY: -0.008,
    minZ: CLOTH_CENTER_Z - CLOTH_LENGTH / 2, maxZ: CLOTH_CENTER_Z + CLOTH_LENGTH / 2 }),
  Object.freeze({ minX: READING_DOCK.x - READING_DOCK.width / 2, maxX: READING_DOCK.x + READING_DOCK.width / 2,
    minY: READING_DOCK.bottom, maxY: READING_DOCK.top + 0.003,
    minZ: READING_DOCK.z - READING_DOCK.length / 2, maxZ: READING_DOCK.z + READING_DOCK.length / 2 }),
]);
// Overall extents remain available for summaries; fitting uses the volumes above.
export const READING_PROJECTION_ENVELOPE = Object.freeze({
  minX: Math.min(READING_ENVELOPE.minX, -CLOTH_WIDTH / 2),
  maxX: Math.max(READING_ENVELOPE.maxX, CLOTH_WIDTH / 2),
  minY: Math.min(READING_ENVELOPE.minY, -0.18),
  maxY: READING_ENVELOPE.maxY,
  minZ: Math.min(READING_ENVELOPE.minZ, CLOTH_CENTER_Z - CLOTH_LENGTH / 2),
  maxZ: Math.max(READING_ENVELOPE.maxZ, CLOTH_CENTER_Z + CLOTH_LENGTH / 2),
});

const target = new THREE.Vector3(VIEW_TARGET.x, VIEW_TARGET.y, VIEW_TARGET.z);
const corners = [];
for (const bounds of READING_PROJECTION_VOLUMES) {
  for (const x of [bounds.minX, bounds.maxX]) for (const y of [bounds.minY, bounds.maxY]) {
    for (const z of [bounds.minZ, bounds.maxZ]) corners.push(new THREE.Vector3(x, y, z));
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
  const safeCenterX = (left - right) / size.width, safeCenterY = (bottom - top) / size.height;
  const original = getViewPosition(current);
  let distance = new THREE.Vector3(original.x, original.y, original.z).distanceTo(target);
  const basis = getViewBasis(current);
  const back = new THREE.Vector3(basis.back.x, basis.back.y, basis.back.z);
  const cameraRight = new THREE.Vector3(basis.right.x, basis.right.y, basis.right.z);
  const cameraUp = new THREE.Vector3(basis.up.x, basis.up.y, basis.up.z);
  const tangent = Math.tan(READING_FOV * Math.PI / 360);
  const offsets = corners.map(corner => {
    const relative = corner.clone().sub(target);
    return { x: relative.dot(cameraRight), y: relative.dot(cameraUp), z: relative.dot(back) };
  });
  function rangeAt(radius) {
    const range = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const point of offsets) {
      const depth = radius - point.z;
      const x = point.x / (depth * tangent * aspect), y = point.y / (depth * tangent);
      range.minX = Math.min(range.minX, x); range.maxX = Math.max(range.maxX, x);
      range.minY = Math.min(range.minY, y); range.maxY = Math.max(range.maxY, y);
    }
    return range;
  }
  const fits = range => (range.maxX - range.minX) * 1.025 <= spanX * 2 && (range.maxY - range.minY) * 1.025 <= spanY * 2;
  // Fit projected spans instead of mirroring the longer far half around the
  // historical target. The table then uses the safe area evenly at exact90.
  if (!fits(rangeAt(distance))) {
    let low = distance, high = distance * 2;
    while (!fits(rangeAt(high))) high *= 2;
    for (let step = 0; step < 36; step += 1) {
      const middle = (low + high) / 2;
      if (fits(rangeAt(middle))) high = middle; else low = middle;
    }
    distance = high;
  }
  const range = rangeAt(distance);
  // Zoom remains optical and centered on the fitted scene, not an empty part
  // of the historical target. No current card/reset state enters this fit.
  const centerX = safeCenterX - (range.minX + range.maxX) / 2 * current.zoom;
  const centerY = safeCenterY - (range.minY + range.maxY) / 2 * current.zoom;
  return {
    view: current, aspect, width: size.width, height: size.height,
    fov: READING_FOV, near: 0.1, far: Math.max(100, distance + 40), distance,
    position: target.clone().addScaledVector(back, distance), up: cameraUp, right: cameraRight, back,
    centerX, centerY,
    safeBounds: { minX: -1 + 2 * left / size.width, maxX: 1 - 2 * right / size.width,
      minY: -1 + 2 * bottom / size.height, maxY: 1 - 2 * top / size.height },
  };
}

function pointCamera(camera, position, up) {
  camera.position.copy(position);
  camera.up.copy(up);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

/** Project a horizontal physical plane; far edge first, then clockwise. */
export function projectReadingPlane(camera, viewport, { x, y, z, width, length }) {
  if (![x, y, z, width, length].every(Number.isFinite) || width <= 0 || length <= 0) {
    throw new RangeError('A projected reading plane needs finite coordinates and positive dimensions.');
  }
  const size = viewportSize(viewport);
  const point = (dx, dz) => {
    const ndc = new THREE.Vector3(x + dx, y, z + dz).project(camera);
    return {
      x: (ndc.x + 1) * size.width / 2, y: (1 - ndc.y) * size.height / 2, depth: ndc.z,
      visible: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z >= -1 && ndc.z <= 1,
    };
  };
  return {
    topLeft: point(-width / 2, -length / 2), topRight: point(width / 2, -length / 2),
    bottomRight: point(width / 2, length / 2), bottomLeft: point(-width / 2, length / 2),
  };
}

/**
 * Reading and reset share one physical perspective camera and lens. Reset
 * progress never changes projection or silently moves to another viewpoint.
 * The controller owns chosen angles/zoom and may ease zoom alone before reset.
 */
export function createReadingProjection({ padding = DEFAULT_READING_PADDING } = {}) {
  const perspective = new THREE.PerspectiveCamera(READING_FOV, 1, 0.1, 100);

  return {
    get camera() { return perspective; },
    update(view = DEFAULT_VIEW, viewport) {
      const frame = getReadingPerspectiveFrame(view, viewport, padding);
      perspective.aspect = frame.aspect; perspective.zoom = frame.view.zoom;
      perspective.near = frame.near; perspective.far = frame.far;
      pointCamera(perspective, frame.position, frame.up);
      perspective.updateProjectionMatrix();
      // Shift the optical center up from the bottom dock without tilting or
      // moving the table. Native PerspectiveCamera unprojection still applies.
      perspective.projectionMatrix.elements[8] = -frame.centerX;
      perspective.projectionMatrix.elements[9] = -frame.centerY;
      perspective.projectionMatrixInverse.copy(perspective.projectionMatrix).invert();
      return perspective;
    },
  };
}
