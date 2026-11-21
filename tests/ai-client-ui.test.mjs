import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEventListeners } from 'node:events';
import { registerHooks } from 'node:module';
import { createReadingAI } from '../client/src/reading-ai.mjs';
import { renderAIInterpretation } from '../client/src/reading-ai-render.mjs';
import { createReading, reduceReading } from '../client/src/reading-state.mjs';
import { buildStoredRecord } from '../shared/record-schema.mjs';

// Vite owns art URL expansion. This controller test doesn't load card images.
const artHook = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === './reading-art.mjs' && context.parentURL?.endsWith('/reading-records.mjs')) return { shortCircuit: true, url: 'data:text/javascript,export const readingCardImage = id => `/test-art/${id}.webp`;' };
  return nextResolve(specifier, context);
} });
const { createReadingRecords } = await import('../client/src/reading-records.mjs');
artHook.deregister();

// Controller-only DOM double. Real layout, focus and glass appearance are
// separately checked in the browser; this catches state and safe-text regressions.
class Element extends EventTarget {
  constructor(tag, document) { super(); this.tagName = tag; this.ownerDocument = document; this.children = []; this.attributes = {}; this.style = { setProperty(name, value) { this[name] = String(value); }, getPropertyValue(name) { return this[name] || ''; } }; this._value = ''; this._text = ''; this.hidden = false; this.disabled = false; this.className = ''; }
  get textContent() { return this._text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  set innerHTML(_value) { throw new Error('Unsafe HTML rendering'); }
  get value() { return this._value || (this.tagName === 'select' ? this.children[0]?.value || '' : ''); }
  set value(value) { this._value = String(value); }
  get options() { return this.children; }
  get classList() { return { add: name => this.classList.toggle(name, true), toggle: (name, force) => { const values = new Set(this.className.split(' ').filter(Boolean)); (force ?? !values.has(name)) ? values.add(name) : values.delete(name); this.className = [...values].join(' '); } }; }
  append(...items) { for (const item of items) { this.children.push(item); if (typeof item !== 'string') item.parent = this; } }
  replaceChildren(...items) { this.children.forEach(child => { if (typeof child !== 'string') child.parent = null; }); this._text = ''; this.children = []; this.append(...items); }
  contains(node) { return this === node || this.children.some(child => typeof child !== 'string' && child.contains(node)); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  querySelectorAll(selector) {
    const selectors = selector.split(','); const output = [];
    const match = element => selectors.some(value => value.startsWith('.') ? element.className.split(' ').includes(value.slice(1)) : value.startsWith('#') ? element.id === value.slice(1) : element.tagName === value);
    const visit = element => { for (const child of element.children) if (typeof child !== 'string') { if (match(child)) output.push(child); visit(child); } };
    visit(this); return output;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  remove() { this.parent.children = this.parent.children.filter(item => item !== this); }
  scrollIntoView() {}
  focus() { this.ownerDocument.activeElement = this; }
  click() { this.dispatchEvent(new Event('click')); }
}
class Document extends EventTarget {
  constructor() { super(); this.defaultView = new EventTarget(); this.defaultView.confirm = () => true; }
  createElement(tag) { return new Element(tag, this); }
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function spread() {
  let state = createReading({ reversed: Array(78).fill(false) });
  state = reduceReading(state, { type: 'draw', id: 0, x: -1, z: -1 });
  return reduceReading(state, { type: 'reveal', id: 0 });
}
function completed(body, text = '这是一段测试解读') {
  return { interpretation: {
    ...structuredClone(body), status: 'completed', createdAt: '2026-10-29T00:00:00Z', completedAt: '2026-10-29T00:00:01Z',
    usage: { inputTokens: 111, outputTokens: 222 },
    answer: { summary: text, cards: body.reading.cards.map(card => ({ sourceCardId: card.sourceCardId, reversed: card.reversed, positionLabel: card.positionLabel, interpretation: text, basis: '原版资料' })), reflectionQuestions: [text], limitations: [text] },
  } };
}
function saveReceipt(body, requests) {
  const record = buildStoredRecord(body, { savedAt: '2026-11-21T03:04:00.000Z', createdBy: 'test-user' });
  if (body.aiInterpretationIds?.length) {
    record.aiInterpretations = body.aiInterpretationIds.map(id => completed(requests.find(request => request.id === id)).interpretation);
  }
  return { record };
}
function fixture({ aiClient, recordClient } = {}) {
  const document = new Document(), root = document.createElement('div'), recordRoot = document.createElement('div');
  globalThis.window = document.defaultView;
  let reading = spread(), busy = false; const opened = [];
  const disclosures = { open: id => opened.push(id) };
  const recordRequests = [], requests = [];
  const records = createReadingRecords({ root: recordRoot, getReading: () => reading, getBusy: () => busy, disclosures,
    client: recordClient || { save: async body => { recordRequests.push(body); return saveReceipt(body, requests); } } });
  const ai = createReadingAI({ root, getReading: () => reading, getBusy: () => busy, records, disclosures,
    client: aiClient || { generate: async body => { requests.push(body); return completed(body); }, get: async () => { throw new Error('Unexpected GET'); } } });
  const find = id => root.querySelector(`#${id}`) || recordRoot.querySelector(`#${id}`);
  const input = (id, value, event = 'input') => { const node = find(id); node.value = value; node.dispatchEvent(new Event(event)); };
  const submit = () => root.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  return { root, recordRoot, document, records, ai, requests, recordRequests, find, input, submit, opened,
    get reading() { return reading; }, set reading(value) { reading = value; records.update(); },
    set busy(value) { busy = value; records.update(); },
    dispose() { ai.dispose(); records.dispose(); delete globalThis.window; } };
}

test('opening, shared question/label edits and option changes never call AI; hidden/busy states block generation', async () => {
  const f = fixture();
  assert.equal(f.find('ai-generate').disabled, true);
  f.records.setQuestion('用户自己写的问题'); assert.equal(f.find('ai-question').value, '用户自己写的问题');
  f.input('ai-question', '修改的问题'); assert.equal(f.records.getQuestion(), '修改的问题');
  f.root.querySelector('.ai-spread-preview').querySelector('input').value = '当下';
  f.root.querySelector('.ai-spread-preview').querySelector('input').dispatchEvent(new Event('input'));
  assert.equal(f.records.getLabels()[0], '当下');
  f.input('ai-effort', '2'); assert.equal(f.find('ai-budget').value, '12000');
  f.input('ai-model', 'gpt-6.1-sol', 'change'); assert.equal(f.requests.length, 0);
  f.busy = true; f.submit(); assert.equal(f.requests.length, 0);
  f.busy = false; f.reading = reduceReading(f.reading, { type: 'draw', id: 1, x: 1, z: -1 }); f.submit(); assert.equal(f.requests.length, 0);
  f.dispose();
});

test('direct save stores only the displayed version with the shared draft and reopens its exact receipt', async t => {
  const snapshots = [], receipts = [], versions = new Map();
  const f = fixture({ recordClient: { save: async snapshot => {
    snapshots.push(structuredClone(snapshot));
    const record = { ...buildStoredRecord(snapshot, { savedAt: '2026-11-21T03:04:00.000Z', createdBy: 'test-user' }),
      aiInterpretations: snapshot.aiInterpretationIds.map(id => versions.get(id)) };
    receipts.push(record); return { record };
  } } }); t.after(() => f.dispose());
  f.input('ai-question', '同一牌阵的两版解读');
  f.records.setLabel(0, '当下'); f.input('record-interpretation', '我写的解读');
  f.input('record-reflection', '稍后回看');
  f.submit(); await settle(); f.submit(); await settle();
  const [a,b] = f.requests.map(item => item.id);
  f.requests.forEach((request, index) => versions.set(request.id, completed(request, `版本 ${index + 1}`).interpretation));
  f.input('ai-result-picker', a, 'change');
  const save = f.find('ai-save-record'), view = f.find('ai-view-record');
  save.click(); save.click(); await settle();
  assert.deepEqual(snapshots[0].aiInterpretationIds, [a]);
  assert.equal(snapshots[0].interpretation, '我写的解读'); assert.equal(snapshots[0].reflection, '稍后回看');
  assert.equal(snapshots[0].cards[0].positionLabel, '当下');
  assert.equal(snapshots.length, 1); assert.deepEqual(f.opened, []);
  assert.equal(save.textContent, '已保存'); assert.equal(view.hidden, false);
  f.input('ai-result-picker', b, 'change'); assert.equal(view.hidden, true);
  assert.equal(save.textContent, '另存为新记录'); save.click(); await settle();
  assert.deepEqual(snapshots[1].aiInterpretationIds, [b]); assert.notEqual(snapshots[0].id, snapshots[1].id);
  f.document.defaultView.confirm = () => false;
  assert.equal(f.records.mayReset(), true);
  f.input('ai-result-picker', a, 'change'); assert.equal(save.disabled, true);
  save.click(); assert.equal(snapshots.length, 2); assert.equal(f.requests.length, 2);
  view.click(); assert.deepEqual(f.opened, ['reading-records']);
  assert.match(f.recordRoot.querySelector('.record-ai-body').textContent, /版本 1/);
  assert.doesNotMatch(f.recordRoot.querySelector('.record-ai-body').textContent, /版本 2/);
  f.recordRoot.querySelector('.record-back').click(); assert.equal(f.opened.at(-1), 'reading-ai');
  assert.equal(f.find('ai-result-picker').value, a);
  f.input('record-interpretation', '补充后的文字'); assert.equal(f.records.mayReset(), false);
  assert.equal(save.textContent, '另存为新记录');
  f.input('ai-question', '新问题'); assert.equal(save.hidden, true);
  f.records.saveAIResult(a); assert.equal(snapshots.length, 2); assert.equal(receipts[0].interpretation, '我写的解读');
});

test('uncertain result save preserves its frozen attempt across another version, record-form auth failure and in-place retry', async t => {
  const attempts = [], f = fixture({ recordClient: { save: async body => {
    attempts.push(structuredClone(body));
    if (attempts.length === 1) throw new Error('暂未收到保存回执');
    if (attempts.length === 2) throw Object.assign(new Error('需要重新登录'), { definite: true });
    return saveReceipt(body, f.requests);
  } } }); t.after(() => f.dispose());
  f.input('ai-question', '保留最初提交'); f.submit(); await settle(); f.submit(); await settle();
  const [a,b] = f.requests.map(item => item.id), save = f.find('ai-save-record');
  f.input('ai-result-picker', a, 'change'); save.click(); await settle();
  assert.equal(f.records.locked, true); assert.equal(save.textContent, '确认并重试保存');
  assert.match(f.root.querySelector('.ai-save-feedback').textContent, /回执/);
  f.input('ai-result-picker', b, 'change'); assert.equal(save.textContent, '查看待确认的记录');
  save.click(); assert.equal(attempts.length, 1); assert.equal(f.opened.at(-1), 'reading-records');
  f.recordRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true })); await settle();
  assert.equal(f.records.locked, true); assert.equal(attempts.length, 2);
  f.reading.placed[0].x += .5; f.records.update(); f.input('ai-result-picker', a, 'change');
  assert.match(f.root.querySelector('.ai-save-feedback').textContent, /登录/);
  save.click(); await settle();
  assert.deepEqual(attempts, [attempts[0], attempts[0], attempts[0]]);
  assert.deepEqual(attempts[0].aiInterpretationIds, [a]); assert.equal(f.requests.length, 2);
  assert.equal(f.records.locked, false); assert.equal(f.find('ai-view-record').hidden, false);
  assert.equal(save.hidden, true);
});

test('a wrong record or missing, extra or substituted AI attachment keeps the frozen save unconfirmed', async t => {
  const attempts = [], malformed = [
    record => { record.id = crypto.randomUUID(); },
    record => { delete record.aiInterpretations; },
    record => { record.aiInterpretations.push(structuredClone(record.aiInterpretations[0])); },
    record => { record.aiInterpretations[0].id = crypto.randomUUID(); },
  ];
  const f = fixture({ recordClient: { save: async body => {
    const response = saveReceipt(body, f.requests);
    malformed[attempts.length]?.(response.record);
    attempts.push(structuredClone(body)); return response;
  } } }); t.after(() => f.dispose());
  f.input('ai-question', '回执核对'); f.submit(); await settle();
  const save = f.find('ai-save-record'), view = f.find('ai-view-record');
  for (let index = 0; index < malformed.length; index++) {
    save.click(); await settle();
    assert.equal(save.textContent, '确认并重试保存'); assert.equal(view.hidden, true);
    assert.match(f.root.querySelector('.ai-save-feedback').textContent, /回执/);
    assert.equal(f.records.locked, true); assert.equal(attempts.length, index + 1);
  }
  save.click(); await settle();
  assert.equal(save.textContent, '已保存'); assert.equal(view.hidden, false); assert.equal(f.records.locked, false);
  assert.ok(attempts.every(attempt => JSON.stringify(attempt) === JSON.stringify(attempts[0])));
  assert.equal(f.requests.length, 1);
});

test('explicit generation freezes snapshot, keeps human notes separate and invalidates only semantic changes', async () => {
  let resolve, submitted;
  const f = fixture({ aiClient: { generate: body => { submitted = body; return new Promise(done => { resolve = done; }); } } });
  f.input('ai-question', '原问题'); f.input('record-interpretation', '只属于我的文字'); f.submit();
  f.input('ai-question', '后改问题'); assert.equal(submitted.reading.question, '原问题'); assert.equal(submitted.reading.interpretation, '');
  resolve(completed(submitted)); await settle();
  assert.equal(f.root.querySelector('.ai-stale').hidden, false);
  f.input('ai-question', '原问题'); assert.equal(f.root.querySelector('.ai-stale').hidden, true);
  f.reading.placed[0].zIndex += 10; f.records.update(); assert.equal(f.root.querySelector('.ai-stale').hidden, true);
  f.reading.placed[0].x += .25; f.records.update(); assert.equal(f.root.querySelector('.ai-stale').hidden, false);
  assert.equal(f.find('record-interpretation').value, '只属于我的文字');
  assert.match(f.root.querySelectorAll('button').find(button => button.getAttribute('aria-label') === '实际用量说明').getAttribute('data-help'), /输入 111 · 生成 222/);
  f.dispose();
});

test('replacing, switching and resetting AI answers dispose their help without disabling form help', async () => {
  const f = fixture(), tips = () => f.root.querySelector('.ai-result-body').querySelectorAll('.help-trigger');
  const formHelp = f.root.querySelector('form').querySelector('.help-trigger');
  f.input('ai-question', '检查说明的切换'); f.submit(); await settle();
  const firstTips = tips(); assert.ok(firstTips.length > 0);
  f.submit(); await settle();
  assert.ok(firstTips.every(tip => getEventListeners(tip, 'focus').length === 0));
  const secondTips = tips();
  f.input('ai-result-picker', f.requests[0].id, 'change');
  assert.ok(secondTips.every(tip => getEventListeners(tip, 'focus').length === 0));
  const selectedTips = tips(); f.ai.reset();
  assert.ok(selectedTips.every(tip => getEventListeners(tip, 'focus').length === 0));
  assert.equal(getEventListeners(formHelp, 'focus').length, 1);
  f.dispose(); assert.equal(getEventListeners(formHelp, 'focus').length, 0);
});

test('budget errors and incomplete outcomes retain the form without automatic retry', async () => {
  let calls = 0;
  const f = fixture({ aiClient: { generate: async body => { calls++; return { interpretation: { ...body, status: 'incomplete', createdAt: '2026-10-29T00:00:00Z', message: '预算不足，解读未完成。' } }; } } });
  f.input('ai-question', '用户的问题'); f.input('ai-budget', 'custom', 'change'); f.input('ai-custom-tokens', '2.5'); f.submit();
  assert.equal(calls, 0); assert.equal(f.find('ai-generate').disabled, true);
  f.input('ai-custom-tokens', '3000'); f.submit(); await settle();
  assert.equal(calls, 1); assert.match(f.find('ai-status').textContent, /未完成/); assert.equal(f.find('ai-question').value, '用户的问题');
  f.ai.update(); assert.equal(calls, 1); assert.equal(f.find('ai-save-record').hidden, true);
  f.dispose();
});

test('twenty rapid generate clicks make one POST, then rapid recovery clicks only read the same request', async () => {
  let posts = 0, gets = 0, resolvePost, resolveGet, payload;
  const f = fixture({ aiClient: {
    generate: body => { posts++; payload = body; return new Promise(resolve => { resolvePost = resolve; }); },
    get: id => { gets++; assert.equal(id, payload.id); return new Promise(resolve => { resolveGet = resolve; }); },
  } });
  f.input('ai-question', '重复点击测试');
  for (let i = 0; i < 20; i++) f.submit();
  assert.equal(posts, 1); assert.equal(f.find('ai-generate').disabled, true);
  resolvePost({ interpretation: { ...payload, status: 'pending', createdAt: '2026-10-29T00:00:00Z' } }); await settle();
  for (let i = 0; i < 20; i++) f.submit();
  assert.equal(posts, 1); assert.equal(f.find('ai-generate').disabled, true);
  for (let i = 0; i < 20; i++) f.find('ai-recover').click();
  assert.equal(gets, 1); assert.equal(posts, 1); assert.equal(f.find('ai-recover').disabled, true); assert.equal(f.find('ai-generate').disabled, true);
  resolveGet(completed(payload)); await settle();
  assert.equal(posts, 1); assert.equal(gets, 1); assert.equal(f.find('ai-generate').disabled, false);
  let repeatConfirmations = 0; f.document.defaultView.confirm = () => { repeatConfirmations++; return false; };
  f.submit(); assert.equal(repeatConfirmations, 1); assert.equal(posts, 1);
  f.dispose();
});

test('unknown attempt stays recoverable across explicit continuation and reset, with fee acknowledgement for a new call', async () => {
  let calls = 0, lookups = 0, oldPayload; const confirmations = [];
  const f = fixture({ aiClient: {
    generate: async body => { calls++; oldPayload ||= body; if (calls === 1) throw new Error('未知'); return completed(body); },
    get: async id => { lookups++; assert.equal(id, oldPayload.id); return completed(oldPayload); },
  } });
  f.document.defaultView.confirm = text => { confirmations.push(text); return true; };
  f.input('ai-question', '原问题'); f.submit(); await settle();
  assert.equal(f.ai.mayReset(), false); assert.equal(f.find('ai-continue').hidden, false);
  f.find('ai-continue').click(); assert.equal(f.ai.mayReset(), true); f.ai.reset(); f.records.reset();
  f.input('ai-question', '新问题'); f.submit(); await settle();
  assert.equal(calls, 2); assert.ok(confirmations.some(text => text.includes('另行计费')));
  f.root.querySelector('.ai-previous-attempt').querySelector('button').click(); await settle();
  assert.equal(lookups, 1); assert.equal(calls, 2); assert.match(f.root.querySelector('.ai-result-body').textContent, /新问题/);
  f.dispose();
});

test('save includes only explicitly selected matching AI IDs and preserves an AI completion racing with save', async () => {
  let saveDone, savedBody, aiDone, aiBody;
  const f = fixture({ recordClient: { save: body => { savedBody = body; return new Promise(done => { saveDone = done; }); } }, aiClient: { generate: body => { aiBody = body; return new Promise(done => { aiDone = done; }); } } });
  f.input('ai-question', '同一个问题'); f.submit();
  f.recordRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(savedBody.aiInterpretationIds, undefined);
  aiDone(completed(aiBody)); await settle(); saveDone(saveReceipt(savedBody, [])); await settle();
  let warned = false; f.document.defaultView.confirm = () => { warned = true; return false; };
  assert.equal(f.records.mayReset(), false); assert.equal(warned, true);
  const checkbox = f.recordRoot.querySelector('.record-ai-choices').querySelector('input'); assert.equal(checkbox.checked, true);
  checkbox.checked = false; checkbox.dispatchEvent(new Event('change'));
  f.recordRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  // Unticking restores the already-saved snapshot, so no second save is needed.
  assert.equal(f.recordRoot.querySelector('.record-primary').disabled, true);
  f.dispose();
});

test('matching completed AI IDs save by reference while unchecked results stay unchecked on a later completion', async () => {
  const f = fixture(); f.input('ai-question', '同一个问题'); f.submit(); await settle();
  let boxes = f.recordRoot.querySelector('.record-ai-choices').querySelectorAll('input');
  assert.equal(boxes.length, 1); assert.equal(boxes[0].checked, true);
  boxes[0].checked = false; boxes[0].dispatchEvent(new Event('change'));
  f.submit(); await settle();
  boxes = f.recordRoot.querySelector('.record-ai-choices').querySelectorAll('input');
  assert.equal(boxes.length, 2); assert.equal(boxes[0].checked, false); assert.equal(boxes[1].checked, true);
  f.recordRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true })); await settle();
  assert.deepEqual(f.recordRequests[0].aiInterpretationIds, [f.requests[1].id]);
  assert.equal(f.recordRequests[0].interpretation, ''); assert.equal(f.recordRequests[0].aiInterpretations, undefined);
  f.reading.placed[0].x += 1; f.records.update();
  f.recordRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true })); await settle();
  assert.equal(f.recordRequests[1].aiInterpretationIds, undefined);
  f.dispose();
});

test('model and user markup remain literal text; canonical usage fields render', () => {
  const f = fixture(); f.records.setQuestion('<img src=x onerror=evil()>');
  const body = { id: crypto.randomUUID(), reading: f.records.getAIReading(), model: 'gpt-6.1-terra', effort: 'low', maxOutputTokens: 3000 };
  const node = renderAIInterpretation(f.document, completed(body, '<script>evil()</script>').interpretation);
  assert.equal(node.querySelector('script'), null); assert.equal(node.querySelector('img'), null);
  assert.match(node.textContent, /<script>evil\(\)<\/script>/);
  assert.match(node.querySelectorAll('button').find(button => button.getAttribute('aria-label') === '实际用量说明').getAttribute('data-help'), /输入 111 · 生成 222/);
  assert.doesNotMatch(node.textContent, /输入 111 · 生成 222/);
  f.dispose();
});

test('source basis markers render understandable Chinese and never leak internal enum values', () => {
  const f = fixture(); f.records.setQuestion('含义说明测试');
  const body = { id: crypto.randomUUID(), reading: f.records.getAIReading(), model: 'gpt-6.1-terra', effort: 'low', maxOutputTokens: 3000 };
  for (const [basis, label] of [['provided_meaning', '依据原始牌义'], ['generated_reversal_extension', '逆位：基于原始牌义的延伸解释'], ['unknown_internal_basis', '结合本次牌面与问题的解释']]) {
    const result = completed(body).interpretation; result.answer.cards[0].basis = basis;
    const node = renderAIInterpretation(f.document, result);
    const sourceHelp = node.querySelectorAll('button').find(button => button.getAttribute('aria-label')?.endsWith('解读依据说明'));
    assert.equal(sourceHelp.getAttribute('data-help'), label);
    assert.ok(!node.textContent.includes(label)); assert.ok(!node.textContent.includes(basis));
  }
  f.dispose();
});

test('detail and focus remain outside the collapsed computing control while budget stays in advanced settings', async () => {
  const f = fixture();
  assert.equal(f.find('ai-detail').value, 'standard'); assert.equal(f.find('ai-focus').value, 'general');
  assert.ok(!f.find('ai-advanced').open);
  assert.equal(f.find('ai-advanced').querySelector('#ai-detail'), null);
  assert.equal(f.find('ai-advanced').querySelector('#ai-model'), null);
  assert.equal(f.find('ai-advanced').querySelector('#ai-effort'), null);
  const compute = f.root.querySelector('.ai-compute-control');
  assert.ok(!f.find('ai-compute-disclosure').open);
  assert.equal(compute.querySelector('#ai-model'), f.find('ai-model'));
  assert.equal(compute.querySelector('#ai-effort'), f.find('ai-effort'));
  assert.equal(f.find('ai-advanced').querySelector('#ai-budget'), f.find('ai-budget'));
  f.input('ai-question', '我想怎样理解最近反复想到的一种颜色？');
  f.input('ai-detail', 'deep', 'change'); f.input('ai-focus', 'general', 'change');
  assert.equal(f.requests.length, 0); assert.equal(f.find('ai-effort').value, '0'); assert.equal(f.find('ai-budget').value, '3000');
  f.submit(); await settle();
  assert.equal(f.requests[0].detail, 'deep'); assert.equal(f.requests[0].focus, 'general');
  assert.match(f.root.querySelector('.ai-result-body').textContent, /细读 · 跟随问题/);
  assert.match(f.recordRoot.querySelector('.record-ai-choices').textContent, /细读 · 跟随问题/);
  f.input('ai-detail', 'brief', 'change'); f.input('ai-focus', 'self', 'change');
  assert.equal(f.requests.length, 1); assert.match(f.root.querySelector('.ai-result-body').textContent, /细读 · 跟随问题/);
  assert.doesNotMatch(f.root.querySelector('.ai-result-body').textContent, /简读 · 自我理解/);
  assert.equal(f.root.querySelector('.ai-stale').hidden, true);
  f.dispose();
});

test('compact summary follows current choices and closing the AI sheet retains them without requests', () => {
  const f = fixture();
  try {
    const disclosure = f.find('ai-compute-disclosure'), summary = f.find('ai-compute-toggle');
    assert.equal(summary.tagName, 'summary'); assert.ok(!disclosure.open);
    assert.equal(summary.textContent, '6.1 Terra · 轻量');
    disclosure.open = true;
    f.input('ai-model', 'gpt-6.1-sol', 'change'); f.input('ai-effort', '1');
    assert.equal(summary.textContent, '6.1 Sol · 标准');
    const close = new Event('reading:disclosurechange'); close.detail = { id: 'reading-ai', open: false };
    f.document.dispatchEvent(close); assert.equal(disclosure.open, false);
    disclosure.open = true;
    assert.equal(f.find('ai-model').value, 'gpt-6.1-sol'); assert.equal(f.find('ai-effort').value, '1');
    assert.equal(f.find('ai-budget').value, '6000'); assert.equal(f.requests.length, 0);
  } finally { f.dispose(); }
});

test('compact disclosure dismisses outside and restores summary focus on Escape with cleaned listeners', () => {
  const f = fixture(), view = f.document.defaultView;
  const keyListeners = getEventListeners(view, 'keydown');
  const clickListeners = getEventListeners(f.document, 'click');
  const scrollListeners = getEventListeners(f.document, 'scroll');
  const resizeListeners = getEventListeners(view, 'resize');
  try {
    const disclosure = f.find('ai-compute-disclosure');
    disclosure.open = true;
    const inside = new Event('focusin'); Object.defineProperty(inside, 'target', { value: f.find('ai-effort') });
    f.document.dispatchEvent(inside); assert.equal(disclosure.open, true);
    f.document.dispatchEvent(new Event('pointerdown')); assert.equal(disclosure.open, true);
    f.document.dispatchEvent(new Event('focusin')); assert.equal(disclosure.open, true);
    f.document.dispatchEvent(new Event('click')); assert.equal(disclosure.open, false);
    disclosure.open = true;
    const escape = new Event('keydown', { cancelable: true }); escape.key = 'Escape';
    view.dispatchEvent(escape);
    assert.equal(escape.defaultPrevented, true); assert.equal(disclosure.open, false);
    assert.equal(f.document.activeElement, f.find('ai-compute-toggle'));
    disclosure.open = true; f.find('ai-effort').focus();
    const internalScroll = new Event('scroll'); Object.defineProperty(internalScroll, 'target', { value: f.root.querySelector('.ai-compute-control') });
    f.document.dispatchEvent(internalScroll); assert.equal(disclosure.open, true);
    f.document.dispatchEvent(new Event('scroll')); assert.equal(disclosure.open, false);
    assert.equal(f.document.activeElement, f.find('ai-compute-toggle'));
    disclosure.open = true; f.find('ai-effort').focus(); view.dispatchEvent(new Event('resize'));
    assert.equal(disclosure.open, false); assert.equal(f.document.activeElement, f.find('ai-compute-toggle'));
    assert.equal(f.requests.length, 0);
  } finally { f.dispose(); }
  // The document-wide help manager outlives individual controllers.
  assert.equal(getEventListeners(view, 'keydown').length, keyListeners.length - 1);
  assert.equal(getEventListeners(f.document, 'click').length, clickListeners.length - 1);
  assert.equal(getEventListeners(f.document, 'scroll').length, scrollListeners.length - 1);
  assert.equal(getEventListeners(view, 'resize').length, resizeListeners.length - 1);
});

test('floating computing panel fits above, below and within a short visible sheet', () => {
  const f = fixture();
  try {
    const disclosure = f.find('ai-compute-disclosure'), summary = f.find('ai-compute-toggle'), panel = f.root.querySelector('.ai-compute-control');
    f.document.defaultView.innerHeight = 844; panel.scrollHeight = 160; disclosure.open = true;
    summary.offsetWidth = 112; summary.offsetHeight = 36;
    for (const [bounds, anchor, side, height] of [
      [{ top: 130, bottom: 680 }, { top: 400, bottom: 436 }, 'above', '258px'],
      [{ top: 130, bottom: 680 }, { top: 140, bottom: 176 }, 'below', '492px'],
      [{ top: 130, bottom: 320 }, { top: 200, bottom: 236 }, 'below', '72px'],
    ]) {
      disclosure.closest = () => ({ getBoundingClientRect: () => bounds });
      summary.getBoundingClientRect = () => anchor;
      disclosure.dispatchEvent(new Event('toggle'));
      assert.equal(disclosure.getAttribute('data-placement'), side);
      assert.equal(panel.style.getPropertyValue('--ai-compute-max-height'), height);
      assert.equal(panel.style.getPropertyValue('--ai-trigger-half-width'), '56px');
      assert.equal(panel.style.getPropertyValue('--ai-trigger-half-height'), '18px');
    }
    assert.equal(f.requests.length, 0);
  } finally { f.dispose(); }
});

test('each native slider step names its effort, updates budget and submits the canonical value only on explicit generation', async () => {
  for (const [step, id, label, tokens, progress, upper] of [
    ['0', 'low', '轻量', '3000', '0%', '0.20'],
    ['1', 'medium', '标准', '6000', '50%', '0.25'],
    ['2', 'high', '深入', '12000', '100%', '0.30'],
  ]) {
    const f = fixture();
    try {
      const slider = f.find('ai-effort');
      assert.equal(slider.type, 'range'); assert.equal(slider.min, '0'); assert.equal(slider.max, '2'); assert.equal(slider.step, '1');
      assert.equal(slider.getAttribute('aria-label'), '思考强度');
      f.input('ai-effort', step);
      assert.equal(slider.getAttribute('aria-valuetext'), label); assert.equal(f.find('ai-effort-value').textContent, label);
      assert.equal(f.find('ai-budget').value, tokens); assert.equal(f.find('ai-custom-tokens').value, tokens);
      assert.equal(slider.style.getPropertyValue('--ai-effort-progress'), progress);
      assert.equal(f.root.querySelector('.ai-effort-stops').getAttribute('aria-hidden'), 'true');
      f.input('ai-model', 'gpt-6.1-sol', 'change');
      assert.equal(slider.value, step); assert.equal(f.find('ai-budget').value, tokens);
      assert.ok(f.find('ai-cost-hint').textContent.includes(upper)); assert.equal(f.requests.length, 0);
      f.input('ai-question', '我想调整自己的学习安排'); f.submit(); await settle();
      assert.equal(f.requests.length, 1); assert.equal(f.requests[0].effort, id);
      assert.equal(f.requests[0].model, 'gpt-6.1-sol'); assert.equal(f.requests[0].maxOutputTokens, Number(tokens));
    } finally { f.dispose(); }
  }
});

test('effort reset restores the default budget and label while retaining model and other choices without a request', () => {
  const f = fixture();
  try {
    const reset = f.find('ai-effort-reset');
    assert.equal(reset.getAttribute('aria-label'), '恢复默认思考强度'); assert.equal(reset.disabled, true);
    f.input('ai-model', 'gpt-6.1-sol', 'change'); f.input('ai-detail', 'deep', 'change');
    f.input('ai-budget', 'custom', 'change'); f.input('ai-custom-tokens', '6000');
    assert.equal(reset.disabled, false); reset.click();
    assert.equal(f.find('ai-effort').value, '0'); assert.equal(f.find('ai-budget').value, '3000');
    assert.equal(f.find('ai-custom-tokens').value, '3000'); assert.equal(reset.disabled, true);
    f.input('ai-effort', '2'); assert.equal(reset.disabled, false); reset.click();
    assert.equal(f.find('ai-effort-value').textContent, '轻量'); assert.equal(f.find('ai-effort').getAttribute('aria-valuetext'), '轻量');
    assert.equal(f.find('ai-model').value, 'gpt-6.1-sol'); assert.equal(f.find('ai-detail').value, 'deep');
    assert.equal(f.find('ai-budget').value, '3000'); assert.equal(reset.disabled, true); assert.equal(f.requests.length, 0);
  } finally { f.dispose(); }
});

test('unknown-request and record-save locks cover slider, model and reset while preserving the submitted effort', async () => {
  let submitted, finishSave, savedBody, calls = 0, lookups = 0;
  const f = fixture({
    aiClient: {
      generate: async body => { calls++; submitted = body; throw new Error('结果尚未确认'); },
      get: async id => { lookups++; assert.equal(id, submitted.id); return completed(submitted); },
    },
    recordClient: { save: body => { savedBody = body; return new Promise(done => { finishSave = done; }); } },
  });
  try {
    f.input('ai-question', '保留提交时的强度'); f.input('ai-effort', '2'); f.submit(); await settle();
    for (const id of ['ai-model', 'ai-effort', 'ai-effort-reset']) assert.equal(f.find(id).disabled, true);
    f.find('ai-effort-reset').click();
    assert.equal(f.find('ai-effort').value, '2'); assert.equal(submitted.effort, 'high'); assert.equal(submitted.maxOutputTokens, 12000);
    f.find('ai-recover').click(); await settle();
    for (const id of ['ai-model', 'ai-effort', 'ai-effort-reset']) assert.equal(f.find(id).disabled, false);
    f.recordRoot.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    for (const id of ['ai-model', 'ai-effort', 'ai-effort-reset']) assert.equal(f.find(id).disabled, true);
    f.find('ai-effort-reset').click(); assert.equal(f.find('ai-effort').value, '2');
    finishSave(saveReceipt(savedBody, [submitted])); await settle();
    for (const id of ['ai-model', 'ai-effort', 'ai-effort-reset']) assert.equal(f.find(id).disabled, false);
    assert.equal(calls, 1); assert.equal(lookups, 1);
  } finally { f.dispose(); }
});

test('pending presets stay locked and the submission snapshot keeps its original settings', async () => {
  let body, finish;
  const f = fixture({ aiClient: { generate: input => { body = input; return new Promise(resolve => { finish = resolve; }); }, get: async () => completed(body) } });
  f.input('ai-question', '比较两个方向'); f.input('ai-detail', 'brief', 'change'); f.input('ai-focus', 'comparison', 'change'); f.submit();
  assert.equal(body.detail, 'brief'); assert.equal(body.focus, 'comparison');
  for (const id of ['ai-detail', 'ai-focus', 'ai-model', 'ai-effort', 'ai-effort-reset', 'ai-budget']) assert.equal(f.find(id).disabled, true);
  finish({ interpretation: { ...body, status: 'pending', createdAt: '2026-11-01T00:00:00Z' } }); await settle();
  assert.equal(f.find('ai-detail').disabled, true); assert.equal(f.find('ai-focus').disabled, true);
  assert.match(f.root.querySelector('.ai-request-snapshot').textContent, /简读 · 选择比较/);
  f.find('ai-recover').click(); await settle();
  assert.equal(f.find('ai-detail').disabled, false); assert.equal(f.find('ai-focus').disabled, false);
  f.dispose();
});

test('legacy results render without inventing a detail or focus selection', () => {
  const f = fixture(); f.records.setQuestion('以前的问题');
  const body = { id: crypto.randomUUID(), reading: f.records.getAIReading(), model: 'gpt-6.1-terra', effort: 'low', maxOutputTokens: 3000 };
  const node = renderAIInterpretation(f.document, completed(body).interpretation);
  assert.match(node.querySelector('.ai-answer-meta').textContent, /6.1 Terra · 计算·轻量/);
  assert.doesNotMatch(node.querySelector('.ai-answer-meta').textContent, /跟随问题|简读|细读|标准/);
  f.dispose();
});

test('completion leads to the displayed answer; adjusting the draft and browsing earlier receipts are free', async () => {
  const f = fixture();
  const form = f.root.querySelector('form'), toggle = f.root.querySelector('.ai-edit-result');
  assert.ok(toggle.hidden);
  f.input('ai-question', '要记录的问题'); f.submit(); await settle();
  assert.ok(form.hidden); assert.equal(toggle.hidden, false);
  const firstId = f.requests[0].id;
  assert.equal(f.root.querySelector('.ai-result-body').querySelector('h3').textContent.trim().startsWith('要记录的问题'), true);
  f.root.scrollTop = 600; toggle.click();
  assert.equal(form.hidden, false); assert.equal(f.root.scrollTop, 0);
  assert.equal(f.requests.length, 1);
  f.input('ai-question', '另一个问题'); f.submit(); await settle();
  assert.ok(form.hidden);
  f.input('ai-result-picker', firstId, 'change'); toggle.click();
  assert.ok(f.root.querySelector('.ai-request-snapshot').hidden);
  assert.equal(f.requests.length, 2);
  f.dispose();
});

test('open-ended questions keep search links inspectable without assigning them to factual claims', () => {
  const f = fixture(); f.records.setQuestion('分析当前情况');
  const result = completed({ id: crypto.randomUUID(), reading: f.records.getAIReading(), model: 'gpt-6.1-sol', effort: 'low', liveCheck: true }).interpretation;
  result.answer.factChecks = [];
  result.webCheck = { status: 'searched', searchCalls: 1, checkedAt: '2026-11-21T01:00:00Z', sources: [
    { url: 'https://example.org/market', title: '公开背景' }, { url: 'javascript:alert(1)', title: '无效' },
    { url: 'https://example.org/market', title: '公开背景' },
  ] };
  const node = renderAIInterpretation(f.document, result);
  const receipt = node.querySelector('.ai-search-receipt');
  assert.match(receipt.querySelector('summary').textContent, /检索来源 · 1/);
  assert.equal(receipt.querySelector('a').href, 'https://example.org/market');
  assert.ok(!receipt.open); assert.equal(node.querySelector('.ai-fact'), null);
  assert.ok(node.children.indexOf(node.querySelector('.record-prose')) < node.children.indexOf(node.querySelector('.ai-web-check')));
  result.webCheck.sources = [];
  const noLinks = renderAIInterpretation(f.document, result);
  assert.match(noLinks.textContent, /未返回来源链接/); assert.equal(noLinks.querySelectorAll('a').length, 0);
  f.dispose();
});

test('live option is opt-in, silent until submit and frozen while a request is unresolved', async () => {
  let submitted, resolve;
  const f = fixture({ aiClient: { generate: body => { submitted = body; return new Promise(done => { resolve = done; }); } } });
  const checkbox = f.find('ai-live-check');
  assert.equal(checkbox.checked, false);
  checkbox.checked = true; checkbox.dispatchEvent(new Event('change'));
  assert.equal(submitted, undefined); assert.match(f.find('ai-cost-hint').textContent, /联网另计/);
  f.input('ai-question', '近期发布信息如何影响我的安排？'); f.submit();
  assert.equal(submitted.liveCheck, true); assert.equal(typeof submitted.timeZone, 'string');
  assert.equal(checkbox.disabled, true);
  const result = completed(submitted);
  result.interpretation.webCheck = { status: 'searched', searchCalls: 1, checkedAt: '2026-11-09T08:00:00.000Z', sources: [] };
  result.interpretation.answer.factChecks = [{ claim: '发布时间', finding: '本次模拟保留信息缺口。', status: 'uncertain', sourceUrls: [] }];
  resolve(result); await settle();
  assert.equal(checkbox.disabled, false); assert.match(f.root.textContent, /已执行联网搜索/);
  checkbox.checked = false; checkbox.dispatchEvent(new Event('change'));
  assert.match(f.root.querySelector('.ai-result-body').textContent, /实时核查/);
  assert.equal(submitted.liveCheck, true);
  f.dispose();
});

test('fact citations render only known safe links and preserve hostile titles as text', () => {
  const f = fixture(); f.records.setQuestion('模拟事实问题');
  const body = { id: crypto.randomUUID(), reading: f.records.getAIReading(), model: 'gpt-6.1-sol', effort: 'low', maxOutputTokens: 3000, liveCheck: true };
  const result = completed(body).interpretation;
  result.webCheck = { status: 'searched', searchCalls: 1, checkedAt: '2026-11-09T08:00:00.000Z', sources: [
    { url: 'https://example.org/update', title: '<img onerror=alert(1)>来源' },
    { url: 'javascript:alert(1)', title: '危险地址' },
  ] };
  result.answer.factChecks = [{ claim: '<script>测试</script>', finding: '有资料支持这一模拟事实。', status: 'supported', sourceUrls: ['https://example.org/update', 'javascript:alert(1)', 'https://unknown.example/'] }];
  const node = renderAIInterpretation(f.document, result);
  const links = node.querySelectorAll('a');
  assert.equal(links.length, 1); assert.equal(links[0].href, 'https://example.org/update');
  assert.equal(links[0].rel, 'noopener noreferrer'); assert.match(links[0].textContent, /<img onerror=/);
  assert.equal(node.querySelectorAll('script').length, 0); assert.equal(node.querySelectorAll('img').length, 0);
  assert.match(node.textContent, /来源支持/); assert.doesNotMatch(node.textContent, /危险地址/);
  delete result.webCheck;
  const missing = renderAIInterpretation(f.document, result);
  assert.match(missing.textContent, /联网核查未完成/); assert.equal(missing.querySelectorAll('a').length, 0);
  f.dispose();
});
