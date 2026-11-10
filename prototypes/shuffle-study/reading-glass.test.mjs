import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingGlassGeometry, createReadingGlassRimPoints, createGlassOutline, glassCornerRadius } from '../../client/src/reading-glass.mjs';
import * as THREE from 'three';
import { GLASS_WIDTH, GLASS_LENGTH, CLOTH_CENTER_Z, PLACEMENT_BOUNDS, DROP_MARGIN } from '../../client/src/reading-layout.mjs';
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

test('physical corner candidates match cut-in and retain straight sides and symmetric contours', () => {
  const cutIn = k => (glassCornerRadius(k) - .065) * (1 - 2 ** (-1 / 2 ** k));
  assert.ok(Math.abs(cutIn(1.5) - cutIn(1.8)) < 1e-12);
  for (const k of [1.5, 1.8]) {
    const points = createGlassOutline(GLASS_WIDTH, GLASS_LENGTH, glassCornerRadius(k), k).getPoints();
    const unique = points.slice(0, -1);
    for (let i = 0; i < unique.length; i++) {
      const point = unique[i], next = unique[(i + 1) % unique.length];
      assert.ok(point.distanceTo(next) > 1e-8, 'No duplicate bevel vertices.');
      assert.ok(unique.some(p => Math.abs(p.x + point.x) < 1e-9 && Math.abs(p.y + point.y) < 1e-9));
    }
    assert.equal(unique.filter((p, i) => p.distanceTo(unique[(i + 1) % unique.length]) > 5).length, 4);
  }
});

test('both glass candidates keep sound triangles, thickness and rings on the extruded bevel', () => {
  for (const k of [1.5, 1.8]) {
    const geometry = createReadingGlassGeometry({ cornerK: k });
    try {
      const p = geometry.attributes.position, n = geometry.attributes.normal, box = geometry.boundingBox;
      assert.ok(Math.abs(box.max.y + .008) < 1e-7);
      assert.ok(Math.abs(box.min.y + .168) < 1e-7);
      assert.ok(Math.abs(box.max.x - box.min.x - GLASS_WIDTH) < 1e-5);
      assert.ok(Math.abs(box.max.z - box.min.z - GLASS_LENGTH) < 1e-5);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
        assert.ok(b.sub(a).cross(c.sub(a)).length() > 1e-10, 'No collapsed extrusion triangles.');
      }
      for (let i = 0; i < n.count; i++) assert.ok(Math.abs(a.fromBufferAttribute(n, i).length() - 1) < 1e-5);
      const rim = createReadingGlassRimPoints(geometry);
      assert.equal(rim.length, 196);
      const edgeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      const ray = new THREE.Raycaster();
      for (const x of [PLACEMENT_BOUNDS.minX - DROP_MARGIN - CARD_WIDTH / 2, PLACEMENT_BOUNDS.maxX + DROP_MARGIN + CARD_WIDTH / 2]) {
        for (const z of [PLACEMENT_BOUNDS.minZ - DROP_MARGIN - CARD_LENGTH / 2, PLACEMENT_BOUNDS.maxZ + DROP_MARGIN + CARD_LENGTH / 2]) {
          ray.set(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObject(edgeMesh)[0];
          assert.ok(hit && Math.abs(hit.point.y + .008) < 1e-6, 'Complete cards at placement limits retain flat glass support.');
        }
      }
      for (let i = 0; i < rim.length; i += 3) {
        const point = rim[i], direction = new THREE.Vector3(point.x, 0, point.z - CLOTH_CENTER_Z).normalize();
        assert.ok(Math.abs(point.y + .023) < 1e-9);
        ray.set(point.clone().addScaledVector(direction, .1), direction.clone().negate());
        const hit = ray.intersectObject(edgeMesh)[0];
        assert.ok(hit && hit.point.distanceTo(point) < 2e-6, 'Highlight lies on the actual bevel.');
      }
      edgeMesh.material.dispose();
    } finally { geometry.dispose(); }
  }
});
