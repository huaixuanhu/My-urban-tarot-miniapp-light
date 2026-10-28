/** Small, text-only help. Opening it never changes reading or request state. */
export const HELP_HOVER_DELAY_MS = 500;
const LEAVE_DELAY_MS = 160;
const managers = new WeakMap();
let nextId = 0;

function managerFor(doc) {
  if (managers.has(doc)) return managers.get(doc);
  const view = doc.defaultView, entries = new Set(), cleanups = [];
  const later = (callback, delay) => (view?.setTimeout ? view.setTimeout(callback, delay) : setTimeout(callback, delay));
  const cancel = timer => { if (timer !== null) (view?.clearTimeout ? view.clearTimeout(timer) : clearTimeout(timer)); };
  let active = null, popup = null, popupHovered = false;
  const listen = (target, type, callback, options) => {
    target?.addEventListener(type, callback, options);
    cleanups.push(() => target?.removeEventListener(type, callback, options));
  };
  function clearTimers(entry) { cancel(entry.openTimer); cancel(entry.closeTimer); entry.openTimer = entry.closeTimer = null; }
  function hide(entry = active) {
    if (!entry) return;
    clearTimers(entry); entry.pinned = false;
    if (active !== entry) return;
    entry.button.setAttribute('aria-expanded', 'false');
    if (entry.originalDescription) entry.button.setAttribute('aria-describedby', entry.originalDescription);
    else entry.button.removeAttribute('aria-describedby');
    popup.hidden = true; active = null; popupHovered = false;
  }
  function dismissAll() {
    for (const entry of entries) clearTimers(entry);
    hide();
  }
  function keepOpen(entry) { return entry.hovered || entry.focused || entry.pinned || (active === entry && popupHovered); }
  function leave(entry) {
    cancel(entry.closeTimer);
    entry.closeTimer = later(() => { entry.closeTimer = null; if (!keepOpen(entry)) hide(entry); }, LEAVE_DELAY_MS);
  }
  function position(entry) {
    const anchor = entry.button.getBoundingClientRect();
    const width = view?.innerWidth || doc.documentElement?.clientWidth || 800;
    const height = view?.innerHeight || doc.documentElement?.clientHeight || 600;
    const margin = 12, gap = 9;
    popup.style.maxWidth = `${Math.max(0, Math.min(288, width - margin * 2))}px`;
    popup.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
    popup.style.left = '0px'; popup.style.top = '0px';
    const box = popup.getBoundingClientRect();
    const above = anchor.bottom + gap + box.height > height - margin;
    const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - box.width / 2), Math.max(margin, width - box.width - margin));
    const top = above ? Math.max(margin, anchor.top - gap - box.height) : anchor.bottom + gap;
    popup.style.left = `${left}px`; popup.style.top = `${Math.min(top, Math.max(margin, height - box.height - margin))}px`;
    popup.setAttribute('data-side', above ? 'above' : 'below');
  }
  function ensurePopup() {
    if (popup) return true;
    if (!doc.body) return false;
    popup = doc.createElement('div'); popup.className = 'help-tooltip'; popup.hidden = true;
    popup.setAttribute('role', 'tooltip');
    popup.addEventListener('pointerenter', () => { popupHovered = true; if (active) { cancel(active.closeTimer); active.closeTimer = null; } });
    popup.addEventListener('pointerleave', () => { popupHovered = false; if (active) leave(active); });
    doc.body.append(popup);
    return true;
  }
  function show(entry) {
    clearTimers(entry);
    const text = entry.button.getAttribute('data-help')?.trim();
    if (entry.disposed || entry.button.disabled || entry.button.isConnected === false || !text || !ensurePopup()) return;
    if (active && active !== entry) hide(active);
    active = entry; popupHovered = false;
    popup.id = entry.id; popup.textContent = text; popup.hidden = false;
    entry.button.setAttribute('aria-describedby', [entry.originalDescription, entry.id].filter(Boolean).join(' '));
    entry.button.setAttribute('aria-expanded', 'true');
    position(entry);
  }

  // Window capture precedes the sheets' document Escape handler, regardless of
  // initialization order. The first Escape dismisses help, the next the sheet.
  listen(view || doc, 'keydown', event => {
    if (event.key !== 'Escape' || !active) return;
    event.preventDefault(); event.stopImmediatePropagation(); dismissAll();
  }, true);
  listen(doc, 'pointerdown', event => {
    for (const entry of entries) if (!entry.button.contains(event.target)) clearTimers(entry);
    if (active && !active.button.contains(event.target) && !popup.contains(event.target)) hide();
  }, true);
  listen(doc, 'scroll', event => {
    if (!popup?.contains(event.target)) dismissAll();
  }, true);
  listen(view, 'resize', dismissAll);
  listen(doc, 'reading:disclosurechange', dismissAll);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) dismissAll(); });

  const manager = {
    bind(button, { label, id } = {}) {
      const existing = [...entries].find(entry => entry.button === button);
      if (existing) return existing;
      button.type = 'button'; button.classList.add('help-trigger');
      button.textContent = '?'; button.setAttribute('aria-label', `${label || button.getAttribute('data-help-label') || '帮助'}说明`);
      button.setAttribute('aria-expanded', 'false');
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
      on('focus', () => { entry.focused = true; show(entry); });
      on('blur', () => { entry.focused = false; entry.pinned = false; if (!entry.hovered && !popupHovered) hide(entry); });
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
    dispose() { for (const entry of [...entries]) entry.dispose(); cleanups.forEach(cleanup => cleanup()); popup?.remove(); managers.delete(doc); },
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
export function initializeInlineHelp(doc) {
  const manager = managerFor(doc);
  const entries = [...doc.querySelectorAll('button[data-help]')].map(button => manager.bind(button));
  return () => entries.forEach(entry => entry.dispose());
}

export function disposeHelpTips(doc) { managers.get(doc)?.dispose(); }
