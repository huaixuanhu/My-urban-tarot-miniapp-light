import { createSheetDrag } from './reading-sheet-drag.mjs';

/** Shared, nonmodal glass sheets. Reading state and record storage stay outside. */
export function createReadingDisclosures({ document, reducedMotion = () => false, prepareSurface = () => {} }) {
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
    state: 'closed', animation: null, layers: [],
  }]).filter(([, entry]) => entry.element && entry.panel));
  const aiSheet = sheets.get('reading-ai');
  const aiDrag = aiSheet && createSheetDrag(aiSheet.panel, () => aiSheet.state === 'open');
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
    entry.layers.forEach(animation => animation.cancel()); entry.layers = [];
    entry.element.open = visible;
    entry.panel.inert = !visible;
    entry.state = visible ? 'open' : 'closed';
    if (!visible && entry === aiSheet) aiDrag.reset();
    delete entry.panel.dataset.motion;
  }

  function animate(entry, visible, openingButton) {
    if (noMotion() || typeof entry.panel.animate !== 'function') { settle(entry, visible); return; }
    entry.state = visible ? 'opening' : 'closing';
    entry.panel.dataset.motion = entry.state;
    if (entry.animation) {
      entry.animation.reverse();
      for (const layer of entry.layers) layer.reverse();
      return;
    }
    // Opacity on the glass itself creates a backdrop root and hides the room
    // from its refraction. Materialize only its content/optical child layers.
    const resting = { transform: 'translate(-50%, 0) scale(1)' };
    let tucked = { transform: 'translate(-50%, 12px) scale(.94)' };
    if (openingButton?.width && openingButton.height) {
      const panel = entry.panel.getBoundingClientRect();
      if (panel.width && panel.height) {
        const dx = openingButton.left + openingButton.width / 2 - (panel.left + panel.width / 2);
        const dy = openingButton.top + openingButton.height / 2 - (panel.top + panel.height / 2);
        const sx = openingButton.width / panel.width;
        const sy = openingButton.height / panel.height;
        resting.transformOrigin = 'center';
        tucked = { transformOrigin: 'center', transform: `translate(-50%, 0) translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` };
      }
    }
    const timing = { duration: visible ? 380 : 300, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' };
    const animation = entry.panel.animate(visible ? [tucked, resting] : [resting, tucked], {
      ...timing,
    });
    for (const layer of entry.panel.querySelectorAll(':scope > .sheet-heading, :scope > .sheet-content, :scope > .fg-glass__lens, :scope > .fg-glass__rf, :scope > .fg-glass__hi')) {
      if (typeof layer.animate === 'function') entry.layers.push(layer.animate({ opacity: visible ? [0, 1] : [1, 0] }, timing));
    }
    entry.animation = animation;
    animation.finished.then(() => {
      if (!disposed && entry.animation === animation) settle(entry, entry.state === 'opening');
    }).catch(() => {}); // A new user action may legitimately replace the motion.
  }

  function close(id, { restoreFocus = false, motion = true } = {}) {
    const entry = sheets.get(id);
    if (!entry || ['closed', 'closing'].includes(entry.state)) return;
    if (entry === aiSheet) aiDrag.finish();
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
    const openingButton = id === 'reading-ai' ? entry.trigger?.getBoundingClientRect() : null;
    for (const [otherId] of sheets) if (otherId !== id) close(otherId);
    if ($('reader-details')?.open) $('reader-details').open = false;
    entry.element.open = true;
    entry.panel.inert = false;
    entry.trigger?.setAttribute('aria-expanded', 'true');
    prepareSurface(entry.panel);
    animate(entry, true, openingButton);
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
    if (event.target.closest?.('.reading-help-layer')) return;
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
    dispose() { disposed = true; for (const cleanup of cleanups) cleanup(); for (const entry of sheets.values()) settle(entry, false); aiDrag?.dispose(); },
  };
}
