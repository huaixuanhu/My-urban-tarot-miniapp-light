/** Credential-free fixtures derived from STATE.md stage2.5.13.
 * This file is only imported by the local preview. All prose and search receipts
 * are authored synthetic examples, never actual model or web-search evidence.
 */
import { buildStoredRecord } from '../../shared/record-schema.mjs';
import { publicInterpretation } from '../../server/ai/service.mjs';

export const PREVIEW_SOURCE = Object.freeze({
  url: 'https://developers.openai.com/api/docs/guides/tools-web-search',
  title: 'OpenAI Web search 文档 · 本地引用展示示例',
});

export function previewAnswer(reading, { live = false, empty = false, variant = 'standard' } = {}) {
  const deeper = variant === 'deep';
  return {
    summary: deeper
      ? '本地示例：你正在为一个想法寻找合适的落点。可以把手头已有的素材和真正想表达的内容放在一起，选出最有联系的部分，形成一份便于回看的小样。\n\n具体进展可以帮助你辨认下一步的需要：哪些部分已经清楚，哪些地方还需要补充。给尝试留出调整的余地，也为自己的选择保留一条清楚的理由。'
      : '本地示例：先从与你的问题最贴近的一条线索展开。把已有资源、期待的变化和现实条件放在一起观察，会更容易看清当前可以推进的部分。一次小规模的尝试能够带来具体反馈，帮助你决定下一步。',
    cards: reading.cards.map((card, index) => ({
      sourceCardId: card.sourceCardId, reversed: card.reversed, positionLabel: card.positionLabel,
      basis: card.reversed ? 'generated_reversal_extension' : 'provided_meaning',
      interpretation: `本地示例 · ${card.name || card.sourceSnapshot?.name || card.sourceCardId}：${[
        '这一处可以放进你已经拥有的资源，观察哪些条件能够支持眼前的尝试。',
        '这一处适合梳理真正牵动你的因素，把需要补充的信息写成一个具体问题。',
        '这一处可以承接前面的观察，选择一项便于回看结果的小行动。',
        '这一处适合回顾自己的取舍，给接下来的调整留出空间。',
      ][index % 4]}${deeper ? '把这条观察与自己填写的牌位联系起来，再看它如何补充其他位置的线索。' : ''}`,
    })),
    reflectionQuestions: deeper
      ? ['现在最值得保留的一条线索是什么？', '什么样的反馈会帮助你调整下一步？']
      : ['你准备从哪一个具体线索开始？'],
    limitations: [
      '以上内容为本地编写的界面示例，用于预览阅读与保存流程。',
      ...(reading.cards.some(card => card.reversed) ? ['逆位说明在本示例中作为基于正位主题的探索角度延伸。'] : []),
    ],
    ...(live ? { factChecks: [{
      claim: '本地示例：如何查看一项公开信息的出处？',
      finding: empty
        ? '这是检索完成但依据不足的模拟状态。相关信息仍待补充可靠来源。'
        : '这里展示事实说明与来源链接的位置。链接指向公开文档，本次预览使用预先编写的内容，实际核查仍待真实调用验证。',
      status: 'uncertain', sourceUrls: empty ? [] : [PREVIEW_SOURCE.url],
    }] } : {}),
  };
}

export function previewProviderOutput(reading, { live = false, mode = 'completed', variant = 'standard' } = {}) {
  const empty = mode === 'web-empty';
  const answer = previewAnswer(reading, { live, empty, variant });
  const output = [];
  if (live && mode !== 'web-missing') {
    output.push({
      type: 'web_search_call', id: 'ws_local_synthetic', status: mode === 'web-failed' ? 'failed' : 'completed',
      action: { type: 'search', queries: ['local synthetic preview'], sources: empty || mode === 'web-failed' ? [] : [{ type: 'url', ...PREVIEW_SOURCE }] },
    });
  }
  // The URL also appears in the JSON answer. Annotation offsets deliberately
  // address serialized text, just as provider annotations do, not rendered DOM.
  const text = JSON.stringify(answer), start = text.indexOf(PREVIEW_SOURCE.url);
  output.push({ type: 'message', content: [{
    type: 'output_text', text,
    annotations: live && !empty && mode !== 'web-failed' && mode !== 'web-missing' && start >= 0
      ? [{ type: 'url_citation', ...PREVIEW_SOURCE, start_index: start, end_index: start + PREVIEW_SOURCE.url.length }]
      : [],
  }] });
  return output;
}

/** Stable IDs make repeated seeding additive and idempotent. */
export function previewRecords(now = new Date()) {
  const makeId = n => `25130000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const cases = [
    {
      question: '这次创作先从哪里开始？我想把最近整理的街道照片做成一本小册子，先试着找到一个能够连贯展开的主题，再决定需要补拍哪些画面。',
      interpretation: '本地示例：我注意到素材、节奏与取舍之间的联系，想先挑出一组色彩相近的照片。',
      reflection: '本地示例：做完第一版小样后，回看哪些照片真正推动了故事。',
      ageHours: 1, cards: 4, variants: ['standard', 'deep'],
    },
    {
      question: '我正在考虑怎样为下个月的学习与创作留出稳定时间并同时照顾现有工作节奏以及每天可以支配的精力，希望找到一个能长期坚持且方便根据反馈调整的安排方向',
      interpretation: '本地示例：先留下最容易坚持的一小段时间，观察一周内的实际感受。',
      reflection: '', ageHours: 27, cards: 3, variants: ['standard'],
    },
    { question: '', interpretation: '本地示例：留一份只有牌阵与个人想法的记录。', reflection: '', ageHours: 75, cards: 2, variants: [] },
  ];
  return cases.map((item, index) => {
    const savedAt = new Date(now.valueOf() - item.ageHours * 3600000).toISOString();
    const startedAt = new Date(new Date(savedAt).valueOf() - 20 * 60000).toISOString();
    const record = buildStoredRecord({
      schemaVersion: 1, id: makeId(index + 1), startedAt,
      question: item.question, interpretation: item.interpretation, reflection: item.reflection,
      spread: { type: 'free', name: '自由摆牌' }, randomness: { source: 'local' },
      cards: Array.from({ length: item.cards }, (_, i) => ({
        physicalId: i, sourceCardId: `major-${String(i).padStart(2, '0')}`, faceUp: true,
        reversed: i === 1, x: i % 2 ? 2 : -2, z: i < 2 ? -3 : -0.7,
        drawOrder: i + 1, zIndex: i + 1, positionLabel: ['已有资源', '需要留意', '可以尝试', '之后回看'][i],
      })),
    }, { savedAt, createdBy: 'local-ui-fixture' });
    record.aiInterpretations = item.variants.map((variant, i) => {
      const live = index === 0 && i === 1;
      const reading = structuredClone(record); delete reading.aiInterpretations; delete reading.randomness;
      reading.interpretation = ''; reading.reflection = '';
      const completedAt = new Date(new Date(savedAt).valueOf() - (item.variants.length - i) * 120000).toISOString();
      const attempt = {
        id: makeId(100 + index * 10 + i), status: 'completed', reading,
        model: i === 1 ? 'gpt-6.1-sol' : 'gpt-6.1-terra', returnedModel: i === 1 ? 'gpt-6.1-sol' : 'gpt-6.1-terra',
        detail: variant, focus: 'general', effort: 'low', maxOutputTokens: variant === 'deep' ? 6000 : 3000,
        createdAt: new Date(new Date(completedAt).valueOf() - 10000).toISOString(), completedAt,
        promptVersion: 'stage2.5.13-local-fixture', liveCheck: live,
        ...(live ? { timeZone: 'Australia/Melbourne', webCheck: { status: 'searched', checkedAt: completedAt, searchCalls: 1, sources: [{ ...PREVIEW_SOURCE }] } } : {}),
        answer: previewAnswer(reading, { live, variant }),
        usage: { inputTokens: 1100, outputTokens: 400, totalTokens: 1500, reasoningTokens: 50, cachedInputTokens: 0, cacheWriteTokens: 0 },
      };
      return publicInterpretation(attempt, now);
    });
    return record;
  });
}
