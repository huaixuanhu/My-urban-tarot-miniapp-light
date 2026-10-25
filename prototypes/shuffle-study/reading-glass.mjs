import * as THREE from 'three';
import { CLOTH_WIDTH, CLOTH_LENGTH, CLOTH_CENTER_Z } from './reading-layout.mjs';

const TOP = -0.008;
const DEPTH = 0.062;
const BEVEL = 0.03;
const BEVEL_WIDTH = 0.038;
const RADIUS = 0.36;

function roundedRectangle(width, length, radius) {
  const x = width / 2, z = length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -z);
  shape.lineTo(x - radius, -z);
  shape.quadraticCurveTo(x, -z, x, -z + radius);
  shape.lineTo(x, z - radius);
  shape.quadraticCurveTo(x, z, x - radius, z);
  shape.lineTo(-x + radius, z);
  shape.quadraticCurveTo(-x, z, -x, z - radius);
  shape.lineTo(-x, -z + radius);
  shape.quadraticCurveTo(-x, -z, -x + radius, -z);
  shape.closePath();
  return shape;
}

/** Shared accepted footprint; the bevel only rounds downward, below the cards. */
export function createReadingGlassGeometry() {
  const shape = roundedRectangle(CLOTH_WIDTH - BEVEL_WIDTH * 2, CLOTH_LENGTH - BEVEL_WIDTH * 2, RADIUS - BEVEL_WIDTH);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH, steps: 1, curveSegments: 16,
    bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL_WIDTH, bevelSegments: 6,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.translate(0, TOP - geometry.boundingBox.max.y, CLOTH_CENTER_Z);
  geometry.computeBoundingBox();
  return geometry;
}

// A quiet studio light field, used only in the glass materials. These softboxes
// are never added to the reading scene, and introduce no visible room props.
function createGlassEnvironment(renderer) {
  const environment = new THREE.Scene();
  environment.background = new THREE.Color(0x080b13);
  const resources = [];
  function softbox(width, height, color, position) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Glass light canvas unavailable.');
    ctx.scale(2, 1);
    const glow = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    glow.addColorStop(0, '#ffffff'); glow.addColorStop(0.52, '#c9c9c9'); glow.addColorStop(1, '#000000');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ color, map, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    environment.add(panel);
    resources.push(geometry, material, map);
  }
  softbox(10, 5, new THREE.Color(6.2, 5.8, 5.3), [-5, 10, -6]);
  softbox(2.2, 11, new THREE.Color(0.8, 1.1, 1.8), [10, 5, -6]);
  softbox(8, 2, new THREE.Color(0.45, 0.4, 0.6), [-2, 6, -12]);
  softbox(22, 22, new THREE.Color(0.055, 0.06, 0.08), [0, -8, 0]);
  const generator = new THREE.PMREMGenerator(renderer);
  try {
    return generator.fromScene(environment, 0.1, 0.1, 100);
  } finally {
    for (const resource of resources) resource.dispose();
    generator.dispose();
  }
}

/** Static soft illumination under the volume; real lights and card shadows
 * still act on this backing. The subtle field prevents a uniformly flat slab. */
function createBackingLightField(theme) {
  const dark = theme === 'dark';
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Glass backing canvas unavailable.');
  const base = ctx.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, dark ? '#34333b' : '#d4cfc8');
  base.addColorStop(0.48, dark ? '#242b36' : '#bcbfc9');
  base.addColorStop(1, dark ? '#303b4d' : '#c6cbd9');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
  function pool(x, y, rx, ry, color, opacity) {
    ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry);
    const gradient = ctx.createRadialGradient(0, 0, 0.08, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${color},${opacity})`);
    gradient.addColorStop(0.45, `rgba(${color},${opacity * 0.48})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = gradient; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  }
  pool(95, 125, 320, 210, dark ? '136,118,89' : '255,247,225', dark ? 0.25 : 0.4);
  pool(440, 390, 220, 340, dark ? '87,111,160' : '213,226,255', dark ? 0.32 : 0.28);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.repeat.set(1 / CLOTH_WIDTH, 1 / CLOTH_LENGTH); map.offset.set(0.5, 0.5);
  return map;
}

/** One solid glass table, with a flat, legible center and rounded optical edge. */
export function createReadingGlass(renderer) {
  const group = new THREE.Group();
  group.name = 'reading-glass';
  const environment = createGlassEnvironment(renderer);
  const surface = new THREE.MeshPhysicalMaterial({
    color: 0xf6f4ff, roughness: 0.19, metalness: 0,
    transmission: 0.78, thickness: DEPTH + BEVEL * 2, ior: 1.46,
    attenuationColor: 0xe4e0fa, attenuationDistance: 3.2,
    clearcoat: 1, clearcoatRoughness: 0.13,
    envMap: environment.texture, envMapIntensity: 0.6,
  });
  const edge = new THREE.MeshPhysicalMaterial({
    color: 0xefedf9, roughness: 0.1, metalness: 0,
    transmission: 0.86, thickness: DEPTH + BEVEL * 2, ior: 1.48,
    attenuationColor: 0xcfc8e7, attenuationDistance: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.08,
    iridescence: 0.12, iridescenceIOR: 1.3,
    envMap: environment.texture, envMapIntensity: 0.85,
  });
  const body = new THREE.Mesh(createReadingGlassGeometry(), [surface, edge]);
  body.name = 'solid-fluid-glass-surface';
  body.receiveShadow = true;
  group.add(body);

  // A quiet backing below the volume keeps the playing surface grounded even
  // when the renderer's surrounding canvas is transparent. It is seen through
  // actual transmission, while the bevel and broad reflections supply depth.
  const backingGeometry = new THREE.ShapeGeometry(roundedRectangle(CLOTH_WIDTH - 0.08, CLOTH_LENGTH - 0.08, RADIUS), 16);
  backingGeometry.rotateX(-Math.PI / 2);
  backingGeometry.translate(0, TOP - DEPTH - BEVEL * 2 - 0.002, CLOTH_CENTER_Z);
  const backingMaps = { light: createBackingLightField('light'), dark: createBackingLightField('dark') };
  const backingMaterial = new THREE.MeshStandardMaterial({ map: backingMaps.light, color: 0xffffff, roughness: 0.94, metalness: 0 });
  const backing = new THREE.Mesh(backingGeometry, backingMaterial);
  backing.name = 'glass-neutral-backing';
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);

  group.userData.maxSurfaceHeight = TOP;
  // Borrowers may share this environment; this group alone disposes it.
  group.userData.environmentTexture = environment.texture;
  group.userData.applyAppearance = theme => {
    const dark = theme === 'dark';
    surface.color.setHex(dark ? 0x424b5b : 0xf2eff8);
    surface.attenuationColor.setHex(dark ? 0x5c657b : 0xe4e0fa);
    surface.transmission = dark ? 0.84 : 0.8;
    surface.roughness = dark ? 0.19 : 0.15;
    surface.clearcoat = dark ? 0.72 : 0.85;
    surface.envMapIntensity = dark ? 0.6 : 0.68;
    surface.clearcoatRoughness = dark ? 0.22 : 0.18;
    edge.color.setHex(dark ? 0x6e7789 : 0xd5d1db);
    edge.attenuationColor.setHex(dark ? 0x7c869f : 0xcfc8e7);
    edge.envMapIntensity = dark ? 0.38 : 0.28;
    edge.clearcoat = 0.4;
    edge.roughness = 0.15;
    edge.iridescence = 0.035;
    backingMaterial.map = backingMaps[dark ? 'dark' : 'light'];
  };
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    body.geometry.dispose(); backingGeometry.dispose();
    surface.dispose(); edge.dispose(); backingMaterial.dispose();
    backingMaps.light.dispose(); backingMaps.dark.dispose();
    environment.dispose();
  };
  return group;
}
