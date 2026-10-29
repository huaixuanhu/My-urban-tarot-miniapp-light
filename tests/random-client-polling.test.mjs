import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingRandom } from '../client/src/reading-random.mjs';

function fakeClock() {
  let now = 0, nextId = 0;
  const timers = new Map();
  return {
    now: () => now,
    setInterval(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay, at: now + delay }); return id; },
    clearInterval: id => timers.delete(id),
    get active() { return timers.size; },
    advance(duration) {
      const end = now + duration;
      for (;;) {
        const next = [...timers.values()].sort((a, b) => a.at - b.at)[0];
        if (!next || next.at > end) break;
        now = next.at; next.at += next.delay; next.callback();
      }
      now = end;
    },
  };
}

function setup() {
  const clock = fakeClock(), elements = new Map(), document = new EventTarget();
  document.hidden = false;
  document.getElementById = id => { if (!elements.has(id)) elements.set(id, new EventTarget()); return elements.get(id); };
  let open = false, requests = 0;
  const controller = createReadingRandom({
    document, clock, getReading: () => ({}), disclosures: { isOpen: () => open },
    client: { metadata: async () => { requests += 1; return { pool: { batchId: null, fetchedAt: null, total: 0, remaining: 0, collecting: false } }; } },
  });
  return {
    controller, clock, get requests() { return requests; },
    panel(value) { open = value; const event = new Event('reading:disclosurechange'); event.detail = { id: 'reading-random', open }; document.dispatchEvent(event); },
    visible(value) { document.hidden = !value; document.dispatchEvent(new Event('visibilitychange')); },
  };
}

test('visible pool refresh runs every 15 seconds for two minutes, then waits for an explicit reopen', () => {
  const ui = setup();
  ui.clock.advance(120000); assert.equal(ui.requests, 0);
  ui.panel(true); assert.equal(ui.requests, 1);
  ui.clock.advance(105000); assert.equal(ui.requests, 8);
  ui.clock.advance(15000); assert.equal(ui.requests, 8); assert.equal(ui.clock.active, 0);
  ui.clock.advance(1800000); assert.equal(ui.requests, 8);
  ui.panel(false); ui.panel(true); assert.equal(ui.requests, 9);
  ui.clock.advance(15000); assert.equal(ui.requests, 10);
  ui.controller.dispose();
});

test('hidden or closed panels make no requests; returning visibility starts a fresh bounded window only while open', () => {
  const ui = setup();
  ui.panel(true); ui.clock.advance(30000); assert.equal(ui.requests, 3);
  ui.visible(false); assert.equal(ui.clock.active, 0);
  ui.clock.advance(300000); assert.equal(ui.requests, 3);
  ui.visible(true); assert.equal(ui.requests, 4);
  ui.clock.advance(105000); assert.equal(ui.requests, 11);
  ui.clock.advance(15000); assert.equal(ui.requests, 11); assert.equal(ui.clock.active, 0);
  ui.visible(false); ui.visible(true); assert.equal(ui.requests, 12);
  ui.panel(false); ui.clock.advance(300000); assert.equal(ui.requests, 12);
  ui.visible(false); ui.visible(true); assert.equal(ui.requests, 12); assert.equal(ui.clock.active, 0);
  ui.visible(false); ui.panel(true); assert.equal(ui.requests, 12);
  ui.visible(true); assert.equal(ui.requests, 13);
  ui.controller.dispose();
});

test('reopening never duplicates timers and disposal removes the polling lifecycle', () => {
  const ui = setup();
  ui.panel(true); ui.panel(true); assert.equal(ui.clock.active, 1); assert.equal(ui.requests, 2);
  ui.clock.advance(15000); assert.equal(ui.requests, 3);
  ui.controller.dispose(); assert.equal(ui.clock.active, 0);
  ui.panel(false); ui.panel(true); ui.visible(false); ui.visible(true);
  ui.clock.advance(300000); assert.equal(ui.requests, 3);
});
