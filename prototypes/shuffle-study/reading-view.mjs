/** Bounded reading-table camera; angles are radians and drag distances pixels. */
const radians = degrees => degrees * Math.PI / 180;
const RADIUS = Math.hypot(10.4, 11.4);
const DRAG_SCALE = 0.0025;
const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const VIEW_TARGET = Object.freeze({ x: 0, y: 0.1, z: 0.3 });
export const DEFAULT_VIEW = Object.freeze({ yaw: 0, elevation: Math.atan2(10.4, 11.4), zoom: 1 });
export const ZOOM_LIMITS = Object.freeze({ min: 0.75, max: 1.8 });
export const VIEW_LIMITS = Object.freeze({
  yaw: Object.freeze({ min: radians(-18), max: radians(18) }),
  elevation: Object.freeze({ min: radians(34), max: radians(60) }),
});

export function clampView(view = DEFAULT_VIEW) {
  return {
    zoom: clamp(finiteOr(view?.zoom, 1), ZOOM_LIMITS.min, ZOOM_LIMITS.max),
    yaw: clamp(finiteOr(view?.yaw, DEFAULT_VIEW.yaw), VIEW_LIMITS.yaw.min, VIEW_LIMITS.yaw.max),
    elevation: clamp(finiteOr(view?.elevation, DEFAULT_VIEW.elevation), VIEW_LIMITS.elevation.min, VIEW_LIMITS.elevation.max),
  };
}

/**
 * start is the pointer-down view; dx/dy are total displacement from that point.
 * Rightward grabbing decreases camera yaw. Downward dragging raises elevation (owner-requested vertical reversal).
 */
export function dragView(start, dx, dy) {
  const initial = clampView(start);
  return clampView({ zoom: initial.zoom, yaw: initial.yaw - finiteOr(dx, 0) * DRAG_SCALE, elevation: initial.elevation + finiteOr(dy, 0) * DRAG_SCALE });
}

function hasDefaultAngles(current) {
  return Math.abs(current.yaw - DEFAULT_VIEW.yaw) <= 1e-9 && Math.abs(current.elevation - DEFAULT_VIEW.elevation) <= 1e-9;
}
export function isDefaultView(view) {
  const current = clampView(view);
  return hasDefaultAngles(current) && Math.abs(current.zoom - 1) <= 1e-9;
}

/** Wheel units are normalized before changing the bounded optical scale. */
export function wheelZoom(zoom, deltaY, deltaMode = 0, pageHeight = 800) {
  const current = clamp(finiteOr(zoom, 1), ZOOM_LIMITS.min, ZOOM_LIMITS.max);
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, finiteOr(pageHeight, 800)) : 1;
  const pixels = clamp(finiteOr(deltaY, 0) * unit, -480, 480);
  return clamp(current * Math.exp(-pixels * 0.0015), ZOOM_LIMITS.min, ZOOM_LIMITS.max);
}

export function getViewPosition(view = DEFAULT_VIEW) {
  const current = clampView(view);
  // Preserve the original camera coordinates exactly for initial/reset framing.
  if (hasDefaultAngles(current)) return { x: 0, y: 10.5, z: 11.7 };
  const horizontal = RADIUS * Math.cos(current.elevation);
  return { x: VIEW_TARGET.x + horizontal * Math.sin(current.yaw), y: VIEW_TARGET.y + RADIUS * Math.sin(current.elevation), z: VIEW_TARGET.z + horizontal * Math.cos(current.yaw) };
}

/** Original reading-table orthographic framing, unchanged by camera dragging. */
export function fitViewSize(aspect) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 12.8 / 7.6;
  const width = Math.max(12.8, safeAspect * 7.6);
  const height = width / safeAspect;
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : { width: 12.8, height: 7.6 };
}

/** Keep the conservative card/table envelope in frame after orbiting. */
export function getViewSize(view, aspect) {
  const current = clampView(view);
  const base = fitViewSize(aspect);
  if (hasDefaultAngles(current)) return base;
  const sinYaw = Math.sin(current.yaw), cosYaw = Math.cos(current.yaw);
  const sinElevation = Math.sin(current.elevation), cosElevation = Math.cos(current.elevation);
  let maxX = 0, maxY = 0;
  for (const x of [-6.05, 6.05]) for (const y of [-0.025, 1.10]) for (const z of [-3.70, 4.50]) {
    const dx = x - VIEW_TARGET.x, dy = y - VIEW_TARGET.y, dz = z - VIEW_TARGET.z;
    const projectedX = cosYaw * dx - sinYaw * dz;
    const projectedY = -sinElevation * sinYaw * dx + cosElevation * dy - sinElevation * cosYaw * dz;
    maxX = Math.max(maxX, Math.abs(projectedX));
    maxY = Math.max(maxY, Math.abs(projectedY));
  }
  const safeAspect = base.width / base.height;
  const width = Math.max(base.width, 2 * maxX * 1.02, 2 * maxY * 1.02 * safeAspect);
  const height = width / safeAspect;
  // Preserve finite output even for pathological, effectively zero aspect ratios.
  if (!Number.isFinite(width) || !Number.isFinite(height)) return getViewSize(current, 12.8 / 7.6);
  return { width, height };
}
