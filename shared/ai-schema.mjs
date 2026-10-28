import { normalizeRecordInput, normalizeRecordId, RecordValidationError } from './record-schema.mjs';
import { AI_MODELS, AI_EFFORTS, AI_MAX_OUTPUT_TOKENS } from './ai-options.mjs';

export const AI_BODY_LIMIT = 64 * 1024;
export class AIValidationError extends Error {}
const invalid = message => { throw new AIValidationError(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function fields(value, allowed, required = allowed) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !(key in value))) invalid('AI 解读内容格式不正确。');
}

export function normalizeAIInput(value) {
  fields(value, ['id', 'reading', 'model', 'effort', 'maxOutputTokens']);
  let id, reading;
  try { id = normalizeRecordId(value.id); reading = normalizeRecordInput(value.reading); }
  catch (error) { if (error instanceof RecordValidationError) invalid(error.message); throw error; }
  if (!reading.question) invalid('请先写下这次想了解的问题。');
  if (reading.interpretation || reading.reflection || reading.aiInterpretationIds?.length) invalid('AI 请求仅接收问题和牌阵，不接收已有解读。');
  if (!AI_MODELS.some(model => model.id === value.model)) invalid('请选择 6.1 Terra 或 6.1 Sol。');
  const effort = AI_EFFORTS.find(item => item.id === value.effort);
  if (!effort) invalid('请选择支持的分析强度。');
  if (!Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens < effort.minimumTokens || value.maxOutputTokens > AI_MAX_OUTPUT_TOKENS) invalid(`这个强度的生成预算需要在 ${effort.minimumTokens}–${AI_MAX_OUTPUT_TOKENS} token 之间。`);
  return { id, reading, model: value.model, effort: effort.id, maxOutputTokens: value.maxOutputTokens };
}

function boundedString(value, max = 12000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid('AI 返回的文字不完整或过长。');
  return value;
}
export function validateAIAnswer(value, reading) {
  fields(value, ['summary', 'cards', 'reflectionQuestions', 'limitations']);
  boundedString(value.summary);
  if (!Array.isArray(value.cards) || value.cards.length !== reading.cards.length) invalid('AI 返回的牌数不一致。');
  value.cards.forEach((card, index) => {
    fields(card, ['sourceCardId', 'reversed', 'positionLabel', 'basis', 'interpretation']);
    const source = reading.cards[index];
    if (card.sourceCardId !== source.sourceCardId || card.reversed !== source.reversed || card.positionLabel !== source.positionLabel) invalid('AI 返回的牌阵信息与本次提交不一致。');
    if (card.basis !== (source.reversed ? 'generated_reversal_extension' : 'provided_meaning')) invalid('AI 返回的牌义来源不正确。');
    boundedString(card.interpretation, 6000);
  });
  if (!Array.isArray(value.reflectionQuestions) || value.reflectionQuestions.length < 1 || value.reflectionQuestions.length > 3) invalid('AI 返回的思考问题格式不正确。');
  value.reflectionQuestions.forEach(item => boundedString(item, 2000));
  if (!Array.isArray(value.limitations) || value.limitations.length > 5) invalid('AI 返回的说明格式不正确。');
  value.limitations.forEach(item => boundedString(item, 2000));
  if (reading.cards.some(card => card.reversed) && !value.limitations.length) invalid('逆位延伸说明缺失。');
  return structuredClone(value);
}

export function answerSchema(reading) {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      cards: { type: 'array', minItems: reading.cards.length, maxItems: reading.cards.length,
        items: { type: 'object', additionalProperties: false,
          properties: {
            sourceCardId: { type: 'string', enum: reading.cards.map(card => card.sourceCardId) },
            reversed: { type: 'boolean' }, positionLabel: { type: 'string' },
            basis: { type: 'string', enum: ['provided_meaning', 'generated_reversal_extension'] },
            interpretation: { type: 'string' },
          }, required: ['sourceCardId', 'reversed', 'positionLabel', 'basis', 'interpretation'],
        } },
      reflectionQuestions: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
      limitations: { type: 'array', maxItems: 5, items: { type: 'string' } },
    }, required: ['summary', 'cards', 'reflectionQuestions', 'limitations'],
  };
}
