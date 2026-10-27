import * as THREE from 'three';
import { CLOTH_LENGTH, CLOTH_CENTER_Z } from './reading-layout.mjs';

/** Physical dimensions in the same X/Z plane as the table and cards. */
export const READING_DOCK = Object.freeze({
  x: 0, z: 4.45, width: 7.4, length: 1, radius: 0.5,
  bottom: 0.025, top: 0.22,
});

// The native controls occupy the flat part, just above the optical surface.
// This plane is projected with the same camera as the mesh, without billboarding.
export const READING_DOCK_LABEL_PLANE = Object.freeze({
  x: READING_DOCK.x, y: READING_DOCK.top + 0.003, z: READING_DOCK.z,
  width: 6.8, length: 0.74,
});

const BEVEL_WIDTH = 0.065;
const BEVEL_HEIGHT = 0.065;
const SHADOW_Y = -0.005;
const SHADOW_OFFSET_Z = 0.06;

function capsuleShape(width, length) {
  const r = length / 2, straight = width / 2 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-straight, -r);
  shape.lineTo(straight, -r);
  shape.absarc(straight, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-straight, r);
  shape.absarc(-straight, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

export function createReadingDockGeometry() {
  const { width, length, bottom, top } = READING_DOCK;
  const shape = capsuleShape(width - BEVEL_WIDTH * 2, length - BEVEL_WIDTH * 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: top - bottom - BEVEL_HEIGHT * 2, steps: 1, curveSegments: 24,
    bevelEnabled: true, bevelThickness: BEVEL_HEIGHT,
    bevelSize: BEVEL_WIDTH, bevelSegments: 8,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.translate(0, top - geometry.boundingBox.max.y, 0);
  geometry.computeBoundingBox();
  return geometry;
}

/** Soft contact shade; procedural bytes keep the material independent of DOM. */
function contactTexture() {
  const width = 256, height = 80, data = new Uint8Array(width * height * 4);
  const spanX = READING_DOCK.width + 0.8, spanZ = READING_DOCK.length + 0.8;
  const straight = (READING_DOCK.width - READING_DOCK.length) / 2;
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const x = (col / (width - 1) - 0.5) * spanX;
    const z = (row / (height - 1) - 0.5) * spanZ;
    const distance = Math.hypot(Math.max(0, Math.abs(x) - straight), z) - READING_DOCK.radius;
    const shade = 0.23 * Math.exp(-(Math.max(0, distance) ** 2) / 0.018)
      + 0.65 * Math.exp(-((distance - 0.015) ** 2) / 0.006);
    const offset = (row * width + col) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = 255;
    // Rotating the texture plane onto X/Z reverses its V/Z direction. The
    // contact shade ends with the actual table, rather than floating past it.
    const onTable = READING_DOCK.z + SHADOW_OFFSET_Z - z <= CLOTH_CENTER_Z + CLOTH_LENGTH / 2;
    data[offset + 3] = onTable ? Math.round(shade * 255) : 0;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function rimReflection() {
  const count = 256;
  const outer = capsuleShape(READING_DOCK.width - 0.132, READING_DOCK.length - 0.132).getSpacedPoints(count);
  const inner = capsuleShape(READING_DOCK.width - 0.166, READING_DOCK.length - 0.166).getSpacedPoints(count);
  const positions = [], colors = [], indices = [];
  for (let i = 0; i <= count; i++) for (const point of [outer[i], inner[i]]) {
    const x = point.x, z = -point.y;
    const warm = Math.exp(-(((x + 2.05) / 0.87) ** 2) - ((z - 0.4) / 0.19) ** 2);
    const cool = Math.exp(-(((x - 3.37) / 0.39) ** 2) - ((z - 0.1) / 0.5) ** 2);
    const alpha = 0.025 + 0.82 * warm + 0.58 * cool;
    positions.push(x, READING_DOCK.top + 0.0008, z);
    colors.push(1 - cool * 0.15, 0.94 - cool * 0.18, 0.86 + cool * 0.14, alpha);
    if (i < count && point === outer[i]) {
      const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
    opacity: 1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  return new THREE.Mesh(geometry, material);
}

function warmReflection() {
  const width = 128, height = 48, data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const x = col / (width - 1) * 2 - 1, z = row / (height - 1) * 2 - 1;
    const halo = Math.exp(-x * x * 5 - z * z * 6);
    const core = Math.exp(-x * x * 17 - z * z * 28);
    const i = (row * width + col) * 4;
    data[i] = 255; data[i + 1] = 231 + Math.round(core * 24); data[i + 2] = 202 + Math.round(core * 53);
    data[i + 3] = Math.round(Math.min(1, halo * 0.55 + core * 0.4) * 255);
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.24), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(-2.1, READING_DOCK.top + 0.001, 0.3);
  return { mesh, texture };
}

/** Shared environment ownership stays with the table, including disposal. */
export function createReadingDock({ environmentTexture = null } = {}) {
  const group = new THREE.Group();
  group.name = 'reading-physical-control-dock';
  group.position.set(READING_DOCK.x, 0, READING_DOCK.z);

  const surface = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.075, metalness: 0,
    transmission: 0.93, thickness: READING_DOCK.top - READING_DOCK.bottom, ior: 1.46,
    attenuationColor: 0xf8f3ff, attenuationDistance: 4.5,
    clearcoat: 1, clearcoatRoughness: 0.045,
    envMap: environmentTexture, envMapIntensity: 1.15,
  });
  const edge = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.045, metalness: 0,
    transmission: 0.91, thickness: 0.2, ior: 1.49,
    attenuationColor: 0xe2d8fa, attenuationDistance: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 0.2, iridescenceIOR: 1.3,
    iridescenceThicknessRange: [140, 310],
    envMap: environmentTexture, envMapIntensity: 1.35,
  });
  const body = new THREE.Mesh(createReadingDockGeometry(), [surface, edge]);
  body.name = 'solid-control-glass';
  body.receiveShadow = true;
  group.add(body);

  const shadowMap = contactTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x504954, map: shadowMap, transparent: true, opacity: 0.22,
    depthWrite: false, toneMapped: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(READING_DOCK.width + 0.8, READING_DOCK.length + 0.8), shadowMaterial);
  shadow.name = 'control-glass-contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.045, SHADOW_Y, SHADOW_OFFSET_Z);
  group.add(shadow);

  // Small reflected patches sit above the flat rim, not inside the bevel where
  // the physical glass would hide them. Their intensity fades around the rim;
  // there is no uniformly bright outline or moving flare.
  const rim = rimReflection();
  const reflection = warmReflection();
  rim.name = 'control-glass-local-rim-reflections';
  reflection.mesh.name = 'control-glass-warm-softbox-reflection';
  group.add(rim, reflection.mesh);

  function applyAppearance(theme) {
    const dark = theme === 'dark';
    surface.color.setHex(dark ? 0xe8edf5 : 0xffffff);
    surface.attenuationColor.setHex(dark ? 0xc6d2e4 : 0xf8f3ff);
    surface.transmission = dark ? 0.91 : 0.93;
    surface.envMapIntensity = dark ? 0.95 : 1.15;
    edge.color.setHex(dark ? 0xe0e8f5 : 0xffffff);
    edge.envMapIntensity = dark ? 1.2 : 1.35;
    edge.iridescence = dark ? 0.15 : 0.2;
    shadowMaterial.color.setHex(dark ? 0x020308 : 0x504954);
    shadowMaterial.opacity = dark ? 0.38 : 0.27;
    rim.material.opacity = dark ? 0.82 : 1;
    reflection.mesh.material.opacity = dark ? 0.46 : 0.7;
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(object => {
      object.geometry?.dispose();
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) material?.dispose();
    });
    shadowMap.dispose();
    reflection.texture.dispose();
  }
  applyAppearance('light');
  return { group, applyAppearance, dispose };
}

/** Exact projective map from a native CSS rectangle to a projected table plane. */
export function planarCssTransform(corners, widthPx, heightPx) {
  if (![widthPx, heightPx].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('CSS plane dimensions must be positive and finite.');
  const points = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].map(key => corners?.[key]);
  if (!points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) throw new TypeError('Four finite projected corners are required.');
  const scale = Math.max(...points.flatMap((p, i) => {
    const q = points[(i + 1) % 4]; return [Math.abs(p.x - q.x), Math.abs(p.y - q.y)];
  }));
  let winding = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) <= scale * scale * 1e-10) throw new RangeError('Projected control plane is degenerate.');
    if (winding && Math.sign(cross) !== winding) throw new RangeError('Projected control plane must be convex and ordered.');
    winding = Math.sign(cross);
  }
  const [a, b, c, d] = points;
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const matrix = [
    (b.x - a.x + g * b.x) / widthPx, (b.y - a.y + g * b.y) / widthPx, 0, g / widthPx,
    (d.x - a.x + h * d.x) / heightPx, (d.y - a.y + h * d.y) / heightPx, 0, h / heightPx,
    0, 0, 1, 0, a.x, a.y, 0, 1,
  ];
  if (!matrix.every(Number.isFinite)) throw new RangeError('Projected control plane cannot be mapped.');
  return `matrix3d(${matrix.map(n => Math.abs(n) < 1e-14 ? 0 : Number(n.toPrecision(15))).join(',')})`;
}
