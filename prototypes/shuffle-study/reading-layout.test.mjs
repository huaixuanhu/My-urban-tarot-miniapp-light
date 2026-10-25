import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_WIDTH, CARD_LENGTH } from './motion.mjs';
import { CLOTH_WIDTH, CLOTH_LENGTH, CLOTH_CENTER_Z, PLACEMENT_BOUNDS, DROP_MARGIN, READING_ENVELOPE, canPlaceAt, clampPlacement } from './reading-layout.mjs';
import { CLOTH_MAX_HEIGHT, createReadingClothGeometry } from './reading-cloth.mjs';

test('larger cloth retains its front edge and contains full cards at all placement limits', () => {
  assert.equal(CLOTH_WIDTH, 14.8); assert.equal(CLOTH_LENGTH, 11.2); assert.equal(CLOTH_CENTER_Z, -0.6);
  assert.equal(CLOTH_CENTER_Z + CLOTH_LENGTH / 2, 5);
  assert.deepEqual(PLACEMENT_BOUNDS, { minX: -6.6, maxX: 6.6, minZ: -4.6, maxZ: 0.75 });
  for (const x of [PLACEMENT_BOUNDS.minX, PLACEMENT_BOUNDS.maxX]) {
    for (const z of [PLACEMENT_BOUNDS.minZ, PLACEMENT_BOUNDS.maxZ]) {
      for (const dx of [-CARD_WIDTH / 2, CARD_WIDTH / 2]) for (const dz of [-CARD_LENGTH / 2, CARD_LENGTH / 2]) {
        const edgeX = x + dx, edgeZ = z + dz;
        // Conservative inward margins include the cloth's bounded edge waviness.
        assert.ok(Math.abs(edgeX) < CLOTH_WIDTH / 2 - 0.03);
        assert.ok(edgeZ > CLOTH_CENTER_Z - CLOTH_LENGTH / 2 + 0.037);
        assert.ok(edgeZ < CLOTH_CENTER_Z + CLOTH_LENGTH / 2 - 0.037);
        assert.ok(edgeX >= READING_ENVELOPE.minX && edgeX <= READING_ENVELOPE.maxX);
        assert.ok(edgeZ >= READING_ENVELOPE.minZ && edgeZ <= READING_ENVELOPE.maxZ);
      }
    }
  }
});

test('drop acceptance includes the boundary margin and clamps centers without mutating input', () => {
  const b = PLACEMENT_BOUNDS;
  for (const point of [{ x: b.minX - DROP_MARGIN, z: b.minZ - DROP_MARGIN }, { x: b.maxX + DROP_MARGIN, z: b.maxZ + DROP_MARGIN }]) {
    const before = { ...point };
    assert.equal(canPlaceAt(point), true);
    const placed = clampPlacement(point);
    assert.ok(placed.x >= b.minX && placed.x <= b.maxX && placed.z >= b.minZ && placed.z <= b.maxZ);
    assert.deepEqual(point, before);
  }
  assert.deepEqual(clampPlacement({ x: -6, z: -4 }), { x: -6, z: -4 });
  for (const point of [{ x: b.minX - DROP_MARGIN - 1e-6, z: 0 }, { x: b.maxX + DROP_MARGIN + 1e-6, z: 0 }, { x: 0, z: b.minZ - DROP_MARGIN - 1e-6 }, { x: 0, z: b.maxZ + DROP_MARGIN + 1e-6 }]) {
    assert.equal(canPlaceAt(point), false);
  }
});

test('invalid drop coordinates cannot enter the reading state', () => {
  for (const point of [null, undefined, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: '1', z: 0 }]) {
    assert.equal(canPlaceAt(point), false);
    assert.equal(clampPlacement(point), null);
  }
});

test('enlarged cloth mesh retains finite extents and clears the underlying floor', () => {
  const geometry = createReadingClothGeometry();
  try {
    const positions = geometry.attributes.position, bounds = geometry.boundingBox;
    assert.ok(positions.array.every(Number.isFinite));
    assert.ok(bounds.min.x >= -CLOTH_WIDTH / 2 - 0.03 && bounds.max.x <= CLOTH_WIDTH / 2 + 0.03);
    assert.ok(bounds.min.z >= CLOTH_CENTER_Z - CLOTH_LENGTH / 2 - 0.038 && bounds.max.z <= CLOTH_CENTER_Z + CLOTH_LENGTH / 2 + 0.038);
    assert.ok(bounds.max.x - bounds.min.x > 14.7 && bounds.max.z - bounds.min.z > 11.1);
    assert.ok(bounds.max.y <= CLOTH_MAX_HEIGHT);
    assert.ok(bounds.min.y - 0.008 > -0.08, 'The cloth sidewall must clear the underlying floor.');
  } finally { geometry.dispose(); }
});
