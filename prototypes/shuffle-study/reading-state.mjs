/** Pure reading model. Randomization and pointer previews belong to the caller. */
export const READING_CARD_COUNT = 78;
const validId = id => Number.isInteger(id) && id >= 0 && id < READING_CARD_COUNT;
const validPosition = position => Number.isFinite(position?.x) && Number.isFinite(position?.z);
const hasCard = (state, id) => validId(id) && Object.hasOwn(state.placed, id);

export function createReading({ order = Array.from({ length: READING_CARD_COUNT }, (_, id) => id), reversed = Array(READING_CARD_COUNT).fill(false) } = {}) {
  if (!Array.isArray(order) || order.length !== READING_CARD_COUNT || new Set(order).size !== READING_CARD_COUNT || !Array.from(order).every(validId)) {
    throw new RangeError('Order must contain every physical card ID from 0 through 77 exactly once.');
  }
  if (!Array.isArray(reversed) || reversed.length !== READING_CARD_COUNT || !Array.from(reversed).every(value => typeof value === 'boolean')) {
    throw new TypeError('Reversed orientations must be 78 booleans indexed by physical card ID.');
  }
  return { order: [...order], reversed: [...reversed], placed: {}, selectedId: null, nextZ: 1, nextDraw: 1, history: [], revealed: Array(READING_CARD_COUNT).fill(false) };
}

function restoreSelection(placed, id) {
  return id !== null && Object.hasOwn(placed, id) ? id : null;
}

function applicableUndo(state, entry) {
  if (entry.type === 'draw') return hasCard(state, entry.id) && state.placed[entry.id].drawOrder === entry.drawOrder && !state.revealed[entry.id];
  if (entry.type === 'return') return !hasCard(state, entry.card.id) && !state.revealed[entry.card.id];
  return entry.cards.some(card => hasCard(state, card.id) && state.placed[card.id].drawOrder === card.drawOrder);
}

export function canUndo(state) {
  return state.history.some(entry => applicableUndo(state, entry));
}

function moveCards(state, positions) {
  const changes = positions.filter(position => state.placed[position.id].x !== position.x || state.placed[position.id].z !== position.z);
  if (changes.length === 0) return state;
  const before = changes.map(({ id }) => ({ ...state.placed[id] }));
  const placed = { ...state.placed };
  changes.forEach((position, index) => { placed[position.id] = { ...placed[position.id], x: position.x, z: position.z, zIndex: state.nextZ + index }; });
  return {
    ...state, placed, selectedId: changes[changes.length - 1].id, nextZ: state.nextZ + changes.length,
    history: [...state.history, { type: 'move', cards: before, selectedBefore: state.selectedId }],
  };
}

/**
 * draw/move: {type,id,x,z}; select/reveal/return: {type,id}; select null clears.
 * arrange3: {type,ids?,positions?}; positions are three {x,z} objects.
 * undo: {type}; reset: {type,order?,reversed?}; cancel/invalid actions do nothing.
 */
export function reduceReading(state, action) {
  if (!action || typeof action !== 'object') return state;
  const { id } = action;
  switch (action.type) {
    case 'draw': {
      if (!validId(id) || hasCard(state, id) || state.revealed[id] || !validPosition(action)) return state;
      const card = { id, x: action.x, z: action.z, faceUp: false, zIndex: state.nextZ, drawOrder: state.nextDraw };
      return {
        ...state, placed: { ...state.placed, [id]: card }, selectedId: id, nextZ: state.nextZ + 1, nextDraw: state.nextDraw + 1,
        history: [...state.history, { type: 'draw', id, drawOrder: card.drawOrder, selectedBefore: state.selectedId }],
      };
    }
    case 'move': {
      if (!hasCard(state, id) || !validPosition(action)) return state;
      return moveCards(state, [{ id, x: action.x, z: action.z }]);
    }
    case 'select': {
      if (id === null) return state.selectedId === null ? state : { ...state, selectedId: null };
      if (!hasCard(state, id)) return state;
      if (state.selectedId === id && state.placed[id].zIndex === state.nextZ - 1) return state;
      return { ...state, placed: { ...state.placed, [id]: { ...state.placed[id], zIndex: state.nextZ } }, selectedId: id, nextZ: state.nextZ + 1 };
    }
    case 'reveal': {
      if (!hasCard(state, id) || state.revealed[id]) return state;
      const revealed = [...state.revealed]; revealed[id] = true;
      // Known identities cannot be returned to the hidden deck through undo.
      // Position history for this placement remains valid and never hides its face.
      const history = state.history.flatMap(entry => {
        if ((entry.type === 'draw' && entry.id === id) || (entry.type === 'return' && entry.card.id === id)) return [];
        if (entry.type !== 'move') return [entry];
        const cards = entry.cards.filter(card => card.id !== id || card.drawOrder === state.placed[id].drawOrder);
        return cards.length ? [{ ...entry, cards }] : [];
      });
      return { ...state, placed: { ...state.placed, [id]: { ...state.placed[id], faceUp: true } }, revealed, history };
    }
    case 'return': {
      if (!hasCard(state, id) || state.revealed[id] || state.placed[id].faceUp) return state;
      const placed = { ...state.placed }, card = placed[id]; delete placed[id];
      return {
        ...state, placed, selectedId: state.selectedId === id ? null : state.selectedId,
        history: [...state.history, { type: 'return', card: { ...card }, selectedBefore: state.selectedId }],
      };
    }
    case 'arrange3': {
      const ids = action.ids ?? Object.values(state.placed).sort((a, b) => a.drawOrder - b.drawOrder).slice(0, 3).map(card => card.id);
      const positions = action.positions ?? [{ x: -1.8, z: 0 }, { x: 0, z: 0 }, { x: 1.8, z: 0 }];
      if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3 || !Array.from(ids).every(cardId => hasCard(state, cardId))) return state;
      if (!Array.isArray(positions) || positions.length !== 3 || !Array.from(positions).every(validPosition)) return state;
      return moveCards(state, ids.map((cardId, index) => ({ id: cardId, x: positions[index].x, z: positions[index].z })));
    }
    case 'undo': {
      let index = state.history.length - 1;
      while (index >= 0 && !applicableUndo(state, state.history[index])) index -= 1;
      if (index < 0) return state;
      const entry = state.history[index], placed = { ...state.placed };
      if (entry.type === 'draw') delete placed[entry.id];
      else if (entry.type === 'return') placed[entry.card.id] = { ...entry.card };
      else {
        for (const before of entry.cards) {
          if (!hasCard(state, before.id) || placed[before.id].drawOrder !== before.drawOrder) continue;
          placed[before.id] = { ...placed[before.id], x: before.x, z: before.z, zIndex: before.zIndex };
        }
      }
      return { ...state, placed, selectedId: restoreSelection(placed, entry.selectedBefore), history: state.history.slice(0, index) };
    }
    case 'reset': {
      try { return createReading({ order: action.order ?? state.order, reversed: action.reversed ?? state.reversed }); }
      catch (error) { if (error instanceof RangeError || error instanceof TypeError) return state; throw error; }
    }
    default: return state;
  }
}
