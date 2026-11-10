import { randomSourceLabel } from '../../shared/random-provenance.mjs';
import { readingCard } from './reading-content.mjs';
import { readingCardImage } from './reading-art.mjs';
import { captureRecord, createSaveAttempt, createRecordsClient } from './reading-record-data.mjs';
import { aiReadingSignature } from '../../shared/ai-options.mjs';
import { renderAIInterpretation, formatAISettings } from './reading-ai-render.mjs';
import { recordAccessContext, recordDisplayTitle, recordDay } from './reading-record-view.mjs';
import { createHelpTip, disposeHelpTipsWithin } from './reading-help.mjs';

export function createReadingRecords({ root, getReading, getBusy, disclosures, client = createRecordsClient(), accessContext }) {
  const doc = root.ownerDocument;
  const access = recordAccessContext(accessContext);
  const el = (tag, text = '', className = '') => {
    const node = doc.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
  };
  const button = (text, action, className = '') => {
    const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
  };
  const replaceContent = (container, ...children) => { disposeHelpTipsWithin(container); container.replaceChildren(...children); };
  const date = value => new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tabs = el('nav', '', 'record-navigation'); tabs.setAttribute('aria-label', '占卜记录视图');
  const currentTab = button('记录这次占卜', () => { show('current'); root.scrollTop = 0; });
  const historyTab = button(access.label, () => { show('history'); loadList(); root.scrollTop = 0; });
  currentTab.hidden = !access.cloudRecords;
  tabs.append(historyTab, currentTab);
  const status = el('p', '', 'record-status'); status.setAttribute('role', 'status');
  const current = el('section', '', 'record-current');
  const history = el('section', '', 'record-history');
  const detail = el('section', '', 'record-detail');
  root.append(tabs, current, history, detail, status);
  let mode = 'history', saving = false, disposed = false, listRequest = 0, detailRequest = 0;
  let explicitEntry = false, historyScroll = 0, historyOrigin = null, listLoading = false;
  const historyDays = new Map(), historyIds = new Set();
  let roundStartedAt = new Date().toISOString(), attempt = createSaveAttempt(), savedSignature = '';
  let lastCardsKey = null, currentSavedId = null, noteChanged = false;
  const draftListeners = new Set();
  let aiResults = [], aiChoiceKey = '';
  const includedAI = new Set();
  const form = el('form');
  const field = (label, id, max, rows, placeholder) => {
    const wrap = el('label', label, 'record-field'), input = el('textarea');
    input.id = id; input.maxLength = max; input.rows = rows; input.placeholder = placeholder;
    wrap.append(input); form.append(wrap);
    input.addEventListener('input', () => { noteChanged = true; update(); });
    return input;
  };
  const question = field('这次的问题 · 选填', 'record-question', 1500, 2, '此刻，你想了解什么？');
  const cardSummary = el('p', '', 'record-intro');
  const cardRows = el('ol', '', 'record-card-fields');
  form.append(cardSummary, cardRows);
  const interpretation = field('我的解读 · 选填', 'record-interpretation', 8000, 3, '这几张牌，让你联想到了什么？');
  const reflection = field('留给之后的自己 · 选填', 'record-reflection', 8000, 2, '想记住的感受、行动或疑问');
  const aiChoices = el('fieldset', '', 'record-ai-choices'); aiChoices.hidden = true;
  const save = el('button', '保存到共享记录', 'record-primary'); save.type = 'submit';
  const saveHint = el('p', '', 'record-save-hint');
  form.append(aiChoices, save, saveHint); current.append(form);
  const labels = {};
  const signature = snapshot => JSON.stringify({ ...snapshot, id: '', startedAt: '' });
  function draft(id = crypto.randomUUID()) {
    const snapshot = captureRecord(getReading(), { id, startedAt: roundStartedAt, question: question.value, interpretation: interpretation.value, reflection: reflection.value, labels });
    const ids = matchingAI(snapshot).filter(result => includedAI.has(result.id)).map(result => result.id);
    if (ids.length) snapshot.aiInterpretationIds = ids;
    return snapshot;
  }
  function matchingAI(snapshot) {
    const expected = aiReadingSignature(snapshot);
    return aiResults.filter(result => result.status === 'completed' && aiReadingSignature(result.reading) === expected);
  }
  function message(text, error = false) { status.textContent = text; status.classList.toggle('is-error', error); }
  function show(next) {
    if (!access.cloudRecords) next = 'history';
    if (next !== 'detail') detailRequest++;
    if (next !== 'history') {
      listRequest++; listLoading = false; history.setAttribute('aria-busy', 'false');
      const more = history.querySelector('.record-load-more');
      if (more) { more.disabled = false; more.textContent = '加载更多'; }
    }
    mode = next; current.hidden = next !== 'current'; history.hidden = next !== 'history'; detail.hidden = next !== 'detail';
    currentTab.setAttribute('aria-pressed', String(next === 'current'));
    historyTab.setAttribute('aria-pressed', String(next !== 'current'));
    if (next === 'current') update();
  }
  function update() {
    if (disposed) return;
    const reading = getReading(), cards = Object.values(reading.placed).sort((a, b) => a.drawOrder - b.drawOrder);
    const ready = cards.length > 0 && cards.every(card => card.faceUp) && !getBusy();
    const key = cards.map(card => `${card.id}:${card.faceUp}:${reading.reversed[card.id]}:${card.drawOrder}`).join('|');
    if (key !== lastCardsKey) {
      lastCardsKey = key; cardRows.replaceChildren();
      cards.forEach((card, index) => {
        const row = el('li'), name = el('span', `${index + 1} · ${card.faceUp ? `${readingCard(card.id).name} · ${reading.reversed[card.id] ? '逆位' : '正位'}` : '尚未翻开'}`);
        const input = el('input'); input.type = 'text'; input.maxLength = 80;
        input.setAttribute('aria-label', `第 ${index + 1} 张的牌位含义`); input.placeholder = '牌位含义 · 选填'; input.value = labels[card.id] || '';
        input.addEventListener('input', () => { labels[card.id] = input.value; noteChanged = true; update(); });
        row.append(name, input); cardRows.append(row);
      });
    }
    cardSummary.textContent = cards.length ? `自由摆牌 · ${cards.length} 张` : '先抽牌并翻开。';
    let unchanged = false;
    if (ready && savedSignature) unchanged = signature(draft()) === savedSignature;
    save.disabled = !access.cloudRecords || saving || (!attempt.pending && (!ready || unchanged));
    save.textContent = saving ? '正在保存…' : attempt.pending ? '确认并重试保存' : unchanged ? '已保存到共享记录' : currentSavedId ? '保存为新记录' : '保存到共享记录';
    saveHint.textContent = attempt.pending ? '上次保存结果尚未确认。重试会核对同一份内容，避免重复记录。' : !ready && cards.length ? '翻开所有桌上的牌后即可保存。' : '';
    saveHint.hidden = !saveHint.textContent;
    for (const input of form.querySelectorAll('textarea,input')) input.disabled = saving || attempt.pending;
    const available = ready ? matchingAI(draft()) : [];
    const choiceKey = available.map(result => result.id).join('|');
    if (choiceKey !== aiChoiceKey) {
      aiChoiceKey = choiceKey; aiChoices.replaceChildren();
      aiChoices.hidden = !available.length;
      if (available.length) aiChoices.append(el('legend', '同时保存AI解读'));
      for (const result of available) {
        const label = el('label'), input = el('input'); input.type = 'checkbox'; input.checked = includedAI.has(result.id);
        input.addEventListener('change', () => { input.checked ? includedAI.add(result.id) : includedAI.delete(result.id); noteChanged = true; update(); });
        label.append(input, el('span', `${formatAISettings(result)} · ${date(result.completedAt || result.createdAt)}`)); aiChoices.append(label);
      }
    }
    for (const input of aiChoices.querySelectorAll('input')) input.disabled = saving || attempt.pending;
    for (const listener of draftListeners) listener();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!access.cloudRecords || save.disabled) return;
    let snapshot;
    try { snapshot = attempt.snapshot() || attempt.prepare(draft()); }
    catch (error) { message(error.message, true); return; }
    saving = true; update(); message('正在保存到共享记录…');
    try {
      const { record } = await client.save(snapshot);
      if (disposed) return;
      currentSavedId = record.id; savedSignature = signature(snapshot); attempt.complete();
      // A concurrently completed AI request can add a result after this save
      // snapshot was frozen. Keep that unsaved addition visible to reset/unload.
      try { noteChanged = signature(draft()) !== savedSignature; } catch { noteChanged = true; }
      message('已保存。');
    } catch (error) { if (error.definite) attempt.complete(); if (!disposed) message(error.message, true); }
    finally { saving = false; if (!disposed) { update(); if (mode === 'current') status.scrollIntoView({ block: 'nearest' }); } }
  });
  function renderGuest() {
    const entry = el('div', '', 'record-meta-with-help');
    entry.append(button('登录与记录', () => { message('账号登录尚未接入。'); }, 'record-guest-entry'), createHelpTip(doc, {
      label: '访客记录', text: '账号登录尚未接入。当前访客预览只保留本页的占卜，离开页面后清空；云端记录不在访客预览中读取或保存。', id: 'record-guest-help',
    }));
    replaceContent(history, entry);
  }
  async function loadList(cursor = '') {
    if (!access.cloudRecords) { renderGuest(); return; }
    if (cursor && listLoading) return;
    const request = ++listRequest; listLoading = true; history.setAttribute('aria-busy', 'true');
    const more = history.querySelector('.record-load-more');
    if (more) { more.disabled = true; more.textContent = '正在读取…'; }
    if (!cursor) {
      historyDays.clear(); historyIds.clear(); historyOrigin = null;
      replaceContent(history, el('p', '正在读取共享记录…', 'record-intro'));
    }
    message('');
    try {
      const data = await client.list(cursor);
      if (disposed || request !== listRequest || mode !== 'history') return;
      if (!cursor) replaceContent(history);
      history.querySelector('.record-load-more')?.remove();
      if (!data.records.length && !cursor) history.append(el('p', '还没有保存的占卜。', 'record-empty'));
      for (const record of [...data.records].sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id))) {
        if (historyIds.has(record.id)) continue;
        historyIds.add(record.id);
        const day = recordDay(record.savedAt);
        if (!historyDays.has(day.key)) {
          const group = el('section', '', 'record-day-group');
          group.setAttribute('aria-label', day.label); group.append(el('h3', day.label, 'record-day-heading'));
          historyDays.set(day.key, group); history.append(group);
        }
        const row = button('', () => loadDetail(record.id, row), 'record-history-row');
        row.setAttribute('data-record-id', record.id);
        const time = el('time', day.time, 'record-date'); time.dateTime = record.savedAt;
        row.append(time, el('strong', recordDisplayTitle(record.question), 'record-title'), el('span', '›', 'record-row-arrow'));
        row.querySelector('.record-row-arrow').setAttribute('aria-hidden', 'true');
        historyDays.get(day.key).append(row);
      }
      if (data.nextCursor) history.append(button('加载更多', () => loadList(data.nextCursor), 'record-load-more'));
    } catch (error) {
      if (disposed || request !== listRequest || mode !== 'history') return;
      if (!cursor) replaceContent(history, el('p', error.message, 'record-empty'), button('重新读取', () => loadList()));
      else { message(error.message, true); if (more) { more.disabled = false; more.textContent = '重新读取更多'; } }
    } finally {
      if (!disposed && request === listRequest) { listLoading = false; history.setAttribute('aria-busy', 'false'); }
    }
  }
  function returnToHistory() {
    show('history'); message(''); root.scrollTop = historyScroll;
    (historyOrigin || historyTab).focus?.({ preventScroll: true });
  }
  const backButton = () => button('← 返回记录', returnToHistory, 'record-back');
  async function loadDetail(id, origin) {
    if (!access.cloudRecords) { renderGuest(); return; }
    if (mode === 'history') { historyScroll = root.scrollTop || 0; historyOrigin = origin || null; }
    show('detail'); const request = ++detailRequest;
    replaceContent(detail, backButton(), el('p', '正在打开这次占卜…', 'record-intro'));
    detail.setAttribute('aria-busy', 'true'); root.scrollTop = 0;
    detail.tabIndex = -1; detail.focus?.({ preventScroll: true }); message('');
    try {
      const { record } = await client.get(id);
      if (disposed || request !== detailRequest || mode !== 'detail') return;
      replaceContent(detail, backButton());
      const title = recordDisplayTitle(record.question);
      detail.append(el('p', `${date(record.savedAt)} · ${record.spread.name} · ${record.cards.length} 张`, 'record-intro'), el('h3', title, 'record-detail-title'));
      if (record.question && record.question !== title) detail.append(el('p', record.question, 'record-prose record-full-question'));
      const randomSource = el('div', randomSourceLabel(record.randomness), 'record-intro record-meta-with-help');
      if (record.randomness?.source === 'anu') randomSource.append(createHelpTip(doc, {
        label: '本次量子随机来源', text: `这批数据获取于 ${date(record.randomness.fetchedAt)}；本次洗牌消耗 ${record.randomness.consumed} 个随机数。`, id: `record-random-help-${record.id}`,
      }));
      detail.append(randomSource);
      const map = el('div', '', 'record-spread'); map.setAttribute('aria-label', '保存时的牌阵位置');
      const cards = [...record.cards].sort((a, b) => a.drawOrder - b.drawOrder);
      // Fixed table-relative coordinates retain relative placement and overlap.
      for (const card of [...cards].sort((a, b) => a.zIndex - b.zIndex)) {
        const image = el('img'); image.src = readingCardImage(card.physicalId); image.alt = card.sourceSnapshot.name;
        image.style.left = `${((card.x + 7.5) / 15) * 100}%`;
        image.style.top = `${((card.z + 5.7) / 7.6) * 100}%`;
        if (card.reversed) image.classList.add('is-reversed'); map.append(image);
      }
      detail.append(map);
      for (const [label, text] of [['我的解读', record.interpretation], ['留给之后的自己', record.reflection]]) {
        if (text) detail.append(el('h4', label), el('p', text, 'record-prose'));
      }
      if (record.aiInterpretations?.length) {
        const answers = record.aiInterpretations;
        const answerBody = el('div', '', 'record-ai-body');
        const renderAnswer = index => replaceContent(answerBody, renderAIInterpretation(doc, answers[index], { showQuestion: false }));
        if (answers.length > 1) {
          const label = el('label', 'AI 解读版本', 'record-ai-picker'), select = el('select');
          select.setAttribute('aria-label', 'AI 解读版本');
          answers.forEach((answer, index) => {
            const option = el('option', `${index + 1} · ${formatAISettings(answer)} · ${date(answer.completedAt || answer.createdAt)}`);
            option.value = String(index); select.append(option);
          });
          select.value = '0'; select.addEventListener('change', () => renderAnswer(Number(select.value)));
          label.append(select); detail.append(label);
        }
        renderAnswer(0); detail.append(answerBody);
      }
      const sources = el('details', '', 'record-source-details');
      sources.append(el('summary', `原始牌义与画面 · ${cards.length} 张`));
      if (cards.some(card => card.reversed)) {
        const reversal = el('div', '逆位资料', 'record-intro record-meta-with-help');
        reversal.append(createHelpTip(doc, { label: '逆位资料', text: '原版资料没有单独的逆位牌义。这里保留原始基础说明；附带 AI 解读时，逆位延伸会单独标注。', id: `record-reversal-help-${record.id}` }));
        sources.append(reversal);
      }
      const ordered = el('ol', '', 'record-saved-cards');
      cards.forEach((card, index) => {
        const row = el('li'), disclosure = el('details'), summary = el('summary', `${index + 1} · ${card.sourceSnapshot.name} · ${card.reversed ? '逆位' : '正位'}${card.positionLabel ? ` · ${card.positionLabel}` : ''}`);
        disclosure.append(summary, el('p', card.sourceSnapshot.theme, 'record-theme'));
        const meaning = el('p', card.sourceSnapshot.interpretation); meaning.lang = 'en'; disclosure.append(meaning);
        const imagery = el('p', card.sourceSnapshot.urbanImagery); imagery.lang = 'en'; disclosure.append(imagery);
        row.append(disclosure); ordered.append(row);
      });
      sources.append(ordered); detail.append(sources);
      detail.append(button('导出这条记录', () => {
        const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = `augurwell-${record.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }));
    } catch (error) {
      if (!disposed && request === detailRequest && mode === 'detail') replaceContent(detail, backButton(), el('p', error.message, 'record-empty'), button('重新打开', () => loadDetail(id)));
    } finally { if (!disposed && request === detailRequest) detail.setAttribute('aria-busy', 'false'); }
  }
  function onOpen(event) {
    if (event.detail.id !== 'reading-records' || !event.detail.open || explicitEntry) return;
    update(); show('history'); root.scrollTop = 0; loadList();
  }
  function openCurrent() {
    show('current'); root.scrollTop = 0;
    if (!access.cloudRecords) renderGuest();
    explicitEntry = true;
    try { disclosures.open('reading-records'); } finally { explicitEntry = false; }
  }
  doc.addEventListener('reading:disclosurechange', onOpen);
  const unsaved = () => noteChanged || attempt.pending || saving;
  function beforeUnload(event) { if (unsaved()) { event.preventDefault(); event.returnValue = ''; } }
  window.addEventListener('beforeunload', beforeUnload);
  show('history'); update();
  if (!access.cloudRecords) renderGuest();
  return {
    update,
    getQuestion: () => question.value,
    setQuestion(value) {
      if (saving || attempt.pending) return;
      if (question.value !== value) { question.value = value; noteChanged = true; update(); }
    },
    setLabel(id, value) {
      if (saving || attempt.pending) return;
      if (labels[id] !== value) { labels[id] = value; lastCardsKey = null; noteChanged = true; update(); }
    },
    getLabels: () => ({ ...labels }),
    getAIReading(id = crypto.randomUUID()) {
      const result = draft(id); result.interpretation = ''; result.reflection = ''; delete result.aiInterpretationIds; return result;
    },
    get locked() { return saving || attempt.pending; },
    subscribe(listener) { draftListeners.add(listener); return () => draftListeners.delete(listener); },
    setAIResults(results) {
      const previousIds = new Set(aiResults.map(result => result.id));
      aiResults = structuredClone(results).slice(-10);
      for (const result of aiResults) if (!previousIds.has(result.id)) includedAI.add(result.id);
      aiChoiceKey = ''; noteChanged = true; update();
    },
    openCurrent,
    openHistory() {
      show('history'); root.scrollTop = 0; loadList(); explicitEntry = true;
      try { disclosures.open('reading-records'); } finally { explicitEntry = false; }
    },
    mayReset() {
      if (saving || attempt.pending) { openCurrent(); message('请先确认这条记录的保存结果，再重洗。', true); return false; }
      return !unsaved() || window.confirm('这次的文字还没有保存。仍要重洗并清空这些文字吗？');
    },
    reset() {
      question.value = interpretation.value = reflection.value = ''; Object.keys(labels).forEach(key => delete labels[key]);
      roundStartedAt = new Date().toISOString(); savedSignature = ''; currentSavedId = null; noteChanged = false; attempt = createSaveAttempt(); lastCardsKey = null; message('');
      aiResults = []; includedAI.clear(); aiChoiceKey = ''; aiChoices.replaceChildren(); aiChoices.hidden = true;
      update();
      root.scrollTop = 0;
    },
    dispose() { disposed = true; listRequest++; detailRequest++; draftListeners.clear(); disposeHelpTipsWithin(root); doc.removeEventListener('reading:disclosurechange', onOpen); window.removeEventListener('beforeunload', beforeUnload); },
  };
}
