import source from '../../client/src/data/tarotData.json' with { type: 'json' };

// Match the legacy deck's order once. A physical ID never depends on a fan slot.
export const readingDeck = Object.freeze({ ...source.deck });
export const readingCards = Object.freeze([
  ...source.majorArcana.map(card => ({ ...card, family: '大阿尔卡那' })),
  ...['wands', 'cups', 'swords', 'disks'].flatMap(suit =>
    source.minorArcana[suit].cards.map(card => ({ ...card,
      family: { wands: '权杖', cups: '圣杯', swords: '宝剑', disks: '星币' }[suit],
      element: source.minorArcana[suit].element,
    }))),
].map((card, physicalId) => Object.freeze({ ...card, physicalId })));

export function readingCard(id) {
  if (!Number.isInteger(id) || !readingCards[id]) throw new RangeError('Unknown reading card.');
  return readingCards[id];
}

export function readingCardLabel(id) { return readingCard(id).name; }

/** No card name, image or meaning is exposed by this view before a completed reveal. */
export function selectedCardContent(state, concealed = false) {
  const placed = state.placed[state.selectedId];
  if (concealed || !placed?.faceUp) return null;
  const card = readingCard(placed.id), reversed = state.reversed[placed.id];
  return {
    ...card, reversed, orientation: reversed ? '逆位' : '正位',
    meaning: reversed && card.reversedInterpretation ? card.reversedInterpretation : card.interpretation,
    missingReversedMeaning: reversed && !card.reversedInterpretation,
  };
}

/** Share in-flight work; a failed image can be retried without changing the card. */
export function createCardLoader(load) {
  const cache = new Map();
  return id => {
    readingCard(id);
    if (!cache.has(id)) {
      const request = Promise.resolve().then(() => load(id)).catch(error => {
        cache.delete(id); throw error;
      });
      cache.set(id, request);
    }
    return cache.get(id);
  };
}

/** Returning/redrawing a card or starting a new shuffle invalidates a slow reveal. */
export function mayFinishReveal(state, request, round) {
  const card = state.placed[request.id];
  return request.round === round && !!card && !card.faceUp && card.drawOrder === request.drawOrder;
}

export function fittedArtwork(width, height, targetWidth, targetHeight) {
  if (![width, height, targetWidth, targetHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Artwork dimensions must be positive.');
  }
  const scale = Math.min(targetWidth / width, targetHeight / height);
  const w = width * scale, h = height * scale;
  return { x: (targetWidth - w) / 2, y: (targetHeight - h) / 2, width: w, height: h };
}
