import { AI_MODELS, AI_EFFORTS, AI_DETAILS, AI_FOCUSES } from '../../shared/ai-options.mjs';
import { normalizeSourceUrl } from '../../shared/ai-web.mjs';
import { createHelpTip } from './reading-help.mjs';

/** Keep older results honest: missing presets were not selected at generation. */
export function formatAISettings(result) {
  return [
    AI_MODELS.find(item => item.id === result.model)?.label || result.model,
    AI_DETAILS.find(item => item.id === result.detail)?.label,
    AI_FOCUSES.find(item => item.id === result.focus)?.label,
    result.effort ? `计算·${AI_EFFORTS.find(item => item.id === result.effort)?.label || result.effort}` : null,
    typeof result.liveCheck === 'boolean' ? (result.liveCheck ? '实时核查' : '未联网') : null,
  ].filter(Boolean).join(' · ');
}

/** Model text is always text content, never HTML or executable Markdown. */
export function renderAIInterpretation(document, result, { heading = 'AI解读', showQuestion = true } = {}) {
  const el = (tag, text = '', className = '') => {
    const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
  };
  const section = el('section', '', 'ai-answer');
  const title = el('h3', heading);
  if (result.answer?.limitations?.length) title.append(createHelpTip(document, { label: '解读补充', text: result.answer.limitations.join('\n\n') }));
  const meta = el('p', `${formatAISettings(result)} · ${new Date(result.completedAt || result.createdAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 'ai-answer-meta');
  if (result.usage) meta.append(createHelpTip(document, { label: '实际用量', text: `输入 ${result.usage.inputTokens ?? '—'} · 生成 ${result.usage.outputTokens ?? '—'} tokens${result.webCheck?.searchCalls ? ` · 搜索 ${result.webCheck.searchCalls} 次` : ''}` }));
  section.append(title, meta);
  if (showQuestion) section.append(el('p', result.reading?.question || '', 'ai-answer-question'));
  if (result.liveCheck === true) {
    const check = result.webCheck;
    const verifiedSearch = check?.status === 'searched' && Number.isSafeInteger(check.searchCalls) && check.searchCalls > 0;
    const web = el('section', '', 'ai-web-check');
    web.append(el('h4', '现实信息核查'));
    const checkedDate = typeof check?.checkedAt === 'string' && Number.isFinite(Date.parse(check.checkedAt))
      ? new Date(check.checkedAt).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '';
    web.append(el('p', verifiedSearch ? `已执行联网搜索${checkedDate ? ` · ${checkedDate}` : ''}` : '联网核查未完成', 'ai-web-status'));
    const sources = new Map((Array.isArray(check?.sources) ? check.sources : []).filter(source => normalizeSourceUrl(source?.url)).map(source => [normalizeSourceUrl(source.url), source]));
    const facts = verifiedSearch && result.status === 'completed' && Array.isArray(result.answer?.factChecks) ? result.answer.factChecks : [];
    for (const fact of facts) {
      const row = el('div', '', 'ai-fact');
      const label = { supported: '来源支持', disputed: '发现相反依据', uncertain: '依据待补充' }[fact.status] || '依据待补充';
      row.append(el('p', fact.claim, 'ai-fact-claim'), el('span', label, `ai-fact-status is-${fact.status}`), el('p', fact.finding, 'record-prose'));
      const links = el('div', '', 'ai-fact-sources');
      for (const [index, rawUrl] of (fact.sourceUrls || []).entries()) {
        const url = normalizeSourceUrl(rawUrl), source = url && sources.get(url);
        if (!source) continue;
        const link = el('a', `${index + 1}. ${source.title || new URL(url).hostname}`);
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
        links.append(link);
      }
      row.append(links); web.append(row);
    }
    if (verifiedSearch && result.status === 'completed' && !facts.length) web.append(el('p', '暂无可引用的核查结论', 'record-intro'));
    section.append(web);
  }
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
    const cardTitle = el('h4', `${name} · ${card.reversed ? '逆位' : '正位'}${card.positionLabel ? ` · ${card.positionLabel}` : ''}`);
    if (card.basis) {
      const basis = card.basis === 'provided_meaning' ? '依据原始牌义'
        : card.basis === 'generated_reversal_extension' ? '逆位：基于原始牌义的延伸解释'
          : '结合本次牌面与问题的解释';
      cardTitle.append(createHelpTip(document, { label: `${name} 解读依据`, text: basis }));
    }
    row.append(cardTitle, el('p', card.interpretation, 'record-prose'));
    ordered.append(row);
  }
  section.append(ordered);
  if (result.answer.reflectionQuestions?.length) {
    section.append(el('h4', '留给自己的问题'));
    const questions = el('ul', '', 'ai-reflections');
    for (const text of result.answer.reflectionQuestions) questions.append(el('li', text));
    section.append(questions);
  }
  return section;
}
