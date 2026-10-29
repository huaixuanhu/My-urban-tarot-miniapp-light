import { createRandomSession } from './reading-random-data.mjs';

const pollInterval = 15000, pollWindow = 120000;
const browserClock = { now: () => performance.now(), setInterval: (callback, delay) => setInterval(callback, delay), clearInterval: timer => clearInterval(timer) };

export function createReadingRandom({ document, storage, operationStorage, getReading, disclosures, onChange = () => {}, client, quantumAccess = true, clock = browserClock }) {
  const $ = id => document.getElementById(id);
  let disposed = false;
  const listeners = [];
  const listen = (target, type, handler) => { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); };
  let session;
  function render() {
    if (!session || disposed) return;
    $('random-choice').hidden = false;
    const state = session.state, source = getReading()?.randomness?.source;
    const sourceLabel = source === 'anu' ? 'ANU 量子随机' : source === 'local' ? '系统随机' : '尚未洗牌';
    $('random-mode').checked = state.mode === 'quantum';
    $('random-mode-local').checked = state.mode === 'local';
    $('random-lock').hidden = quantumAccess;
    $('random-access-hint').hidden = quantumAccess;
    if (quantumAccess) $('random-mode').removeAttribute('aria-describedby');
    else $('random-mode').setAttribute('aria-describedby', 'random-access-hint');
    $('random-access-message').hidden = quantumAccess;
    $('random-current').textContent = sourceLabel;
    // Provenance belongs to the applied reading, not the next-round switch or pool.
    $('random-round-source').hidden = !['anu', 'local'].includes(source);
    $('random-round-label').textContent = source ? sourceLabel : '';
    $('random-quantum-icon').hidden = source !== 'anu';
    $('random-local-icon').hidden = source !== 'local';
    $('random-remaining').textContent = !quantumAccess ? '验证后可见' : state.pool ? `${state.pool.remaining} / ${state.pool.total || 1024}` : '尚未读取';
    $('random-fetched').textContent = state.pool?.fetchedAt ? new Date(state.pool.fetchedAt).toLocaleString(undefined, { timeZoneName: 'short' }) : '—';
    $('random-collect').hidden = !quantumAccess;
    $('random-collect').disabled = !quantumAccess || state.busy || !!state.pending || !!state.pool?.collecting;
    $('random-collect').textContent = state.busy && state.pending?.action === 'collect' ? '采集中…' : state.pool?.collecting ? '有人正在采集…' : state.pool?.batchId ? '重新采集 1024 个' : '采集 1024 个';
    $('random-recover').hidden = !quantumAccess || !state.pending;
    $('random-recover').disabled = state.busy;
    $('random-resume').hidden = !quantumAccess || !state.pending?.canResume;
    $('random-resume').disabled = state.busy;
    $('random-status').textContent = !quantumAccess ? '' : state.message || (state.pending ? '有一笔操作尚未确认，请查询结果。' : state.pool && state.pool.remaining < 155 ? '量子库存不足，请手动采集。系统随机仍可使用。' : '');
  }
  session = createRandomSession({ storage, operationStorage, client, quantumAccess, onChange() { render(); onChange(); } });
  let timer = null;
  function stopPolling() { if (timer !== null) { clock.clearInterval(timer); timer = null; } }
  function startPolling() {
    stopPolling();
    if (disposed || !quantumAccess || document.hidden || !disclosures.isOpen('reading-random')) return;
    const deadline = clock.now() + pollWindow;
    session.refresh();
    timer = clock.setInterval(() => {
      if (disposed || document.hidden || !disclosures.isOpen('reading-random') || clock.now() >= deadline) { stopPolling(); return; }
      session.refresh();
    }, pollInterval);
  }
  listen($('random-mode'), 'change', () => {
    if (!$('random-mode').checked) return;
    session.setMode('quantum');
    if (!quantumAccess) disclosures.open('reading-random');
  });
  listen($('random-mode-local'), 'change', () => { if ($('random-mode-local').checked) session.setMode('local'); });
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
