import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingGlassGeometry } from '../../client/src/reading-glass.mjs';
import { GLASS_WIDTH, GLASS_LENGTH, CLOTH_CENTER_Z, PLACEMENT_BOUNDS } from '../../client/src/reading-layout.mjs';
import { CARD_WIDTH, CARD_LENGTH } from '../../client/src/motion.mjs';

test('glass retains accepted playing area and stays below cards and above its support', () => {
  const geometry = createReadingGlassGeometry();
  try {
    const b = geometry.boundingBox;
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
    assert.ok(Math.abs(b.max.x - b.min.x - GLASS_WIDTH) < 0.0001);
    assert.ok(Math.abs(b.max.z - b.min.z - GLASS_LENGTH) < 0.0001);
    assert.ok(Math.abs((b.min.z + b.max.z) / 2 - CLOTH_CENTER_Z) < 0.0001);
    assert.ok(b.max.y < 0, 'No glass rim protrudes into the card layer.');
    assert.ok(b.min.y > -0.18, 'Glass clears the underlying shadow receiver.');
    assert.ok(PLACEMENT_BOUNDS.minX - CARD_WIDTH / 2 > b.min.x);
    assert.ok(PLACEMENT_BOUNDS.maxX + CARD_WIDTH / 2 < b.max.x);
    assert.ok(PLACEMENT_BOUNDS.minZ - CARD_LENGTH / 2 > b.min.z);
    assert.ok(PLACEMENT_BOUNDS.maxZ + CARD_LENGTH / 2 < b.max.z);
  } finally { geometry.dispose(); }
});
