import test from 'node:test';
import assert from 'node:assert/strict';
import { CanvasTexture, Euler, Matrix4, Vector3 } from 'three';
import { CARD_COUNT, CARD_WIDTH, CARD_LENGTH, CARD_THICKNESS } from './motion.mjs';
import { createCardGeometry } from './card-geometry.mjs';
import { createReading, reduceReading } from './reading-state.mjs';
import { readingTablePose, sampleSideRevealPose, REVEAL_DURATION_MS } from './reading-reveal.mjs';

const card = { id: 12, x: -1.7, z: -2.1, faceUp: true };
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const rotation = pose => new Matrix4().makeRotationFromEuler(new Euler(pose.rx, pose.ry, pose.rz, 'XYZ'));
const vectorNear = (actual, expected) => ['x', 'y', 'z'].forEach(axis => near(actual[axis], expected[axis]));
const matrixNear = (actual, expected) => actual.elements.forEach((value, index) => near(value, expected.elements[index]));
const geometry = createCardGeometry();
const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
const front = geometry.groups.find(group => group.materialIndex === 1);
const frontIndices = [...new Set(Array.from(geometry.index.array.slice(front.start, front.start + front.count)))];
function pointAtUV(u, v) {
  const index = frontIndices.reduce((closest, current) => {
    const distance = index => (uv.getX(index) - u) ** 2 + (uv.getY(index) - v) ** 2;
    return distance(current) < distance(closest) ? current : closest;
  });
  return new Vector3().fromBufferAttribute(position, index);
}
// CanvasTexture flips Y: the printed canvas top corresponds to the high-V
// edge. Read the actual underside UVs so a future UV change cannot silently
// invert the meaning of upright/reversed while these tests keep passing.
const printCenter = pointAtUV(0.5, 0.5);
const printTop = pointAtUV(0.5, 1).sub(printCenter).normalize();
const printRight = pointAtUV(1, 0.5).sub(printCenter).normalize();
const paperCorners = [];
for (const x of [-CARD_WIDTH / 2, CARD_WIDTH / 2]) for (const y of [0, CARD_THICKNESS]) for (const z of [-CARD_LENGTH / 2, CARD_LENGTH / 2]) paperCorners.push(new Vector3(x, y, z));

test('both side-turn directions keep actual underside printing upright or reversed as assigned', () => {
  const texture = new CanvasTexture({ width: 1, height: 1 });
  assert.equal(texture.flipY, true); texture.dispose();
  vectorNear(printTop, new Vector3(0, 0, -1));
  vectorNear(printRight, new Vector3(-1, 0, 0));
  for (const reversed of [false, true]) for (const direction of [-1, 1]) {
    const pose = sampleSideRevealPose(readingTablePose(card, reversed), 1, direction), matrix = rotation(pose);
    vectorNear(printTop.clone().transformDirection(matrix), new Vector3(0, 0, reversed ? 1 : -1));
    vectorNear(printRight.clone().transformDirection(matrix), new Vector3(reversed ? -1 : 1, 0, 0));
    vectorNear(new Vector3(0, -1, 0).transformDirection(matrix), new Vector3(0, 1, 0));
  }
});

test('start and end matrices match stable poses and preserve the previously accepted final print orientation', () => {
  assert.equal(REVEAL_DURATION_MS, 620);
  for (const reversed of [false, true]) for (const direction of [-1, 1]) for (const layer of [0, 2, 77]) {
    const face = readingTablePose(card, reversed, layer), before = structuredClone(face);
    const hidden = readingTablePose({ ...card, faceUp: false }, reversed, layer);
    const start = sampleSideRevealPose(face, 0, direction), end = sampleSideRevealPose(face, 1, direction);
    matrixNear(rotation(start), rotation(hidden)); near(start.y, hidden.y);
    matrixNear(rotation(end), rotation(face)); near(end.y, face.y);
    matrixNear(rotation(end), rotation({ rx: Math.PI, ry: reversed ? 0 : Math.PI, rz: 0 }));
    assert.deepEqual(face, before);
    for (const pose of [start, end]) { near(pose.x, card.x); near(pose.z, card.z); }
  }
});

test('left and right paths are opposite world-side rolls, independent of reversal', () => {
  for (const progress of [0.07, 0.23, 0.5, 0.71, 0.94]) {
    let uprightNormal;
    for (const reversed of [false, true]) {
      const face = readingTablePose(card, reversed);
      const left = sampleSideRevealPose(face, progress, -1), right = sampleSideRevealPose(face, progress, 1);
      const leftNormal = new Vector3(0, 1, 0).transformDirection(rotation(left));
      const rightNormal = new Vector3(0, 1, 0).transformDirection(rotation(right));
      assert.ok(leftNormal.x > 0); assert.ok(rightNormal.x < 0);
      near(leftNormal.x, -rightNormal.x); near(leftNormal.y, rightNormal.y); near(leftNormal.z, 0); near(rightNormal.z, 0);
      if (!reversed) uprightNormal = rightNormal;
      else vectorNear(rightNormal, uprightNormal);
      for (const pose of [left, right]) {
        near(pose.x, card.x); near(pose.z, card.z);
        // The long edge stays horizontal throughout; this is not an end-over-end flip.
        near(new Vector3(0, 0, 1).transformDirection(rotation(pose)).y, 0);
      }
    }
  }
});

test('the full paper thickness clears its resting layer during either roll and rewinds deterministically', () => {
  for (const reversed of [false, true]) for (const direction of [-1, 1]) for (const layer of [0, 3]) {
    const face = readingTablePose(card, reversed, layer), restFloor = 0.05 + layer * 0.012;
    const samples = [];
    for (let index = 0; index <= 200; index += 1) {
      const pose = sampleSideRevealPose(face, index / 200, direction), matrix = rotation(pose);
      for (const corner of paperCorners) assert.ok(corner.clone().applyMatrix4(matrix).y + pose.y >= restFloor - 1e-8, `Below layer at progress ${index / 200}, reversed ${reversed}, direction ${direction}`);
      samples.push(pose);
    }
    for (let index = 200; index >= 0; index -= 1) assert.deepEqual(sampleSideRevealPose(face, index / 200, direction), samples[index]);
  }
});

test('sampling, skipping and repeated reveal preserve physical identity and assigned reversal', () => {
  for (const reversed of [false, true]) for (const direction of [-1, 1]) {
    const order = Array.from({ length: CARD_COUNT }, (_, id) => (id * 17 + 23) % CARD_COUNT);
    const orientations = Array(CARD_COUNT).fill(false); orientations[card.id] = reversed;
    let reading = createReading({ order, reversed: orientations });
    reading = reduceReading(reading, { type: 'draw', id: card.id, x: card.x, z: card.z });
    reading = reduceReading(reading, { type: 'reveal', id: card.id });
    const unchanged = structuredClone(reading), face = readingTablePose(reading.placed[card.id], reading.reversed[card.id]);
    for (const progress of [0, 0.37, 0.82, 1]) sampleSideRevealPose(face, progress, direction);
    assert.deepEqual(reading, unchanged);
    assert.equal(reading.placed[card.id].id, card.id); assert.equal(reading.reversed[card.id], reversed);
    assert.deepEqual(reading.order, order);
    assert.equal(reduceReading(reading, { type: 'reveal', id: card.id }), reading);
    matrixNear(rotation(sampleSideRevealPose(face, 1, direction)), rotation(face));
    reading = reduceReading(reading, { type: 'move', id: card.id, x: 2, z: -1 });
    assert.equal(reading.placed[card.id].faceUp, true); assert.equal(reading.reversed[card.id], reversed);
    matrixNear(rotation(readingTablePose(reading.placed[card.id], reversed)), rotation(face));
  }
});

test('out-of-range progress clamps to endpoints; invalid progress or direction is rejected', () => {
  const face = readingTablePose(card, false);
  assert.deepEqual(sampleSideRevealPose(face, -1, -1), sampleSideRevealPose(face, 0, -1));
  assert.deepEqual(sampleSideRevealPose(face, 2, 1), sampleSideRevealPose(face, 1, 1));
  for (const invalid of [NaN, Infinity, -Infinity]) assert.throws(() => sampleSideRevealPose(face, invalid, 1), RangeError);
  for (const invalid of [0, 2, undefined, '1']) assert.throws(() => sampleSideRevealPose(face, 0.5, invalid), RangeError);
});
