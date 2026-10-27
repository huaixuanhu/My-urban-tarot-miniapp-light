import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardGeometry, applyCardFlex } from '../../client/src/card-geometry.mjs';
import { sampleFlex } from '../../client/src/flex.mjs';
import { CARD_THICKNESS } from '../../client/src/motion.mjs';

test('printed faces and paper edge form one indexed solid with outward normals', () => {
  const geometry = createCardGeometry();
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  assert.deepEqual(geometry.groups.map(group => group.materialIndex), [0, 1, 2]);
  for (const group of geometry.groups) {
    for (let i = group.start; i < group.start + group.count; i++) {
      const vertex = geometry.index.getX(i);
      const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
      const nx = normal.getX(vertex), ny = normal.getY(vertex), nz = normal.getZ(vertex);
      assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-5);
      if (group.materialIndex === 0) {
        assert.ok(Math.abs(y - CARD_THICKNESS) < 1e-8); assert.ok(ny > 0.999);
      } else if (group.materialIndex === 1) {
        assert.equal(y, 0); assert.ok(ny < -0.999);
      } else assert.ok(x * nx + z * nz > 0, 'paper edges face away from the card center');
    }
  }
});

test('actual curved mesh rewinds without accumulating deformation and returns exactly flat', () => {
  const geometry = createCardGeometry();
  const original = Float32Array.from(geometry.attributes.position.array);
  let curvedSamples = 0;
  for (const index of [0, 14, 38, 39, 53, 77]) {
    for (const t of [0.32, 0.36, 0.41, 0.46, 0.53, 0.61, 0.69]) {
      const flex = sampleFlex(index, t);
      applyCardFlex(geometry, flex);
      const expected = Float32Array.from(geometry.attributes.position.array);
      if (flex.active) {
        curvedSamples++;
        assert.notDeepEqual(expected, original);
      }
      applyCardFlex(geometry, sampleFlex(index, 1));
      assert.deepEqual(geometry.attributes.position.array, original);
      applyCardFlex(geometry, sampleFlex(index, 0));
      applyCardFlex(geometry, flex);
      assert.deepEqual(geometry.attributes.position.array, expected);
      const positions = geometry.attributes.position, normals = geometry.attributes.normal;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const x = positions.getX(vertex), y = positions.getY(vertex), z = positions.getZ(vertex);
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
        assert.ok(Math.hypot(x, y - 0.2, z) <= geometry.boundingSphere.radius, 'curves remain inside the render bounds');
        assert.ok(Math.abs(Math.hypot(normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex)) - 1) < 1e-5);
      }
    }
  }
  assert.ok(curvedSamples > 3, 'the rendered mesh actually bends at representative riffle times');
});
