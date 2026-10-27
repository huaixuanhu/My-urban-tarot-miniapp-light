import test from 'node:test';
import assert from 'node:assert/strict';
import { getReadingPerspectiveFrame } from '../../client/src/reading-projection.mjs';
import { COTTAGE_ANCHOR, COTTAGE_METRES_PER_UNIT, READING_TABLE_CENTER_Z } from '../../client/src/reading-room.mjs';

// These are the actual source floor/window boundaries, not the larger model
// bounding box (which includes the exterior skyline). The desktop check starts
// at 760 × 900; narrow phone interaction and arbitrary portrait ratios are not
// qualified by this regression.
const SOURCE_ROOM = { minX: -5, maxX: 5, minZ: -4.59, maxZ: 5 };

test('desktop orbit camera stays inside the original cottage at low, side and overhead views', () => {
  const viewports = [
    { width: 760, height: 900 },
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
  ];
  for (const viewport of viewports) for (let degrees = -180; degrees < 180; degrees += 5) {
    for (const elevation of [12, 24, 42, 60, 90]) {
      const frame = getReadingPerspectiveFrame({ yaw: degrees * Math.PI / 180, elevation: elevation * Math.PI / 180, zoom: 1 }, viewport);
      const camera = {
        x: frame.position.x * COTTAGE_METRES_PER_UNIT + COTTAGE_ANCHOR.x,
        y: frame.position.y * COTTAGE_METRES_PER_UNIT + COTTAGE_ANCHOR.y,
        z: (frame.position.z - READING_TABLE_CENTER_Z) * COTTAGE_METRES_PER_UNIT + COTTAGE_ANCHOR.z,
      };
      const context = JSON.stringify({ viewport, degrees, elevation, camera });
      assert.ok(camera.x > SOURCE_ROOM.minX && camera.x < SOURCE_ROOM.maxX, context);
      assert.ok(camera.z > SOURCE_ROOM.minZ && camera.z < SOURCE_ROOM.maxZ, context);
      assert.ok(camera.y > COTTAGE_ANCHOR.y, context);
    }
  }
});
