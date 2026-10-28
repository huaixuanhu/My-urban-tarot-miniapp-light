import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHelpTip, initializeInlineHelp, disposeHelpTips, HELP_HOVER_DELAY_MS } from '../client/src/reading-help.mjs';

// Deterministic event/clock fixture. Browser checks own actual visual geometry,
// native focus and the tooltip's interaction with the glass-sheet compositor.
class Element extends EventTarget {
  constructor(tag, doc) { super(); this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attributes = {}; this.style = {}; this.className = ''; this._text = ''; this.hidden = false; this.rect = { left: 20, top: 20, width: 24, height: 24, bottom: 44 }; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_value) { throw new Error('Unsafe HTML'); }
  get classList() { return { add: value => { this.className = `${this.className} ${value}`.trim(); } }; }
  get isConnected() { return this === this.ownerDocument.body || !!this.parent?.isConnected; }
  append(node) { node.parent = this; this.children.push(node); }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  getBoundingClientRect() { return this.className === 'help-tooltip' ? { left: 0, top: 0, width: 240, height: 80, bottom: 80 } : this.rect; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}
function fixture() {
  const doc = new EventTarget(), view = new EventTarget(), timers = new Map();
  let next = 0, now = 0;
  view.innerWidth = 390; view.innerHeight = 844;
  view.setTimeout = (callback, delay) => { const id = ++next; timers.set(id, { callback, due: now + delay }); return id; };
  view.clearTimeout = id => timers.delete(id);
  doc.defaultView = view; doc.createElement = tag => new Element(tag, doc); doc.body = doc.createElement('body');
  const descendants = parent => parent.children.flatMap(child => [child, ...descendants(child)]);
  doc.querySelectorAll = selector => selector === 'button[data-help]' ? descendants(doc.body).filter(node => node.tagName === 'button' && node.getAttribute('data-help') !== null) : [];
  function help(options = {}) {
    const node = createHelpTip(doc, { label: '预算', text: '预算是上限。', ...options }); doc.body.append(node); return node.children[0];
  }
  function fire(target, type, extra = {}) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(extra)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event); return event;
  }
  function tick(ms) {
    const end = now + ms;
    while (true) {
      const item = [...timers].sort((a, b) => a[1].due - b[1].due).find(([, task]) => task.due <= end);
      if (!item) break;
      const [id, task] = item; timers.delete(id); now = task.due; task.callback();
    }
    now = end;
  }
  return { doc, view, help, fire, tick, timers,
    get popup() { return doc.body.children.find(node => node.className === 'help-tooltip'); },
    dispose() { disposeHelpTips(doc); } };
}

test('a brief pass shows nothing; a dwell opens safe text without changing focus', () => {
  const f = fixture(), button = f.help({ text: '<img onerror=evil()>只是文字' });
  f.fire(button, 'pointerenter', { pointerType: 'mouse' }); f.tick(HELP_HOVER_DELAY_MS - 1); assert.equal(f.popup, undefined);
  f.fire(button, 'pointerleave'); f.tick(1000); assert.equal(f.popup, undefined);
  f.fire(button, 'pointerenter', { pointerType: 'mouse' }); f.tick(HELP_HOVER_DELAY_MS);
  assert.equal(f.popup.hidden, false); assert.equal(f.popup.textContent, '<img onerror=evil()>只是文字');
  assert.equal(f.popup.children.length, 0); assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.getAttribute('aria-describedby'), f.popup.id); assert.equal(f.doc.activeElement, undefined);
  f.dispose();
});

test('pointer can cross the gap and read the tooltip, then dismiss by leaving both', () => {
  const f = fixture(), button = f.help();
  f.fire(button, 'pointerenter'); f.tick(500); f.fire(button, 'pointerleave'); f.tick(80);
  f.fire(f.popup, 'pointerenter'); f.tick(1000); assert.equal(f.popup.hidden, false);
  f.fire(f.popup, 'pointerleave'); f.tick(160); assert.equal(f.popup.hidden, true);
  assert.equal(button.getAttribute('aria-describedby'), null); f.dispose();
});

test('keyboard focus shows help immediately and first Escape stays above the sheet handler', () => {
  const f = fixture(), button = f.help(); let propagated = 0;
  // The help listener is on window capture, before the application's document handler.
  f.view.addEventListener('keydown', () => { propagated++; });
  f.fire(button, 'focus'); assert.equal(f.popup.hidden, false);
  const first = f.fire(f.view, 'keydown', { key: 'Escape' });
  assert.equal(first.defaultPrevented, true); assert.equal(propagated, 0); assert.equal(f.popup.hidden, true);
  f.fire(f.view, 'keydown', { key: 'Escape' }); assert.equal(propagated, 1);
  f.fire(button, 'focus'); f.fire(button, 'blur'); assert.equal(f.popup.hidden, true); f.dispose();
});

test('touch click opens without a hover timer; click toggles and never submits a form', () => {
  const f = fixture(), button = f.help();
  f.fire(button, 'pointerenter', { pointerType: 'touch' }); f.tick(1000); assert.equal(f.popup, undefined);
  f.fire(button, 'focus'); const click = f.fire(button, 'click');
  assert.equal(button.type, 'button'); assert.equal(click.defaultPrevented, true); assert.equal(f.popup.hidden, false);
  f.fire(button, 'click'); assert.equal(f.popup.hidden, true); f.dispose();
});

test('only one help is visible, follows current explanatory text, and stays within the viewport', () => {
  const f = fixture(), one = f.help(), two = f.help({ label: '强度', id: 'effort-explanation' });
  one.rect = { left: 365, top: 806, width: 24, height: 24, bottom: 830 };
  f.fire(one, 'focus'); assert.equal(f.popup.getAttribute('data-side'), 'above');
  assert.ok(parseFloat(f.popup.style.left) >= 12); assert.ok(parseFloat(f.popup.style.left) + 240 <= 378);
  two.setAttribute('data-help', '新的说明'); f.fire(two, 'focus');
  assert.equal(one.getAttribute('aria-expanded'), 'false'); assert.equal(f.popup.id, 'effort-explanation');
  assert.equal(f.popup.textContent, '新的说明'); assert.equal(f.doc.body.children.filter(node => node.className === 'help-tooltip').length, 1);
  f.dispose();
});

test('outside action, sheet closure, scrolling and disposal cancel both open and pending tips', () => {
  const f = fixture(), button = f.help(), outside = f.doc.createElement('input'); f.doc.body.append(outside);
  f.fire(button, 'focus'); f.fire(f.doc, 'pointerdown', { target: outside }); assert.equal(f.popup.hidden, true);
  f.fire(button, 'focus'); f.fire(f.doc, 'reading:disclosurechange'); assert.equal(f.popup.hidden, true);
  f.fire(button, 'focus'); f.fire(f.doc, 'scroll', { target: outside }); assert.equal(f.popup.hidden, true);
  f.fire(button, 'pointerenter'); f.fire(f.doc, 'reading:disclosurechange'); f.tick(1000); assert.equal(f.popup.hidden, true);
  f.fire(button, 'pointerenter'); f.dispose(); f.tick(1000); assert.equal(f.popup, undefined); assert.equal(f.timers.size, 0);
});

test('static buttons hydrate once, preserve existing descriptions and dispose cleanly', () => {
  const f = fixture(), button = f.doc.createElement('button');
  button.setAttribute('data-help', '静态说明'); button.setAttribute('data-help-label', '视角'); button.setAttribute('aria-describedby', 'original-description'); f.doc.body.append(button);
  const cleanup = initializeInlineHelp(f.doc); initializeInlineHelp(f.doc);
  assert.equal(button.getAttribute('aria-label'), '视角说明');
  f.fire(button, 'focus'); assert.equal(button.getAttribute('aria-describedby'), `original-description ${f.popup.id}`);
  f.fire(button, 'blur'); assert.equal(button.getAttribute('aria-describedby'), 'original-description');
  f.fire(button, 'pointerenter'); cleanup(); f.tick(1000); assert.equal(f.popup.hidden, true); f.dispose();
});
