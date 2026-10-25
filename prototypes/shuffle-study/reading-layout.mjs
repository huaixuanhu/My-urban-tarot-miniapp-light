/** Shared world-space bounds for cloth, drops and reading-camera framing. */
export const CLOTH_WIDTH = 14.8;
export const CLOTH_LENGTH = 11.2;
export const CLOTH_CENTER_Z = -0.6;
export const PLACEMENT_BOUNDS = Object.freeze({ minX: -6.6, maxX: 6.6, minZ: -4.6, maxZ: 0.75 });
export const DROP_MARGIN = 0.2;
// Includes the full card at the placement limits, the fan and reveal lift.
export const READING_ENVELOPE = Object.freeze({ minX: -7.25, maxX: 7.25, minY: -0.025, maxY: 1.10, minZ: -5.65, maxZ: 4.50 });

export function canPlaceAt(point) {
  const b = PLACEMENT_BOUNDS;
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.z)
    && point.x >= b.minX - DROP_MARGIN && point.x <= b.maxX + DROP_MARGIN
    && point.z >= b.minZ - DROP_MARGIN && point.z <= b.maxZ + DROP_MARGIN;
}

export function clampPlacement(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
  const b = PLACEMENT_BOUNDS;
  return { x: Math.max(b.minX, Math.min(b.maxX, point.x)), z: Math.max(b.minZ, Math.min(b.maxZ, point.z)) };
}
