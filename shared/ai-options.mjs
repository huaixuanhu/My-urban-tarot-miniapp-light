/** Browser-safe settings; the service validates the same values before calling OpenAI. */
export const AI_MODELS = Object.freeze([
  { id: 'gpt-6.1-terra', label: '6.1 Terra' },
  { id: 'gpt-6.1-sol', label: '6.1 Sol' },
]);
export const AI_EFFORTS = Object.freeze([
  { id: 'low', label: '轻量', minimumTokens: 1000, suggestedTokens: 3000 },
  { id: 'medium', label: '标准', minimumTokens: 3000, suggestedTokens: 6000 },
  { id: 'high', label: '深入', minimumTokens: 6000, suggestedTokens: 12000 },
]);
export const AI_TOKEN_PRESETS = Object.freeze([3000, 6000, 12000]);
export const AI_MAX_OUTPUT_TOKENS = 12000;
export const AI_MAX_INPUT_TOKENS = 10000;
export const AI_DEFAULTS = Object.freeze({ model: 'gpt-6.1-terra', effort: 'low', maxOutputTokens: 3000 });

// Intentionally broad guidance for this bounded text-only feature, not a quote.
// Input, actual generation length, reasoning and model all affect the bill.
export function aiCostHint(model, effort) {
  const sol = model === 'gpt-6.1-sol';
  const upper = effort === 'high' ? (sol ? '0.30' : '0.15') : effort === 'medium' ? (sol ? '0.25' : '0.12') : (sol ? '0.20' : '0.10');
  return `约 US$0.001–${upper} / 次`;
}

/** Ignore session IDs, human notes and selection-only stacking changes. */
export function aiReadingSignature(reading) {
  return JSON.stringify({
    question: reading.question.trim(), spread: reading.spread,
    cards: [...reading.cards].sort((a, b) => a.drawOrder - b.drawOrder).map(card => ({
      sourceCardId: card.sourceCardId, reversed: card.reversed, faceUp: card.faceUp,
      drawOrder: card.drawOrder, x: card.x, z: card.z, positionLabel: (card.positionLabel || '').trim(),
    })),
  });
}
