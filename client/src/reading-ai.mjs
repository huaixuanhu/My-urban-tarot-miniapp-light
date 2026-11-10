import { AI_MODELS, AI_EFFORTS, AI_DETAILS, AI_FOCUSES, AI_TOKEN_PRESETS, AI_MAX_OUTPUT_TOKENS, AI_DEFAULTS, aiCostHint, aiReadingSignature } from '../../shared/ai-options.mjs';
import { readingCard } from './reading-content.mjs';
import { createInterpretationsClient, createAIRequestState } from './reading-ai-data.mjs';
import { renderAIInterpretation, formatAISettings } from './reading-ai-render.mjs';
import { createHelpTip, disposeHelpTipsWithin } from './reading-help.mjs';

/** Optional interpretation: opening, typing and changing settings never call AI. */
export function createReadingAI({ root, getReading, getBusy, records, disclosures, client = createInterpretationsClient() }) {
  const doc = root.ownerDocument, view = doc.defaultView;
  const el = (tag, text = '', className = '') => {
    const node = doc.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
  };
  const button = (text, action, className = '') => {
    const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
  };
  const form = el('form', '', 'ai-form');
  const questionLabel = el('label', '你想问什么？', 'record-field');
  const question = el('textarea'); question.id = 'ai-question'; question.rows = 3; question.maxLength = 1500; question.required = true;
  question.placeholder = '写下问题…'; questionLabel.append(question);
  const preview = el('ol', '', 'ai-spread-preview'); preview.setAttribute('aria-label', '本次解读的牌');
  const previewHint = el('p', '', 'record-intro');
  const settings = el('div', '', 'ai-settings');
  const advanced = el('details', '', 'ai-advanced'); advanced.id = 'ai-advanced';
  advanced.append(el('summary', '高级'));
  const advancedSettings = el('div', '', 'ai-settings ai-advanced-settings'); advanced.append(advancedSettings);
  function selectField(labelText, id, options, help, container = settings) {
    const label = el('label', '', 'ai-setting'), select = el('select'); select.id = id; label.htmlFor = id;
    const caption = el('span', labelText, 'field-caption'); label.append(caption);
    select.setAttribute('aria-label', labelText);
    if (help) caption.append(createHelpTip(doc, { label: labelText, text: help, id: `${id}-help` }));
    for (const item of options) { const option = el('option', item.label); option.value = item.id; select.append(option); }
    label.append(select); container.append(label); return select;
  }
  const detail = selectField('解读详细度', 'ai-detail', AI_DETAILS, '简读抓住重点，标准展开主要联系，细读进一步讨论有依据的替代理解。篇幅与计算强度分别设置。'); detail.value = AI_DEFAULTS.detail;
  const focus = selectField('解读侧重', 'ai-focus', AI_FOCUSES, '先跟随你的问题。侧重只调整关注角度，其他类型的问题也可以正常解读；需要特别关注什么，直接写进问题即可。'); focus.value = AI_DEFAULTS.focus;
  const model = selectField('模型', 'ai-model', AI_MODELS); model.value = AI_DEFAULTS.model;
  const liveRow = el('div', '', 'ai-live-row');
  const liveLabel = el('label', '', 'ai-live-label'), liveCheck = el('input');
  liveCheck.type = 'checkbox'; liveCheck.id = 'ai-live-check'; liveCheck.checked = AI_DEFAULTS.liveCheck;
  liveLabel.append(liveCheck, el('span', '实时联网核查'));
  liveRow.append(liveLabel, createHelpTip(doc, { label: '实时联网核查', text: '勾选后，本次解读会搜索公开信息，并保留来源与核查时间。只提交必要的公开查询词。每次搜索 US$0.01，检索内容另按模型用量计费；等待时间可能增加。搜索结果可能仍有信息缺口。', id: 'ai-live-help' }));
  const effort = selectField('计算强度', 'ai-effort', AI_EFFORTS, '调节模型的分析投入；解读详细度决定回答如何展开。生成预算另设，较高强度可能需要更多预算。', advancedSettings); effort.value = AI_DEFAULTS.effort;
  const budget = selectField('生成预算', 'ai-budget', [...AI_TOKEN_PRESETS.map(value => ({ id: String(value), label: `${value.toLocaleString('en-US')} tokens` })), { id: 'custom', label: '自定义' }], 'Token 是模型处理文字的计量单位。这里限制推理与回答的合计用量，输入另计；预算不必用满，用尽时回答可能未完成。', advancedSettings); budget.value = String(AI_DEFAULTS.maxOutputTokens);
  const customLabel = el('label', '自定义上限', 'ai-setting ai-custom-budget');
  const custom = el('input'); custom.type = 'number'; custom.id = 'ai-custom-tokens'; custom.step = '1'; custom.max = String(AI_MAX_OUTPUT_TOKENS); custom.value = String(AI_DEFAULTS.maxOutputTokens); customLabel.append(custom); advancedSettings.append(customLabel);
  const costRow = el('div', '', 'ai-cost-row');
  const cost = el('span', '', 'ai-cost-hint'); cost.id = 'ai-cost-hint';
  costRow.append(cost, createHelpTip(doc, { label: '费用', text: '宽泛参考范围，按 OpenAI 实际用量计费。问题、牌义、推理和回答都会影响费用；不会自动再次生成。', id: 'ai-cost-help' }));
  const settingError = el('p', '', 'ai-setting-error'); settingError.id = 'ai-setting-error';
  custom.setAttribute('aria-describedby', settingError.id); budget.setAttribute('aria-describedby', settingError.id);
  advanced.append(settingError);
  const generate = el('button', '开始解读', 'record-primary'); generate.id = 'ai-generate'; generate.type = 'submit';
  const readiness = el('p', '', 'record-save-hint');
  const status = el('p', '', 'record-status ai-status'); status.id = 'ai-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const submitted = el('details', '', 'ai-request-snapshot'); submitted.hidden = true;
  const recover = button('查询本次结果', () => { request.recover().catch(() => {}); }, 'ai-recover'); recover.id = 'ai-recover'; recover.hidden = true;
  const continueUnknown = button('保留待确认结果并继续', () => {
    if (request.snapshot().status !== 'unknown' || request.inFlight) return;
    if (!view.confirm('这次请求可能已经产生费用。待确认的结果会留在本页，可继续查询；刷新或离开会丢失这个查询入口。仍要继续吗？')) return;
    archiveCurrentRequest(); update();
  }, 'ai-continue'); continueUnknown.id = 'ai-continue'; continueUnknown.hidden = true;
  const previous = el('section', '', 'ai-previous-attempts'); previous.hidden = true;
  const stale = el('p', '', 'ai-stale'); stale.hidden = true;
  const resultSelectLabel = el('label', '本次已生成的解读', 'ai-setting ai-result-picker');
  const resultSelect = el('select'); resultSelect.id = 'ai-result-picker'; resultSelectLabel.append(resultSelect); resultSelectLabel.hidden = true;
  const resultBody = el('div', '', 'ai-result-body');
  const saveLink = button('保存这次占卜与解读', () => records.openCurrent(), 'ai-save-link'); saveLink.id = 'ai-save-record'; saveLink.hidden = true;
  form.append(questionLabel, previewHint, preview, settings, liveRow, advanced, costRow, generate, readiness);
  root.append(form, status, submitted, recover, continueUnknown, previous, stale, resultSelectLabel, resultBody, saveLink);
  let disposed = false, results = [], displayedId = '', lastPreviewKey = '', lastResultKey = '', lastStatusKey = '', previousKey = '', submittedId = '';
  const previousRequests = [];
  function makeRequest() {
    const controller = createAIRequestState({ client, onChange: state => {
      if (disposed) return;
      if (state.status === 'completed' && state.interpretation && !results.some(item => item.id === state.interpretation.id)) {
        results.push(structuredClone(state.interpretation));
        // A late older result stays attached to its original question and spread.
        if (controller === request) displayedId = state.interpretation.id;
        records.setAIResults(results);
      }
      update();
    } });
    return controller;
  }
  let request = makeRequest();
  function archiveCurrentRequest() {
    previousRequests.push(request); request = makeRequest(); lastStatusKey = '';
  }
  const unfinished = () => [request, ...previousRequests].some(item => item.unresolved || item.inFlight);
  const processing = () => [request, ...previousRequests].some(item => item.inFlight || ['submitting', 'pending'].includes(item.snapshot().status));
  function updatePrevious() {
    const key = JSON.stringify(previousRequests.map(item => ({ state: item.snapshot(), busy: item.inFlight })));
    if (key === previousKey) return;
    previousKey = key; previous.hidden = !previousRequests.length; previous.replaceChildren();
    if (previousRequests.length) previous.append(el('h3', '保留的查询'));
    for (const item of previousRequests) {
      const state = item.snapshot(), row = el('div', '', 'ai-previous-attempt');
      row.append(el('p', state.payload?.reading?.question || '', 'record-prose'));
      row.append(el('p', state.status === 'completed' ? '已找回这次解读。' : state.message || '这次解读的结果仍待确认。', 'record-intro'));
      if (state.status === 'completed') row.append(button('查看这个结果', () => {
        if (!results.some(result => result.id === state.interpretation.id)) { results.push(structuredClone(state.interpretation)); records.setAIResults(results); }
        displayedId = state.interpretation.id; update();
      }));
      if (item.unresolved) {
        const lookup = button(item.inFlight ? '正在查询…' : '查询这个结果', () => item.recover().catch(() => {})); lookup.disabled = item.inFlight; row.append(lookup);
      }
      previous.append(row);
    }
  }

  const settingsValue = () => ({ model: model.value, detail: detail.value, focus: focus.value, effort: effort.value, maxOutputTokens: Number(budget.value === 'custom' ? custom.value : budget.value), liveCheck: liveCheck.checked,
    ...(liveCheck.checked ? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } : {}) });
  function settingsProblem() {
    const value = settingsValue(), strength = AI_EFFORTS.find(item => item.id === value.effort);
    if (!strength || !AI_MODELS.some(item => item.id === value.model)) return '请选择模型与计算强度。';
    if (!AI_DETAILS.some(item => item.id === value.detail) || !AI_FOCUSES.some(item => item.id === value.focus)) return '请选择解读详细度与侧重。';
    if (!Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens < strength.minimumTokens || value.maxOutputTokens > AI_MAX_OUTPUT_TOKENS) return `这个强度请选择 ${strength.minimumTokens.toLocaleString('en-US')}–${AI_MAX_OUTPUT_TOKENS.toLocaleString('en-US')} 之间的整数预算。`;
    return '';
  }
  function currentSignature() {
    try { return aiReadingSignature(records.getAIReading()); } catch { return null; }
  }
  function update() {
    if (disposed) return;
    const reading = getReading(), cards = Object.values(reading.placed).sort((a, b) => a.drawOrder - b.drawOrder), labels = records.getLabels();
    const allShown = cards.length > 0 && cards.every(card => card.faceUp), ready = allShown && !getBusy();
    if (question.value !== records.getQuestion()) question.value = records.getQuestion();
    question.disabled = records.locked;
    const key = JSON.stringify(cards.map(card => [card.id, card.faceUp, reading.reversed[card.id], labels[card.id] || '']));
    if (key !== lastPreviewKey) {
      lastPreviewKey = key; preview.replaceChildren();
      for (const [index, card] of cards.entries()) {
        const row = el('li'), text = card.faceUp ? `${readingCard(card.id).name} · ${reading.reversed[card.id] ? '逆位' : '正位'}` : '尚未翻开';
        row.append(el('span', `${index + 1} · ${text}`));
        const label = el('input'); label.type = 'text'; label.maxLength = 80; label.value = labels[card.id] || '';
        label.placeholder = '牌位含义 · 选填'; label.setAttribute('aria-label', `AI解读第 ${index + 1} 张的牌位含义`);
        // Keep focus while editing: external changes rebuild on the next update.
        label.addEventListener('input', () => {
          lastPreviewKey = JSON.stringify(cards.map(item => [item.id, item.faceUp, reading.reversed[item.id], item.id === card.id ? label.value : (records.getLabels()[item.id] || '')]));
          records.setLabel(card.id, label.value);
        });
        row.append(label); preview.append(row);
      }
    }
    for (const input of preview.querySelectorAll('input')) input.disabled = records.locked;
    previewHint.textContent = cards.length ? `牌阵 · ${cards.length} 张` : '';
    previewHint.hidden = !cards.length;
    const state = request.snapshot(), invalid = settingsProblem(), strength = AI_EFFORTS.find(item => item.id === effort.value);
    if ((state.payload?.id || '') !== submittedId) {
      submittedId = state.payload?.id || ''; submitted.replaceChildren(); submitted.hidden = !state.payload;
      if (state.payload) {
        submitted.append(el('summary', '本次提交'), el('p', state.payload.reading.question, 'ai-answer-question'), el('p', `${formatAISettings(state.payload)} · ${state.payload.maxOutputTokens.toLocaleString('en-US')} tokens`, 'ai-answer-meta'));
        const list = el('ol');
        for (const card of state.payload.reading.cards) list.append(el('li', `${readingCard(card.physicalId).name} · ${card.reversed ? '逆位' : '正位'}${card.positionLabel ? ` · ${card.positionLabel}` : ''}`));
        submitted.append(list);
      }
    }
    custom.min = String(strength?.minimumTokens || 1000); customLabel.hidden = budget.value !== 'custom'; custom.required = budget.value === 'custom';
    for (const input of [model, detail, focus, liveCheck, effort, budget, custom]) input.disabled = request.unresolved || processing() || records.locked;
    settingError.textContent = invalid; settingError.hidden = !invalid; if (invalid) advanced.open = true; custom.setAttribute('aria-invalid', String(!!invalid));
    cost.textContent = aiCostHint(model.value, effort.value, liveCheck.checked);
    generate.disabled = !ready || !question.value.trim() || !!invalid || request.unresolved || processing() || records.locked || results.length >= 10;
    generate.textContent = request.inFlight ? '正在解读…' : state.payload || previousRequests.length ? '再次解读' : '开始解读';
    readiness.textContent = request.unresolved ? '' : results.length >= 10 ? '已有10份解读，请保存后开始新的占卜。' : !cards.length ? '先抽牌并翻开。' : !allShown ? '翻开所有牌后可解读。' : getBusy() ? '等待翻牌完成。' : !question.value.trim() ? '写下问题后可解读。' : '';
    readiness.hidden = !readiness.textContent;
    const statusKey = `${state.status}:${state.message || ''}`;
    if (statusKey !== lastStatusKey) {
      lastStatusKey = statusKey;
      const messages = {
        idle: '', submitting: '正在解读…',
        pending: '解读处理中，可查询进度。',
        completed: '解读已完成。可与你自己的想法一起保存。',
        incomplete: '生成预算用尽或回答未完成。本次没有完整解读；再次尝试会产生新的费用。',
        failed: '这次未能完成解读。你的问题与牌阵仍保留。',
        unknown: '暂时无法确认本次结果。请查询状态；不要重复生成。',
      };
      status.textContent = state.message || messages[state.status] || '';
      status.classList.toggle('is-error', ['failed', 'unknown', 'incomplete'].includes(state.status));
      status.classList.toggle('sr-only', state.status === 'completed');
    }
    root.setAttribute('aria-busy', String(request.inFlight)); recover.hidden = !request.unresolved; recover.disabled = request.inFlight;
    recover.textContent = request.inFlight ? '正在查询…' : '查询本次结果';
    continueUnknown.hidden = state.status !== 'unknown' || request.inFlight;
    updatePrevious();
    const displayed = results.find(item => item.id === displayedId) || results.at(-1);
    if (resultSelect.options.length !== results.length) {
      resultSelect.replaceChildren();
      for (const [i, item] of results.entries()) {
        const option = el('option', `${i + 1} · ${formatAISettings(item)}`); option.value = item.id; resultSelect.append(option);
      }
    }
    resultSelectLabel.hidden = results.length < 2;
    if (displayed) resultSelect.value = displayed.id;
    const resultKey = displayed?.id || '';
    if (resultKey !== lastResultKey) { lastResultKey = resultKey; disposeHelpTipsWithin(resultBody); resultBody.replaceChildren(); if (displayed) resultBody.append(renderAIInterpretation(doc, displayed)); }
    const isStale = !!displayed && aiReadingSignature(displayed.reading) !== currentSignature();
    stale.hidden = !isStale;
    stale.textContent = '牌阵或问题已更新，下方为先前的解读。';
    saveLink.hidden = !displayed || isStale;
    saveLink.disabled = records.locked || request.inFlight;
  }
  question.addEventListener('input', () => records.setQuestion(question.value));
  effort.addEventListener('change', () => { const target = AI_EFFORTS.find(item => item.id === effort.value)?.suggestedTokens; if (target) { budget.value = String(target); custom.value = String(target); } update(); });
  for (const input of [model, detail, focus, liveCheck, budget, custom]) input.addEventListener(input === custom ? 'input' : 'change', update);
  resultSelect.addEventListener('change', () => { displayedId = resultSelect.value; update(); });
  form.addEventListener('submit', event => {
    event.preventDefault(); update(); if (generate.disabled) return;
    if (previousRequests.some(item => item.unresolved)) {
      if (!view.confirm('上次状态仍未确认，可能已产生费用。这次会提交新的解读并另行计费，继续吗？')) return;
    } else if (request.snapshot().payload && !view.confirm('这会重新调用AI并产生新的费用。已有解读会保留，继续吗？')) return;
    const id = crypto.randomUUID();
    const payload = { id, reading: records.getAIReading(id), ...settingsValue() };
    request.generate(payload).catch(() => {});
  });
  const unsubscribe = records.subscribe(update);
  const onOpen = event => { if (event.detail.id === 'reading-ai' && event.detail.open) update(); };
  doc.addEventListener('reading:disclosurechange', onOpen);
  const beforeUnload = event => { if (unfinished()) { event.preventDefault(); event.returnValue = ''; } };
  view.addEventListener('beforeunload', beforeUnload);
  update();
  return {
    update,
    mayReset() {
      if (request.unresolved || processing()) { disclosures.open('reading-ai'); status.textContent = '请先查询并确认本次解读的结果，再重洗。结果待确认时，也可以选择保留查询入口后继续。'; return false; }
      return true;
    },
    reset() {
      if (request.unresolved || processing()) return;
      request.reset(); results = []; displayedId = ''; lastResultKey = ''; lastPreviewKey = ''; lastStatusKey = ''; disposeHelpTipsWithin(resultBody); resultBody.replaceChildren(); resultSelect.replaceChildren(); update();
    },
    dispose() { disposed = true; unsubscribe(); request.dispose(); previousRequests.forEach(item => item.dispose()); disposeHelpTipsWithin(root); doc.removeEventListener('reading:disclosurechange', onOpen); view.removeEventListener('beforeunload', beforeUnload); },
  };
}
