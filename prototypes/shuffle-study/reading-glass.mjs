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
  environment.background = new THREE.Color(0x6c6c76);
  const resources = [];
  function softbox(width, height, color, position) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    environment.add(panel);
    resources.push(geometry, material);
  }
  softbox(12, 8, new THREE.Color(5.5, 5.4, 5.8), [-7, 10, 4]);
  softbox(4, 15, new THREE.Color(1.8, 2.0, 2.6), [10, 5, -6]);
  softbox(16, 5, new THREE.Color(1.2, 1.05, 1.3), [-2, 6, -12]);
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

  // A quiet backing below the volume keeps the playing surface grounded even
  // when the renderer's surrounding canvas is transparent. It is seen through
  // actual transmission, while the bevel and broad reflections supply depth.
  const backingGeometry = new THREE.ShapeGeometry(roundedRectangle(CLOTH_WIDTH - 0.08, CLOTH_LENGTH - 0.08, RADIUS), 16);
  backingGeometry.rotateX(-Math.PI / 2);
  backingGeometry.translate(0, TOP - DEPTH - BEVEL * 2 - 0.002, CLOTH_CENTER_Z);
  const backingMaterial = new THREE.MeshBasicMaterial({ color: 0xe4e2e9, toneMapped: false });
  const backing = new THREE.Mesh(backingGeometry, backingMaterial);
  backing.name = 'glass-neutral-backing';
  backing.castShadow = true;
  group.add(backing);

  group.userData.maxSurfaceHeight = TOP;
  group.userData.applyAppearance = theme => {
    const dark = theme === 'dark';
    surface.color.setHex(dark ? 0x424a5b : 0xe9e7f1);
    surface.attenuationColor.setHex(dark ? 0x5c657b : 0xe4e0fa);
    surface.transmission = dark ? 0.86 : 0.82;
    surface.roughness = dark ? 0.25 : 0.2;
    surface.clearcoat = dark ? 0.5 : 0.8;
    surface.envMapIntensity = dark ? 0.15 : 0.35;
    edge.color.setHex(dark ? 0xabb2c6 : 0xefedf9);
    edge.attenuationColor.setHex(dark ? 0x7c869f : 0xcfc8e7);
    edge.envMapIntensity = dark ? 0.48 : 0.35;
    edge.clearcoat = dark ? 0.65 : 0.5;
    backingMaterial.color.setHex(dark ? 0x1d222c : 0xe4e2e9);
  };
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    body.geometry.dispose(); backingGeometry.dispose();
    surface.dispose(); edge.dispose(); backingMaterial.dispose();
    environment.dispose();
  };
  return group;
}
