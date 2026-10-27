import { BufferGeometry, Float32BufferAttribute, DynamicDrawUsage, Sphere, Vector3 } from 'three';
import { CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from './motion.mjs';
import { deformCardPoint, FLEX_SEGMENTS } from './flex.mjs';

// Continuous strips across the short axis let the whole printed face bend.
// Top, bottom and paper edges share positions but retain crisp edge normals.
export function createCardGeometry(widthSegments = FLEX_SEGMENTS, lengthSegments = 6) {
  const positions = [], uvs = [], indices = [];
  const radius = 0.065;
  const rows = widthSegments + 1;
  const columns = lengthSegments + 1;
  function halfLength(x) {
    const corner = Math.max(0, Math.abs(x) - CARD_WIDTH / 2 + radius);
    return CARD_LENGTH / 2 - radius + Math.sqrt(Math.max(0, radius * radius - corner * corner));
  }
  function vertex(x, y, z, u, v) {
    positions.push(x, y, z); uvs.push(u, v);
    return positions.length / 3 - 1;
  }
  for (const y of [CARD_THICKNESS, 0]) {
    for (let i = 0; i < rows; i++) {
      const x = -CARD_WIDTH / 2 + i * CARD_WIDTH / widthSegments;
      const extent = halfLength(x);
      for (let j = 0; j < columns; j++) {
        const z = -extent + 2 * extent * j / lengthSegments;
        vertex(x, y, z, y ? x / CARD_WIDTH + 0.5 : 0.5 - x / CARD_WIDTH, 0.5 - z / CARD_LENGTH);
      }
    }
  }
  const groups = [];
  for (let face = 0; face < 2; face++) {
    const start = indices.length;
    const offset = face * rows * columns;
    for (let i = 0; i < widthSegments; i++) {
      for (let j = 0; j < lengthSegments; j++) {
        const a = offset + i * columns + j, b = a + columns, c = b + 1, d = a + 1;
        if (face === 0) indices.push(a, d, b, b, d, c);
        else indices.push(a, b, d, b, c, d);
      }
    }
    groups.push({ start, count: indices.length - start, material: face });
  }
  // Walk clockwise as seen from above so side normals point outwards.
  const boundary = [];
  for (let i = 0; i < rows; i++) boundary.push(i * columns);
  for (let j = 1; j < columns; j++) boundary.push((rows - 1) * columns + j);
  for (let i = rows - 2; i >= 0; i--) boundary.push(i * columns + columns - 1);
  for (let j = columns - 2; j > 0; j--) boundary.push(j);
  const edgeStart = indices.length;
  for (let i = 0; i < boundary.length; i++) {
    const p = boundary[i] * 3, q = boundary[(i + 1) % boundary.length] * 3;
    const a = vertex(positions[p], 0, positions[p + 2], 0, 0);
    const b = vertex(positions[q], 0, positions[q + 2], 1, 0);
    const c = vertex(positions[q], CARD_THICKNESS, positions[q + 2], 1, 1);
    const d = vertex(positions[p], CARD_THICKNESS, positions[p + 2], 0, 1);
    indices.push(a, d, b, b, d, c);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  for (const group of groups) geometry.addGroup(group.start, group.count, group.material);
  geometry.addGroup(edgeStart, indices.length - edgeStart, 2);
  geometry.computeVertexNormals();
  geometry.attributes.normal.setUsage(DynamicDrawUsage);
  geometry.userData.restPositions = Float32Array.from(positions);
  // Enclose all permitted bends without recalculating bounds every frame.
  geometry.boundingSphere = new Sphere(new Vector3(0, 0.2, 0), 1.8);
  return geometry;
}

export function applyCardFlex(geometry, flex) {
  const original = geometry.userData.restPositions;
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const offset = i * 3;
    const point = deformCardPoint(original[offset], original[offset + 1], original[offset + 2], flex);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}
