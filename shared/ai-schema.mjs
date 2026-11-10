import { normalizeRecordInput, normalizeRecordId, RecordValidationError } from './record-schema.mjs';
import { AI_MODELS, AI_EFFORTS, AI_DETAILS, AI_FOCUSES, AI_DEFAULTS, AI_MAX_OUTPUT_TOKENS } from './ai-options.mjs';
import { normalizeAITimeZone, normalizeSourceUrl } from './ai-web.mjs';

export const AI_BODY_LIMIT = 64 * 1024;
export class AIValidationError extends Error {}
const invalid = message => { throw new AIValidationError(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function fields(value, allowed, required = allowed) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !(key in value))) invalid('AI 解读内容格式不正确。');
}

export function normalizeAIInput(value) {
  fields(value, ['id', 'reading', 'model', 'effort', 'maxOutputTokens', 'detail', 'focus', 'liveCheck', 'timeZone'], ['id', 'reading', 'model', 'effort', 'maxOutputTokens']);
  let id, reading;
  try { id = normalizeRecordId(value.id); reading = normalizeRecordInput(value.reading); }
  catch (error) { if (error instanceof RecordValidationError) invalid(error.message); throw error; }
  // Random-source metadata is not needed for interpretation and has not been
  // verified on this route. Keep allocation provenance solely in shared records.
  delete reading.randomness;
  if (!reading.question) invalid('请先写下这次想了解的问题。');
  if (reading.interpretation || reading.reflection || reading.aiInterpretationIds?.length) invalid('AI 请求仅接收问题和牌阵，不接收已有解读。');
  if (!AI_MODELS.some(model => model.id === value.model)) invalid('请选择 6.1 Terra 或 6.1 Sol。');
  const detail = value.detail === undefined ? AI_DEFAULTS.detail : value.detail;
  const focus = value.focus === undefined ? AI_DEFAULTS.focus : value.focus;
  if (!AI_DETAILS.some(item => item.id === detail)) invalid('请选择支持的解读详细度。');
  if (!AI_FOCUSES.some(item => item.id === focus)) invalid('请选择支持的解读侧重。');
  const effort = AI_EFFORTS.find(item => item.id === value.effort);
  if (!effort) invalid('请选择支持的分析强度。');
  if (!Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens < effort.minimumTokens || value.maxOutputTokens > AI_MAX_OUTPUT_TOKENS) invalid(`这个强度的生成预算需要在 ${effort.minimumTokens}–${AI_MAX_OUTPUT_TOKENS} token 之间。`);
  const liveCheck = value.liveCheck === undefined ? false : value.liveCheck;
  if (typeof liveCheck !== 'boolean') invalid('请选择是否联网核查。');
  const timeZone = liveCheck ? normalizeAITimeZone(value.timeZone) : undefined;
  if (liveCheck && !timeZone) invalid('当前时区无效，请刷新页面后再试。');
  if (!liveCheck && value.timeZone !== undefined) invalid('时区仅用于联网核查。');
  return { id, reading, model: value.model, effort: effort.id, maxOutputTokens: value.maxOutputTokens, detail, focus, liveCheck,
    ...(liveCheck ? { timeZone } : {}) };
}

function boundedString(value, max = 12000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid('AI 返回的文字不完整或过长。');
  return value;
}
export function validateAIAnswer(value, reading, { liveCheck = false, webCheck } = {}) {
  fields(value, ['summary', 'cards', 'reflectionQuestions', 'limitations', ...(liveCheck ? ['factChecks'] : [])]);
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
  const answer = structuredClone(value);
  if (liveCheck) {
    if (webCheck?.status !== 'searched' || !Array.isArray(webCheck.sources)) invalid('本次联网核查尚未完成。');
    if (!Array.isArray(value.factChecks) || value.factChecks.length > 8) invalid('联网核查内容格式不正确。');
    const sources = new Set(webCheck.sources.map(source => normalizeSourceUrl(source.url)).filter(Boolean));
    answer.factChecks = value.factChecks.map(fact => {
      fields(fact, ['claim', 'finding', 'status', 'sourceUrls']);
      boundedString(fact.claim, 1000); boundedString(fact.finding, 2000);
      if (!['supported', 'disputed', 'uncertain'].includes(fact.status) || !Array.isArray(fact.sourceUrls) || fact.sourceUrls.length > 8) invalid('联网核查结论格式不正确。');
      const sourceUrls = fact.sourceUrls.map(normalizeSourceUrl);
      if (sourceUrls.some(url => !url || !sources.has(url)) || new Set(sourceUrls).size !== sourceUrls.length || (fact.status !== 'uncertain' && !sourceUrls.length)) invalid('核查来源与本次实际检索不一致。');
      return { ...fact, sourceUrls };
    });
  }
  return answer;
}

export function answerSchema(reading, { liveCheck = false } = {}) {
  const schema = {
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
  if (liveCheck) {
    schema.properties.factChecks = { type: 'array', maxItems: 8, items: {
      type: 'object', additionalProperties: false,
      properties: { claim: { type: 'string' }, finding: { type: 'string' }, status: { type: 'string', enum: ['supported', 'disputed', 'uncertain'] },
        sourceUrls: { type: 'array', maxItems: 8, items: { type: 'string' } } },
      required: ['claim', 'finding', 'status', 'sourceUrls'],
    } };
    schema.required.push('factChecks');
  }
  return schema;
}
