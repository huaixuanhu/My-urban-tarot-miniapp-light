import * as THREE from 'three';
import { GLASS_WIDTH, GLASS_LENGTH, CLOTH_CENTER_Z } from './reading-layout.mjs';
import { createReadingRitual } from './reading-ritual.mjs';

const TOP = -0.008;
const DEPTH = 0.08;
const BEVEL = 0.04;
const BEVEL_WIDTH = 0.065;
export const GLASS_CORNER_K = 1.5;
const REFERENCE_CORNER_K = 1.5;
const RADIUS = 0.36 * 1.6;
const CORNER_SEGMENTS = 48;

// Match the 45-degree cut-in when comparing K1.5 and K1.8. These are four
// rounded corners with straight sides, not a superellipse of the entire slab.
export function glassCornerRadius(k = GLASS_CORNER_K) {
  // Match the extrusion's core first: its shared bevel adds the same diagonal
  // offset to both candidates, so the rendered boundary stays comparable.
  return BEVEL_WIDTH + (RADIUS - BEVEL_WIDTH) * (1 - 2 ** (-1 / 2 ** REFERENCE_CORNER_K)) / (1 - 2 ** (-1 / 2 ** k));
}

export function createGlassOutline(width, length, radius, k = GLASS_CORNER_K) {
  const x = width / 2, z = length / 2;
  const shape = new THREE.Shape();
  const power = 2 / 2 ** k;
  const corner = (transform, end) => {
    for (let i = 1; i <= CORNER_SEGMENTS; i++) {
      const theta = i / CORNER_SEGMENTS * Math.PI / 2;
      const a = i === CORNER_SEGMENTS ? 1 : Math.sin(theta) ** power;
      const b = i === CORNER_SEGMENTS ? 1 : 1 - Math.cos(theta) ** power;
      const [px, pz] = i === CORNER_SEGMENTS ? end : transform(a, b);
      shape.lineTo(px, pz);
    }
  };
  shape.moveTo(-x + radius, -z);
  shape.lineTo(x - radius, -z);
  corner((a, b) => [x - radius + radius * a, -z + radius * b], [x, -z + radius]);
  shape.lineTo(x, z - radius);
  corner((a, b) => [x - radius * b, z - radius + radius * a], [x - radius, z]);
  shape.lineTo(-x + radius, z);
  corner((a, b) => [-x + radius - radius * a, z - radius * b], [-x, z - radius]);
  shape.lineTo(-x, -z + radius);
  corner((a, b) => [-x + radius * b, -z + radius - radius * a], [-x + radius, -z]);
  shape.closePath();
  return shape;
}

/** Expanded physical margin; the bevel only rounds downward, below the cards. */
export function createReadingGlassGeometry({ cornerK = GLASS_CORNER_K } = {}) {
  const shape = createGlassOutline(GLASS_WIDTH - BEVEL_WIDTH * 2, GLASS_LENGTH - BEVEL_WIDTH * 2, glassCornerRadius(cornerK) - BEVEL_WIDTH, cornerK);
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

/** Intersect the actual bevel rings at the retained highlight height. An
 * offset superellipse is not another superellipse with a larger radius. */
export function createReadingGlassRimPoints(geometry, height = TOP - .015) {
  const positions = geometry.attributes.position;
  const levels = [...new Set(Array.from({ length: positions.count }, (_, i) => positions.getY(i)))].sort((a, b) => a - b);
  const low = levels.filter(y => y <= height).at(-1) ?? levels[0];
  const high = levels.find(y => y >= height) ?? levels.at(-1);
  const ring = y => {
    const points = new Map();
    for (let i = 0; i < positions.count; i++) if (positions.getY(i) === y) {
      const x = positions.getX(i), z = positions.getZ(i);
      points.set(`${x},${z}`, new THREE.Vector3(x, y, z));
    }
    return [...points.values()].sort((a, b) => Math.atan2(a.z - CLOTH_CENTER_Z, a.x) - Math.atan2(b.z - CLOTH_CENTER_Z, b.x));
  };
  const a = ring(low), b = ring(high);
  if (a.length !== b.length) throw new Error('Glass bevel rings must share a contour.');
  const t = high === low ? 0 : (height - low) / (high - low);
  return a.map((point, i) => point.lerp(b[i], t));
}

// A quiet studio light field, used only in the glass materials. These softboxes
// are never added to the reading scene, and introduce no visible room props.
function createGlassEnvironment(renderer) {
  const environment = new THREE.Scene();
  environment.background = new THREE.Color(0x080b13);
  const resources = [];
  function softbox(width, height, color, position, windowShape = false) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Glass light canvas unavailable.');
    ctx.scale(2, 1);
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 128, 128);
    if (windowShape) {
      // The key reflection follows a broad window, rather than a round lamp.
      ctx.filter = 'blur(7px)'; ctx.fillStyle = '#ffffff';
      ctx.fillRect(10, 12, 108, 104); ctx.filter = 'none';
    } else {
      const glow = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
      glow.addColorStop(0, '#ffffff'); glow.addColorStop(0.52, '#c9c9c9'); glow.addColorStop(1, '#000000');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ color, map, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    environment.add(panel);
    resources.push(geometry, material, map);
  }
  softbox(10, 5, new THREE.Color(6.2, 5.8, 5.3), [-5, 10, -6], true);
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

/** One solid glass table, with a flat, legible center and rounded optical edge. */
export function createReadingGlass(renderer, { cornerK = GLASS_CORNER_K } = {}) {
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
  const body = new THREE.Mesh(createReadingGlassGeometry({ cornerK }), [surface, edge]);
  body.name = 'solid-fluid-glass-surface';
  body.receiveShadow = true;
  group.add(body);
  const rimPoints = createReadingGlassRimPoints(body.geometry);
  const rimGeometry = new THREE.BufferGeometry().setFromPoints(rimPoints);
  const rimColors = [];
  for (const p of rimPoints) {
    const catchLight = .64 + .35 * Math.exp(-Math.pow((p.x + 4.8) / 3.2, 2) - Math.pow((-p.z + CLOTH_CENTER_Z - 4.7) / 4, 2));
    rimColors.push(catchLight * .94, catchLight * .97, catchLight);
  }
  rimGeometry.setAttribute('color', new THREE.Float32BufferAttribute(rimColors, 3));
  const rimMaterial = new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:.72, toneMapped:false});
  const rimLine = new THREE.LineLoop(rimGeometry, rimMaterial); rimLine.name = 'directional-glass-edge'; group.add(rimLine);
  // A faint lower boundary gives the clear slab a readable thickness on a
  // bright floor. Its offset is real geometry, so it separates at low angles.
  const lowerRim = new THREE.LineLoop(rimGeometry.clone(), new THREE.LineBasicMaterial({
    color: 0x50767c, transparent: true, opacity: .3, toneMapped: false,
  }));
  lowerRim.name = 'glass-lower-boundary'; lowerRim.position.y = -(DEPTH + BEVEL * 2 - .03); group.add(lowerRim);
  const ritual = createReadingRitual(renderer); group.add(ritual.mesh);

  // The room is visible through the actual volume. No opaque backing remains;
  // the bounded shadow receiver in the scene keeps cards grounded on this top.
  group.userData.maxSurfaceHeight = TOP;
  // Borrowers may share this environment; this group alone disposes it.
  group.userData.environmentTexture = environment.texture;
  group.userData.applyAppearance = theme => {
    const dark = theme === 'dark';
    ritual.applyAppearance(theme);
    // Cool transmitted light separates the slab from the warm cottage floor;
    // the clear center retains the room, while its bevel carries the contrast.
    surface.color.setHex(dark ? 0xdce6f3 : 0xe2edf6);
    surface.attenuationColor.setHex(dark ? 0xc3d7ed : 0xd0e6f2);
    surface.transmission = dark ? .98 : .96;
    // The night table catches broad lamplight instead of pin-sharp bulb glints.
    // The edge stays polished, so softening the face does not erase its volume.
    surface.roughness = dark ? .20 : .06;
    surface.clearcoat = dark ? .35 : .65;
    surface.envMapIntensity = dark ? .14 : .48;
    surface.clearcoatRoughness = dark ? .25 : .075;
    edge.color.setHex(dark ? 0xc3d7ed : 0xa2bdcd);
    edge.attenuationColor.setHex(dark ? 0x8caacd : 0x7b9cba);
    edge.attenuationDistance = dark ? .8 : .38;
    edge.envMapIntensity = dark ? 1.25 : 1.85;
    edge.clearcoat = dark ? .7 : 1;
    edge.roughness = .045;
    edge.transmission = dark ? .88 : .78;
    edge.iridescence = 0.035;
    rimMaterial.opacity = dark ? .9 : 1;
    lowerRim.material.color.setHex(dark ? 0xadc6e7 : 0x294c6c);
    lowerRim.material.opacity = dark ? .32 : .68;
  };
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    body.geometry.dispose(); rimGeometry.dispose(); rimMaterial.dispose(); lowerRim.geometry.dispose(); lowerRim.material.dispose();
    surface.dispose(); edge.dispose();
    ritual.dispose();
    environment.dispose();
  };
  return group;
}
