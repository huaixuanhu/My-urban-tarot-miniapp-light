import * as THREE from 'three';
import { CLOTH_WIDTH, CLOTH_LENGTH, CLOTH_CENTER_Z } from './reading-layout.mjs';

// Local cutaway of the pinned cottage export, not a camera constraint or a
// physically shared depth buffer. A room object cannot remain a giant foreground
// obstruction in the room-only background pass while cards render over it.
// Component boundaries below correspond to Furniture.tsx in cottage-export/.
function cottageCohorts(root) {
  const furniture = root.getObjectByName('home-furniture');
  if (!furniture || furniture.children.length !== 9) throw new Error('The cottage furniture hierarchy changed.');
  const [desk, taskBoard, sofa, mathBoard, coffee, , bedroom, bathroom, entry] = furniture.children;
  if (coffee.children.length !== 43 || bedroom.children.length !== 23 || bathroom.children.length !== 20 || entry.children.length !== 10) {
    throw new Error('The cottage cutaway component boundaries changed.');
  }
  const chairs = furniture.parent.children.find(node => node !== furniture && node.name !== 'apartment-architecture');
  if (!chairs || chairs.children.length !== 2) throw new Error('The cottage chair hierarchy changed.');
  const table = coffee.children[41];
  if (table.children.length !== 7 || table.children[6].children.length !== 4) throw new Error('The cottage flower-vase hierarchy changed.');
  return [
    ['work-desk', [desk]], ['task-board', [taskBoard]], ['sofa', [sofa]], ['math-board', [mathBoard]],
    // Keep the rug, coffee table, books and cup when only its flowers interfere.
    ['coffee-flowers', [table.children[6]]], ['cat-side-table', [coffee.children[42]]],
    ['bedroom-furniture', bedroom.children.slice(0, 22)],
    ['shower', bathroom.children.slice(0, 10)], ['toilet', [bathroom.children[10]]],
    ['washbasin', bathroom.children.slice(11, 19)],
    ['entry-cabinet', entry.children.slice(0, 6)], ['bookshelf', [entry.children[7]]],
    ['side-plant', [entry.children[8]]], ['window-plant', [entry.children[9]]],
    ...chairs.children.map((chair, index) => [`desk-chair-${index + 1}`, [chair]]),
  ];
}

/** Construct after the imported root's final uniform transform is installed.
 * Geometry/materials remain untouched, and floor/rugs/architecture never enter
 * a cutaway cohort. Hidden meshes are still checked so they can return on orbit.
 * The 15-ray grid (plus its expanded copy while restoring) is bounded sampling,
 * not a proof for every possible sightline.
 */
export function createReadingRoomVisibility(root, { metresPerUnit = .14 } = {}) {
  if (!root?.isObject3D || !Number.isFinite(metresPerUnit) || metresPerUnit <= 0) {
    throw new TypeError('A transformed cottage root and positive unit scale are required.');
  }
  root.updateWorldMatrix(true, true);
  const cohorts = cottageCohorts(root).map(([name, nodes]) => {
    const meshes = [];
    for (const node of nodes) node.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      // An above-table camera-to-table segment cannot hit lower furniture.
      if (bounds.max.y > .015) meshes.push({ mesh, bounds });
    });
    return { name, nodes, originals: nodes.map(node => node.visible), meshes, hidden: false };
  });
  const raycaster = new THREE.Raycaster(), candidate = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3(), forward = new THREE.Vector3(), direction = new THREE.Vector3();
  const hits = [], targets = [];
  for (const x of [-1, -.5, 0, .5, 1]) for (const z of [-1, 0, 1]) targets.push(new THREE.Vector3(
    x * CLOTH_WIDTH / 2, .025, CLOTH_CENTER_Z + z * CLOTH_LENGTH / 2));
  let lastKey = null, revision = 0, disposed = false;

  function obstructs(cohort) {
    // Spatial hysteresis: restoring requires clearing a slightly wider corridor
    // and camera bubble. No timer, continued animation, or material fade is used.
    const margin = cohort.hidden ? .08 / metresPerUnit : 0;
    const clearance = (cohort.hidden ? .26 : .20) / metresPerUnit;
    for (const { mesh, bounds } of cohort.meshes) {
      bounds.clampPoint(cameraPosition, candidate);
      direction.copy(candidate).sub(cameraPosition);
      if (direction.length() < clearance && direction.dot(forward) >= -.04 / metresPerUnit) return true;
      for (const expansion of margin ? [0, margin] : [0]) for (const point of targets) {
        candidate.copy(point);
        candidate.x += Math.sign(point.x) * expansion;
        candidate.z += Math.sign(point.z - CLOTH_CENTER_Z) * expansion;
        direction.copy(candidate).sub(cameraPosition);
        const distance = direction.length();
        raycaster.set(cameraPosition, direction.multiplyScalar(1 / distance));
        raycaster.near = 0; raycaster.far = distance - .02;
        const boxHit = raycaster.ray.intersectBox(bounds, candidate);
        if (!boxHit || boxHit.distanceTo(cameraPosition) > raycaster.far) continue;
        hits.length = 0;
        // Raycast real triangles rather than trusting a large rotated AABB:
        // otherwise a small plant or angled board can blank a whole room sector.
        raycaster.intersectObject(mesh, false, hits);
        if (hits.length) return true;
      }
    }
    return false;
  }

  function update(camera) {
    if (disposed) return false;
    if (!camera?.isCamera) throw new TypeError('An active reading camera is required.');
    camera.updateMatrixWorld();
    const key = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].join(',');
    if (key === lastKey) return false;
    camera.getWorldPosition(cameraPosition); camera.getWorldDirection(forward);
    let changed = false;
    for (const cohort of cohorts) {
      const hidden = obstructs(cohort);
      if (hidden === cohort.hidden) continue;
      cohort.hidden = hidden; changed = true;
      cohort.nodes.forEach((node, index) => { node.visible = hidden ? false : cohort.originals[index]; });
    }
    if (changed) revision++;
    lastKey = key;
    return changed;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const cohort of cohorts) cohort.nodes.forEach((node, index) => { node.visible = cohort.originals[index]; });
  }
  return { update, dispose, get revision() { return revision; },
    get hiddenGroups() { return cohorts.filter(cohort => cohort.hidden).map(cohort => cohort.name); } };
}
