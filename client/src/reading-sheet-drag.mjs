// Keep native form input, text selection and scrolling available around the grab surface.
function onBlankSpace(panel, event) {
  const target = event.target;
  if (target.closest('button, input, textarea, select, label, summary, a, [contenteditable], .ai-compute-control')) return false;
  if (target.classList.contains('sheet-content')) {
    const rect = target.getBoundingClientRect();
    if (event.clientX >= rect.left + target.clientLeft + target.clientWidth) return false;
  }
  // Text may share a block with a large empty area to its right. Use the line
  // boxes for the direct text nodes rather than excluding the entire block.
  for (const node of target.childNodes) {
    if (node.nodeType !== 3 || !node.textContent.trim()) continue;
    const range = panel.ownerDocument.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom) return false;
    }
  }
  return true;
}

const inset = 8;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createSheetDrag(panel, isOpen) {
  const view = panel.ownerDocument.defaultView;
  let x = 0, y = 0, grab = null, frame = 0;

  function position(nextX, nextY) {
    const rect = panel.getBoundingClientRect();
    const left = rect.left - x, top = rect.top - y;
    x = clamp(left + nextX, inset, view.innerWidth - rect.width - inset) - left;
    y = clamp(top + nextY, inset, view.innerHeight - rect.height - inset) - top;
    // The opening animation and centered layout own the transform property.
    panel.style.translate = `${x}px ${y}px`;
  }

  function start(event) {
    if (!isOpen() || grab || event.pointerType !== 'mouse' || event.button !== 0 || !onBlankSpace(panel, event)) return;
    event.preventDefault();
    grab = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
    panel.setPointerCapture(event.pointerId);
  }

  function move(event) {
    if (!grab || event.pointerId !== grab.id) return;
    const dx = event.clientX - grab.startX, dy = event.clientY - grab.startY;
    if (!panel.hasAttribute('data-sheet-dragging') && Math.hypot(dx, dy) < 3) return;
    panel.setAttribute('data-sheet-dragging', '');
    position(grab.x + dx, grab.y + dy);
  }

  function finish() {
    if (!grab) return;
    const id = grab.id;
    grab = null;
    panel.removeAttribute('data-sheet-dragging');
    if (panel.hasPointerCapture(id)) panel.releasePointerCapture(id);
  }

  function end(event) {
    if (!grab || event.pointerId !== grab.id) return;
    if (event.type === 'pointerup') move(event);
    finish();
  }

  function fit() {
    if (frame || (!x && !y)) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      if (isOpen()) position(x, y);
    });
  }

  function resize() { finish(); fit(); }
  const observer = new view.ResizeObserver(fit);
  observer.observe(panel);
  panel.addEventListener('pointerdown', start);
  panel.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) panel.addEventListener(type, end);
  view.addEventListener('resize', resize);
  view.addEventListener('blur', finish);

  function reset() {
    finish();
    view.cancelAnimationFrame(frame); frame = 0;
    x = y = 0;
    panel.style.translate = '';
  }

  return {
    finish, reset,
    dispose() {
      reset(); observer.disconnect();
      panel.removeEventListener('pointerdown', start);
      panel.removeEventListener('pointermove', move);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) panel.removeEventListener(type, end);
      view.removeEventListener('resize', resize);
      view.removeEventListener('blur', finish);
    },
  };
}
