import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { createReadingAI } from '../client/src/reading-ai.mjs';
import { renderAIInterpretation } from '../client/src/reading-ai-render.mjs';
import { createReading, reduceReading } from '../client/src/reading-state.mjs';

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
  constructor(tag, document) { super(); this.tagName = tag; this.ownerDocument = document; this.children = []; this.attributes = {}; this.style = {}; this._value = ''; this._text = ''; this.hidden = false; this.disabled = false; this.className = ''; }
  get textContent() { return this._text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  set innerHTML(_value) { throw new Error('Unsafe HTML rendering'); }
  get value() { return this._value || (this.tagName === 'select' ? this.children[0]?.value || '' : ''); }
  set value(value) { this._value = String(value); }
  get options() { return this.children; }
  get classList() { return { add: name => this.classList.toggle(name, true), toggle: (name, force) => { const values = new Set(this.className.split(' ').filter(Boolean)); (force ?? !values.has(name)) ? values.add(name) : values.delete(name); this.className = [...values].join(' '); } }; }
  append(...items) { for (const item of items) { this.children.push(item); if (typeof item !== 'string') item.parent = this; } }
  replaceChildren(...items) { this._text = ''; this.children = []; this.append(...items); }
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
function fixture({ aiClient, recordClient } = {}) {
  const document = new Document(), root = document.createElement('div'), recordRoot = document.createElement('div');
  globalThis.window = document.defaultView;
  let reading = spread(), busy = false; const opened = [];
  const disclosures = { open: id => opened.push(id) };
  const recordRequests = [], requests = [];
  const records = createReadingRecords({ root: recordRoot, getReading: () => reading, getBusy: () => busy, disclosures,
    client: recordClient || { save: async body => { recordRequests.push(body); return { record: body }; } } });
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
  f.input('ai-effort', 'high', 'change'); assert.equal(f.find('ai-budget').value, '12000');
  f.input('ai-model', 'gpt-6.1-sol', 'change'); assert.equal(f.requests.length, 0);
  f.busy = true; f.submit(); assert.equal(f.requests.length, 0);
  f.busy = false; f.reading = reduceReading(f.reading, { type: 'draw', id: 1, x: 1, z: -1 }); f.submit(); assert.equal(f.requests.length, 0);
  f.dispose();
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
  assert.match(f.root.textContent, /输入 111 · 生成 222/);
  f.dispose();
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
  aiDone(completed(aiBody)); await settle(); saveDone({ record: savedBody }); await settle();
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
  assert.match(node.textContent, /<script>evil\(\)<\/script>/); assert.match(node.textContent, /输入 111 · 生成 222/);
  f.dispose();
});

test('source basis markers render understandable Chinese and never leak internal enum values', () => {
  const f = fixture(); f.records.setQuestion('含义说明测试');
  const body = { id: crypto.randomUUID(), reading: f.records.getAIReading(), model: 'gpt-6.1-terra', effort: 'low', maxOutputTokens: 3000 };
  for (const [basis, label] of [['provided_meaning', '依据原始牌义'], ['generated_reversal_extension', '逆位：基于原始牌义的延伸解释'], ['unknown_internal_basis', '结合本次牌面与问题的解释']]) {
    const result = completed(body).interpretation; result.answer.cards[0].basis = basis;
    const node = renderAIInterpretation(f.document, result);
    assert.ok(node.textContent.includes(label)); assert.ok(!node.textContent.includes(basis));
  }
  f.dispose();
});
