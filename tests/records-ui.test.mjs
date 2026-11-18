import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEventListeners } from 'node:events';
import { registerHooks } from 'node:module';
import { createReading, reduceReading } from '../client/src/reading-state.mjs';
import { recordDisplayTitle } from '../client/src/reading-record-view.mjs';
import { buildStoredRecord } from '../shared/record-schema.mjs';

const artHook = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === './reading-art.mjs' && context.parentURL?.endsWith('/reading-records.mjs')) return { shortCircuit: true, url: 'data:text/javascript,export const readingCardImage = id => `/test-art/${id}.webp`;' };
  return nextResolve(specifier, context);
} });
const { createReadingRecords } = await import('../client/src/reading-records.mjs');
artHook.deregister();

// Behavioral DOM double; actual layout and browser focus are checked separately.
class Element extends EventTarget {
  constructor(tag, document) { super(); Object.assign(this, { tagName: tag, ownerDocument: document, children: [], attributes: {}, style: {}, className: '', _text: '', _value: '', hidden: false, disabled: false, scrollTop: 0 }); }
  get textContent() { return this._text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  set innerHTML(_) { throw new Error('Unsafe HTML rendering'); }
  get value() { return this._value || (this.tagName === 'select' ? this.children[0]?.value || '' : ''); }
  set value(value) { this._value = String(value); }
  get classList() { return { add: name => this.classList.toggle(name, true), toggle: (name, force) => { const names = new Set(this.className.split(' ').filter(Boolean)); (force ?? !names.has(name)) ? names.add(name) : names.delete(name); this.className = [...names].join(' '); } }; }
  append(...children) { children.forEach(child => { this.children.push(child); if (typeof child !== 'string') child.parent = this; }); }
  replaceChildren(...children) { this.children.forEach(child => { if (typeof child !== 'string') child.parent = null; }); this._text = ''; this.children = []; this.append(...children); }
  contains(node) { return this === node || this.children.some(child => typeof child !== 'string' && child.contains(node)); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  querySelectorAll(selector) {
    const selectors = selector.split(','), results = [];
    const matches = element => selectors.some(item => item.startsWith('.') ? element.className.split(' ').includes(item.slice(1)) : item.startsWith('#') ? element.id === item.slice(1) : element.tagName === item);
    const visit = element => { for (const child of element.children) if (typeof child !== 'string') { if (matches(child)) results.push(child); visit(child); } };
    visit(this); return results;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
class Document extends EventTarget {
  constructor() { super(); this.defaultView = new EventTarget(); this.defaultView.confirm = () => true; }
  createElement(tag) { return new Element(tag, this); }
}
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function record(id = 'one', question = '第一句话？还有完整的第二句话。', savedAt = '2026-11-08T03:04:00.000Z') {
  const cards = [{ physicalId: 0, sourceCardId: 'major-00', reversed: false, drawOrder: 1, zIndex: 1, x: 0, z: -1, positionLabel: '', sourceSnapshot: { name: 'The Fool', theme: '原始主题', interpretation: '原始牌义', urbanImagery: '画面文字' } }];
  return { id, savedAt, startedAt: savedAt, question, spread: { type: 'free', name: '自由摆牌' }, cards, cardCount: 1, interpretation: '我自己的观察', reflection: '回看时的想法', aiInterpretations: [answer('a', '第一份完整解读', cards), answer('b', '第二份完整解读', cards)] };
}
function answer(id, text, cards) {
  return { id, status: 'completed', model: 'gpt-6.1-terra', detail: 'standard', focus: 'general', effort: 'low', createdAt: '2026-11-08T03:05:00.000Z', reading: { question: '保存的问题', cards }, answer: { summary: text, cards: cards.map(card => ({ sourceCardId: card.sourceCardId, reversed: false, basis: 'provided_meaning', positionLabel: '', interpretation: text })), reflectionQuestions: ['一个反思问题'], limitations: [] } };
}
const stored = body => buildStoredRecord(body, { savedAt: '2026-11-16T03:04:00.000Z', createdBy: 'synthetic-test-subject' });
function fixture({ client = {}, mode = 'shared' } = {}) {
  const document = new Document(), root = document.createElement('div'), calls = { list: 0, get: 0, save: 0 };
  globalThis.window = document.defaultView;
  let reading = createReading({ reversed: Array(78).fill(false) });
  reading = reduceReading(reading, { type: 'draw', id: 0, x: 0, z: -1 }); reading = reduceReading(reading, { type: 'reveal', id: 0 });
  const open = () => { const event = new Event('reading:disclosurechange'); event.detail = { id: 'reading-records', open: true }; document.dispatchEvent(event); };
  const records = createReadingRecords({ root, getReading: () => reading, getBusy: () => false, disclosures: { open }, accessContext: { mode }, client: {
    async list(cursor) { calls.list++; return client.list ? client.list(cursor) : { records: [record()], nextCursor: null }; },
    async get(id) { calls.get++; return client.get ? client.get(id) : { record: record(id) }; },
    async save(body) { calls.save++; return client.save ? client.save(body) : { record: stored(body) }; },
  } });
  const find = selector => root.querySelector(selector);
  const input = (id, value) => { const element = find(`#${id}`); element.value = value; element.dispatchEvent(new Event('input')); };
  return { root, document, records, calls, open, find, input, reading, dispose() { records.dispose(); delete globalThis.window; } };
}

test('display titles use the first sentence without altering original questions or splitting decimal values', () => {
  assert.equal(recordDisplayTitle('  我想了解什么？\n补充内容。'), '我想了解什么？');
  assert.equal(recordDisplayTitle('At 187.50, what changes? More context.'), 'At 187.50, what changes?');
  assert.equal(recordDisplayTitle('First sentence. Second sentence.'), 'First sentence.');
  assert.equal(recordDisplayTitle(' '), '未命名的占卜');
  assert.equal(Array.from(recordDisplayTitle('长'.repeat(1500))).length, 88);
});

test('More always enters date-grouped history while explicit save entry preserves the current draft', async t => {
  const f = fixture({ client: { list: async () => ({ records: [record('older', '旧问题。', '2026-11-06T03:00:00Z'), record('newer')], nextCursor: null }) } }); t.after(f.dispose);
  assert.equal(f.calls.list, 0); f.input('record-question', '正在写的问题'); f.input('record-interpretation', '保留的草稿');
  f.records.openCurrent(); assert.equal(f.find('.record-current').hidden, false); assert.equal(f.calls.list, 0);
  f.open(); await settle();
  assert.equal(f.find('.record-history').hidden, false); assert.equal(f.find('.record-current').hidden, true);
  assert.equal(f.root.querySelectorAll('.record-day-group').length, 2);
  assert.equal(f.root.querySelectorAll('.record-history-row')[0].getAttribute('data-record-id'), 'newer');
  assert.equal(f.find('.record-title').textContent, '第一句话？');
  f.records.openCurrent(); assert.equal(f.find('.record-current').hidden, false);
  assert.equal(f.records.getQuestion(), '正在写的问题'); assert.equal(f.find('#record-interpretation').value, '保留的草稿');
  assert.equal(f.calls.list, 1); assert.equal(f.calls.save, 0);
});

test('details retain full question, notes, spread and all selectable AI versions; return restores row focus and scroll', async t => {
  const saved = record('one', `第一句话？\n${'保留完整背景与问题。'.repeat(100)}`), frozen = structuredClone(saved);
  const f = fixture({ client: { get: async () => ({ record: saved }) } }); t.after(f.dispose);
  f.open(); await settle(); const row = f.find('.record-history-row'); f.root.scrollTop = 208; row.click(); await settle();
  assert.equal(f.find('.record-full-question').textContent, saved.question);
  assert.equal(f.find('.record-full-question').tagName, 'p');
  assert.equal(f.find('.record-detail-title').textContent, '第一句话？');
  assert.equal(f.find('.record-detail-title').tagName, 'h3');
  assert.equal(f.find('.record-supplement'), null);
  assert.match(f.find('.record-detail').textContent, /我自己的观察/); assert.ok(f.find('.record-spread'));
  assert.equal(Boolean(f.find('.record-source-details').open), false);
  assert.equal(f.root.querySelectorAll('.record-ai-body').length, 1);
  assert.match(f.find('.record-ai-body').textContent, /第一份完整解读/); assert.doesNotMatch(f.find('.record-ai-body').textContent, /第二份完整解读/);
  const select = f.find('.record-ai-picker').querySelector('select'); select.value = '1'; select.dispatchEvent(new Event('change'));
  assert.match(f.find('.record-ai-body').textContent, /第二份完整解读/); assert.doesNotMatch(f.find('.record-ai-body').textContent, /第一份完整解读/);
  assert.deepEqual(saved, frozen);
  f.find('.record-back').click(); assert.equal(f.find('.record-history').hidden, false); assert.equal(f.root.scrollTop, 208); assert.equal(f.document.activeElement, row); assert.equal(f.calls.list, 1);
});

test('record version replacement, reopening and teardown release their dynamic help', async () => {
  const f = fixture(), tips = () => f.find('.record-detail').querySelectorAll('.help-trigger');
  f.open(); await settle(); const row = f.find('.record-history-row'); row.click(); await settle();
  const firstTips = tips(); assert.ok(firstTips.length > 0);
  const select = f.find('.record-ai-picker').querySelector('select'); select.value = '1'; select.dispatchEvent(new Event('change'));
  assert.ok(firstTips.every(tip => getEventListeners(tip, 'focus').length === 0));
  const secondTips = tips(); f.find('.record-back').click(); row.click(); await settle();
  assert.ok(secondTips.every(tip => getEventListeners(tip, 'focus').length === 0));
  const reopenedTips = tips(); f.dispose();
  assert.ok(reopenedTips.every(tip => getEventListeners(tip, 'focus').length === 0));
  const guest = fixture({ mode: 'guest' }), guestTip = guest.find('.help-trigger');
  guest.records.openHistory();
  assert.equal(getEventListeners(guestTip, 'focus').length, 0);
  const newGuestTip = guest.find('.help-trigger'); assert.equal(getEventListeners(newGuestTip, 'focus').length, 1);
  guest.dispose(); assert.equal(getEventListeners(newGuestTip, 'focus').length, 0);
});

test('back stays available during detail loading and an abandoned response never reopens detail', async t => {
  const pending = deferred(), f = fixture({ client: { get: () => pending.promise } }); t.after(f.dispose);
  f.open(); await settle(); const row = f.find('.record-history-row'); f.root.scrollTop = 90; row.click();
  assert.equal(f.find('.record-detail').getAttribute('aria-busy'), 'true'); f.find('.record-back').click();
  pending.resolve({ record: record() }); await settle();
  assert.equal(f.find('.record-detail').hidden, true); assert.equal(f.find('.record-history').hidden, false);
  assert.equal(f.root.scrollTop, 90); assert.equal(f.document.activeElement, row);
});

test('detail failure supports back and retry; switching to the draft ignores a late retry', async t => {
  const pending = deferred(); let attempts = 0;
  const f = fixture({ client: { get: () => ++attempts === 1 ? Promise.reject(new Error('合成读取失败')) : pending.promise } }); t.after(f.dispose);
  f.input('record-question', '草稿还在'); f.open(); await settle(); f.find('.record-history-row').click(); await settle();
  assert.match(f.find('.record-detail').textContent, /合成读取失败/); assert.ok(f.find('.record-back'));
  f.find('.record-detail').querySelectorAll('button').find(node => node.textContent === '重新打开').click();
  f.records.openCurrent(); pending.resolve({ record: record() }); await settle();
  assert.equal(f.find('.record-current').hidden, false); assert.equal(f.find('.record-detail').hidden, true); assert.equal(f.records.getQuestion(), '草稿还在');
});

test('pagination merges date groups, deduplicates rows, and repeated clicks issue one in-flight request', async t => {
  const pending = deferred();
  const f = fixture({ client: { list: cursor => cursor ? pending.promise : { records: [record()], nextCursor: 'next' } } }); t.after(f.dispose);
  f.open(); await settle(); const more = f.find('.record-load-more'); more.click(); more.click();
  assert.equal(f.calls.list, 2); assert.equal(more.disabled, true);
  pending.resolve({ records: [record(), record('two', '另一个问题。', '2026-11-08T02:00:00.000Z')], nextCursor: null }); await settle();
  assert.equal(f.root.querySelectorAll('.record-history-row').length, 2); assert.equal(f.root.querySelectorAll('.record-day-group').length, 1); assert.equal(f.find('.record-load-more'), null);
});

test('a refreshed list ignores stale failures and a failed next page stays retryable', async t => {
  const first = deferred(); let attempts = 0;
  const f = fixture({ client: { list: cursor => { if (cursor) throw new Error('下一页读取失败'); return ++attempts === 1 ? first.promise : { records: [record()], nextCursor: 'next' }; } } }); t.after(f.dispose);
  f.open(); f.open(); await settle(); first.reject(new Error('过时错误')); await settle();
  assert.doesNotMatch(f.find('.record-history').textContent, /过时错误/); assert.ok(f.find('.record-history-row'));
  const more = f.find('.record-load-more'); more.click(); await settle();
  assert.equal(more.disabled, false); assert.equal(more.textContent, '重新读取更多'); assert.match(f.root.textContent, /下一页读取失败/);
});

test('opening a record during pagination keeps the original list and allows paging after return', async t => {
  const page = deferred();
  const f = fixture({ client: { list: cursor => cursor ? page.promise : { records: [record()], nextCursor: 'next' } } }); t.after(f.dispose);
  f.open(); await settle(); f.find('.record-load-more').click(); f.find('.record-history-row').click(); await settle();
  page.resolve({ records: [record('late')], nextCursor: null }); await settle(); f.find('.record-back').click();
  assert.equal(f.root.querySelectorAll('.record-history-row').length, 1);
  assert.equal(f.find('.record-load-more').disabled, false); assert.equal(f.find('.record-load-more').textContent, '加载更多');
});

test('guest presentation makes no history/detail/save requests and offers an honest local login entry', async t => {
  const f = fixture({ mode: 'guest' }); t.after(f.dispose);
  f.open(); f.records.openCurrent(); f.records.openHistory();
  f.find('form').dispatchEvent(new Event('submit', { cancelable: true })); f.find('.record-guest-entry').click(); await settle();
  assert.deepEqual(f.calls, { list: 0, get: 0, save: 0 }); assert.equal(f.find('.record-current').hidden, true);
  assert.match(f.root.textContent, /账号登录尚未接入/);
  assert.doesNotMatch(f.root.textContent, /离开页面后清空/);
  assert.match(f.find('.record-history').querySelector('.help-trigger').getAttribute('data-help'), /离开页面后清空/);
  assert.equal(f.find('.record-navigation').querySelectorAll('button')[1].hidden, true);
});

test('record source context stays visible while receipt and reversal explanations live in matching help', async t => {
  const saved = record();
  saved.randomness = { source: 'anu', fetchedAt: '2026-11-08T01:00:00.000Z', consumed: 155 };
  saved.cards[0].reversed = true;
  const f = fixture({ client: { get: async () => ({ record: saved }) } }); t.after(f.dispose);
  f.open(); await settle(); f.find('.record-history-row').click(); await settle();
  const detail = f.find('.record-detail'), help = detail.querySelectorAll('.help-trigger');
  assert.doesNotMatch(detail.textContent, /消耗 155|原版资料没有单独/);
  const quantum = help.find(node => node.getAttribute('aria-label') === '本次量子随机来源说明');
  const reversal = help.find(node => node.getAttribute('aria-label') === '逆位资料说明');
  assert.match(quantum.getAttribute('data-help'), /获取于.*消耗 155/);
  assert.match(reversal.getAttribute('data-help'), /原版资料没有单独的逆位牌义/);
  assert.match(detail.textContent, /量子|逆位资料|原始牌义/);
  assert.deepEqual(f.calls, { list: 1, get: 1, save: 0 });
});

test('current entry carries the shared question, labels, spread and selected matching AI preview before human notes', t => {
  const f = fixture(); t.after(f.dispose);
  f.records.setQuestion('已经在解读里写好的问题'); f.records.setLabel(0, '当下');
  const reading = f.records.getAIReading(), result = { ...answer(crypto.randomUUID(), '完整的附带解读', reading.cards), reading };
  f.records.setAIResults([result]); f.records.openCurrent();
  assert.equal(f.find('#record-question').value, reading.question);
  assert.equal(f.find('.record-card-fields').querySelector('input').value, '当下');
  const image = f.find('.record-current-spread').querySelector('img');
  assert.equal(image.src, '/test-art/0.webp'); assert.equal(image.style.left, '50%');
  assert.match(f.find('.record-attached-ai').textContent, /完整的附带解读/);
  assert.equal(f.find('.record-ai-choices').querySelector('input').checked, true);
  assert.equal(f.find('#record-interpretation').value, '');
  const formChildren = f.find('form').children;
  assert.ok(formChildren.indexOf(f.find('.record-attached-ai')) < formChildren.indexOf(f.find('#record-interpretation').parent));
  const checkbox = f.find('.record-ai-choices').querySelector('input'); checkbox.checked = false; checkbox.dispatchEvent(new Event('change'));
  assert.equal(f.find('.record-attached-ai').hidden, true);
  checkbox.checked = true; checkbox.dispatchEvent(new Event('change'));
  const priorTips = f.find('.record-attached-ai').querySelectorAll('.help-trigger');
  f.reading.placed[0].x = 1; f.records.update();
  assert.equal(f.find('.record-ai-choices').hidden, true); assert.equal(f.find('.record-attached-ai').hidden, true);
  assert.ok(priorTips.every(tip => getEventListeners(tip, 'focus').length === 0));
  assert.deepEqual(f.calls, { list: 0, get: 0, save: 0 });
});

test('successful save displays its canonical returned detail and unchanged reentry retains the receipt', async t => {
  let saved, carried;
  const f = fixture({ client: {
    save: async body => { assert.deepEqual(body.aiInterpretationIds, [carried.id]); saved = { ...stored(body), aiInterpretations: [structuredClone(carried)] }; return { record: saved }; },
    list: async () => ({ records: saved ? [saved] : [], nextCursor: null }),
  } }); t.after(f.dispose);
  f.records.setQuestion('本次保存的问题'); f.input('record-interpretation', '自己的观察'); f.records.openCurrent();
  const reading = f.records.getAIReading(); carried = { ...answer(crypto.randomUUID(), '随本次保存的完整AI解读', reading.cards), reading }; f.records.setAIResults([carried]);
  f.find('form').dispatchEvent(new Event('submit', { cancelable: true })); await settle();
  assert.equal(f.find('.record-current').hidden, true); assert.equal(f.find('.record-detail').hidden, false);
  assert.equal(f.find('.record-saved-confirmation').textContent, '已保存');
  assert.match(f.find('.record-detail').textContent, /本次保存的问题|自己的观察/);
  assert.match(f.find('.record-detail').querySelector('.record-ai-body').textContent, /随本次保存的完整AI解读/);
  assert.equal(f.calls.save, 1); assert.equal(f.calls.get, 0);
  assert.equal(f.document.activeElement, f.find('.record-detail'));
  f.records.openCurrent(); assert.equal(f.find('.record-detail').hidden, false); assert.equal(f.calls.save, 1);
  assert.equal(f.find('.record-navigation').querySelectorAll('button')[1].textContent, '查看本次记录');
  f.find('.record-back').click(); await settle();
  assert.equal(f.calls.list, 1); assert.equal(f.find('.record-history-row').getAttribute('data-record-id'), saved.id);
  f.records.setQuestion('补充后的问题'); f.records.openCurrent();
  assert.equal(f.find('.record-current').hidden, false); assert.equal(f.find('.record-primary').textContent, '保存为新记录');
  assert.equal(f.find('#record-interpretation').value, '自己的观察');
  f.records.setQuestion('本次保存的问题');
  assert.equal(f.records.mayReset(), true); f.records.openCurrent();
  assert.equal(f.find('.record-detail').hidden, false);
});

test('returning from the current receipt reloads a full history refresh abandoned before it completed', async t => {
  const refresh = deferred(); let saved, lists = 0;
  const f = fixture({ client: {
    save: async body => { saved = stored(body); return { record: saved }; },
    list: () => ++lists === 2 ? refresh.promise : { records: [saved], nextCursor: null },
  } }); t.after(f.dispose);
  f.records.setQuestion('中途切换后仍可找回的记录'); f.records.openCurrent();
  f.find('form').dispatchEvent(new Event('submit', { cancelable: true })); await settle();
  f.find('.record-back').click(); await settle();
  assert.equal(f.calls.list, 1); assert.ok(f.find('.record-history-row'));
  f.records.openHistory(); assert.equal(f.find('.record-history').getAttribute('aria-busy'), 'true');
  assert.match(f.find('.record-history').textContent, /正在读取/);
  f.records.openCurrent(); assert.equal(f.find('.record-detail').hidden, false);
  refresh.resolve({ records: [saved], nextCursor: null }); await settle();
  f.find('.record-back').click(); await settle();
  assert.equal(f.calls.list, 3);
  assert.equal(f.find('.record-history').getAttribute('aria-busy'), 'false');
  assert.equal(f.find('.record-history-row').getAttribute('data-record-id'), saved.id);
  assert.doesNotMatch(f.find('.record-history').textContent, /正在读取/);
});

test('supplementing the current receipt retains its draft and saves a new immutable record', async t => {
  const saved = [], requests = [];
  const f = fixture({ client: { save: async body => {
    requests.push(structuredClone(body));
    const record = stored(body); saved.push(record); return { record };
  } } }); t.after(f.dispose);
  f.records.setQuestion('这次想保留的问题'); f.records.setLabel(0, '当下');
  f.input('record-interpretation', '最初的观察'); f.records.openCurrent();
  f.find('form').dispatchEvent(new Event('submit', { cancelable: true })); await settle();
  const original = structuredClone(saved[0]);
  f.root.scrollTop = 180; f.find('.record-supplement').click();
  assert.equal(f.find('.record-current').hidden, false); assert.equal(f.find('.record-detail').hidden, true);
  assert.equal(f.root.scrollTop, 0); assert.equal(f.find('.record-status').textContent, '');
  assert.equal(f.find('#record-question').value, original.question);
  assert.equal(f.find('.record-card-fields').querySelector('input').value, '当下');
  assert.equal(f.find('#record-interpretation').value, '最初的观察');
  assert.equal(f.find('.record-primary').disabled, true); assert.equal(f.calls.save, 1);
  f.input('record-reflection', '补充一条之后的感受');
  assert.equal(f.find('.record-primary').textContent, '保存为新记录');
  assert.equal(f.find('.record-primary').disabled, false);
  f.find('form').dispatchEvent(new Event('submit', { cancelable: true })); await settle();
  assert.equal(f.calls.save, 2); assert.notEqual(requests[1].id, requests[0].id);
  assert.deepEqual(saved[0], original);
  assert.equal(saved[1].interpretation, '最初的观察'); assert.equal(saved[1].reflection, '补充一条之后的感受');
  assert.match(f.find('.record-detail').textContent, /补充一条之后的感受/);
  assert.equal(f.find('.record-saved-confirmation').textContent, '已保存');
});

test('unknown save retains the draft and retry confirms exactly one frozen record without accepting duplicate clicks', async t => {
  const first = deferred(), retry = deferred(), requests = [];
  const f = fixture({ client: { save: body => { requests.push(body); return requests.length === 1 ? first.promise : retry.promise; } } }); t.after(f.dispose);
  f.records.setQuestion('保留这份内容'); f.records.openCurrent();
  const submit = () => f.find('form').dispatchEvent(new Event('submit', { cancelable: true }));
  submit(); submit(); assert.equal(f.calls.save, 1); first.reject(new Error('保存结果待确认')); await settle();
  assert.equal(f.find('.record-current').hidden, false); assert.equal(f.find('#record-question').value, '保留这份内容');
  assert.equal(f.find('#record-question').disabled, true); assert.equal(f.find('.record-primary').textContent, '确认并重试保存');
  f.reading.placed[0].x = 2; f.records.update(); submit(); submit();
  assert.equal(f.calls.save, 2); assert.deepEqual(requests[1], requests[0]);
  retry.resolve({ record: stored(requests[1]) }); await settle();
  assert.equal(f.find('.record-saved-confirmation').textContent, '已保存');
  assert.equal(f.find('.record-detail').querySelector('img').style.left, '50%');
  f.records.openCurrent(); assert.equal(f.find('.record-current').hidden, false);
  assert.equal(f.find('.record-current-spread').querySelector('img').style.left, `${9.5 / 15 * 100}%`);
});

test('save completion refreshes an open history without moving the user into detail', async t => {
  const pending = deferred(); let saved;
  const f = fixture({ client: {
    save: body => { saved = stored(body); return pending.promise; },
    list: async () => ({ records: [], nextCursor: null }),
  } }); t.after(f.dispose);
  f.records.openCurrent(); f.find('form').dispatchEvent(new Event('submit', { cancelable: true }));
  f.records.openHistory(); await settle(); pending.resolve({ record: saved }); await settle();
  assert.equal(f.find('.record-history').hidden, false); assert.equal(f.find('.record-detail').hidden, true);
  assert.equal(f.calls.list, 2); assert.equal(f.calls.save, 1); assert.equal(f.calls.get, 0);
});

test('AI completion during save stays in the draft while the receipt shows only the frozen saved content', async t => {
  const pending = deferred(); let saved;
  const f = fixture({ client: { save: body => { saved = stored(body); return pending.promise; } } }); t.after(f.dispose);
  f.records.setQuestion('保存中的问题'); f.records.openCurrent();
  const reading = f.records.getAIReading();
  f.find('form').dispatchEvent(new Event('submit', { cancelable: true }));
  f.records.setAIResults([{ ...answer(crypto.randomUUID(), '保存期间才完成的解读', reading.cards), reading }]);
  pending.resolve({ record: saved }); await settle();
  assert.equal(f.find('.record-detail').hidden, false); assert.equal(f.find('.record-detail').querySelector('.record-ai-body'), null);
  f.records.openCurrent(); assert.equal(f.find('.record-current').hidden, false);
  assert.match(f.find('.record-attached-ai').textContent, /保存期间才完成的解读/);
  assert.equal(f.find('.record-primary').textContent, '保存为新记录');
  f.document.defaultView.confirm = () => false; assert.equal(f.records.mayReset(), false);
});
