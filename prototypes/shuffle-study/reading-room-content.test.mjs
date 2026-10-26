import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { excludeCottageFloorCards } from './reading-room-content.mjs';

// Decode the actual exported node hierarchy and mesh metadata without browser
// image decoding. These tests establish selection/ownership integrity, not GPU
// appearance; the parent trial's browser verification covers the latter.
async function importedHierarchy(theme) {
  const bytes = await readFile(new URL(`./assets/cottage-${theme}.glb`, import.meta.url));
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const nodes = json.nodes.map((source, index) => {
    const node = source.mesh === undefined ? new THREE.Group() : new THREE.Mesh(new THREE.BufferGeometry(), null);
    node.name = source.name || '';
    node.userData = { sourceNode: index, sourceMesh: source.mesh, meshMetadata: json.meshes[source.mesh] };
    if (source.matrix) new THREE.Matrix4().fromArray(source.matrix).decompose(node.position, node.quaternion, node.scale);
    if (source.translation) node.position.fromArray(source.translation);
    if (source.rotation) node.quaternion.fromArray(source.rotation);
    if (source.scale) node.scale.fromArray(source.scale);
    return node;
  });
  json.nodes.forEach((source, index) => (source.children || []).forEach(child => nodes[index].add(nodes[child])));
  const root = new THREE.Group();
  json.scenes[json.scene || 0].nodes.forEach(index => root.add(nodes[index]));
  root.updateMatrixWorld(true);
  return { root, nodes, floorCards: nodes[518] };
}

function snapshot(root) {
  const values = new Map();
  root.updateMatrixWorld(true);
  root.traverse(node => values.set(node, {
    parent: node.parent, children: [...node.children], visible: node.visible,
    matrix: node.matrix.toArray(), world: node.matrixWorld.toArray(),
    geometry: node.geometry, material: node.material, data: node.userData,
  }));
  return values;
}

test('both real cottage exports exclude exactly four floor cards while preserving every other object and transform', async () => {
  for (const theme of ['day', 'night']) {
    const { root, floorCards } = await importedHierarchy(theme);
    const before = snapshot(root);
    assert.equal([...before.keys()].filter(node => node.isMesh).length, 645);
    assert.deepEqual(excludeCottageFloorCards(root), { cards: 4, meshes: 8 });
    const after = snapshot(root);
    for (const [node, state] of before) {
      assert.deepEqual(after.get(node), node === floorCards ? { ...state, visible: false } : state);
    }
    let visibleMeshes = 0;
    root.traverseVisible(node => { if (node.isMesh) visibleMeshes++; });
    assert.equal(visibleMeshes, 637);
    assert.equal(floorCards.parent, before.get(floorCards).parent, 'Hidden assets remain owned by the imported root.');
    assert.deepEqual(excludeCottageFloorCards(root), { cards: 4, meshes: 8 }, 'Applying the same bounded exclusion is idempotent.');
    assert.deepEqual(snapshot(root), after);
  }
});

test('missing, structurally changed and ambiguous decor reject before changing visibility', async () => {
  const { root, floorCards } = await importedHierarchy('day');
  root.removeFromParent();
  floorCards.parent.remove(floorCards);
  let before = snapshot(root);
  assert.throws(() => excludeCottageFloorCards(root), /found 0/);
  assert.deepEqual(snapshot(root), before);
  root.add(floorCards);
  const card = floorCards.children[0], face = card.children[1];
  card.remove(face);
  before = snapshot(root);
  assert.throws(() => excludeCottageFloorCards(root), /found 0/);
  assert.deepEqual(snapshot(root), before);
  card.add(face);
  root.add(floorCards.clone(true));
  before = snapshot(root);
  assert.throws(() => excludeCottageFloorCards(root), /found 2/);
  assert.deepEqual(snapshot(root), before);
  assert.throws(() => excludeCottageFloorCards(null), TypeError);
});
