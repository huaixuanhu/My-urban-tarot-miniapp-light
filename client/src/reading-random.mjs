import { createRandomSession } from './reading-random-data.mjs';

const pollInterval = 15000, pollWindow = 120000;
const browserClock = { now: () => performance.now(), setInterval: (callback, delay) => setInterval(callback, delay), clearInterval: timer => clearInterval(timer) };

export function createReadingRandom({ document, storage, operationStorage, getReading, disclosures, onChange = () => {}, client, clock = browserClock }) {
  const $ = id => document.getElementById(id);
  let disposed = false;
  const listeners = [];
  const listen = (target, type, handler) => { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); };
  let session;
  function render() {
    if (!session || disposed) return;
    const state = session.state, source = getReading()?.randomness?.source;
    const sourceLabel = source === 'anu' ? 'ANU 量子随机' : source === 'local' ? '普通随机' : '尚未洗牌';
    $('random-mode').checked = state.mode === 'quantum';
    $('random-current').textContent = sourceLabel;
    $('random-round-source').textContent = source ? sourceLabel : '';
    $('random-remaining').textContent = state.pool ? `${state.pool.remaining} / ${state.pool.total || 1024}` : '尚未读取';
    $('random-fetched').textContent = state.pool?.fetchedAt ? new Date(state.pool.fetchedAt).toLocaleString(undefined, { timeZoneName: 'short' }) : '—';
    $('random-collect').disabled = state.busy || !!state.pending || !!state.pool?.collecting;
    $('random-collect').textContent = state.busy && state.pending?.action === 'collect' ? '采集中…' : state.pool?.collecting ? '有人正在采集…' : state.pool?.batchId ? '重新采集 1024 个' : '采集 1024 个';
    $('random-recover').hidden = !state.pending;
    $('random-recover').disabled = state.busy;
    $('random-resume').hidden = !state.pending?.canResume;
    $('random-resume').disabled = state.busy;
    $('random-status').textContent = state.message || (state.pending ? '有一笔操作尚未确认，请查询结果。' : state.pool && state.pool.remaining < 155 ? '量子库存不足，请手动采集。普通随机仍可使用。' : '');
  }
  session = createRandomSession({ storage, operationStorage, client, onChange() { render(); onChange(); } });
  let timer = null;
  function stopPolling() { if (timer !== null) { clock.clearInterval(timer); timer = null; } }
  function startPolling() {
    stopPolling();
    if (disposed || document.hidden || !disclosures.isOpen('reading-random')) return;
    const deadline = clock.now() + pollWindow;
    session.refresh();
    timer = clock.setInterval(() => {
      if (disposed || document.hidden || !disclosures.isOpen('reading-random') || clock.now() >= deadline) { stopPolling(); return; }
      session.refresh();
    }, pollInterval);
  }
  listen($('random-mode'), 'change', () => session.setMode($('random-mode').checked ? 'quantum' : 'local'));
  listen($('random-collect'), 'click', () => { session.collect().catch(() => {}); });
  listen($('random-recover'), 'click', () => { session.recover().catch(() => {}); });
  listen($('random-resume'), 'click', () => { session.resume().catch(() => {}); });
  listen(document, 'reading:disclosurechange', event => { if (event.detail.id === 'reading-random') event.detail.open ? startPolling() : stopPolling(); });
  listen(document, 'visibilitychange', () => { document.hidden ? stopPolling() : startPolling(); });
  render();
  return {
    prepareDeck: () => session.prepareDeck(),
    update: render,
    get state() { return session.state; },
    dispose() { disposed = true; session.dispose(); listeners.forEach(cleanup => cleanup()); stopPolling(); },
  };
}
