import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createReadingRoomVisibility } from './reading-room-visibility.mjs';
import { excludeCottageFloorCards } from './reading-room-content.mjs';
import { createReadingProjection } from './reading-projection.mjs';
import { DEFAULT_VIEW } from './reading-view.mjs';
import { COTTAGE_METRES_PER_UNIT, cottageToReadingPosition } from './reading-room.mjs';

// Read real POSITION/index buffers and node transforms from the pinned GLBs.
// Texture decoding/GPU appearance stays in the browser review. Unlike a bounds
// fixture these tests exercise the exported shower/sofa/board triangles.
async function originalGeometry(theme = 'day') {
  const bytes = await readFile(new URL(`./assets/cottage-${theme}.glb`, import.meta.url));
  const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
  const body = bytes.subarray(28 + length);
  function attribute(index) {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC3: 3 }[a.type];
    const types = { 5123: [Uint16Array, 2, 'getUint16'], 5125: [Uint32Array, 4, 'getUint32'], 5126: [Float32Array, 4, 'getFloat32'] };
    const [ArrayType, width, read] = types[a.componentType];
    assert.ok(size && ArrayType && !a.sparse);
    const array = new ArrayType(a.count * size), view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const start = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || size * width;
    for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) array[i * size + c] = view[read](start + i * stride + c * width, true);
    return new THREE.BufferAttribute(array, size);
  }
  const materials = json.materials.map(source => new THREE.MeshBasicMaterial({
    side: source.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    transparent: source.alphaMode === 'BLEND', opacity: source.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1,
  }));
  const meshes = json.meshes.map(source => {
    assert.equal(source.primitives.length, 1);
    const p = source.primitives[0], geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', attribute(p.attributes.POSITION));
    if (p.indices !== undefined) geometry.setIndex(attribute(p.indices));
    return { geometry, material: materials[p.material] };
  });
  const nodes = json.nodes.map(source => {
    const resource = meshes[source.mesh];
    const node = resource ? new THREE.Mesh(resource.geometry, resource.material) : new THREE.Group();
    node.name = source.name || '';
    if (source.matrix) new THREE.Matrix4().fromArray(source.matrix).decompose(node.position, node.quaternion, node.scale);
    if (source.translation) node.position.fromArray(source.translation);
    if (source.rotation) node.quaternion.fromArray(source.rotation);
    if (source.scale) node.scale.fromArray(source.scale);
    return node;
  });
  json.nodes.forEach((node, index) => (node.children || []).forEach(child => nodes[index].add(nodes[child])));
  const root = new THREE.Group();
  json.scenes[json.scene || 0].nodes.forEach(index => root.add(nodes[index]));
  assert.deepEqual(excludeCottageFloorCards(root), { cards: 4, meshes: 8 });
  const physical = new THREE.Group();
  physical.scale.setScalar(1 / COTTAGE_METRES_PER_UNIT);
  physical.position.set(...cottageToReadingPosition(0, 0, 0));
  physical.add(root); physical.updateMatrixWorld(true);
  return { root, physical, nodes };
}

const wide = { width: 1792, height: 1388 };
function cameraAt(yaw, elevation, viewport = wide) {
  return createReadingProjection().update({ yaw: yaw * Math.PI / 180, elevation: elevation * Math.PI / 180, zoom: 1 }, viewport);
}
function isVisible(node) {
  for (let parent = node; parent; parent = parent.parent) if (!parent.visible) return false;
  return true;
}

test('real showerhead screenshot reproduction is cut away and the unchanged home view restores the shower', async () => {
  for (const theme of ['day', 'night']) {
    const { root, nodes } = await originalGeometry(theme);
    const showerHead = root.getObjectByName('cottage-mesh-0433');
    const camera = cameraAt(-23, 22), shower = new THREE.Vector3();
    showerHead.getWorldPosition(shower);
    const distance = camera.position.distanceTo(shower) * COTTAGE_METRES_PER_UNIT;
    assert.ok(distance > .35 && distance < .37, `Reproduction camera is ${distance}m from the source showerhead.`);
    const cameraBefore = camera.matrixWorld.toArray(), projectionBefore = camera.projectionMatrix.toArray();
    const controller = createReadingRoomVisibility(root);
    assert.equal(controller.update(camera), true);
    assert.ok(controller.hiddenGroups.includes('shower'));
    assert.equal(isVisible(showerHead), false);
    // All three pipe/head objects are hidden together; no floating fragments.
    for (const id of ['0431', '0432', '0433']) assert.equal(isVisible(root.getObjectByName(`cottage-mesh-${id}`)), false);
    assert.deepEqual(camera.matrixWorld.toArray(), cameraBefore);
    assert.deepEqual(camera.projectionMatrix.toArray(), projectionBefore);
    const revision = controller.revision;
    assert.equal(controller.update(camera), false);
    assert.equal(controller.revision, revision);
    controller.update(createReadingProjection().update(DEFAULT_VIEW, wide));
    assert.equal(isVisible(showerHead), true);
    assert.equal(nodes[518].visible, false, 'Home never restores the intentionally removed floor cards.');
    controller.dispose();
  }
});

test('representative full-orbit views retain room architecture, rugs, source geometry and rear furniture', async () => {
  const { root, nodes } = await originalGeometry();
  const before = new Map();
  root.traverse(node => before.set(node, {
    matrix: node.matrix.toArray(), geometry: node.geometry, material: node.material,
    parent: node.parent, children: [...node.children],
  }));
  const controller = createReadingRoomVisibility(root);
  const fixed = [root.getObjectByName('apartment-architecture'), nodes[315], nodes[565], nodes[591], nodes[629]];
  const visited = new Set();
  for (const viewport of [{ width: 760, height: 900 }, wide]) {
    for (const yaw of [-180, -135, -90, -45, -23, 0, 45, 90, 135, 179]) for (const elevation of [12, 22, 42, 90]) {
      const camera = cameraAt(yaw, elevation, viewport);
      controller.update(camera);
      controller.hiddenGroups.forEach(name => visited.add(name));
      for (const node of fixed) assert.ok(isVisible(node), `Fixed floor/architecture hidden at ${yaw}/${elevation}`);
      assert.ok(controller.hiddenGroups.length < 12, 'A view must not blank all furniture.');
    }
  }
  assert.ok(visited.has('shower'));
  assert.ok(visited.has('math-board'), 'Narrow-window orbit also protects against the actual large board.');
  controller.update(cameraAt(0, 42));
  assert.equal(isVisible(root.getObjectByName('cottage-mesh-0433')), true, 'Shower behind the camera/focal region stays visible.');
  controller.dispose();
  for (const [node, state] of before) assert.deepEqual({
    matrix: node.matrix.toArray(), geometry: node.geometry, material: node.material,
    parent: node.parent, children: [...node.children],
  }, state);
  assert.equal(nodes[518].visible, false);
});

test('stationary frames skip geometry queries and malformed source component boundaries reject explicitly', async () => {
  const { root } = await originalGeometry();
  const controller = createReadingRoomVisibility(root), camera = cameraAt(-23, 22);
  controller.update(camera);
  root.traverse(node => { if (node.isMesh) node.raycast = () => { throw new Error('Stationary frame unexpectedly raycast.'); }; });
  assert.equal(controller.update(camera), false);
  controller.dispose();
  assert.equal(controller.update(cameraAt(0, 42)), false);
  root.getObjectByName('home-furniture').children.pop();
  assert.throws(() => createReadingRoomVisibility(root), /hierarchy changed/);
  assert.throws(() => createReadingRoomVisibility(null), TypeError);
});
