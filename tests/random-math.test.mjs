import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateDeck, generateLocalDeck, uniformIndexFromUint16, RandomDataExhausted,
  RANDOM_BATCH_SIZE, MIN_DECK_WORDS,
} from '../shared/randomness.mjs';

const identity = Array.from({ length: 78 }, (_, id) => id);
const identityChoices = Array.from({ length: 77 }, (_, i) => 77 - i);

test('all 65536 words have exactly equal accepted multiplicity for every shuffle bound', () => {
  for (let bound = 2; bound <= 78; bound += 1) {
    const counts = Array(bound).fill(0);
    let rejected = 0;
    for (let word = 0; word < 65536; word += 1) {
      const selected = uniformIndexFromUint16(word, bound);
      if (selected === null) rejected += 1;
      else { assert(selected >= 0 && selected < bound); counts[selected] += 1; }
    }
    assert.equal(new Set(counts).size, 1, `unequal counts at bound ${bound}`);
    assert.equal(counts.reduce((a, b) => a + b, 0) + rejected, 65536);
    assert.equal(rejected, 65536 % bound);
    assert.equal(counts[0], Math.floor(65536 / bound));
  }
});

test('rejection boundaries include the last full block and discard the incomplete block', () => {
  assert.equal(uniformIndexFromUint16(65519, 78), 77);
  assert.equal(uniformIndexFromUint16(65520, 78), null);
  assert.equal(uniformIndexFromUint16(65535, 78), null);
  assert.equal(uniformIndexFromUint16(65535, 2), 1);
  assert.equal(uniformIndexFromUint16(65535, 1), 0);
  assert.equal(uniformIndexFromUint16(65535, 65536), 65535);
});

test('known extreme choice vectors produce distinct complete physical permutations', () => {
  const zeros = Object.freeze(Array(155).fill(0));
  const first = generateDeck(zeros);
  assert.deepEqual(first.order, [...identity.slice(1), 0]);
  assert.deepEqual(first.reversed, Array(78).fill(true));
  assert.equal(first.consumed, MIN_DECK_WORDS);
  const self = generateDeck([...identityChoices, ...Array(78).fill(65535)]);
  assert.deepEqual(self.order, identity);
  assert.deepEqual(self.reversed, Array(78).fill(false));
  assert.equal(self.consumed, 155);
});

test('all 120 admissible five-card choice paths yield each permutation exactly once', () => {
  // Hold cards 5..77 fixed with self-swaps, then enumerate all 5*4*3*2 paths.
  const prefix = identityChoices.slice(0, 73), results = new Set();
  for (let a = 0; a < 5; a += 1) for (let b = 0; b < 4; b += 1)
    for (let c = 0; c < 3; c += 1) for (let d = 0; d < 2; d += 1) {
      const { order } = generateDeck([...prefix, a, b, c, d, ...Array(78).fill(0)]);
      assert.deepEqual(order.slice(5), identity.slice(5));
      assert.equal(new Set(order).size, 78);
      results.add(order.slice(0, 5).join(','));
    }
  assert.equal(results.size, 120);
});

test('orientations use new words by physical ID and split the full uint16 range equally', () => {
  const orientations = Array.from({ length: 78 }, (_, i) => [0, 32767, 32768, 65535][i % 4]);
  const a = generateDeck([...Array(77).fill(0), ...orientations]);
  const b = generateDeck([...identityChoices, ...orientations]);
  assert.notDeepEqual(a.order, b.order);
  assert.deepEqual(a.reversed, b.reversed);
  assert.deepEqual(a.reversed, orientations.map(value => value < 32768));
  let lower = 0, upper = 0;
  for (let word = 0; word < 65536; word += 1) {
    const result = generateDeck([...identityChoices, word, ...Array(77).fill(0)]);
    if (result.reversed[0]) lower += 1; else upper += 1;
  }
  assert.equal(lower, 32768); assert.equal(upper, 32768);
});

test('rejected words count toward consumption without shifting orientation identity', () => {
  const words = Object.freeze([23, 24, 65535, ...identityChoices, ...Array(78).fill(32768), 9]);
  const result = generateDeck(words, 2);
  assert.deepEqual(result.order, identity);
  assert.deepEqual(result.reversed, Array(78).fill(false));
  assert.equal(result.consumed, 156);
  assert.equal(words[2 + result.consumed], 9);
});

test('six disjoint decks consume 930 words of a no-rejection 1024-word batch', () => {
  const values = Object.freeze(Array(RANDOM_BATCH_SIZE).fill(0));
  let cursor = 0;
  for (let i = 0; i < 6; i += 1) {
    const result = generateDeck(values, cursor);
    cursor += result.consumed;
    assert.equal(result.consumed, 155);
  }
  assert.equal(cursor, 930); assert.equal(values.length - cursor, 94);
  assert.throws(() => generateDeck(values, cursor), RandomDataExhausted);
  assert.equal(cursor, 930);
  assert.deepEqual(values, Array(RANDOM_BATCH_SIZE).fill(0));
});

test('exhaustion at permutation or orientation stage returns no partial deck and mutates no input', () => {
  for (const input of [[], Array(154).fill(0), Array(1024).fill(65535), [...identityChoices, ...Array(77).fill(0)]]) {
    const before = [...input];
    assert.throws(() => generateDeck(input), RandomDataExhausted);
    assert.deepEqual(input, before);
  }
});

test('bad words, sparse arrays, invalid offsets and unsuitable containers are rejected', () => {
  for (const value of [-1, 65536, 1.2, NaN, Infinity, '3', null, undefined]) {
    assert.throws(() => generateDeck([...Array(155).fill(0), value]), RangeError);
    assert.throws(() => uniformIndexFromUint16(value, 78), RangeError);
  }
  assert.throws(() => generateDeck(Array(155)), RangeError);
  for (const bound of [0, -1, 65537, 2.3, NaN, '78']) assert.throws(() => uniformIndexFromUint16(0, bound), RangeError);
  for (const offset of [-1, 156, 1.2, NaN, '0']) assert.throws(() => generateDeck(Array(155).fill(0), offset), RangeError);
  for (const input of [null, {}, '0', new Float64Array(155), new Uint8Array(155)]) assert.throws(() => generateDeck(input), TypeError);
  assert.throws(() => generateDeck(Array(155).fill(0), 155), RandomDataExhausted);
  assert.equal(generateDeck(new Uint16Array(155)).consumed, 155);
});

test('ordinary mode uses a bounded Web Crypto batch and never falls back after source failure', () => {
  let calls = 0;
  const crypto = { getRandomValues(values) { calls += 1; assert(values instanceof Uint16Array); assert.equal(values.length, 1024); values.fill(0); return values; } };
  assert.equal(generateLocalDeck(crypto).consumed, 155);
  assert.equal(calls, 1);
  assert.throws(() => generateLocalDeck({}), TypeError);
  const failure = new Error('source unavailable');
  assert.throws(() => generateLocalDeck({ getRandomValues() { throw failure; } }), error => error === failure);
  assert.throws(() => generateLocalDeck({ getRandomValues(values) { values.fill(65535); } }), RandomDataExhausted);
});
