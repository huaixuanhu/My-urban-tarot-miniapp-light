import * as THREE from 'three';
import { CLOTH_WIDTH, CLOTH_LENGTH, CLOTH_CENTER_Z } from './reading-layout.mjs';

const TOP = -0.008;
const DEPTH = 0.08;
const BEVEL = 0.04;
const BEVEL_WIDTH = 0.065;
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
  const rimPoints = roundedRectangle(CLOTH_WIDTH - .025, CLOTH_LENGTH - .025, RADIUS).getPoints(120);
  const rimGeometry = new THREE.BufferGeometry().setFromPoints(rimPoints.map(p => new THREE.Vector3(p.x, TOP - .015, -p.y + CLOTH_CENTER_Z)));
  const rimColors = [];
  for (const p of rimPoints) {
    const catchLight = .48 + .5 * Math.exp(-Math.pow((p.x + 4.8) / 3.2, 2) - Math.pow((p.y - 4.7) / 4, 2));
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

  // The room is visible through the actual volume. No opaque backing remains;
  // the bounded shadow receiver in the scene keeps cards grounded on this top.
  group.userData.maxSurfaceHeight = TOP;
  // Borrowers may share this environment; this group alone disposes it.
  group.userData.environmentTexture = environment.texture;
  group.userData.applyAppearance = theme => {
    const dark = theme === 'dark';
    surface.color.setHex(dark ? 0xe4e9f2 : 0xffffff);
    surface.attenuationColor.setHex(dark ? 0xcfdcee : 0xe4f2f1);
    surface.transmission = dark ? 0.97 : 0.91;
    surface.roughness = dark ? .085 : .105;
    surface.clearcoat = dark ? .25 : .52;
    surface.envMapIntensity = dark ? 0.12 : 0.42;
    surface.clearcoatRoughness = 0.1;
    edge.color.setHex(dark ? 0xc5cfdf : 0xe5f0f1);
    edge.attenuationColor.setHex(dark ? 0xbccbea : 0xa8d0d2);
    edge.attenuationDistance = dark ? 1.5 : .48;
    edge.envMapIntensity = dark ? 0.95 : 1.5;
    edge.clearcoat = dark ? .4 : .8;
    edge.roughness = 0.065;
    edge.transmission = dark ? .94 : .86;
    edge.iridescence = 0.035;
    rimMaterial.opacity = dark ? .72 : .95;
    lowerRim.material.color.setHex(dark ? 0xa4b7d3 : 0x50767c);
    lowerRim.material.opacity = dark ? .15 : .38;
  };
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    body.geometry.dispose(); rimGeometry.dispose(); rimMaterial.dispose(); lowerRim.geometry.dispose(); lowerRim.material.dispose();
    surface.dispose(); edge.dispose();
    environment.dispose();
  };
  return group;
}
