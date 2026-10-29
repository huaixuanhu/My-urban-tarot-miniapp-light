/**
 * Source-independent, unbiased conversion of uint16 words into a physical deck.
 * Uniformity assumes independent uniform input words; this conversion cannot
 * certify the provider's physical source. No seed expansion or source fallback.
 */
export const RANDOM_CARD_COUNT = 78;
export const RANDOM_BATCH_SIZE = 1024;
export const MIN_DECK_WORDS = 155;
export const RANDOMNESS_ALGORITHM = 'fy-u16-rejection-bernoulli-v1';
const UINT16_RANGE = 65536;

export class RandomDataExhausted extends Error {
  constructor() {
    super('Remaining random data cannot complete a whole deck.');
    this.name = 'RandomDataExhausted';
    this.code = 'RANDOM_DATA_EXHAUSTED';
  }
}

function validWord(value) {
  return Number.isInteger(value) && value >= 0 && value < UINT16_RANGE;
}

/** Return an equiprobable index or null when this word must be discarded. */
export function uniformIndexFromUint16(value, bound) {
  if (!validWord(value)) throw new RangeError('Random words must be uint16 integers.');
  if (!Number.isInteger(bound) || bound < 1 || bound > UINT16_RANGE) {
    throw new RangeError('Index bound must be an integer from 1 through 65536.');
  }
  // Each residue has exactly floor(65536 / bound) accepted representatives.
  // Discard the high incomplete block BEFORE taking the remainder.
  const limit = Math.floor(UINT16_RANGE / bound) * bound;
  return value < limit ? value % bound : null;
}

/**
 * Returns a raw (pre-animation-interleave) permutation and orientations indexed
 * by physical ID. consumed includes rejected words and starts at offset.
 * On success or failure, values and the caller's cursor remain untouched.
 */
export function generateDeck(values, offset = 0) {
  if (!Array.isArray(values) && !(values instanceof Uint16Array)) {
    throw new TypeError('Random data must be an array or Uint16Array.');
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > values.length) {
    throw new RangeError('Random data offset is outside the available data.');
  }
  // Reject malformed batches even if a bad value happens to be past this deck.
  for (const value of values) if (!validWord(value)) throw new RangeError('Random words must be uint16 integers.');
  let cursor = offset;
  function nextWord() {
    if (cursor >= values.length) throw new RandomDataExhausted();
    return values[cursor++];
  }
  const order = Array.from({ length: RANDOM_CARD_COUNT }, (_, id) => id);
  for (let index = RANDOM_CARD_COUNT - 1; index > 0; index -= 1) {
    let selected;
    do { selected = uniformIndexFromUint16(nextWord(), index + 1); } while (selected === null);
    [order[index], order[selected]] = [order[selected], order[index]];
  }
  // Separate source words for orientation: 32768 representatives per outcome.
  // The stable physical ID, not its shuffled position, owns the orientation.
  const reversed = Array.from({ length: RANDOM_CARD_COUNT }, () => nextWord() < UINT16_RANGE / 2);
  return { order, reversed, consumed: cursor - offset };
}

/** Ordinary/demo mode only. A local failure never switches to Math.random(). */
export function generateLocalDeck(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.getRandomValues !== 'function') throw new TypeError('Local secure random source is unavailable.');
  const values = new Uint16Array(RANDOM_BATCH_SIZE);
  cryptoSource.getRandomValues(values);
  // Bounded even if an injected or broken source supplies only rejected values.
  return generateDeck(values);
}
