import { readingCard } from './reading-content.mjs';
import { readingCardImage } from './reading-art.mjs';
import { captureRecord, createSaveAttempt, createRecordsClient } from './reading-record-data.mjs';

export function createReadingRecords({ root, getReading, getBusy, disclosures, client = createRecordsClient() }) {
  const doc = root.ownerDocument;
  const el = (tag, text = '', className = '') => {
    const node = doc.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
  };
  const button = (text, action, className = '') => {
    const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
  };
  const date = value => new Date(value).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tabs = el('nav', '', 'record-navigation'); tabs.setAttribute('aria-label', '占卜记录视图');
  const currentTab = button('这次占卜', () => show('current'));
  const historyTab = button('共享记录', () => { show('history'); loadList(); });
  tabs.append(currentTab, historyTab);
  const status = el('p', '', 'record-status'); status.setAttribute('role', 'status');
  const current = el('section', '', 'record-current');
  const history = el('section', '', 'record-history');
  const detail = el('section', '', 'record-detail');
  root.append(tabs, current, history, detail, status);
  let mode = 'current', saving = false, disposed = false, listRequest = 0, detailRequest = 0;
  let roundStartedAt = new Date().toISOString(), attempt = createSaveAttempt(), savedSignature = '';
  let lastCardsKey = null, currentSavedId = null, noteChanged = false;
  const intro = el('p', '保存牌阵与此刻的想法，与你的伙伴一起回看。', 'record-intro');
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
  const save = el('button', '保存到共享记录', 'record-primary'); save.type = 'submit';
  const saveHint = el('p', '', 'record-save-hint');
  form.append(save, saveHint); current.append(intro, form);
  const labels = {};
  const signature = snapshot => JSON.stringify({ ...snapshot, id: '', startedAt: '' });
  function draft(id = crypto.randomUUID()) {
    return captureRecord(getReading(), { id, startedAt: roundStartedAt, question: question.value, interpretation: interpretation.value, reflection: reflection.value, labels });
  }
  function message(text, error = false) { status.textContent = text; status.classList.toggle('is-error', error); }
  function show(next) {
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
    cardSummary.textContent = cards.length ? `自由摆牌 · ${cards.length} 张 · 保存抽取顺序、位置与正逆位` : '先从牌带抽出属于这次占卜的牌。';
    let unchanged = false;
    if (ready && savedSignature) unchanged = signature(draft()) === savedSignature;
    save.disabled = saving || (!attempt.pending && (!ready || unchanged));
    save.textContent = saving ? '正在保存…' : attempt.pending ? '确认并重试保存' : unchanged ? '已保存到共享记录' : currentSavedId ? '保存为新记录' : '保存到共享记录';
    saveHint.textContent = attempt.pending ? '上次保存结果尚未确认。重试会核对同一份内容，避免重复记录。' : !ready && cards.length ? '翻开所有桌上的牌后即可保存。' : '双方都能回看。保存后，这次牌阵和文字会作为一个独立记录保留。';
    for (const input of form.querySelectorAll('textarea,input')) input.disabled = saving || attempt.pending;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (save.disabled) return;
    let snapshot;
    try { snapshot = attempt.snapshot() || attempt.prepare(draft()); }
    catch (error) { message(error.message, true); return; }
    saving = true; update(); message('正在保存到共享记录…');
    try {
      const { record } = await client.save(snapshot);
      if (disposed) return;
      currentSavedId = record.id; savedSignature = signature(snapshot); noteChanged = false; attempt.complete();
      message('已保存到共享记录。你和伙伴都可以回看。');
    } catch (error) { if (error.definite) attempt.complete(); if (!disposed) message(error.message, true); }
    finally { saving = false; if (!disposed) { update(); if (mode === 'current') status.scrollIntoView({ block: 'nearest' }); } }
  });
  async function loadList(cursor = '') {
    const request = ++listRequest; history.setAttribute('aria-busy', 'true');
    if (!cursor) history.replaceChildren(el('p', '正在读取共享记录…', 'record-intro'));
    message('');
    try {
      const data = await client.list(cursor);
      if (disposed || request !== listRequest) return;
      if (!cursor) history.replaceChildren();
      history.querySelector('.record-load-more')?.remove();
      if (!data.records.length && !cursor) history.append(el('p', '还没有保存的占卜。从「这次占卜」留下第一条记录。', 'record-empty'));
      for (const record of data.records) {
        const row = button('', () => loadDetail(record.id), 'record-history-row');
        row.append(el('span', date(record.savedAt), 'record-date'), el('strong', record.question || '未命名的占卜'), el('small', `${record.cardCount} 张 · ${record.cards.map(card => `${card.name}${card.reversed ? '（逆）' : ''}`).join(' / ')}`));
        history.append(row);
      }
      if (data.nextCursor) history.append(button('加载更多', () => loadList(data.nextCursor), 'record-load-more'));
    } catch (error) {
      if (disposed || request !== listRequest) return;
      if (!cursor) history.replaceChildren(el('p', error.message, 'record-empty'), button('重新读取', () => loadList()));
      else message(error.message, true);
    } finally { if (!disposed && request === listRequest) history.setAttribute('aria-busy', 'false'); }
  }
  async function loadDetail(id) {
    const request = ++detailRequest; show('detail'); detail.replaceChildren(el('p', '正在打开这次占卜…', 'record-intro')); detail.tabIndex = -1; detail.focus({ preventScroll: true }); message('');
    try {
      const { record } = await client.get(id);
      if (disposed || request !== detailRequest) return;
      detail.replaceChildren(button('← 返回记录', () => { show('history'); historyTab.focus({ preventScroll: true }); }, 'record-back'));
      detail.append(el('p', `${date(record.savedAt)} · ${record.spread.name} · ${record.cards.length} 张`, 'record-intro'), el('h3', record.question || '未命名的占卜'));
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
      const ordered = el('ol', '', 'record-saved-cards');
      cards.forEach((card, index) => {
        const row = el('li'), disclosure = el('details'), summary = el('summary', `${index + 1} · ${card.sourceSnapshot.name} · ${card.reversed ? '逆位' : '正位'}${card.positionLabel ? ` · ${card.positionLabel}` : ''}`);
        disclosure.append(summary, el('p', card.sourceSnapshot.theme, 'record-theme'));
        if (card.reversed) disclosure.append(el('p', '原版资料没有单独的逆位牌义，以下保留基础说明。', 'record-intro'));
        const meaning = el('p', card.sourceSnapshot.interpretation); meaning.lang = 'en'; disclosure.append(meaning);
        const imagery = el('p', card.sourceSnapshot.urbanImagery); imagery.lang = 'en'; disclosure.append(imagery);
        row.append(disclosure); ordered.append(row);
      });
      detail.append(ordered);
      for (const [label, text] of [['我的解读', record.interpretation], ['留给之后的自己', record.reflection]]) {
        if (text) detail.append(el('h4', label), el('p', text, 'record-prose'));
      }
      detail.append(button('导出这条记录', () => {
        const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = `augurwell-${record.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }));
    } catch (error) { if (!disposed && request === detailRequest) detail.replaceChildren(el('p', error.message, 'record-empty'), button('重试', () => loadDetail(id)), button('返回记录', () => show('history'))); }
  }
  function onOpen(event) { if (event.detail.id === 'reading-records' && event.detail.open) { update(); if (mode === 'history') loadList(); } }
  doc.addEventListener('reading:disclosurechange', onOpen);
  const unsaved = () => noteChanged || attempt.pending || saving;
  function beforeUnload(event) { if (unsaved()) { event.preventDefault(); event.returnValue = ''; } }
  window.addEventListener('beforeunload', beforeUnload);
  show('current');
  return {
    update,
    mayReset() {
      if (saving || attempt.pending) { disclosures.open('reading-records'); show('current'); message('请先确认这条记录的保存结果，再重洗。', true); return false; }
      return !unsaved() || window.confirm('这次的文字还没有保存。仍要重洗并清空这些文字吗？');
    },
    reset() {
      question.value = interpretation.value = reflection.value = ''; Object.keys(labels).forEach(key => delete labels[key]);
      roundStartedAt = new Date().toISOString(); savedSignature = ''; currentSavedId = null; noteChanged = false; attempt = createSaveAttempt(); lastCardsKey = null; message(''); update();
      root.scrollTop = 0;
    },
    dispose() { disposed = true; listRequest++; detailRequest++; doc.removeEventListener('reading:disclosurechange', onOpen); window.removeEventListener('beforeunload', beforeUnload); },
  };
}
