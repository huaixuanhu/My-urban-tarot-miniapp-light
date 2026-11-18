import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardDrag, updateCardDrag, finishCardDrag, finishViewDrag, viewportChanged } from '../../client/src/reading-drag.mjs';
import { createReading, reduceReading } from '../../client/src/reading-state.mjs';
import { DEFAULT_VIEW, dragView } from '../../client/src/reading-view.mjs';

const pointer = (x, y = 100, pointerId = 1) => ({ clientX: x, clientY: y, pointerId });
const placedReading = () => reduceReading(createReading(), { type: 'draw', id: 4, x: 1, z: -.7 });

test('interrupted camera movement keeps its latest pose while Escape restores the gesture start', () => {
  const startView = { ...DEFAULT_VIEW, zoom: 1.4 };
  const gesture = { startView }, moved = dragView(startView, 180, 90);
  assert.notDeepEqual(moved, startView);
  assert.deepEqual(finishViewDrag(gesture, moved, 'interrupt'), moved);
  assert.deepEqual(finishViewDrag(gesture, moved, 'release'), moved);
  assert.deepEqual(finishViewDrag(gesture, moved, 'cancel'), startView);
  assert.deepEqual(startView, { ...DEFAULT_VIEW, zoom: 1.4 });
});

test('an interrupted existing-card drag settles the last valid preview without changing identity or reveal', () => {
  const initial = reduceReading(placedReading(), { type: 'reveal', id: 4 });
  const drag = createCardDrag(4, pointer(100), { x: 1, z: -.7 }, initial.placed[4]);
  updateCardDrag(drag, pointer(180), { x: 3, z: -2 }, true);
  const result = finishCardDrag(drag, 'interrupt');
  const settled = reduceReading(initial, result.action);
  assert.deepEqual(result.action, { type: 'move', id: 4, x: 3, z: -2 });
  assert.equal(settled.placed[4].faceUp, true);
  assert.deepEqual(settled.order, initial.order);
  assert.deepEqual(settled.reversed, initial.reversed);
  assert.equal(Object.keys(settled.placed).length, 1);
  assert.deepEqual(reduceReading(settled, { type: 'undo' }).placed[4], initial.placed[4]);
});

test('a deck preview can become a draw only on successful release, never on interruption or Escape', () => {
  const initial = createReading();
  const drag = createCardDrag(4, pointer(100), { x: 1, z: 3 }, null);
  updateCardDrag(drag, pointer(180), { x: 2, z: -.5 }, true);
  for (const reason of ['interrupt', 'cancel']) {
    const result = finishCardDrag(drag, reason);
    assert.equal(result.action, null);
    assert.equal(reduceReading(initial, result.action), initial);
  }
  const result = finishCardDrag(drag, 'release');
  assert.deepEqual(result.action, { type: 'draw', id: 4, x: 2, z: -.5 });
  assert.equal(Object.keys(reduceReading(initial, result.action).placed).length, 1);
});

test('card-edge previews and successful release share the same clamped placement and grab offset', () => {
  const initial = placedReading();
  // Grabbing one unit to the right of the card center retains that offset.
  const drag = createCardDrag(4, pointer(100), { x: 2, z: -.7 }, initial.placed[4]);
  updateCardDrag(drag, pointer(280), { x: 7.75, z: -.7 }, true);
  assert.deepEqual(drag.point, { x: 6.6, z: -.7 });
  const result = finishCardDrag(drag, 'release');
  assert.deepEqual({ x: result.action.x, z: result.action.z }, drag.point);
  assert.equal(result.invalidDrop, false);
});

test('invalid rays and outside-area movement hold the last valid preview and still reject an invalid release', () => {
  for (const [point, inside] of [[{ x: 9, z: -2 }, true], [{ x: 2, z: 3 }, true], [{ x: 2, z: -2 }, false], [null, true], [{ x: NaN, z: 0 }, true]]) {
    const initial = placedReading(), drag = createCardDrag(4, pointer(100), { x: 1, z: -.7 }, initial.placed[4]);
    updateCardDrag(drag, pointer(180), { x: 2, z: -2 }, true);
    updateCardDrag(drag, pointer(280), point, inside);
    assert.deepEqual(drag.point, { x: 2, z: -2 });
    const rejected = finishCardDrag(drag, 'release');
    assert.equal(rejected.invalidDrop, true);
    assert.equal(rejected.action, null);
    assert.equal(reduceReading(initial, rejected.action), initial);
    assert.deepEqual(finishCardDrag(drag, 'interrupt').action, { type: 'move', id: 4, x: 2, z: -2 });
  }
});

test('explicit Escape and movements below the drag threshold leave the original reading intact', () => {
  const initial = placedReading(), drag = createCardDrag(4, pointer(100), { x: 1, z: -.7 }, initial.placed[4]);
  updateCardDrag(drag, pointer(103), { x: 1.1, z: -.7 }, true);
  assert.equal(finishCardDrag(drag, 'interrupt').action, null);
  updateCardDrag(drag, pointer(180), { x: 3, z: -2 }, true);
  assert.equal(reduceReading(initial, finishCardDrag(drag, 'cancel').action), initial);
});

test('another pointer cannot move or end the active card gesture', () => {
  const initial = placedReading(), drag = createCardDrag(4, pointer(100), { x: 1, z: -.7 }, initial.placed[4]);
  const before = structuredClone(drag);
  assert.equal(updateCardDrag(drag, pointer(280, 100, 2), { x: 3, z: -2 }, true), false);
  assert.deepEqual(drag, before);
  assert.deepEqual(finishCardDrag(drag, 'interrupt', 2), { handled: false, action: null, invalidDrop: false });
});

test('unchanged resize observations leave the gesture active; an actual resize settles its preview', () => {
  const initial = placedReading();
  let active = createCardDrag(4, pointer(100), { x: 1, z: -.7 }, initial.placed[4]), settled = initial;
  updateCardDrag(active, pointer(180), { x: 2, z: -2 }, true);
  let viewport = { width: 1280, height: 720 };
  const resize = next => {
    if (!viewportChanged(viewport, next)) return;
    viewport = next;
    settled = reduceReading(settled, finishCardDrag(active, 'interrupt').action);
    active = null;
  };
  resize({ width: 1280, height: 720 });
  assert.ok(active);
  assert.equal(settled, initial);
  resize({ width: 1024, height: 768 });
  assert.equal(active, null);
  assert.equal(settled.placed[4].x, 2);
  assert.equal(settled.placed[4].z, -2);
  assert.equal(viewportChanged(undefined, viewport), true);
});
