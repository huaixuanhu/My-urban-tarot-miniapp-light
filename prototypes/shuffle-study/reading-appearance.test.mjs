import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_STORAGE_KEY, resolveAppearance, readAppearancePreference, createAppearancePreference } from '../../client/src/reading-appearance.mjs';

function storage(initial) {
  const values = new Map(initial ? [[APPEARANCE_STORAGE_KEY, initial]] : []);
  const writes = [];
  return { values, writes, getItem: key => values.get(key) ?? null, setItem(key, value) { writes.push([key, value]); values.set(key, value); } };
}

function systemQuery(dark = false) {
  const listeners = new Set();
  return {
    matches: dark,
    listeners,
    addEventListener(type, listener) { assert.equal(type, 'change'); listeners.add(listener); },
    removeEventListener(type, listener) { assert.equal(type, 'change'); listeners.delete(listener); },
    change(dark) { this.matches = dark; for (const listener of listeners) listener({ matches: dark }); },
  };
}

test('first-load preference follows the system unless a recognized override is stored', () => {
  for (const systemDark of [false, true]) {
    const systemTheme = systemDark ? 'dark' : 'light';
    for (const value of [undefined, null, '', 'system', 'auto', 'LIGHT', '{"theme":"dark"}']) {
      assert.equal(resolveAppearance(value, systemDark), systemTheme);
      assert.equal(readAppearancePreference(storage(value)), 'system');
    }
    for (const value of ['light', 'dark']) {
      assert.equal(resolveAppearance(value, systemDark), value);
      const store = storage(value), changes = [];
      const controller = createAppearancePreference({ storage: store, mediaQuery: systemQuery(systemDark), onChange: state => changes.push(state) });
      assert.deepEqual(changes, [{ preference: value, theme: value }]);
      assert.equal(controller.current.theme, value);
      assert.deepEqual(store.writes, []);
      controller.dispose();
    }
  }
});

test('system changes update appearance, manual selection holds, and returning to system uses the latest value', () => {
  const mediaQuery = systemQuery(), changes = [];
  const controller = createAppearancePreference({ mediaQuery, onChange: value => changes.push(value) });
  assert.deepEqual(controller.current, { preference: 'system', theme: 'light' });
  mediaQuery.change(true);
  assert.deepEqual(controller.current, { preference: 'system', theme: 'dark' });
  controller.set('light');
  const count = changes.length;
  mediaQuery.change(false);
  mediaQuery.change(true);
  assert.equal(changes.length, count);
  assert.deepEqual(controller.current, { preference: 'light', theme: 'light' });
  controller.set('system');
  assert.deepEqual(controller.current, { preference: 'system', theme: 'dark' });
  const settled = changes.length;
  mediaQuery.change(true);
  controller.set('system');
  assert.equal(changes.length, settled);
  controller.dispose();
});

test('only appearance is persisted and a new controller restores a manual choice', () => {
  const store = storage(), first = createAppearancePreference({ storage: store, mediaQuery: systemQuery() });
  first.set('dark');
  assert.deepEqual(store.writes, [[APPEARANCE_STORAGE_KEY, 'dark']]);
  first.dispose();
  const second = createAppearancePreference({ storage: store, mediaQuery: systemQuery() });
  assert.deepEqual(second.current, { preference: 'dark', theme: 'dark' });
  second.set('unknown');
  assert.deepEqual(second.current, { preference: 'system', theme: 'light' });
  assert.deepEqual([...store.values], [[APPEARANCE_STORAGE_KEY, 'system']]);
  second.dispose();
});

test('missing, blocked or full storage does not stop a current-session choice', () => {
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  for (const store of [undefined, unavailable]) {
    assert.equal(readAppearancePreference(store), 'system');
    const changes = [];
    const controller = createAppearancePreference({ storage: store, mediaQuery: systemQuery(true), onChange: state => changes.push(state) });
    assert.deepEqual(controller.current, { preference: 'system', theme: 'dark' });
    assert.doesNotThrow(() => controller.set('light'));
    assert.deepEqual(controller.current, { preference: 'light', theme: 'light' });
    assert.equal(changes.length, 2);
    controller.dispose();
  }
});

test('snapshots cannot mutate the preference and disposal removes observation', () => {
  const store = storage(), mediaQuery = systemQuery(), changes = [];
  const controller = createAppearancePreference({ storage: store, mediaQuery, onChange: state => changes.push(state) });
  const snapshot = controller.current;
  assert.throws(() => { snapshot.theme = 'dark'; }, TypeError);
  assert.equal(mediaQuery.listeners.size, 1);
  controller.dispose();
  controller.dispose();
  assert.equal(mediaQuery.listeners.size, 0);
  mediaQuery.change(true);
  controller.set('dark');
  assert.equal(controller.current, snapshot);
  assert.equal(changes.length, 1);
  assert.deepEqual(store.writes, []);
});
