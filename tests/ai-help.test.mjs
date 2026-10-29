import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHelpTip, initializeInlineHelp, disposeHelpTips, HELP_HOVER_DELAY_MS } from '../client/src/reading-help.mjs';

// Deterministic event/clock fixture. Browser checks own actual visual geometry,
// native focus and the tooltip's interaction with the glass-sheet compositor.
class Element extends EventTarget {
  constructor(tag, doc) { super(); this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attributes = {}; this.style = {}; this.className = ''; this._text = ''; this.hidden = false; this.rect = { left: 20, top: 20, width: 24, height: 24, bottom: 44 }; }
  set textContent(value) { this._text = String(value); for (const child of this.children) child.parent = null; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_value) { throw new Error('Unsafe HTML'); }
  get classList() { return { add: value => { this.className = `${this.className} ${value}`.trim(); } }; }
  get isConnected() { return this === this.ownerDocument.body || !!this.parent?.isConnected; }
  append(node) { node.parent = this; this.children.push(node); }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  getBoundingClientRect() {
    const isTip = this.className.split(' ').includes('help-tooltip');
    const isDetail = this.className.split(' ').includes('help-detail');
    if (!isTip && !isDetail) return { ...this.rect, right: this.rect.left + this.rect.width };
    const left = parseFloat(this.style.left) || 0, top = parseFloat(this.style.top) || 0;
    const width = Math.min(parseFloat(this.style.width) || (isTip ? 240 : 360), parseFloat(this.style.maxWidth) || Infinity);
    const height = Math.min(isTip ? 80 : 560, parseFloat(this.style.maxHeight) || Infinity);
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  focus() { this.ownerDocument.moveFocus(this); }
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
  doc.moveFocus = target => {
    const previous = doc.activeElement;
    if (previous === target) return;
    if (previous) {
      fire(previous, 'blur', { relatedTarget: target });
      for (let ancestor = previous; ancestor; ancestor = ancestor.parent) fire(ancestor, 'focusout', { relatedTarget: target });
    }
    doc.activeElement = target;
    if (target) { fire(target, 'focus', { relatedTarget: previous }); fire(doc, 'focusin', { target }); }
  };
  const byClass = className => descendants(doc.body).find(node => node.className.split(' ').includes(className));
  function sourceHelp(options = {}) {
    const button = doc.createElement('button');
    button.setAttribute('data-help', '量子随机来自 ANU 对量子真空涨落的测量。');
    button.setAttribute('data-help-label', '随机来源');
    button.setAttribute('data-help-more', 'random-sources');
    button.setAttribute('data-help-after', '选择只影响下一次洗牌。');
    doc.body.append(button);
    initializeInlineHelp(doc, { explanations: { 'random-sources': {
      title: '随机数从哪里来', sections: [{ title: '系统随机', paragraphs: ['<img onerror=evil()>安全文字', '本地生成。'] }],
      sources: [{ label: 'W3C', url: 'https://www.w3.org/TR/webcrypto/' }],
    } }, ...options });
    return button;
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
  return { doc, view, help, sourceHelp, fire, tick, timers, byClass,
    get popup() { return byClass('help-tooltip'); },
    get detail() { return byClass('help-detail'); },
    get more() { return byClass('help-more'); },
    dispose() { disposeHelpTips(doc); } };
}

test('a brief pass shows nothing; a dwell opens safe text without changing focus', () => {
  const f = fixture(), button = f.help({ text: '<img onerror=evil()>只是文字' });
  f.fire(button, 'pointerenter', { pointerType: 'mouse' }); f.tick(HELP_HOVER_DELAY_MS - 1); assert.equal(f.popup, undefined);
  f.fire(button, 'pointerleave'); f.tick(1000); assert.equal(f.popup, undefined);
  f.fire(button, 'pointerenter', { pointerType: 'mouse' }); f.tick(HELP_HOVER_DELAY_MS);
  assert.equal(f.popup.hidden, false); assert.equal(f.popup.textContent, '<img onerror=evil()>只是文字');
  assert.equal(f.popup.children.length, 1); assert.equal(f.popup.children[0].children[0].children.length, 0); assert.equal(button.getAttribute('aria-expanded'), 'true');
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
  assert.equal(f.popup.textContent, '新的说明'); assert.equal(f.doc.body.children.filter(node => node.className === 'reading-help-layer').length, 1);
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

function insideViewport(f, element) {
  const box = element.getBoundingClientRect();
  assert.ok(box.left >= 12 && box.right <= f.view.innerWidth - 12, JSON.stringify(box));
  assert.ok(box.top >= 12 && box.bottom <= f.view.innerHeight - 12, JSON.stringify(box));
}

test('More follows the definition and opens a safe, labelled adjacent card on wide screens', () => {
  const f = fixture(); f.view.innerWidth = 1280;
  const button = f.sourceHelp(); button.rect = { left: 130, top: 180, width: 24, height: 24, bottom: 204 };
  button.focus();
  assert.equal(f.popup.getAttribute('role'), 'dialog'); assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(f.popup.textContent, '量子随机来自 ANU 对量子真空涨落的测量。更多 ↗选择只影响下一次洗牌。');
  assert.equal(f.more.type, 'button');
  f.more.focus(); f.fire(f.more, 'click');
  assert.equal(f.detail.hidden, false); assert.equal(f.detail.getAttribute('role'), 'dialog'); assert.equal(f.detail.getAttribute('aria-modal'), 'false');
  assert.equal(f.more.getAttribute('aria-controls'), f.detail.id); assert.equal(f.more.getAttribute('aria-expanded'), 'true');
  assert.equal(f.doc.activeElement.id, f.detail.getAttribute('aria-labelledby'));
  assert.equal(f.detail.getAttribute('data-side'), 'right');
  assert.ok(f.detail.getBoundingClientRect().left > f.popup.getBoundingClientRect().right);
  assert.ok(f.detail.textContent.includes('<img onerror=evil()>安全文字'));
  const link = f.byClass('help-detail-sources').children[0];
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer'); assert.equal(link.getAttribute('href'), 'https://www.w3.org/TR/webcrypto/');
  insideViewport(f, f.popup); insideViewport(f, f.detail); f.dispose();
});

test('details choose the left edge or stack below the summary without viewport overflow', () => {
  const f = fixture(); f.view.innerWidth = 1100;
  const button = f.sourceHelp(); button.rect = { left: 1030, top: 520, width: 24, height: 24, bottom: 544 };
  button.focus(); f.fire(f.more, 'click');
  assert.equal(f.detail.getAttribute('data-side'), 'left');
  assert.ok(f.detail.getBoundingClientRect().right < f.popup.getBoundingClientRect().left);
  insideViewport(f, f.popup); insideViewport(f, f.detail);
  f.fire(f.view, 'resize'); f.view.innerWidth = 390; f.view.innerHeight = 640;
  button.rect = { left: 340, top: 592, width: 24, height: 24, bottom: 616 };
  f.fire(button, 'focus'); f.fire(f.more, 'click');
  assert.equal(f.detail.getAttribute('data-side'), 'below');
  assert.ok(f.detail.getBoundingClientRect().top > f.popup.getBoundingClientRect().bottom);
  insideViewport(f, f.popup); insideViewport(f, f.detail); f.dispose();
});

test('keyboard enters More and Escape closes detail, then tip, then reaches the sheet', () => {
  const f = fixture(), button = f.sourceHelp(); let propagated = 0;
  f.view.addEventListener('keydown', () => { propagated++; });
  button.focus();
  const tab = f.fire(button, 'keydown', { key: 'Tab', shiftKey: false });
  assert.equal(tab.defaultPrevented, true); assert.equal(f.doc.activeElement, f.more); assert.equal(f.popup.hidden, false);
  const backTab = f.fire(f.more, 'keydown', { key: 'Tab', shiftKey: true });
  assert.equal(backTab.defaultPrevented, true); assert.equal(f.doc.activeElement, button); assert.equal(f.popup.hidden, false);
  f.fire(button, 'keydown', { key: 'Tab', shiftKey: false }); assert.equal(f.doc.activeElement, f.more);
  f.fire(f.more, 'click');
  f.fire(f.view, 'keydown', { key: 'Escape' });
  assert.equal(f.detail.hidden, true); assert.equal(f.popup.hidden, false); assert.equal(f.doc.activeElement, f.more); assert.equal(propagated, 0);
  f.fire(f.view, 'keydown', { key: 'Escape' });
  assert.equal(f.popup.hidden, true); assert.equal(f.doc.activeElement, button); assert.equal(propagated, 0);
  f.tick(1000); assert.equal(f.popup.hidden, true);
  f.fire(f.view, 'keydown', { key: 'Escape' }); assert.equal(propagated, 1); f.dispose();
});

test('focus moves between summary and detail; leaving the help closes both surfaces', () => {
  const f = fixture(), button = f.sourceHelp(), outside = f.doc.createElement('input'); f.doc.body.append(outside);
  button.focus(); f.more.focus(); f.fire(f.more, 'click');
  const close = f.byClass('help-detail-close'); close.focus(); f.tick(1000);
  assert.equal(f.popup.hidden, false); assert.equal(f.detail.hidden, false);
  f.more.focus(); assert.equal(f.detail.hidden, false);
  close.focus(); f.fire(close, 'click'); assert.equal(f.detail.hidden, true); assert.equal(f.doc.activeElement, f.more);
  f.fire(f.more, 'click'); outside.focus();
  assert.equal(f.detail.hidden, true); assert.equal(f.popup.hidden, true); assert.equal(f.doc.activeElement, outside); f.dispose();
});

test('clicking nonfocusable detail text keeps it readable; subsequent outside focus still dismisses', () => {
  const f = fixture(), button = f.sourceHelp(), outside = f.doc.createElement('input'); f.doc.body.append(outside);
  button.focus(); f.more.focus(); f.fire(f.more, 'click');
  assert.equal(f.doc.activeElement.id, f.detail.getAttribute('aria-labelledby'));
  f.fire(f.detail, 'pointerenter');
  const paragraph = f.byClass('help-detail-section').children[1];
  f.fire(f.doc, 'pointerdown', { target: paragraph });
  // A native click on plain text removes the programmatic title focus with a
  // null relatedTarget. It must not erase the text being read or selected.
  f.doc.moveFocus(null); f.tick(1000);
  assert.equal(f.popup.hidden, false); assert.equal(f.detail.hidden, false);
  assert.equal(f.doc.activeElement, null); assert.ok(paragraph.isConnected);
  outside.focus();
  assert.equal(f.popup.hidden, true); assert.equal(f.detail.hidden, true); assert.equal(f.doc.activeElement, outside); f.dispose();
});

test('detail scrolling stays open; switching trigger, outside pointer and closure dismiss it', () => {
  const f = fixture(), first = f.sourceHelp(), second = f.sourceHelp();
  first.focus(); f.fire(f.more, 'click'); const detail = f.detail;
  f.fire(f.doc, 'scroll', { target: f.byClass('help-detail-content') }); assert.equal(detail.hidden, false);
  second.focus(); assert.equal(detail.hidden, true); assert.equal(first.getAttribute('aria-expanded'), 'false');
  f.fire(f.more, 'click'); assert.equal(f.detail, detail);
  f.fire(f.doc, 'pointerdown', { target: f.doc.body }); assert.equal(f.popup.hidden, true); assert.equal(detail.hidden, true);
  f.fire(second, 'focus'); f.fire(f.more, 'click'); f.fire(f.doc, 'reading:disclosurechange'); assert.equal(detail.hidden, true);
  f.fire(second, 'focus'); f.fire(f.more, 'click'); f.dispose();
  assert.equal(f.popup, undefined); assert.equal(f.detail, undefined); assert.equal(f.timers.size, 0);
});

test('material surfaces are reused and text refresh preserves injected optical children', () => {
  const f = fixture(); let calls = 0;
  const button = f.sourceHelp({ prepareSurface(host) {
    calls++;
    for (const surface of host.children) {
      if (surface.children.some(child => child.className === 'optical-layer')) continue;
      const optical = f.doc.createElement('span'); optical.className = 'optical-layer'; surface.append(optical);
    }
  } });
  button.focus(); const popup = f.popup, optical = popup.children[1];
  f.fire(f.more, 'click'); const detail = f.detail, detailOptical = detail.children[1];
  f.fire(f.view, 'keydown', { key: 'Escape' }); f.fire(f.view, 'keydown', { key: 'Escape' });
  f.fire(button, 'focus'); f.fire(f.more, 'click');
  assert.equal(f.popup, popup); assert.equal(f.detail, detail);
  assert.equal(f.popup.children[1], optical); assert.equal(f.detail.children[1], detailOptical);
  assert.equal(popup.children.length, 2); assert.equal(detail.children.length, 2); assert.ok(calls >= 4); f.dispose();
});
