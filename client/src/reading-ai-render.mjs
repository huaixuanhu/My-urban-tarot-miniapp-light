import { AI_MODELS, AI_EFFORTS } from '../../shared/ai-options.mjs';

/** Model text is always text content, never HTML or executable Markdown. */
export function renderAIInterpretation(document, result, { heading = 'AI解读' } = {}) {
  const el = (tag, text = '', className = '') => {
    const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
  };
  const section = el('section', '', 'ai-answer');
  const model = AI_MODELS.find(item => item.id === result.model)?.label || result.model;
  const effort = AI_EFFORTS.find(item => item.id === result.effort)?.label || result.effort;
  section.append(el('h3', heading), el('p', `${model} · ${effort} · ${new Date(result.completedAt || result.createdAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 'ai-answer-meta'));
  section.append(el('p', result.reading?.question || '', 'ai-answer-question'));
  if (result.status !== 'completed' || !result.answer) {
    section.append(el('p', result.message || '本次解读未完成。', 'record-status'));
    return section;
  }
  section.append(el('p', result.answer.summary, 'record-prose'));
  const ordered = el('ol', '', 'ai-answer-cards');
  for (const card of result.answer.cards) {
    const source = result.reading.cards.find(item => item.sourceCardId === card.sourceCardId);
    const row = el('li');
    const name = source?.sourceSnapshot?.name || source?.name || card.sourceCardId;
    row.append(el('h4', `${name} · ${card.reversed ? '逆位' : '正位'}${card.positionLabel ? ` · ${card.positionLabel}` : ''}`), el('p', card.interpretation, 'record-prose'));
    if (card.basis) {
      const basis = card.basis === 'provided_meaning' ? '依据原始牌义'
        : card.basis === 'generated_reversal_extension' ? '逆位：基于原始牌义的延伸解释'
          : '结合本次牌面与问题的解释';
      row.append(el('p', basis, 'ai-answer-notes'));
    }
    ordered.append(row);
  }
  section.append(ordered);
  if (result.answer.reflectionQuestions?.length) {
    section.append(el('h4', '留给自己的问题'));
    const questions = el('ul', '', 'ai-reflections');
    for (const text of result.answer.reflectionQuestions) questions.append(el('li', text));
    section.append(questions);
  }
  if (result.answer.limitations?.length) {
    const notes = el('div', '', 'ai-answer-notes');
    for (const text of result.answer.limitations) notes.append(el('p', text));
    section.append(notes);
  }
  if (result.usage) {
    section.append(el('p', `实际用量：输入 ${result.usage.inputTokens ?? '—'} · 生成 ${result.usage.outputTokens ?? '—'} tokens`, 'ai-answer-meta'));
  }
  return section;
}
