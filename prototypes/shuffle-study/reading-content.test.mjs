import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { readingCards, readingCard, selectedCardContent, createCardLoader, mayFinishReveal, fittedArtwork } from './reading-content.mjs';
import { createReading, reduceReading } from './reading-state.mjs';

const source = JSON.parse(readFileSync(new URL('../../client/src/data/tarotData.json', import.meta.url)));
const original = [...source.majorArcana, ...['wands', 'cups', 'swords', 'disks'].flatMap(suit => source.minorArcana[suit].cards)];
const draw = (state, id) => reduceReading(state, { type: 'draw', id, x: 0, z: -1 });

test('all 78 physical IDs retain the original deck order and exact content, with existing artwork', () => {
  assert.equal(readingCards.length, 78);
  assert.equal(new Set(readingCards.map(card => card.id)).size, 78);
  assert.equal(new Set(readingCards.map(card => card.image)).size, 78);
  original.forEach((card, id) => {
    const mapped = readingCard(id);
    for (const [key, value] of Object.entries(card)) assert.deepEqual(mapped[key], value);
    assert.equal(mapped.physicalId, id);
    assert.ok(statSync(new URL(`../../client/public${mapped.image}`, import.meta.url)).size > 0);
    assert.ok(Object.isFrozen(mapped));
  });
  for (const id of [-1, 78, 1.2, null, '0']) assert.throws(() => readingCard(id), RangeError);
});

test('selection does not disclose a hidden card, an in-progress reveal, or a resetting reading', () => {
  let state = draw(createReading(), 22);
  assert.equal(selectedCardContent(state), null);
  state = reduceReading(state, { type: 'reveal', id: 22 });
  assert.equal(selectedCardContent(state, true), null);
  assert.equal(selectedCardContent(state).id, original[22].id);
  state = reduceReading(state, { type: 'select', id: null });
  assert.equal(selectedCardContent(state), null);
});

test('reversal uses source content honestly and cannot replace an identity or manufacture a reverse meaning', () => {
  for (const reversed of [false, true]) {
    let state = createReading({ reversed: Array(78).fill(reversed) });
    for (let id = 0; id < 78; id++) {
      state = draw(state, id);
      state = reduceReading(state, { type: 'reveal', id });
      state = reduceReading(state, { type: 'move', id, x: 1, z: -2 });
      const content = selectedCardContent(state);
      assert.equal(content.id, original[id].id);
      assert.equal(content.reversed, reversed);
      assert.equal(content.missingReversedMeaning, reversed);
      assert.equal(content.meaning, original[id].interpretation);
    }
  }
});

test('a late image cannot reveal a card returned, redrawn, already opened, or in a new round', () => {
  let state = draw(createReading(), 4);
  const request = { id: 4, round: 0, drawOrder: state.placed[4].drawOrder };
  assert.equal(mayFinishReveal(state, request, 0), true);
  assert.equal(mayFinishReveal(state, request, 1), false);
  assert.equal(mayFinishReveal(reduceReading(state, { type: 'reveal', id: 4 }), request, 0), false);
  state = reduceReading(state, { type: 'return', id: 4 });
  assert.equal(mayFinishReveal(state, request, 0), false);
  state = draw(state, 4);
  assert.equal(mayFinishReveal(state, request, 0), false);
});

test('parallel requests decode once and a failed artwork retries the same physical card', async () => {
  let calls = 0;
  const load = createCardLoader(async id => { calls++; if (calls === 1) throw new Error('image unavailable'); return id; });
  const first = load(12);
  assert.equal(first, load(12));
  await assert.rejects(first, /unavailable/);
  assert.equal(await load(12), 12);
  assert.equal(await load(12), 12);
  assert.equal(calls, 2);
});

test('wide and tall source art stays uncropped and undistorted inside the fixed physical card', () => {
  for (const [w, h] of [[846, 1348], [802, 1314], [1500, 1000], [1000, 2000]]) {
    const fit = fittedArtwork(w, h, 768, 1264);
    assert.ok(fit.x >= 0 && fit.y >= 0);
    assert.ok(fit.x + fit.width <= 768.00001 && fit.y + fit.height <= 1264.00001);
    assert.ok(Math.abs(fit.width / fit.height - w / h) < 1e-10);
    assert.ok(Math.abs(fit.width - 768) < 1e-9 || Math.abs(fit.height - 1264) < 1e-9);
  }
});
