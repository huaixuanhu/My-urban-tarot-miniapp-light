import * as THREE from 'three';

/** A stationary, unpatterned textile surface for the local reading prototype. */
export const CLOTH_WIDTH = 12.4;
export const CLOTH_LENGTH = 9.2;
export const CLOTH_CENTER_Z = 0.4;
export const CLOTH_MAX_HEIGHT = 0.013;

const TAU = Math.PI * 2;
const HALF_WIDTH = CLOTH_WIDTH / 2;
const HALF_LENGTH = CLOTH_LENGTH / 2;
const SIDE_PLEATS = [-3.55, -1.85, 0.15, 2.15, 3.65];
const END_PLEATS = [-5.25, -3.15, -0.75, 1.65, 4.55];

function downwardPleats(position, centers, offset) {
  let height = 0;
  for (let index = 0; index < centers.length; index += 1) {
    const width = 0.14 + (index % 3) * 0.045;
    const distance = (position - centers[index] - offset) / width;
    height -= (0.032 + (index % 2) * 0.008) * Math.exp(-distance * distance);
  }
  return height;
}

/** Normalized coordinates in [-1, 1]; only the outside margins carry folds. */
export function readingClothPoint(u, v) {
  const x = u * HALF_WIDTH;
  const z = v * HALF_LENGTH;
  const sideWeight = Math.exp(-(1 - Math.abs(u)) * HALF_WIDTH / 0.48);
  const endWeight = Math.exp(-(1 - Math.abs(v)) * HALF_LENGTH / 0.52);
  const edgeX = Math.sign(u) * sideWeight * (0.020 * Math.sin(z * 1.37 + 0.8) + 0.009 * Math.sin(z * 3.9));
  const edgeZ = Math.sign(v) * endWeight * (0.025 * Math.sin(x * 0.91 + 0.4) + 0.012 * Math.sin(x * 2.8));
  // Narrow downward creases give the plain cloth readable side lighting.
  // Their staggered positions avoid a regular scalloped or decorative border.
  const edgeFold = sideWeight * (-0.007 + 0.009 * Math.sin(z * 1.8 + 0.4) + 0.003 * Math.sin(z * 4.7)
      + downwardPleats(z + (1 - Math.abs(u)) * 0.42, SIDE_PLEATS, u < 0 ? -0.12 : 0.14))
    + endWeight * (-0.007 + 0.008 * Math.sin(x * 1.45 - 0.7) + 0.003 * Math.sin(x * 4.2)
      + downwardPleats(x - (1 - Math.abs(v)) * 0.51, END_PLEATS, v < 0 ? 0.10 : -0.16));
  const cornerCurl = 0.016 * Math.exp(-((u + 0.97) ** 2 / 0.005 + (v - 0.97) ** 2 / 0.013));
  const surface = -0.006 + 0.0011 * Math.sin(x * 0.8) * Math.sin(z * 0.6) + edgeFold + cornerCurl;
  // The 0.008-thick sidewall also stays above -0.065 and the floor at -0.08.
  return { x: x + edgeX, y: THREE.MathUtils.clamp(surface, -0.0565, 0.0115), z: z + edgeZ + CLOTH_CENTER_Z };
}

export function createReadingClothGeometry() {
  const columns = 112;
  const rows = 84;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const v = row / rows;
      const point = readingClothPoint(u * 2 - 1, v * 2 - 1);
      positions.push(point.x, point.y, point.z);
      uvs.push(u, v);
      if (column < columns && row < rows) {
        const a = row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function noise(x, y) {
  let value = Math.imul(x ^ 61417, 374761393) ^ Math.imul(y + 61417, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function clothTexture(renderer) {
  const canvas = document.createElement('canvas');
  const size = 512;
  const period = size - 1;
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable for the reading cloth.');
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x % period;
      const v = y % period;
      const warp = Math.sin(TAU * u * 128 / period);
      const weft = Math.sin(TAU * v * 128 / period);
      const weave = (warp + weft) * 0.75 + warp * weft * 0.65;
      const grain = (noise(u, v) - 0.5) * 2.4;
      const variation = Math.sin(TAU * u / period) * Math.cos(TAU * v * 2 / period) * 0.65;
      const value = weave + grain + variation;
      const index = (y * size + x) * 4;
      image.data[index] = 103 + value;
      image.data[index + 1] = 100 + value;
      image.data[index + 2] = 85 + value;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 3.7);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function perimeter(inset, segmentsPerSide = 112) {
  const a = 1 - inset / HALF_WIDTH;
  const b = 1 - inset / HALF_LENGTH;
  const result = [];
  for (let side = 0; side < 4; side += 1) {
    for (let index = 0; index < segmentsPerSide; index += 1) {
      const t = index / segmentsPerSide;
      const u = side === 0 ? -a + 2 * a * t : side === 1 ? a : side === 2 ? a - 2 * a * t : -a;
      const v = side === 0 ? -b : side === 1 ? -b + 2 * b * t : side === 2 ? b : b - 2 * b * t;
      result.push(readingClothPoint(u, v));
    }
  }
  return result;
}

function hemGeometry() {
  const outside = perimeter(0.035);
  const inside = perimeter(0.14);
  const positions = [];
  const indices = [];
  for (let index = 0; index < outside.length; index += 1) {
    for (const point of [outside[index], inside[index]]) positions.push(point.x, point.y + 0.0007, point.z);
    const a = index * 2;
    const b = (index + 1) % outside.length * 2;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function edgeGeometry() {
  const edge = perimeter(0);
  const positions = [];
  const indices = [];
  for (let index = 0; index < edge.length; index += 1) {
    const point = edge[index];
    positions.push(point.x, point.y, point.z, point.x, point.y - 0.008, point.z);
    const a = index * 2;
    const b = (index + 1) % edge.length * 2;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Add directly to the scene; world placement is already baked into geometry. */
export function createReadingCloth(renderer) {
  const group = new THREE.Group();
  group.name = 'reading-cloth';
  const map = clothTexture(renderer);
  const material = new THREE.MeshStandardMaterial({
    map,
    color: 0xd3cbb8,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const cloth = new THREE.Mesh(createReadingClothGeometry(), material);
  cloth.name = 'plain-woven-cloth';
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  group.add(cloth);

  // A physical sewn margin, without decorative lines, symbols or motifs.
  const hem = new THREE.Mesh(hemGeometry(), new THREE.MeshStandardMaterial({
    color: 0x545346, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  }));
  hem.name = 'plain-folded-hem';
  hem.receiveShadow = true;
  group.add(hem);
  const edge = new THREE.Mesh(edgeGeometry(), new THREE.MeshStandardMaterial({
    color: 0x48483d, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  }));
  edge.name = 'cloth-edge-thickness';
  edge.castShadow = true;
  group.add(edge);
  group.userData.maxSurfaceHeight = CLOTH_MAX_HEIGHT;
  return group;
}
