/** Contextual reading help. All content is text; opening never dispatches a request. */
export const HELP_HOVER_DELAY_MS = 500;
const LEAVE_DELAY_MS = 160;
const managers = new WeakMap();
let nextId = 0;

function managerFor(doc) {
  if (managers.has(doc)) return managers.get(doc);
  const view = doc.defaultView, entries = new Set(), cleanups = [];
  const later = (callback, delay) => (view?.setTimeout ? view.setTimeout(callback, delay) : setTimeout(callback, delay));
  const cancel = timer => { if (timer !== null) (view?.clearTimeout ? view.clearTimeout(timer) : clearTimeout(timer)); };
  let active = null, host = null, popup = null, content = null, detail = null, detailContent = null, more = null;
  let popupHovered = false, detailHovered = false, restoringFocus = false;
  let prepareSurface = () => {}, explanations = {};
  const listen = (target, type, callback, options) => {
    target?.addEventListener(type, callback, options);
    cleanups.push(() => target?.removeEventListener(type, callback, options));
  };
  const node = (tag, className, text) => {
    const el = doc.createElement(tag); el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const withinHelp = target => !!target && ((!popup?.hidden && popup?.contains(target)) || (!detail?.hidden && detail?.contains(target)));
  const focusBack = target => { restoringFocus = true; target?.focus?.({ preventScroll: true }); restoringFocus = false; };
  function clearTimers(entry) { cancel(entry.openTimer); cancel(entry.closeTimer); entry.openTimer = entry.closeTimer = null; }
  function closeDetail(refocus = false) {
    if (!detail || detail.hidden) return;
    detail.hidden = true; detailHovered = false;
    more?.setAttribute('aria-expanded', 'false');
    if (refocus) focusBack(more);
  }
  function hide(entry = active) {
    if (!entry) return;
    clearTimers(entry); entry.pinned = false;
    if (active !== entry) return;
    closeDetail();
    entry.button.setAttribute('aria-expanded', 'false');
    if (entry.originalDescription) entry.button.setAttribute('aria-describedby', entry.originalDescription);
    else entry.button.removeAttribute('aria-describedby');
    popup.hidden = true; active = null; popupHovered = false;
  }
  function dismissAll() { for (const entry of entries) clearTimers(entry); hide(); }
  function keepOpen(entry) { return entry.hovered || entry.focused || entry.pinned || (active === entry && (popupHovered || detailHovered || withinHelp(doc.activeElement))); }
  function leave(entry) {
    cancel(entry.closeTimer);
    entry.closeTimer = later(() => { entry.closeTimer = null; if (!keepOpen(entry)) hide(entry); }, LEAVE_DELAY_MS);
  }
  function viewport() { return { width: view?.innerWidth || doc.documentElement?.clientWidth || 800, height: view?.innerHeight || doc.documentElement?.clientHeight || 600 }; }
  function place(el, left, top) { el.style.left = `${left}px`; el.style.top = `${top}px`; }
  function position(entry) {
    const anchor = entry.button.getBoundingClientRect(), { width, height } = viewport();
    const margin = 12, gap = 9;
    popup.style.maxWidth = `${Math.max(0, Math.min(288, width - margin * 2))}px`;
    popup.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
    place(popup, 0, 0);
    const box = popup.getBoundingClientRect();
    const above = anchor.bottom + gap + box.height > height - margin;
    const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - box.width / 2), Math.max(margin, width - box.width - margin));
    const top = above ? Math.max(margin, anchor.top - gap - box.height) : anchor.bottom + gap;
    place(popup, left, Math.min(top, Math.max(margin, height - box.height - margin)));
    popup.setAttribute('data-side', above ? 'above' : 'below');
  }
  function positionDetail() {
    const { width, height } = viewport(), margin = 12, gap = 12;
    detail.style.width = `${Math.min(360, width - margin * 2)}px`;
    detail.style.maxHeight = `${height - margin * 2}px`;
    place(detail, 0, 0);
    const anchor = popup.getBoundingClientRect(), box = detail.getBoundingClientRect();
    if (anchor.right + gap + box.width <= width - margin || anchor.left - gap - box.width >= margin) {
      const right = anchor.right + gap + box.width <= width - margin;
      place(detail, right ? anchor.right + gap : anchor.left - gap - box.width, Math.max(margin, Math.min(anchor.top, height - margin - box.height)));
      detail.setAttribute('data-side', right ? 'right' : 'left');
    } else {
      // Narrow screens keep the summary above the reading card; only the longer
      // card scrolls. Neither surface is scaled or forced outside the viewport.
      const available = Math.max(80, height - margin * 2 - anchor.height - gap);
      detail.style.maxHeight = `${available}px`;
      const top = Math.max(margin, Math.min(anchor.top, height - margin - anchor.height - gap - Math.min(box.height, available)));
      place(popup, Math.max(margin, Math.min(anchor.left, width - anchor.width - margin)), top);
      place(detail, Math.max(margin, Math.min(anchor.left, width - box.width - margin)), top + anchor.height + gap);
      detail.setAttribute('data-side', 'below');
    }
  }
  function surfaceEvents(surface, isDetail) {
    surface.addEventListener('animationend', event => { if (event.target === surface && active) prepareSurface(host); });
    surface.addEventListener('pointerenter', () => {
      if (isDetail) detailHovered = true; else popupHovered = true;
      if (active) { cancel(active.closeTimer); active.closeTimer = null; }
    });
    surface.addEventListener('pointerleave', () => { if (isDetail) detailHovered = false; else popupHovered = false; if (active) leave(active); });
    surface.addEventListener('focusout', event => {
      // Clicking/selecting prose blurs the heading to body without leaving the
      // glass. Outside pointer/focus handlers still dismiss immediately.
      if (!event.relatedTarget && (popupHovered || detailHovered)) return;
      if (active && !withinHelp(event.relatedTarget) && !active.button.contains(event.relatedTarget)) hide();
    });
  }
  function ensurePopup() {
    if (popup) return true;
    if (!doc.body) return false;
    host = node('div', 'reading-help-layer');
    popup = node('div', 'help-tooltip fg-glass fg-glass--mid'); popup.hidden = true;
    popup.setAttribute('data-fg-tier', 'mid'); popup.setAttribute('data-fg-press', 'off');
    content = node('div', 'help-tooltip-content'); popup.append(content);
    surfaceEvents(popup, false); host.append(popup); doc.body.append(host);
    return true;
  }
  function openDetail() {
    const explanation = explanations[active?.button.getAttribute('data-help-more')];
    if (!active || !explanation) return;
    if (detail && !detail.hidden) { closeDetail(true); position(active); prepareSurface(host); return; }
    active.pinned = true;
    if (!detail) {
      detail = node('section', 'help-detail fg-glass fg-glass--thick'); detail.id = `reading-help-detail-${++nextId}`;
      detail.setAttribute('role', 'dialog'); detail.setAttribute('aria-modal', 'false');
      detail.setAttribute('data-fg-tier', 'thick'); detail.setAttribute('data-fg-press', 'off');
      detailContent = node('div', 'help-detail-content'); detail.append(detailContent);
      surfaceEvents(detail, true); host.append(detail);
    }
    detailContent.textContent = '';
    const header = node('header', 'help-detail-heading'), title = node('h2', '', explanation.title);
    title.id = `${detail.id}-title`; title.tabIndex = -1;
    const close = node('button', 'help-detail-close', '×'); close.type = 'button'; close.setAttribute('aria-label', '收起随机数介绍');
    close.addEventListener('click', () => { closeDetail(true); position(active); prepareSurface(host); });
    header.append(title); header.append(close); detailContent.append(header);
    for (const section of explanation.sections) {
      const block = node('section', 'help-detail-section'); block.append(node('h3', '', section.title));
      for (const text of section.paragraphs) block.append(node('p', '', text));
      detailContent.append(block);
    }
    const sources = node('nav', 'help-detail-sources'); sources.setAttribute('aria-label', '资料来源');
    for (const source of explanation.sources) {
      const link = node('a', '', `${source.label} ↗`); link.setAttribute('href', source.url);
      link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer'); sources.append(link);
    }
    detailContent.append(sources); detail.setAttribute('aria-labelledby', title.id);
    detail.hidden = false; detail.scrollTop = 0; more.setAttribute('aria-expanded', 'true'); more.setAttribute('aria-controls', detail.id);
    positionDetail(); prepareSurface(host); title.focus?.({ preventScroll: true });
  }
  function show(entry) {
    clearTimers(entry);
    const text = entry.button.getAttribute('data-help')?.trim();
    if (entry.disposed || entry.button.disabled || entry.button.isConnected === false || !text || !ensurePopup()) return;
    if (active && active !== entry) hide(active);
    if (active === entry && !popup.hidden) return;
    active = entry; popupHovered = false;
    popup.id = entry.id; content.textContent = ''; more = null;
    content.append(node('span', '', text));
    const interactive = !!explanations[entry.button.getAttribute('data-help-more')];
    popup.setAttribute('role', interactive ? 'dialog' : 'tooltip');
    if (interactive) {
      popup.setAttribute('aria-label', entry.button.getAttribute('aria-label'));
      more = node('button', 'help-more', '更多 ↗'); more.type = 'button';
      more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-haspopup', 'dialog');
      more.addEventListener('click', openDetail); content.append(more);
      more.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || !event.shiftKey) return;
        event.preventDefault(); focusBack(entry.button);
      });
      const after = entry.button.getAttribute('data-help-after');
      if (after) content.append(node('span', 'help-after', after));
    } else popup.removeAttribute('aria-label');
    popup.hidden = false; popup.scrollTop = 0;
    entry.button.setAttribute('aria-describedby', [entry.originalDescription, entry.id].filter(Boolean).join(' '));
    entry.button.setAttribute('aria-expanded', 'true');
    position(entry); prepareSurface(host);
  }

  // Window capture precedes the sheets' Escape handler: detail, tip, then sheet.
  listen(view || doc, 'keydown', event => {
    if (event.key !== 'Escape' || !active) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (detail && !detail.hidden) { closeDetail(true); position(active); prepareSurface(host); }
    else { const trigger = active.button; dismissAll(); focusBack(trigger); }
  }, true);
  listen(doc, 'pointerdown', event => {
    for (const entry of entries) if (!entry.button.contains(event.target)) clearTimers(entry);
    if (active && !active.button.contains(event.target) && !withinHelp(event.target)) hide();
  }, true);
  listen(doc, 'focusin', event => { if (active && !active.button.contains(event.target) && !withinHelp(event.target)) hide(); });
  listen(doc, 'scroll', event => { if (!withinHelp(event.target)) dismissAll(); }, true);
  listen(view, 'resize', dismissAll);
  listen(doc, 'reading:disclosurechange', dismissAll);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) dismissAll(); });

  const manager = {
    configure(options) { prepareSurface = options.prepareSurface || prepareSurface; explanations = options.explanations || explanations; },
    bind(button, { label, id } = {}) {
      const existing = [...entries].find(entry => entry.button === button);
      if (existing) return existing;
      button.type = 'button'; button.classList.add('help-trigger');
      button.textContent = '?'; button.setAttribute('aria-label', `${label || button.getAttribute('data-help-label') || '帮助'}说明`);
      button.setAttribute('aria-expanded', 'false');
      if (explanations[button.getAttribute('data-help-more')]) button.setAttribute('aria-haspopup', 'dialog');
      const entry = { button, id: id || `reading-help-${++nextId}`, originalDescription: button.getAttribute('aria-describedby') || '',
        hovered: false, focused: false, pinned: false, openTimer: null, closeTimer: null, disposed: false, cleanups: [] };
      const on = (type, callback) => { button.addEventListener(type, callback); entry.cleanups.push(() => button.removeEventListener(type, callback)); };
      on('pointerenter', event => {
        if (event.pointerType === 'touch') return;
        entry.hovered = true; cancel(entry.closeTimer); entry.closeTimer = null;
        if (active === entry) return;
        cancel(entry.openTimer); entry.openTimer = later(() => { entry.openTimer = null; if (entry.hovered) show(entry); }, HELP_HOVER_DELAY_MS);
      });
      on('pointerleave', () => { entry.hovered = false; cancel(entry.openTimer); entry.openTimer = null; leave(entry); });
      on('focus', () => { entry.focused = true; if (!restoringFocus) show(entry); });
      on('keydown', event => {
        if (active !== entry || !more || event.key !== 'Tab' || event.shiftKey) return;
        event.preventDefault(); more.focus?.({ preventScroll: true });
      });
      on('blur', event => { entry.focused = false; entry.pinned = false; if (!entry.hovered && !popupHovered && !withinHelp(event.relatedTarget)) hide(entry); });
      on('click', event => {
        event.preventDefault(); // Safe inside a form label; never submits it.
        if (entry.pinned && active === entry) hide(entry);
        else { show(entry); entry.pinned = active === entry; }
      });
      entry.dispose = () => {
        if (entry.disposed) return;
        hide(entry); entry.disposed = true; entry.cleanups.forEach(cleanup => cleanup()); entries.delete(entry);
      };
      entries.add(entry); return entry;
    },
    dispose() { for (const entry of [...entries]) entry.dispose(); cleanups.forEach(cleanup => cleanup()); host?.remove(); managers.delete(doc); },
  };
  managers.set(doc, manager); return manager;
}

/** Update the trigger's data-help attribute to change explanatory text later. */
export function createHelpTip(doc, { label, text, id } = {}) {
  const wrapper = doc.createElement('span'); wrapper.className = 'help-tip';
  const button = doc.createElement('button'); button.setAttribute('data-help', String(text || ''));
  wrapper.append(button); managerFor(doc).bind(button, { label, id });
  return wrapper;
}

/** Static HTML uses <button data-help="…" data-help-label="…">?</button>. */
export function initializeInlineHelp(doc, options = {}) {
  const manager = managerFor(doc); manager.configure(options);
  const entries = [...doc.querySelectorAll('button[data-help]')].map(button => manager.bind(button));
  return () => entries.forEach(entry => entry.dispose());
}

export function disposeHelpTips(doc) { managers.get(doc)?.dispose(); }
