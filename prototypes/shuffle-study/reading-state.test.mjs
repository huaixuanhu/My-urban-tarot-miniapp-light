import test from 'node:test';
import assert from 'node:assert/strict';
import { READING_CARD_COUNT, createReading, reduceReading, canUndo } from './reading-state.mjs';

const order = Array.from({ length: READING_CARD_COUNT }, (_, i) => (i * 17 + 23) % READING_CARD_COUNT);
const reversed = Array.from({ length: READING_CARD_COUNT }, (_, id) => id % 3 === 0);
const fresh = () => createReading({ order, reversed });
const draw = (state, id, x = 0, z = 0) => reduceReading(state, { type: 'draw', id, x, z });

test('validates complete unique IDs and fixed per-identity orientations without mutating input', () => {
  const inputOrder = [...order], inputReversed = [...reversed];
  const state = createReading({ order: inputOrder, reversed: inputReversed });
  inputOrder.reverse(); inputReversed.fill(false);
  assert.deepEqual(state.order, order); assert.deepEqual(state.reversed, reversed);
  assert.throws(() => createReading({ order: Array(78).fill(0) }), RangeError);
  assert.throws(() => createReading({ order: [...order.slice(1), 78] }), RangeError);
  assert.throws(() => createReading({ reversed: Array(78).fill(0) }), TypeError);
  assert.throws(() => createReading({ reversed: [] }), TypeError);
  const sparseOrder = [...order]; delete sparseOrder[1];
  assert.throws(() => createReading({ order: sparseOrder }), RangeError);
  assert.throws(() => createReading({ reversed: Array(78) }), TypeError);
});

test('all 78 cards remain reachable with stable slots and no duplicate draws', () => {
  let state = fresh();
  for (const id of order) {
    const before = state;
    state = draw(state, id, id / 10, -id / 20);
    assert.equal(Object.keys(before.placed).length + 1, Object.keys(state.placed).length);
    assert.equal(reduceReading(state, { type: 'draw', id, x: 9, z: 9 }), state);
    assert.equal(state.placed[id].faceUp, false);
  }
  assert.equal(Object.keys(state.placed).length, 78);
  assert.deepEqual(state.order, order); assert.deepEqual(state.reversed, reversed);
  assert.equal(new Set(Object.values(state.placed).map(card => card.zIndex)).size, 78);
});

test('cancelled, invalid and redundant actions leave the state unchanged', () => {
  const state = draw(fresh(), 0, 1, 2);
  for (const action of [null, { type: 'cancel' }, { type: 'draw', id: 78, x: 0, z: 0 }, { type: 'draw', id: '2', x: 0, z: 0 }, { type: 'draw', id: 2, x: NaN, z: 0 }, { type: 'move', id: 0, x: Infinity, z: 0 }, { type: 'move', id: 0, x: 1, z: 2 }, { type: 'move', id: 1, x: 0, z: 0 }, { type: 'reveal', id: 1 }, { type: 'select', id: 77 }, { type: 'arrange3' }]) {
    assert.equal(reduceReading(state, action), state);
  }
});

test('selection raises a placed card; moving and one-way revealing preserve its identity', () => {
  let state = draw(draw(fresh(), 5), 12);
  const before = structuredClone(state);
  const selected = reduceReading(state, { type: 'select', id: 5 });
  assert.deepEqual(state, before);
  assert.equal(selected.selectedId, 5);
  assert.ok(selected.placed[5].zIndex > selected.placed[12].zIndex);
  assert.equal(selected.history.length, state.history.length);
  state = reduceReading(selected, { type: 'move', id: 5, x: -2.5, z: 1.25 });
  state = reduceReading(state, { type: 'reveal', id: 5 });
  assert.equal(state.placed[5].id, 5); assert.equal(state.placed[5].faceUp, true);
  assert.equal(state.reversed[5], reversed[5]);
  assert.equal(reduceReading(state, { type: 'reveal', id: 5 }), state);
  assert.equal(reduceReading(state, { type: 'return', id: 5 }), state);
  assert.equal(reduceReading(state, { type: 'select', id: null }).selectedId, null);
});

test('returning a hidden card restores the original deck slot; undo restores its prior position', () => {
  let state = draw(fresh(), 30, -3, 2);
  const originalSlot = state.order.indexOf(30), original = { ...state.placed[30] };
  state = reduceReading(state, { type: 'return', id: 30 });
  assert.equal(Object.hasOwn(state.placed, 30), false);
  assert.equal(state.order.indexOf(30), originalSlot);
  assert.equal(state.reversed[30], reversed[30]);
  state = reduceReading(state, { type: 'undo' });
  assert.deepEqual(state.placed[30], original);
  assert.equal(state.selectedId, 30);
  state = reduceReading(state, { type: 'undo' });
  assert.deepEqual(state.placed, {}); assert.equal(state.selectedId, null);
  assert.equal(canUndo(state), false);
});

test('undo restores positions without undoing knowledge or returning a revealed card', () => {
  let state = draw(fresh(), 7, 1, 2);
  state = reduceReading(state, { type: 'move', id: 7, x: 3, z: 4 });
  state = reduceReading(state, { type: 'reveal', id: 7 });
  assert.equal(canUndo(state), true);
  state = reduceReading(state, { type: 'undo' });
  assert.equal(state.placed[7].x, 1); assert.equal(state.placed[7].z, 2);
  assert.equal(state.placed[7].faceUp, true); assert.equal(state.revealed[7], true);
  assert.equal(canUndo(state), false);
  assert.equal(reduceReading(state, { type: 'undo' }), state);
  assert.equal(reduceReading(state, { type: 'return', id: 7 }), state);
});

test('revealing a returned then redrawn card does not revive an obsolete placement through undo', () => {
  let state = draw(fresh(), 4, 1, 1);
  state = reduceReading(state, { type: 'move', id: 4, x: 2, z: 2 });
  state = reduceReading(state, { type: 'return', id: 4 });
  state = draw(state, 4, 8, 8);
  state = reduceReading(state, { type: 'reveal', id: 4 });
  assert.equal(canUndo(state), false);
  assert.equal(reduceReading(state, { type: 'undo' }), state);
  assert.equal(state.placed[4].x, 8); assert.equal(state.placed[4].faceUp, true);
});

test('arrange3 moves the first three drawn cards as one undoable group without limiting other cards', () => {
  let state = fresh();
  for (const id of [20, 3, 40, 6]) state = draw(state, id, id, id / 2);
  const before = structuredClone(state);
  state = reduceReading(state, { type: 'arrange3' });
  assert.deepEqual([20, 3, 40].map(id => [state.placed[id].x, state.placed[id].z]), [[-1.8, 0], [0, 0], [1.8, 0]]);
  assert.deepEqual(state.placed[6], before.placed[6]);
  assert.equal(Object.keys(state.placed).length, 4);
  assert.equal(state.history.length, before.history.length + 1);
  state = reduceReading(state, { type: 'reveal', id: 3 });
  state = reduceReading(state, { type: 'undo' });
  for (const id of [20, 3, 40]) {
    assert.equal(state.placed[id].x, before.placed[id].x);
    assert.equal(state.placed[id].z, before.placed[id].z);
  }
  assert.equal(state.placed[3].faceUp, true);
});

test('reset starts a clean reading with the caller-supplied new order and orientations', () => {
  const original = reduceReading(draw(fresh(), 0), { type: 'reveal', id: 0 });
  const nextOrder = [...order].reverse(), nextReversed = reversed.map(value => !value);
  const reset = reduceReading(original, { type: 'reset', order: nextOrder, reversed: nextReversed });
  assert.deepEqual(reset.placed, {}); assert.deepEqual(reset.history, []);
  assert.equal(reset.selectedId, null); assert.equal(reset.revealed.some(Boolean), false);
  assert.deepEqual(reset.order, nextOrder); assert.deepEqual(reset.reversed, nextReversed);
  assert.equal(original.placed[0].faceUp, true);
  assert.equal(reduceReading(original, { type: 'reset', order: [0] }), original);
});
