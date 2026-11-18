import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSheetDrag } from '../client/src/reading-sheet-drag.mjs';

function fixture() {
  const view = new EventTarget(), panel = new EventTarget(), attrs = new Set();
  let captured, open = true, resizeFrame, resizePanel;
  const bounds = { left: 250, top: 50, width: 500, height: 500 };
  Object.assign(view, {
    innerWidth: 1000, innerHeight: 800,
    requestAnimationFrame(callback) { resizeFrame = callback; return 1; },
    cancelAnimationFrame() { resizeFrame = null; },
    ResizeObserver: class {
      constructor(callback) { resizePanel = callback; }
      observe() {} disconnect() { resizePanel = null; }
    },
  });
  Object.assign(panel, {
    ownerDocument: { defaultView: view, createRange: () => ({
      selectNodeContents(node) { this.rect = node.rect; }, getClientRects() { return [this.rect]; },
    }) },
    childNodes: [], style: {}, classList: { contains: () => false }, closest: () => null,
    hasAttribute: name => attrs.has(name), setAttribute: name => attrs.add(name), removeAttribute: name => attrs.delete(name),
    setPointerCapture: id => { captured = id; }, hasPointerCapture: id => captured === id,
    releasePointerCapture: () => { captured = undefined; },
    getBoundingClientRect() {
      const [x, y] = (this.style.translate || '0px 0px').split(' ').map(parseFloat);
      return { ...bounds, left: bounds.left + x, top: bounds.top + y };
    },
  });
  const drag = createSheetDrag(panel, () => open);
  function pointer(type, clientX, clientY, options = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX, clientY, button: 0, pointerType: 'mouse', pointerId: 1, ...options });
    panel.dispatchEvent(event);
    return event.defaultPrevented;
  }
  return { panel, view, drag, pointer, close: () => { open = false; }, bounds, fit() { resizePanel(); resizeFrame?.(); } };
}

test('AI sheet moves from blank space, respects capture identity and keeps its bounds after release or resize', () => {
  const { panel, view, drag, pointer, bounds, fit } = fixture();
  assert.equal(pointer('pointerdown', 300, 180), true);
  pointer('pointermove', 301, 181);
  assert.equal(panel.style.translate, undefined);
  pointer('pointermove', 360, 220, { pointerId: 2 });
  assert.equal(panel.style.translate, undefined);
  pointer('pointermove', 360, 220);
  assert.equal(panel.style.translate, '60px 40px');
  pointer('pointerup', 999, 790);
  assert.equal(panel.style.translate, '242px 242px');
  assert.equal(panel.hasPointerCapture(1), false);
  pointer('pointermove', 0, 0);
  assert.equal(panel.style.translate, '242px 242px');
  view.innerWidth = 800;
  bounds.height = 590;
  fit();
  assert.equal(panel.style.translate, '42px 152px');
  pointer('pointerdown', 300, 300);
  pointer('pointermove', 280, 280);
  pointer('lostpointercapture', 100, 100);
  assert.equal(panel.style.translate, '22px 132px');
  drag.reset();
  assert.equal(panel.style.translate, '');
  drag.dispose();
  assert.equal(pointer('pointerdown', 300, 180), false);
});

test('controls, selectable glyphs, secondary and touch input retain native handling', () => {
  const { panel, view, drag, pointer, close } = fixture();
  panel.closest = selector => selector.includes('input') ? {} : null;
  assert.equal(pointer('pointerdown', 300, 100), false);
  panel.closest = () => null;
  panel.childNodes = [{ nodeType: 3, textContent: 'AI解读', rect: { left: 270, right: 315, top: 90, bottom: 115 } }];
  assert.equal(pointer('pointerdown', 300, 100), false);
  assert.equal(pointer('pointerdown', 350, 100, { pointerType: 'touch' }), false);
  assert.equal(pointer('pointerdown', 350, 100, { button: 2 }), false);
  assert.equal(pointer('pointerdown', 350, 100), true);
  view.dispatchEvent(new Event('blur'));
  assert.equal(panel.hasPointerCapture(1), false);
  close();
  assert.equal(pointer('pointerdown', 350, 100), false);
  drag.dispose();
});
