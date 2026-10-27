// Explicit adaptation of the pinned cottage export. The original source and
// GLBs stay intact; hiding this one subtree retains resource ownership for the
// room's existing disposal path. Call on an imported, unscaled cottage root.
const FLOOR_CARD_ANCHOR = Object.freeze([1.6, .055, .48]);
const EPSILON = 1e-7;

function isFloorCardGroup(node) {
  const position = node.position;
  if (!position || ![position.x, position.y, position.z].every((value, index) =>
    Number.isFinite(value) && Math.abs(value - FLOOR_CARD_ANCHOR[index]) <= EPSILON)) return false;
  return !node.isMesh && node.children.length === 4 && node.children.every(card =>
    !card.isMesh && card.children.length === 2 && card.children.every(mesh =>
      mesh.isMesh && mesh.children.length === 0));
}

/** Exclude only the four decorative cards authored by Furniture.tsx's Tarot.
 * Interactive cards never enter this imported root. Validate the whole match
 * before mutating so a changed/ambiguous asset cannot hide unrelated objects.
 */
export function excludeCottageFloorCards(root) {
  if (!root?.isObject3D || typeof root.traverse !== 'function') {
    throw new TypeError('An imported cottage scene root is required.');
  }
  const matches = [];
  root.traverse(node => { if (isFloorCardGroup(node)) matches.push(node); });
  if (matches.length !== 1) {
    throw new Error(`Expected one original cottage floor-card group; found ${matches.length}.`);
  }
  matches[0].visible = false;
  return Object.freeze({ cards: 4, meshes: 8 });
}
