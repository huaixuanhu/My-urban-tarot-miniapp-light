/** Shared, nonmodal glass sheets. Reading state and record storage stay outside. */
export function createReadingDisclosures({ document, reducedMotion = () => false }) {
  const $ = id => document.getElementById(id);
  const definitions = [
    ['table-tools', 'tools-toggle'],
    ['drawn-cards', 'drawn-toggle'],
    ['reading-records', 'records-toggle'],
    ['reading-ai', 'ai-toggle'],
    ['reading-random', 'random-toggle'],
  ];
  const sheets = new Map(definitions.map(([id, triggerId]) => [id, {
    element: $(id), panel: $(id)?.querySelector('.glass-sheet'), trigger: $(triggerId),
    state: 'closed', animation: null,
  }]).filter(([, entry]) => entry.element && entry.panel));
  const cleanups = [];
  let disposed = false;
  const listen = (element, type, handler, options) => {
    element?.addEventListener(type, handler, options);
    cleanups.push(() => element?.removeEventListener(type, handler, options));
  };
  const tell = (id, open) => {
    const Event = document.defaultView?.CustomEvent;
    if (Event) document.dispatchEvent(new Event('reading:disclosurechange', { detail: { id, open } }));
  };
  const noMotion = () => Boolean(reducedMotion());

  function settle(entry, visible) {
    entry.animation?.cancel(); entry.animation = null;
    entry.element.open = visible;
    entry.panel.inert = !visible;
    entry.state = visible ? 'open' : 'closed';
    delete entry.panel.dataset.motion;
  }

  function animate(entry, visible) {
    entry.animation?.cancel(); entry.animation = null;
    if (noMotion() || typeof entry.panel.animate !== 'function') { settle(entry, visible); return; }
    entry.state = visible ? 'opening' : 'closing';
    entry.panel.dataset.motion = entry.state;
    const resting = { transform: 'translate(-50%, 0) scale(1)', opacity: 1 };
    const tucked = { transform: 'translate(-50%, 22px) scale(.985)', opacity: 0 };
    const animation = entry.panel.animate(visible ? [tucked, resting] : [resting, tucked], {
      duration: visible ? 260 : 210, easing: visible ? 'cubic-bezier(.2,.75,.25,1)' : 'cubic-bezier(.4,0,.7,.3)', fill: 'both',
    });
    entry.animation = animation;
    animation.finished.then(() => {
      if (!disposed && entry.animation === animation) settle(entry, visible);
    }).catch(() => {}); // A new user action may legitimately replace the motion.
  }

  function close(id, { restoreFocus = false, motion = true } = {}) {
    const entry = sheets.get(id);
    if (!entry || ['closed', 'closing'].includes(entry.state)) return;
    if (restoreFocus || entry.panel.contains(document.activeElement)) $('tools-toggle')?.focus({ preventScroll: true });
    entry.trigger?.setAttribute('aria-expanded', 'false');
    entry.panel.inert = true;
    entry.state = 'closing';
    tell(id, false);
    if (motion) animate(entry, false); else settle(entry, false);
  }

  function closeAll(options = {}) {
    for (const [id] of sheets) close(id, options);
  }

  function open(id) {
    if (disposed) return;
    const entry = sheets.get(id);
    if (!entry || ['open', 'opening'].includes(entry.state)) return;
    // Replacing sheet content retains the same origin; outgoing content becomes
    // inert immediately, so fast repeated clicks cannot operate two surfaces.
    for (const [otherId] of sheets) if (otherId !== id) close(otherId);
    if ($('reader-details')?.open) $('reader-details').open = false;
    entry.element.open = true;
    entry.panel.inert = false;
    entry.trigger?.setAttribute('aria-expanded', 'true');
    animate(entry, true);
    const focus = id === 'drawn-cards'
      ? $('placed-list')?.querySelector('button') || entry.panel.querySelector('h2')
      : entry.panel.querySelector('h2');
    focus?.focus({ preventScroll: true });
    tell(id, true);
  }

  function toggle(id) {
    const entry = sheets.get(id);
    if (!entry) return;
    if (['open', 'opening'].includes(entry.state)) close(id, { restoreFocus: true }); else open(id);
  }

  for (const [id, entry] of sheets) {
    entry.panel.inert = !entry.element.open;
    listen(entry.trigger, 'click', () => toggle(id));
    for (const button of entry.panel.querySelectorAll('[data-sheet-close]')) listen(button, 'click', () => close(id, { restoreFocus: true }));
    for (const button of entry.panel.querySelectorAll('[data-sheet-back]')) listen(button, 'click', () => open('table-tools'));
    listen(entry.element, 'toggle', () => {
      // Reset and browser-native details changes are also reflected in the
      // animation state and accessible trigger, without a second source of truth.
      if (!entry.element.open && entry.state !== 'closed') {
        settle(entry, false); entry.trigger?.setAttribute('aria-expanded', 'false'); tell(id, false);
      } else if (entry.element.open && entry.state === 'closed') open(id);
    });
    listen(entry.panel, 'pointerdown', event => event.stopPropagation());
    listen(entry.panel, 'wheel', event => event.stopPropagation(), { passive: true });
  }

  listen($('reader-details'), 'toggle', () => {
    const expanded = $('reader-details').open;
    $('meaning')?.setAttribute('aria-expanded', String(expanded));
    if (expanded) closeAll();
  });
  listen(document, 'pointerdown', event => {
    if (event.target.closest?.('.help-tooltip')) return;
    if ([...sheets.values()].some(entry => entry.panel.contains(event.target) || entry.trigger?.contains(event.target))) return;
    closeAll();
  }, true);
  listen(document, 'keydown', event => {
    if (event.key !== 'Escape') return;
    const expanded = [...sheets].find(([, entry]) => ['open', 'opening'].includes(entry.state));
    if (!expanded) return;
    event.preventDefault(); event.stopImmediatePropagation();
    close(expanded[0], { restoreFocus: true });
  }, true);
  const finishMotion = () => {
    if (!noMotion()) return;
    for (const entry of sheets.values()) if (entry.animation) settle(entry, entry.state === 'opening');
  };
  listen($('reduce'), 'change', finishMotion);
  const preference = document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  listen(preference, 'change', finishMotion);

  return {
    open, close, closeAll, toggle,
    isOpen: id => ['open', 'opening'].includes(sheets.get(id)?.state),
    dispose() { disposed = true; for (const cleanup of cleanups) cleanup(); for (const entry of sheets.values()) settle(entry, false); },
  };
}
